import { useState, useEffect, useRef, useCallback } from 'react';
import { FileSearch, Link2, Sparkles, Loader2, AlertCircle, X, Layers, FileText } from 'lucide-react';
import api from '@/lib/axios';
import { AuditReport } from './AuditReport';
import { AuditHistoryPanel } from './AuditHistoryPanel';
import type { CallAuditFormValues, CallAuditRecord, CallAuditHistoryItem } from './types';

const EMPTY_FORM: CallAuditFormValues = { recordingUrl: '', processName: '', lob: '', agentName: '', masId: '', prompt: '' };

const PROMPT_PLACEHOLDER = `e.g. Check whether the agent followed the standard opening, handled the pricing objection correctly, and whether the BellaCash redemption terms were explained accurately. Flag any rude or unprofessional language.`;

const LOADING_STAGES = [
  'Downloading the recording…',
  'Transcribing the call (Deepgram)…',
  'Running the QA audit…',
  'Putting the report together…',
];

interface BulkItemResult {
  index: number;
  recordingUrl: string;
  record?: CallAuditRecord;
  error?: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputClass = 'w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 transition-all';

export default function CallAuditPage() {
  const [form, setForm] = useState<CallAuditFormValues>(EMPTY_FORM);
  const [bulkUrls, setBulkUrls] = useState('');
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<CallAuditRecord | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkItemResult[] | null>(null);
  const [history, setHistory] = useState<CallAuditHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadHistory = useCallback(() => {
    setHistoryLoading(true);
    api.get<{ data: CallAuditHistoryItem[] }>('/call-audit/history')
      .then(r => setHistory(r.data?.data ?? []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => () => { if (stageTimer.current) clearInterval(stageTimer.current); }, []);

  const set = (key: keyof CallAuditFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const parsedUrls = bulkUrls.split(/\r?\n/).map(u => u.trim()).filter(Boolean);

  const isValid = form.processName.trim() && form.lob.trim() && form.agentName.trim() && form.masId.trim()
    && (mode === 'single' ? form.recordingUrl.trim() : parsedUrls.length > 0);

  const startStageTimer = () => {
    if (stageTimer.current) clearInterval(stageTimer.current);
    stageTimer.current = setInterval(() => setLoadingStage(s => Math.min(s + 1, LOADING_STAGES.length - 1)), 7000);
  };

  const runAudit = async () => {
    if (!isValid || loading) return;
    setError(null);
    setLoading(true);
    setLoadingStage(0);
    startStageTimer();
    try {
      const { data } = await api.post<{ success: boolean; data: CallAuditRecord }>('/call-audit/run', form);
      setRecord(data.data);
      loadHistory();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Something went wrong running this audit. Please try again.');
    } finally {
      if (stageTimer.current) clearInterval(stageTimer.current);
      setLoading(false);
    }
  };

  const runBulkAudit = async () => {
    if (!isValid || loading) return;
    setError(null);
    setLoading(true);
    setLoadingStage(0);
    startStageTimer();
    try {
      const { data } = await api.post<{ success: boolean; data: BulkItemResult[] }>('/call-audit/run-bulk', {
        recordingUrls: parsedUrls,
        processName: form.processName, lob: form.lob, agentName: form.agentName, masId: form.masId, prompt: form.prompt,
      });
      setBulkResults(data.data);
      setRecord(null);
      loadHistory();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Something went wrong running the bulk audit. Please try again.');
    } finally {
      if (stageTimer.current) clearInterval(stageTimer.current);
      setLoading(false);
    }
  };

  const openHistoryItem = async (id: number) => {
    setError(null);
    try {
      const { data } = await api.get<{ data: CallAuditRecord }>(`/call-audit/${id}`);
      setRecord(data.data);
      setBulkResults(null);
      setForm({
        recordingUrl: data.data.recordingUrl, processName: data.data.processName, lob: data.data.lob,
        agentName: data.data.agentName, masId: data.data.masId, prompt: data.data.prompt,
      });
    } catch {
      setError('Could not load that audit — it may have been removed.');
    }
  };

  const newAudit = () => { setRecord(null); setBulkResults(null); setForm(EMPTY_FORM); setBulkUrls(''); setError(null); };

  const total = parsedUrls.length;
  const doneCount = (bulkResults ?? []).filter(r => r.record || r.error).length;
  const successCount = (bulkResults ?? []).filter(r => r.record).length;
  const failCount = (bulkResults ?? []).filter(r => r.error).length;

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm" style={{ background: 'linear-gradient(135deg, #1565C0, #0D47A1)' }}>
          <FileSearch className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">Call Audit Instant</h1>
          <p className="text-xs text-slate-500">Paste a recording link, get an instant AI-powered QA audit with full transcript</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 items-start">
        <div>
          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
            </div>
          )}

          {!record && !bulkResults && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="flex rounded-lg overflow-hidden border border-slate-200 text-xs font-bold">
                  <button onClick={() => setMode('single')} className={`px-3.5 py-1.5 flex items-center gap-1.5 transition-colors ${mode === 'single' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`} style={mode === 'single' ? { background: '#1565C0' } : { background: '#fff' }}>
                    <FileText size={13} /> Single
                  </button>
                  <button onClick={() => setMode('bulk')} className={`px-3.5 py-1.5 flex items-center gap-1.5 transition-colors ${mode === 'bulk' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`} style={mode === 'bulk' ? { background: '#1565C0' } : { background: '#fff' }}>
                    <Layers size={13} /> Bulk
                  </button>
                </div>
                {mode === 'bulk' && total > 0 && (
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1">
                    {total} recording{total === 1 ? '' : 's'}
                  </span>
                )}
              </div>

              {mode === 'single' ? (
                <Field label="Call Recording URL">
                  <div className="relative">
                    <Link2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="url" value={form.recordingUrl} onChange={set('recordingUrl')}
                      placeholder="Paste the call recording link (e.g. http://.../recording.mp3)"
                      className={`${inputClass} pl-9`} />
                  </div>
                </Field>
              ) : (
                <Field label="Call Recording URLs (one per line)">
                  <textarea value={bulkUrls} onChange={e => setBulkUrls(e.target.value)} rows={6}
                    placeholder={'Paste one recording URL per line, e.g.\nhttp://.../recording-1.mp3\nhttp://.../recording-2.mp3\nhttp://.../recording-3.mp3'}
                    className={`${inputClass} resize-none font-mono text-xs`} />
                  <p className="text-[10px] text-slate-400 mt-1.5">All recordings below share the same Process / LOB / Agent / MAS ID / prompt. Runs on up to 20 at a time.</p>
                </Field>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                <Field label="Process Name">
                  <input value={form.processName} onChange={set('processName')} placeholder="e.g. Bellavita" className={inputClass} />
                </Field>
                <Field label="LOB">
                  <input value={form.lob} onChange={set('lob')} placeholder="e.g. Outbound" className={inputClass} />
                </Field>
                <Field label="Agent Name">
                  <input value={form.agentName} onChange={set('agentName')} placeholder="e.g. Priya Sharma" className={inputClass} />
                </Field>
                <Field label="MAS ID">
                  <input value={form.masId} onChange={set('masId')} placeholder="e.g. MAS59063" className={inputClass} />
                </Field>
              </div>

              <div className="mt-4">
                <Field label="Audit Prompt (what should CAM BOT check for?)">
                  <textarea value={form.prompt} onChange={set('prompt')} rows={4} placeholder={PROMPT_PLACEHOLDER}
                    className={`${inputClass} resize-none`} />
                </Field>
                <p className="text-[10px] text-slate-400 mt-1.5">Leave blank for a full general QA audit (opening, compliance, objection handling, professionalism, closing).</p>
              </div>

              <button onClick={mode === 'single' ? runAudit : runBulkAudit} disabled={!isValid}
                className="mt-5 w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #1565C0, #0D47A1)' }}>
                <Sparkles size={15} /> {mode === 'single' ? 'Run Audit' : `Run ${total || ''} Audit${total === 1 ? '' : 's'}`}
              </button>
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 flex flex-col items-center justify-center text-center">
              <Loader2 size={28} className="text-blue-500 animate-spin mb-4" />
              <p className="text-sm font-bold text-slate-700">{mode === 'bulk' ? `Auditing ${doneCount + 1} of ${total}…` : LOADING_STAGES[loadingStage]}</p>
              <p className="text-xs text-slate-400 mt-1.5">This can take up to a minute per call — please don't close this tab.</p>
            </div>
          )}

          {bulkResults && !loading && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-sm font-black text-slate-800">Bulk Audit Results</h2>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2.5 py-0.5">{successCount} passed</span>
                {failCount > 0 && (
                  <span className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-100 rounded-full px-2.5 py-0.5">{failCount} failed</span>
                )}
                <button onClick={newAudit} className="ml-auto text-[11px] font-bold text-blue-600 hover:text-blue-800">New Audit</button>
              </div>

              <div className="space-y-2.5">
                {bulkResults.map(r => {
                  if (r.record) {
                    return (
                      <button key={r.index} onClick={() => setRecord(r.record!)}
                        className="w-full flex items-center gap-3 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-left hover:border-emerald-300 transition-colors">
                        <span className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg text-xs font-black"
                          style={{ background: r.record.result.overallScore >= 85 ? '#DCFCE7' : r.record.result.overallScore >= 65 ? '#DBEAFE' : r.record.result.overallScore >= 45 ? '#FEF3C7' : '#FEE2E2', color: r.record.result.overallScore >= 85 ? '#15803D' : r.record.result.overallScore >= 65 ? '#1D4ED8' : r.record.result.overallScore >= 45 ? '#B45309' : '#B91C1C' }}>
                          {r.record.result.overallScore}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{r.record.agentName} · {r.record.masId}</p>
                          <p className="text-[10.5px] text-slate-500 truncate">{r.recordingUrl}</p>
                        </div>
                        <span className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: r.record.result.verdict === 'Excellent' ? '#DCFCE7' : r.record.result.verdict === 'Good' ? '#DBEAFE' : r.record.result.verdict === 'Needs Improvement' ? '#FEF3C7' : '#FEE2E2', color: r.record.result.verdict === 'Excellent' ? '#15803D' : r.record.result.verdict === 'Good' ? '#1D4ED8' : r.record.result.verdict === 'Needs Improvement' ? '#B45309' : '#B91C1C' }}>
                          {r.record.result.verdict}
                        </span>
                        <span className="shrink-0 text-[10px] font-bold text-blue-600">View →</span>
                      </button>
                    );
                  }
                  return (
                    <div key={r.index} className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/60 px-4 py-3">
                      <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-red-700 truncate">{r.recordingUrl}</p>
                        <p className="text-[10.5px] text-red-600 mt-0.5">{r.error}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {record && !loading && <AuditReport record={record} onNewAudit={newAudit} />}
        </div>

        <AuditHistoryPanel items={history} loading={historyLoading} onOpen={openHistoryItem} />
      </div>
    </div>
  );
}
