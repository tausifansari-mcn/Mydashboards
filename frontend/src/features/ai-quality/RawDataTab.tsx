import { useEffect, useState, useCallback, useRef } from 'react';
import { Search, X, RotateCcw, Loader2, ChevronLeft, ChevronRight, Play, Square } from 'lucide-react';
import api from '@/lib/axios';

interface NarrowRow {
  callId: number;
  callDate: string;
  agentName: string;
  mobileNo: string;
  fileName?: string;
  leadId?: string;
}

interface TranscriptData {
  agentName: string;
  mobileNo: string;
  callDate: string;
  transcript: string;
}

function fmtDateTime(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Monday of the current week through today — matches "default should be current week" ask.
function currentWeekRange(): { from: string; to: string } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diffToMonday);
  return { from: toDateInput(monday), to: toDateInput(now) };
}

const NARROW_PAGE_SIZE = 100;
const WIDE_PAGE_SIZE = 50; // wide mode renders every CallDetails column, so a smaller page keeps the table snappy

// Shared Outbound/Inbound "Raw Data" browser: date range (default current week) + Mobile No filter,
// with recording playback (outbound) or a transcript reader (inbound) per row. Used by both
// ProcessQualityDashboard and InboundQualityDashboard, parameterized by which API/columns apply.
// wideColumns=true renders every column the API returns (outbound's "show all columns" ask) instead
// of the fixed Date/Agent/Mobile set, with horizontal scroll controls since the table runs wide.
export default function RawDataTab({
  clientId, apiPath, hasRecording, hasTranscript, transcriptApiPath, transcriptParam, wideColumns,
  recordingColumn = 'FileName', freezeTranscript,
}: {
  clientId: string;
  apiPath: string;
  hasRecording: boolean;
  hasTranscript: boolean;
  transcriptApiPath?: string;
  transcriptParam?: 'callId' | 'leadId';
  wideColumns?: boolean;
  recordingColumn?: string;
  freezeTranscript?: boolean;
}) {
  const defaultWeek = currentWeekRange();
  const [fromDate, setFromDate] = useState(defaultWeek.from);
  const [toDate, setToDate] = useState(defaultWeek.to);
  const [mobileInput, setMobileInput] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<(NarrowRow | Record<string, unknown>)[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [transcript, setTranscript] = useState<{ loading: boolean; data: TranscriptData | null } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pageSize = wideColumns ? WIDE_PAGE_SIZE : NARROW_PAGE_SIZE;

  const fetchRows = useCallback((reset: boolean, afterCursor: number | null) => {
    if (!clientId) return;
    (reset ? setLoading : setLoadingMore)(true);
    const params: Record<string, string | number> = {
      startDate: `${fromDate} 00:00`,
      endDate:   `${toDate} 23:59`,
      clientId,
      limit: pageSize,
    };
    if (mobileNo) params.mobileNo = mobileNo;
    if (afterCursor) params.cursor = afterCursor;
    api.get<{ data: { columns?: string[]; rows: (NarrowRow | Record<string, unknown>)[]; nextCursor: number | null } }>(apiPath, { params })
      .then(r => {
        const data = r.data?.data ?? { rows: [], nextCursor: null };
        if (data.columns) setColumns(data.columns);
        setRows(prev => reset ? data.rows : [...prev, ...data.rows]);
        setCursor(data.nextCursor);
        setHasMore(data.nextCursor !== null);
      })
      .catch(() => { if (reset) { setRows([]); setCursor(null); setHasMore(false); } })
      .finally(() => (reset ? setLoading : setLoadingMore)(false));
  }, [clientId, apiPath, fromDate, toDate, mobileNo, pageSize]);

  useEffect(() => { fetchRows(true, null); }, [fetchRows]);

  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const openTranscript = (row: NarrowRow | Record<string, unknown>) => {
    if (!transcriptApiPath || !transcriptParam) return;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    const key = transcriptParam === 'callId' ? (row as Record<string, unknown>).callId ?? (row as Record<string, unknown>).id : (row as Record<string, unknown>).leadId ?? (row as Record<string, unknown>).lead_id;
    if (!key) return;
    setTranscript({ loading: true, data: null });
    api.get<{ data: unknown }>(transcriptApiPath, { params: { [transcriptParam]: key } })
      .then(r => {
        const d = r.data?.data as Record<string, unknown> | null;
        if (!d) { setTranscript({ loading: false, data: null }); return; }
        setTranscript({
          loading: false,
          data: {
            agentName: String(d.agentName ?? d.agent_id ?? 'Unknown'),
            mobileNo:  String(d.mobileNo ?? (row as Record<string, unknown>).mobileNo ?? (row as Record<string, unknown>).MobileNo ?? ''),
            callDate:  String(d.callDate ?? d.date ?? (row as Record<string, unknown>).callDate ?? (row as Record<string, unknown>).CallDate ?? ''),
            transcript: String(d.transcript ?? ''),
          },
        });
      })
      .catch(() => setTranscript({ loading: false, data: null }));
  };

  const closeTranscript = () => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setTranscript(null);
  };

  const togglePlay = (text: string) => {
    if (!window.speechSynthesis) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    setSpeaking(true);
    // Chrome silently does nothing if speak() is called in the same tick right after cancel() —
    // a well-known speechSynthesis race that reads as the player being "frozen" at the very start.
    // A tick of delay avoids it.
    setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(text);
      // One voice for the whole mixed Hindi/English transcript — hi-IN still speaks the English
      // words (just with an Indian-Hindi accent) instead of the two-voice back-and-forth switching
      // that per-language splitting produced.
      utter.lang = 'hi-IN';
      utter.rate = 1.35;
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    }, 50);
  };

  const resetToCurrentWeek = () => {
    const w = currentWeekRange();
    setFromDate(w.from);
    setToDate(w.to);
    setMobileInput('');
    setMobileNo('');
  };

  const scrollTable = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' });
  };

  const displayColumns = wideColumns ? columns : ['CallDate', 'AgentName', 'MobileNo'];

  // Which action column(s) are pinned as frozen leading columns, in order — Recording first (if
  // present), then Transcript right after it (only when freezeTranscript is set — inbound wants
  // both frozen since it now has real recordings too; outbound keeps its Transcript column trailing
  // and unfrozen, as before, since only inbound asked for both to stay pinned while scrolling).
  const FROZEN_RECORDING_WIDTH = 220; // matches the audio widget's minWidth below
  const frozenRecording = wideColumns && hasRecording;
  const frozenTranscriptCol = wideColumns && hasTranscript && (freezeTranscript || !hasRecording);
  const transcriptLeft = frozenRecording ? FROZEN_RECORDING_WIDTH : 0;
  const trailingTranscript = hasTranscript && !frozenTranscriptCol;

  const bodyColumns = frozenRecording ? displayColumns.filter(c => c !== recordingColumn) : displayColumns;
  const totalColCount = bodyColumns.length
    + (frozenRecording ? 1 : 0) + (frozenTranscriptCol ? 1 : 0)
    + (hasRecording && !wideColumns ? 1 : 0) + (trailingTranscript ? 1 : 0);
  const FROZEN_TH = 'sticky z-10 bg-slate-50 text-left px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap border-b border-r border-slate-200 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.12)]';
  const FROZEN_TD = 'sticky z-10 bg-white px-3 py-2 border-r border-slate-200 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.12)]';

  const cellValue = (row: Record<string, unknown>, col: string) => {
    const v = row[col];
    if (v === null || v === undefined || v === '') return '—';
    return String(v);
  };

  return (
    <div className="mt-4">
      {/* ─── Filter bar ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3 mb-4 p-3 rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-md border border-slate-300 bg-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-md border border-slate-300 bg-white" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Mobile No</label>
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={mobileInput} onChange={e => setMobileInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setMobileNo(mobileInput.trim()); }}
              placeholder="Search mobile no…"
              className="text-xs pl-7 pr-2.5 py-1.5 rounded-md border border-slate-300 bg-white w-40" />
          </div>
        </div>
        <button onClick={() => setMobileNo(mobileInput.trim())}
          className="px-3 py-1.5 rounded-md text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors">
          Apply
        </button>
        <button onClick={resetToCurrentWeek}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-400 transition-colors">
          <RotateCcw size={11} /> Current Week
        </button>
        {wideColumns && (
          <div className="flex items-center gap-1 ml-1">
            <button onClick={() => scrollTable('left')} title="Scroll left"
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-400 transition-colors">
              <ChevronLeft size={13} />
            </button>
            <button onClick={() => scrollTable('right')} title="Scroll right"
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-400 transition-colors">
              <ChevronRight size={13} />
            </button>
          </div>
        )}
        <span className="text-[10px] text-slate-400 ml-auto">{loading ? 'Loading…' : `${rows.length.toLocaleString()} call${rows.length === 1 ? '' : 's'} loaded`}</span>
        {mobileNo && (
          <div className="w-full text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
            Searching "{mobileNo}" across all dates — the From/To filter is ignored while a mobile number search is active.
          </div>
        )}
      </div>

      {/* ─── Table ──────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50">
              {frozenRecording && <th className={FROZEN_TH} style={{ left: 0 }}>Recording</th>}
              {frozenTranscriptCol && <th className={FROZEN_TH} style={{ left: transcriptLeft }}>Transcript</th>}
              {bodyColumns.map(h => (
                <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap border-b border-slate-200">{h}</th>
              ))}
              {hasRecording && !wideColumns && <th className="text-left px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap border-b border-slate-200">Recording</th>}
              {trailingTranscript && <th className="text-left px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap border-b border-slate-200">Transcript</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={totalColCount} className="px-3 py-2"><div className="h-6 rounded bg-slate-100 animate-pulse" /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={totalColCount} className="px-3 py-10 text-center text-slate-400">No calls found for this filter.</td></tr>
            ) : (
              rows.map((raw, i) => {
                const r = raw as Record<string, unknown>;
                return (
                  <tr key={i} className={`${i % 2 ? 'bg-slate-50/70' : 'bg-white'} hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0`}>
                    {frozenRecording && (
                      <td className={FROZEN_TD} style={{ left: 0, minWidth: FROZEN_RECORDING_WIDTH }}>
                        {r[recordingColumn]
                          ? <audio controls preload="metadata" src={String(r[recordingColumn])} style={{ height: 30, width: 210 }} />
                          : <span className="text-slate-300 italic">No recording</span>}
                      </td>
                    )}
                    {frozenTranscriptCol && (
                      <td className={FROZEN_TD} style={{ left: transcriptLeft }}>
                        <button onClick={() => openTranscript(raw)}
                          className="font-mono text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">
                          Read Transcript
                        </button>
                      </td>
                    )}
                    {wideColumns ? (
                      bodyColumns.map(col => (
                        <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis" style={{ maxWidth: 260 }} title={cellValue(r, col)}>
                          {cellValue(r, col)}
                        </td>
                      ))
                    ) : (
                      <>
                        <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">{fmtDateTime(String(r.CallDate ?? r.callDate ?? ''))}</td>
                        <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{String(r.AgentName ?? r.agentName ?? 'Unknown')}</td>
                        <td className="px-3 py-2 font-mono text-slate-600 whitespace-nowrap">{String(r.MobileNo ?? r.mobileNo ?? '') || '—'}</td>
                        {hasRecording && (
                          <td className="px-3 py-2" style={{ minWidth: 220 }}>
                            {r.FileName || r.fileName
                              ? <audio controls preload="metadata" src={String(r.FileName ?? r.fileName)} style={{ height: 30, width: 210 }} />
                              : <span className="text-slate-300 italic">No recording</span>}
                          </td>
                        )}
                      </>
                    )}
                    {trailingTranscript && (
                      <td className="px-3 py-2">
                        <button onClick={() => openTranscript(raw)}
                          className="font-mono text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">
                          Read Transcript
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center mt-4">
          <button onClick={() => fetchRows(false, cursor)} disabled={loadingMore}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold text-blue-600 border border-blue-200 hover:border-blue-400 hover:bg-blue-50 disabled:opacity-50 transition-colors">
            {loadingMore && <Loader2 size={12} className="animate-spin" />}
            {loadingMore ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}

      {/* ─── Transcript modal ───────────────────────────────────────────── */}
      {transcript && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={closeTranscript}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white">
              <div>
                <p className="text-sm font-bold text-slate-900">Call Transcript</p>
                {transcript.data && (
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                    {transcript.data.agentName} · {transcript.data.mobileNo} · {fmtDateTime(transcript.data.callDate)}
                  </p>
                )}
              </div>
              {/* Text-to-speech fallback — useful whether or not this specific row has a real
                  recording (older inbound calls before call_recording existed still have none). */}
              {transcript.data?.transcript && (
                <button onClick={() => togglePlay(transcript.data!.transcript)}
                  className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    speaking ? 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100' : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                  }`}>
                  {speaking ? <Square size={12} /> : <Play size={12} />}
                  {speaking ? 'Stop' : 'Play'}
                </button>
              )}
              <button onClick={closeTranscript} className={`${transcript.data?.transcript ? '' : 'ml-auto'} text-slate-400 hover:text-slate-900 transition-colors p-1`}><X size={18} /></button>
            </div>
            <div className="overflow-auto flex-1 p-6">
              {transcript.loading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                  <span className="text-sm">Loading transcript…</span>
                </div>
              ) : !transcript.data?.transcript ? (
                <p className="text-center text-slate-400 text-sm py-10">No transcript available for this call.</p>
              ) : (
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{transcript.data.transcript}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
