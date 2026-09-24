import { useState } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, AlertOctagon, Info, ChevronDown, Download,
  Sparkles, MessageSquareText, Smile, Meh, Frown, ShoppingBag, GraduationCap, Copy, Check,
} from 'lucide-react';
import type { CallAuditRecord } from './types';

const VERDICT_STYLE: Record<string, { bg: string; text: string; ring: string }> = {
  Excellent: { bg: '#DCFCE7', text: '#15803D', ring: '#22C55E' },
  Good: { bg: '#DBEAFE', text: '#1D4ED8', ring: '#3B82F6' },
  'Needs Improvement': { bg: '#FEF3C7', text: '#B45309', ring: '#F59E0B' },
  Poor: { bg: '#FEE2E2', text: '#B91C1C', ring: '#EF4444' },
};
function verdictStyle(verdict: string, score: number) {
  if (VERDICT_STYLE[verdict]) return VERDICT_STYLE[verdict];
  // Defensive fallback if the model ever returns a verdict string outside the 4 expected ones —
  // derive from the score instead of rendering an unstyled/blank badge.
  if (score >= 85) return VERDICT_STYLE.Excellent;
  if (score >= 65) return VERDICT_STYLE.Good;
  if (score >= 45) return VERDICT_STYLE['Needs Improvement'];
  return VERDICT_STYLE.Poor;
}

const SEVERITY_STYLE: Record<string, { bg: string; text: string; icon: typeof AlertOctagon }> = {
  critical: { bg: '#FEE2E2', text: '#B91C1C', icon: AlertOctagon },
  major: { bg: '#FEF3C7', text: '#B45309', icon: AlertTriangle },
  minor: { bg: '#F1F5F9', text: '#475569', icon: Info },
};

const SENTIMENT_STYLE: Record<string, { bg: string; text: string; icon: typeof Smile }> = {
  Positive: { bg: '#DCFCE7', text: '#15803D', icon: Smile },
  Neutral: { bg: '#F1F5F9', text: '#475569', icon: Meh },
  Negative: { bg: '#FEE2E2', text: '#B91C1C', icon: Frown },
  Mixed: { bg: '#FEF3C7', text: '#B45309', icon: Meh },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="no-print flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 transition-colors"
    >
      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />} {copied ? 'Copied' : 'Copy transcript'}
    </button>
  );
}

export function AuditReport({ record, onNewAudit }: { record: CallAuditRecord; onNewAudit: () => void }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const { result } = record;
  const vs = verdictStyle(result.verdict, result.overallScore);
  const sentiment = SENTIMENT_STYLE[result.customerSentiment] ?? SENTIMENT_STYLE.Neutral;
  const SentimentIcon = sentiment.icon;

  return (
    <div className="print-area">
      {/* ── Header: score ring + meta ── */}
      <div className="rounded-[24px] overflow-hidden mb-5 border border-white/60 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.12)]">
        <div className="px-6 py-4 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #1565C0, #0D47A1)' }}>
          <Sparkles size={15} className="text-white/90" />
          <h2 className="text-xs font-black text-white uppercase tracking-widest">Call Audit Report</h2>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => window.print()} className="no-print flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold text-white/90 hover:text-white border border-white/30 hover:border-white/60 transition-colors">
              <Download size={11} /> Download PDF
            </button>
            <button onClick={onNewAudit} className="no-print px-2.5 py-1 rounded-md text-[10px] font-bold text-white/90 hover:text-white border border-white/30 hover:border-white/60 transition-colors">
              New Audit
            </button>
          </div>
        </div>
        <div className="p-6 bg-white flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          <div className="shrink-0 flex flex-col items-center">
            <div className="relative flex items-center justify-center rounded-full" style={{ width: 108, height: 108, background: `conic-gradient(${vs.ring} ${result.overallScore * 3.6}deg, #E2E8F0 0deg)` }}>
              <div className="absolute rounded-full bg-white flex flex-col items-center justify-center" style={{ width: 88, height: 88 }}>
                <p className="text-2xl font-black tabular-nums text-slate-900 leading-none">{result.overallScore}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">/ 100</p>
              </div>
            </div>
            <span className="mt-2.5 px-3 py-1 rounded-full text-[11px] font-black" style={{ background: vs.bg, color: vs.text }}>{result.verdict}</span>
          </div>
          <div className="flex-1 min-w-0 w-full">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Process', value: record.processName },
                { label: 'LOB', value: record.lob },
                { label: 'Agent', value: record.agentName },
                { label: 'MAS ID', value: record.masId },
              ].map(f => (
                <div key={f.label} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{f.label}</p>
                  <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{f.value || '—'}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: sentiment.bg, color: sentiment.text }}>
                <SentimentIcon size={12} /> Customer: {result.customerSentiment}
              </span>
              {result.saleOutcome && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700">
                  <ShoppingBag size={12} /> {result.saleOutcome}
                </span>
              )}
              <span className="text-[10px] text-slate-400 ml-auto">
                Audited {new Date(record.createdAt).toLocaleString()} · {record.model}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Strengths / Issues ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-emerald-700 mb-3 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Strengths
          </h3>
          {result.strengths.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No notable strengths identified.</p>
          ) : (
            <ul className="space-y-2">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                  <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-3 flex items-center gap-1.5">
            <AlertTriangle size={14} /> Issues Found
          </h3>
          {result.issues.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No issues identified.</p>
          ) : (
            <div className="space-y-2.5">
              {result.issues.map((iss, i) => {
                const st = SEVERITY_STYLE[iss.severity] ?? SEVERITY_STYLE.minor;
                const Icon = st.icon;
                return (
                  <div key={i} className="rounded-xl px-3.5 py-2.5" style={{ background: st.bg }}>
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} style={{ color: st.text }} />
                      <p className="text-xs font-bold" style={{ color: st.text }}>{iss.title}</p>
                      <span className="ml-auto text-[9px] font-black uppercase tracking-wider" style={{ color: st.text }}>{iss.severity}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 mt-1 leading-relaxed">{iss.description}</p>
                    {iss.quote && <p className="text-[11px] text-slate-500 italic mt-1.5 border-l-2 pl-2" style={{ borderColor: st.text }}>&ldquo;{iss.quote}&rdquo;</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Compliance checklist ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 mb-5">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-3 flex items-center gap-1.5">
          <CheckCircle2 size={14} /> Compliance Checklist
        </h3>
        {result.complianceChecklist.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No checklist items evaluated.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {result.complianceChecklist.map((c, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2">
                {c.passed
                  ? <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                  : <XCircle size={15} className="text-red-500 mt-0.5 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800">{c.item}</p>
                  {c.note && <p className="text-[11px] text-slate-500 mt-0.5">{c.note}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Coaching recommendations ── */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 mb-5">
        <h3 className="text-xs font-black uppercase tracking-widest text-indigo-700 mb-3 flex items-center gap-1.5">
          <GraduationCap size={14} /> Coaching Recommendations
        </h3>
        {result.coachingRecommendations.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No specific coaching points.</p>
        ) : (
          <ol className="space-y-2 list-decimal list-inside">
            {result.coachingRecommendations.map((c, i) => (
              <li key={i} className="text-xs text-slate-700 leading-relaxed">{c}</li>
            ))}
          </ol>
        )}
      </div>

      {/* ── Transcript ── */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button onClick={() => setShowTranscript(v => !v)} className="w-full flex items-center gap-2 px-5 py-3.5">
          <MessageSquareText size={14} className="text-slate-500" />
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">Full Call Transcript</h3>
          <div className="ml-auto flex items-center gap-2">
            {showTranscript && <CopyButton text={record.transcript} />}
            <ChevronDown size={14} className="text-slate-400 transition-transform duration-300" style={{ transform: showTranscript ? 'rotate(180deg)' : 'none' }} />
          </div>
        </button>
        {showTranscript && (
          <div className="px-5 pb-5">
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 max-h-[420px] overflow-y-auto">
              <p className="text-[12.5px] text-slate-700 leading-relaxed whitespace-pre-wrap">{record.transcript}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
