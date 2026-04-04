import { format } from 'date-fns';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

const statusStyles = {
  APPLIED: { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500' },
  INTERVIEW: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  OFFER: { bg: 'bg-cyan-50', text: 'text-cyan-600', dot: 'bg-cyan-500' },
  REJECTED: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500' },
  GHOSTED: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400' },
  WITHDRAWN: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
};

const platformLogos = {
  LINKEDIN: { emoji: '💼', color: 'from-blue-500 to-blue-600' },
  INDEED: { emoji: '🔍', color: 'from-indigo-500 to-violet-600' },
  HANDSHAKE: { emoji: '🤝', color: 'from-orange-400 to-orange-500' },
  GREENHOUSE: { emoji: '🌿', color: 'from-green-400 to-green-500' },
  OTHER: { emoji: '📋', color: 'from-gray-400 to-gray-500' },
};

export default function RecentApplications({ applications = [] }) {
  const recent = applications.slice(0, 6);

  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-gray-900 text-[15px] tracking-tight">Recent Applications</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Your latest tracked applications</p>
        </div>
        <Link to="/applications" className="flex items-center gap-1.5 text-[11px] text-indigo-500 hover:text-indigo-600 font-semibold transition group px-3 py-1.5 rounded-lg hover:bg-indigo-50/50">
          View All <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {recent.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <div className="empty-state-circle w-16 h-16 rounded-2xl flex items-center justify-center mb-3">
            <span className="text-2xl">📭</span>
          </div>
          <p className="text-sm font-semibold text-gray-500">No applications yet</p>
          <p className="text-xs mt-1 text-gray-400">Start applying and they'll show up here</p>
        </div>
      ) : (
        <div className="space-y-1">
          {recent.map((app) => {
            const s = statusStyles[app.status] || statusStyles.APPLIED;
            const p = platformLogos[app.platform] || platformLogos.OTHER;
            return (
              <div key={app.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50/80 transition-all group cursor-default">
                <div className={clsx('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-sm shadow-sm group-hover:shadow-md transition-shadow', p.color)}>
                  <span>{p.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-800 truncate group-hover:text-indigo-700 transition-colors">{app.role}</p>
                  <p className="text-[11px] text-gray-400 truncate">{app.company}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={clsx('flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full', s.bg, s.text)}>
                    <span className={clsx('w-1.5 h-1.5 rounded-full status-dot-pulse', s.dot)} />
                    {app.status}
                  </span>
                  <span className="text-[10px] text-gray-400 font-medium w-12 text-right tabular-nums">
                    {app.appliedAt ? format(new Date(app.appliedAt), 'MMM d') : ''}
                  </span>
                  {app.url && (
                    <a href={app.url} target="_blank" rel="noopener noreferrer"
                      className="text-gray-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-md hover:bg-indigo-50">
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
