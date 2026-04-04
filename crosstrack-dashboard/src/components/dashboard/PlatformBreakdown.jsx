import { useState } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import {
  groupPlatformCounts, GROUP_COLORS,
  getPlatformLabel, getPlatformColor,
} from '../../utils/platformUtils';

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="tooltip-premium text-white px-4 py-3 rounded-xl shadow-2xl text-xs">
        <p className="font-bold">{payload[0].payload.platform}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
          <p className="text-indigo-300">{payload[0].value} application{payload[0].value !== 1 ? 's' : ''}</p>
        </div>
      </div>
    );
  }
  return null;
};

export default function PlatformBreakdown({ platformCounts }) {
  const [showDetailed, setShowDetailed] = useState(false);

  const groupedCounts = groupPlatformCounts(platformCounts || {});
  const groupedData = Object.entries(groupedCounts)
    .filter(([, count]) => count > 0)
    .map(([group, count]) => ({ platform: group, count, fill: GROUP_COLORS[group] || '#A29BFE' }))
    .sort((a, b) => b.count - a.count);

  const detailedData = platformCounts && Object.keys(platformCounts).length > 0
    ? Object.entries(platformCounts)
        .map(([platform, count]) => ({ platform: getPlatformLabel(platform), count, fill: getPlatformColor(platform) }))
        .sort((a, b) => b.count - a.count)
    : [];

  const data = showDetailed ? detailedData : groupedData;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-gray-900 text-[15px] tracking-tight">Where You Apply</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Platform distribution</p>
        </div>
        <button
          onClick={() => setShowDetailed(!showDetailed)}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-indigo-600 transition font-medium bg-gray-50/80 px-2.5 py-1.5 rounded-lg hover:bg-indigo-50/50 border border-transparent hover:border-indigo-100 btn-press"
        >
          {showDetailed ? <><ChevronUp size={12} /> Grouped</> : <><Layers size={10} /> Details</>}
        </button>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center h-[180px] text-gray-400">
          <div className="empty-state-circle w-12 h-12 rounded-xl flex items-center justify-center mb-2">
            <Layers size={20} className="text-indigo-300" />
          </div>
          <p className="text-sm font-medium">No data yet</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 40)}>
          <BarChart data={data} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="platform" tick={{ fontSize: 11, fill: '#64748B', fontWeight: 500 }} axisLine={false} tickLine={false} width={showDetailed ? 110 : 120} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
