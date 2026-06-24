import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, KeyRound, User } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getInitials, formatDate } from '@/lib/utils';
import api from '@/lib/axios';

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setMsg({ type: 'error', text: 'New passwords do not match' }); return; }
    if (newPw.length < 8) { setMsg({ type: 'error', text: 'Password must be at least 8 characters' }); return; }
    setLoading(true); setMsg(null);
    try {
      await api.patch('/auth/change-password', { oldPassword: oldPw, newPassword: newPw });
      setMsg({ type: 'success', text: 'Password changed successfully' });
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: unknown) {
      const m = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setMsg({ type: 'error', text: m || 'Failed to change password' });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 max-w-2xl">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Profile card */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white shadow-lg shadow-primary/25">
              {getInitials(user?.name || 'U')}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{user?.name}</h2>
              <p className="text-sm text-slate-500">{user?.email}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            {[
              { label: 'Role', value: user?.roleDisplay, icon: User },
              { label: 'Client', value: user?.clientName || 'All Clients', icon: User },
              { label: 'Last Login', value: user?.lastLogin ? formatDate(user.lastLogin) : '—', icon: User },
              { label: 'Account Status', value: 'Active', icon: User },
            ].map((f) => (
              <div key={f.label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{f.label}</p>
                <p className="mt-1 font-semibold text-slate-800">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Change password */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-slate-800">Change Password</h3>
          </div>
          {msg && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className={`mb-4 rounded-lg px-4 py-3 text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {msg.text}
            </motion.div>
          )}
          <form onSubmit={handleChangePassword} className="space-y-4">
            {[
              { label: 'Current Password', value: oldPw, onChange: setOldPw },
              { label: 'New Password', value: newPw, onChange: setNewPw },
              { label: 'Confirm New Password', value: confirmPw, onChange: setConfirmPw },
            ].map((f) => (
              <div key={f.label}>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">{f.label}</label>
                <input type="password" value={f.value} onChange={(e) => f.onChange(e.target.value)} required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
              </div>
            ))}
            <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark disabled:opacity-70">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
