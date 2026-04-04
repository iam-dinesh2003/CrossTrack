import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const STATUS_STYLES = {
  APPLIED: { color: '#6366F1', label: 'Applied' },
  INTERVIEW: { color: '#10B981', label: 'Interview' },
  OFFER: { color: '#06B6D4', label: 'Offer' },
  REJECTED: { color: '#F43F5E', label: 'Rejected' },
  GHOSTED: { color: '#94A3B8', label: 'Ghosted' },
  WITHDRAWN: { color: '#F59E0B', label: 'Withdrawn' },
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const d = payload[0];
    return (
      <div className="tooltip-premium text-white px-4 py-3 rounded-xl shadow-2xl text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.payload.color }} />
          <p className="font-bold">{d.name}</p>
        </div>
        <p className="text-indigo-300 mt-1 pl-[18px]">{d.value} application{d.value !== 1 ? 's' : ''}</p>
      </div>
    );
  }
  return null;
};

export default function StatusDonut({ statusCounts }) {
  const data = statusCounts && Object.keys(statusCounts).length > 0
    ? Object.entries(statusCounts).map(([name, value]) => ({
        name: STATUS_STYLES[name]?.label || name,
        value,
        color: STATUS_STYLES[name]?.color || '#94A3B8',
      })).filter(d => d.value > 0)
    : [];

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="card-premium p-6">
      <div className="mb-5">
        <h3 className="font-bold text-gray-900 text-[15px] tracking-tight">Status Breakdown</h3>
        <p className="text-[11px] text-gray-400 mt-0.5">Distribution of your applications</p>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center h-[200px] text-gray-400">
          <div className="empty-state-circle w-14 h-14 rounded-2xl flex items-center justify-center mb-3">
            <span className="text-xl">📊</span>
          </div>
          <p className="text-sm font-medium">No applications yet</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}
                  animationBegin={0} animationDuration={800} animationEasing="ease-out">
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{total}</p>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Total</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-default">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: d.color }} />
                <span className="text-[11px] text-gray-600 font-medium truncate">{d.name}</span>
                <span className="text-[11px] text-gray-400 font-bold ml-auto">{d.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
