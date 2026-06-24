import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '@/lib/axios';

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      navigate('/login', { state: { message: 'Password reset successful. Please login.' } });
    } catch {
      setError('Invalid or expired reset link. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1e3a8a] via-[#1E40AF] to-[#1d4ed8] p-4">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <Link to="/login" className="mb-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
        <h2 className="mb-1 text-xl font-bold text-slate-800">Reset Password</h2>
        <p className="mb-6 text-sm text-slate-500">Choose a new password for your account.</p>
        {error && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {[{ label: 'New Password', value: password, onChange: setPassword }, { label: 'Confirm Password', value: confirm, onChange: setConfirm }].map((field) => (
            <div key={field.label}>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">{field.label}</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={field.value} onChange={(e) => field.onChange(e.target.value)} required placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
          <motion.button type="submit" disabled={loading} whileTap={{ scale: 0.97 }}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 hover:bg-primary-dark disabled:opacity-70">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reset Password'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
