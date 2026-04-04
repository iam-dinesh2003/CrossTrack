import clsx from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';

const colorMap = {
  purple: {
    gradient: 'from-indigo-500 to-purple-600',
    shadow: 'shadow-indigo-500/25',
  },
  blue: {
    gradient: 'from-blue-500 to-cyan-500',
    shadow: 'shadow-blue-500/25',
  },
  green: {
    gradient: 'from-emerald-500 to-teal-500',
    shadow: 'shadow-emerald-500/25',
  },
  orange: {
    gradient: 'from-amber-500 to-orange-500',
    shadow: 'shadow-amber-500/25',
  },
  red: {
    gradient: 'from-rose-500 to-pink-500',
    shadow: 'shadow-rose-500/25',
  },
};

export default function StatCard({ title, value, change, icon: Icon, color = 'purple' }) {
  const c = colorMap[color] || colorMap.purple;

  return (
    <div className="card-premium p-5 group stat-shimmer">
      <div className={clsx('absolute top-0 left-6 right-6 h-[2px] rounded-b-full bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500', c.gradient)} />
      <div className={clsx('absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500 bg-gradient-to-br rounded-2xl', c.gradient)} />

      <div className="flex items-start justify-between relative">
        <div className="space-y-1">
          <p className="text-[12px] text-gray-400 font-medium uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-extrabold text-gray-900 tracking-tight animate-count">{value}</p>
          {change !== undefined && (
            <div className={clsx('flex items-center gap-1.5 mt-1', change >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
              <div className={clsx('flex items-center justify-center w-5 h-5 rounded-md', change >= 0 ? 'bg-emerald-50' : 'bg-rose-50')}>
                {change >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              </div>
              <span className="text-[11px] font-semibold">{Math.abs(change)}% from last week</span>
            </div>
          )}
        </div>
        <div className={clsx('p-3 rounded-xl bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:scale-105 group-hover:shadow-xl', c.gradient, c.shadow)}>
          <Icon size={20} className="text-white" strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}
