import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Loader2 } from 'lucide-react';
import api from '@/lib/axios';
import { AuditLog, LoginLog, PaginatedResponse } from '@/types';
import { formatDate } from '@/lib/utils';

type Tab = 'audit' | 'logins';

export default function AuditPage() {
  const [tab, setTab] = useState<Tab>('audit');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (tab === 'audit') {
        const { data } = await api.get<PaginatedResponse<AuditLog>>('/audit/logs', { params: { limit: 100 } });
        setAuditLogs(data.data);
      } else {
        const { data } = await api.get<PaginatedResponse<LoginLog>>('/audit/login-history', { params: { limit: 100 } });
        setLoginLogs(data.data);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [tab]);

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">Audit Logs</h2>
        <button onClick={fetchData} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 shadow-sm">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {(['audit', 'logins'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-all ${tab === t ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {t === 'audit' ? 'Admin Actions' : 'Login History'}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
        ) : tab === 'audit' ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Time', 'User', 'Action', 'Entity', 'ID'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log, i) => (
                <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(log.created_at)}</td>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-800 text-xs">{log.user.name}</p><p className="text-xs text-slate-500">{log.user.email}</p></td>
                  <td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-mono font-semibold text-blue-700">{log.action}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-600">{log.entity_type || '—'}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-600">{log.entity_id || '—'}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {['Time', 'User', 'IP Address', 'Status', 'Browser'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loginLogs.map((log, i) => (
                <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(log.logged_at)}</td>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-800 text-xs">{log.user.name}</p><p className="text-xs text-slate-500">{log.user.email}</p></td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.ip_address}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate">{log.user_agent || '—'}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
