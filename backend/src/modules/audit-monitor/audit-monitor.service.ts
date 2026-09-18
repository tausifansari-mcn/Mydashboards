import { querySource } from '../../lib/sourceDb';
import prisma from '../../lib/prismaClient';
import { INBOUND_PARAMS, OUTBOUND_PARAMS } from '../call-master/call-master.service';

/**
 * AI Audit Monitoring
 * ───────────────────
 * Answers one question: for every active process, is the AI audit pipeline actually running?
 *
 * A call flows through two independent stages, and each can fail on its own:
 *   1. Transcription — the recording is turned into text (`Transcribe_Text` / `TranscribeText`).
 *   2. Scoring       — the AI grader reads that text and writes the parameter scores.
 *
 * A row can therefore exist while carrying no scores at all. That is what "blank" means here:
 * the row landed, but every audit parameter came back NULL/empty. Counting those blanks per
 * process — and, more sharply, counting how many have arrived *since the last successfully
 * scored call* (the blank streak) — is what tells you auditing has stopped for that process
 * rather than merely dipped.
 */

export type AuditHealth = 'healthy' | 'degraded' | 'not_auditing' | 'stalled' | 'no_data';

export interface MonitorFilters {
  startDate: string;        // 'YYYY-MM-DD HH:mm'
  endDate: string;
  clientIds?: number[];     // dialdesk_client_ids; undefined = unrestricted
  blankThreshold: number;   // consecutive blank calls that mean "not auditing"
  staleHours: number;       // no new call for this long = "stalled"
}

export interface ProcessAuditHealth {
  processId: number;
  processName: string;
  clientName: string;
  dialdeskClientId: number;
  lob: string;
  status: AuditHealth;
  reason: string;
  total: number;
  transcribed: number;
  noTranscript: number;
  scoredOk: number;
  scoredBlank: number;
  blankStreak: number;
  blankRate: number;          // scored_blank / transcribed  (scoring-stage failure)
  transcriptGapRate: number;  // no_transcript / total       (transcription-stage failure)
  coverage: number;           // scored_ok / total           (end-to-end success)
  lastCall: string | null;
  hoursSinceLastCall: number | null;
}

export interface MonitorOverview {
  generatedAt: string;
  thresholds: { blankThreshold: number; staleHours: number };
  summary: {
    totalProcesses: number;
    healthy: number;
    degraded: number;
    notAuditing: number;
    stalled: number;
    noData: number;
    totalCalls: number;
    totalScored: number;
    totalBlank: number;
    totalNoTranscript: number;
    coverage: number;
  };
  processes: ProcessAuditHealth[];
}

// ─── SQL fragments ───────────────────────────────────────────────────────────

// Inbound scores are nullable tinyints — the grader either wrote a 0/1 or wrote nothing at all.
const IB_BLANK = INBOUND_PARAMS.map(p => `q.\`${p.key}\` IS NULL`).join(' AND ');

// Outbound "scores" are free text: a justification, a transcript excerpt, or a bare flag. Blank
// means genuinely absent, matching how obFlagCase treats them elsewhere in the call-master module.
const OB_BLANK = OUTBOUND_PARAMS
  .filter(p => p.key !== 'SensitiveWordUsed') // absent sensitive words is the *good* case, not a gap
  .map(p => `(d.\`${p.key}\` IS NULL OR TRIM(d.\`${p.key}\`) = '' OR LOWER(TRIM(d.\`${p.key}\`)) IN ('none','0'))`)
  .join(' AND ');

// LENGTH() rather than TRIM() — these are mediumtext columns and TRIM() forces a full copy of
// every blob just to test emptiness, which measurably slowed the 30-day window.
const IB_HAS_TXT = `CASE WHEN q.Transcribe_Text IS NOT NULL AND LENGTH(q.Transcribe_Text) > 0 THEN 1 ELSE 0 END`;
const OB_HAS_TXT = `CASE WHEN d.TranscribeText IS NOT NULL AND LENGTH(d.TranscribeText) > 0 THEN 1 ELSE 0 END`;

interface RawHealthRow {
  ddc: number;
  total: number;
  transcribed: number;
  no_transcript: number;
  scored_blank: number;
  scored_ok: number;
  last_call: Date | string | null;
  blank_streak: number;
}

/**
 * `blank_streak` is the count of rows that arrived after the newest successfully scored one —
 * i.e. how many calls in a row the grader has failed on, right now. When nothing scored at all
 * in the window, `last_ok` is NULL and the streak is the whole window, which is the correct
 * reading: auditing never ran.
 */
function healthSql(source: 'inbound' | 'outbound', clientFilter: string): string {
  if (source === 'inbound') {
    return `
      SELECT t.ddc,
        COUNT(*)                                                    AS total,
        SUM(t.has_txt)                                              AS transcribed,
        SUM(1 - t.has_txt)                                          AS no_transcript,
        SUM(CASE WHEN t.has_txt = 1 AND t.blank = 1 THEN 1 ELSE 0 END) AS scored_blank,
        SUM(1 - t.blank)                                            AS scored_ok,
        MAX(t.CallDate)                                             AS last_call,
        SUM(CASE WHEN t.last_ok IS NULL OR t.CallDate > t.last_ok THEN 1 ELSE 0 END) AS blank_streak
      FROM (
        SELECT CAST(q.ClientId AS UNSIGNED) AS ddc, q.CallDate,
          ${IB_HAS_TXT} AS has_txt,
          CASE WHEN ${IB_BLANK} THEN 1 ELSE 0 END AS blank,
          MAX(CASE WHEN NOT (${IB_BLANK}) THEN q.CallDate END) OVER (PARTITION BY q.ClientId) AS last_ok
        FROM db_audit.call_quality_assessment q
        WHERE q.CallDate BETWEEN ? AND ? ${clientFilter}
      ) t
      GROUP BY t.ddc`;
  }
  return `
    SELECT t.ddc,
      COUNT(*)                                                    AS total,
      SUM(t.has_txt)                                              AS transcribed,
      SUM(1 - t.has_txt)                                          AS no_transcript,
      SUM(CASE WHEN t.has_txt = 1 AND t.blank = 1 THEN 1 ELSE 0 END) AS scored_blank,
      SUM(1 - t.blank)                                            AS scored_ok,
      MAX(t.CallDate)                                             AS last_call,
      SUM(CASE WHEN t.last_ok IS NULL OR t.CallDate > t.last_ok THEN 1 ELSE 0 END) AS blank_streak
    FROM (
      SELECT d.client_id AS ddc, d.CallDate,
        ${OB_HAS_TXT} AS has_txt,
        CASE WHEN ${OB_BLANK} THEN 1 ELSE 0 END AS blank,
        MAX(CASE WHEN NOT (${OB_BLANK}) THEN d.CallDate END) OVER (PARTITION BY d.client_id) AS last_ok
      FROM db_external.CallDetails d
      WHERE d.CallDate BETWEEN ? AND ? ${clientFilter}
    ) t
    GROUP BY t.ddc`;
}

async function fetchHealthRows(
  source: 'inbound' | 'outbound',
  filters: MonitorFilters,
): Promise<Map<number, RawHealthRow>> {
  const col = source === 'inbound' ? 'q.ClientId' : 'd.client_id';
  const clientFilter = filters.clientIds?.length
    ? `AND ${col} IN (${filters.clientIds.map(() => '?').join(',')})`
    : '';
  const params: (string | number | null)[] = [
    filters.startDate, filters.endDate, ...(filters.clientIds || []),
  ];

  const rows = await querySource<RawHealthRow>(healthSql(source, clientFilter), params);
  return new Map(rows.map(r => [Number(r.ddc), r]));
}

// ─── Health classification ───────────────────────────────────────────────────

const EMPTY: Omit<RawHealthRow, 'ddc'> = {
  total: 0, transcribed: 0, no_transcript: 0,
  scored_blank: 0, scored_ok: 0, last_call: null, blank_streak: 0,
};

function mergeRows(a: Omit<RawHealthRow, 'ddc'>, b: Omit<RawHealthRow, 'ddc'>): Omit<RawHealthRow, 'ddc'> {
  const lastA = a.last_call ? new Date(a.last_call).getTime() : 0;
  const lastB = b.last_call ? new Date(b.last_call).getTime() : 0;
  return {
    total:         Number(a.total) + Number(b.total),
    transcribed:   Number(a.transcribed) + Number(b.transcribed),
    no_transcript: Number(a.no_transcript) + Number(b.no_transcript),
    scored_blank:  Number(a.scored_blank) + Number(b.scored_blank),
    scored_ok:     Number(a.scored_ok) + Number(b.scored_ok),
    // A combined IB/OB process is only as fresh as its most recent call on either side, but only
    // as healthy as its worst streak — a dead outbound grader must not be masked by a live inbound one.
    last_call:     lastA >= lastB ? a.last_call : b.last_call,
    blank_streak:  Math.max(Number(a.blank_streak), Number(b.blank_streak)),
  };
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

function classify(
  r: Omit<RawHealthRow, 'ddc'>,
  f: MonitorFilters,
  hoursSince: number | null,
): { status: AuditHealth; reason: string } {
  const total = Number(r.total);
  if (total === 0) {
    return { status: 'no_data', reason: 'No audit rows landed for this process in the selected window.' };
  }

  if (hoursSince !== null && hoursSince > f.staleHours) {
    const d = Math.floor(hoursSince / 24);
    const ago = d >= 1 ? `${d} day${d === 1 ? '' : 's'}` : `${Math.round(hoursSince)}h`;
    return { status: 'stalled', reason: `No new audited call for ${ago} — the feed has stopped.` };
  }

  const scoredOk = Number(r.scored_ok);
  if (scoredOk === 0) {
    return {
      status: 'not_auditing',
      reason: `All ${total} call${total === 1 ? '' : 's'} came back with blank parameter scores — nothing was graded.`,
    };
  }

  const streak = Number(r.blank_streak);
  if (streak > f.blankThreshold) {
    return {
      status: 'not_auditing',
      reason: `Last ${streak} calls in a row scored blank (threshold is ${f.blankThreshold}) — grading has stopped.`,
    };
  }

  const blankRate = pct(Number(r.scored_blank), Number(r.transcribed));
  if (blankRate >= 20) {
    return { status: 'degraded', reason: `${blankRate}% of transcribed calls came back unscored.` };
  }

  const gapRate = pct(Number(r.no_transcript), total);
  if (gapRate >= 50) {
    return { status: 'degraded', reason: `${gapRate}% of calls were never transcribed, so they could not be graded.` };
  }

  if (streak > 0) {
    return { status: 'degraded', reason: `${streak} most recent call${streak === 1 ? '' : 's'} scored blank.` };
  }

  return { status: 'healthy', reason: 'Transcription and grading are both keeping up.' };
}

// ─── Overview ────────────────────────────────────────────────────────────────

export async function getOverview(filters: MonitorFilters): Promise<MonitorOverview> {
  const [ib, ob, processes] = await Promise.all([
    fetchHealthRows('inbound', filters),
    fetchHealthRows('outbound', filters),
    prisma.md_processes.findMany({
      where: {
        is_active: true,
        ...(filters.clientIds?.length ? { dialdesk_client_id: { in: filters.clientIds } } : {}),
      },
      include: { client: { select: { name: true } } },
    }),
  ]);

  const now = Date.now();

  const rows: ProcessAuditHealth[] = processes.map(p => {
    const lob = p.lob.trim();
    const isIb = /^(inbound|ib)/i.test(lob);
    const isOb = /^(outbound|ob)/i.test(lob);
    const both = !isIb && !isOb; // 'IB/OB' and anything else unrecognised — show the full picture

    let raw: Omit<RawHealthRow, 'ddc'> = EMPTY;
    if (isIb || both) raw = mergeRows(raw, ib.get(p.dialdesk_client_id) ?? EMPTY);
    if (isOb || both) raw = mergeRows(raw, ob.get(p.dialdesk_client_id) ?? EMPTY);

    const lastCall = raw.last_call ? new Date(raw.last_call) : null;
    const hoursSince = lastCall ? (now - lastCall.getTime()) / 36e5 : null;
    const { status, reason } = classify(raw, filters, hoursSince);

    return {
      processId: p.id,
      processName: p.process_name,
      clientName: p.client?.name ?? 'Unknown',
      dialdeskClientId: p.dialdesk_client_id,
      lob,
      status,
      reason,
      total:         Number(raw.total),
      transcribed:   Number(raw.transcribed),
      noTranscript:  Number(raw.no_transcript),
      scoredOk:      Number(raw.scored_ok),
      scoredBlank:   Number(raw.scored_blank),
      blankStreak:   Number(raw.blank_streak),
      blankRate:         pct(Number(raw.scored_blank), Number(raw.transcribed)),
      transcriptGapRate: pct(Number(raw.no_transcript), Number(raw.total)),
      coverage:          pct(Number(raw.scored_ok), Number(raw.total)),
      lastCall: lastCall ? lastCall.toISOString() : null,
      hoursSinceLastCall: hoursSince !== null ? Math.round(hoursSince * 10) / 10 : null,
    };
  });

  // Worst first — this page exists to surface what is broken, not to list what works.
  const rank: Record<AuditHealth, number> = {
    not_auditing: 0, stalled: 1, no_data: 2, degraded: 3, healthy: 4,
  };
  rows.sort((a, b) => rank[a.status] - rank[b.status] || b.total - a.total);

  const sum = (fn: (r: ProcessAuditHealth) => number) => rows.reduce((t, r) => t + fn(r), 0);
  const count = (s: AuditHealth) => rows.filter(r => r.status === s).length;
  const totalCalls = sum(r => r.total);

  return {
    generatedAt: new Date().toISOString(),
    thresholds: { blankThreshold: filters.blankThreshold, staleHours: filters.staleHours },
    summary: {
      totalProcesses: rows.length,
      healthy:      count('healthy'),
      degraded:     count('degraded'),
      notAuditing:  count('not_auditing'),
      stalled:      count('stalled'),
      noData:       count('no_data'),
      totalCalls,
      totalScored:       sum(r => r.scoredOk),
      totalBlank:        sum(r => r.scoredBlank),
      totalNoTranscript: sum(r => r.noTranscript),
      coverage:          pct(sum(r => r.scoredOk), totalCalls),
    },
    processes: rows,
  };
}

// ─── Daily timeline ──────────────────────────────────────────────────────────

export interface TimelinePoint {
  date: string;
  total: number;
  scored: number;
  blank: number;
  noTranscript: number;
  coverage: number;
}

export async function getTimeline(filters: MonitorFilters): Promise<TimelinePoint[]> {
  const ibFilter = filters.clientIds?.length
    ? `AND q.ClientId IN (${filters.clientIds.map(() => '?').join(',')})` : '';
  const obFilter = filters.clientIds?.length
    ? `AND d.client_id IN (${filters.clientIds.map(() => '?').join(',')})` : '';
  const params: (string | number | null)[] = [
    filters.startDate, filters.endDate, ...(filters.clientIds || []),
  ];

  const [ibRows, obRows] = await Promise.all([
    querySource<{ d: string; total: number; blank: number; no_txt: number }>(`
      SELECT DATE(q.CallDate) AS d,
        COUNT(*) AS total,
        SUM(CASE WHEN ${IB_BLANK} THEN 1 ELSE 0 END) AS blank,
        SUM(1 - ${IB_HAS_TXT}) AS no_txt
      FROM db_audit.call_quality_assessment q
      WHERE q.CallDate BETWEEN ? AND ? ${ibFilter}
      GROUP BY DATE(q.CallDate)`, params),
    querySource<{ d: string; total: number; blank: number; no_txt: number }>(`
      SELECT DATE(d.CallDate) AS d,
        COUNT(*) AS total,
        SUM(CASE WHEN ${OB_BLANK} THEN 1 ELSE 0 END) AS blank,
        SUM(1 - ${OB_HAS_TXT}) AS no_txt
      FROM db_external.CallDetails d
      WHERE d.CallDate BETWEEN ? AND ? ${obFilter}
      GROUP BY DATE(d.CallDate)`, params),
  ]);

  // MySQL DATE() yields local midnight, which toISOString() would roll back into the previous
  // day for any timezone ahead of UTC (IST here) — so build the key from local parts instead.
  const pad = (n: number) => String(n).padStart(2, '0');
  const dayKey = (v: string | Date) => {
    const d = new Date(v);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const byDate = new Map<string, { total: number; blank: number; noTxt: number }>();
  for (const r of [...ibRows, ...obRows]) {
    const key = dayKey(r.d);
    const cur = byDate.get(key) ?? { total: 0, blank: 0, noTxt: 0 };
    cur.total += Number(r.total);
    cur.blank += Number(r.blank);
    cur.noTxt += Number(r.no_txt);
    byDate.set(key, cur);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      total: v.total,
      scored: v.total - v.blank,
      blank: v.blank,
      noTranscript: v.noTxt,
      coverage: pct(v.total - v.blank, v.total),
    }));
}

// ─── Blank-call drilldown ────────────────────────────────────────────────────

export interface BlankCallSample {
  callDate: string;
  agent: string | null;
  mobile: string | null;
  leadId: string | null;
  durationSec: number | null;
  hasTranscript: boolean;
  stage: 'transcription' | 'scoring';
}

/** The individual calls behind a process's blank count — the evidence for its status. */
export async function getBlankCalls(
  dialdeskClientId: number,
  lob: string,
  filters: MonitorFilters,
  limit = 100,
): Promise<BlankCallSample[]> {
  const isOb = /^(outbound|ob)/i.test(lob.trim());

  const rows = isOb
    ? await querySource<Record<string, unknown>>(`
        SELECT d.CallDate, d.AgentName AS agent, d.MobileNo AS mobile,
               d.LeadID AS lead_id, d.length_in_sec AS dur, ${OB_HAS_TXT} AS has_txt
        FROM db_external.CallDetails d
        WHERE d.client_id = ? AND d.CallDate BETWEEN ? AND ? AND (${OB_BLANK})
        ORDER BY d.CallDate DESC LIMIT ${Number(limit)}`,
        [dialdeskClientId, filters.startDate, filters.endDate])
    : await querySource<Record<string, unknown>>(`
        SELECT q.CallDate, q.User AS agent, q.MobileNo AS mobile,
               q.lead_id, q.length_in_sec AS dur, ${IB_HAS_TXT} AS has_txt
        FROM db_audit.call_quality_assessment q
        WHERE CAST(q.ClientId AS UNSIGNED) = ? AND q.CallDate BETWEEN ? AND ? AND (${IB_BLANK})
        ORDER BY q.CallDate DESC LIMIT ${Number(limit)}`,
        [dialdeskClientId, filters.startDate, filters.endDate]);

  return rows.map(r => {
    const hasTranscript = Number(r.has_txt) === 1;
    return {
      callDate: new Date(r.CallDate as string).toISOString(),
      agent:  r.agent  ? String(r.agent)  : null,
      mobile: r.mobile ? String(r.mobile) : null,
      leadId: r.lead_id ? String(r.lead_id) : null,
      durationSec: r.dur !== null && r.dur !== undefined ? Number(r.dur) || null : null,
      hasTranscript,
      // Where it broke: no text at all means transcription never delivered; text present but no
      // scores means the grader is the one that failed.
      stage: hasTranscript ? 'scoring' : 'transcription',
    };
  });
}
