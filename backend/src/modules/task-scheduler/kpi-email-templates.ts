// Renders the same KPI cards shown on each dashboard's "Overall Performance" page as
// email-safe HTML (table-based layout, inline styles) — same labels/colors as the live page,
// so a scheduled report reads like a snapshot of the page itself, not a generic data dump.
import { getProjectSummary, getProjectsMeta } from '../inbound/inbound.service';
import { getInboundProcessKPIs, type InboundProcessKPIs } from '../inbound-quality/inbound-quality.service';
import { getKPIs } from '../quality/quality.service';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Card { label: string; value: string; color: string; }

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function cardCell(c: Card): string {
  return `
    <td width="25%" style="padding:4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
        <tr><td style="border-top:3px solid ${c.color};background:#f8fafc;border-radius:8px;padding:12px 10px;">
          <div style="font-size:19px;font-weight:800;color:${c.color};line-height:1.1;">${escapeHtml(c.value)}</div>
          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;margin-top:4px;">${escapeHtml(c.label)}</div>
        </td></tr>
      </table>
    </td>`;
}

function cardRow(cards: Card[]): string {
  const cells = cards.map(cardCell);
  while (cells.length < 4) cells.push('<td width="25%"></td>');
  return `<tr>${cells.join('')}</tr>`;
}

function kpiSection(title: string, accent: string, cards: Card[]): string {
  const rows = chunk(cards, 4).map(cardRow).join('');
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <tr><td style="background:${accent};padding:9px 14px;">
        <p style="margin:0;font-size:11px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(title)}</p>
      </td></tr>
      <tr><td style="padding:8px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
      </td></tr>
    </table>`;
}

// ─── Per-module color/threshold helpers — mirror the live dashboard exactly ──────

const alColor     = (v: number) => v >= 95 ? '#22C55E' : v >= 85 ? '#F59E0B' : '#EF4444';
const slColor     = (v: number) => v >= 80 ? '#22C55E' : v >= 65 ? '#F59E0B' : '#EF4444';
const achtColor   = (v: number) => v <= 300 ? '#22C55E' : v <= 360 ? '#F59E0B' : '#EF4444';
const repeatColor = (v: number) => v <= 20 ? '#22C55E' : v <= 30 ? '#F59E0B' : '#EF4444';
const cqColor     = (v: number) => v >= 90 ? '#22C55E' : v >= 85 ? '#F59E0B' : v > 0 ? '#EF4444' : '#64748B';

function inboundCards(s: { offered: number; answered: number; al: number; sl: number; acht: number; repeat_pct: number; fcr_pct: number | null }, hasFCR: boolean, brandColor: string): Card[] {
  const cards: Card[] = [
    { label: 'Offered',  value: s.offered.toLocaleString(),  color: brandColor },
    { label: 'Answered', value: s.answered.toLocaleString(), color: '#22C55E' },
    { label: 'AL%',      value: `${s.al}%`,                  color: alColor(s.al) },
    { label: 'SL%',      value: `${s.sl}%`,                  color: slColor(s.sl) },
    { label: 'ACHT',     value: `${s.acht}s`,                color: achtColor(s.acht) },
    { label: 'Repeat%',  value: `${s.repeat_pct}%`,          color: repeatColor(s.repeat_pct) },
  ];
  if (hasFCR && s.fcr_pct != null) cards.push({ label: 'FCR%', value: `${s.fcr_pct}%`, color: '#A855F7' });
  return cards;
}

function aiQualityInboundCards(k: InboundProcessKPIs): Card[] {
  return [
    { label: 'CQ Score%',            value: `${k.cq_score}%`,          color: cqColor(k.cq_score) },
    { label: 'W/O Fatal CQ Score%',  value: `${k.cq_score_no_fatal}%`, color: '#38BDF8' },
    { label: 'Audit Count',          value: k.audit_count.toLocaleString(), color: '#A78BFA' },
    { label: 'Excellent Call',       value: k.excellent.toLocaleString(),   color: '#22C55E' },
    { label: 'Good Call',            value: k.good.toLocaleString(),        color: '#3B82F6' },
    { label: 'Average Call',         value: k.average_count.toLocaleString(), color: '#F59E0B' },
    { label: 'Below Average',        value: k.below_average.toLocaleString(), color: '#EF4444' },
  ];
}

function aiQualityInboundScoreComponents(k: InboundProcessKPIs): Card[] {
  return [
    { label: 'Opening Skill',  value: `${k.opening_skill}%`,  color: '#0EA5E9' },
    { label: 'Soft Skill',     value: `${k.soft_skill}%`,     color: '#8B5CF6' },
    { label: 'Hold Procedure', value: `${k.hold_procedure}%`, color: '#F59E0B' },
    { label: 'Resolution',     value: `${k.resolution}%`,     color: '#14B8A6' },
    { label: 'Closing',        value: `${k.closing}%`,        color: '#EC4899' },
    { label: 'Avg Score',      value: `${k.avg_score}%`,      color: '#8B5CF6' },
  ];
}

function outboundCstCards(cst: { totalCalls: number; ops: number; cps: number; offeredSuccess: number; saleDone: number; successRatePct: number }): Card[] {
  return [
    { label: 'Total Calls',     value: cst.totalCalls.toLocaleString(),     color: '#3B82F6' },
    { label: 'OPS',             value: cst.ops.toLocaleString(),            color: '#22C55E' },
    { label: 'CPS',             value: cst.cps.toLocaleString(),            color: '#14B8A6' },
    { label: 'Offered Success', value: cst.offeredSuccess.toLocaleString(), color: '#A78BFA' },
    { label: 'Sale Done',       value: cst.saleDone.toLocaleString(),       color: '#F59E0B' },
    { label: 'Success Rate',    value: `${cst.successRatePct}%`,            color: '#22C55E' },
  ];
}

function outboundCrtCards(crt: { orCount: number; crCount: number; oprCount: number; porCount: number; failureRatePct: number }): Card[] {
  return [
    { label: 'OR (Opening Rejected)',    value: crt.orCount.toLocaleString(),  color: '#EF4444' },
    { label: 'CR (Context Rejected)',    value: crt.crCount.toLocaleString(),  color: '#F59E0B' },
    { label: 'OPR (Offering Rejected)',  value: crt.oprCount.toLocaleString(), color: '#A78BFA' },
    { label: 'POR (Post Offer Rejected)', value: crt.porCount.toLocaleString(), color: '#3B82F6' },
    { label: 'Failure Rate',             value: `${crt.failureRatePct}%`,      color: '#EF4444' },
  ];
}

// ─── Outbound NPS Cards ──────────────────────────────────────────────────────
function outboundNpsCards(nps: { total: number; promoter: number; detractor: number; passive: number; npsScore: number; csatPct: number }): Card[] {
  return [
    { label: 'NPS Score', value: `${nps.npsScore}`, color: nps.npsScore >= 0 ? '#22C55E' : '#EF4444' },
    { label: 'Total Feedback', value: nps.total.toLocaleString(), color: '#3B82F6' },
    { label: 'Promoter', value: nps.promoter.toLocaleString(), color: '#22C55E' },
    { label: 'Passive', value: nps.passive.toLocaleString(), color: '#F59E0B' },
    { label: 'Detractor', value: nps.detractor.toLocaleString(), color: '#EF4444' },
    { label: 'CSAT%', value: `${nps.csatPct}%`, color: '#14B8A6' },
  ];
}

// ─── Outbound Opportunity Cards ──────────────────────────────────────────────
function outboundOpportunityCards(opp: { totalOpportunities: number; moCount: number; opportunityLossPie?: {name: string; value: number}[] }): Card[] {
  const totalLoss = opp.opportunityLossPie?.reduce((a, b) => a + b.value, 0) ?? 0;
  return [
    { label: 'Total Opportunities', value: opp.totalOpportunities.toLocaleString(), color: '#3B82F6' },
    { label: 'MO Count', value: opp.moCount.toLocaleString(), color: '#22C55E' },
    { label: 'Opportunity Lost', value: totalLoss.toLocaleString(), color: '#EF4444' },
  ];
}

// ─── Mini Data Table ─────────────────────────────────────────────────────────
function miniTable(title: string, accent: string, headers: string[], rows: string[][], maxRows = 6): string {
  const head = headers.map(h => `<td style="padding:6px 10px;font-size:10px;font-weight:800;color:#94a3b8;text-transform:uppercase;background:#f1f5f9;">${escapeHtml(h)}</td>`).join('');
  const body = rows.slice(0, maxRows).map((r, i) => {
    const cells = r.map(c => `<td style="padding:6px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;${i % 2 ? 'background:#f8fafc;' : ''}">${escapeHtml(c)}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  const more = rows.length > maxRows ? `<tr><td colspan="${headers.length}" style="padding:6px 10px;font-size:11px;color:#94a3b8;text-align:center;">+ ${rows.length - maxRows} more</td></tr>` : '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
      <tr><td style="background:${accent};padding:9px 14px;"><p style="margin:0;font-size:11px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(title)}</p></td></tr>
      <tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>${head}</tr>${body}${more}
      </table></td></tr>
    </table>`;
}

// ─── Inbound Quality Risk Cards ──────────────────────────────────────────────
function aiQualityInboundRiskCards(k: InboundProcessKPIs): Card[] {
  return [
    { label: 'Fatal', value: k.fatal_count.toLocaleString(), color: '#EF4444' },
    { label: 'Social Media / Court Threat', value: k.social_media_court_threat.toLocaleString(), color: '#B91C1C' },
    { label: 'Potential Scam', value: k.potential_scam.toLocaleString(), color: '#DC2626' },
    { label: 'Frustration', value: k.frustration_count.toLocaleString(), color: '#F59E0B' },
    { label: 'Threats', value: k.threat_count.toLocaleString(), color: '#EF4444' },
    { label: 'Abuse', value: k.abuse_count.toLocaleString(), color: '#DC2626' },
    { label: 'Cuss / Abuse', value: k.cuss_abuse_count.toLocaleString(), color: '#B91C1C' },
    { label: 'Slang', value: k.slang_count.toLocaleString(), color: '#F59E0B' },
    { label: 'Sarcasm', value: k.sarcasm_count.toLocaleString(), color: '#F59E0B' },
  ];
}

// ─── Public entry point — one HTML block per selected page ────────────────────
export async function buildPageKpiHtml(
  page: { module: string; target_key: string; target_label: string },
  startDate: string, endDate: string,
): Promise<string> {
  if (page.module === 'inbound') {
    const rows = await getProjectSummary({ startDate, endDate }, page.target_key);
    const meta = getProjectsMeta().find(p => p.key === page.target_key);
    const brandColor = meta?.color ?? '#3B82F6';
    const s = rows[0];
    if (!s) return kpiSection(`${page.target_label} — Inbound Overview`, brandColor, [{ label: 'No data', value: '—', color: '#64748B' }]);
    return kpiSection(`${page.target_label} — Inbound Overview`, brandColor, inboundCards(s, meta?.hasFCR ?? false, brandColor));
  }

  if (page.module === 'ai_quality_inbound') {
    const k = await getInboundProcessKPIs({ startDate, endDate, clientId: page.target_key });
    return kpiSection(`${page.target_label} — AI Quality Inbound Overview`, '#1565C0', aiQualityInboundCards(k))
         + kpiSection(`${page.target_label} — Score Components`, '#7C3AED', aiQualityInboundScoreComponents(k))
         + kpiSection(`${page.target_label} — Risk & Customer Stress`, '#DC2626', aiQualityInboundRiskCards(k));
  }

  if (page.module === 'ai_quality_outbound') {
    const k = await getKPIs({ startDate, endDate, clientId: page.target_key });
    return kpiSection(`${page.target_label} — Customer Success Track`, '#1565C0', outboundCstCards(k.cst))
         + kpiSection(`${page.target_label} — Customer Rejection Track`, '#B91C1C', outboundCrtCards(k.crt))
         + kpiSection(`${page.target_label} — NPS Summary`, '#7C3AED', outboundNpsCards(k.nps))
         + kpiSection(`${page.target_label} — Opportunity`, '#16a34a', outboundOpportunityCards(k.opportunity));
  }

  // sales — CSV attachment only, no KPI summary block
  return '';
}