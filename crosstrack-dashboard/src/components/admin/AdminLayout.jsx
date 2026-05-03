import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, Settings,
  LogOut, ShieldCheck, ChevronRight
} from 'lucide-react';
import clsx from 'clsx';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
];

function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.replace('/admin', '').split('/').filter(Boolean);
  const crumbs = [{ label: 'Admin', to: '/admin' }];
  if (parts[0] === 'users') {
    crumbs.push({ label: 'Users', to: '/admin/users' });
    if (parts[1]) crumbs.push({ label: `User #${parts[1]}`, to: null });
  } else if (parts[0] === 'applications') {
    crumbs.push({ label: 'Applications', to: null });
  }
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-slate-500">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={11} className="text-slate-700" />}
          {c.to && i < crumbs.length - 1
            ? <NavLink to={c.to} className="hover:text-slate-300 transition-colors">{c.label}</NavLink>
            : <span className="text-slate-400 font-medium">{c.label}</span>}
        </span>
      ))}
    </div>
  );
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }) => clsx(
    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
    isActive
      ? 'bg-indigo-600 text-white shadow-sm'
      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
  );

  return (
    <div className="min-h-screen flex bg-[#0f1117]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[#13151d] border-r border-white/[0.06] flex flex-col">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <ShieldCheck size={14} className="text-white" />
            </div>
            <div>
              <div className="text-[13px] font-bold text-white leading-none">CrossTrack</div>
              <div className="text-[10px] text-indigo-400/60 mt-0.5 font-medium tracking-wide">ADMIN</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 pt-2 pb-1">
            Overview
          </div>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              <item.icon size={15} strokeWidth={1.8} />
              {item.label}
            </NavLink>
          ))}

          <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest px-3 pt-4 pb-1">
            System
          </div>
          <NavLink to="/dashboard" className={clsx(linkClass({ isActive: false }), 'text-slate-500')}>
            <Settings size={15} strokeWidth={1.8} />
            Back to App
          </NavLink>
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-white/[0.06] space-y-1">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {(user?.displayName || user?.email || 'A').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-white font-medium truncate">{user?.displayName}</div>
              <div className="text-[10px] text-amber-400/80">Administrator</div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-[13px] font-medium text-rose-400/70 hover:text-rose-300 hover:bg-rose-500/[0.08] transition-all">
            <LogOut size={15} strokeWidth={1.8} /> Log Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-11 border-b border-white/[0.06] bg-[#13151d] flex items-center px-5">
          <Breadcrumbs />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
