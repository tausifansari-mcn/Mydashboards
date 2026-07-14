import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Legend,
} from 'recharts';
import api from '@/lib/axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClapQaParam { param: string; label: string; category: string; passRate: number; }
interface ClapScenWithSubs {
  scenario: string; count: number;
  subs: { sub: string; count: number }[];
}
interface ClapIntelligenceResult {
  executive: {
    totalCalls: number; avgQA: number; positivePct: number; negativePct: number;
    processHealthScore: number;
    clapBreakdown: { clap: string; count: number; pct: number }[];
  };
  qaParams: ClapQaParam[];
  customer: {
    total: number;
    scenarios: { scenario: string; count: number; pct: number }[];
    posWords: string[]; negWords: string[];
  };
  logistics: { total: number; scenarios: ClapScenWithSubs[] };
  agent: {
    total: number;
    topAgents: { agent: string; calls: number; avgScore: number }[];
    bottomAgents: { agent: string; calls: number; avgScore: number }[];
    posWords: string[]; negWords: string[];
  };
  product: {
    total: number;
    scenarios: ClapScenWithSubs[];
    products: {
      name: string;
      count: number;
      pct: number;
      scenarioBreakdown: ClapScenWithSubs[];
    }[];
  };
  trend: { date: string; calls: number; avgQA: number; posCount: number; negCount: number }[];
  repeatCalls: { repeatCallers: number; totalCallers: number; repeatCallCount: number };
  agentClapBreakdown: {
    byRule: { rule: string; count: number }[];
    calls: { leadId: string; date: string; agentName: string; scenario: string; scenario1: string; score: number; rule: string }[];
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CLAP_META: Record<string, { color: string; bg: string; border: string; text: string; icon: string }> = {
  Customer: { color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', icon: '👤' },
  Logistic: { color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', icon: '🚚' },
  Agent:    { color: '#E11D48', bg: '#FFF1F2', border: '#FECDD3', text: '#BE123C', icon: '🎧' },
  Product:  { color: '#10B981', bg: '#ECFDF5', border: '#A7F3D0', text: '#047857', icon: '📦' },
};

const CAT_COLOR: Record<string, string> = {
  'Opening Skill': '#0EA5E9',
  'Soft Skill':    '#8B5CF6',
  'Hold Procedure':'#F59E0B',
  'Resolution':    '#14B8A6',
  'Closing':       '#EC4899',
};

const passColor = (v: number) => v >= 85 ? '#10B981' : v >= 70 ? '#F59E0B' : '#EF4444';
const passText  = (v: number) => v >= 85 ? 'text-emerald-700' : v >= 70 ? 'text-amber-700' : 'text-red-600';
const passBg    = (v: number) => v >= 85 ? '#D1FAE5' : v >= 70 ? '#FEF3C7' : '#FEE2E2';

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ value, label, sub, color }: { value: string; label: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-3 flex flex-col gap-0.5">
      <span className="text-2xl font-extrabold tracking-tight" style={{ color: color ?? '#0F172A' }}>{value}</span>
      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
      {sub && <span className="text-[10px] text-slate-400">{sub}</span>}
    </div>
  );
}

function SectionHeader({ icon, title, color }: { icon: string; title: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: color ?? '#0369A1' }}>{title}</h3>
    </div>
  );
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#E2E8F0' }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function WordCloud({ words, positive }: { words: string[]; positive: boolean }) {
  if (!words.length) return <span className="text-xs text-slate-400 italic">No data</span>;
  const color = positive ? '#10B981' : '#EF4444';
  const bg    = positive ? '#D1FAE5' : '#FEE2E2';
  return (
    <div className="flex flex-wrap gap-1.5">
      {words.slice(0, 12).map((w, i) => (
        <span key={i}
          className="px-2 py-0.5 rounded-full font-medium"
          style={{
            fontSize: `${Math.max(9, 12 - i * 0.4)}px`,
            background: bg,
            color,
            opacity: Math.max(0.55, 1 - i * 0.04),
          }}>
          {w}
        </span>
      ))}
    </div>
  );
}

function ScenarioTree({ scenarios, color }: { scenarios: ClapScenWithSubs[]; color: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const maxCount = scenarios[0]?.count ?? 1;
  return (
    <div className="space-y-1.5">
      {scenarios.slice(0, 8).map(sc => (
        <div key={sc.scenario}>
          <button
            className="w-full text-left group"
            onClick={() => setExpanded(expanded === sc.scenario ? null : sc.scenario)}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[11px] font-semibold text-slate-700 truncate flex-1">{sc.scenario}</span>
              <span className="text-[10px] font-bold shrink-0" style={{ color }}>{sc.count}</span>
              {sc.subs.length > 0 && (
                <span className="text-[9px] text-slate-400">{expanded === sc.scenario ? '▲' : '▼'}</span>
              )}
            </div>
            <MiniBar value={sc.count} max={maxCount} color={color} />
          </button>
          {expanded === sc.scenario && sc.subs.length > 0 && (
            <div className="ml-3 mt-1 space-y-1 border-l-2 pl-2" style={{ borderColor: color + '44' }}>
              {sc.subs.slice(0, 6).map(sub => (
                <div key={sub.sub} className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 flex-1 truncate">{sub.sub}</span>
                  <span className="text-[10px] font-semibold" style={{ color }}>{sub.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  clientId?: string;
  startDate: string;
  endDate: string;
}

export default function Clap360Intelligence({ clientId, startDate, endDate }: Props) {
  const [data, setData] = useState<ClapIntelligenceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qaSort, setQaSort] = useState<'category' | 'rate'>('rate');
  const [expandedClap, setExpandedClap] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const sd = startDate.replace('T', ' ').replace('T', ' ');
    const ed = endDate.replace('T', ' ').replace('T', ' ');
    const clientParam = clientId ? `&clientId=${encodeURIComponent(clientId)}` : '';
    api.get<{ data: ClapIntelligenceResult }>(
      `/inbound-quality/clap-intelligence?startDate=${encodeURIComponent(sd)}&endDate=${encodeURIComponent(ed)}${clientParam}`
    )
      .then(r => { setData(r.data.data); setLoading(false); })
      .catch(e => { setError(e.message ?? 'Failed to load'); setLoading(false); });
  }, [clientId, startDate, endDate]);

  // Radar data — group QA params by category
  const radarData = useMemo(() => {
    if (!data) return [];
    const cats: Record<string, number[]> = {};
    for (const p of data.qaParams) {
      if (!cats[p.category]) cats[p.category] = [];
      cats[p.category].push(p.passRate);
    }
    return Object.entries(cats).map(([cat, vals]) => ({
      category: cat,
      score: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
    }));
  }, [data]);

  const sortedQaParams = useMemo(() => {
    if (!data) return [];
    const p = [...data.qaParams];
    return qaSort === 'rate' ? p.sort((a, b) => a.passRate - b.passRate) : p.sort((a, b) => a.category.localeCompare(b.category) || a.passRate - b.passRate);
  }, [data, qaSort]);

  const trendData = useMemo(() => {
    if (!data) return [];
    return data.trend.map(d => ({
      ...d,
      label: d.date.slice(5), // MM-DD
      sentimentScore: d.calls > 0 ? Math.round((d.posCount - d.negCount) / d.calls * 100) : 0,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm gap-2">
        <span className="animate-spin text-lg">⏳</span> Loading CLAP 360° Intelligence…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 text-sm">
        {error ?? 'No data available'}
      </div>
    );
  }

  const { executive, customer, logistics, agent, product, qaParams, trend, repeatCalls } = data;
  const repeatPct = repeatCalls.totalCallers > 0
    ? Math.round(repeatCalls.repeatCallers / repeatCalls.totalCallers * 1000) / 10
    : 0;

  return (
    <div className="flex flex-col gap-5">

      {/* ── Hero KPI Row ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-sky-200 shadow-sm">
        <div className="card-header px-5 py-3 flex items-center gap-2">
          <span className="text-base">🧠</span>
          <h2 className="text-xs font-bold text-white uppercase tracking-widest">CLAP 360° Process Intelligence</h2>
          <span className="ml-auto text-[10px] text-sky-200 font-medium">Customer · Logistic · Agent · Product</span>
        </div>
        <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" style={{ background: '#F0F9FF' }}>
          <KpiCard value={executive.totalCalls.toLocaleString()} label="Total Audits" />
          <KpiCard value={`${executive.avgQA}%`} label="Avg QA Score"
            color={executive.avgQA >= 90 ? '#10B981' : executive.avgQA >= 80 ? '#F59E0B' : '#EF4444'} />
          <KpiCard value={`${executive.processHealthScore}%`} label="Process Health"
            sub="Composite of all 20 QA params"
            color={executive.processHealthScore >= 85 ? '#10B981' : executive.processHealthScore >= 70 ? '#F59E0B' : '#EF4444'} />
          <KpiCard value={`${executive.positivePct}%`} label="Positive Sentiment" color="#10B981" />
          <KpiCard value={`${executive.negativePct}%`} label="Negative Sentiment" color="#EF4444" />
          <KpiCard value={`${repeatPct}%`} label="Repeat Callers"
            sub={`${repeatCalls.repeatCallers} of ${repeatCalls.totalCallers}`}
            color={repeatPct > 20 ? '#EF4444' : repeatPct > 10 ? '#F59E0B' : '#10B981'} />
        </div>
      </div>

      {/* ── CLAP Distribution ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {executive.clapBreakdown.map(c => {
          const meta = CLAP_META[c.clap] ?? { color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', text: '#475569', icon: '📋' };
          const isActive = expandedClap === c.clap;
          const canExpand = c.clap === 'Agent' || c.clap === 'Logistic';
          return (
            <div key={c.clap}
              className="rounded-xl border px-4 py-3 flex flex-col gap-1 transition-all"
              style={{
                background: meta.bg,
                borderColor: isActive ? meta.color : meta.border,
                boxShadow: isActive ? `0 0 0 2px ${meta.color}33` : undefined,
                cursor: canExpand ? 'pointer' : 'default',
              }}
              onClick={() => canExpand && setExpandedClap(isActive ? null : c.clap)}>
              <div className="flex items-center gap-1.5">
                <span className="text-lg">{meta.icon}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: meta.text }}>{c.clap}</span>
                {canExpand && (
                  <span className="ml-auto text-[9px] font-semibold" style={{ color: meta.color }}>
                    {isActive ? '▲ close' : '▼ analyse'}
                  </span>
                )}
              </div>
              <span className="text-xl font-extrabold" style={{ color: meta.color }}>{c.count.toLocaleString()}</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full" style={{ background: meta.border }}>
                  <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: meta.color }} />
                </div>
                <span className="text-[10px] font-bold" style={{ color: meta.color }}>{c.pct}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CLAP Expanded Analysis Panel ────────────────────────────────────── */}
      {expandedClap && (() => {
        const RULE_META: Record<string, { color: string; bg: string; icon: string; desc: string }> = {
          'Explicit Agent Scenario':          { color: '#059669', bg: '#D1FAE5', icon: '✅', desc: 'Scenario directly tagged as an agent-quality issue by the auditor' },
          'Fraud Complaint':                  { color: '#D97706', bg: '#FEF3C7', icon: '⚠️', desc: 'Complaint call where sub-scenario contains "Fraud"' },
          'Catch-all (Unrecognized Scenario)': { color: '#DC2626', bg: '#FEE2E2', icon: '❗', desc: 'Scenario value not in any known CLAP list — fell to the ELSE clause' },
        };

        if (expandedClap === 'Agent') {
          const bd = data!.agentClapBreakdown;
          return (
            <div className="rounded-2xl border border-rose-200 overflow-hidden shadow-sm">
              <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#BE123C,#E11D48)' }}>
                <span>🎧</span>
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Agent CLAP · How These {bd.calls.length} Calls Were Classified</h3>
                <button className="ml-auto text-white/60 hover:text-white text-lg leading-none" onClick={() => setExpandedClap(null)}>×</button>
              </div>
              <div className="p-4 space-y-4" style={{ background: '#FFF1F2' }}>

                {/* Rule summary */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Classification Rules Triggered</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {bd.byRule.map(r => {
                      const m = RULE_META[r.rule] ?? { color: '#64748B', bg: '#F1F5F9', icon: '📋', desc: '' };
                      return (
                        <div key={r.rule} className="rounded-xl border p-3" style={{ background: m.bg, borderColor: m.color + '44' }}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-sm">{m.icon}</span>
                            <span className="text-[11px] font-bold" style={{ color: m.color }}>{r.rule}</span>
                            <span className="ml-auto text-lg font-extrabold" style={{ color: m.color }}>{r.count}</span>
                          </div>
                          <p className="text-[9px] text-slate-500 leading-snug">{m.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Call table */}
                {bd.calls.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">All Agent-CLAP Calls</p>
                    <div className="rounded-xl overflow-hidden border border-rose-100 bg-white">
                      <div className="overflow-x-auto max-h-72">
                        <table className="w-full text-xs border-collapse">
                          <thead className="sticky top-0 bg-rose-50">
                            <tr>
                              {['#','Date','Agent','Scenario','Sub-Scenario','Score','Classification Rule'].map(h => (
                                <th key={h} className="px-3 py-2 text-left text-[10px] font-bold text-rose-700 whitespace-nowrap border-b border-rose-100">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {bd.calls.map((c, i) => {
                              const m = RULE_META[c.rule] ?? { color: '#64748B', bg: '#F1F5F9', icon: '📋', desc: '' };
                              return (
                                <tr key={c.leadId + i} className="border-t border-slate-50 hover:bg-rose-50 transition-colors">
                                  <td className="px-3 py-2 text-slate-400 font-mono">{i + 1}</td>
                                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{c.date}</td>
                                  <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{c.agentName}</td>
                                  <td className="px-3 py-2">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{c.scenario}</span>
                                  </td>
                                  <td className="px-3 py-2 text-slate-500">{c.scenario1 === '—' ? '' : c.scenario1}</td>
                                  <td className="px-3 py-2 font-bold text-right whitespace-nowrap"
                                    style={{ color: c.score >= 90 ? '#10B981' : c.score >= 80 ? '#F59E0B' : '#EF4444' }}>
                                    {c.score}%
                                  </td>
                                  <td className="px-3 py-2">
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap"
                                      style={{ background: m.bg, color: m.color }}>
                                      {m.icon} {c.rule}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Insight box */}
                <div className="rounded-xl bg-white border border-rose-100 px-4 py-3">
                  <p className="text-[10px] font-bold text-rose-700 mb-1">💡 How to read this</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Agent CLAP count is <strong>not</strong> the number of agents — it's the number of calls where the <em>issue itself</em> was agent-behaviour related.
                    If you see <strong>Catch-all</strong> entries, those scenario values are not in the CLAP mapping and need to be added to the classification rules.
                  </p>
                </div>
              </div>
            </div>
          );
        }

        if (expandedClap === 'Logistic') {
          const meta = CLAP_META['Logistic'];
          return (
            <div className="rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: meta.border }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#B45309,#F59E0B)' }}>
                <span>🚚</span>
                <h3 className="text-xs font-bold text-white uppercase tracking-widest">Logistic CLAP · {logistics.total} Calls · Full Breakdown</h3>
                <button className="ml-auto text-white/60 hover:text-white text-lg leading-none" onClick={() => setExpandedClap(null)}>×</button>
              </div>
              <div className="p-4" style={{ background: '#FFFBEB' }}>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">
                  These calls are classified as Logistic because their <code className="bg-amber-100 px-1 rounded">scenario</code> matches:
                  Delivery Issue · Post Order · Order Status · Reverse Pickup Issue · Pending/Payment issues · Wallet issue
                  · OR Complaint where sub-scenario is Dispatch / Delivery / RTO / Courier related
                </p>
                {logistics.scenarios.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No logistics calls in this period</p>
                ) : (
                  <div className="bg-white rounded-xl border border-amber-100 p-3">
                    <ScenarioTree scenarios={logistics.scenarios} color="#F59E0B" />
                  </div>
                )}
              </div>
            </div>
          );
        }

        return null;
      })()}

      {/* ── C · L · P Intelligence Grid ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Customer */}
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-4">
          <SectionHeader icon="👤" title={`Customer Intelligence · ${customer.total} calls`} color="#1D4ED8" />
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Top Contact Reasons</p>
              <div className="space-y-1.5">
                {customer.scenarios.slice(0, 8).map(sc => (
                  <div key={sc.scenario}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] text-slate-600 flex-1 truncate">{sc.scenario}</span>
                      <span className="text-[10px] font-bold text-blue-700">{sc.count}</span>
                      <span className="text-[9px] text-slate-400">{sc.pct}%</span>
                    </div>
                    <MiniBar value={sc.count} max={customer.scenarios[0]?.count ?? 1} color="#3B82F6" />
                  </div>
                ))}
              </div>
            </div>
            {customer.posWords.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1.5">✅ Positive Signals</p>
                <WordCloud words={customer.posWords} positive={true} />
              </div>
            )}
            {customer.negWords.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1.5">⚠️ Negative Signals</p>
                <WordCloud words={customer.negWords} positive={false} />
              </div>
            )}
          </div>
        </div>

        {/* Logistics */}
        <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-4">
          <SectionHeader icon="🚚" title={`Logistics Intelligence · ${logistics.total} calls`} color="#B45309" />
          {logistics.scenarios.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No logistics calls in this period</p>
          ) : (
            <ScenarioTree scenarios={logistics.scenarios} color="#F59E0B" />
          )}
          {logistics.scenarios.length > 0 && (
            <p className="text-[9px] text-slate-400 mt-3 italic">▼ Click a scenario to see sub-categories</p>
          )}
        </div>

        {/* Product */}
        <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-4">
          <SectionHeader icon="📦" title={`Product Intelligence · ${product.total} calls`} color="#047857" />
          {product.total === 0 ? (
            <p className="text-xs text-slate-400 italic">No product calls in this period</p>
          ) : (
            <div className="space-y-4">
              {/* Product names from transcript — clickable to expand scenario tree */}
              {product.products.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Products Mentioned <span className="text-slate-300 font-normal normal-case">· click to see why</span></p>
                  <div className="space-y-1">
                    {product.products.map(prod => {
                      const isOpen = expandedClap === `prod:${prod.name}`;
                      return (
                        <div key={prod.name} className="rounded-lg overflow-hidden border border-transparent transition-all"
                          style={{ borderColor: isOpen ? '#A7F3D0' : 'transparent' }}>
                          {/* Row */}
                          <button
                            className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors group"
                            onClick={() => setExpandedClap(isOpen ? null : `prod:${prod.name}`)}
                          >
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[11px] font-semibold text-slate-700 flex-1 truncate">{prod.name}</span>
                              <span className="text-[10px] font-bold text-emerald-700">{prod.count}</span>
                              <span className="text-[9px] text-slate-400">{prod.pct}%</span>
                              <span className="text-[9px] text-emerald-500 font-bold">{isOpen ? '▲' : '▼'}</span>
                            </div>
                            <MiniBar value={prod.count} max={product.products[0]?.count ?? 1} color="#10B981" />
                          </button>
                          {/* Expanded scenario breakdown */}
                          {isOpen && prod.scenarioBreakdown.length > 0 && (
                            <div className="mx-2 mb-2 rounded-lg border border-emerald-100 overflow-hidden bg-emerald-50">
                              <div className="px-3 py-1.5 border-b border-emerald-100 bg-emerald-100/50">
                                <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">Why customers called about {prod.name}</p>
                              </div>
                              <div className="p-2 space-y-1">
                                {prod.scenarioBreakdown.map(sc => (
                                  <div key={sc.scenario}>
                                    <div className="flex items-center gap-2 py-0.5">
                                      <span className="text-[10px] font-semibold text-slate-700 flex-1">{sc.scenario}</span>
                                      <span className="text-[10px] font-bold text-emerald-700 shrink-0">{sc.count}</span>
                                    </div>
                                    {sc.subs.length > 0 && (
                                      <div className="ml-2 pl-2 border-l-2 border-emerald-200 space-y-0.5 mb-1">
                                        {sc.subs.map(sub => (
                                          <div key={sub.sub} className="flex items-center gap-2">
                                            <span className="text-[10px] text-slate-500 flex-1">{sub.sub}</span>
                                            <span className="text-[9px] font-semibold text-emerald-600">{sub.count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {product.products.length > 0 && product.scenarios.length > 0 && (
                    <div className="my-3 border-t border-slate-100" />
                  )}
                </div>
              )}
              {/* Scenario breakdown */}
              {product.scenarios.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Issue Type Breakdown</p>
                  <ScenarioTree scenarios={product.scenarios} color="#10B981" />
                  <p className="text-[9px] text-slate-400 mt-2 italic">▼ Click a scenario to see sub-categories</p>
                </div>
              )}
              {/* Note when no products matched but calls exist */}
              {product.products.length === 0 && (
                <p className="text-[10px] text-slate-400 italic">No product names detected in transcripts — issue breakdown shown above</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Agent Intelligence ───────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-rose-100 shadow-sm">
        <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#BE123C,#E11D48)' }}>
          <span className="text-base">🎧</span>
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Agent Intelligence · {agent.total} CLAP calls</h3>
        </div>
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ background: '#FFF1F2' }}>

          {/* Top / Bottom agents */}
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-2">🏆 Top Performers</p>
              <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                {agent.topAgents.length === 0 ? (
                  <p className="p-3 text-xs text-slate-400 italic">Need ≥2 audits per agent</p>
                ) : (
                  agent.topAgents.map((a, i) => (
                    <div key={a.agent} className="flex items-center gap-3 px-3 py-2 border-b border-slate-50 last:border-0">
                      <span className="text-[10px] font-bold w-4 text-slate-400">{i + 1}</span>
                      <span className="flex-1 text-[11px] font-semibold text-slate-700 truncate">{a.agent}</span>
                      <span className="text-[10px] text-slate-400">{a.calls} calls</span>
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full"
                        style={{ background: passBg(a.avgScore), color: passColor(a.avgScore) }}>
                        {a.avgScore}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-2">📉 Need Coaching</p>
              <div className="bg-white rounded-xl border border-red-100 overflow-hidden">
                {agent.bottomAgents.length === 0 ? (
                  <p className="p-3 text-xs text-slate-400 italic">Need ≥2 audits per agent</p>
                ) : (
                  agent.bottomAgents.map((a, i) => (
                    <div key={a.agent} className="flex items-center gap-3 px-3 py-2 border-b border-slate-50 last:border-0">
                      <span className="text-[10px] font-bold w-4 text-slate-400">{i + 1}</span>
                      <span className="flex-1 text-[11px] font-semibold text-slate-700 truncate">{a.agent}</span>
                      <span className="text-[10px] text-slate-400">{a.calls} calls</span>
                      <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full"
                        style={{ background: passBg(a.avgScore), color: passColor(a.avgScore) }}>
                        {a.avgScore}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Agent phrase clouds */}
          <div className="space-y-4">
            {agent.posWords.length > 0 && (
              <div className="bg-white rounded-xl border border-emerald-100 p-3">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-2">✅ Positive Agent Phrases</p>
                <WordCloud words={agent.posWords} positive={true} />
              </div>
            )}
            {agent.negWords.length > 0 && (
              <div className="bg-white rounded-xl border border-red-100 p-3">
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-2">⚠️ Negative Agent Phrases</p>
                <WordCloud words={agent.negWords} positive={false} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── QA Parameters Compliance ─────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden border border-purple-100 shadow-sm">
        <div className="px-5 py-3 flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#6D28D9,#8B5CF6)' }}>
          <span className="text-base">✅</span>
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">QA Parameter Compliance</h3>
          <div className="ml-auto flex gap-2">
            <button
              className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold transition-all"
              style={{ background: qaSort === 'rate' ? 'rgba(255,255,255,0.25)' : 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
              onClick={() => setQaSort('rate')}>
              By Score
            </button>
            <button
              className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold transition-all"
              style={{ background: qaSort === 'category' ? 'rgba(255,255,255,0.25)' : 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }}
              onClick={() => setQaSort('category')}>
              By Category
            </button>
          </div>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2" style={{ background: '#FAF5FF' }}>
          {sortedQaParams.map(p => (
            <div key={p.param} className="bg-white rounded-lg border border-slate-100 px-3 py-2 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[9px] font-bold px-1.5 py-0 rounded"
                    style={{ background: (CAT_COLOR[p.category] ?? '#94A3B8') + '22', color: CAT_COLOR[p.category] ?? '#64748B' }}>
                    {p.category}
                  </span>
                  <span className="text-[11px] font-medium text-slate-700 truncate">{p.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${p.passRate}%`, background: passColor(p.passRate) }} />
                  </div>
                </div>
              </div>
              <span className={`text-[12px] font-extrabold shrink-0 ${passText(p.passRate)}`}>{p.passRate}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quality Trend + Process Health ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Trend Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <SectionHeader icon="📈" title="Daily Quality Trend" color="#0369A1" />
          {trendData.length < 2 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-xs italic">
              Not enough data points for trend
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={trendData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E2E8F0' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [name === 'QA Score' ? `${v}%` : v, name]}
                />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                <Bar yAxisId="right" dataKey="calls" name="Calls" fill="#BFDBFE" radius={[3, 3, 0, 0]} />
                <Line yAxisId="left" type="monotone" dataKey="avgQA" name="QA Score" stroke="#0369A1" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Process Health Radar (1 col) */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <SectionHeader icon="🎯" title="Process Health by Category" color="#0369A1" />
          {radarData.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-400 text-xs italic">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} margin={{ top: 0, right: 16, bottom: 0, left: 16 }}>
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 9, fill: '#64748B' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8, fill: '#94A3B8' }} tickCount={4} />
                <Radar name="Pass Rate" dataKey="score" stroke="#0369A1" fill="#0369A1" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 grid grid-cols-1 gap-1">
            {[...radarData].sort((a, b) => a.score - b.score).map(d => (
              <div key={d.category} className="flex items-center gap-2">
                <span className="text-[9px] font-bold w-2 h-2 rounded-full shrink-0"
                  style={{ background: CAT_COLOR[d.category] ?? '#94A3B8' }} />
                <span className="text-[10px] text-slate-600 flex-1">{d.category}</span>
                <span className="text-[10px] font-bold" style={{ color: passColor(d.score) }}>{d.score}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Repeat Call Summary ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 flex flex-wrap gap-5 items-center">
        <span className="text-2xl">🔁</span>
        <div>
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Repeat Call Analysis</p>
          <p className="text-xl font-extrabold text-amber-800">{repeatPct}% repeat rate</p>
        </div>
        <div className="h-8 w-px bg-amber-200 hidden sm:block" />
        <div>
          <p className="text-[10px] text-amber-600 font-medium">Repeat Callers</p>
          <p className="text-lg font-bold text-amber-800">{repeatCalls.repeatCallers.toLocaleString()}</p>
        </div>
        <div className="h-8 w-px bg-amber-200 hidden sm:block" />
        <div>
          <p className="text-[10px] text-amber-600 font-medium">Total Unique Callers</p>
          <p className="text-lg font-bold text-amber-800">{repeatCalls.totalCallers.toLocaleString()}</p>
        </div>
        <div className="h-8 w-px bg-amber-200 hidden sm:block" />
        <div>
          <p className="text-[10px] text-amber-600 font-medium">Extra Repeat Calls</p>
          <p className="text-lg font-bold text-amber-800">{repeatCalls.repeatCallCount.toLocaleString()}</p>
        </div>
        <div className="ml-auto">
          <p className="text-[10px] text-amber-600 italic max-w-xs">
            {repeatPct > 20
              ? '⚠️ High repeat rate — investigate top contact reasons driving callbacks.'
              : repeatPct > 10
              ? '⚡ Moderate repeat rate — review first-call resolution for top scenarios.'
              : '✅ Repeat rate within healthy range.'}
          </p>
        </div>
      </div>

    </div>
  );
}
