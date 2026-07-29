import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, Trash2, AlertCircle, CheckCircle, Clock, RefreshCw, UploadCloud } from 'lucide-react';
import api from '@/lib/axios';
import { useBrandAccent } from './SalesDashboard';

interface LogEntry {
  batchId: string;
  tableName: string;
  fileName: string;
  rowsInserted: number;
  uploadedBy: string;
  uploadedAt: string;
}

interface Props {
  endpoint: string;
  table: string;
  title: string;
}

export function UploadLog({ endpoint, table, title }: Props) {
  const accentColor = useBrandAccent();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; rowsInserted?: number; batchId?: string } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const { data } = await api.get('/sales/upload-logs', { params: { table } });
      setLogs(data.data ?? []);
    } catch { setLogs([]); }
    finally { setLoadingLogs(false); }
  }, [table]);

  // Load upload history as soon as this uploader opens, instead of leaving it empty until the
  // user clicks Refresh or completes an upload.
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setFile(e.dataTransfer.files?.[0] ?? null);
    setResult(null);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post(endpoint, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult({ success: true, message: `Uploaded ${data.data.rowsInserted.toLocaleString()} rows`, rowsInserted: data.data.rowsInserted, batchId: data.data.batchId });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      fetchLogs();
    } catch (err: any) {
      setResult({ success: false, message: err.response?.data?.message ?? err.message ?? 'Upload failed' });
    }
    finally { setUploading(false); }
  };

  const deleteLog = async (batchId: string) => {
    if (!confirm('Delete this upload log and revert its rows?')) return;
    try {
      await api.delete(`/sales/upload-log/${batchId}`, { params: { table } });
      fetchLogs();
    } catch { alert('Failed to delete'); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-[0.06] blur-2xl"
          style={{ background: accentColor }} />
        <div className="relative flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)` }}>
            <UploadCloud className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500">Upload a CSV or Excel file</p>
          </div>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className="relative cursor-pointer flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-9 px-4 transition-all duration-200"
          style={{
            borderColor: dragOver ? accentColor : '#e2e8f0',
            backgroundColor: dragOver ? `${accentColor}0d` : '#f8fafc',
            transform: dragOver ? 'scale(1.01)' : 'scale(1)',
          }}
        >
          <AnimatePresence mode="wait">
            {file ? (
              <motion.div key="file" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3">
                <FileSpreadsheet className="h-8 w-8" style={{ color: accentColor }} />
                <div>
                  <p className="text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                <motion.div animate={{ y: dragOver ? -4 : 0 }} transition={{ type: 'spring', stiffness: 300 }}>
                  <Upload className="h-8 w-8 text-slate-300 mb-2" />
                </motion.div>
                <p className="text-sm font-medium text-slate-500">Drop file here or click to browse</p>
                <p className="text-xs text-slate-400 mt-1">Supports .xlsx, .xls, .csv</p>
              </motion.div>
            )}
          </AnimatePresence>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} className="hidden" />
        </div>

        <AnimatePresence>
          {file && (
            <motion.button
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              onClick={upload} disabled={uploading}
              whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`, boxShadow: `0 8px 20px -8px ${accentColor}80` }}
            >
              {uploading ? <><RefreshCw className="h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4" /> Upload</>}
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ${result.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}
            >
              {result.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{result.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">Upload History</h3>
          <button onClick={fetchLogs} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
            <RefreshCw className={`h-3 w-3 ${loadingLogs ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {loadingLogs && logs.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
            <Clock className="h-4 w-4 mr-2" /> No uploads yet
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            <AnimatePresence initial={false}>
              {logs.map((log) => (
                <motion.div
                  key={log.batchId}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg shrink-0" style={{ backgroundColor: `${accentColor}15` }}>
                      <FileSpreadsheet className="h-3.5 w-3.5" style={{ color: accentColor }} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-700 truncate">{log.fileName}</p>
                      <p className="text-slate-400">{log.rowsInserted.toLocaleString()} rows &middot; {new Date(log.uploadedAt).toLocaleString()} &middot; by {log.uploadedBy}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteLog(log.batchId)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
