import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useProcessStore } from '@/store/processStore';
import { useAuthStore } from '@/store/authStore';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
  BarChart, Bar,
} from 'recharts';
import {
  BarChart3, ChevronLeft, PhoneCall, PhoneOff,
  Target, TrendingUp, Users, XCircle, AlertTriangle, ThumbsDown, Info, Download, X, Pencil,
  ShieldAlert, AlertOctagon, Trash2, Plus, Save,
} from 'lucide-react';
import api from '@/lib/axios';

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

// dd-mm-yyyy hh:mm:ss, no timezone text — used for raw SQL date/datetime strings from the API.
function fmtDateTime(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ─── Export Button ────────────────────────────────────────────────────────────
function ExportBtn({ onClick, title = 'Export CSV' }: { onClick: () => void; title?: string }) {
  return (
    <button onClick={onClick} title={title}
      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-500 hover:text-emerald-400 border border-slate-200 hover:border-emerald-500/30 transition-colors shrink-0">
      <Download size={11} /> CSV
    </button>
  );
}

// ─── Drill Modal ──────────────────────────────────────────────────────────────
interface PQDrillModalProps { title: string; accent: string; onClose: () => void; children: React.ReactNode; }
function PQDrillModal({ title, accent, onClose, children }: PQDrillModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-4"
      onClick={onClose}>
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
          <div className="w-1 h-5 rounded-full" style={{ background: accent }} />
          <p className="text-sm font-bold text-slate-900 flex-1">{title}</p>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-900 transition-colors"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function toLocalDT(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface CSTData {
  totalCalls: number;
  ops: number;
  cps: number;
  offeredSuccess: number;
  saleDone: number;
  successRatePct: number;
}

interface CRTData {
  orCount: number;
  crCount: number;
  oprCount: number;
  porCount: number;
  failureRatePct: number;
}

interface CSTCRTData extends CSTData, CRTData {}

interface PieSlice {
  name: string;
  value: number;
}

interface FunnelStep {
  name: string;
  value: number;
}

interface AnalysisRow {
  totalCalls: number;
  opsCount: number;
  orCount: number;
  saleCount: number;
}

interface OPCategoryRow extends AnalysisRow { openingCategory: string; }
interface CSCategoryRow extends AnalysisRow { contactGroup: string; }

interface OfferedPitchRow {
  discountType: string;
  totalOffer: number;
  orCount: number;
  osCount: number;
  saleCount: number;
}

interface DetailAnalysisResponse {
  opCategories: OPCategoryRow[];
  csCategories: CSCategoryRow[];
  offeredPitch: OfferedPitchRow[];
}

interface ObjectionRow {
  objectionCount: number;
  failedRebuttal: number;
  successfulRebuttal: number;
  saleCount: number;
}
interface POSBreakdownRow extends ObjectionRow { mainObjection: string; }
interface POSSubcategoryRow extends ObjectionRow { cxObjectionSubcat: string; }
interface ObjectionAnalysisResponse {
  posBreakdown: POSBreakdownRow[];
  posSubcategory: POSSubcategoryRow[];
}

interface AgentNPSRow {
  agent: string;
  calls: number;
  promoter: number;
  passive: number;
  detractor: number;
  csat: number;
  nps: number;
  agentId:   string;
  agentName: string;
  total:     number;
  npsScore:  number;
}

interface OutboundMissingAgentRow {
  agentId:     string;
  total_count: number;
}

interface OutboundCustomerInsights {
  audit_count: number;
  legal_escalation_count: number;
  social_escalation_count: number;
  potential_scam: number;
  refund_count: number;
  cancellation_count: number;
  frustration_count: number;
  threat_count: number;
  cuss_abuse_count: number;
  slang_count: number;
  sarcasm_count: number;
  golden_words: { category: string; count: number; keywords: string[] }[];
  cached_through: string | null;
}

interface OutboundInsightLead { callId: number; leadId: string; agentName: string; mobileNo: string; callDate: string; type: string; matchedWord: string; }
interface OutboundCallTranscript { callId: number; leadId: string; agentName: string; mobileNo: string; callDate: string; transcript: string; }
interface SaleDoneCallRow { callId: number; callDate: string; agentName: string; mobileNo: string; fileName: string; }

interface KPIResponse {
  cst: CSTData;
  crt: CRTData;
  rejectedPie: PieSlice[];
  cstFunnel: FunnelStep[];
  crtFunnel: FunnelStep[];
  auditCountByDate: { calldate: string; count: number }[];
  opportunity: {
    totalOpportunities: number;
    moCount: number;
    opportunityLoss: PieSlice[];
    opportunityCategory: PieSlice[];
    moBreaks: PieSlice[];
    moCategoryTable: { category: string; insight: string; count: number; pct: number }[];
    objectionCategoryPie: PieSlice[];
    nedTable: { nedCategory: string; nedQS: string; nedStatus: string; count: number; pct: number }[];
  };
  nps: {
    total: number;
    promoter: number;
    detractor: number;
    passive: number;
    npsScore: number;
    csatPct: number;
    days: { calldate: string; totalFeedbacks: number; promoter: number; detractor: number; passive: number; npsScore: number }[];
  };
}

const pieColors: Record<string, string> = {
  'Opening Rejected': '#EF4444',
  'Context Rejected': '#F59E0B',
  'Offering Rejected': '#A78BFA',
  'Post Offer Rejected': '#3B82F6',
};

const funnelCSTColors = ['#3B82F6', '#22C55E', '#14B8A6', '#A78BFA', '#F59E0B'];

const TT: React.CSSProperties = {
  background: '#FFFFFF', border: '1px solid #E2E8F0',
  borderRadius: 8, fontSize: 11, color: '#334155',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
};

const COLORS = ['#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#14B8A6', '#A78BFA'];

const OBJ_CAT_COLORS: Record<string, string> = {
  'No Need':             '#64748B',
  'Brand Preference':    '#3B82F6',
  'Price Sensitivity':   '#F59E0B',
  'Budget Constraint':   '#A78BFA',
  'Product Disinterest': '#EF4444',
  'Negative Experience': '#EC4899',
  'Logistic Concern':    '#14B8A6',
  'Trust Concerns':      '#22C55E',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComp = React.ComponentType<any>;

interface MetricInfo {
  label: string;
  value: string;
  icon: IconComp;
  color: string;
  description: string;
  calculation: string;
}

const CST_METRICS = (cst: CSTData): MetricInfo[] => [
  {
    label: 'Total Calls', value: cst.totalCalls.toLocaleString(),
    icon: PhoneCall, color: '#3B82F6',
    description: 'Total valid calls for this process after removing records with missing MobileNo or Customer Objection Category.',
    calculation: 'COUNT(*) FROM valid CTE (WHERE MobileNo IS NOT NULL AND CustomerObjectionCategory IS NOT NULL)',
  },
  {
    label: 'OPS', value: cst.ops.toLocaleString(),
    icon: Target, color: '#22C55E',
    description: 'Calls that passed the opening stage — the agent successfully initiated the conversation.',
    calculation: 'COUNT(*) WHERE rejected_status != \'Opening Rejected\' (i.e. ContactSettingContext != \'None\')',
  },
  {
    label: 'CPS', value: cst.cps.toLocaleString(),
    icon: Target, color: '#14B8A6',
    description: 'Calls that passed both opening and context stages — the agent established context.',
    calculation: 'COUNT(*) WHERE rejected_status NOT IN (\'Opening Rejected\', \'Context Rejected\')',
  },
  {
    label: 'Offered Success', value: cst.offeredSuccess.toLocaleString(),
    icon: TrendingUp, color: '#A78BFA',
    description: 'Calls where the offer/pitch was successfully made to the customer without early rejection.',
    calculation: 'COUNT(*) FROM base (without objection filter) WHERE rejected_status NOT IN (\'Opening Rejected\', \'Offering Rejected\')',
  },
  {
    label: 'Sale Done', value: cst.saleDone.toLocaleString(),
    icon: Users, color: '#F59E0B',
    description: 'Calls where the sale was successfully completed.',
    calculation: 'COUNT(*) WHERE SaleDone = 1',
  },
  {
    label: 'Success Rate', value: `${cst.successRatePct}%`,
    icon: Target, color: '#22C55E',
    description: 'Percentage of total calls that resulted in a successful sale.',
    calculation: '(Sale Done / Total Calls) × 100',
  },
];

const CRT_METRICS = (crt: CRTData): MetricInfo[] => [
  {
    label: 'OR (Opening Rejected)', value: crt.orCount.toLocaleString(),
    icon: PhoneOff, color: '#EF4444',
    description: 'Calls rejected at the opening stage — the agent could not set contact context.',
    calculation: 'COUNT(*) WHERE rejected_status = \'Opening Rejected\' (ContactSettingContext = \'None\')',
  },
  {
    label: 'CR (Context Rejected)', value: crt.crCount.toLocaleString(),
    icon: AlertTriangle, color: '#F59E0B',
    description: 'Calls rejected after opening — the agent could not handle the context.',
    calculation: 'COUNT(*) WHERE rejected_status = \'Context Rejected\' (ObjectionHandlingContext = \'None\')',
  },
  {
    label: 'OPR (Offering Rejected)', value: crt.oprCount.toLocaleString(),
    icon: ThumbsDown, color: '#A78BFA',
    description: 'Calls rejected at the offering stage — the customer objected to the offer.',
    calculation: 'COUNT(*) WHERE rejected_status = \'Offering Rejected\' (ObjectionHandlingContext = \'None\' after context was set)',
  },
  {
    label: 'POR (Post Offer Rejected)', value: crt.porCount.toLocaleString(),
    icon: XCircle, color: '#3B82F6',
    description: 'Calls rejected after the offer was made — customer declined after hearing the offer.',
    calculation: 'COUNT(*) WHERE rejected_status NOT IN (\'Offering Rejected\',\'Opening Rejected\',\'Context Rejected\') (AfterListeningOfferRejected=1 OR SaleDone=1)',
  },
  {
    label: 'Failure Rate', value: `${crt.failureRatePct}%`,
    icon: AlertTriangle, color: '#EF4444',
    description: 'Percentage of total calls that did NOT result in a sale.',
    calculation: '((Total Calls - Sale Done) / Total Calls) × 100',
  },
];

interface ChartDetail {
  title: string;
  description: string;
  methodology: string;
  scale?: string;
  insights?: string[];
}

const CHART_DETAILS: Record<string, ChartDetail> = {
  cstSection: {
    title: 'CST — Customer Success Track',
    description: 'Tracks how many calls successfully progressed through each stage of the sales process, from initial contact to a completed sale.',
    methodology: `Total Calls  → all valid calls (MobileNo non-empty, CustomerObjectionCategory non-empty)
OPS          → Calls where Opening Passed (ContactSettingContext ≠ 'None')
CPS          → Calls where Context Passed (ObjectionHandlingContext ≠ 'None')
Offered      → Calls where the offer was made (not early-rejected)
Sale Done    → SaleDone = 1
Success Rate → Sale Done / Total Calls × 100`,
    insights: [
      'Drop between Total → OPS: agents struggling with opening stage',
      'Drop between OPS → CPS: context-setting or engagement issue',
      'Drop between CPS → Offered: objection handling needs improvement',
      'Drop between Offered → Sale: post-offer conversion problem',
    ],
  },
  crtSection: {
    title: 'CRT — Customer Rejection Track',
    description: 'Shows how many calls were rejected at each stage of the process, helping pinpoint where the biggest failure mode is occurring.',
    methodology: `OR  (Opening Rejected)    → ContactSettingContext = 'None'
CR  (Context Rejected)    → ObjectionHandlingContext = 'None' (after opening)
OPR (Offering Rejected)   → Customer objected after context was established
POR (Post Offer Rejected) → AfterListeningOfferRejected = 1 OR SaleDone = 1
Failure Rate → (Total Calls − Sale Done) / Total Calls × 100`,
    insights: [
      'High OR → agents failing at the very first touch-point of the call',
      'High CR → good opening but failure to build rapport/context',
      'High OPR → offer is not resonating — revisit pitch or product positioning',
      'High POR → customer heard the offer but still rejected — pricing or urgency issue',
    ],
  },
  cstFunnel: {
    title: 'CST Funnel — Success Stage Breakdown',
    description: 'Funnel chart visualising the count of calls at each Customer Success Track stage, from Total Calls down to Sale Done.',
    methodology: `Each stage is a COUNT of calls that passed all previous stages.
Stage widths are proportional to call volume at that level.
Aim: identify which stage has the largest relative drop-off.`,
    insights: [
      'The widest-to-narrowest transition shows your biggest loss point',
      'Compare this funnel across time periods to track improvement',
      'Healthy funnel: gradual taper — sudden narrows indicate specific problems',
    ],
  },
  crtFunnel: {
    title: 'CRT Funnel — Rejection Stage Breakdown',
    description: 'Funnel chart showing the distribution of rejected calls across each rejection stage (OR → CR → OPR → POR).',
    methodology: `Each bar = count of calls rejected at that specific stage.
OR  → Opening Rejected
CR  → Context Rejected
OPR → Offering Rejected
POR → Post Offer Rejected
Note: stages are independent counts, not cumulative.`,
    insights: [
      'Largest bar = dominant failure mode — focus training here first',
      'High early-stage (OR/CR) rejection → script or opener needs rework',
      'High late-stage (OPR/POR) rejection → offer content / pricing issue',
    ],
  },
  rejectedPie: {
    title: 'Rejected Status Distribution',
    description: 'Pie chart showing the proportion of calls in each rejection category, revealing which type of rejection is most prevalent.',
    methodology: `Rejection status is derived by a CASE expression on each call:
  AfterListeningOfferRejected=1 OR SaleDone=1 → Post Offer Rejected
  ObjectionHandlingContext='None'              → Offering Rejected
  ContactSettingContext='None'                 → Context Rejected
  ELSE                                         → Opening Rejected
Only calls with a non-empty CustomerObjectionCategory are included.`,
    insights: [
      'Largest slice = your primary area of focus for quality improvement',
      'Use alongside the CRT Funnel for a dual perspective on rejection',
    ],
  },
  objectionPie: {
    title: 'Objection Category Distribution',
    description: 'Full-population pie of customer objection categories across all calls (no SaleDone filter), showing why customers resist purchase overall.',
    methodology: `CustomerObjectionSubCategory mapped to 8 categories:
  No Need, Brand Preference, Price Sensitivity, Budget Constraint,
  Product Disinterest, Negative Experience, Logistic Concern, Trust Concerns.
NULL / empty / unmatched → 'No Need'.
Filter: rejected_status NOT IN ('Opening Rejected', 'Offering Rejected').`,
    insights: [
      'No Need (dominant) → improve pitch relevance and product targeting',
      'Price Sensitivity → test promotional offers or instalment options',
      'Negative Experience → product/delivery quality needs urgent action',
      'Trust Concerns → invest in brand credibility messaging',
    ],
  },
  moBreakdown: {
    title: 'MO BreakDown — Missed Opportunity Classification',
    description: 'Classifies missed opportunities (non-converted, post-offer calls) as Workable or Non-Workable based on the objection type.',
    methodology: `Base: SaleDone=0, rejected_status NOT IN ('Opening Rejected','Offering Rejected')

Workable (can be re-engaged):
  'Liked the product but wants a better deal'
  'Wants to buy later'
  'Perfume Longevity Issue' / 'Perfume too strong'
  'Damaged/Wrong Product Received'
  'Doesn't trust online payments'

Non-Workable: all other CustomerObjectionSubCategory values`,
    scale: 'Higher Workable % = more conversion potential. Target Workable customers in follow-up campaigns.',
    insights: [
      'Workable MOs: immediately actionable — queue these for follow-up calls',
      'High Non-Workable % → fundamental mismatch between product and audience',
      'Track Workable % over time; improvement signals better objection handling',
    ],
  },
  moCategoryTable: {
    title: 'MO Category Table',
    description: 'Detailed missed opportunity breakdown, mapping each objection sub-category to its parent category with actionable insight text and count distribution.',
    methodology: `Same base as MO BreakDown (SaleDone=0, post-offer stage).
Each CustomerObjectionSubCategory → MO Category + Insight text.
Count% = row count / total MO count × 100.
Sorted by count descending.`,
    insights: [
      'Top-ranked category by Count% = most common missed opportunity type',
      'Insight column guides agent coaching and script adjustments',
      'High count in a single category = systemic issue, not one-off incidents',
    ],
  },
  nedTable: {
    title: 'NED / ED Analysis',
    description: 'Maps each missed opportunity to a NED (Non-Effective Deal) / ED (Effective Deal) qualification score group and workability status.',
    methodology: `NED/ED Category → broad objection category (same as MO Category mapping)
NED/ED QS       → qualification score sub-group (groups similar sub-categories)
NED/ED Status   → Workable / Non-Workable (same logic as MO BreakDown)
Count%          → row count / total NED rows × 100

Base: SaleDone=0, post-opening/offering stage, non-empty category and status.`,
    insights: [
      'Workable rows = actionable leads — these customers can still be converted',
      'NED/ED QS grouping helps standardise agent qualification scripts',
      'Group by Category to identify which area needs most coaching attention',
    ],
  },
  npsGauge: {
    title: 'Net Promoter Score (NPS)',
    description: 'Gauge measuring customer loyalty on a -100 to +100 scale, derived from the difference between Promoters (Positive) and Detractors (Negative) as a percentage of total respondents.',
    methodology: `NPS = % Promoters − % Detractors

  Promoters  = Feedback = 'Positive'
  Detractors = Feedback = 'Negative'
  Passives   = Feedback = 'Neutral'

  NPS = (Σ Positive / Σ Total × 100) − (Σ Negative / Σ Total × 100)
  ROUND(..., 2)`,
    scale: `< 0      → Critical: more detractors than promoters
0 – 30   → Good: positive but room to grow
30 – 70  → Great: strong customer loyalty
> 70     → Excellent: world-class loyalty`,
    insights: [
      'Gauge segments are sized proportionally to Detractor / Passive / Promoter %',
      'Needle points to the exact NPS value on the arc',
      'Focus on converting Detractors to Passives to achieve the fastest NPS lift',
    ],
  },
  csatGauge: {
    title: 'Customer Satisfaction Score (CSAT)',
    description: 'Gauge measuring the percentage of customers who responded positively or neutrally (Satisfied) out of all valid feedback respondents.',
    methodology: `CSAT = (Positive + Neutral) / Total Feedbacks × 100

  Satisfied   = Feedback IN ('Positive', 'Neutral')
  Unsatisfied = Feedback = 'Negative'
  Total       = Feedback IN ('Positive', 'Negative', 'Neutral')

  Stored as decimal (0–1) from SQL, displayed as %.`,
    scale: `< 50%    → Poor: majority dissatisfied
50 – 70% → Moderate: needs significant improvement
70 – 85% → Good: most customers satisfied
> 85%    → Excellent: high customer satisfaction`,
    insights: [
      'CSAT counts Neutral as Satisfied — more lenient than NPS',
      'Compare CSAT vs NPS: if CSAT is high but NPS is low, Neutral customers are close to Detractors',
      'Target Negative feedback reduction to improve both CSAT and NPS simultaneously',
    ],
  },
  feedbackPie: {
    title: 'Feedback Status Breakup',
    description: 'Pie chart showing the proportion of Positive, Negative, and Neutral customer feedback responses, directly showing the Promoter / Detractor / Passive split.',
    methodology: `COUNT of Feedback column grouped by value.
Filter: Feedback IN ('Positive', 'Negative', 'Neutral')
  — NULL, blank, and 'None' values excluded.

Positive (Blue)  → Promoter — inputs NPS positively
Negative (Pink)  → Detractor — inputs NPS negatively
Neutral  (Orange)→ Passive — excluded from NPS numerator`,
    insights: [
      'Large Negative (pink) slice → priority area for agent quality improvement',
      'Positive vs Negative ratio directly determines NPS',
      'Neutral (Passive) customers are a re-engagement opportunity — they are not lost yet',
    ],
  },
  npsTable: {
    title: 'NPS and CSAT Analysis — Day Wise Table',
    description: 'Day-by-day table of feedback volumes and NPS score with heatmap cell colouring to quickly identify high and low performing days.',
    methodology: `Grouped by DATE(CallDate). Per day:
  Detractor = SUM(Feedback='Negative')
  Passive   = SUM(Feedback='Neutral')
  Promoter  = SUM(Feedback='Positive')
  NPS Score = (Promoters − Detractors) / Total × 100  ROUND 2dp
  Total     = COUNT(*)

Grand Total NPS = (Σ Promoters − Σ Detractors) / Σ Total × 100`,
    scale: `Cell intensity = value / column maximum.
Detractor: red   (darker red = more detractors that day)
Passive:   orange
Promoter:  green (darker green = more promoters that day)
Total:     green`,
    insights: [
      'Dark red Detractor cells on a date → investigate what happened that day',
      'Days with high Total Feedbacks and low NPS are the highest-impact problem days',
      'Grand Total NPS is the period-level score — compare across date ranges',
      'Consistent dark red dates may correlate with specific agents or campaigns',
    ],
  },
  npsTrend: {
    title: 'NPS and CSAT Day Wise Trend',
    description: 'Dual-axis line chart tracking daily NPS Score (red, left axis) and Total Feedbacks (orange, right axis) over the selected period to reveal trends and correlations.',
    methodology: `Same data as the Analysis table above.
Left Y-axis:  NPS Score (approx. -100 to +100)
Right Y-axis: Total Feedbacks (raw count)
X-axis:       DATE(CallDate) — one data point per day

NPS dips on high-volume days = high-impact negative periods.`,
    insights: [
      'NPS dip with high feedback volume = critical day — investigate immediately',
      'Upward NPS trend = improving agent quality or product-market alignment',
      'Sudden NPS drop may correlate with external events, campaigns, or product changes',
      'Compare Total Feedbacks trend to understand whether NPS shifts reflect volume changes',
    ],
  },
};

const G_CX = 150, G_CY = 150, G_R_OUT = 110, G_R_IN = 70;

function gaugeArc(startDeg: number, endDeg: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const sx = G_CX + G_R_OUT * Math.cos(rad(startDeg));
  const sy = G_CY - G_R_OUT * Math.sin(rad(startDeg));
  const ex = G_CX + G_R_OUT * Math.cos(rad(endDeg));
  const ey = G_CY - G_R_OUT * Math.sin(rad(endDeg));
  const ix = G_CX + G_R_IN * Math.cos(rad(endDeg));
  const iy = G_CY - G_R_IN * Math.sin(rad(endDeg));
  const ix2 = G_CX + G_R_IN * Math.cos(rad(startDeg));
  const iy2 = G_CY - G_R_IN * Math.sin(rad(startDeg));
  const span = startDeg - endDeg;
  const lg = span >= 180 ? 1 : 0;
  return [
    `M ${sx.toFixed(2)} ${sy.toFixed(2)}`,
    `A ${G_R_OUT} ${G_R_OUT} 0 ${lg} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`,
    `L ${ix.toFixed(2)} ${iy.toFixed(2)}`,
    `A ${G_R_IN} ${G_R_IN} 0 ${lg} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
    'Z',
  ].join(' ');
}

interface MagicalFlowStage {
  stage: string; title: string; script: string | null;
  total_in: number; passed: number; dropped: number;
  success_rate: number; drop_rate: number;
}
interface MagicalObjection {
  title: string; category: string | null; script: string | null;
  total: number; sales: number; conv_pct: number; contribution: number;
}
interface GenericMagicalScriptData {
  variant: 'generic';
  summary: { total_calls: number; op_pass: number; csp_pass: number; offer_pass: number; sale_done: number; overall_conv: number };
  flow: MagicalFlowStage[];
  objections: MagicalObjection[];
  cachedThrough: string | null;
}

interface BellavitaStageMetrics {
  total_in: number; call_end: number; success: number; success_rate: number;
  contribution: number; contribution_rate: number;
}
interface BellavitaMagicalScriptData {
  variant: 'bellavita';
  op: BellavitaStageMetrics & { script: string };
  csp: BellavitaStageMetrics & { scripts: { label: string; text: string; count: number }[] };
  offer: BellavitaStageMetrics & { script: string; topProduct: string | null; products: { product: string; count: number }[] };
  categories: { category: string; script: string; total: number; contribution_pct: number; call_end: number; sale_done: number; conv_pct: number }[];
  cachedThrough: string | null;
}

type MagicalScriptData = GenericMagicalScriptData | BellavitaMagicalScriptData;

interface MagicalScriptConfigRow {
  id: number;
  stage: 'op' | 'csp' | 'offer' | 'objection';
  stageTitle: string;
  objectionCategory: string | null;
  scriptText: string | null;
  displayOrder: number;
}
const EDIT_SCRIPT_ROLES = ['super_admin', 'manager', 'client_admin'];

// ─── Magical Script tree-diagram primitives — shared by every outbound process. Bellavita runs its
// own funnel (its own CallDetails columns and fixed scripts, not the DB-configured generic flow
// every other outbound client uses) but both render through the same connector-line visual style. ──
const MS_LINE_COLOR = '#7DB8E8';
const MS_CALLEND_BG = '#1E3A8A';
const MS_SUCCESS_BG = '#0F7B4F';

// Thin connector line — horizontal by default, or vertical when orientation="v".
function MSLine({ orientation = 'h', size = 20, centered = false }: { orientation?: 'h' | 'v'; size?: number; centered?: boolean }) {
  if (orientation === 'v') {
    return <div className={centered ? 'mx-auto' : undefined} style={{ width: 2, height: size, background: MS_LINE_COLOR }} />;
  }
  return <div className="shrink-0" style={{ width: size, borderTop: `2px solid ${MS_LINE_COLOR}` }} />;
}

// Horizontal bar spanning from the first to the last of `count` equal-width columns, so N
// vertical drops (one per column, self-centered) land exactly on it without any manual math.
function MSFanBar({ count }: { count: number }) {
  if (count <= 1) return null;
  return <div className="mx-auto" style={{ width: `${((count - 1) / count) * 100}%`, borderTop: `2px solid ${MS_LINE_COLOR}` }} />;
}

function MSStageBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center py-2.5 px-3 rounded-lg text-[11px] font-bold text-slate-800 bg-white shrink-0" style={{ border: '1px solid #CBD5E1', minWidth: 130 }}>
      {children}
    </div>
  );
}

function MSScriptBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 rounded-lg px-4 py-3 text-[11px] text-slate-700 leading-relaxed font-medium flex items-center bg-slate-100" style={{ border: '1px solid #E2E8F0' }}>
      {children}
    </div>
  );
}

function MSMetricPill({ bg, children }: { bg: string; children: React.ReactNode }) {
  return (
    <div className="rounded-full px-4 py-2 text-center w-full" style={{ background: bg }}>
      {children}
    </div>
  );
}

function BellavitaMagicalFlow({ ms, productModalOpen, onToggleProductModal }: {
  ms: BellavitaMagicalScriptData;
  productModalOpen: boolean;
  onToggleProductModal: (open: boolean) => void;
}) {
  // Stage row: [badge] —line— [script box] —line— { vertical bracket → [Call End] / [Success·Contribution] }
  const StageRow = ({ label, scriptNode, metrics }: { label: string; scriptNode: React.ReactNode; metrics: BellavitaStageMetrics }) => (
    <div className="flex items-center mb-5 last:mb-0">
      <MSStageBadge>{label}</MSStageBadge>
      <MSLine size={24} />
      <MSScriptBox>{scriptNode}</MSScriptBox>
      <MSLine size={24} />
      <div className="flex flex-col gap-3 shrink-0" style={{ borderLeft: `2px solid ${MS_LINE_COLOR}`, minWidth: 220 }}>
        <div className="flex items-center">
          <MSLine size={16} />
          <MSMetricPill bg={MS_CALLEND_BG}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/70 leading-none mb-1">Call End</p>
            <p className="text-base font-black tabular-nums text-white leading-none">{metrics.call_end.toLocaleString()}</p>
          </MSMetricPill>
        </div>
        <div className="flex items-center">
          <MSLine size={16} />
          <MSMetricPill bg={MS_SUCCESS_BG}>
            <p className="text-[9px] font-bold text-white leading-tight">Success Rate ({metrics.success_rate}%)</p>
            <p className="text-[9px] font-bold text-white leading-tight">Contribution% ({metrics.contribution_rate}%)</p>
          </MSMetricPill>
        </div>
      </div>
    </div>
  );

  const CARD_ACCS = ['#1D4ED8', '#7C3AED', '#0891B2', '#D97706'];

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Calls (OP)', value: ms.op.total_in.toLocaleString(), color: '#1D4ED8' },
          { label: 'OP Success',       value: ms.op.success.toLocaleString(),  color: '#1D4ED8' },
          { label: 'CSP Success',      value: ms.csp.success.toLocaleString(), color: '#0891B2' },
          { label: 'Offer Made',       value: ms.offer.success.toLocaleString(), color: '#059669' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl px-4 py-3 relative overflow-hidden" style={{ border: `2px solid ${c.color}` }}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: c.color }} />
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: c.color }}>{c.label}</p>
            <p className="text-xl font-black tabular-nums text-slate-900 leading-none">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid #0369A1' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
          <span className="text-sm">✨</span>
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Today's Magical Script</h3>
          <span className="text-[9px] ml-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Opening → Context → Offer</span>
          <span className="text-[9px] ml-auto" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {ms.cachedThrough ? `Data cached through ${fmtDateTime(ms.cachedThrough)}` : 'Backfilling…'}
          </span>
        </div>
        <div className="bg-white p-6">
          <StageRow label="Magical OP" metrics={ms.op}
            scriptNode={<span style={{ whiteSpace: 'pre-line' }}>{ms.op.script}</span>} />

          <StageRow label="Magical CSP" metrics={ms.csp}
            scriptNode={
              <div className="flex flex-col gap-3 w-full">
                {ms.csp.scripts.map(s => (
                  <div key={s.label}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-700 mb-0.5">{s.label} · {s.count.toLocaleString()} calls</p>
                    <p style={{ whiteSpace: 'pre-line' }}>{s.text}</p>
                  </div>
                ))}
              </div>
            } />

          <StageRow label="Magical Offer" metrics={ms.offer}
            scriptNode={
              ms.offer.products.length > 0 ? (
                <button onClick={() => onToggleProductModal(true)} className="text-left hover:underline decoration-dotted w-full">
                  <p className="font-semibold">{ms.offer.topProduct ?? 'No product data'}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Most-offered product · click to view all {ms.offer.products.length} products</p>
                </button>
              ) : (
                <span style={{ whiteSpace: 'pre-line' }}>{ms.offer.script || <span className="text-slate-400 italic">No script configured</span>}</span>
              )
            } />

          {/* ── Branches out of Magical Offer into the top objection categories ── */}
          {ms.categories.length > 0 && (
            <div className="mt-2">
              <div className="flex justify-center"><MSLine orientation="v" size={22} /></div>
              <MSFanBar count={ms.categories.length} />
              <div className="grid gap-4 mt-0" style={{ gridTemplateColumns: `repeat(${ms.categories.length}, minmax(0, 1fr))` }}>
                {ms.categories.map((cat, i) => {
                  const accent = CARD_ACCS[i % CARD_ACCS.length];
                  return (
                    <div key={cat.category} className="flex flex-col items-center">
                      <MSLine orientation="v" size={18} />
                      <div className="w-full rounded-lg px-3 py-2.5 text-center bg-slate-100" style={{ border: `1px solid ${accent}40` }}>
                        <p className="text-[11px] font-bold text-slate-800 leading-tight">{cat.category}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">({cat.contribution_pct}%) Contribution</p>
                      </div>
                      <MSLine orientation="v" size={14} />
                      <div className="w-full rounded-lg px-3 py-3 text-[10px] text-slate-700 leading-relaxed bg-white overflow-y-auto"
                        style={{ border: `1px solid ${accent}30`, minHeight: 150, maxHeight: 210 }}>
                        {cat.script || <span className="italic text-slate-400">No script configured</span>}
                      </div>
                      <MSLine orientation="v" size={14} />
                      <MSFanBar count={2} />
                      <div className="w-full flex gap-3">
                        <div className="flex-1 flex flex-col items-center">
                          <MSLine orientation="v" size={12} />
                          <MSMetricPill bg={MS_CALLEND_BG}>
                            <p className="text-[8px] font-bold uppercase tracking-widest text-white/70 leading-none mb-1">Call End</p>
                            <p className="text-sm font-black tabular-nums text-white leading-none">{cat.call_end.toLocaleString()}</p>
                          </MSMetricPill>
                        </div>
                        <div className="flex-1 flex flex-col items-center">
                          <MSLine orientation="v" size={12} />
                          <MSMetricPill bg={MS_SUCCESS_BG}>
                            <p className="text-[8px] font-bold uppercase tracking-widest text-white/70 leading-none mb-1">Sale Done</p>
                            <p className="text-sm font-black tabular-nums text-white leading-none">{cat.sale_done.toLocaleString()} ({cat.conv_pct}%)</p>
                          </MSMetricPill>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {productModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onClick={() => onToggleProductModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-800">All Offered Products</h2>
              <button onClick={() => onToggleProductModal(false)} className="ml-auto text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {ms.offer.products.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No product offering data for this period.</p>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="text-left px-3 py-2 font-semibold text-slate-500 border-b border-slate-200">Product</th>
                      <th className="text-right px-3 py-2 font-semibold text-slate-500 border-b border-slate-200">Offered Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ms.offer.products.map(p => (
                      <tr key={p.product} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-700 font-medium">{p.product}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-600">{p.count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Every other outbound process: DB-configured OP → CSP → Offer flow + objection scripts,
// rendered through the same tree/connector style as Bellavita's flow above. ───────────────────────
function GenericMagicalFlow({ ms, canEdit, onOpenEditor }: { ms: GenericMagicalScriptData; canEdit: boolean; onOpenEditor: () => void }) {
  const CARD_ACCS = ['#1D4ED8', '#7C3AED', '#0891B2', '#D97706'];

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total Calls',   value: ms.summary.total_calls.toLocaleString(),  color: '#475569' },
          { label: 'OP Passed',     value: ms.summary.op_pass.toLocaleString(),      color: '#1D4ED8' },
          { label: 'CSP Passed',    value: ms.summary.csp_pass.toLocaleString(),     color: '#0891B2' },
          { label: 'Offer Made',    value: ms.summary.offer_pass.toLocaleString(),   color: '#059669' },
          { label: 'Sale Done',     value: ms.summary.sale_done.toLocaleString(),    color: '#16A34A' },
          { label: 'Overall Conv%', value: `${ms.summary.overall_conv}%`,            color: ms.summary.overall_conv >= 10 ? '#16A34A' : ms.summary.overall_conv >= 5 ? '#D97706' : '#DC2626' },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl px-4 py-3 relative overflow-hidden" style={{ border: `2px solid ${c.color}` }}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: c.color }} />
            <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: c.color }}>{c.label}</p>
            <p className="text-xl font-black tabular-nums text-slate-900 leading-none">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid #0369A1' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}>
          <span className="text-sm">✨</span>
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Today's Magical Script</h3>
          <span className="text-[9px] ml-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Opening → Context → Offer</span>
          <div className="ml-auto flex items-center gap-3">
            {canEdit && (
              <button onClick={onOpenEditor}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold text-white/90 hover:text-white border border-white/30 hover:border-white/60 transition-colors">
                <Pencil size={11} /> Edit Scripts
              </button>
            )}
            <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
              {ms.cachedThrough ? `Data cached through ${fmtDateTime(ms.cachedThrough)}` : 'Backfilling…'}
            </span>
          </div>
        </div>
        <div className="bg-white p-6">
          {ms.flow.map(stage => (
            <div key={stage.stage} className="flex items-center mb-5 last:mb-0">
              <MSStageBadge>{stage.title}</MSStageBadge>
              <MSLine size={24} />
              <MSScriptBox>
                {stage.script
                  ? <span>{stage.script}</span>
                  : <span className="text-slate-400 italic">Call opening — no predefined script</span>}
              </MSScriptBox>
              <MSLine size={24} />
              <div className="flex flex-col gap-3 shrink-0" style={{ borderLeft: `2px solid ${MS_LINE_COLOR}`, minWidth: 200 }}>
                <div className="flex items-center">
                  <MSLine size={16} />
                  <MSMetricPill bg={MS_CALLEND_BG}>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/70 leading-none mb-1">Call End</p>
                    <p className="text-base font-black tabular-nums text-white leading-none">{stage.dropped.toLocaleString()}</p>
                  </MSMetricPill>
                </div>
                <div className="flex items-center">
                  <MSLine size={16} />
                  <MSMetricPill bg={MS_SUCCESS_BG}>
                    <p className="text-[9px] font-bold text-white leading-tight">Success Rate ({stage.success_rate}%)</p>
                  </MSMetricPill>
                </div>
              </div>
            </div>
          ))}

          {/* ── Branches out of the flow into the objection-handling scripts ── */}
          {ms.objections.length > 0 && (
            <div className="mt-2">
              <div className="flex justify-center"><MSLine orientation="v" size={22} /></div>
              <MSFanBar count={ms.objections.length} />
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${ms.objections.length}, minmax(0, 1fr))` }}>
                {ms.objections.map((obj, i) => {
                  const accent = CARD_ACCS[i % CARD_ACCS.length];
                  return (
                    <div key={i} className="flex flex-col items-center">
                      <MSLine orientation="v" size={18} />
                      <div className="w-full rounded-lg px-3 py-2.5 text-center bg-slate-100" style={{ border: `1px solid ${accent}40` }}>
                        <p className="text-[11px] font-bold text-slate-800 leading-tight">{obj.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">({obj.contribution}%) Contribution</p>
                      </div>
                      <MSLine orientation="v" size={14} />
                      <div className="w-full rounded-lg px-3 py-3 text-[10px] text-slate-700 leading-relaxed bg-white overflow-y-auto"
                        style={{ border: `1px solid ${accent}30`, minHeight: 150, maxHeight: 210 }}>
                        {obj.script || <span className="italic text-slate-400">No script configured</span>}
                      </div>
                      <MSLine orientation="v" size={14} />
                      <MSFanBar count={2} />
                      <div className="w-full flex gap-3">
                        <div className="flex-1 flex flex-col items-center">
                          <MSLine orientation="v" size={12} />
                          <MSMetricPill bg={MS_CALLEND_BG}>
                            <p className="text-[8px] font-bold uppercase tracking-widest text-white/70 leading-none mb-1">Call End</p>
                            <p className="text-sm font-black tabular-nums text-white leading-none">{(obj.total - obj.sales).toLocaleString()}</p>
                          </MSMetricPill>
                        </div>
                        <div className="flex-1 flex flex-col items-center">
                          <MSLine orientation="v" size={12} />
                          <MSMetricPill bg={MS_SUCCESS_BG}>
                            <p className="text-[8px] font-bold uppercase tracking-widest text-white/70 leading-none mb-1">Sale Done</p>
                            <p className="text-sm font-black tabular-nums text-white leading-none">{obj.sales.toLocaleString()} ({obj.conv_pct}%)</p>
                          </MSMetricPill>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const MS_STAGE_META: Record<'op' | 'csp' | 'offer', { defaultTitle: string; hint: string }> = {
  op:    { defaultTitle: 'Magical OP',    hint: 'The opening line every agent reads at the start of the call.' },
  csp:   { defaultTitle: 'Magical CSP',   hint: 'Sets the context for why you\'re calling before the offer.' },
  offer: { defaultTitle: 'Magical Offer', hint: 'The pitch used once the customer is engaged.' },
};

function MagicalScriptRowEditor({ row, savingId, objectionOptions, onChange, onSave, onDelete }: {
  row: MagicalScriptConfigRow;
  savingId: number | null;
  objectionOptions?: string[];
  onChange: (id: number, patch: Partial<MagicalScriptConfigRow>) => void;
  onSave: (row: MagicalScriptConfigRow) => void;
  onDelete?: (row: MagicalScriptConfigRow) => void;
}) {
  const saving = savingId === row.id;
  const canSave = !!row.stageTitle.trim() && !!(row.scriptText ?? '').trim();
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <input value={row.stageTitle} onChange={e => onChange(row.id, { stageTitle: e.target.value })}
          placeholder="Title"
          className="flex-1 text-xs font-semibold px-2 py-1.5 rounded-md border border-slate-300 bg-white" />
        {row.stage === 'objection' && (
          <>
            <input value={row.objectionCategory ?? ''} onChange={e => onChange(row.id, { objectionCategory: e.target.value })}
              placeholder="Objection category (must match CustomerObjectionCategory)"
              list="ms-objection-options"
              className="flex-1 text-xs px-2 py-1.5 rounded-md border border-slate-300 bg-white" />
            {objectionOptions && (
              <datalist id="ms-objection-options">
                {objectionOptions.map(o => <option key={o} value={o} />)}
              </datalist>
            )}
          </>
        )}
      </div>
      <textarea value={row.scriptText ?? ''} onChange={e => onChange(row.id, { scriptText: e.target.value })}
        rows={4} placeholder="Script text…"
        className="w-full text-xs px-2 py-1.5 rounded-md border border-slate-300 bg-white leading-relaxed" />
      <div className="flex items-center gap-2">
        <button onClick={() => onSave(row)} disabled={!canSave || saving}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors">
          <Save size={11} /> {saving ? 'Saving…' : row.id > 0 ? 'Save' : 'Create'}
        </button>
        {onDelete && (
          <button onClick={() => onDelete(row)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-bold text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={11} /> Delete
          </button>
        )}
        {row.id < 0 && <span className="text-[10px] text-slate-400 italic ml-auto">Not saved yet</span>}
      </div>
    </div>
  );
}

function MagicalScriptEditorModal({ open, loading, rows, objectionOptions, savingId, onChange, onSave, onDelete, onAddObjection, onClose }: {
  open: boolean;
  loading: boolean;
  rows: MagicalScriptConfigRow[];
  objectionOptions: string[];
  savingId: number | null;
  onChange: (id: number, patch: Partial<MagicalScriptConfigRow>) => void;
  onSave: (row: MagicalScriptConfigRow) => void;
  onDelete: (row: MagicalScriptConfigRow) => void;
  onAddObjection: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const objectionRows = rows.filter(r => r.stage === 'objection');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-800">Edit Magical Script</h2>
            <p className="text-xs text-slate-500 mt-0.5">Changes apply immediately to this process's Magical Script page.</p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700 transition-colors"><X size={18} /></button>
        </div>
        <div className="overflow-auto flex-1 p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-400 text-sm">
              <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              {(['op', 'csp', 'offer'] as const).map(stage => {
                const row = rows.find(r => r.stage === stage);
                if (!row) return null;
                return (
                  <div key={stage}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{MS_STAGE_META[stage].defaultTitle}</p>
                    <p className="text-[10px] text-slate-400 mb-2">{MS_STAGE_META[stage].hint}</p>
                    <MagicalScriptRowEditor row={row} savingId={savingId} onChange={onChange} onSave={onSave} />
                  </div>
                );
              })}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Objection Handling Scripts</p>
                  <button onClick={onAddObjection}
                    className="ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                    <Plus size={11} /> Add objection script
                  </button>
                </div>
                <div className="space-y-3">
                  {objectionRows.length === 0 && (
                    <p className="text-xs text-slate-400 italic">No objection scripts yet — click "Add objection script" to create one.</p>
                  )}
                  {objectionRows.map(row => (
                    <MagicalScriptRowEditor key={row.id} row={row} savingId={savingId} objectionOptions={objectionOptions}
                      onChange={onChange} onSave={onSave} onDelete={onDelete} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProcessQualityDashboard() {
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const { canAccessOutboundClient, loaded: processLoaded } = useProcessStore();
  const now = new Date();

  useEffect(() => {
    if (processLoaded && clientId && !canAccessOutboundClient(clientId)) {
      navigate('/dashboard', { replace: true });
    }
  }, [processLoaded, clientId, canAccessOutboundClient, navigate]);
  const [startDate, setStartDate] = useState(
    toLocalDT(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0))
  );
  const [endDate, setEndDate] = useState(toLocalDT(now));
  const [kpi, setKpi] = useState<KPIResponse | null>(null);
  const [customerInsights, setCustomerInsights] = useState<OutboundCustomerInsights | null>(null);
  const [detailAnalysis, setDetailAnalysis] = useState<DetailAnalysisResponse | null>(null);
  const [objectionAnalysis, setObjectionAnalysis] = useState<ObjectionAnalysisResponse | null>(null);
  const [agentNPS, setAgentNPS] = useState<AgentNPSRow[]>([]);
  const [missingAgents, setMissingAgents]       = useState<OutboundMissingAgentRow[]>([]);
  const [showMissingPanel, setShowMissingPanel] = useState(false);
  const [addAgentForm, setAddAgentForm]         = useState<Record<string, { name: string; lob: string }>>({});
  const [addAgentSaving, setAddAgentSaving]     = useState<Record<string, boolean>>({});
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editingAgentName, setEditingAgentName] = useState('');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(true);
  const [customerInsightsLoading, setCustomerInsightsLoading] = useState(false);
  const [customerInsightsError, setCustomerInsightsError] = useState(false);
  const [ciDrill, setCiDrill] = useState<{ title: string; category: string; leads: OutboundInsightLead[]; loading: boolean } | null>(null);
  const [ciTranscript, setCiTranscript] = useState<{ loading: boolean; data: OutboundCallTranscript | null } | null>(null);
  const [saleDoneDrill, setSaleDoneDrill] = useState<{ open: boolean; loading: boolean; rows: SaleDoneCallRow[] } | null>(null);
  const [magicalScript, setMagicalScript] = useState<MagicalScriptData | null>(null);
  const [magicalLoading, setMagicalLoading] = useState(false);
  const [bellaProductModal, setBellaProductModal] = useState(false);
  const [scriptEditorOpen, setScriptEditorOpen] = useState(false);
  const [scriptEditorLoading, setScriptEditorLoading] = useState(false);
  const [scriptEditorRows, setScriptEditorRows] = useState<MagicalScriptConfigRow[]>([]);
  const [scriptEditorOptions, setScriptEditorOptions] = useState<string[]>([]);
  const [scriptEditorSavingId, setScriptEditorSavingId] = useState<number | null>(null);
  const authUser = useAuthStore(s => s.user);
  const canEditScripts = !!authUser && EDIT_SCRIPT_ROLES.includes(authUser.role);

  const sd = startDate.replace('T', ' ');
  const ed = endDate.replace('T', ' ');

  const [activeSlide, setActiveSlide] = useState(0);
  const loadedSlides = useRef<Record<number, boolean>>({});

  const fetchData = useCallback(() => {
    if (!clientId) return;
    setLoading(true);
    Promise.all([
      api.get<{ data: KPIResponse }>(`/quality/kpis?startDate=${sd}&endDate=${ed}&clientId=${clientId}`),
      api.get<{ data: { client_id: number; client_name: string; calls: number }[] }>(`/quality/clients?startDate=${sd}&endDate=${ed}`),
    ]).then(([kR, cR]) => {
      setKpi(kR.data?.data ?? null);
      const match = (cR.data?.data ?? []).find(c => String(c.client_id) === clientId);
      setClientName(match?.client_name ?? `Process #${clientId}`);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [clientId, sd, ed]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Customer Interaction Insights: fetched independently of fetchData() so a slow/failed transcript
  // scan can never block or break the rest of the page (KPIs etc. load on their own regardless).
  useEffect(() => {
    if (!clientId) return;
    setCustomerInsightsLoading(true);
    setCustomerInsightsError(false);
    api.get<{ data: OutboundCustomerInsights }>(`/quality/customer-interaction-insights?startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
      .then(r => setCustomerInsights(r.data?.data ?? null))
      .catch(() => { setCustomerInsights(null); setCustomerInsightsError(true); })
      .finally(() => setCustomerInsightsLoading(false));
  }, [clientId, sd, ed]);

  const openCiDrill = (category: string, title: string) => {
    setCiDrill({ title, category, leads: [], loading: true });
    api.get<{ data: { leads: OutboundInsightLead[] } }>(`/quality/customer-interaction-insights/drill?category=${encodeURIComponent(category)}&startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
      .then(r => setCiDrill({ title, category, leads: r.data?.data?.leads ?? [], loading: false }))
      .catch(() => setCiDrill({ title, category, leads: [], loading: false }));
  };

  const openCiTranscript = (callId: number) => {
    setCiTranscript({ loading: true, data: null });
    api.get<{ data: OutboundCallTranscript | null }>(`/quality/customer-interaction-insights/transcript?callId=${callId}`)
      .then(r => setCiTranscript({ loading: false, data: r.data?.data ?? null }))
      .catch(() => setCiTranscript({ loading: false, data: null }));
  };

  const openSaleDoneDrill = () => {
    if (!clientId) return;
    setSaleDoneDrill({ open: true, loading: true, rows: [] });
    api.get<{ data: SaleDoneCallRow[] }>(`/quality/sale-done-calls?startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
      .then(r => setSaleDoneDrill({ open: true, loading: false, rows: r.data?.data ?? [] }))
      .catch(() => setSaleDoneDrill({ open: true, loading: false, rows: [] }));
  };

  const refetchMagicalScript = useCallback(() => {
    if (!clientId) return;
    setMagicalLoading(true);
    api.get<{ data: MagicalScriptData }>(`/quality/magical-script?startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
      .then(r => setMagicalScript(r.data?.data ?? null))
      .catch(() => setMagicalScript(null))
      .finally(() => setMagicalLoading(false));
  }, [clientId, sd, ed]);

  const openScriptEditor = () => {
    if (!clientId) return;
    setScriptEditorOpen(true);
    setScriptEditorLoading(true);
    api.get<{ data: { rows: MagicalScriptConfigRow[]; objectionOptions: string[] } }>(`/quality/magical-script-config?clientId=${clientId}`)
      .then(r => {
        const rows = r.data?.data?.rows ?? [];
        const withDefaults = [...rows];
        let tempId = -1;
        (['op', 'csp', 'offer'] as const).forEach(stage => {
          if (!withDefaults.some(row => row.stage === stage)) {
            withDefaults.push({ id: tempId--, stage, stageTitle: MS_STAGE_META[stage].defaultTitle, objectionCategory: null, scriptText: '', displayOrder: 0 });
          }
        });
        setScriptEditorRows(withDefaults);
        setScriptEditorOptions(r.data?.data?.objectionOptions ?? []);
      })
      .catch(() => { setScriptEditorRows([]); setScriptEditorOptions([]); })
      .finally(() => setScriptEditorLoading(false));
  };

  const changeScriptRow = (id: number, patch: Partial<MagicalScriptConfigRow>) => {
    setScriptEditorRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const addObjectionScriptRow = () => {
    setScriptEditorRows(prev => [...prev, {
      id: -(Date.now()),
      stage: 'objection',
      stageTitle: '',
      objectionCategory: '',
      scriptText: '',
      displayOrder: prev.filter(r => r.stage === 'objection').length,
    }]);
  };

  const saveScriptRow = (row: MagicalScriptConfigRow) => {
    if (!clientId) return;
    setScriptEditorSavingId(row.id);
    api.post<{ data: MagicalScriptConfigRow }>('/quality/magical-script-config', {
      clientId: Number(clientId),
      id: row.id > 0 ? row.id : undefined,
      stage: row.stage,
      stageTitle: row.stageTitle,
      objectionCategory: row.objectionCategory,
      scriptText: row.scriptText,
      displayOrder: row.displayOrder,
    })
      .then(r => {
        const saved = r.data?.data;
        if (saved) setScriptEditorRows(prev => prev.map(x => x.id === row.id ? saved : x));
        refetchMagicalScript();
      })
      .catch(() => {})
      .finally(() => setScriptEditorSavingId(null));
  };

  const deleteScriptRow = (row: MagicalScriptConfigRow) => {
    if (row.id < 0) {
      setScriptEditorRows(prev => prev.filter(x => x.id !== row.id));
      return;
    }
    if (!clientId || !window.confirm('Delete this objection script?')) return;
    api.delete(`/quality/magical-script-config/${row.id}?clientId=${clientId}`)
      .then(() => {
        setScriptEditorRows(prev => prev.filter(x => x.id !== row.id));
        refetchMagicalScript();
      })
      .catch(() => {});
  };

  // Lazy load data per slide
  useEffect(() => {
    if (!clientId) return;
    if (activeSlide === 1 && !loadedSlides.current[1]) {
      loadedSlides.current[1] = true;
      api.get<{ data: ObjectionAnalysisResponse }>(`/quality/objection-analysis?startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
        .then(r => setObjectionAnalysis(r.data?.data ?? null))
        .catch(() => setObjectionAnalysis(null));
    }
    if (activeSlide === 2 && !loadedSlides.current[2]) {
      loadedSlides.current[2] = true;
      api.get<{ data: AgentNPSRow[] }>(`/quality/agent-nps-csat?startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
        .then(r => setAgentNPS(r.data?.data ?? []))
        .catch(() => setAgentNPS([]));
      api.get<{ data: OutboundMissingAgentRow[] }>(`/quality/missing-agents?startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
        .then(r => setMissingAgents(r.data?.data ?? []))
        .catch(() => setMissingAgents([]));
    }
    if (activeSlide === 3 && !loadedSlides.current[3]) {
      loadedSlides.current[3] = true;
      api.get<{ data: DetailAnalysisResponse }>(`/quality/detail-analysis?startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
        .then(r => setDetailAnalysis(r.data?.data ?? null))
        .catch(() => setDetailAnalysis(null));
    }
    if (activeSlide === 4 && !loadedSlides.current[4]) {
      loadedSlides.current[4] = true;
      setMagicalLoading(true);
      api.get<{ data: MagicalScriptData }>(`/quality/magical-script?startDate=${sd}&endDate=${ed}&clientId=${clientId}`)
        .then(r => setMagicalScript(r.data?.data ?? null))
        .catch(() => setMagicalScript(null))
        .finally(() => setMagicalLoading(false));
    }
  }, [activeSlide, clientId, sd, ed]);

  const fmt = (n: number) => n.toLocaleString();
  const cst = kpi?.cst;
  const crt = kpi?.crt;
  const pie = kpi?.rejectedPie ?? [];
  const cstFunnel = kpi?.cstFunnel ?? [];
  const crtFunnel = kpi?.crtFunnel ?? [];
  const auditCountByDate = kpi?.auditCountByDate ?? [];
  const opp = kpi?.opportunity;
  const nps = kpi?.nps;
  const feedbackData = nps ? [
    { name: 'Positive', value: nps.promoter,  color: '#3B82F6' },
    { name: 'Negative', value: nps.detractor, color: '#EC4899' },
    { name: 'Neutral',  value: nps.passive,   color: '#F59E0B' },
  ].filter(d => d.value > 0) : [];
  const [modalMetric, setModalMetric] = useState<MetricInfo | null>(null);
  const [chartDetail, setChartDetail] = useState<ChartDetail | null>(null);
  const showDetail = (key: string) => setChartDetail(CHART_DETAILS[key] ?? null);
  const [pqDrillModal, setPQDrillModal] = useState<{ title: string; accent: string; rows: Record<string,unknown>[]; columns: { key: string; label: string }[] } | null>(null);

  return (
    <div className="min-h-screen text-slate-900 flex flex-col">
      {/* ── Page Header ── */}
      <div className="page-header shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate('/quality')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-xs font-semibold hover:bg-slate-100 px-2.5 py-1.5 rounded-lg">
            <ChevronLeft size={14} /> AI Quality
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-200">
              <img src="/Logo.png" alt="MAS" className="h-7 w-7 object-contain" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">{clientName || `Process #${clientId}`}</h1>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Outbound Process Quality</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-emerald-600 font-semibold">Live</span>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-5 w-full space-y-5">
        {/* Filter bar + tabs */}
        <div className="filter-bar">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span className="text-xs font-semibold text-slate-700">Date Range</span>
          </div>
          <div className="w-px h-4 bg-slate-200 mx-0.5" />
          <label className="text-[11px] text-slate-500 font-medium">From</label>
          <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all" />
          <label className="text-[11px] text-slate-500 font-medium">To</label>
          <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all" />
        </div>

        {/* ─── Missing agents banner ── */}
        {missingAgents.length > 0 && (
          <div className="mb-2 rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
              onClick={() => setShowMissingPanel(p => !p)}>
              <span className="text-amber-500 text-base">⚠️</span>
              <span className="text-xs font-semibold text-amber-700 flex-1">
                {missingAgents.length} agent{missingAgents.length > 1 ? 's' : ''} found without a name — click to review &amp; add
              </span>
              <span className="text-amber-500 text-xs">{showMissingPanel ? '▲' : '▼'}</span>
            </div>
            {showMissingPanel && (
              <div className="border-t border-amber-500/20 px-4 py-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-2 text-left text-slate-700 font-semibold uppercase tracking-wider text-[9px]">Agent ID</th>
                      <th className="py-2 text-center text-slate-700 font-semibold uppercase tracking-wider text-[9px]">Feedback Count</th>
                      <th className="py-2 text-left text-slate-700 font-semibold uppercase tracking-wider text-[9px]">Display Name</th>
                      <th className="py-2 text-left text-slate-700 font-semibold uppercase tracking-wider text-[9px]">LOB</th>
                      <th className="py-2 text-center text-slate-700 font-semibold uppercase tracking-wider text-[9px]">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingAgents.map(ma => (
                      <tr key={ma.agentId} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-amber-700 font-mono font-bold">{ma.agentId}</td>
                        <td className="py-2 pr-3 text-center text-slate-700">{ma.total_count}</td>
                        <td className="py-2 pr-3">
                          <input type="text" placeholder="Enter display name"
                            value={addAgentForm[ma.agentId]?.name ?? ''}
                            onChange={e => setAddAgentForm(prev => ({ ...prev, [ma.agentId]: { ...prev[ma.agentId], name: e.target.value, lob: prev[ma.agentId]?.lob ?? 'Outbound' } }))}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-amber-400" />
                        </td>
                        <td className="py-2 pr-3">
                          <input type="text" placeholder="LOB (e.g. Outbound)"
                            value={addAgentForm[ma.agentId]?.lob ?? ''}
                            onChange={e => setAddAgentForm(prev => ({ ...prev, [ma.agentId]: { ...prev[ma.agentId], lob: e.target.value, name: prev[ma.agentId]?.name ?? '' } }))}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 focus:outline-none focus:border-amber-400" />
                        </td>
                        <td className="py-2 text-center">
                          <button
                            disabled={!addAgentForm[ma.agentId]?.name?.trim() || addAgentSaving[ma.agentId]}
                            onClick={async () => {
                              const form = addAgentForm[ma.agentId];
                              if (!form?.name?.trim()) return;
                              setAddAgentSaving(prev => ({ ...prev, [ma.agentId]: true }));
                              try {
                                await api.post('/quality/agent-master', {
                                  agentId: ma.agentId,
                                  agentName: form.name.trim(),
                                  lob: form.lob?.trim() || 'Outbound',
                                });
                                setAgentNPS(prev => prev.map(r => r.agentId === ma.agentId ? { ...r, agentName: form.name.trim() } : r));
                                setMissingAgents(prev => prev.filter(a => a.agentId !== ma.agentId));
                                setAddAgentForm(prev => { const n = { ...prev }; delete n[ma.agentId]; return n; });
                              } catch { alert('Failed to save agent. Please try again.'); }
                              finally { setAddAgentSaving(prev => ({ ...prev, [ma.agentId]: false })); }
                            }}
                            className="px-3 py-1 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                            {addAgentSaving[ma.agentId] ? 'Saving…' : 'Add'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── Pill tab navigation ── */}
        {(() => {
          const SLIDES = ['Dashboard', 'Missed Opportunity', 'NPS & CSAT', 'Detail Analysis', '✨ Magical Script'];
          return (
            <div className="pill-tabs w-fit">
              {SLIDES.map((label, i) => (
                <button key={i} onClick={() => setActiveSlide(i)}
                  className={`pill-tab ${activeSlide === i ? 'pill-tab-active' : ''}`}>
                  {label}
                </button>
              ))}
            </div>
          );
        })()}

        {loading && (
          <div className="flex items-center justify-center py-12 text-slate-500 text-xs">Loading KPIs...</div>
        )}

        {/* ─── Slide 0: Dashboard ────────────────────────────────────────── */}
        {activeSlide === 0 && (<>

        {/* ─── CST / CRT side by side ────────────────────────────────────── */}
        {(cst || crt) && (
          <div className="flex gap-4">
            {cst && (
              <div className="flex-1 min-w-0 rounded-xl border border-emerald-500/30 bg-white overflow-hidden">
                <div className="card-header gap-2 px-4 py-2.5">
                  <TrendingUp size={13} className="text-emerald-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">CST — Customer Success Track</span>
                  <button onClick={() => showDetail('cstSection')} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={12} /></button>
                </div>
                <div className="flex flex-row gap-px bg-slate-100">
                  {CST_METRICS(cst).map((m, i) => (
                    <div key={i} onClick={() => {
                        setModalMetric(m);
                        setPQDrillModal(null);
                      }}
                      className="flex-1 min-w-0 bg-white px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                      title="Click for metric details & calculation">
                      <span className="text-label block mb-1">{m.label}</span>
                      <p className="text-lg font-bold text-slate-900">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {crt && (
              <div className="flex-1 min-w-0 rounded-xl border border-red-500/30 bg-white overflow-hidden">
                <div className="card-header gap-2 px-4 py-2.5">
                  <XCircle size={13} className="text-red-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">CRT — Customer Rejection Track</span>
                  <button onClick={() => showDetail('crtSection')} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={12} /></button>
                </div>
                <div className="flex flex-row gap-px bg-slate-100">
                  {CRT_METRICS(crt).map((m, i) => (
                    <div key={i} onClick={() => setModalMetric(m)}
                      className="flex-1 min-w-0 bg-white px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors">
                      <span className="text-label block mb-1">{m.label}</span>
                      <p className="text-lg font-bold text-slate-900">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Customer Interaction Insights: drill-down modal ───────────── */}
        {ciDrill && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onClick={() => setCiDrill(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white">
                <div>
                  <h2 className="text-base font-bold text-slate-800">{ciDrill.title}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{ciDrill.loading ? 'Loading…' : `${ciDrill.leads.length} calls`}</p>
                </div>
                {!ciDrill.loading && ciDrill.leads.length > 0 && (
                  <button
                    onClick={() => downloadCSV(ciDrill.leads.map(l => ({
                      Type: l.type || '—', 'Lead ID': l.leadId, 'Agent Name': l.agentName, 'Mobile No': l.mobileNo,
                      'Threat Phrase': l.matchedWord || '—', 'Call Date': fmtDateTime(l.callDate),
                    })), `${ciDrill.title.toLowerCase().replace(/\s+/g, '-')}.csv`)}
                    title="Download CSV"
                    className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-500/30 transition-colors">
                    <Download size={11} /> CSV
                  </button>
                )}
                <button onClick={() => setCiDrill(null)} className={`${ciDrill.leads.length > 0 ? '' : 'ml-auto'} text-slate-400 hover:text-slate-700 transition-colors`}><X size={18} /></button>
              </div>
              <div className="overflow-auto flex-1 p-6">
                {ciDrill.loading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 rounded-lg bg-slate-100 animate-pulse" />)}
                  </div>
                ) : ciDrill.leads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                    <span className="text-4xl">🔍</span>
                    <p className="text-sm font-medium">No calls found for this period.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          {['Type', 'Lead ID', 'Agent Name', 'Mobile No', 'Threat Phrase', 'Date'].map(h => (
                            <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap border-b border-slate-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ciDrill.leads.map((l, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{l.type || '—'}</td>
                            <td className="px-3 py-2">
                              <button onClick={() => openCiTranscript(l.callId)}
                                className="font-mono text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">
                                {l.leadId || `Call #${l.callId}`}
                              </button>
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-700">{l.agentName}</td>
                            <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">{l.mobileNo || '—'}</td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{l.matchedWord || '—'}</td>
                            <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{fmtDateTime(l.callDate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Customer Interaction Insights: transcript modal ───────────── */}
        {ciTranscript && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            onClick={() => setCiTranscript(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white">
                <div>
                  <p className="text-sm font-bold text-slate-900">Call Transcript</p>
                  {ciTranscript.data && (
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {ciTranscript.data.agentName} · {ciTranscript.data.mobileNo} · {fmtDateTime(ciTranscript.data.callDate)}
                    </p>
                  )}
                </div>
                <button onClick={() => setCiTranscript(null)} className="ml-auto text-slate-400 hover:text-slate-900 transition-colors p-1"><X size={18} /></button>
              </div>
              <div className="overflow-auto flex-1 p-6">
                {ciTranscript.loading ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
                    <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                    <span className="text-sm">Loading transcript…</span>
                  </div>
                ) : !ciTranscript.data?.transcript ? (
                  <p className="text-center text-slate-400 text-sm py-10">No transcript available for this call.</p>
                ) : (
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{ciTranscript.data.transcript}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── CST Funnel: Sale Done drill-down ───────────────────────────── */}
        {saleDoneDrill?.open && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            onClick={() => setSaleDoneDrill(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 bg-white">
                <div>
                  <h2 className="text-base font-bold text-slate-800">Sale Done — Call Details</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{saleDoneDrill.loading ? 'Loading…' : `${saleDoneDrill.rows.length} calls`}</p>
                </div>
                {!saleDoneDrill.loading && saleDoneDrill.rows.length > 0 && (
                  <button
                    onClick={() => downloadCSV(saleDoneDrill.rows.map(r => ({
                      'Call Date': fmtDateTime(r.callDate), 'Agent Name': r.agentName, 'Mobile No': r.mobileNo, 'File Name': r.fileName,
                    })), 'sale-done-calls.csv')}
                    title="Download CSV"
                    className="ml-auto flex items-center gap-1 px-2 py-1 rounded text-[10px] text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-500/30 transition-colors">
                    <Download size={11} /> CSV
                  </button>
                )}
                <button onClick={() => setSaleDoneDrill(null)} className={`${saleDoneDrill.rows.length > 0 ? '' : 'ml-auto'} text-slate-400 hover:text-slate-700 transition-colors`}><X size={18} /></button>
              </div>
              <div className="overflow-auto flex-1 p-6">
                {saleDoneDrill.loading ? (
                  <div className="flex flex-col gap-2">
                    {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 rounded-lg bg-slate-100 animate-pulse" />)}
                  </div>
                ) : saleDoneDrill.rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                    <span className="text-4xl">🔍</span>
                    <p className="text-sm font-medium">No sale-done calls found for this period.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50">
                          {['Call Date', 'Agent Name', 'Mobile No', 'Recording', 'Transcript'].map(h => (
                            <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-500 whitespace-nowrap border-b border-slate-200">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {saleDoneDrill.rows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{fmtDateTime(r.callDate)}</td>
                            <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{r.agentName}</td>
                            <td className="px-3 py-2 font-mono text-slate-500 whitespace-nowrap">{r.mobileNo || '—'}</td>
                            <td className="px-3 py-2" style={{ minWidth: 220 }}>
                              {r.fileName
                                ? <audio controls preload="none" src={r.fileName} style={{ height: 30, width: 210 }} />
                                : <span className="text-slate-300 italic">No recording</span>}
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => openCiTranscript(r.callId)}
                                className="font-mono text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-semibold transition-colors">
                                Read Transcript
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Funnels side by side ─────────────────────────────────────── */}
        <div className="flex flex-row gap-6">
          {cstFunnel.length > 0 && (() => {
            const cstBase = cstFunnel[0]?.value ?? 1;
            const pct = (v: number) => cstBase > 0 ? `${((v / cstBase) * 100).toFixed(0)}%` : '–';
            const cstLabeled = cstFunnel.map(s => ({ ...s, label: `${s.name}: ${s.value.toLocaleString()}` }));
            return (
              <div className="flex-1 min-w-0 rounded-xl border border-emerald-500/30 bg-white overflow-hidden">
                <div className="card-header gap-2 px-5 py-3">
                  <TrendingUp size={14} className="text-emerald-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">CST Funnel</span>
                  <button onClick={() => showDetail('cstFunnel')} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={13} /></button>
                </div>
                <div className="px-4 pt-4 pb-4">
                  <ResponsiveContainer width="100%" height={340}>
                    <FunnelChart>
                      <Tooltip
                        contentStyle={TT}
                        formatter={(v: unknown, _n: unknown, props: { payload?: { name?: string } }) => {
                          const val = Number(v);
                          return [`${val.toLocaleString()} (${pct(val)})`, props?.payload?.name ?? ''];
                        }}
                      />
                      <Funnel dataKey="value" data={cstLabeled} isAnimationActive lastShapeType="rectangle"
                        onClick={(data: { name?: string }) => { if (data?.name === 'Sale Done') openSaleDoneDrill(); }}>
                        {cstLabeled.map((s, i) => (
                          <Cell key={i} fill={funnelCSTColors[i % funnelCSTColors.length]}
                            style={{ cursor: s.name === 'Sale Done' ? 'pointer' : 'default' }} />
                        ))}
                        <LabelList dataKey="label" position="center"
                          fill="#ffffff" stroke="none" fontSize={11} fontWeight={700} />
                      </Funnel>
                    </FunnelChart>
                  </ResponsiveContainer>
                  <p className="text-center text-[10px] text-slate-400 mt-1">Click "Sale Done" to view the underlying calls</p>
                </div>
              </div>
            );
          })()}

          {crtFunnel.length > 0 && (() => {
            // Stepped pyramid instead of a trapezoid funnel: smallest reason at the top, widening
            // down to a "Not Sale Done" base bar. The base is Total Calls − Sale Done — NOT the sum
            // of the 4 rejection reasons, since "Post Offer Rejected" (per the CRT query) also
            // absorbs AfterListeningOfferRejected/SaleDone calls, so summing all 4 just reproduces
            // Total Calls including conversions.
            const ascCRT = [...crtFunnel].sort((a, b) => a.value - b.value);
            const notSaleDoneTotal = Math.max((cst?.totalCalls ?? 0) - (cst?.saleDone ?? 0), 0);
            const rows = [...ascCRT, { name: 'Not Sale Done (Total)', value: notSaleDoneTotal }];
            const maxVal = Math.max(notSaleDoneTotal, ...ascCRT.map(r => r.value), 1);
            const PYRAMID_COLORS = ['#7C3AED', '#DB2777', '#EA580C', '#DC2626', '#991B1B'];
            const pct = (v: number) => notSaleDoneTotal > 0 ? `${((v / notSaleDoneTotal) * 100).toFixed(0)}%` : '–';
            return (
              <div className="flex-1 min-w-0 rounded-xl border border-red-500/30 bg-white overflow-hidden">
                <div className="card-header gap-2 px-5 py-3">
                  <XCircle size={14} className="text-red-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest text-red-400">CRT Funnel</span>
                  <button onClick={() => showDetail('crtFunnel')} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={13} /></button>
                </div>
                <div className="px-4 pt-6 pb-6 flex flex-col items-center gap-1.5" style={{ minHeight: 340 }}>
                  {rows.map((r, i) => {
                    const widthPct = 22 + (r.value / maxVal) * 78;
                    const color = PYRAMID_COLORS[i % PYRAMID_COLORS.length];
                    const isBase = i === rows.length - 1;
                    return (
                      <div key={r.name}
                        className="rounded-md flex items-center justify-between px-4 shadow-sm transition-all"
                        style={{
                          width: `${widthPct}%`,
                          background: color,
                          height: isBase ? 52 : 44,
                          border: isBase ? '2px solid #7F1D1D' : 'none',
                        }}
                        title={`${r.name}: ${r.value.toLocaleString()} (${pct(r.value)})`}>
                        <span className="text-[11px] font-bold text-white uppercase tracking-wide truncate">{r.name}</span>
                        <span className="text-sm font-black text-white tabular-nums ml-2 shrink-0">
                          {r.value.toLocaleString()} <span className="text-[10px] font-semibold opacity-80">({pct(r.value)})</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ─── Rejected Status Pie Chart ──────────────────────────────────── */}
        {pie.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 card-header gap-2 px-5 py-3">
              <BarChart3 size={14} className="text-slate-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Rejected Status Distribution</span>
              <button onClick={() => showDetail('rejectedPie')} className="ml-auto text-slate-500 hover:text-slate-600 transition-colors"><Info size={13} /></button>
            </div>
            <div className="flex items-center justify-center p-4">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={pie} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                    paddingAngle={3} dataKey="value" nameKey="name">
                    {pie.map((s, i) => (
                      <Cell key={i} fill={pieColors[s.name] || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={TT} formatter={(v: unknown) => [`${v} calls`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 shrink-0">
                {pie.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: pieColors[s.name] || COLORS[i % COLORS.length] }} />
                    <span className="text-slate-400">{s.name}</span>
                    <span className="text-slate-900 font-semibold ml-auto">{s.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Date-wise Audit Count ───────────────────────────────────── */}
        {auditCountByDate.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3 card-header gap-2">
              <BarChart3 size={14} className="text-blue-400" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Date-wise Audit Count</span>
              <span className="ml-auto text-[10px] text-white/60">
                {auditCountByDate.reduce((s, d) => s + d.count, 0).toLocaleString()} total audits
              </span>
            </div>
            <div className="px-4 pt-4 pb-2">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={auditCountByDate.map(d => ({ ...d, label: fmtDateTime(`${d.calldate} 00:00:00`).slice(0, 5) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TT} formatter={(v: unknown) => [`${Number(v).toLocaleString()} audits`, '']}
                    labelFormatter={(_l, p) => p?.[0]?.payload?.calldate ?? ''} />
                  <Bar dataKey="count" name="Audit Count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ─── Customer Interaction Insights ─────────────────────────────── */}
        {customerInsightsLoading && (
          <div className="rounded-2xl px-5 py-8 flex flex-col items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 60%, #7DD3FC 100%)', border: '1px solid #7DD3FC' }}>
            <div className="w-6 h-6 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold text-slate-700">Loading Customer Interaction Insights…</p>
          </div>
        )}
        {customerInsightsError && !customerInsightsLoading && (
          <div className="rounded-2xl px-5 py-5 text-center text-xs font-medium text-red-600 bg-red-50 border border-red-200">
            Couldn't load Customer Interaction Insights for this period.
          </div>
        )}
        {customerInsights && !customerInsightsLoading && (() => {
          const ci = customerInsights;
          const pct = (n: number) => ci.audit_count > 0 ? `${((n / ci.audit_count) * 100).toFixed(1)}%` : '0.0%';
          const CRITICAL_SIGNALS: { label: string; count: number; color: string; bg: string; border: string; icon: string; category: string }[] = [
            { label: 'Frustration',   count: ci.frustration_count,       color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: '😤', category: 'signal:Frustration' },
            { label: 'Threat',        count: ci.threat_count,            color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: '⚠️', category: 'signal:Threat' },
            { label: 'Abuse',         count: ci.cuss_abuse_count,        color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: '🚫', category: 'signal:Abuse' },
            { label: 'Slang',         count: ci.slang_count,             color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: '💬', category: 'signal:Slang' },
            { label: 'Sarcasm',       count: ci.sarcasm_count,           color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: '😏', category: 'signal:Sarcasm' },
            { label: 'Legal',         count: ci.legal_escalation_count,  color: '#B45309', bg: '#FFFBEB', border: '#FDE68A', icon: '⚖️', category: 'legal' },
            { label: 'Social Media',  count: ci.social_escalation_count, color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA', icon: '📱', category: 'social' },
            { label: 'Financial Fraud', count: ci.potential_scam,        color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: '💳', category: 'scam' },
            { label: 'Refund',        count: ci.refund_count,            color: '#0891B2', bg: '#ECFEFF', border: '#A5F3FC', icon: '💰', category: 'refund' },
            { label: 'Cancellation',  count: ci.cancellation_count,      color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', icon: '❌', category: 'cancellation' },
          ];
          const totalGolden = ci.golden_words.reduce((s, g) => s + g.count, 0);
          const cacheNote = ci.cached_through
            ? `Updated ${new Date(ci.cached_through).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · Click any card for details`
            : 'Click any card for details';
          return (
            <div className="rounded-2xl px-5 py-5" style={{ background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 60%, #7DD3FC 100%)', border: '1px solid #7DD3FC' }}>
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-5 rounded-full bg-violet-500" />
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Customer Interaction Insights</h2>
                <span className="ml-auto text-[10px] text-slate-500">{cacheNote}</span>
              </div>

              {/* Legal Escalation + Social Media Escalation + Financial Fraud */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div onClick={() => openCiDrill('legal', 'Legal Escalation')}
                  className="relative flex items-center gap-4 bg-white border border-amber-500/20 rounded-xl px-5 py-4 overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors"
                  title="Click to view calls">
                  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-amber-600" />
                  <div className="p-3 rounded-xl bg-amber-500/10 shrink-0">
                    <ShieldAlert size={22} className="text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-widest leading-tight mb-1">Legal Escalation</p>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold text-amber-600 tabular-nums leading-none">{ci.legal_escalation_count.toLocaleString()}</span>
                      <span className="text-xs text-slate-600 mb-0.5">calls ({pct(ci.legal_escalation_count)})</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">⚖️ Consumer Court &nbsp;·&nbsp; Legal Notice &nbsp;·&nbsp; Lawyer / FIR</p>
                  </div>
                </div>

                <div onClick={() => openCiDrill('social', 'Social Media Escalation')}
                  className="relative flex items-center gap-4 bg-white border border-orange-500/20 rounded-xl px-5 py-4 overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors"
                  title="Click to view calls">
                  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-orange-500" />
                  <div className="p-3 rounded-xl bg-orange-500/10 shrink-0">
                    <ShieldAlert size={22} className="text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-widest leading-tight mb-1">Social Media Escalation</p>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold text-orange-500 tabular-nums leading-none">{ci.social_escalation_count.toLocaleString()}</span>
                      <span className="text-xs text-slate-600 mb-0.5">calls ({pct(ci.social_escalation_count)})</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">📱 Facebook / Instagram &nbsp;·&nbsp; Reviews &nbsp;·&nbsp; Viral Threats</p>
                  </div>
                </div>

                <div onClick={() => openCiDrill('scam', 'Financial Fraud')}
                  className="relative flex items-center gap-4 bg-white border border-red-500/20 rounded-xl px-5 py-4 overflow-hidden cursor-pointer hover:bg-slate-50 transition-colors"
                  title="Click to view calls">
                  <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-red-500" />
                  <div className="p-3 rounded-xl bg-red-500/10 shrink-0">
                    <AlertOctagon size={22} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-widest leading-tight mb-1">Financial Fraud</p>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold text-red-500 tabular-nums leading-none">{ci.potential_scam.toLocaleString()}</span>
                      <span className="text-xs text-slate-600 mb-0.5">calls ({pct(ci.potential_scam)})</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">Scam &amp; cheating mentions</p>
                  </div>
                </div>
              </div>

              {/* Golden Phrases */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-emerald-500" />
                  <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Golden Phrases</h3>
                  <span className="ml-auto text-[10px] text-slate-400">{totalGolden.toLocaleString()} total mentions</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  {ci.golden_words.map((g, i) => (
                    <div key={g.category}
                      onClick={() => openCiDrill(`golden:${i}`, g.category)}
                      className="relative flex flex-col gap-1.5 rounded-xl px-3 py-3 overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all"
                      style={{ backgroundColor: '#ffffff', border: '2px solid #05966930', boxShadow: '0 2px 8px #05966915' }}
                      title={g.keywords.join(', ')}>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5" style={{ backgroundColor: '#05966920', color: '#059669' }}>
                          {g.keywords.length} phrase{g.keywords.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-xl font-bold tabular-nums leading-none" style={{ color: '#059669' }}>{g.count.toLocaleString()}</span>
                      <span className="text-[10px] font-bold text-slate-700 leading-tight block truncate">{g.category}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Critical Signals */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-4 rounded-full bg-rose-500" />
                  <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest">Critical Signals</h3>
                  <span className="ml-auto text-[10px] text-slate-400">Keyword-matched from TranscribeText</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {CRITICAL_SIGNALS.map(s => (
                    <div key={s.label}
                      onClick={() => openCiDrill(s.category, `${s.label} Signal`)}
                      className="relative flex flex-col gap-2 rounded-xl px-4 py-4 overflow-hidden cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all"
                      style={{ backgroundColor: '#ffffff', border: `2px solid ${s.color}60`, boxShadow: `0 2px 8px ${s.color}25` }}>
                      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ backgroundColor: s.color }} />
                      <div className="flex items-center justify-between">
                        <span className="text-base">{s.icon}</span>
                        <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ backgroundColor: `${s.color}25`, color: s.color }}>{pct(s.count)}</span>
                      </div>
                      <span className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.count.toLocaleString()}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-700">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        </>)}

        {/* ─── Slide 1: Missed Opportunity ───────────────────────────────── */}
        {activeSlide === 1 && (
        <div className="space-y-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-purple-500 rounded-full" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Missed Opportunity Analysis</h2>
          </div>

          {/* Metrics */}
          {opp && (
            <div className="flex flex-row gap-6 mb-6">
              <div className="flex-1 min-w-0 rounded-xl border border-purple-500/30 bg-white overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded" style={{ backgroundColor: '#A78BFA18', color: '#A78BFA' }}>
                      <BarChart3 size={14} />
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">Total Opportunities</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 pl-1">{opp.totalOpportunities.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex-1 min-w-0 rounded-xl border border-purple-500/30 bg-white overflow-hidden">
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded" style={{ backgroundColor: '#22C55E18', color: '#22C55E' }}>
                      <Target size={14} />
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider">MO Count</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 pl-1">{opp.moCount.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Objection Category Pie */}
          {opp && opp.objectionCategoryPie.length > 0 && (
            <div className="mt-6 rounded-xl border border-purple-500/20 bg-white overflow-hidden">
              <div className="px-5 py-3 card-header gap-2 px-5 py-3">
                <BarChart3 size={14} className="text-purple-400" />

                <span className="text-[11px] font-bold uppercase tracking-widest text-purple-400">Objection Category Distribution</span>
                <button onClick={() => showDetail('objectionPie')} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={13} /></button>
              </div>
              <div className="p-5 flex flex-col lg:flex-row items-center gap-8">
                <div className="shrink-0">
                  <ResponsiveContainer width={280} height={280}>
                    <PieChart>
                      <Pie
                        data={opp.objectionCategoryPie}
                        cx="50%" cy="50%"
                        innerRadius={65} outerRadius={110}
                        paddingAngle={3}
                        dataKey="value" nameKey="name"
                      >
                        {opp.objectionCategoryPie.map((_, i) => (
                          <Cell key={i} fill={OBJ_CAT_COLORS[opp.objectionCategoryPie[i].name] ?? COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TT} formatter={(v: unknown) => [Number(v).toLocaleString()]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                  {(() => {
                    const total = opp.objectionCategoryPie.reduce((a, b) => a + b.value, 0);
                    return opp.objectionCategoryPie.map((s, i) => {
                      const color = OBJ_CAT_COLORS[s.name] ?? COLORS[i % COLORS.length];
                      const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-black/20">
                          <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-slate-900 truncate">{s.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1 rounded-full bg-slate-700/60 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                              </div>
                              <span className="text-[10px] text-slate-600 font-semibold shrink-0">{s.value.toLocaleString()} · {pct}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* MO BreakDown + Category Table — side by side */}
          {opp && (
            <div className="mt-6 rounded-xl border border-purple-500/20 bg-white overflow-hidden">
              <div className="px-5 py-3 card-header gap-2 px-5 py-3">
                <BarChart3 size={14} className="text-purple-400" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-purple-400">MO BreakDown</span>
                <button onClick={() => showDetail('moBreakdown')} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={13} /></button>
              </div>

              <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-200">

                {/* Left — Pie chart */}
                <div className="lg:w-72 shrink-0 p-5 flex flex-col items-center justify-center">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-3">Opportunity Loss</p>
                  {opp.opportunityLoss.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={opp.opportunityLoss}
                            cx="50%" cy="50%"
                            innerRadius={60} outerRadius={95}
                            paddingAngle={3}
                            dataKey="value" nameKey="name"
                          >
                            {opp.opportunityLoss.map((s, i) => (
                              <Cell key={i} fill={s.name === 'Workable' ? '#22C55E' : '#EF4444'} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={TT} formatter={(v: unknown) => [Number(v).toLocaleString()]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-col gap-3 mt-2 w-full px-2">
                        {opp.opportunityLoss.map((s, i) => {
                          const total = opp.opportunityLoss.reduce((a, b) => a + b.value, 0);
                          const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : '0.0';
                          const color = s.name === 'Workable' ? '#22C55E' : '#EF4444';
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                              <div className="flex-1">
                                <p className="text-[11px] text-slate-900 font-bold">{s.name}</p>
                                <p className="text-[10px] text-slate-600 font-semibold">{s.value.toLocaleString()} · {pct}%</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-600 py-8">No data</p>
                  )}
                </div>

                {/* Right — Category table */}
                <div className="flex-1 overflow-x-auto">
                  <div className="flex items-center justify-end px-4 py-2 border-b border-slate-200">
                    <ExportBtn onClick={() => opp && downloadCSV(opp.moCategoryTable.map(r => ({ 'MO Category': r.category, Insight: r.insight, Count: r.count, 'Count%': `${r.pct}%` })), 'mo-category.csv')} />
                  </div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-slate-500 uppercase text-[9px] tracking-wider border-b border-slate-200">
                        <th className="px-4 py-2.5 text-left">MO Category</th>
                        <th className="px-4 py-2.5 text-left">Insight</th>
                        <th className="px-4 py-2.5 text-right">Count</th>
                        <th className="px-4 py-2.5 text-right">Count %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {opp.moCategoryTable.length > 0 ? opp.moCategoryTable.map((row, i) => {
                        const catColors: Record<string, string> = {
                          'No Need':             '#64748B',
                          'Brand Preference':    '#3B82F6',
                          'Price Sensitivity':   '#F59E0B',
                          'Budget Constraint':   '#A78BFA',
                          'Product Disinterest': '#EF4444',
                          'Negative Experience': '#EC4899',
                          'Logistic Concern':    '#14B8A6',
                          'Trust Concerns':      '#22C55E',
                        };
                        const color = catColors[row.category] ?? '#64748B';
                        return (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ backgroundColor: `${color}20`, color }}>
                                {row.category}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-400">{row.insight}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{row.count.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: color }} />
                                </div>
                                <span className="font-semibold text-slate-600 w-10 text-right">{row.pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-600">No data</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>
          )}

          {/* NED/ED Table */}
          {opp && opp.nedTable.length > 0 && (
            <div className="mt-6 rounded-xl border border-purple-500/20 bg-white overflow-hidden">
              <div className="px-5 py-3 card-header gap-2 px-5 py-3">
                <BarChart3 size={14} className="text-purple-400" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-purple-400">NED / ED Analysis</span>
                <button onClick={() => showDetail('nedTable')} className="ml-auto text-white/70 hover:text-white transition-colors mr-1"><Info size={13} /></button>
                <ExportBtn onClick={() => opp && downloadCSV(opp.nedTable.map(r => ({ 'NED/ED Category': r.nedCategory, 'NED/ED QS': r.nedQS, 'NED/ED Status': r.nedStatus, Count: r.count, 'Count%': `${r.pct}%` })), 'ned-ed-analysis.csv')} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-slate-500 uppercase text-[9px] tracking-wider border-b border-slate-200">
                      <th className="px-4 py-2.5 text-left">NED/ED Category</th>
                      <th className="px-4 py-2.5 text-left">NED/ED-QS</th>
                      <th className="px-4 py-2.5 text-left">NED/ED Status</th>
                      <th className="px-4 py-2.5 text-right">Count</th>
                      <th className="px-4 py-2.5 text-right">Count %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {opp.nedTable.map((row, i) => {
                      const color = OBJ_CAT_COLORS[row.nedCategory] ?? '#64748B';
                      const statusColor = row.nedStatus === 'Workable' ? '#22C55E' : '#EF4444';
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{ backgroundColor: `${color}20`, color }}>
                              {row.nedCategory}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{row.nedQS}</td>
                          <td className="px-4 py-2.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
                              {row.nedStatus}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-900">{row.count.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-slate-700/60 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: color }} />
                              </div>
                              <span className="font-semibold text-slate-600 w-10 text-right">{row.pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
        )}

        {/* ─── Slide 2: NPS & CSAT ───────────────────────────────────────── */}
        {activeSlide === 2 && (
        <div className="space-y-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-sky-500 rounded-full" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Estimate NPS &amp; CSAT</h2>
          </div>

          {nps && (
            <div className="flex flex-col lg:flex-row gap-6">

              {/* ── Card 1: NPS Gauge ── */}
              <div className="flex-1 min-w-0 rounded-xl border border-sky-500/20 bg-white overflow-hidden cursor-pointer"
                onClick={() => showDetail('npsGauge')}>
                <div className="card-header px-5 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest">Net Promoter Score (NPS)</span>
                  <button onClick={(e) => { e.stopPropagation(); showDetail('npsGauge'); }} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={13} /></button>
                </div>
                <div className="p-4 flex flex-col items-center">
                  <svg viewBox="0 0 300 200" width="100%" style={{ maxWidth: 300 }}>
                    <path d={gaugeArc(180, 0)} fill="#E2E8F0" />
                    {(() => {
                      const t = nps.total;
                      const dPct = t > 0 ? nps.detractor / t : 0;
                      const pPct = t > 0 ? nps.passive / t : 0;
                      const prPct = t > 0 ? nps.promoter / t : 0;
                      const dEnd = 180 - dPct * 180;
                      const pEnd = dEnd - pPct * 180;
                      const rad = (d: number) => (d * Math.PI) / 180;
                      const labelPt = (midDeg: number, r: number) => ({
                        x: G_CX + r * Math.cos(rad(midDeg)),
                        y: G_CY - r * Math.sin(rad(midDeg)),
                      });
                      const LR = G_R_IN - 12;
                      const dL  = labelPt(180 - (dPct / 2) * 180, LR);
                      const pL  = labelPt(dEnd - (pPct / 2) * 180, LR);
                      const prL = labelPt(pEnd - (prPct / 2) * 180, LR);
                      return (
                        <>
                          {dPct  > 0.001 && <path d={gaugeArc(180, Math.max(dEnd, 0.5))} fill="#DC2626" />}
                          {pPct  > 0.001 && <path d={gaugeArc(dEnd, Math.max(pEnd, 0.5))} fill="#EC4899" />}
                          {prPct > 0.001 && <path d={gaugeArc(pEnd, 0)} fill="#22C55E" />}
                          {dPct  > 0.06 && <text x={dL.x.toFixed(1)}  y={dL.y.toFixed(1)}  textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="system-ui,sans-serif">Detractors</text>}
                          {pPct  > 0.06 && <text x={pL.x.toFixed(1)}  y={pL.y.toFixed(1)}  textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="system-ui,sans-serif">Passives</text>}
                          {prPct > 0.06 && <text x={prL.x.toFixed(1)} y={prL.y.toFixed(1)} textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="system-ui,sans-serif">Promoters</text>}
                        </>
                      );
                    })()}
                    {(() => {
                      const clamped = Math.max(-100, Math.min(100, nps.npsScore));
                      const deg = 180 - ((clamped + 100) / 200) * 180;
                      const rad = (d: number) => (d * Math.PI) / 180;
                      const nLen = G_R_OUT - 12;
                      const nx = G_CX + nLen * Math.cos(rad(deg));
                      const ny = G_CY - nLen * Math.sin(rad(deg));
                      return (
                        <>
                          <line x1={G_CX} y1={G_CY} x2={nx.toFixed(2)} y2={ny.toFixed(2)}
                            stroke="#F1F5F9" strokeWidth={2.5} strokeLinecap="round" />
                          <circle cx={G_CX} cy={G_CY} r={6} fill="#F1F5F9" />
                          <circle cx={G_CX} cy={G_CY} r={3} fill="#E2E8F0" />
                        </>
                      );
                    })()}
                    <text x={G_CX} y={G_CY + 26} textAnchor="middle" fill="#0F172A" fontSize="26" fontWeight="bold" fontFamily="system-ui,sans-serif">
                      {nps.npsScore}
                    </text>
                    <text x="6"   y={G_CY + 14} fill="#0F172A" fontSize="10" fontFamily="system-ui,sans-serif">-100</text>
                    <text x="264" y={G_CY + 14} fill="#0F172A" fontSize="10" fontFamily="system-ui,sans-serif">100</text>
                  </svg>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {[
                      { label: 'Detractors', count: nps.detractor, color: '#DC2626' },
                      { label: 'Passives',   count: nps.passive,   color: '#EC4899' },
                      { label: 'Promoters',  count: nps.promoter,  color: '#22C55E' },
                    ].map((seg, i) => {
                      const pct = nps.total > 0 ? ((seg.count / nps.total) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-[11px]">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: seg.color }} />
                          <span className="text-slate-700 font-medium">{seg.label}</span>
                          <span className="font-bold text-slate-900 ml-1">{seg.count.toLocaleString()}</span>
                          <span className="text-slate-700">({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Card 2: CSAT Gauge ── */}
              <div className="flex-1 min-w-0 rounded-xl border border-emerald-500/20 bg-white overflow-hidden cursor-pointer"
                onClick={() => showDetail('csatGauge')}>
                <div className="card-header px-5 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest">Customer Satisfaction (CSAT)</span>
                  <button onClick={(e) => { e.stopPropagation(); showDetail('csatGauge'); }} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={13} /></button>
                </div>
                <div className="p-4 flex flex-col items-center">
                  <svg viewBox="0 0 300 200" width="100%" style={{ maxWidth: 300 }}>
                    <path d={gaugeArc(180, 0)} fill="#E2E8F0" />
                    {nps.csatPct > 0 && (
                      <path
                        d={gaugeArc(180, Math.max(180 - (Math.min(nps.csatPct, 100) / 100) * 180, 0.5))}
                        fill="#22C55E"
                      />
                    )}
                    {(() => {
                      const deg = 180 - (Math.max(0, Math.min(100, nps.csatPct)) / 100) * 180;
                      const rad = (d: number) => (d * Math.PI) / 180;
                      const nLen = G_R_OUT - 12;
                      const nx = G_CX + nLen * Math.cos(rad(deg));
                      const ny = G_CY - nLen * Math.sin(rad(deg));
                      return (
                        <>
                          <line x1={G_CX} y1={G_CY} x2={nx.toFixed(2)} y2={ny.toFixed(2)}
                            stroke="#F1F5F9" strokeWidth={2.5} strokeLinecap="round" />
                          <circle cx={G_CX} cy={G_CY} r={6} fill="#F1F5F9" />
                          <circle cx={G_CX} cy={G_CY} r={3} fill="#E2E8F0" />
                        </>
                      );
                    })()}
                    <text x={G_CX} y={G_CY + 26} textAnchor="middle" fill="#0F172A" fontSize="24" fontWeight="bold" fontFamily="system-ui,sans-serif">
                      {nps.csatPct}%
                    </text>
                    <text x={G_CX} y={G_CY + 42} textAnchor="middle" fill="#0F172A" fontSize="9" fontWeight="600" fontFamily="system-ui,sans-serif" letterSpacing="1.5">
                      CSAT SCORE
                    </text>
                    <text x="10"  y={G_CY + 14} fill="#0F172A" fontSize="10" fontFamily="system-ui,sans-serif">0%</text>
                    <text x="256" y={G_CY + 14} fill="#0F172A" fontSize="10" fontFamily="system-ui,sans-serif">100%</text>
                  </svg>
                  <p className="text-[11px] text-slate-800 font-medium mt-1 text-center">(Positive + Neutral) / Total Feedback</p>
                  <div className="flex gap-6 mt-3">
                    {[
                      { label: 'Satisfied',   count: nps.promoter + nps.passive, color: '#22C55E' },
                      { label: 'Unsatisfied', count: nps.detractor,              color: '#EF4444' },
                    ].map((seg, i) => {
                      const pct = nps.total > 0 ? ((seg.count / nps.total) * 100).toFixed(1) : '0.0';
                      return (
                        <div key={i} className="flex items-center gap-1.5 text-[11px]">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: seg.color }} />
                          <span className="text-slate-700 font-medium">{seg.label}</span>
                          <span className="font-bold text-slate-900 ml-1">{seg.count.toLocaleString()}</span>
                          <span className="text-slate-700">({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Card 3: Feedback Status Breakup ── */}
              <div className="flex-1 min-w-0 rounded-xl border border-purple-500/20 bg-white overflow-hidden cursor-pointer"
                onClick={() => showDetail('feedbackPie')}>
                <div className="card-header px-5 py-3">
                  <span className="text-[11px] font-bold uppercase tracking-widest">Feedback Status Breakup</span>
                  <button onClick={(e) => { e.stopPropagation(); showDetail('feedbackPie'); }} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={13} /></button>
                </div>
                <div className="p-4 flex flex-col items-center gap-3">
                  {feedbackData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={feedbackData}
                            cx="50%" cy="50%"
                            outerRadius={110}
                            paddingAngle={2}
                            dataKey="value"
                            labelLine={false}
                            label={({ cx: pcx, cy: pcy, midAngle, outerRadius: or, percent }) => {
                              if (!percent || percent < 0.04 || midAngle == null) return null;
                              const RADIAN = Math.PI / 180;
                              const radius = (or as number) * 0.68;
                              const x = (pcx as number) + radius * Math.cos(-midAngle * RADIAN);
                              const y = (pcy as number) + radius * Math.sin(-midAngle * RADIAN);
                              return (
                                <text x={x} y={y} fill="#fff" textAnchor="middle"
                                  dominantBaseline="central" fontSize={11} fontWeight="bold">
                                  {`${(percent * 100).toFixed(1)}%`}
                                </text>
                              );
                            }}
                          >
                            {feedbackData.map((d, i) => (
                              <Cell key={i} fill={d.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={TT} formatter={(v: unknown) => [Number(v).toLocaleString()]} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex items-center justify-center gap-6 pb-2">
                        {feedbackData.map((d, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[11px]">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                            <span className="text-slate-700 font-medium">{d.name}:</span>
                            <span className="font-bold text-slate-900">{d.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-600 py-12">No feedback data</p>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ── NPS & CSAT Analysis Table ── */}
          {nps && nps.days.length > 0 && (() => {
            const allDays = [...nps.days].sort((a, b) => b.calldate.localeCompare(a.calldate));
            const rows    = allDays;
            const maxD  = Math.max(...rows.map(d => d.detractor), 1);
            const maxP  = Math.max(...rows.map(d => d.passive), 1);
            const maxPr = Math.max(...rows.map(d => d.promoter), 1);
            const maxT  = Math.max(...rows.map(d => d.totalFeedbacks), 1);
            const cell  = (v: number, max: number, rgb: string) => ({
              backgroundColor: max > 0 ? `rgba(${rgb},${(v / max) * 0.75 + 0.1})` : 'transparent',
              color: max > 0 && v / max > 0.55 ? '#fff' : '#0F172A',
            });
            const fmtDate = (s: string) => {
              const d = new Date(s + 'T00:00:00');
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            };
            const gPr  = allDays.reduce((a, r) => a + r.promoter, 0);
            const gD   = allDays.reduce((a, r) => a + r.detractor, 0);
            const gP   = allDays.reduce((a, r) => a + r.passive, 0);
            const gT   = allDays.reduce((a, r) => a + r.totalFeedbacks, 0);
            const gNPS = gT > 0 ? ((gPr - gD) / gT * 100).toFixed(2) : '0.00';
            return (
              <div className="mt-6 rounded-xl border border-sky-500/20 bg-white overflow-hidden cursor-pointer"
                onClick={() => showDetail('npsTable')}>
                <div className="card-header gap-2 px-5 py-3">
                  <BarChart3 size={14} className="text-sky-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">NPS and CSAT Analysis</span>
                  <span className="ml-2 text-[10px] text-slate-500">{allDays.length} days · scroll to see all</span>
                  <button onClick={(e) => { e.stopPropagation(); showDetail('npsTable'); }} className="ml-1 text-white/70 hover:text-white transition-colors mr-1"><Info size={13} /></button>
                  <ExportBtn onClick={() => nps && downloadCSV(nps.days.map(d => ({ Date: d.calldate, Detractor: d.detractor, Passive: d.passive, Promoter: d.promoter, 'Total Feedbacks': d.totalFeedbacks, 'NPS Score': d.npsScore })), 'nps-day-wise.csv')} />
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto', overflowX: 'auto' }}>
                  <table className="w-full text-[11px]" style={{ tableLayout: 'fixed', minWidth: 560 }}>
                    <colgroup>
                      <col style={{ width: '22%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '13%' }} />
                      <col style={{ width: '22%' }} />
                    </colgroup>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr className="text-slate-500 uppercase text-[9px] tracking-wider border-b border-slate-200 bg-white">
                        <th className="px-4 py-2.5 text-left">Call Date</th>
                        <th className="px-4 py-2.5 text-right">Detractor</th>
                        <th className="px-4 py-2.5 text-right">Passive</th>
                        <th className="px-4 py-2.5 text-right">Promoter</th>
                        <th className="px-4 py-2.5 text-right">NPS Score</th>
                        <th className="px-4 py-2.5 text-right">Total Feedbacks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2 text-slate-600 whitespace-nowrap">{fmtDate(row.calldate)}</td>
                          <td className="px-4 py-2 text-right font-semibold" style={cell(row.detractor, maxD, '220,38,38')}>
                            {row.detractor.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold" style={cell(row.passive, maxP, '249,115,22')}>
                            {row.passive.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold" style={cell(row.promoter, maxPr, '34,197,94')}>
                            {row.promoter.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-sky-300">{row.npsScore}</td>
                          <td className="px-4 py-2 text-right font-semibold" style={cell(row.totalFeedbacks, maxT, '34,197,94')}>
                            {row.totalFeedbacks.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
                      <tr className="border-t border-slate-200 bg-white">
                        <td className="px-4 py-2.5 font-bold text-slate-900 text-[11px]">Grand Total</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gD.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gP.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gPr.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-sky-300">{gNPS}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gT.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ── NPS & CSAT Day Wise Trend ── */}
          {nps && nps.days.length > 0 && (() => {
            const fmtShort = (s: string) => {
              const d = new Date(s + 'T00:00:00');
              return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            };
            return (
              <div className="mt-6 rounded-xl border border-sky-500/20 bg-white overflow-hidden cursor-pointer"
                onClick={() => showDetail('npsTrend')}>
                <div className="card-header gap-2 px-5 py-3">
                  <BarChart3 size={14} className="text-sky-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">NPS and CSAT Day Wise Trend</span>
                  <button onClick={(e) => { e.stopPropagation(); showDetail('npsTrend'); }} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={13} /></button>
                </div>
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={340}>
                    <LineChart data={nps.days} margin={{ top: 24, right: 60, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis
                        dataKey="calldate"
                        tickFormatter={fmtShort}
                        tick={{ fill: '#334155', fontSize: 9 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fill: '#EF4444', fontSize: 9 }}
                        tickFormatter={(v: number) => v.toFixed(0)}
                        label={{ value: 'NPS Score', angle: -90, position: 'insideLeft', fill: '#EF4444', fontSize: 9, dx: -4 }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: '#F59E0B', fontSize: 9 }}
                        tickFormatter={(v: number) => v.toLocaleString()}
                        label={{ value: 'Total Feedbacks', angle: 90, position: 'insideRight', fill: '#F59E0B', fontSize: 9, dx: 10 }}
                      />
                      <Tooltip
                        contentStyle={TT}
                        labelFormatter={(s: unknown) => fmtShort(String(s))}
                        formatter={(v: unknown) => [Number(v).toLocaleString()]}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: '#94A3B8', paddingTop: 8 }}
                        formatter={(value) => <span style={{ color: value === 'NPS Score' ? '#EF4444' : '#F59E0B' }}>{value}</span>}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="npsScore"
                        name="NPS Score"
                        stroke="#EF4444"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#EF4444' }}
                        activeDot={{ r: 5 }}
                      >
                        <LabelList
                          dataKey="npsScore"
                          position="top"
                          style={{ fill: '#B91C1C', fontSize: 8, fontWeight: 600 }}
                          formatter={(v: unknown) => Number(v).toFixed(2)}
                        />
                      </Line>
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="totalFeedbacks"
                        name="Total Feedbacks"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#F59E0B' }}
                        activeDot={{ r: 5 }}
                      >
                        <LabelList
                          dataKey="totalFeedbacks"
                          position="bottom"
                          style={{ fill: '#92400E', fontSize: 8, fontWeight: 600 }}
                          formatter={(v: unknown) => Number(v).toLocaleString()}
                        />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          {/* ─── Agent-wise NPS & CSAT ─────────────────────────────────────── */}
          <div className="rounded-xl border border-sky-500/20 bg-white overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
              <div className="w-1 h-4 bg-sky-500 rounded-full" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-sky-700">Agent-wise NPS &amp; CSAT</span>
              {agentNPS.length > 0 && <span className="ml-2 text-[10px] text-slate-500">{agentNPS.length} agents</span>}
              <div className="ml-auto">
                <ExportBtn onClick={() => downloadCSV(agentNPS as unknown as Record<string,unknown>[], 'agent-nps-csat.csv')} />
              </div>
            </div>
            {agentNPS.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">#</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-600">AgentName</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-emerald-700">Promoter</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-amber-700">Passive</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-red-700">Detractor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {agentNPS.map((row, i) => {
                    const total = row.promoter + row.passive + row.detractor;
                    const isMasId = /^MAS/i.test(row.agentId);
                    return (
                      <tr key={i} className="hover:bg-sky-50 transition-colors">
                        <td className="px-4 py-2.5 text-slate-500">{i + 1}</td>
                        <td className="px-4 py-2.5">
                          {editingAgentId === row.agentId ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={editingAgentName}
                                onChange={e => setEditingAgentName(e.target.value)}
                                className="w-36 px-2 py-1 rounded text-xs border border-sky-300 bg-white text-slate-900 outline-none focus:border-sky-500"
                                autoFocus
                                onKeyDown={async e => {
                                  if (e.key === 'Escape') { setEditingAgentId(null); return; }
                                  if (e.key !== 'Enter') return;
                                  if (!editingAgentName.trim()) return;
                                  try {
                                    await api.post('/quality/agent-master', {
                                      agentId: row.agentId,
                                      agentName: editingAgentName.trim(),
                                      lob: 'Outbound',
                                    });
                                    setAgentNPS(prev => prev.map(r =>
                                      r.agentId === row.agentId ? { ...r, agent: editingAgentName.trim() } : r
                                    ));
                                  } catch { alert('Failed to save agent name'); }
                                  setEditingAgentId(null);
                                }}
                              />
                              <button onClick={async () => {
                                if (!editingAgentName.trim()) return;
                                try {
                                  await api.post('/quality/agent-master', {
                                    agentId: row.agentId,
                                    agentName: editingAgentName.trim(),
                                    lob: 'Outbound',
                                  });
                                  setAgentNPS(prev => prev.map(r =>
                                    r.agentId === row.agentId ? { ...r, agent: editingAgentName.trim() } : r
                                  ));
                                } catch { alert('Failed to save agent name'); }
                                setEditingAgentId(null);
                              }} className="px-2 py-1 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100">Save</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sky-700 font-medium">{row.agentId}</span>
                              <span className="text-slate-400 text-[10px]">→</span>
                              <span className="text-slate-800">{row.agent}</span>
                              {isMasId && (
                                <button onClick={() => {
                                  setEditingAgentId(row.agentId);
                                  setEditingAgentName(row.agent);
                                }} className="text-slate-400 hover:text-sky-600 transition-colors" title="Edit display name">
                                  <Pencil size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-emerald-700 font-semibold">
                          {row.promoter.toLocaleString()}
                          <span className="text-slate-500 ml-1 text-[10px]">
                            ({total > 0 ? ((row.promoter / total) * 100).toFixed(0) : 0}%)
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-amber-700 font-semibold">
                          {row.passive.toLocaleString()}
                          <span className="text-slate-500 ml-1 text-[10px]">
                            ({total > 0 ? ((row.passive / total) * 100).toFixed(0) : 0}%)
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-red-700 font-semibold">
                          {row.detractor.toLocaleString()}
                          <span className="text-slate-500 ml-1 text-[10px]">
                            ({total > 0 ? ((row.detractor / total) * 100).toFixed(0) : 0}%)
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const totPro = agentNPS.reduce((s, r) => s + r.promoter, 0);
                    const totPas = agentNPS.reduce((s, r) => s + r.passive, 0);
                    const totDet = agentNPS.reduce((s, r) => s + r.detractor, 0);
                    return (
                      <tr className="border-t border-slate-300 bg-slate-100">
                        <td className="px-4 py-2.5" />
                        <td className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">Total</td>
                        <td className="px-4 py-2.5 text-right font-bold text-emerald-800">{totPro.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-amber-800">{totPas.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-red-800">{totDet.toLocaleString()}</td>
                      </tr>
                    );
                  })()}
                </tfoot>
              </table>
            </div>
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">No agent NPS data available</div>
            )}
          </div>

          {/* ── Agent-wise Detractor / Passive / Promoter ── */}
          {agentNPS.length > 0 ? (() => {
            const withTotals = agentNPS.map(r => ({ ...r, rowTotal: r.promoter + r.passive + r.detractor }));
            const gD  = agentNPS.reduce((a, r) => a + r.detractor, 0);
            const gP  = agentNPS.reduce((a, r) => a + r.passive,   0);
            const gPr = agentNPS.reduce((a, r) => a + r.promoter,  0);
            const gT  = gD + gP + gPr;
            const gNPS = gT > 0 ? ((gPr - gD) / gT * 100).toFixed(2) : '0.00';
            const maxD  = Math.max(...agentNPS.map(r => r.detractor), 1);
            const maxP  = Math.max(...agentNPS.map(r => r.passive),   1);
            const maxPr = Math.max(...agentNPS.map(r => r.promoter),  1);
            const cell  = (v: number, max: number, rgb: string) => ({
              backgroundColor: max > 0 ? `rgba(${rgb},${(v / max) * 0.7 + 0.08})` : 'transparent',
              color: max > 0 && v / max > 0.55 ? '#fff' : '#0F172A',
            });
            const npsColor = (s: number) => s >= 50 ? '#22C55E' : s >= 0 ? '#F59E0B' : '#EF4444';
            return (
              <div className="mt-6 rounded-xl border border-violet-500/20 bg-white overflow-hidden">
                <div className="card-header gap-2 px-5 py-3">
                  <Users size={14} className="text-violet-400" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">Agent Wise — Detractor / Passive / Promoter</span>
                  <span className="ml-2 text-[10px] text-slate-500">{agentNPS.length} agents · sorted by NPS</span>
                  <div className="ml-auto">
                    <ExportBtn onClick={() => downloadCSV(withTotals.map(r => ({
                      Agent: r.agent,
                      Detractor: r.detractor,
                      Passive: r.passive,
                      Promoter: r.promoter,
                      Total: r.rowTotal,
                      'NPS Score': r.nps,
                    })), 'agent-nps.csv')} />
                  </div>
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto', overflowX: 'auto' }}>
                  <table className="w-full text-[11px]" style={{ tableLayout: 'fixed', minWidth: 560 }}>
                    <colgroup>
                      <col style={{ width: '30%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '12%' }} />
                      <col style={{ width: '18%' }} />
                    </colgroup>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr className="text-slate-500 uppercase text-[9px] tracking-wider border-b border-slate-200 bg-white">
                        <th className="px-4 py-2.5 text-left">Agent Name</th>
                        <th className="px-4 py-2.5 text-right" style={{ color: '#EF4444' }}>Detractor</th>
                        <th className="px-4 py-2.5 text-right" style={{ color: '#F59E0B' }}>Passive</th>
                        <th className="px-4 py-2.5 text-right" style={{ color: '#22C55E' }}>Promoter</th>
                        <th className="px-4 py-2.5 text-right">Total</th>
                        <th className="px-4 py-2.5 text-right">NPS Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {withTotals.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-2 text-slate-700 font-medium truncate">{row.agent}</td>
                          <td className="px-4 py-2 text-right font-semibold" style={cell(row.detractor, maxD, '220,38,38')}>
                            {row.detractor.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold" style={cell(row.passive, maxP, '249,115,22')}>
                            {row.passive.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold" style={cell(row.promoter, maxPr, '34,197,94')}>
                            {row.promoter.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-right text-slate-600">{row.rowTotal.toLocaleString()}</td>
                          <td className="px-4 py-2 text-right font-bold" style={{ color: npsColor(row.nps) }}>
                            {row.nps}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
                      <tr className="border-t border-slate-200 bg-white">
                        <td className="px-4 py-2.5 font-bold text-slate-900 text-[11px]">Grand Total</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gD.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gP.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gPr.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gT.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right font-bold" style={{ color: npsColor(Number(gNPS)) }}>{gNPS}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })() : (
            <div className="mt-6 rounded-xl border border-violet-500/20 bg-white overflow-hidden p-8 text-center text-slate-400 text-xs">No agent data available</div>
          )}
        </div>
        )}

        {/* ─── Slide 3: Detail Analysis ──────────────────────────────────── */}
        {activeSlide === 3 && (
        <div className="space-y-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-orange-500 rounded-full" />
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Detail Analysis</h2>
          </div>

          {/* CST + CRT side by side */}
          {(cst || crt) && (
            <div className="flex gap-4">
              {cst && (
                <div className="flex-1 min-w-0 rounded-xl border border-emerald-500/30 bg-white overflow-hidden">
                  <div className="card-header gap-2 px-4 py-2.5">
                    <TrendingUp size={13} className="text-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">CST — Customer Success Track</span>
                    <button onClick={() => showDetail('cstSection')} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={12} /></button>
                  </div>
                  <div className="flex flex-row gap-px bg-slate-100">
                    {CST_METRICS(cst).map((m, i) => (
                      <div key={i} onClick={() => setModalMetric(m)}
                        className="flex-1 min-w-0 bg-white px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors">
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">{m.label}</span>
                        <p className="text-lg font-bold text-slate-900">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {crt && (
                <div className="flex-1 min-w-0 rounded-xl border border-red-500/30 bg-white overflow-hidden">
                  <div className="card-header gap-2 px-4 py-2.5">
                    <XCircle size={13} className="text-red-400" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">CRT — Customer Rejection Track</span>
                    <button onClick={() => showDetail('crtSection')} className="ml-auto text-white/70 hover:text-white transition-colors"><Info size={12} /></button>
                  </div>
                  <div className="flex flex-row gap-px bg-slate-100">
                    {CRT_METRICS(crt).map((m, i) => (
                      <div key={i} onClick={() => setModalMetric(m)}
                        className="flex-1 min-w-0 bg-white px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors">
                        <span className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">{m.label}</span>
                        <p className="text-lg font-bold text-slate-900">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── OP Analysis ─────────────────────────────────────────────── */}
          {detailAnalysis && (
            <>
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-1 h-5 bg-blue-400 rounded-full" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">OP Analysis</h3>
              </div>

              {/* ── Table 1: OP Category Wise Success ── */}
              {(() => {
                const rows = detailAnalysis.opCategories;
                const maxT  = Math.max(...rows.map(r => r.totalCalls), 1);
                const maxOps = Math.max(...rows.map(r => r.opsCount), 1);
                const maxOr  = Math.max(...rows.map(r => r.orCount), 1);
                const heatBg = (v: number, max: number, rgb: string) =>
                  max > 0 ? `rgba(${rgb},${(v / max) * 0.65 + 0.12})` : 'transparent';
                const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(0)}%` : '0%';

                const gTotal = rows.reduce((a, r) => a + r.totalCalls, 0);
                const gOps   = rows.reduce((a, r) => a + r.opsCount,   0);
                const gOr    = rows.reduce((a, r) => a + r.orCount,    0);
                const gSale  = rows.reduce((a, r) => a + r.saleCount,  0);

                return (
                  <div className="rounded-xl border border-blue-500/20 bg-white overflow-hidden">
                    <div className="card-header gap-2 px-5 py-3">
                      <BarChart3 size={14} className="text-blue-400" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-blue-400">OP Category Wise Success</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-white">Opening Pitch Category</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-blue-900/30">Total Calls ▼</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-emerald-900/20">OPS Count</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-emerald-900/20">OPS%</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-red-900/20">OR Count</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-red-900/20">OR%</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Sale Count</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Conv%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2 text-slate-700 font-medium">{row.openingCategory}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.totalCalls, maxT, '59,130,246') }}>
                                {row.totalCalls.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.opsCount, maxOps, '34,197,94') }}>
                                {row.opsCount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.opsCount, maxOps, '34,197,94') }}>
                                {pct(row.opsCount, row.totalCalls)}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.orCount, maxOr, '239,68,68') }}>
                                {row.orCount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.orCount, maxOr, '239,68,68') }}>
                                {pct(row.orCount, row.totalCalls)}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-700">{row.saleCount.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-700">{pct(row.saleCount, row.totalCalls)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-200 bg-slate-100">
                            <td className="px-4 py-2.5 font-bold text-slate-900 text-[11px]">Grand Total</td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gTotal.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-300">{gOps.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-300">{pct(gOps, gTotal)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-red-300">{gOr.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-red-300">{pct(gOr, gTotal)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gSale.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">{pct(gSale, gTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}

              {/* ── Table 2: Context Setting Analysis ── */}
              {(() => {
                const rows = detailAnalysis.csCategories;
                const maxT   = Math.max(...rows.map(r => r.totalCalls), 1);
                const maxOps = Math.max(...rows.map(r => r.opsCount),   1);
                const maxOr  = Math.max(...rows.map(r => r.orCount),    1);
                const heatBg = (v: number, max: number, rgb: string) =>
                  max > 0 ? `rgba(${rgb},${(v / max) * 0.65 + 0.12})` : 'transparent';
                const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(0)}%` : '0%';

                const gTotal = rows.reduce((a, r) => a + r.totalCalls, 0);
                const gOps   = rows.reduce((a, r) => a + r.opsCount,   0);
                const gOr    = rows.reduce((a, r) => a + r.orCount,    0);
                const gSale  = rows.reduce((a, r) => a + r.saleCount,  0);

                return (
                  <div className="mt-6 rounded-xl border border-teal-500/20 bg-white overflow-hidden">
                    <div className="card-header gap-2 px-5 py-3">
                      <BarChart3 size={14} className="text-teal-400" />
                      <span className="text-[11px] font-bold uppercase tracking-widest text-teal-400">Context Setting Analysis</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-white">Context Setting Category</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-blue-900/30">Total Calls ▼</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-emerald-900/20">OPS Count</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-emerald-900/20">OPS%</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-red-900/20">OR Count</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-red-900/20">OR%</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Sale Count</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Conv%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2 text-slate-700 font-medium">{row.contactGroup}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.totalCalls, maxT, '59,130,246') }}>
                                {row.totalCalls.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.opsCount, maxOps, '34,197,94') }}>
                                {row.opsCount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.opsCount, maxOps, '34,197,94') }}>
                                {pct(row.opsCount, row.totalCalls)}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.orCount, maxOr, '239,68,68') }}>
                                {row.orCount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.orCount, maxOr, '239,68,68') }}>
                                {pct(row.orCount, row.totalCalls)}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-700">{row.saleCount.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-700">{pct(row.saleCount, row.totalCalls)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-slate-200 bg-slate-100">
                            <td className="px-4 py-2.5 font-bold text-slate-900 text-[11px]">Grand Total</td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gTotal.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-300">{gOps.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-emerald-300">{pct(gOps, gTotal)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-red-300">{gOr.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-red-300">{pct(gOr, gTotal)}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gSale.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right font-bold text-slate-900">{pct(gSale, gTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── Offered Pitch Analysis (standalone) ── */}
            {detailAnalysis.offeredPitch.length > 0 && (() => {
              const allRows = detailAnalysis.offeredPitch;
              const maxT  = Math.max(...allRows.map(r => r.totalOffer), 1);
              const maxOr = Math.max(...allRows.map(r => r.orCount),    1);
              const maxOs = Math.max(...allRows.map(r => r.osCount),    1);
              const heatBg = (v: number, max: number, rgb: string) =>
                max > 0 ? `rgba(${rgb},${(v / max) * 0.65 + 0.12})` : 'transparent';
              const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(0)}%` : '0%';

              const gTotal = allRows.reduce((a, r) => a + r.totalOffer, 0);
              const gOr    = allRows.reduce((a, r) => a + r.orCount,    0);
              const gOs    = allRows.reduce((a, r) => a + r.osCount,    0);
              const gSale  = allRows.reduce((a, r) => a + r.saleCount,  0);

              return (
                <div className="mt-8 rounded-xl border border-amber-500/20 bg-white overflow-hidden">
                  <div className="card-header gap-2 px-5 py-3">
                    <BarChart3 size={14} className="text-amber-400" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">Offered Pitch Analysis</span>
                  </div>

                  <div className="overflow-x-auto">
                    {/* scrollable area with sticky thead */}
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                      <table className="w-full text-[11px] border-collapse" style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '30%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '10%' }} />
                          <col style={{ width: '10%' }} />
                        </colgroup>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-white">Discount Type</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-blue-950">Total Offer ▼</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-red-950">OR Count</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-red-950">OR%</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-emerald-950">OS Count</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-emerald-950">OS%</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-white">Sale Count</th>
                            <th className="px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-white">Conv%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {allRows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2 text-slate-700 font-medium truncate">{row.discountType}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.totalOffer, maxT, '59,130,246') }}>
                                {row.totalOffer.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.orCount, maxOr, '239,68,68') }}>
                                {row.orCount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.orCount, maxOr, '239,68,68') }}>
                                {pct(row.orCount, row.totalOffer)}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.osCount, maxOs, '34,197,94') }}>
                                {row.osCount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.osCount, maxOs, '34,197,94') }}>
                                {pct(row.osCount, row.totalOffer)}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-700">{row.saleCount.toLocaleString()}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-700">{pct(row.saleCount, row.totalOffer)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Grand Total pinned below scroll area */}
                    <table className="w-full text-[11px] border-collapse border-t border-slate-200" style={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '30%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                      </colgroup>
                      <tbody>
                        <tr className="bg-slate-100">
                          <td className="px-4 py-2.5 font-bold text-slate-900 text-[11px]">Grand Total</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gTotal.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-300">{gOr.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-300">{pct(gOr, gTotal)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-300">{gOs.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-300">{pct(gOs, gTotal)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gSale.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{pct(gSale, gTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
            </>
          )}

          {objectionAnalysis && (() => {
            const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(0)}%` : '0%';
            const heatBg = (v: number, max: number, rgb: string) =>
              max > 0 ? `rgba(${rgb},${(v / max) * 0.65 + 0.12})` : 'transparent';

            const COL_HDR = (extra = '') =>
              `px-4 py-2.5 text-right text-slate-400 font-semibold text-[10px] uppercase tracking-wider ${extra}`;

            const renderTable = (
              title: string,
              borderColor: string,
              headerColor: string,
              iconColor: string,
              dimLabel: string,
              rows: { label: string; objectionCount: number; failedRebuttal: number; successfulRebuttal: number; saleCount: number }[],
            ) => {
              if (!rows.length) return null;
              const maxObj  = Math.max(...rows.map(r => r.objectionCount), 1);
              const maxFail = Math.max(...rows.map(r => r.failedRebuttal), 1);
              const maxSucc = Math.max(...rows.map(r => r.successfulRebuttal), 1);
              const gObj  = rows.reduce((a, r) => a + r.objectionCount, 0);
              const gFail = rows.reduce((a, r) => a + r.failedRebuttal, 0);
              const gSucc = rows.reduce((a, r) => a + r.successfulRebuttal, 0);
              const gSale = rows.reduce((a, r) => a + r.saleCount, 0);

              const colgroup = (
                <colgroup>
                  <col style={{ width: '32%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '8%' }} />
                </colgroup>
              );

              return (
                <div className={`mt-6 rounded-xl border ${borderColor} bg-white overflow-hidden`}>
                  <div className="card-header gap-2 px-5 py-3">
                    <BarChart3 size={14} />
                    <span className="text-[11px] font-bold uppercase tracking-widest">{title}</span>
                    <div className="ml-auto">
                      <ExportBtn onClick={() => downloadCSV(rows.map(r => ({ [dimLabel]: r.label, 'Obj. Count': r.objectionCount, 'Failed Reb.': r.failedRebuttal, 'FR%': pct(r.failedRebuttal, r.objectionCount), 'Succ. Reb.': r.successfulRebuttal, 'SR%': pct(r.successfulRebuttal, r.objectionCount), 'Sale': r.saleCount, 'Conv%': pct(r.saleCount, r.objectionCount) })), `${title.replace(/\s+/g, '-').toLowerCase()}.csv`)} />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                      <table className="w-full text-[11px] border-collapse" style={{ tableLayout: 'fixed' }}>
                        {colgroup}
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                          <tr className="border-b border-slate-200">
                            <th className="px-4 py-2.5 text-left text-slate-400 font-semibold text-[10px] uppercase tracking-wider bg-white">{dimLabel}</th>
                            <th className={COL_HDR('bg-blue-950')}>Obj. Count ▼</th>
                            <th className={COL_HDR('bg-red-950')}>Failed Reb.</th>
                            <th className={COL_HDR('bg-red-950')}>FR%</th>
                            <th className={COL_HDR('bg-emerald-950')}>Succ. Reb.</th>
                            <th className={COL_HDR('bg-emerald-950')}>SR%</th>
                            <th className={COL_HDR('bg-white')}>Sale</th>
                            <th className={COL_HDR('bg-white')}>Conv%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-2 text-slate-700 font-medium truncate">{row.label}</td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.objectionCount, maxObj, '59,130,246') }}>
                                {row.objectionCount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.failedRebuttal, maxFail, '239,68,68') }}>
                                {row.failedRebuttal.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.failedRebuttal, maxFail, '239,68,68') }}>
                                {pct(row.failedRebuttal, row.objectionCount)}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.successfulRebuttal, maxSucc, '34,197,94') }}>
                                {row.successfulRebuttal.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-900"
                                style={{ backgroundColor: heatBg(row.successfulRebuttal, maxSucc, '34,197,94') }}>
                                {pct(row.successfulRebuttal, row.objectionCount)}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-700">
                                {row.saleCount.toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-slate-700">
                                {pct(row.saleCount, row.objectionCount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <table className="w-full text-[11px] border-collapse border-t border-slate-200" style={{ tableLayout: 'fixed' }}>
                      {colgroup}
                      <tbody>
                        <tr className="bg-slate-100">
                          <td className="px-4 py-2.5 font-bold text-slate-900 text-[11px]">Grand Total</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gObj.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-300">{gFail.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-red-300">{pct(gFail, gObj)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-300">{gSucc.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-300">{pct(gSucc, gObj)}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{gSale.toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{pct(gSale, gObj)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            };

            return (
              <>
                <div className="mt-10 flex items-center gap-3">
                  <div className="w-1 h-6 bg-violet-500 rounded-full" />
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Customer Objection Analysis</h2>
                </div>

                {renderTable(
                  'POS Breakdown',
                  'border-violet-500/20',
                  'bg-violet-500/5',
                  'text-violet-400',
                  'Main Objection',
                  objectionAnalysis.posBreakdown.map(r => ({ label: r.mainObjection, ...r })),
                )}

                {renderTable(
                  'POS Subcategory Breakdown',
                  'border-fuchsia-500/20',
                  'bg-fuchsia-500/5',
                  'text-fuchsia-400',
                  'Cx Objection Subcategory',
                  objectionAnalysis.posSubcategory.map(r => ({ label: r.cxObjectionSubcat, ...r })),
                )}
              </>
            );
          })()}
        </div>
        )}

        {/* ─── Chart Detail Modal ───────────────────────────────────────── */}
        {chartDetail && (
          <div onClick={() => setChartDetail(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div onClick={e => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-xl max-w-xl w-full mx-4 overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3 shrink-0">
                <div className="p-1.5 rounded bg-sky-500/10">
                  <Info size={15} className="text-sky-400" />
                </div>
                <p className="text-sm font-bold text-slate-900 flex-1">{chartDetail.title}</p>
                <button onClick={() => setChartDetail(null)}
                  className="text-slate-500 hover:text-slate-900 transition-colors text-lg leading-none">&times;</button>
              </div>
              <div className="p-5 space-y-5 overflow-y-auto">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Description</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{chartDetail.description}</p>
                </div>
                {chartDetail.scale && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Scale / Interpretation</p>
                    <div className="bg-white rounded-lg p-3">
                      <code className="text-xs text-amber-400 font-mono whitespace-pre-wrap leading-relaxed">{chartDetail.scale}</code>
                    </div>
                  </div>
                )}
                {chartDetail.insights && chartDetail.insights.length > 0 && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Key Insights</p>
                    <ul className="space-y-2">
                      {chartDetail.insights.map((ins, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                          <span className="text-sky-400 mt-0.5 shrink-0">▸</span>
                          <span className="leading-relaxed">{ins}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Metric Detail Modal ──────────────────────────────────────── */}
        {modalMetric && (
          <div onClick={() => setModalMetric(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div onClick={e => e.stopPropagation()}
              className="bg-white border border-slate-200 rounded-xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl">
              <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                <div className="p-1.5 rounded" style={{ backgroundColor: `${modalMetric.color}18`, color: modalMetric.color }}>
                  <modalMetric.icon size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{modalMetric.label}</p>
                  <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{modalMetric.value}</p>
                </div>
                <button onClick={() => setModalMetric(null)}
                  className="ml-auto text-slate-500 hover:text-slate-900 transition-colors text-lg leading-none">&times;</button>
              </div>
              <div className="p-5 space-y-5">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Description</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{modalMetric.description}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Calculation</p>
                  <div className="bg-white rounded-lg p-3">
                    <code className="text-xs text-emerald-400 font-mono whitespace-pre-wrap">{modalMetric.calculation}</code>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Drill-down Modal ─────────────────────────────────────────── */}
        {pqDrillModal && (
          <PQDrillModal title={pqDrillModal.title} accent={pqDrillModal.accent} onClose={() => setPQDrillModal(null)}>
            <div className="overflow-auto" style={{ maxHeight: '65vh' }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="border-b border-slate-200 bg-white">
                    {pqDrillModal.columns.map(c => (
                      <th key={c.key} className="py-2.5 px-4 text-left text-slate-400 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pqDrillModal.rows.map((row, i) => (
                    <tr key={i} className={i % 2 ? 'bg-transparent' : ''}>
                      {pqDrillModal.columns.map(c => (
                        <td key={c.key} className="py-2.5 px-4 text-slate-700 tabular-nums">
                          {String(row[c.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <ExportBtn onClick={() => downloadCSV(pqDrillModal.rows, `${pqDrillModal.title.replace(/\s+/g, '-').toLowerCase()}.csv`)} />
            </div>
          </PQDrillModal>
        )}

        {/* ─── Slide 4: Magical Script ───────────────────────────────────── */}
        {activeSlide === 4 && (
          <div className="mt-4">
            {magicalLoading ? (
              <div className="flex items-center justify-center h-64 gap-3 text-slate-500 text-sm">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
                Loading Magical Script…
              </div>
            ) : !magicalScript ? (
              <div className="flex items-center justify-center h-64 text-slate-400 text-sm">No script data available for this period.</div>
            ) : magicalScript.variant === 'bellavita' ? (
              <BellavitaMagicalFlow ms={magicalScript} productModalOpen={bellaProductModal} onToggleProductModal={setBellaProductModal} />
            ) : (
              <GenericMagicalFlow ms={magicalScript} canEdit={canEditScripts} onOpenEditor={openScriptEditor} />
            )}
          </div>
        )}

        <MagicalScriptEditorModal
          open={scriptEditorOpen}
          loading={scriptEditorLoading}
          rows={scriptEditorRows}
          objectionOptions={scriptEditorOptions}
          savingId={scriptEditorSavingId}
          onChange={changeScriptRow}
          onSave={saveScriptRow}
          onDelete={deleteScriptRow}
          onAddObjection={addObjectionScriptRow}
          onClose={() => setScriptEditorOpen(false)}
        />

      </div>
    </div>
  );
}
