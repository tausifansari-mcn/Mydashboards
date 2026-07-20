import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useProcessStore } from '@/store/processStore';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LabelList,
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, Legend,
} from 'recharts';
import {
  ChevronLeft, ChevronDown, Phone, ClipboardCheck, TrendingUp, Star,
  ThumbsUp, ThumbsDown, Minus, AlertTriangle, Trophy, Target,
  ShieldAlert, AlertOctagon, Download, Maximize2, Minimize2, X, Info, Loader2, Loader, Pencil, Check,
} from 'lucide-react';
import api from '@/lib/axios';
import Clap360Intelligence from './Clap360Intelligence';

function toLocalDT(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface PieSlice { name: string; value: number; color: string; }

interface ScamFlagCounts {
  financial_fraud: number;
  scam_words:      number;
}
interface ScamWordRow {
  word:      string;
  scenario:  string;
  scenario1: string;
  count:     number;
  pct:       number;
  lead_id?:  string;
  agent_id?: string;
  date?:     string;
  flag?:     string;
}
interface PotentialScamDetail { flags: ScamFlagCounts; wordRows: ScamWordRow[]; }

interface AbuseDetailRow {
  speaker:   'Agent' | 'Customer';
  lead_id:   string;
  agent_id:  string;
  word:      string;
  meaning:   string;
  scenario:  string;
  scenario1: string;
  date:      string;
  client_id: string;
}
interface AbuseDetailResponse { total: number; rows: AbuseDetailRow[]; }

interface NegSignalDetailCallRow {
  lead_id:   string;
  agent_id:  string;
  word:      string;
  scenario:  string;
  scenario1: string;
  date:      string;
  client_id: string;
}
interface NegSignalDetailCallResponse { total: number; rows: NegSignalDetailCallRow[]; }

interface PosKeywordRow { keyword: string; customer_count: number; agent_count: number; total: number; }

interface PosKeywordLeadRow {
  lead_id:   string;
  agent_id:  string;
  source:    'Customer' | 'Agent';
  phrase:    string;
  scenario:  string;
  scenario1: string;
  date:      string;
}

interface ScoreParamDetail { column: string; label: string; pct: number; }
interface ScoreComponentData {
  total: number;
  opening_skill:  ScoreParamDetail[];
  soft_skill:     ScoreParamDetail[];
  hold_procedure: ScoreParamDetail[];
  resolution:     ScoreParamDetail[];
  closing:        ScoreParamDetail[];
}

interface TranscriptData {
  lead_id:    string;
  agent_id:   string;
  date:       string;
  transcript: string;
}

interface FatalCallItem {
  lead_id:        string;
  agent_id:       string;
  call_date:      string;
  scenario:       string;
  scenario1:      string;
  failed_params:  string[];
  negative_words: string;
  score?:         number;
}

interface SocialThreatDetailRow {
  lead_id:     string;
  agent_id:    string;
  threat_word: string;
  threat_type: 'Social Media' | 'Court & Legal';
  scenario:    string;
  scenario1:   string;
  date:        string;
  client_id:   string;
}
interface SocialThreatDetailResponse { total: number; rows: SocialThreatDetailRow[]; }

interface AchtRow {
  category:    string;
  audit_count: number;
  score_pct:   number;
  fatal_count: number;
  fatal_pct:   number;
}

interface InboundProcessKPIs {
  client_id:         string;
  client_name:       string;
  audit_count:       number;
  cq_score:          number;
  cq_score_no_fatal: number;
  excellent:         number;
  good:              number;
  average_count:     number;
  below_average:     number;
  fatal_count:       number;
  opening_skill:     number;
  soft_skill:        number;
  hold_procedure:    number;
  resolution:        number;
  closing:                    number;
  avg_score:                  number;
  social_media_court_threat:  number;
  potential_scam:             number;
  frustration_count:          number;
  threat_count:               number;
  abuse_count:                number;
  cuss_abuse_count:           number;
  slang_count:                number;
  sarcasm_count:              number;
  pie_data:                   PieSlice[];
  acht_data:                  AchtRow[];
}

interface TopPerformer  { user: string; audit_count: number; avg_score: number; }
interface DailyScore   { call_date: string; avg_score: number; audit_count: number; }
interface Scenario1Item   { scenario1: string; count: number; pct: number; }
interface ScenarioItem   { scenario: string; count: number; pct: number; children: Scenario1Item[]; }
interface AlertScenarioRow { scenario: string; scenario1: string; count: number; pct: number; }
interface NegSignalDetailRow { scenario: string; scenario1: string; neg_signal: string; count: number; pct: number; }
interface SensitiveWordUseRow { label: string; count: number; pct: number; }
interface SensitiveWordAnalysis { distribution: SensitiveWordUseRow[]; akash_count: number; akash_label: string; social_count: number; court_count: number; }
interface FatalContributorRow  { agent_name: string; audit_count: number; fatal_count: number; fatal_pct: number; }
interface DayWiseFatalRow      { call_date: string; total_count: number; total_fatal: number; fatal_pct: number; query_fatal: number; complaint_fatal: number; request_fatal: number; }
interface WeekScenarioFatalRow { week_label: string; query_fatal_pct: number; complaint_fatal_pct: number; request_fatal_pct: number; sale_done_fatal_pct: number; total_fatal: number; }
interface AgentPerformanceRow  { agent_name: string; audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; below_avg_pct: number; avg_pct: number; good_pct: number; excellent_pct: number; }
interface FatalAnalysis        { audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; query_fatal: number; complaint_fatal: number; request_fatal: number; sale_done_fatal: number; top_contributors: FatalContributorRow[]; day_wise: DayWiseFatalRow[]; week_scenario: WeekScenarioFatalRow[]; agent_performance: AgentPerformanceRow[]; }

interface DetailScenario1Item  { scenario1: string; count: number; pct: number; }
interface DetailScenarioPanel  { scenario: string; total_count: number; items: DetailScenario1Item[]; }
interface DayWiseAuditRow      { call_date: string; complaint: number; null_count: number; request: number; query: number; total: number; }
interface WeekScenarioAuditRow { week_label: string; query_pct: number; complaint_pct: number; request_pct: number; sale_done_pct: number; total: number; }
interface DetailAnalysis       { cq_score: number; audit_count: number; fatal_count: number; fatal_pct: number; query_count: number; complaint_count: number; request_count: number; sale_done_count: number; scenario_panels: DetailScenarioPanel[]; day_wise_audit: DayWiseAuditRow[]; week_scenario_audit: WeekScenarioAuditRow[]; }

interface AgentParamRow      { agent_name: string; tq_mq_bq: string; audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; opening_skill: number; soft_skill: number; hold_procedure: number; resolution: number; closing: number; }
interface AgentAuditBandRow  { agent: string; audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; tq_count: number; mq_count: number; bq_count: number; }
interface DayWiseQualityRow  { call_date: string; audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; opening_skill: number; soft_skill: number; hold_procedure: number; resolution: number; closing: number; }
interface WeekWiseQualityRow  { week_label: string; audit_count: number; cq_score: number; fatal_count: number; fatal_pct: number; opening_skill: number; soft_skill: number; hold_procedure: number; resolution: number; closing: number; }
interface QualityParameterRow { parameter: string; hit_count: number; total_count: number; score_pct: number; }

interface DayWiseRepeatRow { call_date: string; unique_calls: number; repeat_calls: number; repeat_pct: number; }
interface RepeatPivotRow   { mobile_no: string; by_date: Record<string, number>; grand_total: number; }
interface RepeatAnalysis   { grand_unique: number; grand_repeat: number; grand_pct: number; day_wise: DayWiseRepeatRow[]; pivot_dates: string[]; pivot_rows: RepeatPivotRow[]; }

interface AgentMasterRow  { masId: string; agentName: string; lob: string; }
interface VocQuote { leadId: string; agentName: string; callDate: string; quote: string; }

// ─── CSV Export ───────────────────────────────────────────────────────────────
function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const header = keys.join(',');
  const body = rows.map(r =>
    keys.map(k => {
      const v = r[k];
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\n');
  const blob = new Blob(['﻿' + `${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Drill Modal (portal) ─────────────────────────────────────────────────────
interface DrillModalProps {
  title: string;
  accent: string;
  onClose: () => void;
  children: React.ReactNode;
}
function DrillModal({ title, accent, onClose, children }: DrillModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-4"
      onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
          <div className="w-1 h-5 rounded-full" style={{ background: accent }} />
          <p className="text-sm font-bold text-slate-900 flex-1">{title}</p>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Score Component Detail Modal ────────────────────────────────────────────
function ScoreComponentModal({
  label, accent, params, loading, onClose,
}: {
  label:   string;
  accent:  string;
  params:  ScoreParamDetail[];
  loading: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const color = (pct: number) => pct >= 90 ? '#22C55E' : pct >= 75 ? '#F59E0B' : '#EF4444';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white">
          <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${accent}15`, color: accent }}>
            <ClipboardCheck size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">{label}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Parameter-wise compliance score</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1 p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Loading parameters…</span>
            </div>
          ) : params.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">No data available for this period.</p>
          ) : (
            <div className="space-y-3">
              {params.map(p => {
                const c = color(p.pct);
                return (
                  <div key={p.column} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-slate-700">{p.label}</span>
                      <span className="text-sm font-bold tabular-nums" style={{ color: c }}>{p.pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(p.pct, 100)}%`, backgroundColor: c }} />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-slate-400">
                        {p.pct >= 90 ? '✅ On Target' : p.pct >= 75 ? '⚠️ Needs Attention' : '❌ Below Target'}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{p.column}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Fatal Transcript Modal (with highlighting) ───────────────────────────────
function FatalTranscriptModal({
  data, loading, onClose, fatalItem,
}: {
  data: TranscriptData | null;
  loading: boolean;
  onClose: () => void;
  fatalItem: FatalCallItem | null;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const highlightTerms = fatalItem
    ? fatalItem.negative_words
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 2)
    : [];

  function renderHighlighted(text: string) {
    if (!highlightTerms.length) return <span>{text}</span>;
    const escaped = highlightTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) =>
          regex.test(part)
            ? <mark key={i} style={{ background: '#FEF08A', color: '#92400E', borderRadius: 3, padding: '0 2px', fontWeight: 700 }}>{part}</mark>
            : <span key={i}>{part}</span>
        )}
      </>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ background: 'linear-gradient(135deg,#B71C1C 0%,#D32F2F 100%)' }}>
          <AlertTriangle size={16} className="text-red-200 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Fatal Call Transcript</p>
            {data && (
              <p className="text-[10px] text-red-200 mt-0.5">
                Lead: <span className="font-mono text-white">{data.lead_id}</span>
                {' · '}Agent: <span className="font-semibold text-white">{data.agent_id}</span>
                {' · '}{data.date}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-red-200 hover:text-white p-1"><X size={18} /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: transcript */}
          <div className="flex-1 overflow-auto p-5">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm">Loading transcript…</span>
              </div>
            ) : !data?.transcript ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                <span className="text-4xl">📭</span>
                <p className="text-sm">No transcript available for this call.</p>
              </div>
            ) : (
              <>
                {highlightTerms.length > 0 && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-2.5">
                    <span className="text-yellow-600 shrink-0 mt-0.5">⚠️</span>
                    <p className="text-[11px] text-yellow-800">
                      <span className="font-bold">Highlighted keywords:</span>{' '}
                      {highlightTerms.join(' · ')}
                    </p>
                  </div>
                )}
                <div className="rounded-xl border border-red-100 bg-red-50/40 p-5">
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-mono">
                    {renderHighlighted(data.transcript)}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Right: Why Fatal panel */}
          {fatalItem && (
            <div className="w-64 shrink-0 border-l border-slate-200 bg-slate-50 overflow-auto p-4 flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-2">Why This Call is Fatal</p>
                <p className="text-[11px] text-slate-500 mb-3">Quality score = 0. The following parameters all failed:</p>
              </div>

              {fatalItem.failed_params.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">All parameters passed — marked fatal due to score = 0</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {fatalItem.failed_params.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5">
                      <span className="text-red-400 shrink-0">✗</span>
                      <span className="text-[11px] font-semibold text-red-700">{p}</span>
                    </div>
                  ))}
                </div>
              )}

              {fatalItem.negative_words && (
                <div>
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest mb-1.5">Negative Words Detected</p>
                  <div className="flex flex-wrap gap-1">
                    {fatalItem.negative_words.split(',').map((w, i) => (
                      <span key={i} className="text-[10px] bg-orange-100 text-orange-800 border border-orange-200 rounded px-1.5 py-0.5 font-semibold">{w.trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Call Details</p>
                <div className="space-y-1 text-[11px] text-slate-600">
                  <p><span className="font-semibold">Scenario:</span> {fatalItem.scenario}</p>
                  <p><span className="font-semibold">Sub-scenario:</span> {fatalItem.scenario1}</p>
                  <p><span className="font-semibold">Date:</span> {fatalItem.call_date}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Fatal Calls List Modal ───────────────────────────────────────────────────
function FatalCallsModal({
  calls, loading, onClose, onLeadClick, resolveAgent,
}: {
  calls:        FatalCallItem[];
  loading:      boolean;
  onClose:      () => void;
  onLeadClick:  (item: FatalCallItem) => void;
  resolveAgent: (masId: string) => string;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ background: 'linear-gradient(135deg,#B71C1C 0%,#D32F2F 100%)' }}>
          <div className="p-2 rounded-xl bg-red-900/30">
            <AlertTriangle size={16} className="text-red-100" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Fatal Calls — Quality Score = 0</p>
            <p className="text-[10px] text-red-200 mt-0.5">
              {loading ? 'Loading…' : `${calls.length} fatal call${calls.length !== 1 ? 's' : ''} in selected period · Click Lead ID to view transcript`}
            </p>
          </div>
          <button onClick={onClose} className="text-red-200 hover:text-white p-1"><X size={18} /></button>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm font-semibold">Loading fatal calls…</span>
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
              <span className="text-4xl">✅</span>
              <p className="text-sm">No fatal calls found for this period.</p>
            </div>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="sticky top-0">
                  <th className="px-3 py-2.5 text-left">#</th>
                  <th className="px-3 py-2.5 text-left">Agent</th>
                  <th className="px-3 py-2.5 text-left">Lead ID</th>
                  <th className="px-3 py-2.5 text-left">Date</th>
                  <th className="px-3 py-2.5 text-left">Scenario</th>
                  <th className="px-3 py-2.5 text-left">Sub-Scenario</th>
                  <th className="px-3 py-2.5 text-left">Failed Parameters</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((c, i) => (
                  <tr key={c.lead_id + i} className="border-t border-slate-100 hover:bg-red-50 transition-colors">
                    <td className="px-3 py-2 text-slate-400 font-mono">{i + 1}</td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-slate-700">{resolveAgent(c.agent_id)}</span>
                      <span className="block text-[10px] text-slate-400 font-mono">{c.agent_id}</span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        className="font-mono text-blue-600 hover:text-blue-800 hover:underline font-bold transition-colors"
                        onClick={() => onLeadClick(c)}
                        title="Click to view transcript"
                      >
                        {c.lead_id || '—'}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{c.call_date}</td>
                    <td className="px-3 py-2">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">{c.scenario}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-500 text-[10px]">{c.scenario1}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {c.failed_params.slice(0, 4).map((p, pi) => (
                          <span key={pi} className="text-[9px] bg-red-100 text-red-700 border border-red-200 rounded px-1 py-0.5 font-semibold">{p}</span>
                        ))}
                        {c.failed_params.length > 4 && (
                          <span className="text-[9px] bg-slate-100 text-slate-500 rounded px-1 py-0.5">+{c.failed_params.length - 4} more</span>
                        )}
                        {c.failed_params.length === 0 && (
                          <span className="text-[9px] text-slate-400 italic">Score = 0 (all params)</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Transcript Modal ────────────────────────────────────────────────────────
function TranscriptModal({ data, loading, onClose }: { data: TranscriptData | null; loading: boolean; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white">
          <div className="p-2 rounded-xl bg-blue-50">
            <span className="text-lg">📋</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">Call Transcript</p>
            {data && (
              <p className="text-[10px] text-slate-500 mt-0.5 font-medium">
                Lead: <span className="font-mono text-blue-700">{data.lead_id}</span>
                {' · '}Agent: <span className="font-semibold text-slate-700">{data.agent_id}</span>
                {' · '}{data.date}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm font-semibold">Loading transcript…</span>
            </div>
          ) : !data || !data.transcript ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <span className="text-4xl">📭</span>
              <p className="text-sm font-medium">No transcript available for this call.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">
                {data.transcript}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Positive Signal Detail Modal ─────────────────────────────────────────────
function PosSignalDetailModal({
  keyword, color, phrases, phrasesLoading, leads, leadsLoading, onClose, onLeadClick,
}: {
  keyword:        string;
  color:          string;
  phrases:        Array<{ source: string; phrase: string; count: number }>;
  phrasesLoading: boolean;
  leads:          PosKeywordLeadRow[];
  leadsLoading:   boolean;
  onClose:        () => void;
  onLeadClick:    (leadId: string) => void;
}) {
  const [tab, setTab] = useState<'phrases' | 'calls'>('phrases');
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const custCount  = leads.filter(r => r.source === 'Customer').length;
  const agentCount = leads.filter(r => r.source === 'Agent').length;
  const topPhrase  = phrases[0]?.phrase ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ background: '#ffffff', border: `2px solid ${color}40` }}
        onClick={e => e.stopPropagation()}>

        {/* Gradient header */}
        <div className="relative px-6 py-5 flex items-start gap-4 overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${color}EE 0%, ${color}99 100%)` }}>
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: `radial-gradient(circle at 80% 20%, #ffffff 0%, transparent 60%)` }} />

          {/* Icon bubble */}
          <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg z-10"
            style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)' }}>
            ✨
          </div>

          {/* Title */}
          <div className="flex-1 z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-0.5">Positive Signal Analysis</p>
            <h2 className="text-lg font-bold text-white leading-tight">"{keyword}"</h2>
            {topPhrase && (
              <p className="text-[11px] text-white/75 mt-1 italic">Top phrase: "{topPhrase}"</p>
            )}
          </div>

          <button onClick={onClose}
            className="shrink-0 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/20"
            style={{ color: 'rgba(255,255,255,0.8)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-white/40"
          style={{ background: `${color}10`, borderBottom: `1px solid ${color}30` }}>
          {[
            { label: 'Unique Phrases', value: phrases.length, icon: '💬' },
            { label: 'Customer Mentions', value: custCount,  icon: '👤' },
            { label: 'Agent Mentions',    value: agentCount, icon: '🎧' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 px-5 py-3">
              <span className="text-lg">{s.icon}</span>
              <div>
                <p className="text-lg font-bold leading-none" style={{ color }}>{s.value}</p>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-2.5" style={{ borderBottom: `1px solid ${color}25`, background: `${color}08` }}>
          {[
            { key: 'phrases' as const, icon: '💬', label: 'Top Phrases', count: phrases.length },
            { key: 'calls'   as const, icon: '📋', label: 'Call Details',  count: leads.length },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-150"
              style={tab === t.key
                ? { background: color, color: '#fff', boxShadow: `0 2px 8px ${color}50` }
                : { background: 'rgba(255,255,255,0.7)', color: '#64748B' }}>
              {t.icon} {t.label}
              <span className="ml-1 rounded-full text-[9px] px-1.5 py-0.5 font-bold"
                style={tab === t.key
                  ? { background: 'rgba(255,255,255,0.25)', color: '#fff' }
                  : { background: `${color}20`, color }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1" style={{ background: '#F8FAFC' }}>

          {/* Phrases tab */}
          {tab === 'phrases' && (
            phrasesLoading ? (
              <div className="flex items-center justify-center py-16 gap-3" style={{ color }}>
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-semibold">Loading phrases…</span>
              </div>
            ) : phrases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                <span className="text-4xl">💬</span>
                <p className="text-sm font-medium">No phrases found for this period.</p>
              </div>
            ) : (
              <div className="p-5">
                <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: `1px solid ${color}25` }}>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: `linear-gradient(135deg, ${color}22 0%, ${color}12 100%)` }}>
                        {['#', 'Source', 'Phrase', 'Count'].map(h => (
                          <th key={h} className="text-left px-4 py-3 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap"
                            style={{ color, borderBottom: `1px solid ${color}25` }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {phrases.map((p, i) => (
                        <tr key={i} className="border-b last:border-0 transition-colors"
                          style={{ borderColor: `${color}12` }}
                          onMouseEnter={e => (e.currentTarget.style.background = `${color}08`)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td className="px-4 py-2.5 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold"
                              style={p.source === 'Customer'
                                ? { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
                                : { background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                              {p.source === 'Customer' ? '👤' : '🎧'} {p.source}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-700 font-medium">{p.phrase}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-block rounded-lg px-3 py-1 text-xs font-bold"
                              style={{ background: `${color}18`, color }}>
                              {p.count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

          {/* Calls tab */}
          {tab === 'calls' && (
            leadsLoading ? (
              <div className="flex items-center justify-center py-16 gap-3" style={{ color }}>
                <Loader2 size={20} className="animate-spin" />
                <span className="text-sm font-semibold">Loading calls…</span>
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                <span className="text-4xl">📋</span>
                <p className="text-sm font-medium">No call records found for this period.</p>
              </div>
            ) : (
              <div className="p-5">
                <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: `1px solid ${color}25` }}>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr style={{ background: `linear-gradient(135deg, ${color}22 0%, ${color}12 100%)` }}>
                        {['#', 'Lead ID', 'Source', 'Agent ID', 'Phrase', 'Scenario', 'Date'].map(h => (
                          <th key={h} className="text-left px-3 py-3 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap"
                            style={{ color, borderBottom: `1px solid ${color}25` }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((r, i) => (
                        <tr key={i} className="border-b last:border-0 transition-colors"
                          style={{ borderColor: `${color}12` }}
                          onMouseEnter={e => (e.currentTarget.style.background = `${color}08`)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td className="px-3 py-2.5 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                          <td className="px-3 py-2.5">
                            {r.lead_id ? (
                              <button onClick={() => onLeadClick(r.lead_id)}
                                className="font-mono text-[11px] font-bold hover:underline transition-colors"
                                style={{ color }}>
                                {r.lead_id}
                              </button>
                            ) : <span className="text-slate-400 font-mono">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={r.source === 'Customer'
                                ? { background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0' }
                                : { background: '#EFF6FF', color: '#1E40AF', border: '1px solid #BFDBFE' }}>
                              {r.source === 'Customer' ? '👤' : '🎧'} {r.source === 'Customer' ? 'Cust' : 'Agent'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-slate-700 text-[11px]">{r.agent_id}</td>
                          <td className="px-3 py-2.5 text-slate-600 max-w-[180px] truncate" title={r.phrase}>{r.phrase || '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">
                              {r.scenario}{r.scenario1 ? ` / ${r.scenario1}` : ''}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-slate-400 text-[10px] whitespace-nowrap">{r.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function AbuseDetailModal({ detail, loading, onClose, onLeadClick }: { detail: AbuseDetailResponse | null; loading: boolean; onClose: () => void; onLeadClick: (leadId: string) => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const [tab, setTab] = useState<'all' | 'agent' | 'customer'>('all');
  const rows = detail?.rows ?? [];
  const visible = tab === 'all' ? rows : rows.filter(r => r.speaker.toLowerCase() === tab);
  const agentCount    = rows.filter(r => r.speaker === 'Agent').length;
  const customerCount = rows.filter(r => r.speaker === 'Customer').length;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-4"
      onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white">
          <div className="p-2 rounded-xl bg-purple-50">
            <span className="text-lg">🚫</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">Abuse Detection — Full Breakdown</p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Agent & customer abusive language detected from call transcripts</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm font-semibold">Loading abuse data...</span>
            </div>
          ) : !detail || rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <span className="text-4xl">✅</span>
              <p className="text-slate-500 font-semibold text-sm">No abusive language detected in this period</p>
            </div>
          ) : (
            <>
              {/* Summary chips */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-purple-200 bg-purple-50">
                  <span className="text-sm font-bold text-purple-700">{rows.length}</span>
                  <span className="text-xs font-semibold text-purple-600">Total Incidents</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 bg-red-50">
                  <span className="text-sm font-bold text-red-700">{agentCount}</span>
                  <span className="text-xs font-semibold text-red-600">Agent Abuse ⚠️ Critical</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-orange-200 bg-orange-50">
                  <span className="text-sm font-bold text-orange-700">{customerCount}</span>
                  <span className="text-xs font-semibold text-orange-600">Customer Abuse</span>
                </div>
              </div>

              {/* Tabs */}
              <div className="pill-tabs">
                {([['all', 'All', rows.length], ['agent', 'Agent Only', agentCount], ['customer', 'Customer Only', customerCount]] as [string, string, number][]).map(([t, lbl, cnt]) => (
                  <button key={t} onClick={() => setTab(t as 'all' | 'agent' | 'customer')}
                    className={`pill-tab ${tab === t ? 'pill-tab-active' : ''}`}>
                    {lbl} ({cnt})
                  </button>
                ))}
              </div>

              {/* Table */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-auto max-h-[420px]">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: '#FAF5FF' }}>
                        {['Lead ID','Speaker','Agent ID','Word Used','Meaning','Scenario','Sub-Scenario','Date'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((r, i) => {
                        const isAgent = r.speaker === 'Agent';
                        return (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-2.5 border-b border-slate-100">
                              {r.lead_id ? (
                                <button onClick={() => onLeadClick(r.lead_id)}
                                  className="font-mono text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">
                                  {r.lead_id}
                                </button>
                              ) : <span className="text-slate-400 font-mono text-[11px]">—</span>}
                            </td>
                            <td className="px-4 py-2.5 border-b border-slate-100">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isAgent
                                  ? 'bg-red-100 text-red-700 border border-red-200'
                                  : 'bg-orange-100 text-orange-700 border border-orange-200'
                              }`}>
                                {isAgent ? '⚠️ Agent' : '👤 Customer'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 border-b border-slate-100 font-mono text-[11px] text-slate-700 font-semibold">{r.agent_id}</td>
                            <td className="px-4 py-2.5 border-b border-slate-100">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                {r.word}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 border-b border-slate-100 text-slate-600 italic text-[11px]">{r.meaning}</td>
                            <td className="px-4 py-2.5 border-b border-slate-100 text-slate-700">{r.scenario}</td>
                            <td className="px-4 py-2.5 border-b border-slate-100 text-slate-500">{r.scenario1 === 'Unknown' ? '—' : r.scenario1}</td>
                            <td className="px-4 py-2.5 border-b border-slate-100 text-slate-500 font-mono text-[10px] whitespace-nowrap">{r.date}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ScamDetailModal({ detail, loading, onClose, onLeadClick }: { detail: PotentialScamDetail | null; loading: boolean; onClose: () => void; onLeadClick: (leadId: string) => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const FLAGS = [
    { key: 'financial_fraud' as const, label: 'Financial Fraud', desc: 'AI flagged financial fraud indicators in the call', color: '#EF4444', bg: '#FEF2F2' },
    { key: 'scam_words'      as const, label: 'Scam Detected',   desc: 'Call contained scam/fraud keywords in conversation', color: '#F97316', bg: '#FFF7ED' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-4"
      onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white">
          <div className="p-2 rounded-xl bg-red-50">
            <AlertOctagon size={18} className="text-red-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-900">Potential Scam Leads — Full Breakdown</p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">Flag counts + words used + scenario context</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm font-semibold">Loading scam detail...</span>
            </div>
          ) : !detail ? (
            <p className="text-center text-slate-400 text-sm py-10">No data available</p>
          ) : (
            <>
              {/* ── Flag Breakdown Cards ── */}
              <div>
                <p className="text-label mb-3">Flag Type Breakdown</p>
                <div className="grid grid-cols-2 gap-3">
                  {FLAGS.map(f => {
                    const count = detail.flags[f.key];
                    const total = detail.flags.financial_fraud + detail.flags.scam_words;
                    const pct   = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
                    return (
                      <div key={f.key} className="rounded-xl border-2 p-4 flex items-start gap-3"
                           style={{ background: f.bg, borderColor: `${f.color}30` }}>
                        <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: f.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-900">{f.label}</p>
                          <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-snug">{f.desc}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xl font-bold" style={{ color: f.color }}>{count.toLocaleString()}</p>
                          <p className="text-[10px] font-bold text-slate-500">{pct}%</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Call Detail Table ── */}
              <div>
                <p className="text-label mb-3">
                  Call Details
                  <span className="ml-2 font-medium text-slate-400 normal-case">({detail.wordRows.length} calls)</span>
                </p>
                {detail.wordRows.length === 0 ? (
                  <p className="text-center text-slate-400 text-sm py-6">No data available for this period</p>
                ) : (
                  <div className="rounded-xl border border-slate-200 overflow-hidden">
                    <div className="overflow-auto max-h-[400px]">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50">
                            {['Flag', 'Lead ID', 'Agent ID', 'Word / Phrase', 'Scenario', 'Sub-Scenario', 'Date'].map(h => (
                              <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.wordRows.map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50 border-b border-slate-100 last:border-0">
                              <td className="px-3 py-2">
                                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                                  r.flag === 'Financial Fraud'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {r.flag ?? 'Scam'}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {r.lead_id ? (
                                  <button onClick={() => onLeadClick(r.lead_id!)}
                                    className="font-mono text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">
                                    {r.lead_id}
                                  </button>
                                ) : <span className="text-slate-400 font-mono">—</span>}
                              </td>
                              <td className="px-3 py-2 font-semibold text-slate-700">{r.agent_id}</td>
                              <td className="px-3 py-2">
                                {r.word && r.word !== '—'
                                  ? <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">{r.word}</span>
                                  : <span className="text-slate-400 italic">—</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-600">{r.scenario}</td>
                              <td className="px-3 py-2 text-slate-500">{r.scenario1 === 'Unknown' ? '—' : r.scenario1}</td>
                              <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{r.date ?? '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Social Media & Consumer Court Threat Detail Modal ───────────────────────
function SocialThreatDetailModal({
  detail, loading, onClose, onLeadClick,
}: {
  detail: SocialThreatDetailResponse | null;
  loading: boolean;
  onClose: () => void;
  onLeadClick: (leadId: string) => void;
}) {
  const [tab, setTab] = useState<'All' | 'Social Media' | 'Court & Legal'>('All');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const rows = detail?.rows ?? [];
  const socialCount = rows.filter(r => r.threat_type === 'Social Media').length;
  const courtCount  = rows.filter(r => r.threat_type === 'Court & Legal').length;
  const visible     = tab === 'All' ? rows : rows.filter(r => r.threat_type === tab);

  const TABS: { key: typeof tab; label: string; count: number; color: string }[] = [
    { key: 'All',           label: 'All',            count: rows.length,  color: '#F97316' },
    { key: 'Social Media',  label: '📱 Social Media', count: socialCount,  color: '#3B82F6' },
    { key: 'Court & Legal', label: '⚖️ Court & Legal', count: courtCount,  color: '#EF4444' },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white">
          <div className="p-2 rounded-xl bg-orange-50">
            <ShieldAlert size={18} className="text-orange-500" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Social Media &amp; Consumer Court Threat</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? 'Loading…' : `${detail?.total ?? 0} calls with threat keywords`}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Summary chips */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 bg-blue-50 border border-blue-200">
              <span className="text-xs font-bold text-blue-700">📱 Social Media</span>
              <span className="text-sm font-bold text-blue-600">{socialCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 bg-red-50 border border-red-200">
              <span className="text-xs font-bold text-red-700">⚖️ Court &amp; Legal</span>
              <span className="text-sm font-bold text-red-600">{courtCount}</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        {!loading && rows.length > 0 && (
          <div className="px-6 pt-3 pb-3 border-b border-slate-200 bg-slate-50">
            <div className="pill-tabs">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`pill-tab ${tab === t.key ? 'pill-tab-active' : ''}`}>
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="overflow-auto flex-1 p-6">
          {loading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <span className="text-4xl">🔍</span>
              <p className="text-sm font-medium">No social/court threats found for this date range.</p>
            </div>
          )}

          {!loading && visible.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-orange-50">
                    {['Type', 'Lead ID', 'Agent ID', 'Threat Word / Phrase', 'Scenario', 'Sub-Scenario', 'Date'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-semibold text-orange-700 whitespace-nowrap border-b border-orange-100 uppercase tracking-wider text-[10px]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${
                          row.threat_type === 'Social Media'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {row.threat_type === 'Social Media' ? '📱 Social' : '⚖️ Court'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {row.lead_id ? (
                          <button onClick={() => onLeadClick(row.lead_id)}
                            className="font-mono text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">
                            {row.lead_id}
                          </button>
                        ) : <span className="text-slate-400 font-mono">—</span>}
                      </td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{row.agent_id}</td>
                      <td className="px-3 py-2">
                        <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
                          {row.threat_word}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.scenario}</td>
                      <td className="px-3 py-2 text-slate-500">{row.scenario1 === 'Unknown' ? '—' : row.scenario1}</td>
                      <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{row.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Neg Signal Detail Modal (Threat / Frustration) ─────────────────────────
function NegSignalDetailModal({
  signal, detail, loading, onClose, onLeadClick,
}: {
  signal: 'Threat' | 'Frustration';
  detail: NegSignalDetailCallResponse | null;
  loading: boolean;
  onClose: () => void;
  onLeadClick: (leadId: string) => void;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const accent    = signal === 'Threat' ? '#EF4444' : '#F59E0B';
  const icon      = signal === 'Threat' ? '⚠️' : '😤';
  const bgLight   = signal === 'Threat' ? '#FEF2F2' : '#FFFBEB';

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white">
          <span className="text-xl">{icon}</span>
          <div>
            <h2 className="text-base font-bold text-slate-800">{signal} Signal — Call Details</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {loading ? 'Loading…' : `${detail?.total ?? 0} calls flagged`}
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1 p-6">
          {loading && (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && (!detail || detail.rows.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
              <span className="text-4xl">🔍</span>
              <p className="text-sm font-medium">No {signal.toLowerCase()} signals found for this date range.</p>
            </div>
          )}

          {!loading && detail && detail.rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    {['Lead ID', 'Agent ID', 'Word / Phrase Used', 'Scenario', 'Sub-Scenario', 'Date'].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap border-b border-slate-200">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.rows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2">
                        {row.lead_id ? (
                          <button onClick={() => onLeadClick(row.lead_id)}
                            className="font-mono text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">
                            {row.lead_id}
                          </button>
                        ) : <span className="text-slate-400 font-mono text-[11px]">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-semibold text-slate-700">{row.agent_id}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: `${accent}20`, color: accent }}>
                          {row.word}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.scenario}</td>
                      <td className="px-3 py-2 text-slate-500">{row.scenario1}</td>
                      <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{row.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Expand Wrapper ──────────────────────────────────────────────────────────
function ExpandBtn({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      title={expanded ? 'Minimize' : 'Expand fullscreen'}
      className="ml-auto p-1 rounded text-slate-600 hover:text-slate-600 transition-colors shrink-0">
      {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
    </button>
  );
}

// ─── Export Button ────────────────────────────────────────────────────────────
function ExportBtn({ onClick, title = 'Export CSV' }: { onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-400 hover:text-emerald-400 border border-slate-200 hover:border-emerald-500/30 transition-colors shrink-0">
      <Download size={11} /> CSV
    </button>
  );
}

// ─── Agent Name Tag ───────────────────────────────────────────────────────────
function AgentNameTag({ masId, agentMap, className = '', onSave }: {
  masId:    string;
  agentMap: Map<string, string>;
  className?: string;
  onSave?:  (masId: string, name: string) => Promise<void>;
}) {
  const name = agentMap.get(masId);
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [saving, setSaving]   = useState(false);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputVal(name || '');
    setEditing(true);
  };

  const handleSave = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!inputVal.trim() || !onSave) return;
    setSaving(true);
    try {
      await onSave(masId, inputVal.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`} onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(e); if (e.key === 'Escape') setEditing(false); }}
          className="w-36 border border-blue-400 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button onClick={handleSave} disabled={saving}
          className="flex items-center justify-center w-5 h-5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
        </button>
        <button onClick={e => { e.stopPropagation(); setEditing(false); }}
          className="flex items-center justify-center w-5 h-5 rounded bg-slate-200 text-slate-500 hover:bg-slate-300">
          <X size={10} />
        </button>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex flex-col leading-tight ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="flex items-center gap-1.5">
        <span className="font-semibold text-slate-800">{name || masId}</span>
        {onSave && (
          <button
            onClick={startEdit}
            title="Edit agent name"
            style={{ opacity: hovered ? 1 : 0.35, transition: 'opacity 0.15s' }}
            className="flex items-center justify-center w-4 h-4 rounded text-white bg-blue-500 hover:bg-blue-600 shrink-0"
          >
            <Pencil size={9} />
          </button>
        )}
      </span>
      {name && <span className="text-[10px] text-slate-400 font-mono">{masId}</span>}
    </span>
  );
}

// ─── CLAP Branch VOC Quote List ────────────────────────────────────────────────
function VocQuoteList({ positive, negative, loading }: { positive: VocQuote[]; negative: VocQuote[]; loading: boolean }) {
  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const Column = ({ title, icon, quotes, borderColor, headerBg }: { title: string; icon: string; quotes: VocQuote[]; borderColor: string; headerBg: string }) => (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor }}>
      <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: headerBg }}>
        <span className="text-white text-sm">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-white">{title}</span>
        <span className="ml-auto text-[9px] text-white/70 font-semibold">{quotes.length}</span>
      </div>
      <div className="bg-white p-3 space-y-2 max-h-80 overflow-y-auto">
        {loading ? (
          <p className="text-[10px] text-slate-400 italic">Loading…</p>
        ) : quotes.length === 0 ? (
          <p className="text-[10px] text-slate-400 italic">No {title.toLowerCase()} recorded</p>
        ) : quotes.map((q, i) => (
          <div key={`${q.leadId}-${i}`} className="rounded-lg border border-slate-100 p-2.5 bg-slate-50">
            <p className="text-[11px] text-slate-700 leading-snug">&ldquo;{q.quote}&rdquo;</p>
            <p className="text-[9px] text-slate-400 font-semibold mt-1">{q.agentName} · {fmtDate(q.callDate)}</p>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-4">
      <Column title="Positive Quotes" icon="😊" quotes={positive} borderColor="#A7F3D0" headerBg="linear-gradient(135deg,#064E3B,#059669)" />
      <Column title="Negative Quotes" icon="😠" quotes={negative} borderColor="#FECACA" headerBg="linear-gradient(135deg,#7F1D1D,#DC2626)" />
    </div>
  );
}

const SCENARIO_COLORS = ['#3B82F6','#22C55E','#F59E0B','#A855F7','#EF4444','#14B8A6','#F97316','#EC4899'];

function cqColor(score: number): string {
  if (score >= 90) return '#22C55E';
  if (score >= 85) return '#F59E0B';
  if (score > 0)   return '#EF4444';
  return '#64748B';
}

interface MetricCardProps {
  label:      string;
  value:      string | number;
  subValue?:  string;
  icon:       React.ElementType;
  accentColor: string;
  loading?:   boolean;
}
function MetricCard({ label, value, subValue, icon: Icon, accentColor, loading }: MetricCardProps) {
  return (
    <div
      className="relative flex flex-col bg-white rounded-xl overflow-hidden group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-default"
      style={{ border: `2px solid ${accentColor}` }}
    >
      <div className="h-1 w-full" style={{ background: accentColor }} />
      <div className="relative px-3 py-2.5">
        <div className="flex items-start justify-between mb-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.05em] leading-tight pr-2" style={{ color: accentColor }}>{label}</span>
          <div className="p-1.5 rounded-lg shrink-0"
               style={{ backgroundColor: `${accentColor}18`, color: accentColor }}>
            <Icon size={12} />
          </div>
        </div>
        {loading ? (
          <div className="h-6 w-16 bg-slate-100 rounded-lg animate-pulse" />
        ) : (
          <p className="text-xl font-black text-slate-900 leading-none tracking-tight tabular-nums">{value}</p>
        )}
        {subValue && !loading && (
          <div className="flex items-center gap-1 mt-1">
            <div className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
            <p className="text-[10px] text-slate-500 font-semibold">{subValue}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const TNI_PARAM_INFO: { key: string; label: string; category: 'Soft Skills' | 'Process Knowledge' | 'Communication'; tip: string }[] = [
  { key: 'customer_concern_acknowledged',      label: 'Customer Concern Acknowledged',  category: 'Soft Skills',        tip: 'Echo the customer\'s concern at call start to signal active listening and build rapport immediately.' },
  { key: 'professionalism_maintained',         label: 'Professionalism Maintained',     category: 'Soft Skills',        tip: 'Maintain a composed, respectful tone throughout even under pressure or aggression from the caller.' },
  { key: 'assurance_or_appreciation_provided', label: 'Assurance / Appreciation',       category: 'Soft Skills',        tip: 'Thank the caller or provide reassurance before ending — it directly lifts CSAT scores.' },
  { key: 'express_empathy',                    label: 'Express Empathy',                category: 'Soft Skills',        tip: 'Use empathy phrases ("I understand how frustrating that must be") at least once per call.' },
  { key: 'enthusiasm_and_no_fumbling',         label: 'Enthusiasm & No Fumbling',       category: 'Soft Skills',        tip: 'Project energy from the first second; hesitation and filler sounds create distrust.' },
  { key: 'active_listening',                   label: 'Active Listening',               category: 'Soft Skills',        tip: 'Paraphrase key details back to the customer to confirm understanding before acting.' },
  { key: 'politeness_and_no_sarcasm',          label: 'Politeness & No Sarcasm',        category: 'Soft Skills',        tip: 'Avoid dismissive or sarcastic tone — when unsure, default to neutral and warm.' },
  { key: 'proper_call_closure',                label: 'Proper Call Closure',            category: 'Soft Skills',        tip: 'Summarise the resolution and invite follow-up questions before signing off.' },
  { key: 'accurate_issue_probing',             label: 'Accurate Issue Probing',         category: 'Process Knowledge', tip: 'Ask targeted open-ended questions to identify root cause — avoid generic or leading questions.' },
  { key: 'proper_hold_procedure',              label: 'Proper Hold Procedure',          category: 'Process Knowledge', tip: 'Always ask permission before placing on hold and give a time estimate; check back every 60 seconds.' },
  { key: 'proper_transfer_and_language',       label: 'Proper Transfer & Language',     category: 'Process Knowledge', tip: 'Warm-transfer with a brief brief to the next agent — never cold drop the caller.' },
  { key: 'address_recorded_completely',        label: 'Address Recorded Completely',    category: 'Process Knowledge', tip: 'Confirm all address fields (pincode, landmark, floor) by reading back to the caller.' },
  { key: 'correct_and_complete_information',   label: 'Correct & Complete Information', category: 'Process Knowledge', tip: 'Verify system data before sharing — incorrect info creates repeat calls and escalations.' },
  { key: 'pronunciation_and_clarity',          label: 'Pronunciation & Clarity',        category: 'Communication',     tip: 'Speak at 80–100 wpm, enunciate product names clearly; eliminate filler words like "umm".' },
  { key: 'proper_grammar',                     label: 'Proper Grammar',                 category: 'Communication',     tip: 'Use complete sentences; avoid "yaar", "bhai", or informal fillers — maintain professional register.' },
];

const TNI_CAT_COLOR: Record<string, string> = {
  'Soft Skills':        '#F59E0B',
  'Process Knowledge':  '#A78BFA',
  'Communication':      '#34D399',
};

const SLIDES = [
  { label: 'Quality Performance', color: 'sky'     },
  { label: 'Fatal Analysis',      color: 'red'     },
  { label: 'Detail Analysis',     color: 'purple'  },
  { label: 'Repeat Analysis',     color: 'teal'    },
  { label: 'Process Analysis',    color: 'amber'   },
  { label: 'TNI Detection',       color: 'emerald' },
  { label: 'CLAP 360°',           color: 'blue'    },
] as const;

export default function InboundQualityDashboard() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { canAccessInboundClient, loaded: processLoaded } = useProcessStore();
  const now = new Date();

  useEffect(() => {
    if (processLoaded && clientId && !canAccessInboundClient(clientId)) {
      navigate('/dashboard', { replace: true });
    }
  }, [processLoaded, clientId, canAccessInboundClient, navigate]);

  const [activeSlide, setActiveSlide] = useState(0);
  const [fatalData, setFatalData] = useState<FatalAnalysis | null>(null);
  const [fatalLoading, setFatalLoading] = useState(false);
  const [detailData, setDetailData] = useState<DetailAnalysis | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [agentParamScenario, setAgentParamScenario] = useState('');
  const [agentParamData, setAgentParamData] = useState<AgentParamRow[]>([]);
  const [agentParamLoading, setAgentParamLoading] = useState(false);
  const [agentAuditBand, setAgentAuditBand] = useState<AgentAuditBandRow[]>([]);
  const [dayWiseScenario, setDayWiseScenario] = useState('');
  const [dayWiseAgent, setDayWiseAgent] = useState('');
  const [dayWiseData, setDayWiseData] = useState<DayWiseQualityRow[]>([]);
  const [dayWiseLoading, setDayWiseLoading] = useState(false);
  const [weekWiseScenario, setWeekWiseScenario] = useState('');
  const [weekWiseAgent, setWeekWiseAgent] = useState('');
  const [weekWiseData, setWeekWiseData] = useState<WeekWiseQualityRow[]>([]);
  const [weekWiseLoading, setWeekWiseLoading] = useState(false);
  const [qualityParamScenario, setQualityParamScenario] = useState('');
  const [qualityParamAgent, setQualityParamAgent] = useState('');
  const [qualityParamData, setQualityParamData] = useState<QualityParameterRow[]>([]);
  const [qualityParamLoading, setQualityParamLoading] = useState(false);
  const [repeatData, setRepeatData] = useState<RepeatAnalysis | null>(null);
  const [repeatLoading, setRepeatLoading] = useState(false);
  const [clapAnalysis, setClapAnalysis] = useState<{
    cards: { clap: string; count: number; calls: number; avgQuality: number }[];
    drills: {
      customer: { scenario: string; calls: number; pct: number; subScenarios: { name: string; calls: number; pct: number }[] }[];
      logistic: { feedbackType: string; calls: number; pct: number; reasons: { reason: string; calls: number; pct: number; avgQuality: number }[] }[];
      agent: { feedbackType: string; calls: number; pct: number; reasons: { reason: string; calls: number; pct: number; avgQuality: number }[] }[];
      product: { feedbackType: string; calls: number; pct: number; reasons: { reason: string; calls: number; pct: number; avgQuality: number }[] }[];
    };
  } | null>(null);
  const [clapLoading, setClapLoading] = useState(false);

  // ── Agent Guidance ───────────────────────────────────────────────────────
  interface GuidanceParam { column: string; label: string; pct: number; team_avg: number; category: string; }
  interface GuidanceAgent { agent_id: string; agent_name: string; audit_count: number; cq_score: number; params: GuidanceParam[]; }
  interface GuidanceResult { agents: GuidanceAgent[]; team_params: { column: string; label: string; avg: number; category: string }[]; }
  const [guidanceData, setGuidanceData] = useState<GuidanceResult | null>(null);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [expandedGuidanceAgent, setExpandedGuidanceAgent] = useState<string | null>(null);
  const [agentGuidancePopup, setAgentGuidancePopup] = useState<GuidanceAgent | null>(null);

  // ── TNI Detection ────────────────────────────────────────────────────────
  interface TNIAgentRow { agent_id: string; audit_count: number; soft_skills: number; process_knowledge: number; communication: number; tni_score: number; }
  interface TNIWeekRow  { agent_id: string; week_label: string; soft_skills: number; process_knowledge: number; communication: number; }
  interface TNISummary  { active_agents: number; total_audits: number; avg_soft_skills: number; avg_process_knowledge: number; avg_communication: number; }
  interface TNIResult   { summary: TNISummary; agents: TNIAgentRow[]; weeks: TNIWeekRow[]; }
  type TNIParamRow = Record<string, number>;
  interface TNICommentRow { agent_id: string; client_id: string; comment: string; updated_by: string; updated_at: string; }
  const [tniData,       setTniData]       = useState<TNIResult | null>(null);
  const [tniLoading,    setTniLoading]    = useState(false);
  const [tniSortBy,     setTniSortBy]     = useState<'soft_skills' | 'process_knowledge' | 'communication' | 'tni_score'>('tni_score');
  const [tniDrillAgent, setTniDrillAgent] = useState<TNIAgentRow | null>(null);
  const [tniDrillData,  setTniDrillData]  = useState<TNIParamRow | null>(null);
  const [tniDrillLoading, setTniDrillLoading] = useState(false);
  const [tniComments,   setTniComments]   = useState<Map<string, string>>(new Map());
  const [tniSavingId,   setTniSavingId]   = useState<string | null>(null);
  const [tniFormulaOpen, setTniFormulaOpen] = useState(false);

  // ── Agent Master ─────────────────────────────────────────────────────────
  const [agentMap, setAgentMap] = useState<Map<string, string>>(new Map());

  const resolveAgent = (masId: string) => agentMap.get(masId) || masId;

  const saveAgentName = async (masId: string, name: string) => {
    await api.patch(`/inbound-quality/agent-master/${encodeURIComponent(masId)}`, { agentName: name });
    setAgentMap(prev => new Map(prev).set(masId, name));
  };

  const agentTag = (masId: string, cls?: string) => (
    <AgentNameTag masId={masId} agentMap={agentMap} className={cls} onSave={saveAgentName} />
  );

  // ── CLAP Customer Product Analysis ──────────────────────────────────────
  type ClapScenWithSubs = { scenario: string; count: number; subs: { sub: string; count: number }[] };
  const [clapCustomer, setClapCustomer] = useState<{
    overall: { total: number; pos: number; neg: number };
    branches: {
      clap: string; total: number; pos: number; neg: number;
      scenarioBreakdown: ClapScenWithSubs[];
    }[];
  } | null>(null);
  const [clapCustomerLoading, setClapCustomerLoading] = useState(false);
  const [clapCustomerExpanded, setClapCustomerExpanded] = useState(false);
  const [clapActiveBranch, setClapActiveBranch] = useState<string | null>(null);
  const [clapActiveScenario, setClapActiveScenario] = useState<string | null>(null);
  const [clapVocQuotes, setClapVocQuotes] = useState<{ positive: VocQuote[]; negative: VocQuote[] } | null>(null);
  const [clapVocLoading, setClapVocLoading] = useState(false);
  const [clapProductSummary, setClapProductSummary] = useState<{ product: string; pos: number; neg: number }[] | null>(null);
  const [clapProductSummaryLoading, setClapProductSummaryLoading] = useState(false);
  const [clapActiveProductVoc, setClapActiveProductVoc] = useState<string | null>(null);
  const [clapProductQuotes, setClapProductQuotes] = useState<{ positive: VocQuote[]; negative: VocQuote[] } | null>(null);
  const [clapProductQuotesLoading, setClapProductQuotesLoading] = useState(false);

  // ── Deep analysis state ──────────────────────────────────────────────────
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [drillModal, setDrillModal] = useState<{ title: string; accent: string; rows: Record<string,unknown>[]; columns: { key: string; label: string }[] } | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);
  const [clapWordsData, setClapWordsData] = useState<{ clap: string; positive: { word: string; count: number }[]; negative: { word: string; count: number }[] }[]>([]);
  const [clapWordsLoading, setClapWordsLoading] = useState(false);
  const [activeClapWord, setActiveClapWord] = useState<string | null>(null);
  const [clapScenarioPos, setClapScenarioPos] = useState<{ scenario: string; count: number; pct: number }[] | null>(null);
  const [clapScenarioNeg, setClapScenarioNeg] = useState<{ scenario: string; count: number; pct: number }[] | null>(null);
  const [clapScenarioWords, setClapScenarioWords] = useState<{ pos: string[]; neg: string[] }>({ pos: [], neg: [] });
  const [clapWordsVisible, setClapWordsVisible] = useState<{ pos: boolean; neg: boolean }>({ pos: false, neg: false });
  const [clapScenarioLoading, setClapScenarioLoading] = useState(false);
  const [clapScenarioDrill, setClapScenarioDrill] = useState<{ type: 'pos' | 'neg'; scenario: string; subScenarios: { subScenario: string; count: number; pct: number }[]; words: string[]; wordsOpen: boolean } | null>(null);
  const [clapScenarioDrillLoading, setClapScenarioDrillLoading] = useState(false);
  const [clapDrillModal, setClapDrillModal] = useState<{
    clap: string;
    level: 'scenario' | 'sub' | 'feedback' | 'reason';
    data: { label: string; calls: number; pct: number; sub?: string; avgQuality?: number }[];
    parentLabel?: string;
  } | null>(null);
  const [kwDrill, setKwDrill] = useState<{
    open: boolean;
    loading: boolean;
    wordsOpen: boolean;
    type: 'pos' | 'neg' | 'social' | 'scam';
    pattern: string;
    keyword: string;
    color: string;
    icon: string;
    claps: { clap: string; count: number }[];
    scenarios: { scenario: string; count: number; pct: number }[];
    subScenarios: { subScenario: string; count: number; pct: number }[];
    leads: { leadId: string; agentId: string; agentName: string; callDate: string; scenario: string; scenario1: string }[];
    words: string[];
    selectedClap: string | null;
    selectedScenario: string | null;
    selectedSubScenario: string | null;
  }>({
    open: false, loading: false, wordsOpen: false, type: 'pos', pattern: '', keyword: '', color: '#3B82F6', icon: '📊',
    claps: [], scenarios: [], subScenarios: [], leads: [], words: [],
    selectedClap: null, selectedScenario: null, selectedSubScenario: null,
  });

  const openKwDrill = (type: 'pos' | 'neg' | 'social' | 'scam', pattern: string, keyword: string, color: string, icon: string) => {
    setKwDrill(prev => ({ ...prev, open: true, type, pattern, keyword, color, icon, loading: true, wordsOpen: false }));
    api.get<{ data: { claps: { clap: string; count: number }[]; words: string[] } }>(`/inbound-quality/clap-keyword-drill?type=${type}&pattern=${encodeURIComponent(pattern)}&startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
      .then(r => {
        const d = r.data?.data;
        setKwDrill(prev => ({ ...prev, claps: d?.claps ?? [], words: d?.words ?? [], scenarios: [], subScenarios: [], leads: [], loading: false, selectedClap: null, selectedScenario: null, selectedSubScenario: null, wordsOpen: false }));
      })
      .catch(() => setKwDrill(prev => ({ ...prev, claps: [], loading: false, wordsOpen: false })));
  };

  const drillKwLevel = (level: 'clap' | 'scenario' | 'sub', value: string) => {
    setKwDrill(prev => {
      const clap = level === 'clap' ? value : prev.selectedClap ?? undefined;
      // Switching CLAP resets scenario/sub — never carry them over
      const scenario = level === 'scenario' ? value : (level === 'clap' ? undefined : prev.selectedScenario ?? undefined);
      const subScenario = level === 'sub' ? value : undefined;
      let url = `/inbound-quality/clap-keyword-drill?type=${prev.type}&pattern=${encodeURIComponent(prev.pattern)}&startDate=${sd}&endDate=${ed}&clientId=${clientId}`;
      if (clap) url += `&clap=${encodeURIComponent(clap)}`;
      if (scenario) url += `&scenario=${encodeURIComponent(scenario)}`;
      if (subScenario) url += `&subScenario=${encodeURIComponent(subScenario)}`;
      api.get<{ data: { claps: { clap: string; count: number }[]; scenarios: { scenario: string; count: number; pct: number }[]; subScenarios: { subScenario: string; count: number; pct: number }[]; leads: { leadId: string; agentId: string; agentName: string; callDate: string; scenario: string; scenario1: string }[]; words: string[] } }>(url)
        .then(r => {
          const d = r.data?.data;
          setKwDrill(p => ({
            ...p,
            claps: d?.claps ?? p.claps,
            scenarios: level === 'clap' ? (d?.scenarios ?? []) : p.scenarios,
            subScenarios: level === 'clap' ? [] : (level === 'scenario' ? (d?.subScenarios ?? []) : p.subScenarios),
            leads: level === 'sub' ? (d?.leads ?? []) : [],
            selectedClap: level === 'clap' ? value : p.selectedClap,
            selectedScenario: level === 'clap' ? null : (level === 'scenario' ? value : p.selectedScenario),
            selectedSubScenario: level === 'sub' ? value : null,
            loading: false,
          }));
        })
        .catch(() => setKwDrill(p => ({ ...p, loading: false })));
      return { ...prev, loading: true };
    });
  };

  const loadClapScenario = async (clap: string) => {
    setClapScenarioPos(null);
    setClapScenarioNeg(null);
    setClapScenarioDrill(null);
    setClapScenarioLoading(true);
    try {
      const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}&clap=${encodeURIComponent(clap)}`;
      const [posRes, negRes] = await Promise.all([
        api.get<{ data: { scenarios: { scenario: string; count: number; pct: number }[]; words: string[] } }>(`/inbound-quality/clap-keyword-drill?type=pos&${q}`),
        api.get<{ data: { scenarios: { scenario: string; count: number; pct: number }[]; words: string[] } }>(`/inbound-quality/clap-keyword-drill?type=neg&${q}`),
      ]);
      setClapScenarioPos(posRes.data?.data?.scenarios ?? []);
      setClapScenarioNeg(negRes.data?.data?.scenarios ?? []);
      setClapScenarioWords({ pos: posRes.data?.data?.words ?? [], neg: negRes.data?.data?.words ?? [] });
    } catch {
      setClapScenarioPos([]);
      setClapScenarioNeg([]);
    } finally {
      setClapScenarioLoading(false);
    }
  };

  const toggleExpand = (key: string) => setExpandedSection(prev => prev === key ? null : key);

  const [startDate, setStartDate] = useState(
    toLocalDT(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0))
  );
  const [endDate, setEndDate] = useState(toLocalDT(now));
  const [kpis, setKpis]               = useState<InboundProcessKPIs | null>(null);
  const [loading, setLoading]         = useState(true);
  const [performers, setPerformers]       = useState<TopPerformer[]>([]);
  const [dailyScores, setDailyScores]     = useState<DailyScore[]>([]);
  const [scenarios, setScenarios]             = useState<ScenarioItem[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [socialThreats, setSocialThreats]         = useState<AlertScenarioRow[]>([]);
  const [negSignalDetails, setNegSignalDetails]   = useState<NegSignalDetailRow[]>([]);
  const [posSignals, setPosSignals]               = useState<PosKeywordRow[]>([]);
  const [potentialScams, setPotentialScams]       = useState<AlertScenarioRow[]>([]);
  const [sensitiveWordAnalysis, setSensitiveWordAnalysis] = useState<SensitiveWordAnalysis | null>(null);
  const [scamDetailOpen,  setScamDetailOpen]  = useState(false);
  const [scamDetail,      setScamDetail]      = useState<PotentialScamDetail | null>(null);
  const [scamDetailLoading, setScamDetailLoading] = useState(false);

  const [abuseDetailOpen,    setAbuseDetailOpen]    = useState(false);
  const [abuseDetail,        setAbuseDetail]        = useState<AbuseDetailResponse | null>(null);
  const [abuseDetailLoading, setAbuseDetailLoading] = useState(false);

  const [threatDetailOpen,    setThreatDetailOpen]    = useState(false);
  const [threatDetail,        setThreatDetail]        = useState<NegSignalDetailCallResponse | null>(null);
  const [threatDetailLoading, setThreatDetailLoading] = useState(false);

  const [frustDetailOpen,    setFrustDetailOpen]    = useState(false);
  const [frustDetail,        setFrustDetail]        = useState<NegSignalDetailCallResponse | null>(null);
  const [frustDetailLoading, setFrustDetailLoading] = useState(false);

  const [socialThreatOpen,    setSocialThreatOpen]    = useState(false);
  const [socialThreatDetail,  setSocialThreatDetail]  = useState<SocialThreatDetailResponse | null>(null);
  const [socialThreatLoading, setSocialThreatLoading] = useState(false);

  // Transcript
  const [transcriptLeadId, setTranscriptLeadId] = useState<string | null>(null);
  const [transcriptData,   setTranscriptData]   = useState<TranscriptData | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  // Fatal calls modal
  const [fatalModalOpen,    setFatalModalOpen]    = useState(false);
  const [fatalCalls,        setFatalCalls]        = useState<FatalCallItem[]>([]);
  const [fatalCallsLoading, setFatalCallsLoading] = useState(false);
  const [fatalTranscriptItem, setFatalTranscriptItem] = useState<FatalCallItem | null>(null);
  const [fatalTranscriptData, setFatalTranscriptData] = useState<TranscriptData | null>(null);
  const [fatalTranscriptLoading, setFatalTranscriptLoading] = useState(false);

  // Agent Calls drill-down
  const [agentCallsModal, setAgentCallsModal] = useState<{ open: boolean; agent: string; calls: FatalCallItem[]; loading: boolean }>({ open: false, agent: '', calls: [], loading: false });

  // Positive signal detail modal
  const [posModalOpen,    setPosModalOpen]    = useState(false);
  const [posModalKeyword, setPosModalKeyword] = useState('');
  const [posModalColor,   setPosModalColor]   = useState('#10B981');
  const [posModalPhrases, setPosModalPhrases] = useState<Array<{ source: string; phrase: string; count: number }>>([]);
  const [posModalPhrasesLoading, setPosModalPhrasesLoading] = useState(false);
  const [posModalLeads,  setPosModalLeads]   = useState<PosKeywordLeadRow[]>([]);
  const [posModalLeadsLoading, setPosModalLeadsLoading] = useState(false);

  // Golden Words category drill-down modal
  const [catDrill, setCatDrill] = useState<{ open: boolean; title: string; accent: string; leads: PosKeywordLeadRow[]; loading: boolean }>({ open: false, title: '', accent: '#10B981', leads: [], loading: false });

  // Score Component detail modal
  const [scoreCompModal, setScoreCompModal] = useState<{ label: string; accent: string; key: keyof ScoreComponentData } | null>(null);
  const [scoreCompData, setScoreCompData] = useState<ScoreComponentData | null>(null);
  const [scoreCompLoading, setScoreCompLoading] = useState(false);

  const sd = startDate.replace('T', ' ');
  const ed = endDate.replace('T', ' ');

  // Lazily fetch VOC quotes when the Agent or Logistic branch is opened (Product uses its own product-grouped flow below)
  useEffect(() => {
    if (clapActiveBranch !== 'Agent' && clapActiveBranch !== 'Logistic') { setClapVocQuotes(null); return; }
    setClapVocLoading(true);
    api.get<{ data: { positive: VocQuote[]; negative: VocQuote[] } }>(
      `/inbound-quality/clap-voc-quotes?clap=${clapActiveBranch}&clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setClapVocQuotes(r.data?.data ?? { positive: [], negative: [] }))
      .catch(() => setClapVocQuotes({ positive: [], negative: [] }))
      .finally(() => setClapVocLoading(false));
  }, [clapActiveBranch, clientId, sd, ed]);

  // Product branch: fetch the per-product Positive/Negative summary when opened
  useEffect(() => {
    if (clapActiveBranch !== 'Product') { setClapProductSummary(null); setClapActiveProductVoc(null); return; }
    setClapProductSummaryLoading(true);
    api.get<{ data: { products: { product: string; pos: number; neg: number }[] } }>(
      `/inbound-quality/clap-product-voc-summary?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setClapProductSummary(r.data?.data?.products ?? []))
      .catch(() => setClapProductSummary([]))
      .finally(() => setClapProductSummaryLoading(false));
  }, [clapActiveBranch, clientId, sd, ed]);

  // Product branch: fetch the full VOC quotes for the selected product
  useEffect(() => {
    if (!clapActiveProductVoc) { setClapProductQuotes(null); return; }
    setClapProductQuotesLoading(true);
    api.get<{ data: { positive: VocQuote[]; negative: VocQuote[] } }>(
      `/inbound-quality/clap-product-voc-quotes?product=${encodeURIComponent(clapActiveProductVoc)}&clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setClapProductQuotes(r.data?.data ?? { positive: [], negative: [] }))
      .catch(() => setClapProductQuotes({ positive: [], negative: [] }))
      .finally(() => setClapProductQuotesLoading(false));
  }, [clapActiveProductVoc, clientId, sd, ed]);

  // Reset detail caches when date range changes
  useEffect(() => {
    setScamDetail(null);
    setAbuseDetail(null);
    setThreatDetail(null);
    setFrustDetail(null);
    setSocialThreatDetail(null);
    setFatalCalls([]);
  }, [sd, ed]);

  const handleLeadClick = useCallback((leadId: string) => {
    if (!leadId || leadId === '—') return;
    setTranscriptLeadId(leadId);
    setTranscriptData(null);
    setTranscriptLoading(true);
    api.get<{ data: TranscriptData | null }>(`/inbound-quality/transcript?leadId=${encodeURIComponent(leadId)}`)
      .then(r => setTranscriptData(r.data?.data ?? null))
      .catch(() => setTranscriptData(null))
      .finally(() => setTranscriptLoading(false));
  }, []);

  const openFatalModal = () => {
    setFatalModalOpen(true);
    if (fatalCalls.length === 0) {
      setFatalCallsLoading(true);
      const clientParam = clientId ? `&clientId=${clientId}` : '';
      api.get<{ data: FatalCallItem[] }>(`/inbound-quality/fatal-calls-list?startDate=${sd}&endDate=${ed}${clientParam}`)
        .then(r => setFatalCalls(r.data?.data ?? []))
        .catch(() => setFatalCalls([]))
        .finally(() => setFatalCallsLoading(false));
    }
  };

  const openFatalTranscript = (item: FatalCallItem) => {
    setFatalTranscriptItem(item);
    setFatalTranscriptData(null);
    setFatalTranscriptLoading(true);
    api.get<{ data: TranscriptData | null }>(`/inbound-quality/transcript?leadId=${encodeURIComponent(item.lead_id)}`)
      .then(r => setFatalTranscriptData(r.data?.data ?? null))
      .catch(() => setFatalTranscriptData(null))
      .finally(() => setFatalTranscriptLoading(false));
  };

  const openBandDetail = async (band: string, title: string, accent: string, agentId?: string) => {
    const cols = agentId
      ? [
          { key: 'Scenario',    label: 'Scenario' },
          { key: 'Count',       label: 'Count' },
          { key: 'Avg Score%',  label: 'Avg Score%' },
        ]
      : [
          { key: 'Agent',       label: 'Agent' },
          { key: 'Scenario',    label: 'Scenario' },
          { key: 'Count',       label: 'Count' },
          { key: 'Avg Score%',  label: 'Avg Score%' },
        ];
    setDrillModal({ title, accent, rows: [], columns: cols });
    setDrillLoading(true);
    try {
      const agentParam = agentId ? `&agentId=${encodeURIComponent(agentId)}` : '';
      const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}&band=${band}${agentParam}`;
      const { data } = await api.get<{ data: { agent: string; scenario: string; count: number; avg_score: number }[] }>(
        `/inbound-quality/band-detail?${q}`
      );
      setDrillModal({ title, accent, columns: cols, rows: data.data.map(r => ({
        ...(agentId ? {} : { Agent: resolveAgent(r.agent) }),
        Scenario:     r.scenario,
        Count:        r.count,
        'Avg Score%': `${r.avg_score}%`,
      })) });
    } catch {
      setDrillModal(prev => prev ? { ...prev, rows: [] } : null);
    } finally {
      setDrillLoading(false);
    }
  };

  const fetchKPIs = useCallback(() => {
    setLoading(true);
    api.get<{ data: InboundProcessKPIs }>(
      `/inbound-quality/kpis?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setKpis(r.data?.data ?? null))
      .catch(() => setKpis(null))
      .finally(() => setLoading(false));
  }, [clientId, sd, ed]);

  const fetchPerformers = useCallback(() => {
    api.get<{ data: TopPerformer[] }>(
      `/inbound-quality/top-performers?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setPerformers(r.data?.data ?? []))
      .catch(() => setPerformers([]));
  }, [clientId, sd, ed]);

  const fetchDailyScores = useCallback(() => {
    api.get<{ data: DailyScore[] }>(
      `/inbound-quality/daily-scores?clientId=${clientId}&endDate=${ed}`
    )
      .then(r => setDailyScores(r.data?.data ?? []))
      .catch(() => setDailyScores([]));
  }, [clientId, ed]);

  const fetchScenarios = useCallback(() => {
    api.get<{ data: ScenarioItem[] }>(
      `/inbound-quality/scenarios?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => { setScenarios(r.data?.data ?? []); setSelectedScenario(null); })
      .catch(() => setScenarios([]));
  }, [clientId, sd, ed]);

  const fetchFatalAnalysis = useCallback(() => {
    setFatalLoading(true);
    api.get<{ data: FatalAnalysis }>(
      `/inbound-quality/fatal-analysis?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setFatalData(r.data?.data ?? null))
      .catch(() => setFatalData(null))
      .finally(() => setFatalLoading(false));
  }, [clientId, sd, ed]);

  const fetchDetailAnalysis = useCallback(() => {
    setDetailLoading(true);
    api.get<{ data: DetailAnalysis }>(
      `/inbound-quality/detail-analysis?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setDetailData(r.data?.data ?? null))
      .catch(() => setDetailData(null))
      .finally(() => setDetailLoading(false));
  }, [clientId, sd, ed]);

  const fetchAgentParam = useCallback(() => {
    setAgentParamLoading(true);
    const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}${agentParamScenario ? `&scenario=${encodeURIComponent(agentParamScenario)}` : ''}`;
    api.get<{ data: AgentParamRow[] }>(`/inbound-quality/agent-param?${q}`)
      .then(r => setAgentParamData(r.data?.data ?? []))
      .catch(() => setAgentParamData([]))
      .finally(() => setAgentParamLoading(false));
  }, [clientId, sd, ed, agentParamScenario]);

  const fetchDayWiseQuality = useCallback(() => {
    setDayWiseLoading(true);
    const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}${dayWiseScenario ? `&scenario=${encodeURIComponent(dayWiseScenario)}` : ''}${dayWiseAgent ? `&agentName=${encodeURIComponent(dayWiseAgent)}` : ''}`;
    api.get<{ data: DayWiseQualityRow[] }>(`/inbound-quality/day-wise-quality?${q}`)
      .then(r => setDayWiseData(r.data?.data ?? []))
      .catch(() => setDayWiseData([]))
      .finally(() => setDayWiseLoading(false));
  }, [clientId, sd, ed, dayWiseScenario, dayWiseAgent]);

  const fetchWeekWiseQuality = useCallback(() => {
    setWeekWiseLoading(true);
    const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}${weekWiseScenario ? `&scenario=${encodeURIComponent(weekWiseScenario)}` : ''}${weekWiseAgent ? `&agentName=${encodeURIComponent(weekWiseAgent)}` : ''}`;
    api.get<{ data: WeekWiseQualityRow[] }>(`/inbound-quality/week-wise-quality?${q}`)
      .then(r => setWeekWiseData(r.data?.data ?? []))
      .catch(() => setWeekWiseData([]))
      .finally(() => setWeekWiseLoading(false));
  }, [clientId, sd, ed, weekWiseScenario, weekWiseAgent]);

  const fetchQualityParameters = useCallback(() => {
    setQualityParamLoading(true);
    const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}${qualityParamScenario ? `&scenario=${encodeURIComponent(qualityParamScenario)}` : ''}${qualityParamAgent ? `&agentName=${encodeURIComponent(qualityParamAgent)}` : ''}`;
    api.get<{ data: QualityParameterRow[] }>(`/inbound-quality/quality-parameters?${q}`)
      .then(r => setQualityParamData(r.data?.data ?? []))
      .catch(() => setQualityParamData([]))
      .finally(() => setQualityParamLoading(false));
  }, [clientId, sd, ed, qualityParamScenario, qualityParamAgent]);

  const fetchRepeatAnalysis = useCallback(() => {
    setRepeatLoading(true);
    api.get<{ data: RepeatAnalysis }>(
      `/inbound-quality/repeat-analysis?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setRepeatData(r.data?.data ?? null))
      .catch(() => setRepeatData(null))
      .finally(() => setRepeatLoading(false));
  }, [clientId, sd, ed]);

  const fetchClapAnalysis = useCallback(() => {
    setClapLoading(true);
    api.get<{ data: typeof clapAnalysis }>(
      `/quality/clap-analysis?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setClapAnalysis(r.data?.data ?? null))
      .catch(() => setClapAnalysis(null))
      .finally(() => setClapLoading(false));
  }, [clientId, sd, ed]);

  const fetchTNI = useCallback(() => {
    setTniLoading(true);
    api.get<{ data: TNIResult }>(
      `/inbound-quality/tni-analysis?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    )
      .then(r => setTniData(r.data?.data ?? null))
      .catch(() => setTniData(null))
      .finally(() => setTniLoading(false));
    // load comments (not date-scoped)
    api.get<{ data: TNICommentRow[] }>(`/inbound-quality/tni-comments?clientId=${clientId}`)
      .then(r => {
        const m = new Map<string, string>();
        (r.data?.data ?? []).forEach(c => m.set(c.agent_id, c.comment));
        setTniComments(m);
      })
      .catch(() => {});
  }, [clientId, sd, ed]);

  // Fetch agent master once (not dependent on date/client — whole table)
  useEffect(() => {
    api.get<{ data: AgentMasterRow[] }>('/inbound-quality/agent-master')
      .then(r => {
        const map = new Map<string, string>();
        (r.data?.data ?? []).forEach(a => map.set(a.masId, a.agentName));
        setAgentMap(map);
      })
      .catch(() => {});
  }, []);

  const fetchAlertTables = useCallback(() => {
    const q = `clientId=${clientId}&startDate=${sd}&endDate=${ed}`;
    api.get<{ data: AlertScenarioRow[] }>(`/inbound-quality/social-media-threats?${q}`)
      .then(r => setSocialThreats(r.data?.data ?? [])).catch(() => setSocialThreats([]));
    api.get<{ data: NegSignalDetailRow[] }>(`/inbound-quality/neg-signal-details?${q}`)
      .then(r => setNegSignalDetails(r.data?.data ?? [])).catch(() => setNegSignalDetails([]));
    api.get<{ data: PosKeywordRow[] }>(`/inbound-quality/pos-signal-details?${q}`)
      .then(r => setPosSignals(r.data?.data ?? [])).catch(() => setPosSignals([]));
    api.get<{ data: AlertScenarioRow[] }>(`/inbound-quality/potential-scams?${q}`)
      .then(r => setPotentialScams(r.data?.data ?? [])).catch(() => setPotentialScams([]));
    api.get<{ data: SensitiveWordAnalysis }>(`/inbound-quality/sensitive-word-analysis?${q}`)
      .then(r => setSensitiveWordAnalysis(r.data?.data ?? null)).catch(() => setSensitiveWordAnalysis(null));
  }, [clientId, sd, ed]);

  useEffect(() => {
    fetchKPIs();
    fetchPerformers();
    fetchDailyScores();
    fetchScenarios();
    fetchAlertTables();
    fetchFatalAnalysis();
    fetchDetailAnalysis();
    fetchRepeatAnalysis();
    fetchClapAnalysis();
    setClapWordsLoading(true);
    api.get<{ data: { claps: { clap: string; positive: { word: string; count: number }[]; negative: { word: string; count: number }[] }[] } }>(`/inbound-quality/clap-words?clientId=${clientId}&startDate=${sd}&endDate=${ed}`)
      .then(r => setClapWordsData(r.data?.data?.claps ?? []))
      .catch(() => setClapWordsData([]))
      .finally(() => setClapWordsLoading(false));
    // CLAP Customer product analysis
    setClapCustomerLoading(true);
    setClapCustomerExpanded(false);
    setClapActiveBranch(null);
    setClapActiveScenario(null);
    api.get<{ data: typeof clapCustomer }>(`/inbound-quality/clap-customer-analysis?clientId=${clientId}&startDate=${sd}&endDate=${ed}`)
      .then(r => setClapCustomer(r.data?.data ?? null))
      .catch(() => setClapCustomer(null))
      .finally(() => setClapCustomerLoading(false));
    // Agent audit band for Quality Performance slide
    api.get<{ data: AgentAuditBandRow[] }>(
      `/inbound-quality/agent-audit-band?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
    ).then(r => setAgentAuditBand(r.data?.data ?? [])).catch(() => setAgentAuditBand([]));
    // Agent guidance for Process Analysis slide
    setGuidanceLoading(true);
    api.get<{ data: GuidanceResult }>(`/inbound-quality/agent-guidance?clientId=${clientId}&startDate=${sd}&endDate=${ed}`)
      .then(r => setGuidanceData(r.data?.data ?? null))
      .catch(() => setGuidanceData(null))
      .finally(() => setGuidanceLoading(false));
    // TNI Detection slide
    fetchTNI();
  }, [fetchKPIs, fetchPerformers, fetchDailyScores, fetchScenarios, fetchAlertTables, fetchFatalAnalysis, fetchDetailAnalysis, fetchRepeatAnalysis, fetchClapAnalysis, fetchTNI, clientId, sd, ed]);

  useEffect(() => { fetchAgentParam(); }, [fetchAgentParam]);
  useEffect(() => { fetchDayWiseQuality(); }, [fetchDayWiseQuality]);
  useEffect(() => { fetchWeekWiseQuality(); }, [fetchWeekWiseQuality]);
  useEffect(() => { fetchQualityParameters(); }, [fetchQualityParameters]);

  const clientName = kpis?.client_name || `Client ${clientId}`;
  const total = kpis?.audit_count ?? 0;

  const pct = (n: number) => total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—';

  return (
    <div className="min-h-screen text-slate-900 flex flex-col">

      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/quality')}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-900 transition-colors text-xs">
            <ChevronLeft size={16} /> AI Quality
          </button>
          <div className="w-px h-4 bg-slate-700" />
          <Phone size={14} className="text-sky-400 shrink-0" />
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-none">Inbound Quality · {clientName}</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">Quality audit performance</p>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 w-full">

        {/* Date filter */}
        <div className="filter-bar mb-6">
          <label className="text-label">From</label>
          <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500" />
          <label className="text-label">To</label>
          <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-500" />
          <button
            onClick={async () => {
              setDrillLoading(true);
              try {
                const { data } = await api.get<{ data: Record<string, string | number>[] }>(
                  `/inbound-quality/raw-data?clientId=${clientId}&startDate=${sd}&endDate=${ed}`
                );
                const rows = data.data;
                if (!rows.length) { alert('No data found for selected period.'); return; }
                const cols = Object.keys(rows[0]);
                const header = cols.join(',');
                const body = rows.map(r =>
                  cols.map(k => {
                    const v = String(r[k] ?? '');
                    return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
                  }).join(',')
                ).join('\n');
                const csv = `${header}\n${body}`;
                const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const clientLabel = clientId || 'ALL';
                const dateFrom = sd.slice(0, 10);
                const dateTo = ed.slice(0, 10);
                a.href = url;
                a.download = `raw-data-${clientLabel}-${dateFrom}-to-${dateTo}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              } catch { alert('Failed to export raw data. Please try again.'); }
              finally { setDrillLoading(false); }
            }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-colors">
            {drillLoading ? <span className="animate-spin w-3 h-3 border border-emerald-400 border-t-transparent rounded-full inline-block" /> : <Download size={12} />}
            Export Raw Data
          </button>
        </div>



        {/* Slide tabs */}
        <div className="pill-tabs mb-6">
          {SLIDES.map((s, i) => (
            <button key={s.label}
              onClick={() => setActiveSlide(i)}
              className={`pill-tab ${activeSlide === i ? 'pill-tab-active' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Quality Performance slide */}
        {activeSlide === 0 && (
          <>
            {/* KPI metric cards — 7 in a row — click to drill */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
              <div className="cursor-pointer" title="Click for detailed breakdown"
                onClick={() => kpis && setDrillModal({ title: 'Quality Score Distribution — Detail', accent: cqColor(kpis.cq_score), columns: [{ key: 'Category', label: 'Category' }, { key: 'Count', label: 'Count' }, { key: 'Pct', label: '%' }, { key: 'Score Range', label: 'Score Range' }], rows: [{ Category: 'Excellent', Count: kpis.excellent, Pct: `${pct(kpis.excellent)}`, 'Score Range': '98–100%' }, { Category: 'Good', Count: kpis.good, Pct: `${pct(kpis.good)}`, 'Score Range': '90–97%' }, { Category: 'Average', Count: kpis.average_count, Pct: `${pct(kpis.average_count)}`, 'Score Range': '85–89%' }, { Category: 'Below Average', Count: kpis.below_average, Pct: `${pct(kpis.below_average)}`, 'Score Range': '<85%' }, { Category: 'Fatal (Score=0)', Count: kpis.fatal_count, Pct: `${pct(kpis.fatal_count)}`, 'Score Range': '0%' }] })}>
              <MetricCard
                label="CQ Score%"
                value={loading ? '—' : `${kpis?.cq_score ?? 0}%`}
                subValue="Click for breakdown"
                icon={Star}
                accentColor={cqColor(kpis?.cq_score ?? 0)}
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click for breakdown excluding fatal calls"
                onClick={() => openBandDetail('no_fatal', 'W/O Fatal — Agent & Scenario Breakdown', '#38BDF8')}>
              <MetricCard
                label="W/O Fatal CQ Score%"
                value={loading ? '—' : kpis?.cq_score_no_fatal ? `${kpis.cq_score_no_fatal}%` : 'No data'}
                subValue="Click for breakdown"
                icon={TrendingUp}
                accentColor="#38BDF8"
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click to see score components breakdown"
                onClick={() => kpis && setDrillModal({ title: 'Score Components — Parameter Breakdown', accent: '#A78BFA', columns: [{ key: 'Parameter', label: 'Parameter' }, { key: 'Score%', label: 'Score%' }, { key: 'Status', label: 'Status' }], rows: [{ Parameter: 'Opening Skill', 'Score%': `${kpis.opening_skill}%`, Status: kpis.opening_skill >= 90 ? '✅ On Target' : kpis.opening_skill >= 85 ? '⚠️ Amber' : '❌ Below Target' }, { Parameter: 'Soft Skill', 'Score%': `${kpis.soft_skill}%`, Status: kpis.soft_skill >= 90 ? '✅ On Target' : kpis.soft_skill >= 85 ? '⚠️ Amber' : '❌ Below Target' }, { Parameter: 'Hold Procedure', 'Score%': `${kpis.hold_procedure}%`, Status: kpis.hold_procedure >= 90 ? '✅ On Target' : kpis.hold_procedure >= 85 ? '⚠️ Amber' : '❌ Below Target' }, { Parameter: 'Resolution', 'Score%': `${kpis.resolution}%`, Status: kpis.resolution >= 90 ? '✅ On Target' : kpis.resolution >= 85 ? '⚠️ Amber' : '❌ Below Target' }, { Parameter: 'Closing', 'Score%': `${kpis.closing}%`, Status: kpis.closing >= 90 ? '✅ On Target' : kpis.closing >= 85 ? '⚠️ Amber' : '❌ Below Target' }] })}>
              <MetricCard
                label="Audit Count"
                value={loading ? '—' : total.toLocaleString()}
                subValue="Click for score breakdown"
                icon={ClipboardCheck}
                accentColor="#A78BFA"
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click for Excellent call breakdown"
                onClick={() => openBandDetail('excellent', 'Excellent Calls — Agent & Scenario Breakdown (98–100%)', '#22C55E')}>
              <MetricCard
                label="Excellent Call"
                value={loading ? '—' : (kpis?.excellent ?? 0).toLocaleString()}
                subValue={loading ? '' : `${pct(kpis?.excellent ?? 0)} · Click to drill`}
                icon={ThumbsUp}
                accentColor="#22C55E"
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click for Good call breakdown"
                onClick={() => openBandDetail('good', 'Good Calls — Agent & Scenario Breakdown (90–97%)', '#3B82F6')}>
              <MetricCard
                label="Good Call"
                value={loading ? '—' : (kpis?.good ?? 0).toLocaleString()}
                subValue={loading ? '' : `${pct(kpis?.good ?? 0)} · Click to drill`}
                icon={ThumbsUp}
                accentColor="#3B82F6"
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click for Average call breakdown"
                onClick={() => openBandDetail('average', 'Average Calls — Agent & Scenario Breakdown (85–89%)', '#F59E0B')}>
              <MetricCard
                label="Average Call"
                value={loading ? '—' : (kpis?.average_count ?? 0).toLocaleString()}
                subValue={loading ? '' : `${pct(kpis?.average_count ?? 0)} · Click to drill`}
                icon={Minus}
                accentColor="#F59E0B"
                loading={loading}
              />
              </div>
              <div className="cursor-pointer" title="Click for Below Average breakdown"
                onClick={() => openBandDetail('below_average', 'Below Average Calls — Agent & Scenario Breakdown (<85%)', '#EF4444')}>
              <MetricCard
                label="Below Average"
                value={loading ? '—' : (kpis?.below_average ?? 0).toLocaleString()}
                subValue={loading ? '' : `${pct(kpis?.below_average ?? 0)} · Click to drill`}
                icon={ThumbsDown}
                accentColor="#EF4444"
                loading={loading}
              />
              </div>
            </div>

            {/* Score Components + ACHT Categorization — side by side below KPI cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

              {/* Score Components — LEFT */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 card-header gap-2 px-5 py-3">
                  <div className="w-1 h-4 rounded-full bg-violet-500" />
                  <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Score Components</h3>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Opening Skill',  value: kpis?.opening_skill  ?? 0, key: 'opening_skill'  as const, accent: '#0EA5E9' },
                    { label: 'Soft Skill',     value: kpis?.soft_skill     ?? 0, key: 'soft_skill'     as const, accent: '#8B5CF6' },
                    { label: 'Hold Procedure', value: kpis?.hold_procedure ?? 0, key: 'hold_procedure' as const, accent: '#F59E0B' },
                    { label: 'Resolution',     value: kpis?.resolution     ?? 0, key: 'resolution'     as const, accent: '#14B8A6' },
                    { label: 'Closing',        value: kpis?.closing        ?? 0, key: 'closing'        as const, accent: '#EC4899' },
                    { label: 'Avg Score',      value: kpis?.avg_score      ?? 0, key: null,                      accent: '#8B5CF6' },
                  ].map(({ label, value, key, accent }) => {
                    const isAvg = key === null;
                    const color = value >= 90 ? '#22C55E' : value >= 85 ? '#F59E0B' : value > 0 ? '#EF4444' : '#64748B';
                    return (
                      <div key={label}
                        onClick={() => {
                          if (isAvg) return;
                          setScoreCompModal({ label, accent, key: key! });
                          if (!scoreCompData) {
                            setScoreCompLoading(true);
                            const clientParam = clientId ? `&clientId=${clientId}` : '';
                            api.get<{ data: ScoreComponentData }>(
                              `/inbound-quality/score-component-detail?startDate=${sd}&endDate=${ed}${clientParam}`
                            ).then(r => setScoreCompData(r.data?.data ?? null))
                              .catch(() => setScoreCompData(null))
                              .finally(() => setScoreCompLoading(false));
                          }
                        }}
                        className={`relative flex flex-col items-center justify-center gap-1.5 rounded-xl border py-4 px-3 overflow-hidden transition-all ${
                          isAvg
                            ? 'border-violet-500/30 bg-violet-500/5 cursor-default'
                            : 'border-slate-200 bg-white cursor-pointer hover:shadow-md hover:-translate-y-0.5'
                        }`}>
                        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ backgroundColor: isAvg ? '#8B5CF6' : color }} />
                        {loading ? (
                          <div className="h-7 w-14 bg-slate-100 rounded animate-pulse" />
                        ) : (
                          <span className="text-2xl font-bold tabular-nums" style={{ color: isAvg ? '#A78BFA' : color }}>
                            {value}%
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold uppercase tracking-widest text-center leading-tight ${isAvg ? 'text-violet-400' : 'text-slate-600'}`}>
                          {label}
                        </span>
                        {!isAvg && !loading && (
                          <span className="text-[9px] text-slate-400 font-medium">Click for detail</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ACHT Categorization — RIGHT */}
              {!loading && kpis && kpis.acht_data.length > 0 ? (() => {
                const grandTotal    = kpis.acht_data.reduce((s, r) => s + r.audit_count, 0);
                const grandFatal    = kpis.acht_data.reduce((s, r) => s + r.fatal_count, 0);
                const grandScoreAvg = grandTotal > 0
                  ? kpis.acht_data.reduce((s, r) => s + r.score_pct * r.audit_count, 0) / grandTotal
                  : 0;
                const grandFatalPct = grandTotal > 0 ? (grandFatal / grandTotal) * 100 : 0;
                return (
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 card-header gap-2 px-5 py-3">
                      <div className="w-1 h-4 rounded-full bg-amber-500" />
                      <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">ACHT Categorization</h3>
                      <ExportBtn onClick={() => { const AL: Record<string,string> = { 'Short(<1min)': '< 1 min (Short)', 'Average(1min-5min)': 'Average (1-5 min)', 'Long(5min-10min)': 'Long (5-10 min)', 'Extremely Long(>10min)': 'Extremely Long (>10 min)' }; kpis && downloadCSV(kpis.acht_data.map(r => ({ Category: AL[r.category]??r.category, 'Audit Count': r.audit_count, 'Score%': r.score_pct, 'Fatal Count': r.fatal_count, 'Fatal%': r.fatal_pct })), 'acht-categorization.csv'); }} />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            {['ACHT Categorization', 'Audit Count', 'Score%', 'Fatal Count', 'Fatal%'].map(h => (
                              <th key={h} className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {kpis.acht_data.map((row, i) => {
                            const ACHT_LABELS: Record<string, string> = {
                              'Short(<1min)':           '< 1 min (Short)',
                              'Average(1min-5min)':     'Average (1–5 min)',
                              'Long(5min-10min)':       'Long (5–10 min)',
                              'Extremely Long(>10min)': 'Extremely Long (> 10 min)',
                            };
                            const label = ACHT_LABELS[row.category] ?? row.category;
                            return (
                            <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 ${i % 2 === 0 ? '' : 'bg-transparent'}`}>
                              <td className="py-2.5 px-4 text-slate-700 font-medium">{label}</td>
                              <td className="py-2.5 px-4 text-slate-600 tabular-nums">{row.audit_count.toLocaleString()}</td>
                              <td className="py-2.5 px-4 tabular-nums">
                                <span className="font-semibold" style={{
                                  color: row.score_pct >= 90 ? '#22C55E' : row.score_pct >= 85 ? '#F59E0B' : row.score_pct > 0 ? '#EF4444' : '#64748B'
                                }}>
                                  {row.score_pct > 0 ? `${row.score_pct}%` : '0%'}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 tabular-nums">{row.fatal_count.toLocaleString()}</td>
                              <td className="py-2.5 px-4 tabular-nums">
                                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
                                  style={{
                                    backgroundColor: row.fatal_pct >= 50 ? '#EF444430' : row.fatal_pct > 0 ? '#F59E0B20' : '#22C55E15',
                                    color:           row.fatal_pct >= 50 ? '#EF4444'   : row.fatal_pct > 0 ? '#F59E0B'   : '#22C55E',
                                  }}>
                                  {row.fatal_pct.toFixed(1)}%
                                </span>
                              </td>
                            </tr>
                          );})}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-200 bg-white">
                            <td className="py-2.5 px-4 font-bold text-slate-700">Grand Total</td>
                            <td className="py-2.5 px-4 font-bold text-slate-900 tabular-nums">{grandTotal.toLocaleString()}</td>
                            <td className="py-2.5 px-4 font-bold tabular-nums" style={{
                              color: grandScoreAvg >= 90 ? '#22C55E' : grandScoreAvg >= 85 ? '#F59E0B' : '#EF4444'
                            }}>
                              {grandScoreAvg > 0 ? `${grandScoreAvg.toFixed(1)}%` : '0%'}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-900 tabular-nums">{grandFatal.toLocaleString()}</td>
                            <td className="py-2.5 px-4 font-bold tabular-nums">
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold"
                                style={{
                                  backgroundColor: grandFatalPct >= 50 ? '#EF444430' : grandFatalPct > 0 ? '#F59E0B20' : '#22C55E15',
                                  color:           grandFatalPct >= 50 ? '#EF4444'   : grandFatalPct > 0 ? '#F59E0B'   : '#22C55E',
                                }}>
                                {grandFatalPct.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 text-xs py-10">
                  No ACHT data
                </div>
              )}
            </div>

            {/* Customer Interaction Insights */}
            <div className="customer-interaction-insights rounded-2xl px-5 py-5 mb-6" style={{ background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 60%, #7DD3FC 100%)', border: '1px solid #7DD3FC' }}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-5 rounded-full bg-violet-500" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Customer Interaction Insights</h2>
              </div>

            {/* Threat & Scam Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">

              {/* Social Media & Consumer Court Threat */}
              <div
                className="relative flex items-center gap-4 bg-white border border-orange-500/20 rounded-xl px-5 py-4 overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors"
                title="Click to view detail breakdown"
                onClick={() => {
                  setSocialThreatOpen(true);
                  if (!socialThreatDetail) {
                    setSocialThreatLoading(true);
                    api.get<{ data: SocialThreatDetailResponse }>(`/inbound-quality/social-threat-detail?startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
                      .then(r => setSocialThreatDetail(r.data?.data ?? null))
                      .catch(() => setSocialThreatDetail(null))
                      .finally(() => setSocialThreatLoading(false));
                  }
                }}>
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-orange-500" />
                <div className="p-3 rounded-xl bg-orange-500/10 shrink-0">
                  <ShieldAlert size={22} className="text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-widest leading-tight mb-1">
                    Social Media &amp; Consumer Court Threat
                  </p>
                  {loading ? (
                    <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
                  ) : (
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold text-orange-500 tabular-nums leading-none">
                        {(kpis?.social_media_court_threat ?? 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-600 mb-0.5">
                        calls ({kpis && kpis.audit_count > 0
                          ? ((kpis.social_media_court_threat / kpis.audit_count) * 100).toFixed(1)
                          : 0}%) · Click to view
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1">
                    📱 Social Media &nbsp;·&nbsp; ⚖️ Consumer Court &nbsp;·&nbsp; Legal / FIR
                  </p>
                </div>
              </div>

              {/* Potential Scam */}
              <div
                className="relative flex items-center gap-4 bg-white border border-red-500/20 rounded-xl px-5 py-4 overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors"
                title="Click to view detail breakdown"
                onClick={() => {
                  setScamDetailOpen(true);
                  if (!scamDetail) {
                    setScamDetailLoading(true);
                    api.get<{ data: PotentialScamDetail }>(`/inbound-quality/potential-scams-detail?startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
                      .then(r => setScamDetail(r.data?.data ?? null))
                      .catch(() => setScamDetail(null))
                      .finally(() => setScamDetailLoading(false));
                  }
                }}>
                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-red-500" />
                <div className="p-3 rounded-xl bg-red-500/10 shrink-0">
                  <AlertOctagon size={22} className="text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-widest leading-tight mb-1">
                    Potential Scam
                  </p>
                  {loading ? (
                    <div className="h-8 w-20 bg-slate-100 rounded animate-pulse" />
                  ) : (
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold text-red-500 tabular-nums leading-none">
                        {(kpis?.potential_scam ?? 0).toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-600 mb-0.5">
                        calls ({kpis && kpis.audit_count > 0
                          ? ((kpis.potential_scam / kpis.audit_count) * 100).toFixed(1)
                          : 0}%) · Click to view
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-600 mt-1">
                    Financial fraud 
                  </p>
                </div>
              </div>

            </div>

            {/* Golden Words — Categorized */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Golden Words</h3>
                <span className="ml-auto text-[10px] text-slate-400">
                  {posSignals.length > 0
                    ? `${posSignals.reduce((s, r) => s + r.total, 0).toLocaleString()} total mentions`
                    : 'customer + agent'}
                </span>
              </div>

              {(() => {
                const CAT_GROUPS: Array<{ emoji: string; name: string; keywords: string[]; color: string }> = [
                  { emoji: '🤝', name: 'Courtesy & Gratitude',      keywords: ['Thank You','Appreciate'],           color: '#10B981' },
                  { emoji: '🛟', name: 'Support & Assistance',      keywords: ['Help / Assist','Help','Assist'],    color: '#0EA5E9' },
                  { emoji: '✅', name: 'Acknowledgement & Underst.', keywords: ['Understanding'],                    color: '#8B5CF6' },
                  { emoji: '😊', name: 'Positive Reinforcement',    keywords: ['Nice','Good','Great'],               color: '#F59E0B' },
                  { emoji: '😌', name: 'Customer Satisfaction',     keywords: ['Satisfied'],                         color: '#14B8A6' },
                ];
                const kwMap = new Map(posSignals.map(r => [r.keyword, r]));
                const catData = CAT_GROUPS.map(g => {
                  const rows = g.keywords.map(kw => kwMap.get(kw)).filter(Boolean) as PosKeywordRow[];
                  return { ...g, rows, total: rows.reduce((s, r) => s + r.total, 0) };
                });
                const otherRows = posSignals.filter(r => !CAT_GROUPS.some(g => g.keywords.includes(r.keyword)));

                if (posSignals.length === 0 && !loading) {
                  return <p className="text-xs text-slate-400 text-center py-4">No positive signal data for this period.</p>;
                }
                if (loading) {
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" />
                      ))}
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {catData.map(({ emoji, name, keywords, color, rows, total }) => {
                      const PATTERNS: Record<string, string> = {
                        'Thank You':'thank','Appreciate':'appreciat','Great':'great','Good':'good',
                        'Help / Assist':'help','Help':'help','Assist':'help','Understanding':'understand',
                        'Patience':'patient','Happy':'happy','Satisfied':'satisf','Excellent':'excellent',
                        'Nice':'nice','Wonderful':'wonder',
                      };
                      return (
                      <div key={name}
                        className="relative flex flex-col gap-1.5 rounded-xl px-3 py-3 overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all"
                        style={{ backgroundColor: '#ffffff', border: `2px solid ${color}60`, boxShadow: `0 2px 8px ${color}25` }}
                        onClick={() => {
                          setCatDrill({ open: true, title: `${emoji} ${name}`, accent: color, leads: [], loading: true });
                          const base = `startDate=${sd}&endDate=${ed}&clientId=${clientId}`;
                          Promise.all(
                            keywords.map(kw => {
                              const p = PATTERNS[kw] ?? kw.toLowerCase();
                              return api.get<{ data: PosKeywordLeadRow[] }>(
                                `/inbound-quality/pos-keyword-leads?pattern=${encodeURIComponent(p)}&${base}`
                              ).then(r => r.data?.data ?? []);
                            })
                          ).then(results => {
                            const all = results.flat();
                            setCatDrill({ open: true, title: `${emoji} ${name}`, accent: color, leads: all, loading: false });
                          }).catch(() => setCatDrill({ open: true, title: `${emoji} ${name}`, accent: color, leads: [], loading: false }));
                        }}>
                        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ backgroundColor: color }} />
                        <div className="flex items-center justify-between">
                          <span className="text-base">{emoji}</span>
                          <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5"
                            style={{ backgroundColor: `${color}20`, color }}>
                            {rows.length} word{rows.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        {total > 0 && (
                          <span className="text-xl font-bold tabular-nums leading-none" style={{ color }}>
                            {total.toLocaleString()}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-slate-700 leading-tight block truncate">
                          {name}
                        </span>
                      </div>
                      );
                    })}
                    {otherRows.length > 0 && (
                      <div className="relative flex flex-col gap-1.5 rounded-xl px-3 py-3 overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all"
                        style={{ backgroundColor: '#ffffff', border: '2px solid #94A3B860', boxShadow: '0 2px 8px #94A3B825' }}
                        onClick={() => {
                          setDrillModal({
                            title: '📦 Other Keywords',
                            accent: '#94A3B8',
                            columns: [
                              { key: 'Word', label: 'Word' },
                              { key: 'Total', label: 'Total' },
                              { key: 'Customer', label: '👤 Customer' },
                              { key: 'Agent', label: '🎧 Agent' },
                            ],
                            rows: otherRows.map(r => ({
                              Word: r.keyword,
                              Total: r.total,
                              Customer: r.customer_count,
                              Agent: r.agent_count,
                            })),
                          });
                        }}>
                        <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl" style={{ backgroundColor: '#94A3B8' }} />
                        <div className="flex items-center justify-between">
                          <span className="text-base">📦</span>
                          <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5"
                            style={{ backgroundColor: '#94A3B820', color: '#94A3B8' }}>
                            {otherRows.length} word{otherRows.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <span className="text-xl font-bold tabular-nums leading-none" style={{ color: '#94A3B8' }}>
                          {otherRows.reduce((s, r) => s + r.total, 0).toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-700 leading-tight block truncate">
                          Other Keywords
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Top Negative Signals */}
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-rose-500" />
                <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Critical Signals</h3>
                <span className="ml-auto text-[10px] text-slate-400">Based on top_negative_words categorisation</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: 'Frustration', key: 'frustration_count' as const, color: '#F59E0B', bg: '#F59E0B15', icon: '😤' },
                  { label: 'Threat',      key: 'threat_count'      as const, color: '#EF4444', bg: '#EF444415', icon: '⚠️' },
                  { label: 'Abuse',       key: 'cuss_abuse_count'  as const, color: '#A855F7', bg: '#A855F715', icon: '🚫' },
                  { label: 'Slang',       key: 'slang_count'       as const, color: '#3B82F6', bg: '#3B82F615', icon: '💬' },
                  { label: 'Sarcasm',     key: 'sarcasm_count'     as const, color: '#14B8A6', bg: '#14B8A615', icon: '🙃' },
                ].map(({ label, key, color, bg, icon }) => {
                  const count = kpis?.[key] ?? 0;
                  const pct   = kpis && kpis.audit_count > 0
                    ? ((count / kpis.audit_count) * 100).toFixed(1)
                    : '0.0';
                  const filtered = negSignalDetails.filter(r => r.neg_signal === label);
                  const handleClick = () => {
                    if (label === 'Abuse') {
                      setAbuseDetailOpen(true);
                      if (!abuseDetail) {
                        setAbuseDetailLoading(true);
                        api.get<{ data: AbuseDetailResponse }>(`/inbound-quality/abuse-detail?startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
                          .then(r => setAbuseDetail(r.data?.data ?? null))
                          .catch(() => setAbuseDetail(null))
                          .finally(() => setAbuseDetailLoading(false));
                      }
                    } else if (label === 'Threat') {
                      setThreatDetailOpen(true);
                      if (!threatDetail) {
                        setThreatDetailLoading(true);
                        api.get<{ data: NegSignalDetailCallResponse }>(`/inbound-quality/neg-signal-detail?signal=Threat&startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
                          .then(r => setThreatDetail(r.data?.data ?? null))
                          .catch(() => setThreatDetail(null))
                          .finally(() => setThreatDetailLoading(false));
                      }
                    } else if (label === 'Frustration') {
                      setFrustDetailOpen(true);
                      if (!frustDetail) {
                        setFrustDetailLoading(true);
                        api.get<{ data: NegSignalDetailCallResponse }>(`/inbound-quality/neg-signal-detail?signal=Frustration&startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
                          .then(r => setFrustDetail(r.data?.data ?? null))
                          .catch(() => setFrustDetail(null))
                          .finally(() => setFrustDetailLoading(false));
                      }
                    } else if (filtered.length > 0) {
                      setDrillModal({
                        title: `${label} Signal — Scenario Breakdown`,
                        accent: color,
                        columns: [
                          { key: 'Scenario',  label: 'Scenario'  },
                          { key: 'Scenario1', label: 'Scenario1' },
                          { key: 'Count',     label: 'Count'     },
                          { key: 'Count%',    label: 'Count%'    },
                        ],
                        rows: filtered.map(r => ({ Scenario: r.scenario, Scenario1: r.scenario1, Count: r.count, 'Count%': `${r.pct}%` })),
                      });
                    }
                  };
                  return (
                    <div key={label}
                      className="relative flex flex-col gap-2 rounded-xl px-4 py-4 overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all"
                      style={{ backgroundColor: '#ffffff', border: `2px solid ${color}60`, boxShadow: `0 2px 8px ${color}25` }}
                      title={`Click to view ${label} details`}
                      onClick={handleClick}>
                      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: color }} />
                      <div className="flex items-center justify-between">
                        <span className="text-base">{icon}</span>
                        <span className="text-[10px] font-bold rounded-full px-2 py-0.5"
                          style={{ backgroundColor: `${color}25`, color }}>
                          {pct}%
                        </span>
                      </div>
                      {loading ? (
                        <div className="h-7 w-16 bg-slate-100 rounded animate-pulse" />
                      ) : (
                        <span className="text-2xl font-bold tabular-nums" style={{ color }}>
                          {count.toLocaleString()}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-700">
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            </div> {/* /Customer Interaction Insights */}

            {/* Fatal count banner */}
            {!loading && (kpis?.fatal_count ?? 0) > 0 && (
              <button
                className="w-full text-left mb-6 group"
                onClick={openFatalModal}
              >
                <div className="flex items-center gap-4 px-5 py-3.5 rounded-xl border-2 border-red-400 transition-all duration-150 group-hover:shadow-lg group-hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg,#B71C1C 0%,#D32F2F 60%,#E53935 100%)', boxShadow: '0 4px 16px rgba(211,47,47,0.35)' }}>
                  <div className="p-2.5 rounded-xl bg-red-900/40">
                    <AlertTriangle size={18} className="text-red-100" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">
                      {kpis!.fatal_count} Fatal Call{kpis!.fatal_count !== 1 ? 's' : ''} Detected
                    </p>
                    <p className="text-[11px] text-red-200 mt-0.5">
                      Quality score = 0 · Excluded from W/O Fatal CQ Score · <span className="font-bold text-white underline">Click to view details &amp; transcripts →</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-[10px] font-bold text-white bg-red-900/40 rounded-lg px-3 py-1.5 border border-red-300/30">
                    VIEW ALL
                  </div>
                </div>
              </button>
            )}

            {/* Top 5 Performers + 7-Day Chart */}
            {(() => {
              // Pad daily chart to always show 7 days ending at endDate
              const ed7 = new Date(endDate);
              const chartData = Array.from({ length: 7 }, (_, i) => {
                const d = new Date(ed7);
                d.setDate(d.getDate() - (6 - i));
                const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const hit = dailyScores.find(s => s.call_date === key);
                return {
                  date: key,
                  label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
                  score: hit?.avg_score ?? null,
                  audits: hit?.audit_count ?? 0,
                  target: 95,
                };
              });

              const RANK_COLORS = ['#F59E0B','#94A3B8','#CD7F32','#64748B','#64748B'];
              const RANK_LABELS = ['1st','2nd','3rd','4th','5th'];

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6 mb-6">

                  {/* Top 5 Performers */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 card-header gap-2 px-5 py-3">
                      <Trophy size={13} className="text-amber-400" />
                      <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Top 5 Performers</h3>
                      <ExportBtn onClick={() => downloadCSV(performers.map((p, i) => ({ Rank: i + 1, 'MAS ID': p.user, Agent: resolveAgent(p.user), Audits: p.audit_count, 'Avg Score%': p.avg_score })), 'top-performers.csv')} />
                    </div>
                    <div className="p-4 space-y-2.5">
                      {performers.length === 0 ? (
                        <p className="text-xs text-slate-600 py-6 text-center">No agent data found</p>
                      ) : performers.map((p, i) => (
                        <div key={p.user}
                          className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 rounded-lg px-1 transition-colors"
                          title={`Click to view ${resolveAgent(p.user)}'s calls`}
                          onClick={() => {
                            setAgentCallsModal({ open: true, agent: resolveAgent(p.user), calls: [], loading: true });
                            api.get<{ data: FatalCallItem[] }>(`/inbound-quality/agent-calls?agentId=${encodeURIComponent(p.user)}&startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
                              .then(r => setAgentCallsModal({ open: true, agent: resolveAgent(p.user), calls: r.data?.data ?? [], loading: false }))
                              .catch(() => setAgentCallsModal(prev => ({ ...prev, loading: false })));
                          }}>
                          <div className="flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-bold shrink-0"
                            style={{ backgroundColor: `${RANK_COLORS[i]}20`, color: RANK_COLORS[i] }}>
                            {RANK_LABELS[i]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-slate-700 truncate">{agentTag(p.user)}</span>
                              <span className="text-xs font-bold ml-2 shrink-0"
                                style={{ color: cqColor(p.avg_score) }}>
                                {p.avg_score}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(p.avg_score, 100)}%`,
                                  backgroundColor: cqColor(p.avg_score),
                                }} />
                            </div>
                            <span className="text-[10px] text-slate-600 font-semibold mt-0.5">{p.audit_count} audits · Click to view calls</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 7-Day Bar Chart: Score vs Target */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 card-header gap-2 px-5 py-3">
                      <Target size={13} className="text-sky-400" />
                      <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Last 7 Days vs Target</h3>
                      <ExportBtn onClick={() => downloadCSV(chartData.map(d => ({ Date: d.date, 'Avg Score%': d.score ?? 'No data', 'Audit Count': d.audits, Target: d.target })), 'last-7-days.csv')} />
                      <span className="ml-auto flex items-center gap-1.5 text-[10px] text-red-400 font-semibold">
                        <span className="w-4 h-0.5 bg-red-400 rounded inline-block" />
                        Target 95%
                      </span>
                    </div>
                    <div className="p-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: '#64748B', fontSize: 10 }}
                            axisLine={false} tickLine={false}
                          />
                          <YAxis
                            domain={[0, 100]}
                            tick={{ fill: '#64748B', fontSize: 10 }}
                            axisLine={false} tickLine={false}
                            tickFormatter={v => `${v}%`}
                          />
                          <Tooltip
                            contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                            formatter={(val: unknown, name: unknown) => [
                              name === 'score' ? `${val ?? 'No data'}%` : `${val}%`,
                              name === 'score' ? 'Quality Score' : 'Target',
                            ]}
                            labelStyle={{ color: '#0F172A', fontWeight: 600, marginBottom: 4 }}
                            itemStyle={{ color: '#334155' }}
                          />
                          <ReferenceLine
                            y={95}
                            stroke="#EF4444"
                            strokeDasharray="5 3"
                            strokeWidth={1.5}
                          />
                          <Bar
                            dataKey="score"
                            name="score"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={36}
                          >
                            {chartData.map((d, i) => (
                              <Cell
                                key={i}
                                fill={d.score === null ? '#F1F5F9' : d.score >= 95 ? '#22C55E' : d.score >= 85 ? '#3B82F6' : '#F59E0B'}
                                fillOpacity={d.score === null ? 0.2 : 1}
                              />
                            ))}
                          </Bar>
                        </ComposedChart>
                      </ResponsiveContainer>
                      <div className="flex items-center justify-center gap-5 mt-1">
                        {[
                          { color: '#22C55E', label: '≥95% (On Target)' },
                          { color: '#3B82F6', label: '85–94%' },
                          { color: '#F59E0B', label: '<85%' },
                        ].map(l => (
                          <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                            {l.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })()}

            {/* ── Agent Audit Summary ───────────────────────────────────── */}
            {agentAuditBand.length > 0 && (() => {
              const cq = (v: number) => v >= 80 ? '#10B981' : v >= 60 ? '#F59E0B' : '#EF4444';
              const stackBadge = (score: number) => {
                const label = score >= 90 ? 'TQ' : score >= 80 ? 'MQ' : 'BQ';
                const c = label === 'TQ'
                  ? { bg: '#22C55E1A', text: '#22C55E', border: '#22C55E40' }
                  : label === 'MQ'
                  ? { bg: '#F59E0B1A', text: '#F59E0B', border: '#F59E0B40' }
                  : { bg: '#EF44441A', text: '#EF4444', border: '#EF444440' };
                return (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border"
                    style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                    {label}
                  </span>
                );
              };
              const total_audits = agentAuditBand.reduce((s, r) => s + r.audit_count, 0);
              const total_fatals = agentAuditBand.reduce((s, r) => s + r.fatal_count, 0);
              const total_tq     = agentAuditBand.reduce((s, r) => s + r.tq_count,    0);
              const total_mq     = agentAuditBand.reduce((s, r) => s + r.mq_count,    0);
              const total_bq     = agentAuditBand.reduce((s, r) => s + r.bq_count,    0);
              const avg_cq       = agentAuditBand.reduce((s, r) => s + r.cq_score, 0) / agentAuditBand.length;
              return (
                <div className="mb-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="card-header gap-3 px-5 py-3 flex-wrap">
                    <div className="w-1 h-4 rounded-full bg-sky-500 shrink-0" />
                    <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Agent Audit Summary</h3>
                    <span className="text-[10px] text-slate-600">Stack Ranking: ≥90% TQ · ≥80% MQ · else BQ</span>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#22C55E1A', color: '#22C55E', border: '1px solid #22C55E40' }}>
                        TQ {agentAuditBand.filter(r => r.cq_score >= 90).length}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#F59E0B1A', color: '#F59E0B', border: '1px solid #F59E0B40' }}>
                        MQ {agentAuditBand.filter(r => r.cq_score >= 80 && r.cq_score < 90).length}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#EF44441A', color: '#EF4444', border: '1px solid #EF444440' }}>
                        BQ {agentAuditBand.filter(r => r.cq_score < 80).length}
                      </span>
                      <ExportBtn onClick={() => downloadCSV(agentAuditBand.map((r, i) => ({
                      '#': i + 1,
                      'MAS ID':          r.agent,
                      'Agent':           resolveAgent(r.agent),
                      'Audit Count':     r.audit_count,
                      'CQ Score%':       r.cq_score,
                      'Stack Ranking':   r.cq_score >= 90 ? 'TQ' : r.cq_score >= 80 ? 'MQ' : 'BQ',
                      'Fatal Count':     r.fatal_count,
                      'Fatal%':          r.fatal_pct,
                      'TQ (≥80%)':       r.tq_count,
                      'MQ (60-79%)':     r.mq_count,
                      'BQ (<60%)':       r.bq_count,
                    })), 'agent-audit-summary.csv')} />
                    </div>
                  </div>
                  <div className="overflow-x-auto overflow-y-auto max-h-96">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b border-slate-200 bg-slate-50">
                          {[
                            { label: '#',              cls: 'w-8 text-center' },
                            { label: 'Agent',           cls: 'text-left' },
                            { label: 'Audit Count',     cls: 'text-right' },
                            { label: 'CQ Score%',       cls: 'text-right' },
                            { label: 'Stack Ranking',   cls: 'text-center text-violet-400' },
                            { label: 'Fatal Count',     cls: 'text-right' },
                            { label: 'Fatal%',          cls: 'text-right' },
                            { label: 'TQ',              cls: 'text-right text-emerald-400' },
                            { label: 'MQ',              cls: 'text-right text-amber-400'   },
                            { label: 'BQ',              cls: 'text-right text-red-400'     },
                          ].map(h => (
                            <th key={h.label} className={`py-2.5 px-3 font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap ${h.cls || 'text-slate-600'}`}>
                              {h.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {agentAuditBand.map((r, i) => (
                          <tr key={r.agent}
                            className="border-b border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                            title={`Click to drill into ${resolveAgent(r.agent)}'s band detail`}
                            onClick={() => openBandDetail('no_fatal', `${resolveAgent(r.agent)} — Band Detail`, r.cq_score >= 90 ? '#22C55E' : r.cq_score >= 80 ? '#F59E0B' : '#EF4444', r.agent)}>
                            <td className="py-2 px-3 text-slate-400 text-center">{i + 1}</td>
                            <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">{agentTag(r.agent)}</td>
                            <td className="py-2 px-3 text-right text-slate-700">{r.audit_count.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right font-bold" style={{ color: cq(r.cq_score) }}>{r.cq_score.toFixed(1)}%</td>
                            <td className="py-2 px-3 text-center">{stackBadge(r.cq_score)}</td>
                            <td className="py-2 px-3 text-right font-semibold" style={{ color: r.fatal_count > 0 ? '#EF4444' : '#94A3B8' }}>
                              {r.fatal_count > 0 ? r.fatal_count.toLocaleString() : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold" style={{ color: r.fatal_pct > 0 ? '#EF4444' : '#94A3B8' }}>
                              {r.fatal_pct > 0 ? `${r.fatal_pct.toFixed(1)}%` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-emerald-400">
                              {r.tq_count > 0 ? r.tq_count.toLocaleString() : <span className="text-slate-400">0</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-amber-400">
                              {r.mq_count > 0 ? r.mq_count.toLocaleString() : <span className="text-slate-400">0</span>}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold" style={{ color: r.bq_count > 0 ? '#EF4444' : '#94A3B8' }}>
                              {r.bq_count > 0 ? r.bq_count.toLocaleString() : <span className="text-slate-400">0</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 bg-slate-50">
                          <td className="py-2 px-3 text-[10px] text-slate-700 font-semibold" colSpan={2}>
                            Total ({agentAuditBand.length} agents)
                          </td>
                          <td className="py-2 px-3 text-right text-[10px] font-semibold text-slate-700">{total_audits.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-[10px] font-bold" style={{ color: cq(avg_cq) }}>{avg_cq.toFixed(1)}%</td>
                          <td className="py-2 px-3 text-center">{stackBadge(avg_cq)}</td>
                          <td className="py-2 px-3 text-right text-[10px] font-semibold text-red-400">{total_fatals.toLocaleString()}</td>
                          <td className="py-2 px-3" />
                          <td className="py-2 px-3 text-right text-[10px] font-semibold text-emerald-400">{total_tq.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-[10px] font-semibold text-amber-400">{total_mq.toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-[10px] font-semibold text-red-400">{total_bq.toLocaleString()}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Scenario Distribution */}
            {scenarios.length > 0 && (() => {
              const filteredScenarios = scenarios.filter(s => s.scenario.trim().toLowerCase() !== 'unknown');
              const activeChildren = selectedScenario
                ? (filteredScenarios.find(s => s.scenario === selectedScenario)?.children ?? [])
                : null;

              return (
                <div className="mt-6 mb-6 bg-white border border-slate-200 rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-3 card-header gap-2 px-5 py-3 flex-wrap">
                    <div className="w-1 h-4 rounded-full bg-blue-500" />
                    <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">
                      Scenario Distribution
                    </h3>
                    <ExportBtn onClick={() => downloadCSV(filteredScenarios.map(s => ({ Scenario: s.scenario, Count: s.count, 'Count%': `${s.pct}%` })), 'scenario-distribution.csv')} />
                    {selectedScenario && (
                      <>
                        <span className="text-slate-600 text-xs">→</span>
                        <span className="text-xs font-bold text-blue-400">{selectedScenario}</span>
                        <button
                          onClick={() => setSelectedScenario(null)}
                          className="ml-auto text-[10px] text-slate-500 hover:text-slate-600 border border-slate-200 rounded px-2 py-0.5 transition-colors">
                          ✕ Clear
                        </button>
                      </>
                    )}
                    {!selectedScenario && (
                      <span className="ml-auto text-[10px] text-slate-400">Click a slice or row to drill down</span>
                    )}
                  </div>

                  <div className="flex flex-col lg:flex-row">
                    {/* Left — Pie Chart */}
                    <div className="lg:w-[45%] p-4 flex flex-col items-center">
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={filteredScenarios}
                            dataKey="count"
                            nameKey="scenario"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={48}
                            paddingAngle={2}
                            onClick={(d: unknown) => { const s = d as ScenarioItem; setSelectedScenario(prev => prev === s.scenario ? null : s.scenario); }}
                            style={{ cursor: 'pointer' }}
                            labelLine={false}
                            label={(props: import('recharts').PieLabelRenderProps) => {
                              const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 } = props;
                              const ncx = Number(cx), ncy = Number(cy), nma = Number(midAngle), nir = Number(innerRadius), nor = Number(outerRadius), np = Number(percent);
                              if (np < 0.06) return null;
                              const R = Math.PI / 180;
                              const r = nir + (nor - nir) * 0.55;
                              return (
                                <text
                                  x={ncx + r * Math.cos(-nma * R)}
                                  y={ncy + r * Math.sin(-nma * R)}
                                  fill="#fff" textAnchor="middle" dominantBaseline="central"
                                  fontSize={10} fontWeight={700}>
                                  {`${(np * 100).toFixed(0)}%`}
                                </text>
                              );
                            }}
                          >
                            {filteredScenarios.map((s, i) => (
                              <Cell
                                key={i}
                                fill={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
                                opacity={selectedScenario && selectedScenario !== s.scenario ? 0.35 : 1}
                                stroke={selectedScenario === s.scenario ? '#fff' : 'transparent'}
                                strokeWidth={selectedScenario === s.scenario ? 2 : 0}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                            formatter={(v: unknown, n: unknown) => [
                              `${Number(v).toLocaleString()} calls (${filteredScenarios.find(s => s.scenario === n)?.pct ?? 0}%)`,
                              String(n),
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Legend */}
                      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-1">
                        {filteredScenarios.map((s, i) => (
                          <button
                            key={s.scenario}
                            onClick={() => setSelectedScenario(prev => prev === s.scenario ? null : s.scenario)}
                            className="flex items-center gap-1.5 text-[10px] hover:opacity-80 transition-opacity"
                            style={{ opacity: selectedScenario && selectedScenario !== s.scenario ? 0.4 : 1 }}>
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ background: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                            <span className="text-slate-400">{s.scenario}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Right — Table */}
                    <div className="lg:w-[55%] border-t lg:border-t-0 lg:border-l border-slate-200 overflow-hidden">
                      {!selectedScenario ? (
                        /* All scenarios summary */
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              {['Scenario', 'Count', 'Count %'].map(h => (
                                <th key={h} className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredScenarios.map((s, i) => (
                              <tr key={s.scenario}
                                onClick={() => setSelectedScenario(s.scenario)}
                                className="border-b border-slate-100 hover:bg-slate-100 cursor-pointer transition-colors">
                                <td className="py-2.5 px-4 flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-sm shrink-0"
                                    style={{ background: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                                  <span className="text-slate-700 font-medium">{s.scenario}</span>
                                </td>
                                <td className="py-2.5 px-4 text-slate-600 tabular-nums font-semibold">
                                  {s.count.toLocaleString()}
                                </td>
                                <td className="py-2.5 px-4 tabular-nums">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                                      <div className="h-full rounded-full"
                                        style={{ width: `${s.pct}%`, background: SCENARIO_COLORS[i % SCENARIO_COLORS.length] }} />
                                    </div>
                                    <span className="text-slate-600 font-semibold">{s.pct}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        /* Scenario1 drill-down */
                        <div>
                          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50">
                            <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">
                              {selectedScenario} — Sub-scenario breakdown
                            </p>
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200">
                                {['Scenario 1', 'Count', 'Count %'].map(h => (
                                  <th key={h} className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(activeChildren ?? []).map((c, i) => {
                                const scenIdx = filteredScenarios.findIndex(s => s.scenario === selectedScenario);
                                const color   = SCENARIO_COLORS[scenIdx % SCENARIO_COLORS.length];
                                return (
                                  <tr key={i}
                                    className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-transparent'}`}>
                                    <td className="py-2.5 px-4 text-slate-700">{c.scenario1}</td>
                                    <td className="py-2.5 px-4 text-slate-600 tabular-nums font-semibold">
                                      {c.count.toLocaleString()}
                                    </td>
                                    <td className="py-2.5 px-4 tabular-nums">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[80px]">
                                          <div className="h-full rounded-full"
                                            style={{ width: `${c.pct}%`, background: color }} />
                                        </div>
                                        <span className="text-slate-600 font-semibold">{c.pct}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Alert Field Tables ─────────────────────────────────────── */}
            {(socialThreats.length > 0 || negSignalDetails.length > 0 || potentialScams.length > 0) && (() => {
              const negColor: Record<string, string> = {
                Frustration: '#F97316', Threat: '#EF4444', Abuse: '#A855F7',
                Slang: '#3B82F6', Sarcasm: '#14B8A6',
              };
              const totalSocial  = socialThreats.reduce((s, r) => s + r.count, 0);
              const totalNeg     = negSignalDetails.reduce((s, r) => s + r.count, 0);
              const totalScam    = potentialScams.reduce((s, r) => s + r.count, 0);

              const AlertTable = ({
                title, accentColor, rows, extraCol,
              }: {
                title: string;
                accentColor: string;
                rows: Array<{ scenario: string; scenario1: string; count: number; pct: number; extra?: string }>;
                extraCol?: string;
              }) => (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 card-header gap-2 px-5 py-3">
                    <div className="w-1 h-4 rounded-full" style={{ background: accentColor }} />
                    <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">{title}</h3>
                    <ExportBtn onClick={() => downloadCSV(rows.map(r => ({ Scenario: r.scenario, Scenario1: r.scenario1, ...(extraCol ? { [extraCol]: r.extra } : {}), Count: r.count, 'Count%': `${r.pct}%` })), `${title.replace(/\s+/g,'-').toLowerCase()}.csv`)} />
                    <span className="ml-auto text-xs font-bold" style={{ color: accentColor }}>
                      {rows.reduce((s, r) => s + r.count, 0).toLocaleString()} calls
                    </span>
                  </div>
                  {rows.length === 0 ? (
                    <p className="text-xs text-slate-600 p-4">No data for selected period.</p>
                  ) : (
                    <div className="overflow-y-auto max-h-64">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider">Scenario</th>
                            <th className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider">Scenario1</th>
                            {extraCol && <th className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider">{extraCol}</th>}
                            <th className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider">Count</th>
                            <th className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider">Count%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i % 2 === 0 ? '' : 'bg-transparent'}`}>
                              <td className="py-2.5 px-4 text-slate-900 font-semibold">{r.scenario}</td>
                              <td className="py-2.5 px-4 text-slate-800 font-medium">{r.scenario1}</td>
                              {extraCol && (
                                <td className="py-2.5 px-4">
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                                    style={{
                                      background: `${negColor[r.extra ?? ''] ?? '#64748B'}22`,
                                      color: negColor[r.extra ?? ''] ?? '#475569',
                                      border: `1px solid ${negColor[r.extra ?? ''] ?? '#64748B'}40`,
                                    }}>
                                    {r.extra}
                                  </span>
                                </td>
                              )}
                              <td className="py-2.5 px-4 text-slate-900 font-bold tabular-nums">{r.count.toLocaleString()}</td>
                              <td className="py-2.5 px-4 tabular-nums">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
                                    <div className="h-full rounded-full" style={{ width: `${r.pct}%`, background: accentColor }} />
                                  </div>
                                  <span className="text-slate-900 font-bold">{r.pct}%</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-slate-300">
                          <tr className="bg-slate-100">
                            <td colSpan={extraCol ? 3 : 2} className="py-2.5 px-4 text-slate-900 font-bold text-[11px] uppercase tracking-wide">Grand Total</td>
                            <td className="py-2.5 px-4 text-slate-900 font-bold tabular-nums">{rows.reduce((s, r) => s + r.count, 0).toLocaleString()}</td>
                            <td className="py-2.5 px-4 text-slate-900 font-bold">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );

              return (
                <div className="mt-6 mb-6 space-y-4">
                  {socialThreats.length > 0 && (
                    <AlertTable
                      title="Social Media & Consumer Court Threat"
                      accentColor="#F97316"
                      rows={socialThreats.map(r => ({ ...r, extra: undefined }))}
                    />
                  )}

                  {/* Sensitive Word Analysis — two metrics below the social threats table */}
                  {sensitiveWordAnalysis && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-5 py-3 card-header gap-2 px-5 py-3">
                        <div className="w-1 h-4 rounded-full bg-orange-400" />
                        <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">
                          Sensitive Word Use Analysis
                        </h3>
                      </div>
                      <div className="flex flex-col lg:flex-row">
                        {/* Left — Sensitive Word Use distribution */}
                        <div className="lg:w-[65%] overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50">
                                {['Sensitive Word Use', 'Count', 'Count%'].map(h => (
                                  <th key={h} className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sensitiveWordAnalysis.distribution.map((r, i) => (
                                <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-transparent'}`}>
                                  <td className="py-3 px-4 text-slate-700 leading-snug">{r.label}</td>
                                  <td className="py-3 px-4 text-slate-600 font-bold tabular-nums whitespace-nowrap">{r.count.toLocaleString()}</td>
                                  <td className="py-3 px-4 tabular-nums whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
                                        <div className="h-full rounded-full bg-orange-400" style={{ width: `${r.pct}%` }} />
                                      </div>
                                      <span className="text-slate-600 font-semibold">{r.pct}%</span>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="border-t border-slate-200">
                              <tr className="bg-slate-50">
                                <td className="py-2.5 px-4 text-slate-600 font-semibold text-[10px] uppercase">Total</td>
                                <td className="py-2.5 px-4 text-slate-900 font-bold tabular-nums">
                                  {sensitiveWordAnalysis.distribution.reduce((s, r) => s + r.count, 0).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-4 text-slate-900 font-bold">100%</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Right — Dimension counts */}
                        <div className="lg:w-[35%] border-t lg:border-t-0 lg:border-l border-slate-200 p-4 flex flex-col gap-3 justify-center">
                          <p className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold mb-1">
                            Dimension
                          </p>
                          {[
                            { label: sensitiveWordAnalysis.akash_label, count: sensitiveWordAnalysis.akash_count,  color: '#A855F7', note: 'CX mentioned co-founder name' },
                            { label: 'Social Media',                    count: sensitiveWordAnalysis.social_count, color: '#3B82F6', note: 'CX threatened social media' },
                            { label: 'Consumer Court',                  count: sensitiveWordAnalysis.court_count,  color: '#F97316', note: 'CX mentioned court/legal/FIR' },
                          ].map(d => (
                            <div key={d.label} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-3 border border-slate-200">
                              <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: d.color }} />
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-slate-600 uppercase tracking-widest">{d.label}</p>
                                <p className="text-slate-400 text-[9px] leading-tight">{d.note}</p>
                              </div>
                              <span className="text-xl font-bold tabular-nums" style={{ color: d.color }}>
                                {d.count.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {negSignalDetails.length > 0 && (
                    <AlertTable
                      title="Top Negative Signals"
                      accentColor="#F59E0B"
                      extraCol="Signal Type"
                      rows={negSignalDetails.map(r => ({ ...r, extra: r.neg_signal }))}
                    />
                  )}
                  {potentialScams.length > 0 && (
                    <AlertTable
                      title="Potential Scam Leads"
                      accentColor="#EF4444"
                      rows={potentialScams.map(r => ({ ...r, extra: undefined }))}
                    />
                  )}
                  {/* summary strip */}
                  <div className="flex gap-3">
                    {[
                      { label: 'Social Media & Court Threats', count: totalSocial, color: '#F97316' },
                      { label: 'Top Negative Signal Calls',    count: totalNeg,    color: '#F59E0B' },
                      { label: 'Potential Scam Leads',         count: totalScam,   color: '#EF4444' },
                    ].map(s => (
                      <div key={s.label} className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className="w-1 self-stretch rounded-full" style={{ background: s.color }} />
                        <div>
                          <p className="text-[10px] text-slate-600 uppercase tracking-widest">{s.label}</p>
                          <p className="text-xl font-bold text-slate-900">{s.count.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}



            {!loading && (!kpis || kpis.audit_count === 0) && (
              <div className="flex items-center justify-center py-20 text-slate-600 text-sm">
                No audit data found for this period.
              </div>
            )}
          </>
        )}

        {/* ── Fatal Analysis Slide ─────────────────────────────────────── */}
        {activeSlide === 1 && (() => {
          const fd = fatalData;
          if (fatalLoading || !fd) {
            return (
              <div className="flex items-center justify-center py-20 text-slate-600 text-sm">
                {fatalLoading ? 'Loading fatal analysis…' : 'No fatal data for this period.'}
              </div>
            );
          }

          // Heat-map colour helper
          const heatBg = (val: number, max: number) => {
            if (!val || !max) return '';
            const a = 0.15 + (val / max) * 0.65;
            return `rgba(239,68,68,${a.toFixed(2)})`;
          };

          // Chart data — reverse day_wise (ASC) for chart, keep DESC for table
          const chartData = [...fd.day_wise].reverse().map(r => ({
            date:  r.call_date.slice(5).replace('-', '/'),
            count: r.total_fatal,
            pct:   r.fatal_pct,
          }));

          const dayMaxFatal = Math.max(...fd.day_wise.map(r => r.total_fatal), 1);

          // Grand totals for agent table
          const gt = fd.agent_performance.reduce(
            (acc, r) => ({
              audit: acc.audit + r.audit_count,
              fatal: acc.fatal + r.fatal_count,
            }),
            { audit: 0, fatal: 0 }
          );
          const gtCq  = fd.cq_score;
          const gtFp  = gt.audit > 0 ? Math.round(gt.fatal / gt.audit * 1000) / 10 : 0;

          const deltaVsTarget = (fd.cq_score - 98).toFixed(1);

          // Custom bar label renderer
          const renderFatalBarLabel = (props: { x?: string | number; y?: string | number; width?: string | number; value?: number; index?: number }) => {
            const { x = 0, y = 0, width = 0, value, index = 0 } = props;
            const nx = Number(x), ny = Number(y), nw = Number(width);
            const row = chartData[index];
            if (!value) return <g />;
            return (
              <g>
                <text x={nx + nw / 2} y={ny - 6}  textAnchor="middle" fill="#22D3EE" fontSize={9} fontWeight="bold">{value}</text>
                <text x={nx + nw / 2} y={ny - 16} textAnchor="middle" fill="#EF4444" fontSize={8}>{row?.pct ?? 0}%</text>
              </g>
            );
          };

          const pctCell = (val: number) => {
            const color = val > 0 ? '#EF4444' : '#64748B';
            const bg    = val > 0 ? 'rgba(239,68,68,0.15)' : 'transparent';
            return (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ color, background: bg }}>
                {val > 0 ? `${val}%` : '0%'}
              </span>
            );
          };

          return (
            <>
              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  {
                    label: 'CQ Score%', value: `${fd.cq_score}%`,
                    sub: <span className={`text-[10px] font-bold flex items-center gap-0.5 ${Number(deltaVsTarget) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {Number(deltaVsTarget) < 0 ? '▼' : '▲'} {deltaVsTarget}%
                    </span>,
                    color: fd.cq_score >= 90 ? '#22C55E' : '#EF4444',
                    onClick: () => setDrillModal({ title: 'Fatal Analysis — Scenario Fatal Breakdown', accent: '#EF4444', columns: [{ key: 'Scenario', label: 'Scenario' }, { key: 'Fatal Count', label: 'Fatal Count' }, { key: 'Fatal%', label: 'Fatal%' }], rows: [{ Scenario: 'Query', 'Fatal Count': fd.query_fatal, 'Fatal%': fd.audit_count > 0 ? `${((fd.query_fatal / fd.audit_count) * 100).toFixed(1)}%` : '0%' }, { Scenario: 'Complaint', 'Fatal Count': fd.complaint_fatal, 'Fatal%': fd.audit_count > 0 ? `${((fd.complaint_fatal / fd.audit_count) * 100).toFixed(1)}%` : '0%' }, { Scenario: 'Request', 'Fatal Count': fd.request_fatal, 'Fatal%': fd.audit_count > 0 ? `${((fd.request_fatal / fd.audit_count) * 100).toFixed(1)}%` : '0%' }, { Scenario: 'Sale Done', 'Fatal Count': fd.sale_done_fatal, 'Fatal%': fd.audit_count > 0 ? `${((fd.sale_done_fatal / fd.audit_count) * 100).toFixed(1)}%` : '0%' }] }),
                  },
                  {
                    label: 'Audit Count', value: fd.audit_count.toLocaleString(), sub: null, color: '#38BDF8',
                    onClick: () => setDrillModal({ title: 'Fatal Analysis — Day Wise Audit Count', accent: '#38BDF8', columns: [{ key: 'Date', label: 'Date' }, { key: 'Total', label: 'Total' }, { key: 'Query Fatal', label: 'Query Fatal' }, { key: 'Complaint Fatal', label: 'Complaint Fatal' }, { key: 'Request Fatal', label: 'Request Fatal' }], rows: fd.day_wise.map(r => ({ Date: r.call_date, Total: r.total_count, 'Query Fatal': r.query_fatal, 'Complaint Fatal': r.complaint_fatal, 'Request Fatal': r.request_fatal })) }),
                  },
                  {
                    label: 'Fatal Count', value: fd.fatal_count.toLocaleString(), sub: null, color: '#EF4444',
                    onClick: () => setDrillModal({ title: 'Top Fatal Contributors', accent: '#EF4444', columns: [{ key: 'Agent', label: 'Agent' }, { key: 'Audits', label: 'Audits' }, { key: 'Fatals', label: 'Fatals' }, { key: 'Fatal%', label: 'Fatal%' }], rows: fd.top_contributors.map(r => ({ Agent: resolveAgent(r.agent_name), 'MAS ID': r.agent_name, Audits: r.audit_count, Fatals: r.fatal_count, 'Fatal%': `${r.fatal_pct}%` })) }),
                  },
                  {
                    label: 'Fatal%', value: `${fd.fatal_pct}%`, sub: null, color: fd.fatal_pct >= 20 ? '#EF4444' : '#F59E0B',
                    onClick: () => setDrillModal({ title: 'Fatal% — Week & Scenario Breakdown', accent: '#F59E0B', columns: [{ key: 'Week', label: 'Week' }, { key: 'Query Fatal%', label: 'Query%' }, { key: 'Complaint Fatal%', label: 'Complaint%' }, { key: 'Request Fatal%', label: 'Request%' }, { key: 'Sale Done Fatal%', label: 'Sale Done%' }, { key: 'Total Fatal', label: 'Total' }], rows: fd.week_scenario.map(r => ({ Week: r.week_label, 'Query Fatal%': `${r.query_fatal_pct}%`, 'Complaint Fatal%': `${r.complaint_fatal_pct}%`, 'Request Fatal%': `${r.request_fatal_pct}%`, 'Sale Done Fatal%': `${r.sale_done_fatal_pct}%`, 'Total Fatal': r.total_fatal })) }),
                  },
                ].map(c => (
                  <div key={c.label}
                    className="relative bg-white rounded-xl px-4 py-4 overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                    style={{ border: `2px solid ${c.color}` }}
                    onClick={c.onClick}
                    title="Click for detail analysis">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl" style={{ background: c.color }} />
                    <div className="pl-3">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: c.color }}>{c.label}</p>
                      <p className="text-2xl font-black text-slate-900 leading-none tabular-nums">{c.value}</p>
                      {c.sub && <div className="mt-1">{c.sub}</div>}
                      <p className="text-[9px] text-slate-400 mt-1.5 font-semibold">↗ Click to analyse</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Two-column layout ── */}
              <div className="grid lg:grid-cols-2 gap-4 mb-4">

                {/* LEFT column */}
                <div className="space-y-4">

                  {/* Top 5 Fatal Contributor */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 card-header gap-2 px-5 py-3">
                      <div className="w-1 h-4 rounded-full bg-red-500" />
                      <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Top 5 Fatal Contributor</h3>
                      <ExportBtn onClick={() => downloadCSV(fd.top_contributors.map(r => ({ 'MAS ID': r.agent_name, Agent: resolveAgent(r.agent_name), Audits: r.audit_count, Fatals: r.fatal_count, 'Fatal%': r.fatal_pct })), 'fatal-contributors.csv')} />
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          {['Agent Name','Audit Count','Fatal Count','Fatal%'].map(h => (
                            <th key={h} className="py-2 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider text-[10px]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fd.top_contributors.map((r, i) => (
                          <tr key={i} className="border-b border-slate-100">
                            <td className="py-2.5 px-4 text-slate-900 font-semibold">{agentTag(r.agent_name)}</td>
                            <td className="py-2.5 px-4 text-slate-900 font-medium tabular-nums">{r.audit_count}</td>
                            <td className="py-2.5 px-4 font-bold tabular-nums" style={{ color: r.fatal_count > 0 ? '#DC2626' : '#0F172A' }}>{r.fatal_count}</td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-4 rounded bg-slate-100 overflow-hidden max-w-[80px]">
                                  <div className="h-full rounded bg-red-500 flex items-center justify-center"
                                    style={{ width: `${Math.min(r.fatal_pct, 100)}%` }}>
                                    <span className="text-[9px] font-bold text-slate-900 px-1 whitespace-nowrap">{r.fatal_pct}%</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {fd.top_contributors.length === 0 && (
                          <tr><td colSpan={4} className="py-6 text-center text-slate-600 text-xs">No fatal calls</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Day Wise Fatal% chart */}
                  {chartData.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 card-header gap-2 px-5 py-3">
                        <div className="w-1 h-4 rounded-full bg-red-500" />
                        <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Day Wise Fatal%</h3>
                      </div>
                      <div className="p-3">
                        <ResponsiveContainer width="100%" height={220}>
                          <ComposedChart data={chartData} margin={{ top: 28, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 9 }} />
                            <YAxis tick={{ fill: '#64748B', fontSize: 9 }} allowDecimals={false} />
                            <Tooltip
                              contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 11, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                              formatter={(v: unknown, n: unknown) => [v as React.ReactNode, n === 'count' ? 'Fatal Count' : String(n)]}
                            />
                            <Bar dataKey="count" fill="#0EA5E9" radius={[3,3,0,0]}><LabelList content={renderFatalBarLabel as never} /></Bar>
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT column */}
                <div className="space-y-4">

                  {/* Scenario Wise Fatal Count — 4 cards */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 card-header gap-2 px-5 py-3">
                      <div className="w-1 h-4 rounded-full bg-red-500" />
                      <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Scenario Wise Fatal Count</h3>
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-slate-200">
                      {[
                        { label: 'Query Fatal',     value: fd.query_fatal },
                        { label: 'Complaint Fatal',  value: fd.complaint_fatal },
                        { label: 'Request Fatal',    value: fd.request_fatal },
                        { label: 'Sale Done Fatal',  value: fd.sale_done_fatal },
                      ].map(c => (
                        <div key={c.label} className="px-3 py-4 text-center">
                          <p className="text-[9px] text-slate-800 font-semibold uppercase tracking-wider mb-1">{c.label}</p>
                          <p className={`text-2xl font-bold ${c.value > 0 ? 'text-red-500' : 'text-slate-700'}`}>{c.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Day Wise / Fatal heat-map table */}
                  {fd.day_wise.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 card-header gap-2 px-5 py-3">
                        <div className="w-1 h-4 rounded-full bg-red-500" />
                        <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Day Wise / Fatal</h3>
                        <ExportBtn onClick={() => downloadCSV(fd.day_wise.map(r => ({ Date: r.call_date, 'Query Fatal': r.query_fatal, 'Complaint Fatal': r.complaint_fatal, 'Request Fatal': r.request_fatal, 'Total Fatal': r.total_fatal, 'Fatal%': r.fatal_pct })), 'day-wise-fatal.csv')} />
                      </div>
                      <div className="overflow-y-auto max-h-52">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-white z-10">
                            <tr className="border-b border-slate-200 bg-slate-50">
                              {['Date','Query','Complaint','Request','Total'].map(h => (
                                <th key={h} className="py-2 px-3 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fd.day_wise.map((r, i) => (
                              <tr key={i} className="border-b border-slate-100">
                                <td className="py-2 px-3 text-slate-900 font-medium whitespace-nowrap">
                                  {r.call_date.slice(5).replace('-','/')}
                                </td>
                                {[r.query_fatal, r.complaint_fatal, r.request_fatal].map((v, ci) => (
                                  <td key={ci} className="py-2 px-3 tabular-nums text-center font-semibold"
                                    style={{ background: heatBg(v, dayMaxFatal), color: v > 0 ? '#fff' : '#0F172A' }}>
                                    {v > 0 ? v : '—'}
                                  </td>
                                ))}
                                <td className="py-2 px-3 text-slate-900 font-bold tabular-nums">{r.total_fatal}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-slate-200">
                            <tr className="bg-slate-50">
                              <td className="py-2 px-3 text-slate-900 font-semibold text-[10px]">Grand total</td>
                              {(['query_fatal','complaint_fatal','request_fatal'] as const).map(k => (
                                <td key={k} className="py-2 px-3 text-slate-900 font-bold tabular-nums text-center">
                                  {fd.day_wise.reduce((s,r) => s + r[k], 0)}
                                </td>
                              ))}
                              <td className="py-2 px-3 text-slate-900 font-bold tabular-nums">{fd.fatal_count}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Week & Scenario Wise Fatal Count */}
                  {fd.week_scenario.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 card-header gap-2 px-5 py-3">
                        <div className="w-1 h-4 rounded-full bg-red-500" />
                        <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Week &amp; Scenario Wise Fatal Count</h3>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            {['Week','Query','Complaint','Request','Sale Done','Total'].map(h => (
                              <th key={h} className="py-2 px-3 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...fd.week_scenario].reverse().map((r, i) => (
                            <tr key={i} className="border-b border-slate-100">
                              <td className="py-2.5 px-3 text-slate-900 font-semibold">{r.week_label}</td>
                              {[r.query_fatal_pct, r.complaint_fatal_pct, r.request_fatal_pct, r.sale_done_fatal_pct].map((v, ci) => (
                                <td key={ci} className="py-2.5 px-3">{pctCell(v)}</td>
                              ))}
                              <td className="py-2.5 px-3 text-slate-700 font-bold tabular-nums">{r.total_fatal}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200">
                          <tr className="bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-900 font-semibold text-[10px] uppercase">Grand total</td>
                            {[
                              fd.query_fatal    > 0 ? Math.round(fd.query_fatal    / (fd.audit_count||1) * 1000)/10 : 0,
                              fd.complaint_fatal > 0 ? Math.round(fd.complaint_fatal / (fd.audit_count||1) * 1000)/10 : 0,
                              fd.request_fatal  > 0 ? Math.round(fd.request_fatal  / (fd.audit_count||1) * 1000)/10 : 0,
                              fd.sale_done_fatal > 0 ? Math.round(fd.sale_done_fatal / (fd.audit_count||1) * 1000)/10 : 0,
                            ].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-3">{pctCell(v)}</td>
                            ))}
                            <td className="py-2.5 px-3 text-slate-900 font-bold tabular-nums">{fd.fatal_count}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Agent Wise Performance (full width) ── */}
              {fd.agent_performance.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 card-header gap-2 px-5 py-3">
                    <div className="w-1 h-4 rounded-full bg-red-500" />
                    <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Agent Wise Performance</h3>
                    <ExportBtn onClick={() => downloadCSV(fd.agent_performance.map(r => ({ 'MAS ID': r.agent_name, Agent: resolveAgent(r.agent_name), Audits: r.audit_count, 'CQ Score%': r.cq_score, Fatals: r.fatal_count, 'Fatal%': r.fatal_pct, 'Below Avg%': r.below_avg_pct, 'Avg%': r.avg_pct, 'Good%': r.good_pct, 'Excellent%': r.excellent_pct })), 'agent-performance.csv')} />
                  </div>
                  <div className="overflow-x-auto overflow-y-auto max-h-80">
                    <table className="w-full text-xs min-w-[800px]">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b border-slate-200 bg-slate-50">
                          {['Agent Name','Audit Count','CQ Score%','Fatal Count','Fatal%','Below Avg Call','Average Calls','Good Calls','Excellent Calls'].map(h => (
                            <th key={h} className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {fd.agent_performance.map((r, i) => (
                          <tr key={i}
                            className={`border-b border-slate-100 ${i % 2 === 0 ? '' : 'bg-transparent'} cursor-pointer hover:bg-slate-100 transition-colors`}
                            title={`Click to drill into ${resolveAgent(r.agent_name)}'s calls`}
                            onClick={() => openBandDetail('no_fatal', `${resolveAgent(r.agent_name)} — Call Breakdown`, r.cq_score >= 90 ? '#22C55E' : '#F59E0B', r.agent_name)}>
                            <td className="py-2.5 px-4 text-slate-900 font-semibold whitespace-nowrap">{agentTag(r.agent_name)}</td>
                            <td className="py-2.5 px-4 tabular-nums text-slate-900 font-medium">{r.audit_count}</td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2 min-w-[80px]">
                                <div className="flex-1 h-4 rounded bg-slate-100 overflow-hidden">
                                  <div className="h-full rounded flex items-center justify-center text-[9px] font-bold text-slate-900"
                                    style={{
                                      width: `${Math.min(r.cq_score, 100)}%`,
                                      background: r.cq_score >= 90 ? '#22C55E' : r.cq_score >= 85 ? '#F59E0B' : '#EF4444',
                                    }}>
                                    {r.cq_score}%
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 font-bold tabular-nums" style={{ color: r.fatal_count > 0 ? '#DC2626' : '#0F172A' }}>{r.fatal_count}</td>
                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                                style={{ background: r.fatal_pct > 0 ? 'rgba(239,68,68,0.15)' : 'transparent', color: r.fatal_pct > 0 ? '#DC2626' : '#0F172A' }}>
                                {r.fatal_pct}%
                              </span>
                            </td>
                            {[r.below_avg_pct, r.avg_pct, r.good_pct, r.excellent_pct].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-4 tabular-nums text-slate-900 font-medium">{v > 0 ? `${v}%` : '0%'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-slate-200">
                        <tr className="bg-slate-50">
                          <td className="py-2.5 px-4 text-slate-900 font-semibold text-[10px] uppercase">Grand total</td>
                          <td className="py-2.5 px-4 text-slate-900 font-bold tabular-nums">{gt.audit}</td>
                          <td className="py-2.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold"
                              style={{ background: gtCq >= 90 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: gtCq >= 90 ? '#22C55E' : '#EF4444' }}>
                              {gtCq}%
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-red-400 font-bold tabular-nums">{gt.fatal}</td>
                          <td className="py-2.5 px-4 text-red-400 font-bold">{gtFp}%</td>
                          {fd.agent_performance.length > 0 && (() => {
                            const totAudit = gt.audit;
                            const totBelow  = fd.agent_performance.reduce((s,r) => s + Math.round(r.below_avg_pct * r.audit_count / 100), 0);
                            const totAvg    = fd.agent_performance.reduce((s,r) => s + Math.round(r.avg_pct       * r.audit_count / 100), 0);
                            const totGood   = fd.agent_performance.reduce((s,r) => s + Math.round(r.good_pct      * r.audit_count / 100), 0);
                            const totExc    = fd.agent_performance.reduce((s,r) => s + Math.round(r.excellent_pct * r.audit_count / 100), 0);
                            return [totBelow, totAvg, totGood, totExc].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-4 text-slate-600 font-bold tabular-nums">
                                {totAudit > 0 ? `${Math.round(v / totAudit * 1000)/10}%` : '0%'}
                              </td>
                            ));
                          })()}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* ── Detail Analysis Slide ───────────────────────────────────── */}
        {activeSlide === 2 && (() => {
          const dd = detailData;
          if (detailLoading || !dd) {
            return (
              <div className="flex items-center justify-center py-20 text-slate-600 text-sm">
                {detailLoading ? 'Loading detail analysis…' : 'No data for this period.'}
              </div>
            );
          }

          const deltaVsTarget = (dd.cq_score - 98).toFixed(1);

          const scenColor = (scenario: string) =>
            scenario === 'Complaint' ? '#EF4444' : '#22C55E';

          const auditHeatBg = (val: number, max: number) => {
            if (!val || !max) return '';
            const a = 0.12 + (val / max) * 0.55;
            return `rgba(34,197,94,${a.toFixed(2)})`;
          };

          const dayMax = Math.max(...dd.day_wise_audit.map(r => r.total), 1);

          const pctCellDetail = (val: number, color = '#22C55E') => {
            const bg = val > 0 ? `${color}22` : 'transparent';
            const fg = val > 0 ? color : '#64748B';
            return (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ color: fg, background: bg }}>
                {val > 0 ? `${val}%` : '0%'}
              </span>
            );
          };

          return (
            <>
              {/* ── KPI Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  {
                    label: 'CQ Score%', value: `${dd.cq_score}%`,
                    sub: <span className={`text-[10px] font-bold flex items-center gap-0.5 ${Number(deltaVsTarget) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {Number(deltaVsTarget) < 0 ? '▼' : '▲'} {deltaVsTarget}%
                    </span>,
                    color: dd.cq_score >= 90 ? '#22C55E' : '#EF4444',
                    onClick: () => setDrillModal({ title: 'Detail Analysis — Scenario Panels', accent: dd.cq_score >= 90 ? '#22C55E' : '#EF4444', columns: [{ key: 'Scenario', label: 'Scenario' }, { key: 'Sub-Scenario', label: 'Sub-Scenario' }, { key: 'Count', label: 'Count' }, { key: '%', label: '%' }], rows: dd.scenario_panels.flatMap(p => p.items.map(it => ({ Scenario: p.scenario, 'Sub-Scenario': it.scenario1, Count: it.count, '%': `${it.pct}%` }))) }),
                  },
                  {
                    label: 'Audit Count', value: dd.audit_count.toLocaleString(), sub: null, color: '#38BDF8',
                    onClick: () => setDrillModal({ title: 'Detail Analysis — Day Wise Audit Count', accent: '#38BDF8', columns: [{ key: 'Date', label: 'Date' }, { key: 'Complaint', label: 'Complaint' }, { key: 'Request', label: 'Request' }, { key: 'Query', label: 'Query' }, { key: 'Total', label: 'Total' }], rows: dd.day_wise_audit.map(r => ({ Date: r.call_date, Complaint: r.complaint, Request: r.request, Query: r.query, Total: r.total })) }),
                  },
                  {
                    label: 'Fatal Count', value: dd.fatal_count.toLocaleString(), sub: null, color: '#EF4444',
                    onClick: () => setDrillModal({ title: 'Detail Analysis — Scenario Count Breakdown', accent: '#EF4444', columns: [{ key: 'Scenario', label: 'Scenario' }, { key: 'Count', label: 'Count' }], rows: [{ Scenario: 'Query', Count: dd.query_count }, { Scenario: 'Complaint', Count: dd.complaint_count }, { Scenario: 'Request', Count: dd.request_count }, { Scenario: 'Sale Done', Count: dd.sale_done_count }] }),
                  },
                  {
                    label: 'Fatal%',      value: `${dd.fatal_pct}%`, sub: null, color: dd.fatal_pct >= 20 ? '#EF4444' : '#F59E0B',
                    onClick: () => setDrillModal({ title: 'Detail Analysis — Week & Scenario Audit%', accent: '#F59E0B', columns: [{ key: 'Week', label: 'Week' }, { key: 'Query%', label: 'Query%' }, { key: 'Complaint%', label: 'Complaint%' }, { key: 'Request%', label: 'Request%' }, { key: 'Sale Done%', label: 'Sale Done%' }, { key: 'Total', label: 'Total' }], rows: dd.week_scenario_audit.map(r => ({ Week: r.week_label, 'Query%': `${r.query_pct}%`, 'Complaint%': `${r.complaint_pct}%`, 'Request%': `${r.request_pct}%`, 'Sale Done%': `${r.sale_done_pct}%`, Total: r.total })) }),
                  },
                ].map(c => (
                  <div key={c.label}
                    className="relative bg-white rounded-xl px-4 py-4 overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                    style={{ border: `2px solid ${c.color}` }}
                    onClick={c.onClick}
                    title="Click for detail analysis">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl" style={{ background: c.color }} />
                    <div className="pl-3">
                      <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: c.color }}>{c.label}</p>
                      <p className="text-2xl font-black text-slate-900 leading-none tabular-nums">{c.value}</p>
                      {c.sub && <div className="mt-1">{c.sub}</div>}
                      <p className="text-[9px] text-slate-400 mt-1.5 font-semibold">↗ Click to analyse</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Two-column layout ── */}
              <div className="grid lg:grid-cols-2 gap-4 mb-4">

                {/* LEFT — Scenario panels stacked */}
                <div className="space-y-4">
                  {dd.scenario_panels.filter(p => p.scenario !== 'Sale Done' && p.scenario !== 'Repeat').map(panel => {
                    const color = scenColor(panel.scenario);
                    const pieData = panel.items.map(it => ({ name: it.scenario1, value: it.count }));
                    const PIE_COLORS = ['#3B82F6','#22C55E','#F59E0B','#A855F7','#EF4444'];
                    return (
                      <div key={panel.scenario} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center gap-2"
                          style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                          <div className="w-1.5 h-4 rounded-full" style={{ background: color }} />
                          <h3 className="text-xs font-black text-white uppercase tracking-widest">
                            Top 5 {panel.scenario}
                          </h3>
                          <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, background: `${color}22` }}>
                            {panel.total_count.toLocaleString()} audits
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row">
                          <div className="sm:w-[55%] overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  {['Scenario 1','Count','%'].map(h => (
                                    <th key={h} className="py-2 px-3 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {panel.items.map((it, i) => (
                                  <tr key={i} className={`border-b border-slate-100 ${i % 2 ? 'bg-transparent' : ''}`}>
                                    <td className="py-2 px-3 text-slate-700 leading-snug">{it.scenario1}</td>
                                    <td className="py-2 px-3 text-slate-600 font-semibold tabular-nums">{it.count.toLocaleString()}</td>
                                    <td className="py-2 px-3 tabular-nums">
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden max-w-[40px]">
                                          <div className="h-full rounded-full" style={{ width: `${it.pct}%`, background: color }} />
                                        </div>
                                        <span className="text-slate-400 text-[9px]">{it.pct}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="sm:w-[45%] border-t sm:border-t-0 sm:border-l border-slate-200 flex flex-col items-center justify-center py-2">
                            <ResponsiveContainer width="100%" height={140}>
                              <PieChart>
                                <Pie
                                  data={pieData}
                                  dataKey="value"
                                  cx="50%" cy="50%"
                                  outerRadius={58}
                                  innerRadius={22}
                                  paddingAngle={2}
                                  labelLine={false}
                                  label={({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: {
                                    cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number;
                                  }) => {
                                    if (percent < 0.06) return null;
                                    const R = Math.PI / 180;
                                    const r = innerRadius + (outerRadius - innerRadius) * 0.6;
                                    return (
                                      <text
                                        x={cx + r * Math.cos(-midAngle * R)}
                                        y={cy + r * Math.sin(-midAngle * R)}
                                        fill="#fff" textAnchor="middle" dominantBaseline="central"
                                        fontSize={9} fontWeight={700}>
                                        {`${(percent * 100).toFixed(0)}%`}
                                      </text>
                                    );
                                  }}
                                >
                                  {pieData.map((_, pi) => (
                                    <Cell key={pi} fill={PIE_COLORS[pi % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{ background: '#FFFFFF', border: '1px solid #ffffff15', borderRadius: 8, fontSize: 10 }}
                                  formatter={(v: unknown, n: unknown) => [`${Number(v).toLocaleString()} calls`, String(n)]}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 px-2 pb-2">
                              {pieData.map((d, pi) => (
                                <div key={pi} className="flex items-center gap-1 text-[9px]">
                                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PIE_COLORS[pi % PIE_COLORS.length] }} />
                                  <span className="text-slate-600 truncate max-w-[80px]">{d.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* RIGHT — Scenario count cards + heat maps */}
                <div className="space-y-4">

                  {/* Scenario Wise Count — 4 cards */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #0369A1' }}>
                    <div className="card-header gap-2 px-5 py-3" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                      <div className="w-1.5 h-4 rounded-full bg-blue-300" />
                      <h3 className="text-xs font-black text-white uppercase tracking-widest">Scenario Wise Count</h3>
                    </div>
                    <div className="grid grid-cols-4 divide-x divide-slate-200">
                      {[
                        { label: 'Query Count',     value: dd.query_count,     color: '#22C55E' },
                        { label: 'Complaint Count',  value: dd.complaint_count, color: '#EF4444' },
                        { label: 'Request Count',    value: dd.request_count,   color: '#22C55E' },
                        { label: 'Sale Done Count',  value: dd.sale_done_count, color: '#22C55E' },
                      ].map(c => (
                        <div key={c.label} className="px-2 py-4 text-center">
                          <p className="text-[8px] text-slate-500 uppercase tracking-wider mb-1 leading-tight">{c.label}</p>
                          <p className="text-xl font-bold" style={{ color: c.value > 0 ? c.color : '#475569' }}>
                            {c.value.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Day Wise / Audit Count heat map */}
                  {dd.day_wise_audit.length > 0 && (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #0369A1' }}>
                      <div className="card-header gap-2 px-5 py-3" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                        <div className="w-1.5 h-4 rounded-full bg-blue-300" />
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Day Wise / Audit Count</h3>
                      </div>
                      <div className="overflow-y-auto max-h-52">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-white z-10">
                            <tr className="border-b border-slate-200 bg-slate-50">
                              {['Date','Complaint','Request','Query','Total'].map(h => (
                                <th key={h} className="py-2 px-3 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {dd.day_wise_audit.map((r, i) => (
                              <tr key={i} className="border-b border-slate-100">
                                <td className="py-2 px-3 text-slate-900 font-medium whitespace-nowrap">
                                  {r.call_date.slice(5).replace('-', '/')}
                                </td>
                                {[r.complaint, r.request, r.query].map((v, ci) => (
                                  <td key={ci} className="py-2 px-3 tabular-nums text-center font-semibold"
                                    style={{ background: auditHeatBg(v, dayMax), color: v > 0 ? '#0F172A' : '#0F172A' }}>
                                    {v > 0 ? v : '—'}
                                  </td>
                                ))}
                                <td className="py-2 px-3 text-slate-900 font-bold tabular-nums">{r.total}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-slate-200">
                            <tr className="bg-slate-50">
                              <td className="py-2 px-3 text-slate-900 font-semibold text-[10px]">Grand total</td>
                              {(['complaint','request','query'] as const).map(k => (
                                <td key={k} className="py-2 px-3 text-slate-900 font-bold tabular-nums text-center">
                                  {dd.day_wise_audit.reduce((s, r) => s + r[k], 0)}
                                </td>
                              ))}
                              <td className="py-2 px-3 text-slate-900 font-bold tabular-nums">{dd.audit_count}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Week & Scenario Wise Audit Count */}
                  {dd.week_scenario_audit.length > 0 && (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #0369A1' }}>
                      <div className="card-header gap-2 px-5 py-3" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                        <div className="w-1.5 h-4 rounded-full bg-blue-300" />
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Week &amp; Scenario Wise Audit Count</h3>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            {['Week','Query%','Complaint%','Request%','Sale Done%','Total'].map(h => (
                              <th key={h} className="py-2 px-3 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dd.week_scenario_audit.map((r, i) => (
                            <tr key={i} className="border-b border-slate-100">
                              <td className="py-2.5 px-3 text-slate-900 font-semibold">{r.week_label}</td>
                              <td className="py-2.5 px-3">{pctCellDetail(r.query_pct,     '#22C55E')}</td>
                              <td className="py-2.5 px-3">{pctCellDetail(r.complaint_pct, '#EF4444')}</td>
                              <td className="py-2.5 px-3">{pctCellDetail(r.request_pct,   '#22C55E')}</td>
                              <td className="py-2.5 px-3">{pctCellDetail(r.sale_done_pct, '#22C55E')}</td>
                              <td className="py-2.5 px-3 text-slate-700 font-bold tabular-nums">{r.total.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200">
                          <tr className="bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-900 font-semibold text-[10px] uppercase">Grand total</td>
                            {(() => {
                              const tot = dd.audit_count || 1;
                              return [
                                { v: Math.round(dd.query_count     / tot * 100), color: '#22C55E' },
                                { v: Math.round(dd.complaint_count  / tot * 100), color: '#EF4444' },
                                { v: Math.round(dd.request_count    / tot * 100), color: '#22C55E' },
                                { v: Math.round(dd.sale_done_count  / tot * 100), color: '#22C55E' },
                              ].map(({ v, color }, ci) => (
                                <td key={ci} className="py-2.5 px-3">{pctCellDetail(v, color)}</td>
                              ));
                            })()}
                            <td className="py-2.5 px-3 text-slate-900 font-bold tabular-nums">{dd.audit_count.toLocaleString()}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Agent & Parameter Wise CQ Score% ── */}
              <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid #0369A1' }}>
                <div className="card-header gap-3 px-5 py-3 flex-wrap" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                  <div className="w-1.5 h-4 rounded-full bg-blue-400 shrink-0" />
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Agent &amp; Parameter Wise CQ Score%</h3>
                  <ExportBtn onClick={() => downloadCSV(agentParamData.map(r => ({ 'MAS ID': r.agent_name, Agent: resolveAgent(r.agent_name), 'TQ/MQ/BQ': r.cq_score > 95 ? 'TQ' : r.cq_score > 85 ? 'MQ' : 'BQ', Audits: r.audit_count, 'CQ Score%': r.cq_score, Fatals: r.fatal_count, 'Fatal%': r.fatal_pct, 'Opening%': r.opening_skill, 'Soft Skill%': r.soft_skill, 'Hold%': r.hold_procedure, 'Resolution%': r.resolution, 'Closing%': r.closing })), 'agent-param.csv')} />
                  <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider">Scenario Wise</span>
                    <select
                      value={agentParamScenario}
                      onChange={e => setAgentParamScenario(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                    >
                      <option value="">Select Scenario Wise</option>
                      {scenarios.map(s => (
                        <option key={s.scenario} value={s.scenario}>{s.scenario}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {agentParamLoading ? (
                  <div className="py-8 text-center text-slate-600 text-xs">Loading…</div>
                ) : agentParamData.length === 0 ? (
                  <div className="py-8 text-center text-slate-600 text-xs">No data for this period.</div>
                ) : (() => {
                  const gt = agentParamData.reduce((acc, r) => ({
                    audit: acc.audit + r.audit_count,
                    fatal: acc.fatal + r.fatal_count,
                    cqSum: acc.cqSum + r.cq_score * r.audit_count,
                    opening: acc.opening + r.opening_skill * r.audit_count,
                    soft: acc.soft + r.soft_skill * r.audit_count,
                    hold: acc.hold + r.hold_procedure * r.audit_count,
                    res: acc.res + r.resolution * r.audit_count,
                    closing: acc.closing + r.closing * r.audit_count,
                  }), { audit: 0, fatal: 0, cqSum: 0, opening: 0, soft: 0, hold: 0, res: 0, closing: 0 });
                  const wa = gt.audit || 1;
                  const scoreCell = (v: number) => (
                    <span className="font-semibold" style={{ color: v >= 90 ? '#22C55E' : v >= 85 ? '#F59E0B' : v > 0 ? '#EF4444' : '#64748B' }}>
                      {v > 0 ? `${v}%` : '0%'}
                    </span>
                  );
                  const tqBadge = (score: number) => {
                const label = score >= 90 ? 'TQ' : score >= 80 ? 'MQ' : 'BQ';
                    const c = label === 'TQ'
                      ? { bg: '#22C55E1A', text: '#22C55E', border: '#22C55E40' }
                      : label === 'MQ'
                      ? { bg: '#F59E0B1A', text: '#F59E0B', border: '#F59E0B40' }
                      : { bg: '#EF44441A', text: '#EF4444', border: '#EF444440' };
                    return (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border"
                        style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                        {label}
                      </span>
                    );
                  };
                  return (
                    <div className="overflow-x-auto overflow-y-auto max-h-72">
                      <table className="w-full text-xs min-w-[900px]">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-slate-200 bg-slate-50">
                            {['Agent Name','TQ/MQ/BQ','Audit Count','CQ Score%','Fatal Count','Fatal%','Opening Score%','Soft Skills Score%','Hold Procedure%','Resolution Score%','Closing Score%'].map(h => (
                              <th key={h} className="py-2.5 px-3 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {agentParamData.map((r, i) => (
                            <tr key={i} className={`border-b border-slate-100 ${i % 2 ? 'bg-transparent' : ''}`}>
                              <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{agentTag(r.agent_name)}</td>
                              <td className="py-2.5 px-3">{tqBadge(r.cq_score)}</td>
                              <td className="py-2.5 px-3 text-slate-600 tabular-nums">{r.audit_count}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.cq_score)}</td>
                              <td className="py-2.5 px-3 text-slate-600 tabular-nums">{r.fatal_count}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold" style={{ color: r.fatal_pct > 0 ? '#EF4444' : '#64748B' }}>{r.fatal_pct}%</span>
                              </td>
                              <td className="py-2.5 px-3">{scoreCell(r.opening_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.soft_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.hold_procedure)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.resolution)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.closing)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200">
                          <tr className="bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-900 font-semibold text-[10px] uppercase">Grand total</td>
                            <td className="py-2.5 px-3">{tqBadge(Math.round(gt.cqSum / wa * 10) / 10)}</td>
                            <td className="py-2.5 px-3 text-slate-900 font-bold tabular-nums">{gt.audit}</td>
                            <td className="py-2.5 px-3">{scoreCell(Math.round(gt.cqSum / wa * 10) / 10)}</td>
                            <td className="py-2.5 px-3 text-slate-900 font-bold tabular-nums">{gt.fatal}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold" style={{ color: gt.fatal > 0 ? '#EF4444' : '#64748B' }}>
                                {gt.audit > 0 ? `${Math.round(gt.fatal / gt.audit * 1000) / 10}%` : '0%'}
                              </span>
                            </td>
                            {[gt.opening, gt.soft, gt.hold, gt.res, gt.closing].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-3">{scoreCell(Math.round(v / wa * 10) / 10)}</td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* ── Week Wise Quality Performance ── */}
              <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid #0369A1' }}>
                <div className="card-header gap-3 px-5 py-3 flex-wrap" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                  <div className="w-1.5 h-4 rounded-full bg-blue-400 shrink-0" />
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Week Wise Quality Performance</h3>
                  <div className="ml-auto flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 uppercase tracking-wider">Scenario Wise</span>
                      <select
                        value={weekWiseScenario}
                        onChange={e => setWeekWiseScenario(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Select Scenario Wise</option>
                        {scenarios.map(s => (
                          <option key={s.scenario} value={s.scenario}>{s.scenario}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 uppercase tracking-wider">Agent Username</span>
                      <select
                        value={weekWiseAgent}
                        onChange={e => setWeekWiseAgent(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Select Agent Name</option>
                        {agentParamData.map(a => (
                          <option key={a.agent_name} value={a.agent_name}>{resolveAgent(a.agent_name)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                {weekWiseLoading ? (
                  <div className="py-8 text-center text-slate-600 text-xs">Loading…</div>
                ) : weekWiseData.length === 0 ? (
                  <div className="py-8 text-center text-slate-600 text-xs">No data for this period.</div>
                ) : (() => {
                  const gt = weekWiseData.reduce((acc, r) => ({
                    audit: acc.audit + r.audit_count,
                    fatal: acc.fatal + r.fatal_count,
                    cqSum: acc.cqSum + r.cq_score * r.audit_count,
                    opening: acc.opening + r.opening_skill * r.audit_count,
                    soft: acc.soft + r.soft_skill * r.audit_count,
                    hold: acc.hold + r.hold_procedure * r.audit_count,
                    res: acc.res + r.resolution * r.audit_count,
                    closing: acc.closing + r.closing * r.audit_count,
                  }), { audit: 0, fatal: 0, cqSum: 0, opening: 0, soft: 0, hold: 0, res: 0, closing: 0 });
                  const wa = gt.audit || 1;
                  const scoreCell = (v: number) => (
                    <span className="font-semibold" style={{ color: v >= 90 ? '#22C55E' : v >= 85 ? '#F59E0B' : v > 0 ? '#EF4444' : '#64748B' }}>
                      {v > 0 ? `${v}%` : '0%'}
                    </span>
                  );
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[900px]">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            {['Week','Audit Count','CQ Score%','Fatal Count','Fatal%','Opening Score%','Soft Skills Score%','Hold Procedure Score%','Resolution Score%','Closing Score%'].map(h => (
                              <th key={h} className="py-2.5 px-3 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {weekWiseData.map((r, i) => (
                            <tr key={i} className={`border-b border-slate-100 ${i % 2 ? 'bg-transparent' : ''}`}>
                              <td className="py-2.5 px-3 text-slate-900 font-semibold">{r.week_label}</td>
                              <td className="py-2.5 px-3 text-slate-600 tabular-nums">{r.audit_count}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.cq_score)}</td>
                              <td className="py-2.5 px-3 text-slate-600 tabular-nums">{r.fatal_count}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold" style={{ color: r.fatal_pct > 0 ? '#EF4444' : '#64748B' }}>{r.fatal_pct}%</span>
                              </td>
                              <td className="py-2.5 px-3">{scoreCell(r.opening_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.soft_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.hold_procedure)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.resolution)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.closing)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200">
                          <tr className="bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-900 font-semibold text-[10px] uppercase">Grand total</td>
                            <td className="py-2.5 px-3 text-slate-900 font-bold tabular-nums">{gt.audit}</td>
                            <td className="py-2.5 px-3">{scoreCell(Math.round(gt.cqSum / wa * 10) / 10)}</td>
                            <td className="py-2.5 px-3 text-slate-900 font-bold tabular-nums">{gt.fatal}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold" style={{ color: gt.fatal > 0 ? '#EF4444' : '#64748B' }}>
                                {gt.audit > 0 ? `${Math.round(gt.fatal / gt.audit * 1000) / 10}%` : '0%'}
                              </span>
                            </td>
                            {[gt.opening, gt.soft, gt.hold, gt.res, gt.closing].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-3">{scoreCell(Math.round(v / wa * 10) / 10)}</td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* ── Day Wise Quality Performance ── */}
              <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid #0369A1' }}>
                <div className="card-header gap-3 px-5 py-3 flex-wrap" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                  <div className="w-1.5 h-4 rounded-full bg-blue-400 shrink-0" />
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Day Wise Quality Performance</h3>
                  <div className="ml-auto flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Scenario</span>
                      <select
                        value={dayWiseScenario}
                        onChange={e => setDayWiseScenario(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Select Scenario Wise</option>
                        {scenarios.map(s => (
                          <option key={s.scenario} value={s.scenario}>{s.scenario}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 uppercase tracking-wider">Agent</span>
                      <select
                        value={dayWiseAgent}
                        onChange={e => setDayWiseAgent(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Select Agent Name</option>
                        {agentParamData.map(a => (
                          <option key={a.agent_name} value={a.agent_name}>{resolveAgent(a.agent_name)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                {dayWiseLoading ? (
                  <div className="py-8 text-center text-slate-600 text-xs">Loading…</div>
                ) : dayWiseData.length === 0 ? (
                  <div className="py-8 text-center text-slate-600 text-xs">No data for this period.</div>
                ) : (() => {
                  const gt = dayWiseData.reduce((acc, r) => ({
                    audit: acc.audit + r.audit_count,
                    fatal: acc.fatal + r.fatal_count,
                    cqSum: acc.cqSum + r.cq_score * r.audit_count,
                    opening: acc.opening + r.opening_skill * r.audit_count,
                    soft: acc.soft + r.soft_skill * r.audit_count,
                    hold: acc.hold + r.hold_procedure * r.audit_count,
                    res: acc.res + r.resolution * r.audit_count,
                    closing: acc.closing + r.closing * r.audit_count,
                  }), { audit: 0, fatal: 0, cqSum: 0, opening: 0, soft: 0, hold: 0, res: 0, closing: 0 });
                  const wa = gt.audit || 1;
                  const scoreCell = (v: number) => (
                    <span className="font-semibold" style={{ color: v >= 90 ? '#22C55E' : v >= 85 ? '#F59E0B' : v > 0 ? '#EF4444' : '#64748B' }}>
                      {v > 0 ? `${v}%` : '0%'}
                    </span>
                  );
                  return (
                    <div className="overflow-x-auto overflow-y-auto max-h-72">
                      <table className="w-full text-xs min-w-[900px]">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="border-b border-slate-200 bg-slate-50">
                            {['Date','Audit Count','CQ Score%','Fatal Count','Fatal%','Opening Score%','Soft Skills Score%','Hold Procedure%','Resolution Score%','Closing Score%'].map(h => (
                              <th key={h} className="py-2.5 px-3 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dayWiseData.map((r, i) => (
                            <tr key={i} className={`border-b border-slate-100 ${i % 2 ? 'bg-transparent' : ''}`}>
                              <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{r.call_date.slice(5).replace('-', '/')}</td>
                              <td className="py-2.5 px-3 text-slate-600 tabular-nums">{r.audit_count}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.cq_score)}</td>
                              <td className="py-2.5 px-3 text-slate-600 tabular-nums">{r.fatal_count}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold" style={{ color: r.fatal_pct > 0 ? '#EF4444' : '#64748B' }}>{r.fatal_pct}%</span>
                              </td>
                              <td className="py-2.5 px-3">{scoreCell(r.opening_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.soft_skill)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.hold_procedure)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.resolution)}</td>
                              <td className="py-2.5 px-3">{scoreCell(r.closing)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200">
                          <tr className="bg-slate-50">
                            <td className="py-2.5 px-3 text-slate-900 font-semibold text-[10px] uppercase">Grand total</td>
                            <td className="py-2.5 px-3 text-slate-900 font-bold tabular-nums">{gt.audit}</td>
                            <td className="py-2.5 px-3">{scoreCell(Math.round(gt.cqSum / wa * 10) / 10)}</td>
                            <td className="py-2.5 px-3 text-slate-900 font-bold tabular-nums">{gt.fatal}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold" style={{ color: gt.fatal > 0 ? '#EF4444' : '#64748B' }}>
                                {gt.audit > 0 ? `${Math.round(gt.fatal / gt.audit * 1000) / 10}%` : '0%'}
                              </span>
                            </td>
                            {[gt.opening, gt.soft, gt.hold, gt.res, gt.closing].map((v, ci) => (
                              <td key={ci} className="py-2.5 px-3">{scoreCell(Math.round(v / wa * 10) / 10)}</td>
                            ))}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}
              </div>
              {/* ── Quality Parameters ── */}
              <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid #0369A1' }}>
                <div className="card-header gap-3 px-5 py-3 flex-wrap" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                  <div className="w-1.5 h-4 rounded-full bg-blue-400 shrink-0" />
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Quality Parameters</h3>
                  <span className="text-[10px] font-semibold ml-1" style={{ color: 'rgba(255,255,255,0.65)' }}>count &amp; score by parameter</span>
                  <ExportBtn onClick={() => downloadCSV(qualityParamData.map(r => ({ Parameter: r.parameter, 'Hit Count': r.hit_count, 'Applicable Count': r.total_count, 'Score%': r.score_pct })), 'quality-parameters.csv')} />
                  <div className="ml-auto flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider">Scenario</span>
                      <select
                        value={qualityParamScenario}
                        onChange={e => setQualityParamScenario(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">All Scenarios</option>
                        {scenarios.map(s => (
                          <option key={s.scenario} value={s.scenario}>{s.scenario}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 uppercase tracking-wider">Agent</span>
                      <select
                        value={qualityParamAgent}
                        onChange={e => setQualityParamAgent(e.target.value)}
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                      >
                        <option value="">All Agents</option>
                        {agentParamData.map(a => (
                          <option key={a.agent_name} value={a.agent_name}>{resolveAgent(a.agent_name)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {qualityParamLoading ? (
                  <div className="py-8 text-center text-slate-600 text-xs">Loading…</div>
                ) : qualityParamData.length === 0 ? (
                  <div className="py-8 text-center text-slate-600 text-xs">No data for this period.</div>
                ) : (
                  /* show top 10 rows (~440px), rest scrollable */
                  <div className="overflow-y-auto" style={{ maxHeight: '440px' }}>
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white z-10">
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px]">#</th>
                          <th className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px]">Parameter</th>
                          <th className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px]">Hit Count</th>
                          <th className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px]">Applicable Count</th>
                          <th className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px] min-w-[180px]">Score%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qualityParamData.map((r, i) => {
                          const color = r.score_pct >= 90 ? '#22C55E' : r.score_pct >= 70 ? '#F59E0B' : r.score_pct > 0 ? '#EF4444' : '#64748B';
                          return (
                            <tr key={i}
                              className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50' : 'bg-white'} ${i === 9 ? 'border-b-2 border-blue-400/30' : ''} cursor-pointer hover:bg-blue-50 transition-colors`}
                              title={`Click to view ${r.parameter} detail`}
                              onClick={() => setDrillModal({ title: `Quality Parameter — ${r.parameter}`, accent: color, columns: [{ key: 'Parameter', label: 'Parameter' }, { key: 'Hit Count', label: 'Hit Count' }, { key: 'Applicable Count', label: 'Applicable Count' }, { key: 'Score%', label: 'Score%' }], rows: [{ Parameter: r.parameter, 'Hit Count': r.hit_count, 'Applicable Count': r.total_count, 'Score%': `${r.score_pct}%` }] })}>
                              <td className="py-3 px-4 text-slate-600 tabular-nums font-bold">{i + 1}</td>
                              <td className="py-3 px-4 text-slate-900 font-semibold">{r.parameter}</td>
                              <td className="py-3 px-4 tabular-nums">
                                <span className="font-bold text-slate-900">{r.hit_count.toLocaleString()}</span>
                                <span className="text-slate-600 text-[10px] ml-1 font-semibold">hits</span>
                              </td>
                              <td className="py-3 px-4 text-slate-900 tabular-nums font-semibold">{r.total_count.toLocaleString()}</td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[140px]">
                                    <div className="h-full rounded-full transition-all duration-500"
                                      style={{ width: `${r.score_pct}%`, background: color }} />
                                  </div>
                                  <span className="text-xs font-bold tabular-nums shrink-0" style={{ color }}>
                                    {r.score_pct}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {qualityParamData.length > 10 && (
                      <div className="px-4 py-2 border-t border-slate-200 text-[10px] text-slate-400 text-center">
                        Showing {qualityParamData.length} parameters · scroll to see all
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* ── Process Analysis slide (CLAP) ──────────────────────────────────── */}
        {activeSlide === 4 && (() => {
          const cd = clapAnalysis;
          const CARD_COLORS: Record<string, { bg: string; text: string; border: string; icon: string; accent: string }> = {
            Customer: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: '👤', accent: '#3B82F6' },
            Logistic: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: '🚚', accent: '#F59E0B' },
            Agent:    { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: '🎧', accent: '#E11D48' },
            Product:  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: '📦', accent: '#10B981' },
          };
          const PARAM_TIPS: Record<string, string> = {
            call_answered_within_5_seconds:     'Answer calls within the first ring. Check headset readiness and auto-answer settings.',
            customer_concern_acknowledged:      'Echo the customer\'s concern at call start. Use: "I understand you\'re calling about…"',
            professionalism_maintained:         'Maintain formal tone throughout. Avoid casual phrases, slang, or informal greetings.',
            assurance_or_appreciation_provided: 'Thank the customer for their patience. Use confidence statements like "I\'ll make sure this is resolved".',
            pronunciation_and_clarity:          'Speak slowly and clearly. Practice product names and technical terms during pre-shift review.',
            enthusiasm_and_no_fumbling:         'Prepare call scripts and product knowledge to reduce hesitation. Practice with call recordings.',
            active_listening:                   'Use affirmations: "I see", "absolutely", "understood". Avoid interrupting the customer mid-sentence.',
            politeness_and_no_sarcasm:          'Always use "please", "thank you", "sir/ma\'am". Listen to own recordings to detect tone issues.',
            proper_grammar:                     'Review communication training. Use complete sentences. Avoid broken language or half-formed responses.',
            accurate_issue_probing:             'Ask structured questions to identify root cause before suggesting solutions. Don\'t assume the issue.',
            proper_hold_procedure:              'Always ask permission before hold: "May I put you on hold for 2 minutes?" Inform before unmuting.',
            proper_transfer_and_language:       'Do warm transfers with full context briefing. Use the standard transfer script consistently.',
            dead_air_under_10_seconds:          'Fill silence with status updates: "I\'m looking into this for you." Never go silent for 10+ seconds.',
            case_escalated_correctly:           'Follow the escalation matrix strictly. Document the full case before escalating to the next level.',
            address_recorded_completely:        'Confirm all address fields: house/flat number, street, area, city, and pincode before closing.',
            correct_and_complete_information:   'Cross-check policy/product details before confirming. Never guess. Verify using knowledge base.',
            upselling_or_offers_suggested:      'At call resolution, briefly mention one relevant offer: "We have a current promotion you may be interested in…"',
            further_assistance_offered:         'Before closing, always ask: "Is there anything else I can help you with today?"',
            proper_call_closure:                'Use the standard closing script. Summarise actions taken, set expectations, and thank the customer.',
          };
          const CAT_COLOR: Record<string, string> = {
            'Opening Skill': '#0EA5E9',
            'Soft Skill':    '#8B5CF6',
            'Hold Procedure':'#F59E0B',
            'Resolution':   '#14B8A6',
            'Closing':      '#EC4899',
          };
          return (
            <>
              {clapLoading ? (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading Process Analysis…</div>
              ) : !cd ? (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm">No data</div>
              ) : (
                <div className="flex flex-col gap-6">

                  {/* Customer Interaction Insights */}
                  <div className="rounded-2xl overflow-hidden border border-sky-200 shadow-sm">
                    <div className="card-header px-5 py-3 flex items-center gap-2">
                      <span className="text-base">🔍</span>
                      <h2 className="text-xs font-bold text-white uppercase tracking-widest">Customer Interaction Insights</h2>
                    </div>
                    <div className="p-5 space-y-6" style={{ background: '#F0F9FF' }}>

                      {/* Social Media Threat + Potential Scam */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center gap-4 bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 cursor-pointer hover:bg-orange-100 transition-colors group"
                          title="Click to view detail breakdown"
                          onClick={() => openKwDrill('social', 'social', 'Social Media & Consumer Court', '#F97316', '🛡️')}>
                          <div className="p-3 rounded-2xl bg-orange-500/15 shrink-0">
                            <ShieldAlert size={22} className="text-orange-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-orange-800 uppercase tracking-widest mb-1">Social Media &amp; Consumer Court</p>
                            {loading ? <div className="h-8 w-20 bg-orange-100 rounded animate-pulse" /> : (
                              <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-orange-600 tabular-nums leading-none">{(kpis?.social_media_court_threat ?? 0).toLocaleString()}</span>
                                <span className="text-xs font-semibold text-orange-700">{kpis && kpis.audit_count > 0 ? ((kpis.social_media_court_threat / kpis.audit_count) * 100).toFixed(1) : 0}% of calls</span>
                              </div>
                            )}
                            <p className="text-[10px] font-medium text-orange-700 mt-1">📱 Social · ⚖️ Consumer Court · Legal / FIR</p>
                          </div>
                          <span className="text-orange-400 group-hover:text-orange-600 text-lg shrink-0">›</span>
                        </div>

                        <div className="flex items-center gap-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 cursor-pointer hover:bg-red-100 transition-colors group"
                          title="Click to view detail breakdown"
                          onClick={() => openKwDrill('scam', 'scam', 'Potential Scam', '#EF4444', '🚨')}>
                          <div className="p-3 rounded-2xl bg-red-500/15 shrink-0">
                            <AlertOctagon size={22} className="text-red-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-red-800 uppercase tracking-widest mb-1">Potential Scam</p>
                            {loading ? <div className="h-8 w-20 bg-red-100 rounded animate-pulse" /> : (
                              <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-black text-red-600 tabular-nums leading-none">{(kpis?.potential_scam ?? 0).toLocaleString()}</span>
                                <span className="text-xs font-semibold text-red-700">{kpis && kpis.audit_count > 0 ? ((kpis.potential_scam / kpis.audit_count) * 100).toFixed(1) : 0}% of calls</span>
                              </div>
                            )}
                            <p className="text-[10px] font-medium text-red-700 mt-1">💸 Financial fraud · Cheat · Loot</p>
                          </div>
                          <span className="text-red-400 group-hover:text-red-600 text-lg shrink-0">›</span>
                        </div>
                      </div>

                      {/* Golden Words */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1.5 h-5 rounded-full bg-emerald-500" />
                          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Golden Words</h3>
                          <span className="ml-auto text-[11px] font-medium text-slate-500">
                            {posSignals.length > 0 ? `${posSignals.reduce((s, r) => s + r.total, 0).toLocaleString()} total mentions` : 'customer + agent'}
                          </span>
                        </div>

                        {(() => {
                          const CAT_GROUPS: Array<{ emoji: string; name: string; keywords: string[]; color: string }> = [
                            { emoji: '🤝', name: 'Courtesy & Gratitude',      keywords: ['Thank You','Appreciate'],           color: '#10B981' },
                            { emoji: '🛟', name: 'Support & Assistance',      keywords: ['Help / Assist','Help','Assist'],    color: '#0EA5E9' },
                            { emoji: '✅', name: 'Acknowledgement & Underst.', keywords: ['Understanding'],                    color: '#8B5CF6' },
                            { emoji: '😊', name: 'Positive Reinforcement',    keywords: ['Nice','Good','Great'],               color: '#F59E0B' },
                            { emoji: '😌', name: 'Customer Satisfaction',     keywords: ['Satisfied'],                         color: '#14B8A6' },
                          ];
                          const kwMap = new Map(posSignals.map(r => [r.keyword, r]));
                          const catData = CAT_GROUPS.map(g => {
                            const rows = g.keywords.map(kw => kwMap.get(kw)).filter(Boolean) as PosKeywordRow[];
                            return { ...g, rows, total: rows.reduce((s, r) => s + r.total, 0) };
                          });
                          const otherRows = posSignals.filter(r => !CAT_GROUPS.some(g => g.keywords.includes(r.keyword)));

                          if (posSignals.length === 0 && !loading) {
                            return <p className="text-xs text-slate-500 text-center py-4">No positive signal data for this period.</p>;
                          }
                          if (loading) {
                            return (
                              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                  <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />
                                ))}
                              </div>
                            );
                          }
                          return (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                              {catData.map(({ emoji, name, keywords, color, rows, total }) => {
                                const PATTERNS: Record<string, string> = {
                                  'Thank You':'thank','Appreciate':'appreciat','Great':'great','Good':'good',
                                  'Help / Assist':'help','Help':'help','Assist':'help','Understanding':'understand',
                                  'Patience':'patient','Happy':'happy','Satisfied':'satisf','Excellent':'excellent',
                                  'Nice':'nice','Wonderful':'wonder',
                                };
                                return (
                                <div key={name}
                                  className="flex flex-col gap-2 rounded-2xl px-3 py-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all"
                                  style={{ backgroundColor: `${color}10`, border: `1.5px solid ${color}45` }}
                                  onClick={() => {
                                    const uniquePats = [...new Set(keywords.map(kw => PATTERNS[kw] ?? kw.toLowerCase()).filter(Boolean))];
                                    const pat = uniquePats.length > 0 ? uniquePats.join('|') : name.toLowerCase();
                                    openKwDrill('pos', pat, name, color, emoji);
                                  }}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-lg">{emoji}</span>
                                    <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5"
                                      style={{ backgroundColor: `${color}25`, color }}>
                                      {rows.length}w
                                    </span>
                                  </div>
                                  <span className="text-2xl font-black tabular-nums leading-none" style={{ color }}>
                                    {total > 0 ? total.toLocaleString() : '—'}
                                  </span>
                                  <span className="text-[10px] font-bold leading-tight block" style={{ color }}>{name}</span>
                                </div>
                                );
                              })}
                              {otherRows.length > 0 && (
                                <div className="flex flex-col gap-2 rounded-2xl px-3 py-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all"
                                  style={{ backgroundColor: '#94A3B810', border: '1.5px solid #94A3B840' }}
                                  onClick={() => openKwDrill('pos', 'other', 'Other Keywords', '#94A3B8', '📦')}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-lg">📦</span>
                                    <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5 bg-slate-200 text-slate-600">
                                      {otherRows.length}w
                                    </span>
                                  </div>
                                  <span className="text-2xl font-black tabular-nums leading-none text-slate-700">
                                    {otherRows.reduce((s, r) => s + r.total, 0).toLocaleString()}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-600 leading-tight block">Other</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Critical Signals */}
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1.5 h-5 rounded-full bg-rose-500" />
                          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Critical Signals</h3>
                          <span className="ml-auto text-[11px] font-medium text-slate-500">Detected in customer speech</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {[
                            { label: 'Frustration', key: 'frustration_count' as const, color: '#F59E0B', icon: '😤' },
                            { label: 'Threat',      key: 'threat_count'      as const, color: '#EF4444', icon: '⚠️' },
                            { label: 'Abuse',       key: 'cuss_abuse_count'  as const, color: '#A855F7', icon: '🚫' },
                            { label: 'Slang',       key: 'slang_count'       as const, color: '#3B82F6', icon: '💬' },
                            { label: 'Sarcasm',     key: 'sarcasm_count'     as const, color: '#14B8A6', icon: '🙃' },
                          ].map(({ label, key, color, icon }) => {
                            const count = kpis?.[key] ?? 0;
                            const pct   = kpis && kpis.audit_count > 0 ? ((count / kpis.audit_count) * 100).toFixed(1) : '0.0';
                            const filtered = negSignalDetails.filter(r => r.neg_signal === label);
                            const handleClick = () => openKwDrill('neg', label.toLowerCase(), label, color, icon);
                            return (
                              <div key={label}
                                className="flex flex-col gap-2 rounded-2xl px-4 py-4 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all"
                                style={{ backgroundColor: `${color}10`, border: `1.5px solid ${color}45` }}
                                title={`Click to view ${label} details`}
                                onClick={handleClick}>
                                <div className="flex items-center justify-between">
                                  <span className="text-lg">{icon}</span>
                                  <span className="text-[10px] font-bold rounded-full px-2 py-0.5"
                                    style={{ backgroundColor: `${color}25`, color }}>
                                    {pct}%
                                  </span>
                                </div>
                                {loading ? (
                                  <div className="h-8 w-14 rounded animate-pulse" style={{ backgroundColor: `${color}20` }} />
                                ) : (
                                  <span className="text-2xl font-black tabular-nums" style={{ color }}>
                                    {count.toLocaleString()}
                                  </span>
                                )}
                                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>{label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* ── CLAP Word Analysis ── */}
                  <div className="rounded-2xl overflow-hidden border border-blue-100 shadow-sm" style={{ order: -1 }}>
                    <div className="card-header px-5 py-3 flex items-center gap-2">
                      <span className="text-base">💬</span>
                      <h2 className="text-xs font-bold text-white uppercase tracking-widest">CLAP Word Analysis — Customer Voice</h2>
                      <span className="ml-auto text-[10px] text-white/60">Click Customer to explore branches &amp; products</span>
                    </div>
                    <div className="p-5" style={{ background: '#EFF8FF' }}>

                    {/* ── Customer Tree ── */}
                    {(() => {
                      const BRANCH_META: Record<string, { icon: string; accent: string; label: string }> = {
                        Logistic: { icon: '🚚', accent: '#F59E0B', label: 'Logistic & Ops' },
                        Agent:    { icon: '🎧', accent: '#E11D48', label: 'Agent' },
                        Product:  { icon: '📦', accent: '#10B981', label: 'Product' },
                      };
                      const SCEN_COLOR: Record<string, string> = {
                        Complaint: '#DC2626', 'Delivery Issue': '#DC2626', 'Return/Exchange': '#DC2626',
                        'Return Request': '#DC2626', 'Return & Exchange': '#DC2626', 'Reverse Pickup Issue': '#DC2626',
                        'Payment issues': '#DC2626', 'Refund issue': '#DC2626', 'Refund Request': '#DC2626',
                        'Refund Status': '#DC2626', 'Wallet issue': '#DC2626', 'Tech issue': '#DC2626',
                        'Wrong product': '#DC2626', 'Product Issue': '#DC2626', 'Pricing': '#D97706',
                        'Needs Improvement': '#DC2626', 'Hold Procedure': '#D97706',
                        Query: '#0369A1', 'General Query': '#0369A1', 'General Queries': '#0369A1',
                        'Order Status': '#0369A1', 'Post Order': '#0369A1', 'Pending payment': '#0369A1',
                        'Policies and FAQs': '#0369A1', 'Customer Profile': '#0369A1',
                        Transfer: '#7C3AED', 'Sale Done': '#059669', 'Pending Payment': '#0369A1',
                      };
                      const scenColor = (s: string) => SCEN_COLOR[s] ?? (
                        ['issue','complaint','fail','wrong','return','refund','reverse','fraud','improve'].some(k => s.toLowerCase().includes(k)) ? '#DC2626' : '#64748B'
                      );
                      const ov = clapCustomer?.overall;
                      const ovTotal = ov?.total ?? 0;
                      const ovPos   = ov?.pos ?? 0;
                      const ovNeg   = ov?.neg ?? 0;
                      const ovPosPct = ovTotal > 0 ? Math.round(ovPos / ovTotal * 100) : 0;

                      return (
                        <div>
                          {/* Customer root node */}
                          <div className="flex flex-col items-center mb-0">
                            <div
                              onClick={() => { setClapCustomerExpanded(v => !v); setClapActiveBranch(null); }}
                              className="cursor-pointer rounded-2xl shadow-lg border-2 px-10 py-4 text-center select-none"
                              style={{
                                background: clapCustomerExpanded ? 'linear-gradient(135deg,#0369A1,#0EA5E9)' : 'white',
                                borderColor: clapCustomerExpanded ? '#1565C0' : '#BFDBFE',
                                transition: 'all 0.25s ease',
                              }}
                            >
                              <div className="text-2xl mb-1">👤</div>
                              <div className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: clapCustomerExpanded ? '#fff' : '#1D4ED8' }}>Customer</div>
                              {clapCustomerLoading ? (
                                <div className="flex gap-2 justify-center my-1"><div className="h-4 w-14 bg-slate-200 rounded animate-pulse" /><div className="h-4 w-14 bg-slate-200 rounded animate-pulse" /></div>
                              ) : (
                                <>
                                  <div className="text-2xl font-black tabular-nums" style={{ color: clapCustomerExpanded ? '#fff' : '#0F172A' }}>{ovTotal.toLocaleString()}</div>
                                  <div className="text-[9px] font-semibold mb-2" style={{ color: clapCustomerExpanded ? 'rgba(255,255,255,0.55)' : '#64748B' }}>Total Audits</div>
                                  <div className="flex gap-3 justify-center">
                                    <span className="text-[11px] font-bold" style={{ color: clapCustomerExpanded ? '#86EFAC' : '#16A34A' }}>✅ {ovPos.toLocaleString()}</span>
                                    <span className="text-[11px] font-bold" style={{ color: clapCustomerExpanded ? '#FCA5A5' : '#DC2626' }}>❌ {ovNeg.toLocaleString()}</span>
                                  </div>
                                  <div className="mt-2 h-1.5 w-32 mx-auto rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.1)' }}>
                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ovPosPct}%`, background: clapCustomerExpanded ? '#86EFAC' : '#22C55E' }} />
                                  </div>
                                  <div className="text-[9px] mt-1.5" style={{ color: clapCustomerExpanded ? 'rgba(255,255,255,0.45)' : '#94A3B8' }}>
                                    {clapCustomerExpanded ? '▲ collapse' : '▼ click to explore'}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Vertical connector */}
                            <div className="w-px bg-blue-300" style={{ height: clapCustomerExpanded ? 28 : 0, transition: 'height 0.2s ease', overflow: 'hidden' }} />
                          </div>

                          {/* Branch nodes */}
                          <div style={{ overflow: 'hidden', maxHeight: clapCustomerExpanded ? 200 : 0, opacity: clapCustomerExpanded ? 1 : 0, transition: 'max-height 0.35s ease, opacity 0.25s ease' }}>
                            <div className="flex justify-center gap-5 mb-3">
                              {['Logistic', 'Agent', 'Product'].map(branch => {
                                const m = BRANCH_META[branch];
                                const bd = clapCustomer?.branches.find(b => b.clap === branch);
                                const bT = bd?.total ?? 0;
                                const bP = bd?.pos ?? 0;
                                const bN = bd?.neg ?? 0;
                                const bPct = bT > 0 ? Math.round(bP / bT * 100) : 0;
                                const isAct = clapActiveBranch === branch;
                                return (
                                  <div key={branch}
                                    onClick={() => { setClapActiveBranch(isAct ? null : branch); setClapActiveScenario(null); }}
                                    className="cursor-pointer rounded-xl shadow-md border-2 px-5 py-3 text-center select-none"
                                    style={{
                                      minWidth: 120, background: isAct ? m.accent : 'white',
                                      borderColor: isAct ? m.accent : `${m.accent}70`,
                                      transition: 'all 0.2s ease',
                                    }}>
                                    <div className="text-xl mb-0.5">{m.icon}</div>
                                    <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: isAct ? '#fff' : m.accent }}>{m.label}</div>
                                    <div className="text-lg font-black tabular-nums" style={{ color: isAct ? '#fff' : '#0F172A' }}>{bT.toLocaleString()}</div>
                                    <div className="flex gap-2 justify-center mt-1">
                                      <span className="text-[9px] font-bold" style={{ color: isAct ? '#bbf7d0' : '#16A34A' }}>✅{bP}</span>
                                      <span className="text-[9px] font-bold" style={{ color: isAct ? '#fecaca' : '#DC2626' }}>❌{bN}</span>
                                    </div>
                                    <div className="mt-1.5 h-1 w-20 mx-auto rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.12)' }}>
                                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${bPct}%`, background: isAct ? 'rgba(255,255,255,0.7)' : m.accent }} />
                                    </div>
                                    <div className="text-[8px] mt-1" style={{ color: isAct ? 'rgba(255,255,255,0.5)' : '#94A3B8' }}>{isAct ? '▲ close' : '▼ view products'}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Branch detail panel */}
                          {clapActiveBranch && (() => {
                            const m = BRANCH_META[clapActiveBranch];
                            const bd = clapCustomer?.branches.find(b => b.clap === clapActiveBranch);

                            /* ── AGENT branch ── */
                            if (clapActiveBranch === 'Agent') {
                              const agScens = bd?.scenarioBreakdown ?? [];
                              const agTotal = agScens.reduce((s, r) => s + r.count, 0);
                              return (
                                <div className="rounded-xl overflow-hidden border shadow-sm mb-4" style={{ borderColor: `${m.accent}40` }}>
                                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                                    <span>{m.icon}</span>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-white">Agent — Language &amp; Scenario Analysis</span>
                                    <span className="ml-auto text-[9px] text-white/60 font-semibold">{bd?.total ?? 0} total audits analysed</span>
                                  </div>
                                  <div className="bg-white p-4 space-y-4">
                                    <VocQuoteList positive={clapVocQuotes?.positive ?? []} negative={clapVocQuotes?.negative ?? []} loading={clapVocLoading} />
                                    {/* Scenario drill-down */}
                                    {agScens.length > 0 && (
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Scenarios — click to expand sub-scenarios</p>
                                        <div className="space-y-1.5">
                                          {agScens.map(s => {
                                            const clr = scenColor(s.scenario);
                                            const pct = agTotal > 0 ? Math.round(s.count / agTotal * 100) : 0;
                                            const isOpen = clapActiveScenario === `Agent:${s.scenario}`;
                                            return (
                                              <div key={s.scenario} className="rounded-lg overflow-hidden border" style={{ borderColor: `${clr}30` }}>
                                                <div
                                                  onClick={() => setClapActiveScenario(isOpen ? null : `Agent:${s.scenario}`)}
                                                  className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                                                  style={{ background: isOpen ? `${clr}10` : 'white' }}
                                                >
                                                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: clr }} />
                                                  <span className="text-[10px] font-bold flex-1 truncate" style={{ color: clr }}>{s.scenario}</span>
                                                  <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden mx-2">
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: clr }} />
                                                  </div>
                                                  <span className="text-[10px] font-black tabular-nums w-8 text-right" style={{ color: clr }}>{s.count}</span>
                                                  <span className="text-[9px] text-slate-400 ml-1">{isOpen ? '▲' : '▼'}</span>
                                                </div>
                                                {isOpen && s.subs.length > 0 && (
                                                  <div className="px-6 pb-2 pt-1 space-y-1" style={{ background: `${clr}06` }}>
                                                    {s.subs.map(sub => (
                                                      <div key={sub.sub} className="flex items-center justify-between gap-2">
                                                        <span className="text-[9px] text-slate-600 flex-1 truncate">↳ {sub.sub}</span>
                                                        <span className="text-[9px] font-black tabular-nums" style={{ color: clr }}>{sub.count}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            /* ── LOGISTIC branch ── */
                            if (clapActiveBranch === 'Logistic') {
                              const scenBreakdown = bd?.scenarioBreakdown ?? [];
                              const logTotal = scenBreakdown.reduce((s, r) => s + r.count, 0);
                              return (
                                <div className="rounded-xl overflow-hidden border shadow-sm mb-4" style={{ borderColor: `${m.accent}40` }}>
                                  <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                                    <span>{m.icon}</span>
                                    <span className="text-[11px] font-black uppercase tracking-widest text-white">Logistic &amp; Operations — Deep Analysis</span>
                                    <span className="ml-auto text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{bd?.total ?? 0} total calls</span>
                                  </div>
                                  <div className="bg-white p-4 space-y-4">
                                    {/* Scenario drill-down */}
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Logistic Scenarios — click to expand sub-scenarios</p>
                                      <div className="space-y-1.5">
                                        {scenBreakdown.map(s => {
                                          const clr = scenColor(s.scenario);
                                          const pct = logTotal > 0 ? Math.round(s.count / logTotal * 100) : 0;
                                          const isNeg = ['#DC2626','#EF4444'].includes(clr) || ['issue','complaint','fail','wrong','return','refund','reverse','fraud'].some(k => s.scenario.toLowerCase().includes(k));
                                          const isOpen = clapActiveScenario === `Log:${s.scenario}`;
                                          return (
                                            <div key={s.scenario} className="rounded-lg overflow-hidden border" style={{ borderColor: `${clr}30` }}>
                                              <div
                                                onClick={() => setClapActiveScenario(isOpen ? null : `Log:${s.scenario}`)}
                                                className="flex items-center gap-3 px-3 py-2 cursor-pointer"
                                                style={{ background: isOpen ? `${clr}10` : 'white' }}
                                              >
                                                <span className="text-[10px] shrink-0">{isNeg ? '⚠️' : 'ℹ️'}</span>
                                                <span className="text-[10px] font-bold flex-1 truncate" style={{ color: clr }}>{s.scenario}</span>
                                                <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden mx-2">
                                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: clr }} />
                                                </div>
                                                <span className="text-[10px] font-black tabular-nums w-8 text-right" style={{ color: clr }}>{s.count}</span>
                                                <span className="text-[9px] text-slate-400 tabular-nums w-7 text-right">{pct}%</span>
                                                {s.subs.length > 0 && <span className="text-[9px] text-slate-400 ml-1">{isOpen ? '▲' : '▼'}</span>}
                                              </div>
                                              {isOpen && s.subs.length > 0 && (
                                                <div className="px-6 pb-2 pt-1 space-y-1" style={{ background: `${clr}06` }}>
                                                  {s.subs.map(sub => (
                                                    <div key={sub.sub} className="flex items-center justify-between gap-2">
                                                      <span className="text-[9px] text-slate-600 flex-1 truncate">↳ {sub.sub}</span>
                                                      <span className="text-[9px] font-black tabular-nums" style={{ color: clr }}>{sub.count}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    <VocQuoteList positive={clapVocQuotes?.positive ?? []} negative={clapVocQuotes?.negative ?? []} loading={clapVocLoading} />
                                  </div>
                                </div>
                              );
                            }

                            /* ── PRODUCT branch ── */
                            const productList = clapProductSummary ?? [];
                            const positiveProducts = productList.filter(p => p.pos > 0);
                            const negativeProducts = productList.filter(p => p.neg > 0);
                            const ProductChip = ({ product, count, accent, bg, border }: { product: string; count: number; accent: string; bg: string; border: string }) => {
                              const isOpen = clapActiveProductVoc === product;
                              return (
                                <span
                                  onClick={() => setClapActiveProductVoc(isOpen ? null : product)}
                                  className="cursor-pointer text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                                  style={{
                                    background: isOpen ? accent : bg,
                                    border: `1px solid ${border}`,
                                    color: isOpen ? '#fff' : accent,
                                  }}
                                >
                                  {product} <span style={{ opacity: 0.7 }}>({count})</span>
                                </span>
                              );
                            };
                            return (
                              <div className="rounded-xl overflow-hidden border shadow-sm mb-4" style={{ borderColor: `${m.accent}40` }}>
                                <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                                  <span>{m.icon}</span>
                                  <span className="text-[11px] font-black uppercase tracking-widest text-white">Product — Customer Sentiment</span>
                                  <span className="ml-auto text-[9px] font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>{productList.length} products</span>
                                </div>
                                {clapProductSummaryLoading ? (
                                  <div className="bg-white p-6 text-center text-sm text-slate-400">Loading products…</div>
                                ) : productList.length === 0 ? (
                                  <div className="bg-white p-6 text-center text-sm text-slate-400">No product mentions found.</div>
                                ) : (
                                  <div className="bg-white p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="rounded-xl overflow-hidden border border-emerald-200">
                                        <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#064E3B,#059669)' }}>
                                          <span className="text-white text-sm">😊</span>
                                          <span className="text-[10px] font-black uppercase tracking-widest text-white">Positive Products</span>
                                          <span className="ml-auto text-[9px] text-white/70 font-semibold">{positiveProducts.length}</span>
                                        </div>
                                        <div className="p-3 flex flex-wrap gap-2">
                                          {positiveProducts.length === 0
                                            ? <p className="text-[10px] text-slate-400 italic">No positive products</p>
                                            : positiveProducts.map(p => (
                                                <ProductChip key={p.product} product={p.product} count={p.pos} accent="#059669" bg="#06974A12" border="#06974A30" />
                                              ))
                                          }
                                        </div>
                                      </div>
                                      <div className="rounded-xl overflow-hidden border border-red-200">
                                        <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: 'linear-gradient(135deg,#7F1D1D,#DC2626)' }}>
                                          <span className="text-white text-sm">😠</span>
                                          <span className="text-[10px] font-black uppercase tracking-widest text-white">Negative Products</span>
                                          <span className="ml-auto text-[9px] text-white/70 font-semibold">{negativeProducts.length}</span>
                                        </div>
                                        <div className="p-3 flex flex-wrap gap-2">
                                          {negativeProducts.length === 0
                                            ? <p className="text-[10px] text-slate-400 italic">No negative products</p>
                                            : negativeProducts.map(p => (
                                                <ProductChip key={p.product} product={p.product} count={p.neg} accent="#DC2626" bg="#DC262612" border="#DC262630" />
                                              ))
                                          }
                                        </div>
                                      </div>
                                    </div>
                                    {clapActiveProductVoc && (
                                      <div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Full VOC — {clapActiveProductVoc}</p>
                                        <VocQuoteList
                                          positive={clapProductQuotes?.positive ?? []}
                                          negative={clapProductQuotes?.negative ?? []}
                                          loading={clapProductQuotesLoading}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}

                    {/* ── Word Frequency reference grid ── */}
                    <div className="mt-2 mb-3 flex items-center gap-2">
                      <div className="flex-1 h-px bg-blue-200/60" />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Word Frequency by Category</span>
                      <div className="flex-1 h-px bg-blue-200/60" />
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      {(() => {
                        const WA = ['Customer', 'Logistic', 'Agent', 'Product'];
                        const CC: Record<string, { icon: string; accent: string }> = {
                          Customer: { icon: '👤', accent: '#3B82F6' },
                          Logistic: { icon: '🚚', accent: '#F59E0B' },
                          Agent:    { icon: '🎧', accent: '#E11D48' },
                          Product:  { icon: '📦', accent: '#10B981' },
                        };
                        return WA.map(clap => {
                          const c = CC[clap];
                          const wa = clapWordsData.find(x => x.clap === clap);
                          const totalPos = wa?.positive.reduce((s, w) => s + w.count, 0) ?? 0;
                          const totalNeg = wa?.negative.reduce((s, w) => s + w.count, 0) ?? 0;
                          const total = totalPos + totalNeg;
                          const posPct = total > 0 ? (totalPos / total) * 100 : 50;
                          const isActive = activeClapWord === clap;
                          return (
                            <div key={clap} onClick={() => {
                              if (isActive) { setActiveClapWord(null); setClapScenarioDrill(null); return; }
                              setActiveClapWord(clap); setClapScenarioDrill(null); loadClapScenario(clap);
                            }}
                              className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-200"
                              style={{
                                border: isActive ? `2px solid ${c.accent}` : `1.5px solid ${c.accent}40`,
                                boxShadow: isActive ? `0 4px 20px ${c.accent}30` : '0 1px 4px rgba(0,0,0,0.06)',
                              }}>
                              <div className="px-4 py-3" style={{ background: isActive ? `linear-gradient(135deg, ${c.accent}, ${c.accent}BB)` : `${c.accent}12` }}>
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base" style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : `${c.accent}20` }}>{c.icon}</div>
                                  <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: isActive ? '#fff' : c.accent }}>{clap}</span>
                                  {isActive && <span className="ml-auto text-[9px] text-white/70 font-semibold">Selected ✓</span>}
                                </div>
                              </div>
                              <div className="bg-white px-4 py-3">
                              {clapWordsLoading ? (
                                <div className="space-y-2">
                                  <div className="h-5 w-16 bg-slate-100 rounded animate-pulse" />
                                  <div className="h-1.5 w-full bg-slate-100 rounded-full animate-pulse" />
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-3 mb-2">
                                    <div className="flex items-center gap-1">
                                      <span className="text-base font-black tabular-nums text-emerald-600">{totalPos.toLocaleString()}</span>
                                      <span className="text-[9px] font-bold text-emerald-600">pos</span>
                                    </div>
                                    <span className="text-slate-300">|</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-base font-black tabular-nums text-red-600">{totalNeg.toLocaleString()}</span>
                                      <span className="text-[9px] font-bold text-red-600">neg</span>
                                    </div>
                                  </div>
                                  <div className="h-2 w-full rounded-full bg-red-100 overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-300 bg-emerald-500" style={{ width: `${posPct}%` }} />
                                  </div>
                                  <div className="flex justify-between mt-1">
                                    <span className="text-[9px] font-bold text-emerald-700">😊 {posPct.toFixed(0)}%</span>
                                    <span className="text-[9px] font-bold text-red-600">😠 {(100 - posPct).toFixed(0)}%</span>
                                  </div>
                                </>
                              )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Scenario panel */}
                    {activeClapWord && clapScenarioDrill ? (
                      /* Sub-scenario drill level */
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="px-5 py-4 border-b border-slate-100">
                          <div className="flex items-center gap-2 mb-1">
                            <button onClick={() => setClapScenarioDrill(null)}
                              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">{activeClapWord} {clapScenarioDrill.type === 'pos' ? '😊 Positive' : '😠 Negative'} Scenarios</button>
                            <span className="text-slate-300 text-[10px]">›</span>
                            <span className="text-[11px] font-bold text-slate-900">{clapScenarioDrill.scenario}</span>
                          </div>
                          <p className="text-[10px] text-slate-500">Sub-scenarios for {clapScenarioDrill.scenario}</p>
                        </div>
                        <div className="p-4">
                          {clapScenarioDrill.words.length > 0 && (
                            <div className="mb-4 pb-4 border-b border-slate-100">
                              <button onClick={() => setClapScenarioDrill(p => p ? { ...p, wordsOpen: !p.wordsOpen } : null)}
                                className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-colors">
                                <span className={`inline-block transition-transform duration-200 ${clapScenarioDrill.wordsOpen ? 'rotate-90' : ''}`}>▸</span>
                                {clapScenarioDrill.wordsOpen ? 'Hide Matched Words' : 'Show Matched Words'} ({clapScenarioDrill.words.length})
                              </button>
                              {clapScenarioDrill.wordsOpen && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {clapScenarioDrill.words.map(w => (
                                    <span key={w} className="text-[10px] font-semibold px-2.5 py-1 rounded-full border capitalize" style={{ backgroundColor: `${clapScenarioDrill.type === 'pos' ? '#059669' : '#DC2626'}0c`, borderColor: `${clapScenarioDrill.type === 'pos' ? '#059669' : '#DC2626'}25`, color: clapScenarioDrill.type === 'pos' ? '#059669' : '#DC2626' }}>{w}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {clapScenarioDrillLoading ? (
                            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => (
                              <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                            ))}</div>
                          ) : clapScenarioDrill.subScenarios.length === 0 ? (
                            <p className="text-sm text-slate-400 text-center py-6">No sub-scenarios found.</p>
                          ) : (
                            <div className="space-y-1">
                              {clapScenarioDrill.subScenarios.map((s, i) => {
                                const maxCount = Math.max(...clapScenarioDrill.subScenarios.map(x => x.count));
                                const barPct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                                return (
                                  <div key={i} className="relative flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all overflow-hidden">
                                    {/* Background bar */}
                                    <div className="absolute left-0 top-0 bottom-0 rounded-lg opacity-20 transition-all" style={{ width: `${barPct}%`, backgroundColor: clapScenarioDrill.type === 'pos' ? '#059669' : '#DC2626' }} />
                                    <span className="relative text-sm font-bold text-slate-900 z-10">{s.subScenario}</span>
                                    <span className="relative text-sm font-extrabold tabular-nums z-10" style={{ color: clapScenarioDrill.type === 'pos' ? '#059669' : '#DC2626' }}>{s.count.toLocaleString()}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : activeClapWord ? (
                      /* Positive / Negative scenario columns */
                      <div className="grid grid-cols-2 gap-5">
                        {[
                          { type: 'pos' as const, label: '😊 Positive Scenarios', data: clapScenarioPos, color: '#059669', bg: 'bg-emerald-50/50' },
                          { type: 'neg' as const, label: '😠 Negative Scenarios', data: clapScenarioNeg, color: '#DC2626', bg: 'bg-red-50/50' },
                        ].map(col => (
                          <div key={col.type} className="bg-white rounded-xl overflow-hidden shadow-sm" style={{ border: `1px solid ${col.color}40` }}>
                            <div className="px-4 py-3 flex items-center justify-between"
                              style={{ background: col.type === 'pos'
                                ? 'linear-gradient(135deg, #064E3B 0%, #065F46 50%, #059669 100%)'
                                : 'linear-gradient(135deg, #7F1D1D 0%, #991B1B 50%, #DC2626 100%)' }}>
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-white/80" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-white">{col.label}</span>
                              </div>
                              {clapScenarioWords[col.type].length > 0 && (
                                <button onClick={() => setClapWordsVisible(p => ({ ...p, [col.type]: !p[col.type] }))}
                                  className="text-[9px] font-bold uppercase tracking-widest text-white/70 hover:text-white transition-colors">
                                  {clapWordsVisible[col.type] ? '− Words' : '+ Words'} ({clapScenarioWords[col.type].length})
                                </button>
                              )}
                            </div>
                            <div className="p-3">
                              {/* Words section */}
                              {clapScenarioWords[col.type].length > 0 && clapWordsVisible[col.type] && (
                                <div className="mb-3 pb-3 border-b border-slate-100">
                                  <div className="flex flex-wrap gap-1.5">
                                    {clapScenarioWords[col.type].map(w => (
                                      <span key={w} className="text-[10px] font-semibold px-2.5 py-1 rounded-full border capitalize" style={{ backgroundColor: `${col.color}0c`, borderColor: `${col.color}25`, color: col.color }}>{w}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {clapScenarioLoading ? (
                                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => (
                                  <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
                                ))}</div>
                              ) : col.data === null ? (
                                <p className="text-sm text-slate-400 text-center py-6">Loading...</p>
                              ) : col.data.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-6">No scenarios found</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {col.data.map((s, i) => (
                                    <div key={i} onClick={() => {
                                      setClapScenarioDrillLoading(true);
                                      setClapScenarioDrill({ type: col.type, scenario: s.scenario, subScenarios: [], words: [], wordsOpen: false });
                                      api.get<{ data: { subScenarios: { subScenario: string; count: number; pct: number }[]; words: string[] } }>(
                                        `/inbound-quality/clap-keyword-drill?type=${col.type}&clap=${encodeURIComponent(activeClapWord)}&scenario=${encodeURIComponent(s.scenario)}&clientId=${clientId}&startDate=${sd}&endDate=${ed}`
                                      ).then(r => {
                                        setClapScenarioDrill(p => p ? { ...p, subScenarios: r.data?.data?.subScenarios ?? [], words: r.data?.data?.words ?? [] } : null);
                                      }).catch(() => {
                                        setClapScenarioDrill(p => p ? { ...p, subScenarios: [] } : null);
                                      }).finally(() => setClapScenarioDrillLoading(false));
                                    }}
                                      className="relative flex items-center justify-between px-3.5 py-3 rounded-lg cursor-pointer transition-all overflow-hidden group hover:shadow-sm"
                                      style={{ backgroundColor: `${col.color}04`, border: `1px solid ${col.color}15` }}>
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-1.5 h-1.5 rounded-full opacity-40 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: col.color }} />
                                        <span className="text-sm font-bold text-slate-900">{s.scenario}</span>
                                        {/* Mini bar */}
                                        <div className="hidden sm:flex h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden">
                                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(s.pct, 100)}%`, backgroundColor: col.color }} />
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-semibold text-slate-400">{s.pct}%</span>
                                        <span className="text-sm font-extrabold tabular-nums" style={{ color: col.color }}>{s.count.toLocaleString()}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    </div>
                  </div>

                  {/* ── Agent Guidance & Parameter Focus ── */}
                  {(() => {
                    if (guidanceLoading) return (
                      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 flex items-center justify-center gap-3 text-slate-400">
                        <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                        <span className="text-sm">Loading agent guidance…</span>
                      </div>
                    );

                    if (!guidanceData) return null;
                    const { agents, team_params } = guidanceData;

                    return (
                      <div className="mt-0 rounded-2xl overflow-hidden shadow-xl" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                        {/* Header */}
                        <div className="px-6 py-5 flex items-center gap-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>🎯</div>
                          <div className="flex-1 min-w-0">
                            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Agent Guidance &amp; Parameter Focus</h2>
                            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(147,197,253,0.8)' }}>AI-powered coaching · Bottom 5 agents · 19 QA parameters</p>
                          </div>
                          <span className="shrink-0 text-[9px] font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>Click agent for details</span>
                        </div>

                        {/* Two-section grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2">
                          {/* ── Section 1: Agents Who Need Guidance ── */}
                          <div className="p-5" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: 'rgba(239,68,68,0.25)' }}>👤</div>
                              <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.9)' }}>Agents Who Need Guidance</h3>
                              <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}>
                                {agents.length} agent{agents.length !== 1 ? 's' : ''}
                              </span>
                            </div>

                            {agents.length === 0 ? (
                              <div className="flex flex-col items-center py-10" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                <span className="text-3xl mb-2">🏆</span>
                                <p className="text-sm font-medium">All agents performing well!</p>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {agents.map((a, rank) => {
                                  const scoreColor = a.cq_score < 70 ? '#FCA5A5' : a.cq_score < 85 ? '#FCD34D' : '#86EFAC';
                                  const rankLabel = ['🔴','🟠','🟡','🔵','⚪'][rank] ?? '⚪';
                                  const weak = a.params.filter(p => p.pct < p.team_avg - 5 || p.pct < 70);
                                  return (
                                    <button key={a.agent_id}
                                      onClick={() => setAgentGuidancePopup(a)}
                                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                                      style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                                      <span className="text-base shrink-0">{rankLabel}</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate">{a.agent_name}</div>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{a.audit_count} audits</span>
                                          {weak.length > 0 && (
                                            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.2)', color: '#FCA5A5' }}>
                                              {weak.length} param{weak.length !== 1 ? 's' : ''} need focus
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="shrink-0 text-right">
                                        <div className="text-base font-extrabold tabular-nums leading-none" style={{ color: scoreColor }}>{a.cq_score}%</div>
                                        <div className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>CQ Score</div>
                                      </div>
                                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>›</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* ── Section 2: Which Parameters Need Team-Wide Improvement ── */}
                          <div className="p-5" style={{ background: 'rgba(0,0,0,0.2)' }}>
                            <div className="flex items-center gap-2 mb-4">
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm shrink-0" style={{ background: 'rgba(245,158,11,0.25)' }}>📊</div>
                              <h3 className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.9)' }}>Which Parameters Need Team-Wide Improvement</h3>
                            </div>
                            <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '320px' }}>
                              {team_params.map((p, i) => {
                                const barColor = p.avg >= 90 ? '#86EFAC' : p.avg >= 80 ? '#FCD34D' : '#FCA5A5';
                                const catCol = CAT_COLOR[p.category] ?? '#94A3B8';
                                const isPriority = i < 3;
                                return (
                                  <div key={p.column} className="rounded-xl px-3 py-2.5"
                                    style={{ background: isPriority ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isPriority ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}` }}>
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {i === 0 && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(239,68,68,0.25)', color: '#FCA5A5' }}>⚠ #1</span>}
                                        {i === 1 && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(249,115,22,0.25)', color: '#FDBA74' }}>#2</span>}
                                        {i === 2 && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(245,158,11,0.25)', color: '#FCD34D' }}>#3</span>}
                                        <span className="text-[10px] font-semibold truncate" style={{ color: 'rgba(255,255,255,0.8)' }}>{p.label}</span>
                                      </div>
                                      <span className="text-xs font-extrabold tabular-nums shrink-0 ml-2" style={{ color: barColor }}>{p.avg}%</span>
                                    </div>
                                    <div className="h-1.5 w-full rounded-full overflow-hidden mb-1" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(p.avg, 100)}%`, backgroundColor: barColor }} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: `${catCol}25`, color: catCol }}>{p.category}</span>
                                      {isPriority && PARAM_TIPS[p.column] && (
                                        <span className="text-[8px] italic truncate max-w-[55%] text-right" style={{ color: 'rgba(255,255,255,0.3)' }}>{PARAM_TIPS[p.column]?.substring(0, 45)}…</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Drill Modal */}
                  {clapDrillModal && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }} onClick={() => setClapDrillModal(null)}>
                      <div className="rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden bg-white"
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3"
                          style={{ background: `${CARD_COLORS[clapDrillModal.clap]?.accent ?? '#3B82F6'}15` }}>
                          <span className="text-lg">{CARD_COLORS[clapDrillModal.clap]?.icon ?? '📊'}</span>
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{clapDrillModal.clap} Analysis</p>
                            <p className="text-sm font-bold text-slate-900">
                              {clapDrillModal.level === 'scenario' ? 'Why customers called' :
                               clapDrillModal.level === 'feedback' ? 'Feedback type breakdown' :
                               clapDrillModal.level === 'sub' ? `Scenario: ${clapDrillModal.parentLabel}` :
                               `Sub-reasons: ${clapDrillModal.parentLabel}`}
                            </p>
                          </div>
                          <button onClick={() => setClapDrillModal(null)}
                            className="ml-auto text-slate-500 hover:text-slate-900 p-1"><X size={18} /></button>
                        </div>
                        <div className="overflow-auto flex-1 p-4">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-white">
                              <tr className="border-b border-slate-200">
                                <th className="py-2 px-3 text-left text-slate-400 font-semibold text-[10px]">{(clapDrillModal.level === 'scenario' || clapDrillModal.level === 'feedback') ? 'Category' : 'Sub-category'}</th>
                                <th className="py-2 px-3 text-right text-slate-400 font-semibold text-[10px]">Calls</th>
                                <th className="py-2 px-3 text-right text-slate-400 font-semibold text-[10px]">%</th>
                                {clapDrillModal.data[0]?.avgQuality != null && <th className="py-2 px-3 text-right text-slate-400 font-semibold text-[10px]">Avg Q</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {clapDrillModal.data.map((r, i) => {
                                const drill = cd?.drills[clapDrillModal.clap.toLowerCase() as 'customer' | 'logistic' | 'agent' | 'product'];
                                return (
                                  <tr key={i} className="hover:bg-slate-50 cursor-pointer"
                                    onClick={() => {
                                      if (clapDrillModal.level === 'scenario' && drill && 'subScenarios' in (drill as any)[0]) {
                                        const found = (drill as any).find((d: any) => d.scenario === r.label);
                                        if (found?.subScenarios?.length) {
                                          setClapDrillModal({
                                            clap: clapDrillModal.clap,
                                            level: 'sub',
                                            parentLabel: r.label,
                                            data: found.subScenarios.map((s: any) => ({ label: s.name, calls: s.calls, pct: s.pct })),
                                          });
                                        }
                                      } else if (clapDrillModal.level === 'feedback' && drill && 'reasons' in (drill as any)[0]) {
                                        const found = (drill as any).find((d: any) => d.feedbackType === r.label);
                                        if (found?.reasons?.length) {
                                          setClapDrillModal({
                                            clap: clapDrillModal.clap,
                                            level: 'reason',
                                            parentLabel: r.label,
                                            data: found.reasons.map((s: any) => ({ label: s.reason, calls: s.calls, pct: s.pct, avgQuality: s.avgQuality })),
                                          });
                                        }
                                      }
                                    }}>
                                    <td className="py-2 px-3 text-slate-700 font-medium">{r.label === '—' ? 'Unspecified' : r.label}</td>
                                    <td className="py-2 px-3 text-slate-900 font-semibold text-right tabular-nums">{r.calls.toLocaleString()}</td>
                                    <td className="py-2 px-3 text-right tabular-nums">
                                      <div className="flex items-center justify-end gap-2">
                                        <div className="w-16 bg-slate-100 rounded-full h-1.5">
                                          <div className="h-1.5 rounded-full" style={{ width: `${Math.min(r.pct, 100)}%`, backgroundColor: CARD_COLORS[clapDrillModal.clap]?.accent ?? '#3B82F6' }} />
                                        </div>
                                        <span className="text-slate-600 w-10 text-right">{r.pct}%</span>
                                      </div>
                                    </td>
                                    {r.avgQuality != null && (
                                      <td className="py-2 px-3 text-slate-700 text-right tabular-nums">{r.avgQuality}%</td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}

                  {/* ── CLAP Keyword Drill Modal ── */}
                  {kwDrill.open && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                      style={{ backgroundColor: 'rgba(0,0,0,0.65)' }} onClick={() => setKwDrill(prev => ({ ...prev, open: false }))}>
                      <div className="rounded-2xl shadow-2xl w-[95vw] max-w-5xl max-h-[85vh] flex flex-col overflow-hidden bg-white"
                        onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3 shrink-0"
                          style={{ background: `${kwDrill.color}12` }}>
                          <span className="text-xl">{kwDrill.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: kwDrill.color }}>CLAP Drill</p>
                            <p className="text-sm font-bold text-slate-900 truncate">{kwDrill.keyword}</p>
                          </div>
                          {kwDrill.loading && (
                            <div className="flex items-center gap-2 text-slate-400 text-xs">
                              <Loader size={14} className="animate-spin" /> Loading…
                            </div>
                          )}
                          <button onClick={() => setKwDrill(prev => ({ ...prev, open: false }))}
                            className="text-slate-500 hover:text-slate-900 p-1"><X size={18} /></button>
                        </div>

                        {/* Body: left panel (CLAP cards) + right panel (drill content) */}
                        <div className="flex flex-1 overflow-hidden">
                          {/* Left: CLAP selection panel */}
                          <div className="w-56 shrink-0 border-r border-slate-200 p-3 overflow-y-auto bg-slate-50/50">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">CLAP</p>
                              {kwDrill.claps.length > 0 && (
                                <span className="text-[10px] font-extrabold text-slate-900">{kwDrill.claps.reduce((s, c) => s + c.count, 0).toLocaleString()}</span>
                              )}
                            </div>
                            {[
                              { clap: 'Customer', icon: '👤', color: '#3B82F6', bg: 'bg-blue-50', border: 'border-blue-200' },
                              { clap: 'Logistic', icon: '🚚', color: '#F59E0B', bg: 'bg-amber-50', border: 'border-amber-200' },
                              { clap: 'Agent',    icon: '🎧', color: '#E11D48', bg: 'bg-rose-50', border: 'border-rose-200' },
                              { clap: 'Product',  icon: '📦', color: '#10B981', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                            ].map(c => {
                              const cc = kwDrill.claps.find(x => x.clap === c.clap);
                              const isActive = kwDrill.selectedClap === c.clap;
                              return (
                                <div key={c.clap}
                                  onClick={() => {
                                    if (isActive) {
                                      // deselect - go back
                                      setKwDrill(prev => ({ ...prev, selectedClap: null, scenarios: [], selectedScenario: null, subScenarios: [], selectedSubScenario: null, leads: [] }));
                                    } else if (cc) {
                                      drillKwLevel('clap', c.clap);
                                    }
                                  }}
                                  className={`rounded-lg p-3 mb-2 cursor-pointer transition-all border ${isActive ? 'ring-2' : ''}`}
                                  style={{
                                    backgroundColor: isActive ? `${c.color}15` : '#fff',
                                    borderColor: isActive ? c.color : `${c.color}30`,
                                    outline: isActive ? `2px solid ${c.color}` : 'none',
                                  }}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">{c.icon}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: c.color }}>{c.clap}</span>
                                  </div>
                                  {kwDrill.loading ? (
                                    <div className="h-6 w-16 bg-slate-100 rounded animate-pulse mt-1" />
                                  ) : cc ? (
                                    <p className="text-lg font-extrabold text-slate-900 mt-1">{cc.count.toLocaleString()}</p>
                                  ) : (
                                    <p className="text-lg font-extrabold text-slate-300 mt-1">—</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Right: Drill-down content */}
                          <div className="flex-1 p-4 overflow-y-auto">
                            {!kwDrill.selectedClap ? (
                              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <span className="text-3xl mb-2">👆</span>
                                <p className="text-base font-semibold text-slate-800">Select a CLAP category to drill down</p>
                                <p className="text-sm mt-1 text-slate-500">See how &quot;{kwDrill.keyword}&quot; breaks down by Customer, Logistic, Agent, or Product</p>
                                {/* Show total CLAP sum */}
                                {kwDrill.claps.length > 0 && (
                                  <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Total</p>
                                    <p className="text-2xl font-extrabold text-slate-900">{kwDrill.claps.reduce((s, c) => s + c.count, 0).toLocaleString()}</p>
                                    <p className="text-xs text-slate-500 mt-1">{kwDrill.keyword}</p>
                                  </div>
                                )}
                              </div>
                            ) : kwDrill.loading ? (
                              <div className="flex items-center justify-center h-full">
                                <div className="flex items-center gap-2 text-slate-500 text-sm">
                                  <Loader size={16} className="animate-spin" /> Loading drill data…
                                </div>
                              </div>
                            ) : (
                              <div>
                                {/* Breadcrumb */}
                                <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                                  <button onClick={() => setKwDrill(prev => ({ ...prev, selectedClap: null, scenarios: [], selectedScenario: null, subScenarios: [], selectedSubScenario: null, leads: [] }))}
                                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors">{kwDrill.keyword}</button>
                                  {kwDrill.selectedClap && (
                                    <><span className="text-slate-300 text-[10px]">›</span>
                                    <button onClick={() => {
                                      setKwDrill(prev => ({ ...prev, selectedScenario: null, subScenarios: [], selectedSubScenario: null, leads: [] }));
                                    }}
                                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors">{kwDrill.selectedClap}</button></>
                                  )}
                                  {kwDrill.selectedScenario && (
                                    <><span className="text-slate-300 text-[10px]">›</span>
                                    <span className="text-[11px] font-semibold text-slate-900">{kwDrill.selectedScenario}</span></>
                                  )}
                                  {kwDrill.selectedSubScenario && (
                                    <><span className="text-slate-300 text-[10px]">›</span>
                                    <span className="text-[11px] font-semibold text-slate-900">{kwDrill.selectedSubScenario}</span></>
                                  )}
                                </div>

                                {/* Matched words (collapsible) */}
                                {kwDrill.words.length > 0 && (
                                  <div className="mb-4">
                                    <button onClick={() => setKwDrill(prev => ({ ...prev, wordsOpen: !prev.wordsOpen }))}
                                      className="flex items-center gap-2 p-2 w-full text-left rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
                                      <ChevronDown size={14} className="text-slate-500 transition-transform" style={{ transform: kwDrill.wordsOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Matched Words ({kwDrill.words.length})</span>
                                    </button>
                                    {kwDrill.wordsOpen && (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {kwDrill.words.map((w, i) => (
                                          <span key={i} className="text-[11px] font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">{w}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Scenario / Sub-reason drill */}
                                {kwDrill.selectedClap === 'Customer' ? (
                                  <>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Scenario Breakdown</p>
                                    {kwDrill.scenarios.length === 0 ? (
                                      <p className="text-sm text-slate-500">No scenarios found for this selection.</p>
                                    ) : (
                                      <div className="space-y-2">
                                        {kwDrill.scenarios.map(s => {
                                          const isActive = kwDrill.selectedScenario === s.scenario;
                                          const hasSub = kwDrill.subScenarios.length > 0 && isActive;
                                          return (
                                            <div key={s.scenario}>
                                              <div onClick={() => {
                                                if (isActive) {
                                                  setKwDrill(prev => ({ ...prev, selectedScenario: null, subScenarios: [], selectedSubScenario: null, leads: [] }));
                                                } else {
                                                  drillKwLevel('scenario', s.scenario);
                                                }
                                              }}
                                                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${isActive ? 'bg-blue-50 border-2 border-blue-300' : 'bg-white border border-slate-200 hover:border-blue-200 hover:shadow-sm'}`}>
                                                <span className="text-sm font-bold text-slate-900">{s.scenario || 'Unspecified'}</span>
                                                <div className="flex items-center gap-3">
                                                  <span className="text-base font-extrabold text-slate-900 tabular-nums">{s.count.toLocaleString()}</span>
                                                  {isActive && <ChevronDown size={16} className="text-blue-600" />}
                                                </div>
                                              </div>
                                              {hasSub && (
                                                <div className="ml-5 mt-1.5 space-y-1 border-l-2 border-blue-200 pl-3">
                                                  {kwDrill.subScenarios.map(sub => (
                                                    <div key={sub.subScenario}
                                                      onClick={() => drillKwLevel('sub', sub.subScenario)}
                                                      className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm transition-all group">
                                                      <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-300 group-hover:bg-blue-500 transition-colors" />
                                                        <span className="text-sm font-semibold text-slate-800">{sub.subScenario || 'Unspecified'}</span>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-900 tabular-nums">{sub.count.toLocaleString()}</span>
                                                        <span className="text-[10px] font-bold text-blue-500 group-hover:text-blue-700 bg-blue-50 group-hover:bg-blue-100 px-2 py-0.5 rounded-lg transition-colors">View calls ›</span>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">
                                      {kwDrill.selectedScenario ? 'Sub-Reason Breakdown' : 'Feedback Type Breakdown'}
                                    </p>
                                    {!kwDrill.selectedScenario && kwDrill.scenarios.length === 0 ? (
                                      <p className="text-sm text-slate-500">No feedback types found for this selection.</p>
                                    ) : !kwDrill.selectedScenario ? (
                                      <div className="space-y-2">
                                        {kwDrill.scenarios.map(s => (
                                          <div key={s.scenario}
                                            onClick={() => drillKwLevel('scenario', s.scenario)}
                                            className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all">
                                            <span className="text-sm font-bold text-slate-900">{s.scenario || 'Unspecified'}</span>
                                            <span className="text-base font-extrabold text-slate-900 tabular-nums">{s.count.toLocaleString()}</span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {kwDrill.subScenarios.map(sub => (
                                          <div key={sub.subScenario}
                                            onClick={() => drillKwLevel('sub', sub.subScenario)}
                                            className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 cursor-pointer hover:border-blue-300 hover:bg-blue-50 hover:shadow-sm transition-all group">
                                            <div className="flex items-center gap-2">
                                              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 group-hover:bg-blue-500 transition-colors" />
                                              <span className="text-sm font-bold text-slate-900">{sub.subScenario || 'Unspecified'}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                              <span className="text-base font-extrabold text-slate-900 tabular-nums">{sub.count.toLocaleString()}</span>
                                              <span className="text-[10px] font-bold text-blue-500 group-hover:text-blue-700 bg-blue-50 group-hover:bg-blue-100 px-2 py-0.5 rounded-lg transition-colors">View calls ›</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}

                                {/* Leads table */}
                                {kwDrill.leads.length > 0 && (
                                  <div className="mt-5">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-1.5 h-5 rounded-full bg-blue-500" />
                                      <p className="text-sm font-bold text-slate-800 uppercase tracking-widest">Calls ({kwDrill.leads.length})</p>
                                      <span className="ml-auto text-[10px] text-slate-500 font-medium">Click any row to view transcript</span>
                                    </div>
                                    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b border-slate-200" style={{ background: 'linear-gradient(135deg, #0369A1, #0EA5E9)' }}>
                                            <th className="py-2.5 px-4 text-left text-white font-bold text-[10px] uppercase tracking-wider">#</th>
                                            <th className="py-2.5 px-4 text-left text-white font-bold text-[10px] uppercase tracking-wider">Agent</th>
                                            <th className="py-2.5 px-4 text-left text-white font-bold text-[10px] uppercase tracking-wider">Lead ID</th>
                                            <th className="py-2.5 px-4 text-left text-white font-bold text-[10px] uppercase tracking-wider">Date</th>
                                            <th className="py-2.5 px-4 text-right text-white font-bold text-[10px] uppercase tracking-wider">Transcript</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                          {kwDrill.leads.map((l, i) => (
                                            <tr key={i}
                                              className="hover:bg-blue-50 cursor-pointer transition-colors group"
                                              onClick={() => handleLeadClick(l.leadId)}>
                                              <td className="py-3 px-4 text-slate-400 text-[11px] font-semibold">{i + 1}</td>
                                              <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900 text-[12px]">{l.agentName !== l.agentId ? l.agentName : '—'}</div>
                                                {l.agentName !== l.agentId && (
                                                  <div className="text-[10px] text-slate-500 font-mono">{l.agentId}</div>
                                                )}
                                              </td>
                                              <td className="py-3 px-4 text-slate-700 font-mono text-[11px] font-semibold">{l.leadId}</td>
                                              <td className="py-3 px-4 text-slate-700 text-[11px] font-medium">{l.callDate}</td>
                                              <td className="py-3 px-4 text-right">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 group-hover:text-blue-800 bg-blue-50 group-hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors">
                                                  📄 View
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}

                  {/* ── Agent Parameter Popup ── */}
                  {agentGuidancePopup && createPortal(
                    <div
                      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
                      style={{ backgroundColor: 'rgba(0,0,0,0.82)' }}
                      onClick={() => setAgentGuidancePopup(null)}
                    >
                      <div
                        className="rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
                        style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}
                        onClick={e => e.stopPropagation()}
                      >
                        {/* Header */}
                        <div className="px-6 py-5 flex items-center gap-4 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                          <div className="text-3xl shrink-0">
                            {agentGuidancePopup.cq_score < 70 ? '🔴' : agentGuidancePopup.cq_score < 85 ? '🟠' : '🟢'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-white truncate">{agentGuidancePopup.agent_name}</h2>
                            <p className="text-[10px] mt-0.5" style={{ color: 'rgba(147,197,253,0.75)' }}>
                              {agentGuidancePopup.audit_count} audits · Coaching dashboard
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <div
                              className="text-3xl font-black tabular-nums"
                              style={{ color: agentGuidancePopup.cq_score < 70 ? '#FCA5A5' : agentGuidancePopup.cq_score < 85 ? '#FCD34D' : '#86EFAC' }}
                            >
                              {agentGuidancePopup.cq_score}%
                            </div>
                            <div className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>CQ Score</div>
                          </div>
                          <button
                            onClick={() => setAgentGuidancePopup(null)}
                            className="shrink-0 ml-2 w-8 h-8 rounded-full flex items-center justify-center text-lg transition-all hover:bg-white/20"
                            style={{ color: 'rgba(255,255,255,0.7)' }}
                          >✕</button>
                        </div>

                        {/* Body */}
                        <div className="overflow-auto flex-1 p-6">
                          {(() => {
                            const weak = agentGuidancePopup.params
                              .filter(p => p.pct < p.team_avg - 5 || p.pct < 70)
                              .sort((x, y) => x.pct - y.pct);
                            return (
                              <>
                                {/* Weak parameters */}
                                <div className="mb-6">
                                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: '#FCA5A5' }}>
                                    ⚠ Parameters That Need Focus ({weak.length})
                                  </p>
                                  {weak.length === 0 ? (
                                    <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>All parameters are near or above team average.</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {weak.map(p => {
                                        const col = CAT_COLOR[p.category] ?? '#94A3B8';
                                        const gapVal = p.pct - p.team_avg;
                                        return (
                                          <div key={p.column} className="rounded-xl px-4 py-3" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
                                            <div className="flex items-center justify-between mb-2 gap-2">
                                              <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${col}28`, color: col }}>{p.category}</span>
                                                <span className="text-sm font-bold text-white truncate">{p.label}</span>
                                              </div>
                                              <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                                  Team: <strong style={{ color: 'rgba(255,255,255,0.8)' }}>{p.team_avg}%</strong>
                                                </span>
                                                <span className="text-sm font-extrabold tabular-nums" style={{ color: '#FCA5A5' }}>{p.pct}%</span>
                                                <span className="text-[9px] font-bold" style={{ color: '#FCA5A5' }}>({gapVal > 0 ? '+' : ''}{gapVal.toFixed(0)}%)</span>
                                              </div>
                                            </div>
                                            <div className="h-2 w-full rounded-full overflow-hidden relative mb-2" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                              <div className="h-full rounded-full" style={{ width: `${Math.min(p.pct, 100)}%`, backgroundColor: '#EF4444' }} />
                                              <div className="absolute top-0 bottom-0 w-0.5 rounded-full" style={{ left: `${Math.min(p.team_avg, 100)}%`, backgroundColor: 'rgba(255,255,255,0.6)' }} />
                                            </div>
                                            <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                                              <span className="font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>How to improve: </span>
                                              {PARAM_TIPS[p.column] ?? 'Review coaching guidelines for this parameter.'}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* All 19 parameters mini grid */}
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
                                    All 19 Parameters vs Team Average
                                  </p>
                                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                    {agentGuidancePopup.params.map(p => {
                                      const col = CAT_COLOR[p.category] ?? '#94A3B8';
                                      const isWeak = p.pct < p.team_avg - 5 || p.pct < 70;
                                      return (
                                        <div key={p.column} className="flex items-center gap-2">
                                          <span className="text-[9px] truncate shrink-0 w-24" style={{ color: isWeak ? '#FCA5A5' : 'rgba(255,255,255,0.55)', fontWeight: isWeak ? 700 : 400 }}>
                                            {p.label}
                                          </span>
                                          <div className="flex-1 h-1.5 rounded-full overflow-hidden relative" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                            <div className="h-full rounded-full" style={{ width: `${Math.min(p.pct, 100)}%`, backgroundColor: isWeak ? '#EF4444' : col }} />
                                            <div className="absolute top-0 bottom-0 w-px" style={{ left: `${Math.min(p.team_avg, 100)}%`, backgroundColor: 'rgba(255,255,255,0.4)' }} />
                                          </div>
                                          <span className="text-[9px] font-bold tabular-nums w-8 text-right shrink-0" style={{ color: isWeak ? '#FCA5A5' : 'rgba(255,255,255,0.55)' }}>
                                            {p.pct}%
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <p className="text-[8px] mt-3" style={{ color: 'rgba(255,255,255,0.25)' }}>│ = team average</p>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}
                </div>
              )}
            </>
          );
        })()}

        {/* ── Repeat Analysis slide ─────────────────────────────────────────── */}
        {activeSlide === 3 && (() => {
          const rd = repeatData;
          const maskPhone = (p: string) => p.length > 5 ? p.slice(0, 5) + '*****' : p;

          return (
            <>
              {repeatLoading ? (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm">Loading repeat analysis…</div>
              ) : !rd ? (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm">No data</div>
              ) : (
                <>
                  {/* KPI strip */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { label: 'Total Unique Callers', value: rd.grand_unique.toLocaleString(), color: '#38BDF8', sub: 'Click to view unique callers',
                        onClick: () => setDrillModal({ title: 'Repeat Analysis — All Unique Callers', accent: '#14B8A6', columns: [{ key: 'Mobile No', label: 'Mobile No' }, { key: 'Total Calls', label: 'Total Calls' }], rows: rd.pivot_rows.map(r => ({ 'Mobile No': maskPhone(r.mobile_no), 'Total Calls': r.grand_total })) }) },
                      { label: 'Repeat Calls', value: rd.grand_repeat.toLocaleString(), color: '#2DD4BF', sub: 'Click to view day-wise',
                        onClick: () => setDrillModal({ title: 'Repeat Analysis — Repeat Callers by Day', accent: '#14B8A6', columns: [{ key: 'Date', label: 'Date' }, { key: 'Repeat Calls', label: 'Repeat Calls' }, { key: 'Unique Calls', label: 'Unique Calls' }, { key: 'Repeat%', label: 'Repeat%' }], rows: rd.day_wise.filter(r => r.repeat_calls > 0).map(r => ({ Date: r.call_date, 'Repeat Calls': r.repeat_calls, 'Unique Calls': r.unique_calls, 'Repeat%': `${r.repeat_pct}%` })) }) },
                      { label: 'Repeat%', value: `${rd.grand_pct}%`, color: rd.grand_pct > 0 ? '#F87171' : '#4ADE80', sub: 'Click to view day-wise',
                        onClick: () => setDrillModal({ title: 'Repeat Analysis — Repeat% by Day', accent: '#EF4444', columns: [{ key: 'Date', label: 'Date' }, { key: 'Repeat%', label: 'Repeat%' }, { key: 'Repeat Calls', label: 'Repeat Calls' }, { key: 'Unique Calls', label: 'Unique Calls' }], rows: rd.day_wise.map(r => ({ Date: r.call_date, 'Repeat%': `${r.repeat_pct}%`, 'Repeat Calls': r.repeat_calls, 'Unique Calls': r.unique_calls })) }) },
                    ].map(c => (
                      <div key={c.label}
                        className="bg-white rounded-xl px-5 py-4 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg relative overflow-hidden"
                        style={{ border: `2px solid ${c.color}` }}
                        onClick={c.onClick}>
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl" style={{ background: c.color }} />
                        <div className="pl-3">
                          <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: c.color }}>{c.label}</p>
                          <p className="text-2xl font-black text-slate-900 tabular-nums leading-none">{c.value}</p>
                          <p className="text-[9px] text-slate-400 mt-1.5 font-semibold">↗ {c.sub}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Day-wise repeat table */}
                  <div className="rounded-xl mb-6 overflow-hidden" style={{ border: '1px solid #0369A1' }}>
                    <div className="card-header gap-2 px-5 py-3" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                      <h3 className="text-xs font-black text-white uppercase tracking-widest">Day Wise Repeat Analysis</h3>
                      <ExportBtn onClick={() => downloadCSV(rd.day_wise.map(r => ({ Date: r.call_date, 'Unique Calls': r.unique_calls, 'Repeat Calls': r.repeat_calls, 'Repeat%': r.repeat_pct })), 'repeat-day-wise.csv')} />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-white">
                          <tr>
                            {['Date', 'Unique Calls', 'Repeat Calls', 'Repeat%'].map(h => (
                              <th key={h} className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider text-[9px]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rd.day_wise.map((r, i) => (
                            <tr key={i} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                              <td className="py-2.5 px-4 text-slate-800 tabular-nums font-semibold">{r.call_date}</td>
                              <td className="py-2.5 px-4 text-slate-900 tabular-nums font-semibold">{r.unique_calls.toLocaleString()}</td>
                              <td className="py-2.5 px-4 tabular-nums font-bold" style={{ color: '#0F766E' }}>{r.repeat_calls.toLocaleString()}</td>
                              <td className="py-2.5 px-4 tabular-nums">
                                <span className="font-black" style={{ color: r.repeat_pct > 0 ? '#DC2626' : '#16A34A' }}>
                                  {r.repeat_pct}%
                                </span>
                              </td>
                            </tr>
                          ))}
                          {/* Grand total row */}
                          {rd.day_wise.length > 0 && (() => {
                            const totUniq   = rd.day_wise.reduce((s, r) => s + r.unique_calls,  0);
                            const totRepeat = rd.day_wise.reduce((s, r) => s + r.repeat_calls, 0);
                            const totPct    = totUniq > 0 ? Math.round(totRepeat / totUniq * 100) : 0;
                            return (
                              <tr className="border-t-2 font-bold" style={{ background: '#F0FDF4', borderColor: '#16A34A' }}>
                                <td className="py-2.5 px-4 text-slate-900 font-black">Grand Total</td>
                                <td className="py-2.5 px-4 text-slate-900 tabular-nums font-black">{totUniq.toLocaleString()}</td>
                                <td className="py-2.5 px-4 tabular-nums font-black" style={{ color: '#0F766E' }}>{totRepeat.toLocaleString()}</td>
                                <td className="py-2.5 px-4 tabular-nums">
                                  <span className="font-black" style={{ color: totPct > 0 ? '#DC2626' : '#16A34A' }}>{totPct}%</span>
                                </td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Repeat Count — Phone × Date pivot */}
                  <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #0369A1' }}>
                    <div className="card-header gap-2 px-5 py-3" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                      <h3 className="text-xs font-black text-white uppercase tracking-widest">
                        Repeat Count Number &amp; Date Wise
                        <span className="ml-2 normal-case font-normal" style={{ color: 'rgba(255,255,255,0.65)' }}>({rd.pivot_rows.length} callers · {rd.pivot_dates.length} dates)</span>
                      </h3>
                      <ExportBtn onClick={() => {
                        const maskPhone = (p: string) => p.length > 5 ? p.slice(0, 5) + '*****' : p;
                        const rows = rd.pivot_rows.map(r => {
                          const obj: Record<string, unknown> = { 'Phone No': maskPhone(r.mobile_no) };
                          rd.pivot_dates.forEach(d => { obj[d] = r.by_date[d] ?? 0; });
                          obj['Grand Total'] = r.grand_total;
                          return obj;
                        });
                        downloadCSV(rows, 'repeat-pivot.csv');
                      }} />
                    </div>
                    {rd.pivot_rows.length === 0 ? (
                      <div className="px-5 py-8 text-center text-slate-500 text-sm">No repeat callers in this period</div>
                    ) : (
                      <div className="overflow-auto" style={{ maxHeight: '520px' }}>
                        <table className="text-xs border-collapse" style={{ minWidth: `${Math.max(600, 160 + rd.pivot_dates.length * 80)}px` }}>
                          <thead className="sticky top-0 z-10" style={{ background: '#F1F5F9' }}>
                            <tr>
                              <th className="py-2.5 px-4 text-left text-slate-800 font-black uppercase tracking-wider text-[9px] sticky left-0 z-20 min-w-[140px]" style={{ background: '#F1F5F9' }}>Phone No</th>
                              {rd.pivot_dates.map(d => (
                                <th key={d} className="py-2.5 px-3 text-center text-slate-700 font-black uppercase tracking-wider text-[9px] min-w-[70px]">
                                  {d.slice(5)}
                                </th>
                              ))}
                              <th className="py-2.5 px-4 text-center font-black uppercase tracking-wider text-[9px] min-w-[70px]" style={{ color: '#0F766E' }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rd.pivot_rows.map((row, i) => (
                              <tr key={i} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50' : 'bg-white'}`}>
                                <td className="py-2 px-4 text-slate-900 font-semibold tabular-nums sticky left-0" style={{ background: i % 2 ? '#F8FAFC' : '#FFFFFF' }}>
                                  {maskPhone(row.mobile_no)}
                                </td>
                                {rd.pivot_dates.map(d => {
                                  const val = row.by_date[d] ?? 0;
                                  return (
                                    <td key={d} className="py-2 px-3 text-center tabular-nums">
                                      {val > 0 ? (
                                        <span
                                          className="inline-block px-2 py-0.5 rounded font-bold text-[11px] cursor-pointer hover:opacity-80 transition-opacity"
                                          style={{ background: 'rgba(13,148,136,0.12)', color: '#0F766E' }}
                                          title={`Click to see scenarios for ${maskPhone(row.mobile_no)} on ${d}`}
                                          onClick={async () => {
                                            setDrillLoading(true);
                                            setDrillModal({ title: `${maskPhone(row.mobile_no)} — ${d}`, accent: '#14B8A6', rows: [], columns: [{ key: 'Date', label: 'Date' }, { key: 'Scenario', label: 'Scenario' }, { key: 'Scenario1', label: 'Scenario 1' }, { key: 'Score%', label: 'Score%' }] });
                                            try {
                                              const { data } = await api.get<{ data: { CallDate: string; scenario: string; scenario1: string; quality_percentage: number }[] }>(
                                                `/inbound-quality/repeat-call-detail?mobileNo=${encodeURIComponent(row.mobile_no)}&callDate=${d}&clientId=${clientId}&startDate=${sd}&endDate=${ed}`
                                              );
                                              setDrillModal(prev => prev ? { ...prev, rows: data.data.map(r => ({ Date: r.CallDate, Scenario: r.scenario, Scenario1: r.scenario1, 'Score%': `${r.quality_percentage}%` })) } : null);
                                            } catch { setDrillModal(prev => prev ? { ...prev, rows: [] } : null); }
                                            finally { setDrillLoading(false); }
                                          }}>
                                          {val}
                                        </span>
                                      ) : (
                                        <span className="text-slate-700">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td
                                  className="py-2 px-4 text-center font-black tabular-nums cursor-pointer hover:opacity-70 transition-opacity"
                                  style={{ color: '#0F766E' }}
                                  title={`Click to see all scenarios for ${maskPhone(row.mobile_no)}`}
                                  onClick={async () => {
                                    setDrillLoading(true);
                                    setDrillModal({ title: `${maskPhone(row.mobile_no)} — All Calls`, accent: '#14B8A6', rows: [], columns: [{ key: 'Date', label: 'Date' }, { key: 'Scenario', label: 'Scenario' }, { key: 'Scenario1', label: 'Scenario 1' }, { key: 'Score%', label: 'Score%' }] });
                                    try {
                                      const { data } = await api.get<{ data: { CallDate: string; scenario: string; scenario1: string; quality_percentage: number }[] }>(
                                        `/inbound-quality/repeat-call-detail?mobileNo=${encodeURIComponent(row.mobile_no)}&clientId=${clientId}&startDate=${sd}&endDate=${ed}`
                                      );
                                      setDrillModal(prev => prev ? { ...prev, rows: data.data.map(r => ({ Date: r.CallDate, Scenario: r.scenario, Scenario1: r.scenario1, 'Score%': `${r.quality_percentage}%` })) } : null);
                                    } catch { setDrillModal(prev => prev ? { ...prev, rows: [] } : null); }
                                    finally { setDrillLoading(false); }
                                  }}>
                                  {row.grand_total}
                                </td>
                              </tr>
                            ))}
                            {/* Grand total column row */}
                            {rd.pivot_rows.length > 0 && (() => {
                              const colTotals = rd.pivot_dates.map(d => rd.pivot_rows.reduce((s, r) => s + (r.by_date[d] ?? 0), 0));
                              const grandTotal = rd.pivot_rows.reduce((s, r) => s + r.grand_total, 0);
                              return (
                                <tr className="border-t-2 font-bold sticky bottom-0" style={{ background: '#CCFBF1', borderColor: '#0F766E' }}>
                                  <td className="py-2.5 px-4 text-slate-900 font-black sticky left-0" style={{ background: '#CCFBF1' }}>Grand Total</td>
                                  {colTotals.map((t, ci) => (
                                    <td key={ci} className="py-2.5 px-3 text-center text-slate-900 font-black tabular-nums">{t > 0 ? t : '—'}</td>
                                  ))}
                                  <td className="py-2.5 px-4 text-center font-black tabular-nums" style={{ color: '#0F766E' }}>{grandTotal}</td>
                                </tr>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          );
        })()}

        {/* ── TNI Detection Analysis slide ──────────────────────────────────── */}
        {activeSlide === 5 && (() => {
          const TNI_THRESHOLD = 85;
          const td = tniData;

          const isTNI = (v: number) => v <= TNI_THRESHOLD;

          const sortedAgents = [...(td?.agents ?? [])].sort((a, b) => a[tniSortBy] - b[tniSortBy]);

          // Pivot week data: { agentId -> { weekLabel -> {ss,pk,comm} } }
          const weekLabels = [...new Set((td?.weeks ?? []).map(w => w.week_label))].sort();
          const weekMap = new Map<string, Map<string, { ss: number; pk: number; comm: number }>>();
          (td?.weeks ?? []).forEach(w => {
            if (!weekMap.has(w.agent_id)) weekMap.set(w.agent_id, new Map());
            weekMap.get(w.agent_id)!.set(w.week_label, { ss: w.soft_skills, pk: w.process_knowledge, comm: w.communication });
          });

          // Week-over-week trend per agent (client-side from weeks data)
          const tniScoreFromWeek = (d: { ss: number; pk: number; comm: number }) =>
            Math.round((d.ss * 8 + d.pk * 5 + d.comm * 2) / 15 * 10) / 10;

          const trendFor = (agentId: string): 'up' | 'down' | 'flat' | null => {
            const aw = weekMap.get(agentId);
            if (!aw || aw.size < 2) return null;
            const sorted = weekLabels.filter(wk => aw.has(wk));
            if (sorted.length < 2) return null;
            const prev = tniScoreFromWeek(aw.get(sorted[sorted.length - 2])!);
            const curr = tniScoreFromWeek(aw.get(sorted[sorted.length - 1])!);
            if (curr - prev > 2) return 'up';
            if (curr - prev < -2) return 'down';
            return 'flat';
          };

          // Cell color
          const cellStyle = (val: number): { bg: string; text: string } => {
            if (val <= TNI_THRESHOLD) return { bg: 'rgba(239,68,68,0.14)', text: '#EF4444' };
            if (val <= 90)            return { bg: 'rgba(251,191,36,0.12)', text: '#F59E0B' };
            return                           { bg: 'rgba(34,197,94,0.10)',  text: '#22C55E' };
          };

          const agents = td?.agents ?? [];
          const tniCounts = {
            ss:   agents.filter(a => isTNI(a.soft_skills)).length,
            pk:   agents.filter(a => isTNI(a.process_knowledge)).length,
            comm: agents.filter(a => isTNI(a.communication)).length,
          };

          const SortBtn = ({ col, label }: { col: typeof tniSortBy; label: string }) => (
            <button onClick={() => setTniSortBy(col)}
              className={`inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider transition-colors ${tniSortBy === col ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}>
              {label}{tniSortBy === col && <span className="text-[8px]">▲</span>}
            </button>
          );

          const TrendBadge = ({ agentId }: { agentId: string }) => {
            const t = trendFor(agentId);
            if (!t) return null;
            if (t === 'up')   return <span className="text-[10px] font-bold text-emerald-500" title="Improving this period">↑</span>;
            if (t === 'down') return <span className="text-[10px] font-bold text-red-500"     title="Declining this period">↓</span>;
            return               <span className="text-[10px] text-slate-400"                 title="Stable">→</span>;
          };

          const openDrill = (agent: TNIAgentRow) => {
            setTniDrillAgent(agent);
            setTniDrillData(null);
            setTniDrillLoading(true);
            api.get<{ data: TNIParamRow }>(
              `/inbound-quality/tni-agent-params?agentId=${encodeURIComponent(agent.agent_id)}&clientId=${clientId}&startDate=${sd}&endDate=${ed}`
            )
              .then(r => setTniDrillData(r.data?.data ?? null))
              .catch(() => setTniDrillData(null))
              .finally(() => setTniDrillLoading(false));
          };

          const saveComment = (agentId: string, comment: string) => {
            setTniSavingId(agentId);
            api.post('/inbound-quality/tni-comments', {
              agentId, clientId, comment, updatedBy: resolveAgent(agentId),
            })
              .then(() => setTniComments(prev => new Map(prev).set(agentId, comment)))
              .catch(() => {})
              .finally(() => setTniSavingId(null));
          };

          // Training plan export (rich CSV with coaching tips for TNI agents)
          const exportTrainingPlan = () => {
            const rows: Record<string, string>[] = [];
            agents.filter(a => isTNI(a.soft_skills) || isTNI(a.process_knowledge) || isTNI(a.communication))
              .forEach(a => {
                const tniCats = [
                  isTNI(a.soft_skills)       ? 'Soft Skills'        : null,
                  isTNI(a.process_knowledge) ? 'Process Knowledge'  : null,
                  isTNI(a.communication)     ? 'Communication'      : null,
                ].filter(Boolean).join(' | ');
                const tips = TNI_PARAM_INFO
                  .filter(p => isTNI(a.soft_skills)       && p.category === 'Soft Skills'        ? true
                             : isTNI(a.process_knowledge) && p.category === 'Process Knowledge'  ? true
                             : isTNI(a.communication)     && p.category === 'Communication'      ? true : false)
                  .map(p => `${p.label}: ${p.tip}`)
                  .join(' || ');
                rows.push({
                  'Agent ID':          a.agent_id,
                  'Agent Name':        resolveAgent(a.agent_id),
                  'TNI Score':         `${a.tni_score}%`,
                  'Soft Skills %':     `${a.soft_skills}`,
                  'Process Know. %':   `${a.process_knowledge}`,
                  'Communication %':   `${a.communication}`,
                  'Audits':            `${a.audit_count}`,
                  'TNI Categories':    tniCats,
                  'Manager Comment':   tniComments.get(a.agent_id) ?? '',
                  'Coaching Actions':  tips,
                });
              });
            downloadCSV(rows, `training-plan-${new Date().toISOString().slice(0, 10)}.csv`);
          };

          return (
            <>
              {tniLoading ? (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-sky-500" />Loading TNI analysis…
                </div>
              ) : !td ? (
                <div className="flex items-center justify-center h-64 text-slate-500 text-sm">No data</div>
              ) : (
                <>
                  {/* ── KPI Cards ─────────────────────────────────────── */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
                    {([
                      { label: 'Active Agents',     value: String(td.summary.active_agents),         color: '#2563EB', sub: 'Distinct agents audited'          },
                      { label: 'Total Audits',       value: String(td.summary.total_audits),          color: '#475569', sub: 'Calls reviewed in period'          },
                      { label: 'Soft Skills Avg',    value: `${td.summary.avg_soft_skills}%`,         color: '#D97706', sub: `${tniCounts.ss} agents need TNI`   },
                      { label: 'Process Know. Avg',  value: `${td.summary.avg_process_knowledge}%`,   color: '#7C3AED', sub: `${tniCounts.pk} agents need TNI`   },
                      { label: 'Communication Avg',  value: `${td.summary.avg_communication}%`,       color: '#059669', sub: `${tniCounts.comm} agents need TNI` },
                    ] as { label: string; value: string; color: string; sub: string }[]).map(c => (
                      <div key={c.label} className="rounded-xl px-4 py-4 bg-white relative overflow-hidden"
                        style={{ border: `2px solid ${c.color}` }}>
                        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: c.color }} />
                        <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: c.color }}>{c.label}</p>
                        <p className="text-3xl font-black tabular-nums text-slate-900 leading-none">{c.value}</p>
                        <p className="text-[9px] mt-1.5 font-semibold text-slate-500">{c.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* ── TNI Alert Banner ──────────────────────────────── */}
                  {(tniCounts.ss > 0 || tniCounts.pk > 0 || tniCounts.comm > 0) && (
                    <div className="mb-5 flex flex-wrap gap-2 items-center p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)', border: '1px solid #0284C7' }}>
                      <span className="text-[10px] font-black text-white uppercase tracking-widest mr-2">⚠ TNI Required (≤{TNI_THRESHOLD}%):</span>
                      {tniCounts.ss   > 0 && <span className="px-3 py-1.5 rounded-full text-[10px] font-bold text-sky-900" style={{ background: 'rgba(255,255,255,0.85)' }}>{tniCounts.ss} agents · Soft Skills</span>}
                      {tniCounts.pk   > 0 && <span className="px-3 py-1.5 rounded-full text-[10px] font-bold text-sky-900" style={{ background: 'rgba(255,255,255,0.85)' }}>{tniCounts.pk} agents · Process Knowledge</span>}
                      {tniCounts.comm > 0 && <span className="px-3 py-1.5 rounded-full text-[10px] font-bold text-sky-900" style={{ background: 'rgba(255,255,255,0.85)' }}>{tniCounts.comm} agents · Communication</span>}
                      <button
                        onClick={() => setTniFormulaOpen(true)}
                        title="How scores are calculated"
                        className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-white hover:bg-white/20 transition-all border border-white/40">
                        <Info size={12} />
                        <span className="uppercase tracking-wider">How scores are calculated</span>
                      </button>
                    </div>
                  )}

                  {/* ── Score Formula Popup ───────────────────────────── */}
                  {tniFormulaOpen && createPortal(
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
                      style={{ backgroundColor: 'rgba(0,0,0,0.78)' }}
                      onClick={() => setTniFormulaOpen(false)}>
                      <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl"
                        onClick={e => e.stopPropagation()}
                        style={{ background: '#fff', border: '1px solid #BAE6FD' }}>
                        {/* Header */}
                        <div className="px-5 py-4 flex items-center justify-between"
                          style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                          <div className="flex items-center gap-2">
                            <Info size={14} className="text-white/70" />
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">How Scores Are Calculated</h3>
                            <span className="text-[9px] font-semibold ml-1" style={{ color: 'rgba(255,255,255,0.65)' }}>TNI threshold ≤ {TNI_THRESHOLD}%</span>
                          </div>
                          <button onClick={() => setTniFormulaOpen(false)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-all">
                            <X size={16} />
                          </button>
                        </div>
                        {/* 3-column grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-sky-100 bg-white">
                          {/* Soft Skills */}
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#D97706' }} />
                              <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Soft Skills (P1)</span>
                              <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full text-amber-700" style={{ background: '#FEF3C7' }}>×8 weight</span>
                            </div>
                            <p className="text-[9px] text-slate-500 mb-2.5 font-medium">
                              Score = <span className="font-black text-slate-700">Hits on 8 params ÷ (8 × Audits) × 100</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {TNI_PARAM_INFO.filter(p => p.category === 'Soft Skills').map(p => (
                                <span key={p.key} className="text-[8.5px] px-1.5 py-0.5 rounded font-semibold text-amber-800" style={{ background: '#FEF3C7', border: '1px solid #FDE68A' }}>{p.label}</span>
                              ))}
                            </div>
                          </div>
                          {/* Process Knowledge */}
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#7C3AED' }} />
                              <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Process Know. (P2)</span>
                              <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full text-violet-700" style={{ background: '#EDE9FE' }}>×5 weight</span>
                            </div>
                            <p className="text-[9px] text-slate-500 mb-2.5 font-medium">
                              Score = <span className="font-black text-slate-700">Hits on 5 params ÷ (5 × Audits) × 100</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {TNI_PARAM_INFO.filter(p => p.category === 'Process Knowledge').map(p => (
                                <span key={p.key} className="text-[8.5px] px-1.5 py-0.5 rounded font-semibold text-violet-800" style={{ background: '#EDE9FE', border: '1px solid #DDD6FE' }}>{p.label}</span>
                              ))}
                            </div>
                          </div>
                          {/* Communication */}
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#059669' }} />
                              <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider">Communication (P3)</span>
                              <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full text-emerald-700" style={{ background: '#D1FAE5' }}>×2 weight</span>
                            </div>
                            <p className="text-[9px] text-slate-500 mb-2.5 font-medium">
                              Score = <span className="font-black text-slate-700">Hits on 2 params ÷ (2 × Audits) × 100</span>
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {TNI_PARAM_INFO.filter(p => p.category === 'Communication').map(p => (
                                <span key={p.key} className="text-[8.5px] px-1.5 py-0.5 rounded font-semibold text-emerald-800" style={{ background: '#D1FAE5', border: '1px solid #A7F3D0' }}>{p.label}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Composite formula footer */}
                        <div className="px-5 py-3 flex flex-wrap items-center gap-3 border-t border-sky-100" style={{ background: '#F0F9FF' }}>
                          <span className="text-[9px] font-black text-sky-700 uppercase tracking-widest">TNI Composite Score =</span>
                          <span className="text-[11px] font-black text-slate-800">
                            (P1 <span style={{ color: '#D97706' }}>× 8</span> &nbsp;+&nbsp; P2 <span style={{ color: '#7C3AED' }}>× 5</span> &nbsp;+&nbsp; P3 <span style={{ color: '#059669' }}>× 2</span>) &nbsp;÷&nbsp; 15
                          </span>
                          <span className="text-[9px] text-slate-500 font-semibold">— weighted average across all 15 parameters</span>
                          <span className="ml-auto text-[9px] font-black px-3 py-1 rounded-full text-red-700" style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}>
                            ≤ {TNI_THRESHOLD}% = Training Needed
                          </span>
                        </div>
                      </div>
                    </div>,
                    document.body
                  )}

                  {/* ── Category Heatmap ──────────────────────────────── */}
                  <div className="rounded-xl mb-5 overflow-hidden" style={{ border: '1px solid #0369A1' }}>
                    <div className="px-5 py-3 flex items-center justify-between"
                      style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                      <div>
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">Category Skill Heatmap</h3>
                        <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Click any agent row to drill into 15 individual parameters</p>
                      </div>
                      <div className="flex items-center gap-4 text-[9px] font-bold text-white/80">
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block bg-red-400"/>≤85% TNI</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block bg-amber-400"/>86–90%</span>
                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded inline-block bg-emerald-400"/>91%+ Good</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="text-[11px] border-collapse w-full">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="py-2 px-4 text-left text-slate-500 font-semibold text-[9px] uppercase tracking-wider sticky left-0 bg-white" style={{ minWidth: '150px' }}>Agent</th>
                            {['Soft Skills (P1)', 'Process Knowledge (P2)', 'Communication (P3)', 'TNI Score'].map(h => (
                              <th key={h} className="py-2 px-3 text-center text-slate-500 font-semibold text-[9px] uppercase tracking-wider" style={{ minWidth: '120px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedAgents.map((a, i) => {
                            const mkCell = (val: number) => {
                              const bg = val <= TNI_THRESHOLD ? '#FECACA' : val <= 90 ? '#FDE68A' : '#A7F3D0';
                              const fg = val <= TNI_THRESHOLD ? '#991B1B' : val <= 90 ? '#92400E' : '#065F46';
                              return { bg, fg };
                            };
                            const ss   = mkCell(a.soft_skills);
                            const pk   = mkCell(a.process_knowledge);
                            const comm = mkCell(a.communication);
                            const tni  = mkCell(a.tni_score);
                            return (
                              <tr key={a.agent_id} className={`border-b border-slate-50 cursor-pointer hover:brightness-95 transition-all`} onClick={() => openDrill(a)}>
                                <td className="py-2 px-4 font-semibold text-slate-700 sticky left-0 bg-white" style={{ background: i % 2 === 0 ? '#fff' : '#F8FAFC' }}>
                                  <div className="flex items-center gap-1.5">
                                    {resolveAgent(a.agent_id)}
                                    <TrendBadge agentId={a.agent_id} />
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-center font-bold tabular-nums" style={{ background: ss.bg, color: ss.fg }}>{a.soft_skills}%</td>
                                <td className="py-2 px-3 text-center font-bold tabular-nums" style={{ background: pk.bg, color: pk.fg }}>{a.process_knowledge}%</td>
                                <td className="py-2 px-3 text-center font-bold tabular-nums" style={{ background: comm.bg, color: comm.fg }}>{a.communication}%</td>
                                <td className="py-2 px-3 text-center font-black tabular-nums text-sm border-l border-slate-200" style={{ background: tni.bg, color: tni.fg }}>{a.tni_score}%</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── Agent-wise TNI Detail Table ───────────────────── */}
                  <div className="bg-white border border-slate-200 rounded-xl mb-6 overflow-hidden">
                    <div className="px-5 py-3 flex items-center gap-3 flex-wrap"
                      style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                      <div className="flex-1">
                        <h3 className="text-xs font-bold text-white uppercase tracking-widest">Agent-wise TNI Analysis</h3>
                        <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>Click any row to drill into 15 individual parameters · ≤{TNI_THRESHOLD}% = TNI</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] text-white/70">Sort:</span>
                        <SortBtn col="tni_score"         label="TNI Score"  />
                        <SortBtn col="soft_skills"       label="P1"         />
                        <SortBtn col="process_knowledge" label="P2"         />
                        <SortBtn col="communication"     label="P3"         />
                        <button onClick={exportTrainingPlan}
                          className="ml-2 flex items-center gap-1 px-3 py-1 rounded-lg text-[9px] font-bold border border-white/40 text-white hover:bg-white/15 transition-colors">
                          <Download size={10} /> Training Plan
                        </button>
                        <ExportBtn onClick={() => downloadCSV(sortedAgents.map(a => ({
                          'Agent ID': a.agent_id, 'Agent Name': resolveAgent(a.agent_id),
                          'Audits': a.audit_count, 'TNI Score %': a.tni_score,
                          'Soft Skills %': a.soft_skills, 'Process Know. %': a.process_knowledge,
                          'Communication %': a.communication,
                          'TNI SS': isTNI(a.soft_skills) ? 'Yes' : 'No',
                          'TNI PK': isTNI(a.process_knowledge) ? 'Yes' : 'No',
                          'TNI CS': isTNI(a.communication) ? 'Yes' : 'No',
                          'Comment': tniComments.get(a.agent_id) ?? '',
                        })), 'tni-detection.csv')} />
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ background: '#E0F2FE' }}>
                            {['Agent Name', 'User ID', 'Audits', 'TNI Score', 'Soft Skills (P1)', 'Process Know. (P2)', 'Communication (P3)', 'Status', 'Manager Note'].map(h => (
                              <th key={h} className="py-2.5 px-3 text-left font-semibold uppercase tracking-wider text-[9px] whitespace-nowrap" style={{ color: '#0369A1' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedAgents.map((agent, i) => {
                            const ssS     = cellStyle(agent.soft_skills);
                            const pkS     = cellStyle(agent.process_knowledge);
                            const commS   = cellStyle(agent.communication);
                            const tniS    = cellStyle(agent.tni_score);
                            const tniCnt  = [isTNI(agent.soft_skills), isTNI(agent.process_knowledge), isTNI(agent.communication)].filter(Boolean).length;
                            const rowBg   = i % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
                            const trend   = trendFor(agent.agent_id);
                            return (
                              <tr key={agent.agent_id} style={{ background: rowBg }}
                                className="border-b border-slate-100 cursor-pointer hover:bg-sky-50/60 transition-colors"
                                onClick={() => openDrill(agent)}>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  <div className="flex items-center gap-1.5">
                                    {resolveAgent(agent.agent_id)}
                                    {trend === 'up'   && <span className="text-[10px] text-emerald-500 font-bold" title="Improving">↑</span>}
                                    {trend === 'down' && <span className="text-[10px] text-red-500 font-bold"     title="Declining">↓</span>}
                                    {trend === 'flat' && <span className="text-[10px] text-slate-400"             title="Stable">→</span>}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 font-mono text-[10px]">{agent.agent_id}</td>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-700 tabular-nums">{agent.audit_count}</td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded font-black tabular-nums text-[12px]" style={{ background: tniS.bg, color: tniS.text }}>{agent.tni_score}%</span>
                                </td>
                                {[
                                  { val: agent.soft_skills,       s: ssS   },
                                  { val: agent.process_knowledge, s: pkS   },
                                  { val: agent.communication,     s: commS },
                                ].map(({ val, s }, ci) => (
                                  <td key={ci} className="py-2.5 px-3">
                                    <div className="flex items-center gap-1.5">
                                      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${val}%`, background: s.text }} />
                                      </div>
                                      <span className="text-[11px] font-bold tabular-nums min-w-[34px] text-right" style={{ color: s.text }}>{val}%</span>
                                    </div>
                                  </td>
                                ))}
                                <td className="py-2.5 px-3">
                                  {tniCnt === 0 ? (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Pass</span>
                                  ) : tniCnt === 3 ? (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-red-50 text-red-700 border border-red-200">⚠ All 3</span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">TNI {tniCnt}/3</span>
                                  )}
                                </td>
                                <td className="py-1 px-3" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center gap-1">
                                    <input
                                      defaultValue={tniComments.get(agent.agent_id) ?? ''}
                                      placeholder="Add note…"
                                      className="text-[10px] px-2 py-1 border border-slate-200 rounded w-36 focus:outline-none focus:border-sky-400 bg-transparent text-slate-700"
                                      onBlur={e => { if (e.target.value !== (tniComments.get(agent.agent_id) ?? '')) saveComment(agent.agent_id, e.target.value); }}
                                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                    />
                                    {tniSavingId === agent.agent_id && <Loader size={10} className="text-emerald-500 animate-spin" />}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── Week Wise Comparison ──────────────────────────── */}
                  {weekLabels.length > 0 && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-5 py-3 flex items-center justify-between"
                        style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                        <div>
                          <h3 className="text-xs font-bold text-white uppercase tracking-widest">Week Wise Comparison</h3>
                          <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.65)' }}>P1 = Soft Skills · P2 = Process Knowledge · P3 = Communication</p>
                        </div>
                        <div className="flex items-center gap-3 text-[9px] font-bold text-white/80">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-amber-400"/>P1</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-purple-400"/>P2</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-emerald-400"/>P3</span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="text-xs border-collapse" style={{ minWidth: `${Math.max(600, 200 + weekLabels.length * 210)}px` }}>
                          <thead>
                            <tr style={{ background: '#0369A1' }}>
                              <th className="py-2.5 px-4 text-left text-white font-semibold uppercase tracking-wider text-[9px] sticky left-0 z-10" style={{ background: '#0369A1', minWidth: '160px' }}>
                                Agent Name
                              </th>
                              {weekLabels.map(wk => (
                                <th key={wk} colSpan={4} className="py-2.5 px-4 text-center text-white font-bold uppercase tracking-wider text-[9px] border-l border-sky-500">{wk}</th>
                              ))}
                            </tr>
                            <tr style={{ background: '#0EA5E9' }}>
                              <th className="py-1.5 px-4 text-left text-white/80 text-[9px] sticky left-0 z-10" style={{ background: '#0EA5E9' }}>Week / P1 / P2 / P3 / Avg</th>
                              {weekLabels.map(wk => (
                                <React.Fragment key={wk}>
                                  <th className="py-1.5 px-3 text-center text-white text-[9px] font-bold border-l border-sky-400">P1</th>
                                  <th className="py-1.5 px-3 text-center text-white text-[9px] font-bold">P2</th>
                                  <th className="py-1.5 px-3 text-center text-white text-[9px] font-bold">P3</th>
                                  <th className="py-1.5 px-3 text-center text-white text-[9px] font-bold border-l border-sky-300">Avg</th>
                                </React.Fragment>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedAgents.map((agent, i) => {
                              const agentWeeks = weekMap.get(agent.agent_id);
                              const rowBg = i % 2 === 0 ? '#FFFFFF' : '#F0F9FF';
                              return (
                                <tr key={agent.agent_id} style={{ background: rowBg }} className="border-b border-sky-100 hover:bg-sky-50 transition-colors">
                                  <td className="py-2.5 px-4 font-semibold text-slate-700 sticky left-0 z-10" style={{ background: rowBg, minWidth: '160px' }}>
                                    {resolveAgent(agent.agent_id)}
                                  </td>
                                  {weekLabels.map(wk => {
                                    const d = agentWeeks?.get(wk);
                                    if (!d) return (
                                      <React.Fragment key={wk}>
                                        <td className="py-2.5 px-3 text-center text-slate-400 border-l border-sky-100">—</td>
                                        <td className="py-2.5 px-3 text-center text-slate-400">—</td>
                                        <td className="py-2.5 px-3 text-center text-slate-400">—</td>
                                        <td className="py-2.5 px-3 text-center text-slate-400 border-l border-sky-100">—</td>
                                      </React.Fragment>
                                    );
                                    const ssS = cellStyle(d.ss); const pkS = cellStyle(d.pk); const commS = cellStyle(d.comm);
                                    const agentAvg = Math.round((d.ss + d.pk + d.comm) / 3 * 10) / 10;
                                    const avgS = cellStyle(agentAvg);
                                    return (
                                      <React.Fragment key={wk}>
                                        <td className="py-2.5 px-3 text-center font-bold tabular-nums text-[11px] border-l border-sky-100" style={{ background: ssS.bg,   color: ssS.text   }}>{d.ss}</td>
                                        <td className="py-2.5 px-3 text-center font-bold tabular-nums text-[11px]"                            style={{ background: pkS.bg,   color: pkS.text   }}>{d.pk}</td>
                                        <td className="py-2.5 px-3 text-center font-bold tabular-nums text-[11px]"                            style={{ background: commS.bg, color: commS.text }}>{d.comm}</td>
                                        <td className="py-2.5 px-3 text-center font-black tabular-nums text-[11px] border-l border-sky-100" style={{ background: avgS.bg, color: avgS.text }}>{agentAvg}</td>
                                      </React.Fragment>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                            {/* ── Average row ── */}
                            <tr className="border-t-2 border-sky-300" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                              <td className="py-3 px-4 font-black text-white text-[11px] uppercase tracking-widest sticky left-0 z-10" style={{ background: '#0369A1', minWidth: '160px' }}>
                                ⌀ Avg (All Agents)
                              </td>
                              {weekLabels.map(wk => {
                                const vals = sortedAgents
                                  .map(a => weekMap.get(a.agent_id)?.get(wk))
                                  .filter((d): d is { ss: number; pk: number; comm: number } => d !== undefined);
                                const avg = (arr: number[]) =>
                                  arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;
                                const avgSS   = avg(vals.map(d => d.ss));
                                const avgPK   = avg(vals.map(d => d.pk));
                                const avgComm = avg(vals.map(d => d.comm));
                                const avgAll  = avgSS !== null && avgPK !== null && avgComm !== null
                                  ? Math.round((avgSS + avgPK + avgComm) / 3 * 10) / 10
                                  : null;
                                return (
                                  <React.Fragment key={wk}>
                                    <td className="py-3 px-3 text-center font-black tabular-nums text-[12px] border-l border-sky-400 text-white">{avgSS ?? '—'}</td>
                                    <td className="py-3 px-3 text-center font-black tabular-nums text-[12px] text-white">{avgPK ?? '—'}</td>
                                    <td className="py-3 px-3 text-center font-black tabular-nums text-[12px] text-white">{avgComm ?? '—'}</td>
                                    <td className="py-3 px-3 text-center font-black tabular-nums text-[12px] border-l border-sky-300 text-white">{avgAll ?? '—'}</td>
                                  </React.Fragment>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Parameter Drill Popup (createPortal) ──────────── */}
                  {tniDrillAgent && createPortal(
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
                      style={{ backgroundColor: 'rgba(0,0,0,0.82)' }}
                      onClick={() => { setTniDrillAgent(null); setTniDrillData(null); }}>
                      <div className="rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
                        style={{ background: '#fff', border: '1px solid #BAE6FD' }}
                        onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-sky-100"
                          style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="text-[9px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.55)' }}>Parameter Drill · TNI Analysis</p>
                              <h2 className="text-white font-bold text-base leading-tight">{resolveAgent(tniDrillAgent.agent_id)}</h2>
                              <p className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{tniDrillAgent.agent_id} · {tniDrillAgent.audit_count} audits</p>
                            </div>
                            <div className="ml-4 flex gap-2">
                              {(['Soft Skills', 'Process Knowledge', 'Communication'] as const).map(cat => {
                                const val = cat === 'Soft Skills' ? tniDrillAgent.soft_skills : cat === 'Process Knowledge' ? tniDrillAgent.process_knowledge : tniDrillAgent.communication;
                                const clr = TNI_CAT_COLOR[cat];
                                return (
                                  <div key={cat} className="text-center px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.15)' }}>
                                    <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: clr }}>{cat.split(' ')[0]}</p>
                                    <p className="text-white font-black text-sm tabular-nums">{val}%</p>
                                    {isTNI(val) && <p className="text-[8px] text-red-300 font-bold">TNI</p>}
                                  </div>
                                );
                              })}
                              <div className="text-center px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.15)' }}>
                                <p className="text-[8px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.55)' }}>TNI Score</p>
                                <p className="font-black text-sm tabular-nums" style={{ color: isTNI(tniDrillAgent.tni_score) ? '#FCA5A5' : '#A7F3D0' }}>{tniDrillAgent.tni_score}%</p>
                              </div>
                            </div>
                          </div>
                          <button onClick={() => { setTniDrillAgent(null); setTniDrillData(null); }}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 transition-all">
                            <X size={14} />
                          </button>
                        </div>
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-5" style={{ background: '#F0F9FF' }}>
                          {tniDrillLoading ? (
                            <div className="flex items-center justify-center py-16 gap-3">
                              <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
                              <span className="text-sky-600 text-sm">Loading 15 parameters…</span>
                            </div>
                          ) : !tniDrillData ? (
                            <div className="text-center py-12 text-slate-400 text-sm">No parameter data available</div>
                          ) : (
                            <div className="grid grid-cols-1 gap-4">
                              {(['Soft Skills', 'Process Knowledge', 'Communication'] as const).map(cat => {
                                const catParams = TNI_PARAM_INFO.filter(p => p.category === cat);
                                const catVal = cat === 'Soft Skills' ? tniDrillAgent.soft_skills : cat === 'Process Knowledge' ? tniDrillAgent.process_knowledge : tniDrillAgent.communication;
                                const clr = TNI_CAT_COLOR[cat];
                                return (
                                  <div key={cat} className="rounded-xl overflow-hidden bg-white" style={{ border: '1px solid #BAE6FD' }}>
                                    <div className="px-4 py-2.5 flex items-center justify-between border-b border-sky-100"
                                      style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
                                      <p className="text-[11px] font-bold uppercase tracking-wider text-white">{cat}</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-white font-bold tabular-nums">{catVal}%</span>
                                        {isTNI(catVal) && <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-100 text-red-600">TNI</span>}
                                      </div>
                                    </div>
                                    <div className="divide-y divide-sky-50">
                                      {catParams.map(p => {
                                        const val = Number(tniDrillData[p.key] ?? 0);
                                        const fail = isTNI(val);
                                        return (
                                          <div key={p.key} className="px-4 py-2.5">
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="text-[10px] font-semibold" style={{ color: fail ? '#DC2626' : '#0F172A' }}>{p.label}</span>
                                              <span className="text-[11px] font-bold tabular-nums" style={{ color: fail ? '#DC2626' : '#059669' }}>{val}%</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-sky-100 overflow-hidden mb-1">
                                              <div className="h-full rounded-full transition-all"
                                                style={{ width: `${val}%`, background: fail ? '#EF4444' : val <= 90 ? '#F59E0B' : '#10B981' }} />
                                            </div>
                                            {fail && (
                                              <p className="text-[9px] text-sky-600 mt-1 leading-tight">💡 {p.tip}</p>
                                            )}
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
                      </div>
                    </div>,
                    document.body
                  )}
                </>
              )}
            </>
          );
        })()}

        {/* ── CLAP 360° Intelligence slide ──────────────────────────────────── */}
        {activeSlide === 6 && (
          <Clap360Intelligence
            clientId={clientId}
            startDate={startDate.replace('T', ' ')}
            endDate={endDate.replace('T', ' ')}
          />
        )}

      </div>

      {/* ── Drill-down Modal ─────────────────────────────────────────────────── */}
      {drillModal && (
        <DrillModal title={drillModal.title} accent={drillModal.accent} onClose={() => { setDrillModal(null); setDrillLoading(false); }}>
          {drillLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-sky-400" />
              <span className="text-sm text-slate-400">Loading data…</span>
            </div>
          ) : drillModal.rows.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">No data found for this period.</div>
          ) : (
            <>
              <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="border-b border-slate-200 bg-white">
                      {drillModal.columns.map(c => (
                        <th key={c.key} className="py-2.5 px-4 text-left text-slate-600 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {drillModal.rows.map((row, i) => (
                      <tr key={i} className={i % 2 ? 'bg-transparent' : ''}>
                        {drillModal.columns.map(c => (
                          <td key={c.key} className="py-2.5 px-4 text-slate-900 tabular-nums">
                            {String(row[c.key] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">{drillModal.rows.length} records</span>
                <ExportBtn onClick={() => downloadCSV(drillModal.rows, `${drillModal.title.replace(/\s+/g, '-').toLowerCase()}.csv`)} title="Export this table" />
              </div>
            </>
          )}
        </DrillModal>
      )}

      {socialThreatOpen && (
        <SocialThreatDetailModal
          detail={socialThreatDetail}
          loading={socialThreatLoading}
          onClose={() => { setSocialThreatOpen(false); setSocialThreatDetail(null); }}
          onLeadClick={handleLeadClick}
        />
      )}

      {scamDetailOpen && (
        <ScamDetailModal
          detail={scamDetail}
          loading={scamDetailLoading}
          onClose={() => { setScamDetailOpen(false); setScamDetail(null); }}
          onLeadClick={handleLeadClick}
        />
      )}

      {abuseDetailOpen && (
        <AbuseDetailModal
          detail={abuseDetail}
          loading={abuseDetailLoading}
          onClose={() => { setAbuseDetailOpen(false); setAbuseDetail(null); }}
          onLeadClick={handleLeadClick}
        />
      )}

      {threatDetailOpen && (
        <NegSignalDetailModal
          signal="Threat"
          detail={threatDetail}
          loading={threatDetailLoading}
          onClose={() => { setThreatDetailOpen(false); setThreatDetail(null); }}
          onLeadClick={handleLeadClick}
        />
      )}

      {frustDetailOpen && (
        <NegSignalDetailModal
          signal="Frustration"
          detail={frustDetail}
          loading={frustDetailLoading}
          onClose={() => { setFrustDetailOpen(false); setFrustDetail(null); }}
          onLeadClick={handleLeadClick}
        />
      )}

      {posModalOpen && (
        <PosSignalDetailModal
          keyword={posModalKeyword}
          color={posModalColor}
          phrases={posModalPhrases}
          phrasesLoading={posModalPhrasesLoading}
          leads={posModalLeads}
          leadsLoading={posModalLeadsLoading}
          onClose={() => { setPosModalOpen(false); setPosModalPhrases([]); setPosModalLeads([]); }}
          onLeadClick={handleLeadClick}
        />
      )}

      {/* Golden Words Category Drill */}
      {catDrill.open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)' }} onClick={() => setCatDrill({ ...catDrill, open: false })}>
          <div className="rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
            style={{ background: '#ffffff', border: `2px solid ${catDrill.accent}40` }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="relative px-6 py-5 flex items-start gap-4 overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${catDrill.accent}EE 0%, ${catDrill.accent}99 100%)` }}>
              <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg z-10"
                style={{ background: 'rgba(255,255,255,0.25)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)' }}>
                📊
              </div>
              <div className="flex-1 z-10">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-0.5">Golden Words — Category Drill</p>
                <h2 className="text-lg font-bold text-white leading-tight">{catDrill.title}</h2>
              </div>
              <button onClick={() => setCatDrill({ ...catDrill, open: false })}
                className="shrink-0 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-white/20"
                style={{ color: 'rgba(255,255,255,0.8)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-auto flex-1" style={{ background: '#F8FAFC' }}>
              {catDrill.loading ? (
                <div className="flex items-center justify-center py-16 gap-3" style={{ color: catDrill.accent }}>
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm font-semibold">Loading leads…</span>
                </div>
              ) : catDrill.leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                  <span className="text-4xl">📋</span>
                  <p className="text-sm font-medium">No leads found for this period.</p>
                </div>
              ) : (
                <div className="p-5">
                  <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: `1px solid ${catDrill.accent}25` }}>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr style={{ background: `linear-gradient(135deg, ${catDrill.accent}22 0%, ${catDrill.accent}12 100%)` }}>
                          <th className="text-left px-4 py-2.5 font-bold text-slate-700">Lead ID</th>
                          <th className="text-left px-4 py-2.5 font-bold text-slate-700">Agent ID</th>
                          <th className="text-left px-4 py-2.5 font-bold text-slate-700">Word / Phrase Used</th>
                          <th className="text-left px-4 py-2.5 font-bold text-slate-700">Scenario</th>
                          <th className="text-left px-4 py-2.5 font-bold text-slate-700">Sub-Scenario</th>
                          <th className="text-left px-4 py-2.5 font-bold text-slate-700">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catDrill.leads.map((row, i) => (
                          <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5">
                              <button className="text-xs font-bold underline underline-offset-2 hover:opacity-70 transition-opacity"
                                style={{ color: catDrill.accent }}
                                onClick={() => handleLeadClick(row.lead_id)}>
                                {row.lead_id}
                              </button>
                            </td>
                            <td className="px-4 py-2.5 text-slate-700 font-medium">{resolveAgent(row.agent_id)}</td>
                            <td className="px-4 py-2.5 text-slate-700 max-w-[200px] truncate" title={row.phrase}>{row.phrase}</td>
                            <td className="px-4 py-2.5 text-slate-600">{row.scenario}</td>
                            <td className="px-4 py-2.5 text-slate-600">{row.scenario1 || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{row.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-3">{catDrill.leads.length} records</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {transcriptLeadId && (
        <TranscriptModal
          data={transcriptData}
          loading={transcriptLoading}
          onClose={() => { setTranscriptLeadId(null); setTranscriptData(null); }}
        />
      )}

      {scoreCompModal && (
        <ScoreComponentModal
          label={scoreCompModal.label}
          accent={scoreCompModal.accent}
          params={(Array.isArray(scoreCompData?.[scoreCompModal.key]) ? scoreCompData![scoreCompModal.key] : []) as ScoreParamDetail[]}
          loading={scoreCompLoading}
          onClose={() => setScoreCompModal(null)}
        />
      )}

      {fatalModalOpen && (
        <FatalCallsModal
          calls={fatalCalls}
          loading={fatalCallsLoading}
          onClose={() => setFatalModalOpen(false)}
          onLeadClick={openFatalTranscript}
          resolveAgent={resolveAgent}
        />
      )}

      {/* Agent Calls Modal */}
      {agentCallsModal.open && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)' }} onClick={() => setAgentCallsModal({ ...agentCallsModal, open: false })}>
          <div className="rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden bg-white"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-5 py-3 border-b"
              style={{ background: 'linear-gradient(135deg,#0EA5E9 0%,#06B6D4 100%)' }}>
              <div className="p-2 rounded-xl bg-white/20">
                <Phone size={16} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{agentCallsModal.agent} — Calls</p>
                <p className="text-[10px] text-white/70 mt-0.5">
                  {agentCallsModal.loading ? 'Loading…' : `${agentCallsModal.calls.length} call${agentCallsModal.calls.length !== 1 ? 's' : ''} · Click Lead ID to view transcript`}
                </p>
              </div>
              <button onClick={() => setAgentCallsModal({ ...agentCallsModal, open: false })}
                className="text-white/70 hover:text-white p-1"><X size={18} /></button>
            </div>
            <div className="overflow-auto flex-1">
              {agentCallsModal.loading ? (
                <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                  <Loader2 size={20} className="animate-spin" />
                  <span className="text-sm font-semibold">Loading calls…</span>
                </div>
              ) : agentCallsModal.calls.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
                  <span className="text-4xl">📋</span>
                  <p className="text-sm">No calls found for this period.</p>
                </div>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="sticky top-0 bg-slate-50 border-b border-slate-200">
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600">#</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Lead ID</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Date</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Scenario</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-slate-600">Sub-Scenario</th>
                      <th className="px-3 py-2.5 text-right font-semibold text-slate-600">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentCallsModal.calls.map((c, i) => (
                      <tr key={c.lead_id + i} className="border-t border-slate-100 hover:bg-sky-50 transition-colors">
                        <td className="px-3 py-2 text-slate-400 font-mono">{i + 1}</td>
                        <td className="px-3 py-2">
                          <button className="font-mono text-blue-600 hover:text-blue-800 hover:underline font-bold transition-colors"
                            onClick={() => handleLeadClick(c.lead_id)} title="Click to view transcript">
                            {c.lead_id || '—'}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{c.call_date}</td>
                        <td className="px-3 py-2">
                          <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-100 text-slate-600">{c.scenario}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-500">{c.scenario1 || '—'}</td>
                        <td className="px-3 py-2 text-right font-bold"
                          style={{ color: c.score != null ? (c.score >= 90 ? '#22C55E' : c.score >= 80 ? '#F59E0B' : '#EF4444') : '#94A3B8' }}>
                          {c.score != null ? `${c.score}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {fatalTranscriptItem && (
        <FatalTranscriptModal
          data={fatalTranscriptData}
          loading={fatalTranscriptLoading}
          onClose={() => { setFatalTranscriptItem(null); setFatalTranscriptData(null); }}
          fatalItem={fatalTranscriptItem}
        />
      )}
    </div>
  );
}
