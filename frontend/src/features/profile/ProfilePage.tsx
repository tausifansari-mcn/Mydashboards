import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, KeyRound, User, Mail, CheckCircle2, XCircle, Camera, ServerCog, Bot } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getInitials, formatDate } from '@/lib/utils';
import api from '@/lib/axios';

interface SmtpStatus {
  host: string | null;
  user: string | null;
  usingStoredPassword: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
}

interface AiStatus {
  provider: string;
  model: string;
  enabled: boolean;
  keySource: 'stored' | 'env' | 'none';
  keyPreview: string | null;
  baseUrl: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [testTo, setTestTo] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [smtpStatus, setSmtpStatus] = useState<SmtpStatus | null>(null);
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpResult, setSmtpResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiProvider, setAiProvider] = useState<'anthropic' | 'openai-compatible'>('anthropic');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user?.role !== 'super_admin') return;
    api.get<SmtpStatus>('/settings/smtp-status').then((r) => setSmtpStatus(r.data)).catch(() => {});
    api.get<AiStatus>('/settings/ai-status').then((r) => setAiStatus(r.data)).catch(() => {});
  }, [user?.role]);

  const handleUpdateAiSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setAiLoading(true); setAiResult(null);
    try {
      await api.put('/settings/ai-settings', {
        provider: aiProvider,
        apiKey: aiApiKey,
        model: aiModel.trim() || undefined,
        baseUrl: aiProvider === 'openai-compatible' ? aiBaseUrl.trim() : undefined,
      });
      setAiResult({ type: 'success', text: 'CAM BOT key updated and verified — it will use it for the next message.' });
      setAiApiKey('');
      api.get<AiStatus>('/settings/ai-status').then((r) => setAiStatus(r.data)).catch(() => {});
    } catch (err: unknown) {
      const m = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setAiResult({ type: 'error', text: m || 'Failed to update AI settings' });
    } finally { setAiLoading(false); }
  };

  const handleUpdateSmtpPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmtpLoading(true); setSmtpResult(null);
    try {
      await api.put('/settings/smtp-password', { password: smtpPassword });
      setSmtpResult({ type: 'success', text: 'SMTP password updated and verified — reports will send using it now.' });
      setSmtpPassword('');
      api.get<SmtpStatus>('/settings/smtp-status').then((r) => setSmtpStatus(r.data)).catch(() => {});
    } catch (err: unknown) {
      const m = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSmtpResult({ type: 'error', text: m || 'Failed to update SMTP password' });
    } finally { setSmtpLoading(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'Photo must be under 2 MB' });
      return;
    }
    setPhotoUploading(true);
    setMsg(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await api.patch('/auth/avatar', { avatar_url: dataUrl });
      setUser({ ...user!, avatar_url: dataUrl });
      setMsg({ type: 'success', text: 'Profile photo updated' });
    } catch {
      setMsg({ type: 'error', text: 'Failed to upload photo' });
    } finally {
      setPhotoUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestLoading(true); setTestResult(null);
    try {
      const res = await api.post<{ message: string }>('/auth/send-test-email', { to: testTo });
      setTestResult({ type: 'success', text: res.data.message });
    } catch (err: unknown) {
      const m = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setTestResult({ type: 'error', text: m || 'Failed to send email' });
    } finally { setTestLoading(false); }
  };

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
            {/* Avatar with upload button */}
            <div className="relative flex-shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="h-16 w-16 rounded-2xl object-cover shadow-lg"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-white shadow-lg shadow-primary/25">
                  {getInitials(user?.name || 'U')}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={photoUploading}
                className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md border border-slate-200 hover:bg-blue-50 transition-colors disabled:opacity-70"
                title="Change photo"
              >
                {photoUploading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-600" />
                  : <Camera className="h-3.5 w-3.5 text-slate-600" />
                }
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{user?.name}</h2>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <p className="text-xs text-slate-400 mt-0.5">Click the camera icon to update your photo</p>
            </div>
          </div>

          {/* Feedback message (shared between password & photo) */}
          {msg && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className={`mt-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${msg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {msg.type === 'success'
                ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              {msg.text}
            </motion.div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-4">
            {[
              { label: 'Role', value: user?.roleDisplay, icon: User },
              { label: 'Client', value: user?.clientName || 'All Process', icon: User },
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

        {/* SMTP Password — super_admin only */}
        {user?.role === 'super_admin' && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ServerCog className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-slate-800">SMTP Password</h3>
              <span className="ml-auto rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-200">Admin</span>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              If scheduled reports or account emails stop sending (usually because the mail provider's app password expired or was rotated), update it here — it takes effect immediately, no redeploy needed.
            </p>
            {smtpStatus && (
              <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-0.5">
                <p><span className="font-semibold text-slate-700">Account:</span> {smtpStatus.user || '—'} @ {smtpStatus.host || '—'}</p>
                <p><span className="font-semibold text-slate-700">Password source:</span> {smtpStatus.usingStoredPassword ? 'Saved from this page' : 'Server .env default'}</p>
                {smtpStatus.updatedAt && (
                  <p><span className="font-semibold text-slate-700">Last updated:</span> {formatDate(smtpStatus.updatedAt)} by {smtpStatus.updatedByName || '—'}</p>
                )}
              </div>
            )}
            {smtpResult && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className={`mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${smtpResult.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {smtpResult.type === 'success'
                  ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                {smtpResult.text}
              </motion.div>
            )}
            <form onSubmit={handleUpdateSmtpPassword} className="flex gap-3">
              <input
                type="password"
                placeholder="New SMTP / app password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                required
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <motion.button type="submit" disabled={smtpLoading} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-70">
                {smtpLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ServerCog className="h-4 w-4" /> Update</>}
              </motion.button>
            </form>
          </div>
        )}

        {/* SMTP Test — super_admin only */}
        {user?.role === 'super_admin' && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-slate-800">Send Test Email</h3>
              <span className="ml-auto rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-200">Admin</span>
            </div>
            <p className="mb-4 text-xs text-slate-500">Verify that SMTP is correctly configured by sending a test welcome email to any address.</p>
            {testResult && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className={`mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${testResult.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {testResult.type === 'success'
                  ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                {testResult.text}
              </motion.div>
            )}
            <form onSubmit={handleSendTest} className="flex gap-3">
              <input
                type="email"
                placeholder="recipient@example.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                required
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <motion.button type="submit" disabled={testLoading} whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-70">
                {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Mail className="h-4 w-4" /> Send</>}
              </motion.button>
            </form>
          </div>
        )}

        {/* CAM BOT API Key — super_admin only */}
        {user?.role === 'super_admin' && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-slate-800">CAM BOT — AI Provider Key</h3>
              <span className="ml-auto rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 border border-blue-200">Admin</span>
            </div>
            <p className="mb-4 text-xs text-slate-500">
              CAM BOT (the AI Copilot) needs an API key to reason over your data. Update it here if the current key
              is rotated, expired, or you want to switch providers — it takes effect immediately, no redeploy needed.
            </p>
            {aiStatus && (
              <div className="mb-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-600 space-y-0.5">
                <p><span className="font-semibold text-slate-700">Provider:</span> {aiStatus.provider} &middot; <span className="font-semibold text-slate-700">Model:</span> {aiStatus.model}</p>
                {aiStatus.baseUrl && <p><span className="font-semibold text-slate-700">Base URL:</span> {aiStatus.baseUrl}</p>}
                <p>
                  <span className="font-semibold text-slate-700">Status:</span>{' '}
                  {aiStatus.enabled
                    ? <span className="text-green-700">Active{aiStatus.keyPreview ? ` — key ending in ...${aiStatus.keyPreview}` : ''}</span>
                    : <span className="text-red-600">No key configured — CAM BOT will only answer with raw data, no reasoning</span>}
                </p>
                <p><span className="font-semibold text-slate-700">Key source:</span> {aiStatus.keySource === 'stored' ? 'Saved from this page' : aiStatus.keySource === 'env' ? 'Server .env default' : 'None'}</p>
                {aiStatus.updatedAt && (
                  <p><span className="font-semibold text-slate-700">Last updated:</span> {formatDate(aiStatus.updatedAt)} by {aiStatus.updatedByName || '—'}</p>
                )}
              </div>
            )}
            {aiResult && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className={`mb-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${aiResult.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {aiResult.type === 'success'
                  ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  : <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                {aiResult.text}
              </motion.div>
            )}
            <form onSubmit={handleUpdateAiSettings} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value as 'anthropic' | 'openai-compatible')}
                  className="sm:w-56 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai-compatible">OpenAI-compatible (custom)</option>
                </select>
                <input
                  type="password"
                  placeholder={aiProvider === 'anthropic' ? 'New API key (sk-ant-...)' : 'New API key'}
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  required
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <input
                  type="text"
                  placeholder={aiProvider === 'anthropic' ? 'Model (optional, e.g. claude-haiku-4-5-20251001)' : 'Model (e.g. gpt-4o-mini, llama-3.1-70b)'}
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="sm:w-64 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
              {aiProvider === 'openai-compatible' && (
                <input
                  type="text"
                  placeholder="Base URL — the provider's API endpoint, e.g. https://api.example.com/v1"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              )}
              <motion.button type="submit" disabled={aiLoading} whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-70">
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Bot className="h-4 w-4" /> Update</>}
              </motion.button>
            </form>
          </div>
        )}

        {/* Change password */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-slate-800">Change Password</h3>
          </div>
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
