import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="tooltip-premium text-white px-4 py-3 rounded-xl shadow-2xl text-xs">
        <p className="font-bold text-sm">{label}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-2 h-2 rounded-full bg-indigo-400" />
          <p className="text-indigo-300">{payload[0].value} application{payload[0].value !== 1 ? 's' : ''}</p>
        </div>
      </div>
    );
  }
  return null;
};

export default function ApplicationsChart({ weeklyData }) {
  const hasData = weeklyData && weeklyData.length > 0 && weeklyData.some(d => d.applications > 0);
  const totalThisWeek = weeklyData?.reduce((sum, d) => sum + d.applications, 0) || 0;

  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-bold text-gray-900 text-[15px] tracking-tight">Applications This Week</h3>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-[11px] text-gray-400">Daily application activity</p>
            {hasData && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 rounded-full">
                <TrendingUp size={10} className="text-indigo-500" />
                <span className="text-[10px] font-bold text-indigo-600">{totalThisWeek} total</span>
              </div>
            )}
          </div>
        </div>
        <select className="text-[11px] border border-gray-200/80 rounded-lg px-2.5 py-1.5 text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-gray-50/80 font-medium cursor-pointer hover:border-gray-300 transition">
          <option>This Week</option>
          <option>Last Week</option>
          <option>This Month</option>
        </select>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center h-[220px] text-gray-400">
          <div className="empty-state-circle w-16 h-16 rounded-2xl flex items-center justify-center mb-3">
            <BarChart3 size={28} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">No application data yet</p>
          <p className="text-xs mt-1 text-gray-400">Start applying and your chart will appear here</p>
        </div>
      ) : (
        <div className="chart-container rounded-xl p-1">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity={0.15} />
                  <stop offset="50%" stopColor="#818CF8" stopOpacity={0.05} />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8', fontWeight: 500 }} axisLine={false} tickLine={false} dy={8} />
              <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} dx={-8} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#E0E7FF', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="applications" stroke="#6366F1" strokeWidth={2.5} fill="url(#colorApps)"
                dot={{ r: 4, fill: '#6366F1', strokeWidth: 3, stroke: '#fff' }}
                activeDot={{ r: 7, fill: '#6366F1', stroke: '#fff', strokeWidth: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
