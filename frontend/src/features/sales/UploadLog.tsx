import { useState, useRef, useCallback } from 'react';
import { Upload, FileSpreadsheet, Trash2, AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
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
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; rowsInserted?: number; batchId?: string } | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const { data } = await api.get('/sales/upload-logs', { params: { table } });
      setLogs(data.data ?? []);
    } catch { setLogs([]); }
    finally { setLoadingLogs(false); }
  }, [table]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
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
      setResult({ success: true, message: `Uploaded ${data.data.rowsInserted} rows (batch: ${data.data.batchId})`, rowsInserted: data.data.rowsInserted, batchId: data.data.batchId });
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
      await api.delete(`/sales/upload-log/${batchId}`);
      fetchLogs();
    } catch { alert('Failed to delete'); }
  };

  const btnBg = { backgroundColor: accentColor };
  const btnHover = { backgroundColor: accentColor + 'dd' };
  const dropBorder = { borderColor: accentColor + '40', ['--hover-border' as string]: accentColor };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900 mb-1">{title}</h2>
        <p className="text-xs text-slate-500 mb-4">Upload a CSV or Excel file</p>

        <div
          onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="cursor-pointer flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 px-4 transition-colors"
          onMouseEnter={e => { e.currentTarget.style.borderColor = accentColor; e.currentTarget.style.backgroundColor = `${accentColor}08`; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
        >
          {file ? (
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8" style={{ color: accentColor }} />
              <div>
                <p className="text-sm font-medium text-slate-800">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-500">Drop file here or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">Supports .xlsx, .xls, .csv</p>
            </>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFileChange} className="hidden" />
        </div>

        {file && (
          <button onClick={upload} disabled={uploading}
            className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            style={btnBg}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = accentColor + 'dd'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = accentColor}
          >
            {uploading ? <><RefreshCw className="h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="h-4 w-4" /> Upload</>}
          </button>
        )}

        {result && (
          <div className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-sm ${result.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {result.success ? <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span>{result.message}</span>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">Upload History</h3>
          <button onClick={fetchLogs} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
            <RefreshCw className={`h-3 w-3 ${loadingLogs ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
        {loadingLogs ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
            <Clock className="h-4 w-4 mr-2" /> No uploads yet
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logs.map((log) => (
              <div key={log.batchId} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <p className="font-medium text-slate-700 truncate">{log.fileName}</p>
                  <p className="text-slate-400">{log.rowsInserted} rows &middot; {new Date(log.uploadedAt).toLocaleString()} &middot; by {log.uploadedBy}</p>
                </div>
                <button onClick={() => deleteLog(log.batchId)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
