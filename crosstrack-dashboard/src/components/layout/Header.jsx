import { useAuth } from '../../context/AuthContext';
import { Bell, Command, Menu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import followUpService from '../../services/followUpService';

export default function Header({ title, subtitle, onMenuClick }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: followUps = [] } = useQuery({
    queryKey: ['followUps', 'active'],
    queryFn: () => followUpService.getFollowUps('active'),
    refetchInterval: 60000,
  });
  const pendingCount = followUps.filter(f => f.status === 'PENDING').length;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <header className="fixed top-0 left-0 md:left-[260px] right-0 h-[68px] header-frosted flex items-center justify-between px-4 sm:px-8 z-30">
      {/* Bottom border gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-200/80 to-transparent" />

      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl transition-all"
          aria-label="Open menu">
          <Menu size={20} />
        </button>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">{title || 'Dashboard'}</h2>
          {subtitle && <p className="hidden sm:block text-[11px] text-gray-400 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Date */}
        <span className="hidden lg:block text-[11px] text-gray-400 font-medium tracking-wide">{dateStr}</span>

        <div className="hidden lg:block w-px h-5 bg-gray-200/80" />

        {/* Command palette hint */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50/80 rounded-lg text-[11px] text-gray-400 border border-gray-100/80 hover:border-gray-200 transition cursor-pointer">
          <Command size={12} /> <span className="font-medium">K</span>
        </div>

        <button onClick={() => navigate('/follow-ups')}
          className="relative p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-xl transition-all"
          title={pendingCount > 0 ? `${pendingCount} pending follow-ups` : 'No pending follow-ups'}>
          <Bell size={18} />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[9px] font-bold rounded-full ring-2 ring-white flex items-center justify-center shadow-sm shadow-rose-200">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>

        <div className="w-px h-8 bg-gray-100/80 mx-1" />

        <div className="flex items-center gap-3 pl-1 group cursor-pointer" onClick={() => navigate('/settings')}>
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-sm" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20">
              {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="hidden sm:block">
            <p className="text-[13px] font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">{user?.displayName || 'User'}</p>
            <p className="text-[11px] text-gray-400">{user?.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
