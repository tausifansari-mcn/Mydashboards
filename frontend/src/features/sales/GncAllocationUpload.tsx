import { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import api from '@/lib/axios';
import UploadLog from './UploadLog';

export default function GncAllocationUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ rowsInserted: number; totalRows: number } | null>(null);
  const [error, setError] = useState('');

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.xlsx') || f.name.endsWith('.xls'))) {
      setFile(f);
      setResult(null);
      setError('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/sales/upload-gnc-allocation', fd, {
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      setResult(res.data.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || (err instanceof Error ? err.message : 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <FileSpreadsheet size={18} className="text-emerald-600" />
        <h2 className="text-sm font-semibold text-slate-800">GNC Allocation Upload</h2>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => document.getElementById('gnc-alloc-input')?.click()}
        className="border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-colors"
      >
        <Upload className="h-10 w-10 mx-auto mb-3 text-slate-400" />
        <p className="text-sm font-semibold text-slate-700 mb-1">Drop allocation file here or click to browse</p>
        <p className="text-xs text-slate-500">Supports .csv, .xlsx, .xls files</p>
        <input
          id="gnc-alloc-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {file && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <FileSpreadsheet className="h-5 w-5 text-emerald-500 shrink-0" />
          <span className="text-sm font-medium text-slate-700 flex-1 truncate">{file.name}</span>
          <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(0)} KB</span>
          <button onClick={() => { setFile(null); setResult(null); }} className="p-1 rounded hover:bg-slate-100">
            <X size={14} className="text-slate-400" />
          </button>
        </div>
      )}

      {file && !result && (
        <div className="mt-4">
          {uploading ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <Loader2 size={16} className="animate-spin text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-800">Uploading... {progress}%</span>
              </div>
              <div className="w-full h-2 bg-emerald-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : (
            <button
              onClick={handleUpload}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
            >
              <Upload size={16} />
              Upload {file.name}
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-800">Upload successful</p>
            <p className="text-emerald-600 text-xs mt-0.5">{result.rowsInserted} of {result.totalRows} rows inserted</p>
          </div>
          <button onClick={() => { setResult(null); setFile(null); }} className="ml-auto p-1 rounded hover:bg-emerald-100">
            <X size={14} className="text-emerald-400" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-red-800">Upload failed</p>
            <p className="text-red-600 text-xs mt-0.5">{error}</p>
          </div>
          <button onClick={() => setError('')} className="ml-auto p-1 rounded hover:bg-red-100">
            <X size={14} className="text-red-400" />
          </button>
        </div>
      )}
      <UploadLog tableName="gnc_allocation" />
    </div>
  );
}
