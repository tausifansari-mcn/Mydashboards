import { useEffect, useState, useCallback, Fragment } from 'react';
import {
  ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, HelpCircle, MinusCircle,
  Download, X, ChevronRight, TrendingDown, Sparkles, Loader2, FileText, Activity,
} from 'lucide-react';
import api from '@/lib/axios';
import FraudCallTab from './FraudCallTab';

// ─── Types (mirror bellavitaCompliance.service.ts response shapes) ─────────────────────────────
interface ParameterStat {
  code: string; name: string; category: string; critical: boolean;
  passed: number; failed: number; review: number; na: number; applicableCalls: number; percentage: number;
}
interface MonthlyData {
  totalCalls: number; auditedCalls: number; overallCompliance: number;
  compliantCalls: number; nonCompliantCalls: number; criticalCalls: number; reviewRequiredCalls: number;
  parameters: ParameterStat[];
  payment: { codPassed: number; prepaidPassed: number; bothPassed: number; neitherCovered: number; applicableCalls: number };
  critical: { totalCases: number; percentage: number; breakdown: { code: string; name: string; calls: number }[] };
  topImprovementAreas: { code: string; name: string; percentage: number }[];
  insights: string[];
  aiSummary: string;
}
interface CallListRow {
  callId: string; agentId: string | null; agentName: string | null; callDate: string;
  auditStatus: string; overallScore: number | null; hasCriticalIssue: boolean;
}
type AuditResult = 'PASS' | 'FAIL' | 'REVIEW' | 'NA';
interface CallParameterResult {
  code: string; name: string; category: string; critical: boolean; result: AuditResult;
  score: number | null; confidence: number | null; evidence: string | null;
  timestamp: string | null; speaker: string | null; reason: string | null;
}
interface CallDetail {
  callId: string; agentId: string | null; agentName: string | null; callDate: string; durationSec: number | null;
  auditStatus: string; overallScore: number | null; hasCriticalIssue: boolean;
  strengths: string[]; improvementAreas: string[]; aiSummary: string | null;
  parameters: CallParameterResult[];
}
interface TranscriptData {
  callId: number; leadId: string; agentName: string; mobileNo: string; callDate: string; transcript: string;
}

// ─── Live SOP signals — real, already AI-graded per call (not the ingestion-based 50-parameter
// system above, which stays empty until an external audit system posts to it). These come straight
// from db_external.CallDetails via the existing, already-verified Bellavita CQ Score endpoint, so
// they're populated immediately and are as accurate as the upstream grading itself. ──────────────
interface BellavitaCQParamSummary {
  opening: number; offered: number; objectionHandling: number;
  prepaidPitch: number; upsellingEfforts: number; offerUrgency: number;
}
interface BellavitaCQAgentRow extends BellavitaCQParamSummary {
  agentId: string; agentName: string; callCount: number; overallScore: number;
}
interface BellavitaCQDetails {
  totalCalls: number; paramPassRate: BellavitaCQParamSummary; byAgent: BellavitaCQAgentRow[];
}

const NAVY = '#1D4ED8', NAVY_DARK = '#1E3A8A';
const GREEN = '#16A34A', RED = '#DC2626', AMBER = '#D97706', SLATE = '#64748B';

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const body = rows.map(r =>
    keys.map(k => {
      const v = r[k];
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\n');
  const blob = new Blob(['﻿' + `${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function fmt(n: number): string { return n.toLocaleString('en-IN'); }

function resultColor(r: AuditResult): string {
  return r === 'PASS' ? GREEN : r === 'FAIL' ? RED : r === 'REVIEW' ? AMBER : SLATE;
}
function ResultIcon({ r, size = 14 }: { r: AuditResult; size?: number }) {
  const color = resultColor(r);
  if (r === 'PASS') return <CheckCircle2 size={size} style={{ color }} />;
  if (r === 'FAIL') return <XCircle size={size} style={{ color }} />;
  if (r === 'REVIEW') return <HelpCircle size={size} style={{ color }} />;
  return <MinusCircle size={size} style={{ color }} />;
}

function ConfidenceBadge({ c }: { c: number | null }) {
  if (c == null) return null;
  const pct = Math.round(c * 100);
  const label = pct >= 90 ? 'High' : pct >= 75 ? 'Medium' : 'Review';
  const color = pct >= 90 ? GREEN : pct >= 75 ? AMBER : RED;
  return (
    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color, background: `${color}18` }}>
      {pct}% {label}
    </span>
  );
}

const months = Array.from({ length: 12 }, (_, i) => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
  const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return { value: v, label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }) };
});

function monthToRange(month: string): { startDate: string; endDate: string } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { startDate: `${month}-01 00:00`, endDate: `${month}-${String(lastDay).padStart(2, '0')} 23:59` };
}

// ─── KPI card ───────────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color, icon: Icon, sub }: {
  label: string; value: string; color: string; icon: typeof ShieldCheck; sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <Icon size={15} style={{ color }} />
      </div>
      <p className="text-xl font-black tabular-nums text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function LiveParamCard({ label, pct, highlight }: { label: string; pct: number; highlight?: boolean }) {
  const color = pct >= 80 ? GREEN : pct >= 60 ? AMBER : RED;
  return (
    <div className={`rounded-xl p-3 ${highlight ? 'border-2' : 'border'}`} style={{ borderColor: highlight ? NAVY : '#E2E8F0', background: highlight ? `${NAVY}08` : '#fff' }}>
      <p className="text-[10px] font-semibold text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-black tabular-nums" style={{ color }}>{pct}%</p>
    </div>
  );
}

function ProgressBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-700">{label}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// Simple 4-segment donut for payment pitch coverage, no chart library dependency.
function PaymentDonut({ cod, prepaid, both, neither, total }: {
  cod: number; prepaid: number; both: number; neither: number; total: number;
}) {
  const segs = [
    { key: 'Both', value: both, color: GREEN },
    { key: 'COD only', value: Math.max(0, cod - both), color: NAVY },
    { key: 'Prepaid only', value: Math.max(0, prepaid - both), color: '#0891B2' },
    { key: 'Neither', value: neither, color: RED },
  ].filter(s => s.value > 0);
  const R = 46, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0 -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#F1F5F9" strokeWidth="16" />
        {total > 0 && segs.map(s => {
          const frac = s.value / total;
          const dash = frac * C;
          const el = (
            <circle key={s.key} cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth="16"
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset} strokeLinecap="butt" />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="flex flex-col gap-1.5">
        {segs.map(s => (
          <div key={s.key} className="flex items-center gap-2 text-[11px]">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
            <span className="text-slate-600">{s.key}</span>
            <span className="font-bold tabular-nums text-slate-900">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Highlights the evidence substring (best-effort exact/fuzzy match) inside the full transcript —
// there's no per-word timestamp alignment in TranscribeText, so this is substring search, not true
// timestamp-anchored highlighting.
function HighlightedTranscript({ transcript, evidence }: { transcript: string; evidence: string | null }) {
  if (!evidence || !evidence.trim()) return <p className="whitespace-pre-wrap">{transcript}</p>;
  const idx = transcript.indexOf(evidence);
  if (idx === -1) return <p className="whitespace-pre-wrap">{transcript}</p>;
  return (
    <p className="whitespace-pre-wrap">
      {transcript.slice(0, idx)}
      <mark className="bg-amber-200 rounded px-0.5">{transcript.slice(idx, idx + evidence.length)}</mark>
      {transcript.slice(idx + evidence.length)}
    </p>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  OPENING: 'Opening & Customer Handling', PRODUCT: 'Product & Offer Compliance',
  PAYMENT: 'Payment Compliance', SALES: 'Sales Process',
  CRITICAL: 'Critical Compliance', SOFT_SKILLS: 'Soft Skills',
};

// ─── Call Audit Detail modal ────────────────────────────────────────────────────────────────
function CallDetailModal({ callId, onClose }: { callId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptData | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<{ data: CallDetail }>(`/quality/bellavita-compliance/calls/${callId}`)
      .then(res => setDetail(res.data.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [callId]);

  const loadTranscript = () => {
    if (transcript || transcriptLoading) { setShowTranscript(v => !v); return; }
    setTranscriptLoading(true);
    api.get<{ data: TranscriptData }>(`/quality/bellavita-compliance/calls/${callId}/transcript`)
      .then(res => { setTranscript(res.data.data); setShowTranscript(true); })
      .catch(() => setTranscript(null))
      .finally(() => setTranscriptLoading(false));
  };

  const expandedParam = detail?.parameters.find(p => p.code === expanded) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ background: `linear-gradient(135deg, ${NAVY_DARK}, ${NAVY})` }}>
          <div className="flex items-center gap-2 text-white">
            <ShieldCheck size={16} />
            <span className="text-sm font-bold">Call Audit Detail</span>
            {detail?.hasCriticalIssue && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/90">CRITICAL</span>
            )}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-slate-400" size={24} /></div>
        ) : !detail ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Call audit not found</div>
        ) : (
          <div className="overflow-y-auto p-5 space-y-4">
            {/* Call information */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><p className="text-slate-400">Call ID</p><p className="font-semibold text-slate-800">{detail.callId}</p></div>
              <div><p className="text-slate-400">Agent</p><p className="font-semibold text-slate-800">{detail.agentName ?? '—'}</p></div>
              <div><p className="text-slate-400">Date</p><p className="font-semibold text-slate-800">{detail.callDate}</p></div>
              <div><p className="text-slate-400">Duration</p><p className="font-semibold text-slate-800">{detail.durationSec != null ? `${detail.durationSec}s` : '—'}</p></div>
            </div>

            {/* Overall score */}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <div className="text-2xl font-black tabular-nums" style={{ color: (detail.overallScore ?? 0) >= 80 ? GREEN : (detail.overallScore ?? 0) >= 50 ? AMBER : RED }}>
                {detail.overallScore ?? '—'}%
              </div>
              <div className="text-xs text-slate-500">Overall Compliance Score · {detail.auditStatus}</div>
            </div>

            {/* Parameter checklist */}
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">Parameters</div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {detail.parameters.map(p => (
                  <button key={p.code} onClick={() => setExpanded(v => v === p.code ? null : p.code)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors">
                    <ResultIcon r={p.result} />
                    <span className="text-xs text-slate-700 flex-1">{p.name}</span>
                    {p.critical && <ShieldAlert size={12} className="text-red-500" />}
                    <span className="text-[10px] font-bold uppercase" style={{ color: resultColor(p.result) }}>{p.result}</span>
                    <ChevronRight size={12} className={`text-slate-300 transition-transform ${expanded === p.code ? 'rotate-90' : ''}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Evidence panel for the expanded parameter */}
            {expandedParam && (
              <div className="rounded-xl p-3 text-xs space-y-1.5" style={{ background: `${resultColor(expandedParam.result)}0d`, border: `1px solid ${resultColor(expandedParam.result)}30` }}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{expandedParam.name}</span>
                  <span className="font-bold uppercase text-[10px]" style={{ color: resultColor(expandedParam.result) }}>{expandedParam.result}</span>
                  <ConfidenceBadge c={expandedParam.confidence} />
                </div>
                {expandedParam.reason && <p className="text-slate-600"><span className="font-semibold">Reason: </span>{expandedParam.reason}</p>}
                {expandedParam.evidence ? (
                  <p className="text-slate-700 italic bg-white/60 rounded px-2 py-1">
                    "{expandedParam.evidence}"
                    {expandedParam.timestamp && <span className="not-italic text-slate-400 ml-2">@ {expandedParam.timestamp}{expandedParam.speaker ? ` · ${expandedParam.speaker}` : ''}</span>}
                  </p>
                ) : (
                  <p className="text-slate-400 italic">No supporting transcript evidence recorded for this result.</p>
                )}
                <button onClick={loadTranscript} className="flex items-center gap-1 text-[10px] font-semibold mt-1" style={{ color: NAVY }}>
                  <FileText size={11} /> {transcriptLoading ? 'Loading…' : showTranscript ? 'Hide transcript' : 'Open Transcript'}
                </button>
              </div>
            )}

            {showTranscript && transcript && (
              <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600 leading-relaxed max-h-56 overflow-y-auto bg-slate-50">
                <HighlightedTranscript transcript={transcript.transcript || 'No transcript available for this call.'} evidence={expandedParam?.evidence ?? null} />
              </div>
            )}

            {(detail.strengths.length > 0 || detail.improvementAreas.length > 0) && (
              <div className="grid grid-cols-2 gap-3 text-xs">
                {detail.strengths.length > 0 && (
                  <div><p className="font-bold text-green-700 mb-1">Strengths</p>
                    <ul className="list-disc list-inside text-slate-600 space-y-0.5">{detail.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
                {detail.improvementAreas.length > 0 && (
                  <div><p className="font-bold text-amber-700 mb-1">Improvement Areas</p>
                    <ul className="list-disc list-inside text-slate-600 space-y-0.5">{detail.improvementAreas.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {detail.aiSummary && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 italic">{detail.aiSummary}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main dashboard ─────────────────────────────────────────────────────────────────────────
export default function BellavitaComplianceDashboard() {
  const [month, setMonth] = useState(months[0].value);
  const [agentFilter, setAgentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'compliant' | 'non_compliant' | 'critical' | 'review'>('all');
  const [monthly, setMonthly] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<CallListRow[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [callsLoading, setCallsLoading] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [cqDetails, setCqDetails] = useState<BellavitaCQDetails | null>(null);
  const [cqLoading, setCqLoading] = useState(true);

  const { startDate, endDate } = monthToRange(month);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ startDate, endDate });
    if (agentFilter.trim()) params.set('agentId', agentFilter.trim());
    api.get<{ data: MonthlyData }>(`/quality/bellavita-compliance/monthly?${params}`)
      .then(res => setMonthly(res.data.data))
      .catch(() => setMonthly(null))
      .finally(() => setLoading(false));
  }, [startDate, endDate, agentFilter]);

  useEffect(() => {
    setCqLoading(true);
    api.get<{ data: BellavitaCQDetails }>(`/quality/bellavita-cq-score/details?startDate=${startDate}&endDate=${endDate}`)
      .then(res => setCqDetails(res.data.data))
      .catch(() => setCqDetails(null))
      .finally(() => setCqLoading(false));
  }, [startDate, endDate]);

  const fetchCalls = useCallback((cursor?: number) => {
    setCallsLoading(true);
    const params = new URLSearchParams({ startDate, endDate, status: statusFilter, limit: '50' });
    if (agentFilter.trim()) params.set('agentId', agentFilter.trim());
    if (cursor) params.set('cursor', String(cursor));
    api.get<{ data: { rows: CallListRow[]; nextCursor: number | null } }>(`/quality/bellavita-compliance/calls?${params}`)
      .then(res => {
        setCalls(prev => cursor ? [...prev, ...res.data.data.rows] : res.data.data.rows);
        setNextCursor(res.data.data.nextCursor);
      })
      .catch(() => { setCalls([]); setNextCursor(null); })
      .finally(() => setCallsLoading(false));
  }, [startDate, endDate, statusFilter, agentFilter]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  if (loading && !monthly) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  const m = monthly;
  const salesParams = ['UPSELLING', 'CROSS_SELLING', 'OBJECTION_HANDLING', 'OFFER_COMMUNICATION', 'PRODUCT_RECOMMENDATION'];
  const sopCategories = ['OPENING', 'PRODUCT', 'SALES', 'SOFT_SKILLS'];

  return (
    <div className="space-y-5">
      {/* Header + filters */}
      <div className="relative overflow-hidden rounded-2xl px-6 py-5" style={{ background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 100%)` }}>
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ background: '#60A5FA' }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">BellaVita Outbound · AI Compliance &amp; SOP</h1>
              <p className="text-xs text-white/60">Monthly Overview</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input value={agentFilter} onChange={e => setAgentFilter(e.target.value)} placeholder="Filter by Agent ID…"
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-xs text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-white/30 w-40" />
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="rounded-lg border border-white/15 bg-white/10 px-3 py-2 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-white/30 [&>option]:text-slate-900">
              {months.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Live SOP Compliance — real, already-graded per-call data (Opening/Offered/Prepaid Pitch +
          Objection Handling/Upselling/Offer Urgency), independent of whether any external system
          has posted to the ingestion API below. Always shown so the page isn't empty by default. */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <Activity size={13} style={{ color: NAVY }} />
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex-1">Live SOP Compliance (real graded calls)</p>
          <span className="text-[10px] text-slate-400">
            {cqDetails ? `${fmt(cqDetails.totalCalls)} calls in SOP / ${fmt(m?.totalCalls ?? cqDetails.totalCalls)} total calls` : ''}
          </span>
        </div>
        {cqLoading && !cqDetails ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin text-slate-400" size={20} /></div>
        ) : !cqDetails || cqDetails.totalCalls === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No graded calls in this period yet.</div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <LiveParamCard label="Opening" pct={cqDetails.paramPassRate.opening} />
              <LiveParamCard label="Offered" pct={Math.round(((cqDetails.paramPassRate.offered + cqDetails.paramPassRate.offerUrgency) / 2) * 10) / 10} />
              <LiveParamCard label="Prepaid Pitch" pct={cqDetails.paramPassRate.prepaidPitch} highlight />
              <LiveParamCard label="Objection Handling" pct={cqDetails.paramPassRate.objectionHandling} />
              <LiveParamCard label="Upselling Efforts" pct={cqDetails.paramPassRate.upsellingEfforts} />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="text-left px-3 py-1.5 text-slate-400 font-semibold">Agent</th>
                    <th className="text-right px-3 py-1.5 text-slate-400 font-semibold">Calls</th>
                    <th className="text-right px-3 py-1.5 text-slate-400 font-semibold">Opening</th>
                    <th className="text-right px-3 py-1.5 text-slate-400 font-semibold">Offered</th>
                    <th className="text-right px-3 py-1.5 text-slate-400 font-semibold">Prepaid</th>
                    <th className="text-right px-3 py-1.5 text-slate-400 font-semibold">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {cqDetails.byAgent.slice(0, 25).map(a => (
                    <tr key={a.agentId} className="border-t border-slate-50 hover:bg-slate-50/50">
                      <td className="px-3 py-1.5 text-slate-700">{a.agentName}</td>
                      <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">{a.callCount}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: a.opening >= 80 ? GREEN : a.opening >= 60 ? AMBER : RED }}>{a.opening}%</td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: a.offered >= 80 ? GREEN : a.offered >= 60 ? AMBER : RED }}>{a.offered}%</td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: a.prepaidPitch >= 80 ? GREEN : a.prepaidPitch >= 60 ? AMBER : RED }}>{a.prepaidPitch}%</td>
                      <td className="px-3 py-1.5 text-right font-bold tabular-nums" style={{ color: a.overallScore >= 80 ? GREEN : a.overallScore >= 60 ? AMBER : RED }}>{a.overallScore}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Fraud Call Insights — moved here from the standalone "Fraud Call" tab (Bellavita only). */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
          <ShieldAlert size={13} style={{ color: RED }} />
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Fraud Call Insights</p>
        </div>
        <div className="p-4">
          <FraudCallTab clientId="375" sd={startDate} ed={endDate} apiPath="/quality/fraud-calls" />
        </div>
      </div>

      {!m || m.auditedCalls === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 rounded-2xl border border-dashed border-slate-200 bg-white">
          <ShieldCheck size={40} className="mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">No ingested audit data for this period yet</p>
          <p className="text-xs mt-1 max-w-md text-center">
            The sections below read results submitted by an external AI audit system via the ingestion API
            (POST /quality/bellavita-compliance/ingest). Nothing has been submitted for {months.find(x => x.value === month)?.label} yet —
            the Live SOP Compliance and Fraud Call sections above are unaffected since they use already-graded real data.
          </p>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Total Calls" value={fmt(m.totalCalls)} color={SLATE} icon={FileText} sub="in period" />
            <KpiCard label="Audited" value={fmt(m.auditedCalls)} color={NAVY} icon={ShieldCheck} />
            <KpiCard label="Overall Compliance" value={`${m.overallCompliance}%`} color={m.overallCompliance >= 80 ? GREEN : m.overallCompliance >= 60 ? AMBER : RED} icon={TrendingDown} />
            <KpiCard label="Compliant Calls" value={fmt(m.compliantCalls)} color={GREEN} icon={CheckCircle2} />
            <KpiCard label="Non-Compliant" value={fmt(m.nonCompliantCalls)} color={AMBER} icon={AlertTriangle} />
            <KpiCard label="Critical Issues" value={fmt(m.criticalCalls)} color={RED} icon={ShieldAlert} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* SOP Compliance table */}
            <div className="lg:col-span-3 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-[11px] font-bold uppercase tracking-widest text-slate-500">SOP Compliance</div>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-4 py-2 text-slate-400 font-semibold">Parameter</th>
                      <th className="text-right px-4 py-2 text-slate-400 font-semibold">Passed</th>
                      <th className="text-right px-4 py-2 text-slate-400 font-semibold">Compliance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sopCategories.map(cat => (
                      <Fragment key={cat}>
                        <tr className="bg-slate-50/70"><td colSpan={3} className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">{CATEGORY_LABELS[cat]}</td></tr>
                        {m.parameters.filter(p => p.category === cat && !p.critical).map(p => (
                          <tr key={p.code} className="border-b border-slate-50 hover:bg-slate-50/50">
                            <td className="px-4 py-1.5 text-slate-700">{p.name}</td>
                            <td className="px-4 py-1.5 text-right text-slate-500 tabular-nums">{p.passed} / {p.applicableCalls}</td>
                            <td className="px-4 py-1.5 text-right font-bold tabular-nums" style={{ color: p.percentage >= 80 ? GREEN : p.percentage >= 60 ? AMBER : RED }}>
                              {p.applicableCalls > 0 ? `${p.percentage}%` : '—'}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Pitch */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Payment Pitch</p>
              <PaymentDonut cod={m.payment.codPassed} prepaid={m.payment.prepaidPassed} both={m.payment.bothPassed}
                neither={m.payment.neitherCovered} total={m.payment.applicableCalls} />
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div><p className="text-[10px] text-slate-400">COD</p><p className="font-bold text-sm">{m.payment.applicableCalls > 0 ? Math.round(m.payment.codPassed / m.payment.applicableCalls * 100) : 0}%</p></div>
                <div><p className="text-[10px] text-slate-400">Prepaid</p><p className="font-bold text-sm">{m.payment.applicableCalls > 0 ? Math.round(m.payment.prepaidPassed / m.payment.applicableCalls * 100) : 0}%</p></div>
                <div><p className="text-[10px] text-slate-400">Both</p><p className="font-bold text-sm" style={{ color: NAVY }}>{m.payment.applicableCalls > 0 ? Math.round(m.payment.bothPassed / m.payment.applicableCalls * 100) : 0}%</p></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sales Compliance */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Sales Compliance</p>
              {salesParams.map(code => {
                const p = m.parameters.find(x => x.code === code);
                if (!p) return null;
                return <ProgressBar key={code} label={p.name} pct={p.applicableCalls > 0 ? p.percentage : 0}
                  color={p.percentage >= 80 ? GREEN : p.percentage >= 60 ? AMBER : RED} />;
              })}
            </div>

            {/* Critical Compliance */}
            <div className="rounded-2xl border p-4 shadow-sm" style={{ borderColor: `${RED}40`, background: `${RED}06` }}>
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert size={16} style={{ color: RED }} />
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: RED }}>Critical Compliance</p>
              </div>
              <p className="text-2xl font-black" style={{ color: RED }}>{m.critical.totalCases} <span className="text-sm font-semibold">Case{m.critical.totalCases === 1 ? '' : 's'}</span></p>
              <p className="text-xs text-slate-500 mb-3">{m.critical.percentage}% of audited calls</p>
              <div className="space-y-1">
                {m.critical.breakdown.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No critical violations this period.</p>
                ) : m.critical.breakdown.map(b => (
                  <div key={b.code} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{b.name}</span>
                    <span className="font-bold text-red-600">{b.calls}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top areas for improvement */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-3">Top Areas for Improvement</p>
              <ol className="space-y-2">
                {m.topImprovementAreas.map((p, i) => (
                  <li key={p.code} className="flex items-center gap-2 text-xs">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500 font-bold text-[10px] shrink-0">{i + 1}</span>
                    <span className="flex-1 text-slate-700">{p.name}</span>
                    <span className="font-bold" style={{ color: p.percentage >= 60 ? AMBER : RED }}>{p.percentage}%</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Key insights + AI summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-3">
                <Sparkles size={13} style={{ color: NAVY }} />
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Key Insights</p>
              </div>
              <ul className="space-y-1.5 mb-3">
                {m.insights.map((ins, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                    <span className="mt-1 h-1 w-1 rounded-full bg-slate-400 shrink-0" />{ins}
                  </li>
                ))}
              </ul>
              <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 text-[11px] text-slate-500 italic">{m.aiSummary}</div>
            </div>
          </div>

          {/* Calls table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 flex-1">Audited Calls</p>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                className="text-[11px] rounded-md border border-slate-200 px-2 py-1 outline-none">
                <option value="all">All</option>
                <option value="compliant">Compliant</option>
                <option value="non_compliant">Non-Compliant</option>
                <option value="critical">Critical</option>
                <option value="review">Review Required</option>
              </select>
              <button onClick={() => downloadCSV(calls.map(c => ({
                'Call ID': c.callId, Agent: c.agentName ?? c.agentId ?? '', 'Call Date': c.callDate,
                'Audit Status': c.auditStatus, 'Overall Score': c.overallScore ?? '', Critical: c.hasCriticalIssue ? 'Yes' : 'No',
              })), 'bellavita-compliance-calls.csv')}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 transition-colors">
                <Download size={11} /> CSV
              </button>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-white">
                  <th className="text-left px-4 py-2 text-slate-400 font-semibold">Call ID</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-semibold">Agent</th>
                  <th className="text-left px-4 py-2 text-slate-400 font-semibold">Call Date</th>
                  <th className="text-right px-4 py-2 text-slate-400 font-semibold">Score</th>
                  <th className="text-right px-4 py-2 text-slate-400 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {calls.map(c => (
                  <tr key={c.callId} onClick={() => setSelectedCallId(c.callId)}
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-4 py-2 text-slate-700 font-mono">{c.callId}</td>
                    <td className="px-4 py-2 text-slate-600">{c.agentName ?? c.agentId ?? '—'}</td>
                    <td className="px-4 py-2 text-slate-500">{c.callDate}</td>
                    <td className="px-4 py-2 text-right font-bold tabular-nums" style={{ color: (c.overallScore ?? 0) >= 80 ? GREEN : (c.overallScore ?? 0) >= 50 ? AMBER : RED }}>
                      {c.overallScore ?? '—'}%
                    </td>
                    <td className="px-4 py-2 text-right">
                      {c.hasCriticalIssue
                        ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600">CRITICAL</span>
                        : <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{c.auditStatus}</span>}
                    </td>
                  </tr>
                ))}
                {calls.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No calls match this filter.</td></tr>
                )}
              </tbody>
            </table>
            {nextCursor && (
              <div className="p-3 text-center border-t border-slate-100">
                <button onClick={() => fetchCalls(nextCursor)} disabled={callsLoading}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50">
                  {callsLoading ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {selectedCallId && <CallDetailModal callId={selectedCallId} onClose={() => setSelectedCallId(null)} />}
    </div>
  );
}
