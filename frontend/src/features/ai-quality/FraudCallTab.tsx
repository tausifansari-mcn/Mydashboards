import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ShieldAlert, ShieldCheck, FileSearch, UserX, Phone, Play, Square,
  ChevronDown, ChevronRight, Loader2, AlertTriangle, Headphones, FileText,
} from 'lucide-react';
import api from '@/lib/axios';
import CaseActionPicker, { type CaseAction } from './CaseActionPicker';
import ActionableGuide from './ActionableGuide';

const FRAUD_ACTIONABLE_ITEMS = [
  { scenario: 'Customer shared their OTP',                   action: 'Advise the customer to immediately change related passwords/PINs, block the linked transaction if possible, and report to the fraud/compliance team.' },
  { scenario: 'Customer shared personal or bank information', action: 'Advise the customer to monitor their account closely, alert their bank, and flag the account for enhanced monitoring.' },
  { scenario: 'Customer was asked to make a payment/transfer', action: 'Warn the customer not to proceed with any payment, verify legitimacy through official channels, and escalate to the fraud team.' },
  { scenario: 'Caller impersonated the company or a bank official', action: "Verify the caller's identity against company records, escalate to security, and report the impersonating number." },
  { scenario: 'A suspicious link or file was shared',         action: 'Advise the customer not to click or open it, report the link, and escalate to IT security.' },
  { scenario: "Customer's account appears compromised",       action: 'Freeze/secure the account immediately, reset credentials, and escalate to the security team.' },
];

interface FraudCallRow {
  lead_id:        string;
  agent_id:       string;
  mobile_no:      string;
  call_date:      string;
  scenario:       string;
  compliance:     number; // 0 = compliant, 1 = fraud detected
  sentence:       string;
  transcript:     string;
  call_recording: string;
  social_media_info: string;
}

interface FraudAgentRow {
  agent_id:  string;
  client_id: string;
  flagged:   number;
  total:     number;
  risk:      number;
  last_date: string;
}

interface FraudCallSummary {
  total:   number;
  flagged: number;
  clean:   number;
  agents:  FraudAgentRow[];
  rows:    FraudCallRow[];
}

interface AgentMasterRow { masId: string; agentName: string; }

function fmtDT(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function FraudCallTab({ clientId, sd, ed, apiPath = '/inbound-quality/fraud-calls', agentMasterPath = '/inbound-quality/agent-master' }: {
  clientId: string; sd: string; ed: string; apiPath?: string; agentMasterPath?: string;
}) {
  const [data,      setData]      = useState<FraudCallSummary | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [agentMap,  setAgentMap]  = useState<Map<string, string>>(new Map());
  const [openTx,    setOpenTx]    = useState<Set<string>>(new Set());
  const [speaking,  setSpeaking]  = useState<string | null>(null);
  const [actions,   setActions]   = useState<Map<string, CaseAction>>(new Map());

  // Same module the fraud-calls data comes from ('/inbound-quality' or '/quality') — the
  // case-actions endpoint lives alongside it in both.
  const apiBase = apiPath.replace(/\/fraud-calls$/, '');

  useEffect(() => {
    api.get<{ data: AgentMasterRow[] }>(agentMasterPath)
      .then(r => {
        const m = new Map<string, string>();
        (r.data?.data ?? []).forEach(a => m.set(a.masId, a.agentName));
        setAgentMap(m);
      })
      .catch(() => {});
  }, [agentMasterPath]);

  const fetchData = useCallback(() => {
    setLoading(true);
    api.get<{ data: FraudCallSummary }>(
      `${apiPath}?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setData(r.data?.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [clientId, sd, ed, apiPath]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  useEffect(() => {
    api.get<{ data: (CaseAction & { lead_id: string })[] }>(`${apiBase}/case-actions`, { params: { feature: 'fraud_call', clientId } })
      .then((r) => setActions(new Map((r.data?.data ?? []).map((a) => [a.lead_id, a]))))
      .catch(() => {});
  }, [apiBase, clientId]);

  const resolveAgent = (masId: string) => agentMap.get(masId) || masId;

  const toggleTranscript = (key: string) =>
    setOpenTx(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const togglePlay = (key: string, text: string) => {
    if (!window.speechSynthesis) return;
    if (speaking === key) { window.speechSynthesis.cancel(); setSpeaking(null); return; }
    window.speechSynthesis.cancel();
    setSpeaking(key);
    setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'hi-IN';
      utter.rate = 1.35;
      utter.onend = () => setSpeaking(null);
      utter.onerror = () => setSpeaking(null);
      window.speechSynthesis.speak(utter);
    }, 50);
  };

  // Group fraud-flagged calls by agent so each agent gets one beautiful card.
  const groups = useMemo(() => {
    const map = new Map<string, FraudCallRow[]>();
    for (const r of data?.rows ?? []) {
      if (Number(r.compliance) !== 1) continue;
      const arr = map.get(r.agent_id) ?? [];
      arr.push(r);
      map.set(r.agent_id, arr);
    }
    return Array.from(map.entries()).sort(
      (a, b) => b[1].length - a[1].length || (b[1][0].call_date > a[1][0].call_date ? 1 : -1)
    );
  }, [data]);

  const phonesOf = (rows: FraudCallRow[]) =>
    Array.from(new Set(rows.map(r => r.mobile_no).filter(Boolean)));

  const flagged  = data?.flagged ?? 0;
  const total    = data?.total ?? 0;
  const clean    = data?.clean ?? 0;

  return (
    <div className="mt-1 space-y-5">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 rounded-full bg-rose-500" />
        <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Fraud &amp; Data Security Compliance</h3>
        <span className="ml-auto text-[10px] text-slate-400 font-semibold">
          {data ? `${groups.length} agent${groups.length === 1 ? '' : 's'} involved · ${flagged} call${flagged === 1 ? '' : 's'} flagged` : '—'}
        </span>
      </div>

      {/* ─── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Primary card — how many fraud calls detected */}
        <div className="relative rounded-2xl px-4 py-5 overflow-hidden text-white bg-gradient-to-br from-rose-600 via-red-500 to-orange-400 shadow-lg shadow-red-200/60">
          <div className="absolute right-3 top-3">
            <ShieldAlert size={30} className="text-white/30" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/85 mb-1.5">Fraud Calls Detected</p>
          <p className="text-4xl font-black leading-none tabular-nums">{loading ? '—' : flagged}</p>
          <p className="text-[10px] text-white/80 mt-2 font-semibold">compliance = 1 flagged calls</p>
        </div>

        {[
          { label: 'Total Assessed',  value: total,     icon: FileSearch,   color: '#6366F1', tint: '#EEF2FF' },
          { label: 'Agents Involved', value: groups.length, icon: UserX,    color: '#F59E0B', tint: '#FFFBEB' },
          { label: 'Compliant Calls', value: clean,     icon: ShieldCheck,  color: '#22C55E', tint: '#F0FDF4' },
        ].map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label}
              className="relative bg-white rounded-2xl px-4 py-5 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
              style={{ border: `2px solid ${c.color}22` }}>
              <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" style={{ background: c.color }} />
              <Icon size={22} className="absolute right-3 top-3" style={{ color: `${c.color}33` }} />
              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: c.color }}>{c.label}</p>
              <p className="text-3xl font-black text-slate-900 leading-none tabular-nums">{loading ? '—' : c.value}</p>
            </div>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 text-slate-600 text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> Loading fraud call analysis…
        </div>
      )}

      {!loading && (!data || flagged === 0) && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
            <ShieldCheck size={26} className="text-emerald-500" />
          </div>
          <p className="text-sm font-bold text-slate-700">0 Fraud Calls Detected</p>
          <p className="text-[11px] text-slate-400 mt-1">No calls flagged for fraud &amp; data security compliance in this period.</p>
        </div>
      )}

      {!loading && data && flagged > 0 && (
        <div className="space-y-5">
          <ActionableGuide title="Fraud Call — Actionable Guide" items={FRAUD_ACTIONABLE_ITEMS} accent="#DC2626" />

          {/* ─── Agent cards ────────────────────────────────────────────── */}
          {groups.map(([agentId, calls]) => {
            const name = resolveAgent(agentId);
            const phones = phonesOf(calls);
            const initials = (name === agentId ? agentId : name).slice(0, 2).toUpperCase();
            return (
              <div key={agentId}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:border-rose-200 transition-all">
                {/* Agent header */}
                <div className="flex flex-wrap items-center gap-3 px-5 py-4 bg-gradient-to-r from-rose-50 via-white to-rose-50 border-b border-rose-100">
                  <div className="flex items-center justify-center w-11 h-11 rounded-full bg-rose-100 text-rose-600 font-black text-sm shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 truncate leading-tight">{name}</p>
                    <p className="text-[10px] font-mono text-slate-400">MAS ID : {agentId}</p>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                    {phones.map(p => (
                      <span key={p} className="inline-flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                        <Phone size={10} className="text-emerald-600" /> {p}
                      </span>
                    ))}
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500 text-white px-2.5 py-1 text-[10px] font-bold shadow-sm">
                      <ShieldAlert size={10} /> {calls.length} Fraud
                    </span>
                  </div>
                </div>

                {/* Call blocks */}
                <div className="p-4 space-y-3">
                  {calls.map((call, ci) => {
                    const key = `${agentId}-${call.call_date}-${ci}`;
                    const open = openTx.has(key);
                    const hasSentence = call.sentence && call.sentence !== 'None';
                    return (
                      <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
                        {/* Call meta */}
                        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white border-b border-slate-100">
                          <span className="text-[11px] font-bold text-slate-700 font-mono">{fmtDT(call.call_date)}</span>
                          <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 text-red-600 px-2 py-0.5 text-[9px] font-bold">
                            Compliance 1
                          </span>
                          <span className="text-[10px] text-slate-400 truncate">{call.scenario}</span>
                          {call.social_media_info && (
                            <span className="inline-flex items-center rounded-full bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 text-[9px] font-bold truncate max-w-[260px]" title={call.social_media_info}>
                              {call.social_media_info}
                            </span>
                          )}
                          <span className="ml-auto text-[10px] font-mono text-slate-400">{call.mobile_no}</span>
                          {call.lead_id && (
                            <CaseActionPicker
                              apiBase={apiBase} feature="fraud_call" leadId={call.lead_id} clientId={clientId}
                              current={actions.get(call.lead_id)}
                              onSaved={(next) => setActions((prev) => new Map(prev).set(call.lead_id, next))}
                              compact
                            />
                          )}
                        </div>

                        <div className="p-3.5 space-y-3">
                          {/* Fraud detected sentence */}
                          <div className={hasSentence
                            ? 'rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5'
                            : 'rounded-lg border border-slate-200 bg-white px-3.5 py-2.5'}>
                            <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest mb-1 text-rose-600">
                              <AlertTriangle size={11} /> Fraud Detected Sentence
                            </p>
                            {hasSentence
                              ? <p className="text-[12px] text-rose-900 font-medium leading-relaxed whitespace-pre-wrap">{call.sentence}</p>
                              : <p className="text-[11px] text-slate-400 italic">None</p>}
                          </div>

                          {/* Call recording */}
                          <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
                            <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest mb-1.5 text-slate-500">
                              <Headphones size={11} /> Call Recording
                            </p>
                            {call.call_recording
                              ? <audio controls preload="metadata" src={call.call_recording} style={{ width: '100%', height: 32 }} />
                              : <p className="text-[11px] text-slate-400 italic">No recording available for this call.</p>}
                          </div>

                          {/* Transcript */}
                          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                            <button onClick={() => toggleTranscript(key)}
                              className="w-full flex items-center gap-1.5 px-3.5 py-2 text-left hover:bg-slate-50 transition-colors">
                              <FileText size={11} className="text-slate-500" />
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Call Transcript</span>
                              {open
                                ? <ChevronDown size={12} className="ml-auto text-slate-400" />
                                : <ChevronRight size={12} className="ml-auto text-slate-400" />}
                            </button>
                            {open && (
                              <div className="border-t border-slate-100 px-3.5 py-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-[10px] text-slate-400">{call.transcript ? 'AI-transcribed call conversation' : 'No transcript'}</span>
                                  {call.transcript && (
                                    <button onClick={() => togglePlay(key, call.transcript)}
                                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                                        speaking === key
                                          ? 'text-red-600 border-red-200 bg-red-50'
                                          : 'text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                                      }`}>
                                      {speaking === key ? <Square size={10} /> : <Play size={10} />}
                                      {speaking === key ? 'Stop' : 'Listen'}
                                    </button>
                                  )}
                                </div>
                                {call.transcript
                                  ? <p className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-wrap max-h-56 overflow-auto">{call.transcript}</p>
                                  : <p className="text-[11px] text-slate-400 italic">No transcript available for this call.</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
