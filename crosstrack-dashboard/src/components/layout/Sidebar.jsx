import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Briefcase, BarChart3, Ghost, Settings, LogOut, Search, ChevronDown, ChevronRight, Sparkles, Brain, Bell, Target, GraduationCap, FileText } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';

const mainNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
];

const appSubNav = [
  { to: '/applications', label: 'All Applications' },
  { to: '/applications/kanban', label: 'Kanban Board' },
];

const aiSubNav = [
  { to: '/coach', label: 'Career Coach' },
  { to: '/ai/match-score', label: 'Match Score' },
  { to: '/ai/interview-prep', label: 'Interview Prep' },
  { to: '/ai/mock-interview', label: 'Mock Interview' },
  { to: '/ai/interview-notes', label: 'Interview Notes' },
  { to: '/follow-ups', label: 'Follow-Ups' },
  { to: '/resumes', label: 'Resumes' },
];

const otherNav = [
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/ghost-jobs', icon: Ghost, label: 'Ghost Jobs' },
];

export default function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [appsOpen, setAppsOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(true);

  const linkClass = ({ isActive }) => clsx(
    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all mx-3 my-0.5 btn-press',
    isActive
      ? 'bg-gradient-to-r from-indigo-500/15 to-purple-500/10 text-white shadow-lg shadow-indigo-500/5 sidebar-active-indicator'
      : 'text-slate-400 hover:text-white sidebar-link-glow'
  );

  const subLinkClass = ({ isActive }) => clsx(
    'flex items-center gap-2.5 py-2 pl-12 pr-4 text-[13px] rounded-xl mx-3 transition-all btn-press',
    isActive
      ? 'text-indigo-300 bg-white/5 font-medium'
      : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
  );

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[260px] bg-navy-700 flex flex-col z-40 border-r border-white/[0.06]">
      {/* Logo */}
      <div className="px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500/20 rounded-xl blur-lg" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles size={18} className="text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white tracking-tight">CrossTrack</h1>
            <p className="text-[10px] text-indigo-400/60 font-medium tracking-wide">AI Career Platform</p>
          </div>
        </div>
      </div>

      <div className="sidebar-divider mx-4" />

      {/* Search */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white/[0.04] rounded-xl text-slate-500 text-[13px] border border-white/[0.06] hover:border-indigo-500/20 hover:bg-white/[0.06] transition-all cursor-pointer group">
          <Search size={14} className="group-hover:text-indigo-400 transition-colors" />
          <span className="group-hover:text-slate-400 transition-colors">Search...</span>
          <span className="ml-auto text-[10px] bg-white/[0.08] px-1.5 py-0.5 rounded text-slate-500 font-mono">/</span>
        </div>
      </div>

      <div className="flex items-center gap-2 px-6 mb-2">
        <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.15em]">Navigation</p>
        <div className="flex-1 h-px bg-gradient-to-r from-slate-700/50 to-transparent" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-1 relative">
        {mainNav.map(item => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            <item.icon size={18} strokeWidth={1.8} /> {item.label}
          </NavLink>
        ))}

        {/* Applications (expandable) */}
        <button onClick={() => setAppsOpen(!appsOpen)}
          className="flex items-center gap-3 px-4 py-2.5 mx-3 rounded-xl text-[13px] font-medium text-slate-400 hover:text-white sidebar-link-glow w-[calc(100%-24px)] transition-all my-0.5 btn-press">
          <Briefcase size={18} strokeWidth={1.8} /> <span className="flex-1 text-left">Applications</span>
          <div className={clsx('transition-transform duration-200', appsOpen ? 'rotate-0' : '-rotate-90')}>
            <ChevronDown size={14} className="text-slate-600" />
          </div>
        </button>
        <div className={clsx('overflow-hidden transition-all duration-200', appsOpen ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0')}>
          {appSubNav.map(item => (
            <NavLink key={item.to} to={item.to} end className={subLinkClass}>
              {({ isActive }) => (
                <>
                  <span className={clsx('w-1.5 h-1.5 rounded-full transition-all', isActive ? 'bg-indigo-400 shadow-sm shadow-indigo-400/50' : 'bg-slate-700')} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>

        {/* AI Tools (expandable) */}
        <button onClick={() => setAiOpen(!aiOpen)}
          className="flex items-center gap-3 px-4 py-2.5 mx-3 rounded-xl text-[13px] font-medium text-slate-400 hover:text-white sidebar-link-glow w-[calc(100%-24px)] transition-all my-0.5 btn-press">
          <Brain size={18} strokeWidth={1.8} /> <span className="flex-1 text-left">AI Tools</span>
          <span className="text-[8px] bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-2 py-0.5 rounded-full font-bold tracking-wider mr-1 shadow-sm shadow-indigo-500/30">NEW</span>
          <div className={clsx('transition-transform duration-200', aiOpen ? 'rotate-0' : '-rotate-90')}>
            <ChevronDown size={14} className="text-slate-600" />
          </div>
        </button>
        <div className={clsx('overflow-hidden transition-all duration-200', aiOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0')}>
          {aiSubNav.map(item => (
            <NavLink key={item.to} to={item.to} end className={subLinkClass}>
              {({ isActive }) => (
                <>
                  <span className={clsx('w-1.5 h-1.5 rounded-full transition-all', isActive ? 'bg-purple-400 shadow-sm shadow-purple-400/50' : 'bg-slate-700')} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </div>

        <div className="sidebar-divider mx-6 my-2" />

        {otherNav.map(item => (
          <NavLink key={item.to} to={item.to} className={linkClass}>
            <item.icon size={18} strokeWidth={1.8} /> {item.label}
          </NavLink>
        ))}

        {/* Bottom fade overlay */}
        <div className="sticky bottom-0 h-8 bg-gradient-to-t from-navy-700 to-transparent pointer-events-none" />
      </nav>

      {/* Bottom */}
      <div className="sidebar-divider mx-4" />
      <div className="p-3 space-y-1">
        <NavLink to="/settings" className={linkClass}><Settings size={18} strokeWidth={1.8} /> Settings</NavLink>
        <button onClick={() => { logout(); navigate('/login'); }}
          className="flex items-center gap-3 px-4 py-2.5 mx-3 rounded-xl text-[13px] font-medium text-rose-400/60 hover:text-rose-300 hover:bg-rose-500/[0.08] w-[calc(100%-24px)] transition-all btn-press">
          <LogOut size={18} strokeWidth={1.8} /> Log Out
        </button>
      </div>
    </aside>
  );
}
