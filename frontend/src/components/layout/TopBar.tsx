import { Bell } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getInitials } from '@/lib/utils';

export default function TopBar({ title }: { title?: string }) {
  const { user } = useAuthStore();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-lg font-bold text-slate-800">{title || 'My Dashboard'}</h1>
      <div className="flex items-center gap-3">
        <button className="relative rounded-lg p-2 hover:bg-slate-100 transition-colors">
          <Bell className="h-5 w-5 text-slate-500" />
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {getInitials(user?.name || 'U')}
          </div>
          <div className="text-left">
            <p className="text-xs font-semibold text-slate-800 leading-none">{user?.name}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{user?.roleDisplay}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
