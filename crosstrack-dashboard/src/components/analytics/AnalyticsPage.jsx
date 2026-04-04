import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Target, Clock, Award, BarChart3 } from 'lucide-react';
import * as applicationService from '../../services/applicationService';
import { groupPlatformCounts, GROUP_COLORS, PLATFORM_GROUPS, getPlatformLabel } from '../../utils/platformUtils';
import clsx from 'clsx';

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-navy-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs">
        <p className="font-semibold text-indigo-200">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="mt-0.5">{p.name}: <span className="font-bold">{p.value}</span></p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationService.getApplications,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-3 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Calculate analytics
  const total = applications.length;
  const interviews = applications.filter(a => a.status === 'INTERVIEW').length;
  const offers = applications.filter(a => a.status === 'OFFER').length;
  const responseRate = total > 0 ? Math.round(((interviews + offers) / total) * 100) : 0;
  const interviewRate = total > 0 ? Math.round((interviews / total) * 100) : 0;
  const offerRate = interviews > 0 ? Math.round((offers / interviews) * 100) : 0;

  // Status breakdown for pie
  const statusCounts = {};
  applications.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });
  const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Platform breakdown — grouped (Job Boards vs Company Website)
  const rawPlatformCounts = {};
  applications.forEach(a => { rawPlatformCounts[a.platform] = (rawPlatformCounts[a.platform] || 0) + 1; });
  const groupedCounts = groupPlatformCounts(rawPlatformCounts);
  const platformData = Object.entries(groupedCounts)
    .filter(([, count]) => count > 0)
    .map(([group, count]) => ({
      platform: group, count, fill: GROUP_COLORS[group] || '#8B5CF6',
    }));

  // Weekly trend (last 8 weeks)
  const weeklyData = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (i * 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const count = applications.filter(a => {
      const d = new Date(a.appliedAt);
      return d >= weekStart && d < weekEnd;
    }).length;
    weeklyData.push({
      week: `W${8 - i}`,
      applications: count,
    });
  }

  // Platform success rate — grouped
  const platformSuccess = Object.entries(groupedCounts)
    .filter(([, count]) => count > 0)
    .map(([group, total]) => {
      const groupPlatforms = PLATFORM_GROUPS[group] || [];
      const positive = applications.filter(a =>
        groupPlatforms.includes(a.platform) && ['INTERVIEW', 'OFFER'].includes(a.status)
      ).length;
      return {
        platform: group,
        rate: total > 0 ? Math.round((positive / total) * 100) : 0,
        total,
      };
    });

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard icon={TrendingUp} label="Response Rate" value={`${responseRate}%`} sub={`${interviews + offers} of ${total} got responses`} gradient="from-violet-500 to-purple-600" shadowColor="shadow-violet-200/50" />
        <MetricCard icon={Target} label="Interview Rate" value={`${interviewRate}%`} sub={`${interviews} interviews from ${total} apps`} gradient="from-blue-500 to-indigo-600" shadowColor="shadow-blue-200/50" />
        <MetricCard icon={Award} label="Offer Rate" value={`${offerRate}%`} sub={`${offers} offers from ${interviews} interviews`} gradient="from-emerald-500 to-teal-600" shadowColor="shadow-emerald-200/50" />
        <MetricCard icon={Clock} label="Avg Response" value="—" sub="Tracking in progress" gradient="from-amber-500 to-orange-600" shadowColor="shadow-amber-200/50" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Weekly Trend */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100/80 card-hover">
          <h3 className="font-bold text-gray-900 text-[15px] mb-5">Application Trend (8 Weeks)</h3>
          {total === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="applications" stroke="#6366F1" strokeWidth={2.5} fill="url(#trendGrad)" dot={{ r: 4, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Pie */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100/80 card-hover">
          <h3 className="font-bold text-gray-900 text-[15px] mb-5">Status Distribution</h3>
          {statusData.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Platform Bar */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100/80 card-hover">
          <h3 className="font-bold text-gray-900 text-[15px] mb-5">Applications by Platform</h3>
          {platformData.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={platformData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="platform" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} barSize={40}>
                  {platformData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill || '#6366F1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Platform Success Rate */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100/80 card-hover">
          <h3 className="font-bold text-gray-900 text-[15px] mb-5">Platform Success Rate</h3>
          {platformSuccess.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-5 pt-1">
              {platformSuccess.map(p => (
                <div key={p.platform}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-gray-700">{p.platform}</span>
                    <span className="text-gray-500 text-xs font-medium">{p.rate}% ({p.total} apps)</span>
                  </div>
                  <div className="w-full bg-gray-100/80 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(p.rate, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, gradient, shadowColor }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100/80 card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-1">{value}</p>
          <p className="text-[11px] text-gray-400 mt-1.5">{sub}</p>
        </div>
        <div className={clsx('p-3 rounded-xl bg-gradient-to-br shadow-lg', gradient, shadowColor)}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-400">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
        <BarChart3 size={24} className="opacity-40" />
      </div>
      <p className="text-sm font-medium">No data to display yet</p>
      <p className="text-xs text-gray-300 mt-1">Start applying to see your analytics</p>
    </div>
  );
}
