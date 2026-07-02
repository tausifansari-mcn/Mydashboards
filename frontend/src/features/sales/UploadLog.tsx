import { useState, useEffect } from 'react';
import { Clock, Trash2, Loader2, AlertCircle } from 'lucide-react';
import api from '@/lib/axios';

interface LogEntry {
  id: number;
  batch_id: string;
  table_name: string;
  file_name: string;
  row_count: number;
  uploaded_by: number;
  uploaded_at: string;
}

interface Props {
  tableName: string;
  onDeleted?: () => void;
}

export default function UploadLog({ tableName, onDeleted }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sales/upload-logs', { params: { table: tableName } });
      setLogs(data.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [tableName]);

  const handleDelete = async (batchId: string) => {
    setDeleting(batchId);
    try {
      await api.delete(`/sales/upload-log/${batchId}`, { params: { table: tableName } });
      setLogs(prev => prev.filter(l => l.batch_id !== batchId));
      onDeleted?.();
    } catch { /* ignore */ }
    setDeleting(null);
    setConfirm(null);
  };

  if (loading) return null;

  return (
    <div className="mt-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={15} className="text-slate-400" />
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Upload History</h3>
      </div>

      {logs.length === 0 && (
        <p className="text-xs text-slate-400 italic">No uploads yet</p>
      )}

      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {logs.map(entry => (
          <div key={entry.batch_id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-700 truncate">{entry.file_name || 'Unknown file'}</p>
              <p className="text-slate-400">
                {entry.row_count} rows &middot; {formatDate(entry.uploaded_at)}
              </p>
            </div>

            {confirm === entry.batch_id ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleDelete(entry.batch_id)}
                  disabled={deleting === entry.batch_id}
                  className="rounded-md bg-red-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {deleting === entry.batch_id ? <Loader2 size={12} className="animate-spin" /> : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirm(null)}
                  className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirm(entry.batch_id)}
                className="p-1.5 rounded-md text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors shrink-0"
                title="Delete this upload"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(d: string) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
