import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as adminService from '../../services/adminService';

const STATUS_COLOR = {
  APPLIED:   { bar: 'bg-blue-500/60',    text: 'text-blue-300' },
  INTERVIEW: { bar: 'bg-violet-500/60',  text: 'text-violet-300' },
  OFFER:     { bar: 'bg-emerald-500/60', text: 'text-emerald-300' },
  REJECTED:  { bar: 'bg-rose-500/60',    text: 'text-rose-300' },
  GHOSTED:   { bar: 'bg-slate-500/50',   text: 'text-slate-400' },
  WITHDRAWN: { bar: 'bg-orange-500/60',  text: 'text-orange-300' },
};

const SOURCE_META = {
  EMAIL_SCAN: { label: 'Gmail Scan',  bar: 'bg-blue-500/60',   text: 'text-blue-300' },
  MANUAL:     { label: 'Manual',      bar: 'bg-slate-500/50',  text: 'text-slate-400' },
  EXTENSION:  { label: 'Extension',   bar: 'bg-violet-500/60', text: 'text-violet-300' },
};

function StatCard({ label, value, sub, colorClass }) {
  return (
    <div className={`border rounded-xl p-4 ${colorClass}`}>
      <div className="text-3xl font-bold text-white tabular-nums">{value ?? '—'}</div>
      <div className="text-[13px] text-slate-300 font-medium mt-1">{label}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function BarRow({ label, count, total, colorClass, extra }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[12px] text-slate-400 w-24 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] text-slate-400 tabular-nums w-24 text-right flex-shrink-0">
        {count} ({pct}%){extra ? <span className="ml-1 text-emerald-400 font-semibold">{extra}</span> : null}
      </span>
    </div>
  );
}

function AdoptionMeter({ label, count, total, barColor, icon }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-slate-300">{icon} {label}</span>
        <span className="text-[12px] font-semibold text-white tabular-nums">{pct}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-[10px] text-slate-600">{count} of {total} users</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const qc = useQueryClient();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: adminService.getStats,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users', ''],
    queryFn: () => adminService.getUsers(''),
  });

  const ghostMutation = useMutation({
    mutationFn: adminService.triggerGhostCheck,
    onSuccess: d => {
      toast.success(`Ghost check done — ${d.resolvedCount ?? 0} resolved`);
      qc.invalidateQueries(['admin-stats']);
    },
    onError: () => toast.error('Ghost check failed'),
  });

  const repairMutation = useMutation({
    mutationFn: adminService.repairAllRoles,
    onSuccess: d => {
      toast.success(`Role repair done — ${d.repaired} fixed${d.failed ? `, ${d.failed} failed` : ''}`);
      qc.invalidateQueries(['admin-stats']);
    },
    onError: () => toast.error('Repair failed'),
  });

  const recentUsers = [...users].sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  ).slice(0, 8);

  const totalApps = stats?.totalApplications || 0;
  const totalUsers = stats?.totalUsers || 0;

  // Platform offer rates (computed client-side)
  const platformWithOfferRate = Object.entries(stats?.platformBreakdown || {})
    .slice(0, 8)
    .map(([platform, count]) => ({
      platform,
      count,
      offers: stats?.platformOfferBreakdown?.[platform] || 0,
      offerRate: count > 0 ? Math.round(((stats?.platformOfferBreakdown?.[platform] || 0) / count) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topByOfferRate = [...platformWithOfferRate]
    .filter(p => p.offers > 0)
    .sort((a, b) => b.offerRate - a.offerRate);

  const Skeleton = () => (
    <div className="h-4 rounded bg-white/5 animate-pulse" />
  );

  return (
    <div className="p-5 space-y-5">

      {/* ── Row 1: 6 Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'Total Users',        value: stats?.totalUsers,        sub: `+${stats?.newUsersThisWeek ?? 0} this week`,    colorClass: 'border-indigo-500/30 bg-indigo-500/5' },
          { label: 'Applications',       value: stats?.totalApplications, sub: `+${stats?.newAppsThisWeek ?? 0} this week`,     colorClass: 'border-blue-500/30 bg-blue-500/5' },
          { label: 'New Users / Month',  value: stats?.newUsersThisMonth, sub: `+${stats?.newUsersThisWeek ?? 0} this week`,    colorClass: 'border-cyan-500/30 bg-cyan-500/5' },
          { label: 'New Apps / Month',   value: stats?.newAppsThisMonth,  sub: `+${stats?.newAppsThisWeek ?? 0} this week`,     colorClass: 'border-purple-500/30 bg-purple-500/5' },
          { label: 'Offer Rate',         value: isLoading ? '—' : `${stats?.offerRate ?? 0}%`,    sub: 'across all applications', colorClass: 'border-emerald-500/30 bg-emerald-500/5' },
          { label: 'Ghosting Rate',      value: isLoading ? '—' : `${stats?.ghostingRate ?? 0}%`, sub: 'no response received',    colorClass: 'border-slate-500/30 bg-slate-500/5' },
        ].map(s => (
          <StatCard key={s.label} {...s} value={isLoading ? '—' : s.value} />
        ))}
      </div>

      {/* ── Row 2: Status Breakdown + Source Breakdown ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Status */}
        <div className="bg-[#13151d] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Application Funnel
          </div>
          {isLoading
            ? <div className="space-y-2">{[...Array(6)].map((_,i)=><Skeleton key={i}/>)}</div>
            : <div className="space-y-2.5">
                {Object.entries(stats?.statusBreakdown || {}).map(([status, count]) => (
                  <BarRow key={status} label={status} count={count} total={totalApps}
                    colorClass={STATUS_COLOR[status]?.bar || 'bg-slate-500/50'} />
                ))}
              </div>
          }
        </div>

        {/* Source */}
        <div className="bg-[#13151d] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
            How Users Add Applications
          </div>
          {isLoading
            ? <div className="space-y-2">{[...Array(3)].map((_,i)=><Skeleton key={i}/>)}</div>
            : <div className="space-y-2.5">
                {Object.entries(stats?.sourceBreakdown || {}).map(([source, count]) => {
                  const meta = SOURCE_META[source] || { label: source, bar: 'bg-slate-500/50', text: 'text-slate-400' };
                  return (
                    <BarRow key={source} label={meta.label} count={count} total={totalApps}
                      colorClass={meta.bar} />
                  );
                })}
                {!stats?.sourceBreakdown || Object.keys(stats.sourceBreakdown).length === 0
                  ? <p className="text-[12px] text-slate-600">No data yet</p>
                  : null
                }
              </div>
          }

          {/* Response rate pill */}
          {!isLoading && stats && (
            <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center gap-3">
              <span className="text-[11px] text-slate-500">Response Rate</span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500/60 rounded-full"
                  style={{ width: `${stats.responseRate}%` }} />
              </div>
              <span className="text-[12px] font-semibold text-violet-300">{stats.responseRate}%</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Platform Intelligence ── */}
      <div className="bg-[#13151d] border border-white/[0.07] rounded-xl p-4">
        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Platform Intelligence — Volume vs Offer Rate
        </div>
        {isLoading
          ? <div className="space-y-2">{[...Array(6)].map((_,i)=><Skeleton key={i}/>)}</div>
          : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Volume */}
              <div>
                <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">By Volume</div>
                <div className="space-y-2">
                  {platformWithOfferRate.map(({ platform, count }) => (
                    <BarRow key={platform} label={platform || 'Unknown'} count={count} total={totalApps}
                      colorClass="bg-purple-500/50" />
                  ))}
                </div>
              </div>
              {/* Offer rate */}
              <div>
                <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-2">By Offer Rate</div>
                <div className="space-y-2">
                  {topByOfferRate.length === 0
                    ? <p className="text-[12px] text-slate-600">No offers recorded yet</p>
                    : topByOfferRate.map(({ platform, offers, count, offerRate }) => (
                      <div key={platform} className="flex items-center gap-2.5">
                        <span className="text-[12px] text-slate-400 w-24 flex-shrink-0 truncate">{platform || 'Unknown'}</span>
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500/60 rounded-full" style={{ width: `${offerRate}%` }} />
                        </div>
                        <span className="text-[12px] text-slate-400 tabular-nums w-32 text-right flex-shrink-0">
                          {offers}/{count} =&nbsp;
                          <span className="text-emerald-400 font-semibold">{offerRate}%</span>
                        </span>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          )
        }
      </div>

      {/* ── Row 4: Feature Adoption + Data Health ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Feature Adoption */}
        <div className="bg-[#13151d] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Feature Adoption
          </div>
          {isLoading
            ? <div className="space-y-4">{[...Array(3)].map((_,i)=><div key={i} className="space-y-1.5"><Skeleton/><Skeleton/></div>)}</div>
            : <div className="space-y-4">
                <AdoptionMeter
                  label="Gmail Integration"
                  count={stats?.gmailConnectedUsers ?? 0}
                  total={totalUsers}
                  barColor="bg-emerald-500/60"
                  icon="●"
                />
                <AdoptionMeter
                  label="Resumes Uploaded"
                  count={stats?.usersWithResumes ?? 0}
                  total={totalUsers}
                  barColor="bg-blue-500/60"
                  icon="●"
                />
                <AdoptionMeter
                  label="AI Coach Used"
                  count={stats?.usersWithCoachHistory ?? 0}
                  total={totalUsers}
                  barColor="bg-violet-500/60"
                  icon="●"
                />
              </div>
          }
        </div>

        {/* Data Health */}
        <div className="bg-[#13151d] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
            Data Health
          </div>
          {isLoading
            ? <div className="space-y-3">{[...Array(3)].map((_,i)=><Skeleton key={i}/>)}</div>
            : <div className="space-y-4">

                {/* Unknown Roles */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-2xl font-bold tabular-nums ${(stats?.unknownRoleCount ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {stats?.unknownRoleCount ?? 0}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Unknown Role apps</div>
                  </div>
                  <button
                    onClick={() => repairMutation.mutate()}
                    disabled={repairMutation.isPending || (stats?.unknownRoleCount ?? 0) === 0}
                    className="px-2.5 py-1.5 text-[11px] text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 border border-white/[0.07] rounded-lg transition-all disabled:opacity-40 flex-shrink-0">
                    {repairMutation.isPending ? 'Repairing...' : 'Repair All'}
                  </button>
                </div>

                {/* Ghost Levels */}
                <div>
                  <div className="text-[11px] text-slate-500 mb-2">Ghost Levels</div>
                  <div className="flex gap-3">
                    {[
                      { key: '1', label: '28+ days', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                      { key: '2', label: '60+ days', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
                      { key: '3', label: '120+ days', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
                    ].map(({ key, label, color }) => (
                      <div key={key} className={`flex-1 rounded-lg p-2 border text-center ${color}`}>
                        <div className="text-xl font-bold tabular-nums">
                          {stats?.ghostLevelBreakdown?.[key] ?? 0}
                        </div>
                        <div className="text-[10px] mt-0.5 opacity-70">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Duplicate Flags */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`text-[13px] font-semibold ${(stats?.activeDuplicateFlags ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {(stats?.activeDuplicateFlags ?? 0) > 0
                        ? `${stats.activeDuplicateFlags} duplicate flags`
                        : '✓ No duplicate flags'}
                    </span>
                    <div className="text-[11px] text-slate-600 mt-0.5">Unresolved duplicate applications</div>
                  </div>
                </div>
              </div>
          }
        </div>
      </div>

      {/* ── Row 5: Quick Actions + Recent Sign-ups ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Quick Actions */}
        <div className="bg-[#13151d] border border-white/[0.07] rounded-xl p-4 space-y-2">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Operations
          </div>
          <Link to="/admin/users"
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[13px] text-slate-300 transition-all group">
            <span>Manage Users</span>
            <span className="text-slate-600 group-hover:text-indigo-400 transition-colors">→</span>
          </Link>
          <button
            onClick={() => ghostMutation.mutate()}
            disabled={ghostMutation.isPending}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[13px] text-slate-300 transition-all disabled:opacity-50 group">
            <span>{ghostMutation.isPending ? 'Running...' : 'Trigger Ghost Check'}</span>
            <span className="text-slate-600 group-hover:text-amber-400 transition-colors">⚡</span>
          </button>
          <button
            onClick={() => repairMutation.mutate()}
            disabled={repairMutation.isPending}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[13px] text-slate-300 transition-all disabled:opacity-50 group">
            <span>{repairMutation.isPending ? 'Repairing...' : 'Repair All Unknown Roles'}</span>
            <span className="text-slate-600 group-hover:text-orange-400 transition-colors">🔧</span>
          </button>
          <button
            onClick={() => qc.invalidateQueries(['admin-stats'])}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[13px] text-slate-300 transition-all group">
            <span>Refresh Stats</span>
            <span className="text-slate-600 group-hover:text-blue-400 transition-colors">↺</span>
          </button>
        </div>

        {/* Recent Sign-ups */}
        <div className="xl:col-span-2 bg-[#13151d] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
              Recent Sign-ups
            </span>
            <Link to="/admin/users" className="text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors">
              View all →
            </Link>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-white/[0.04]">
                {['User', 'Apps', 'Applied', 'Interview', 'Offer', 'Gmail', 'Joined'].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-slate-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentUsers.map(u => (
                <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2.5">
                    <Link to={`/admin/users/${u.id}`} className="hover:text-indigo-300 transition-colors">
                      <div className="text-slate-200 font-medium">{u.displayName || '—'}</div>
                      <div className="text-slate-600 text-[11px]">{u.email}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300 tabular-nums font-semibold">{u.applicationCount}</td>
                  <td className="px-3 py-2.5 text-blue-400 tabular-nums">{u.statusBreakdown?.APPLIED ?? 0}</td>
                  <td className="px-3 py-2.5 text-violet-400 tabular-nums">{u.statusBreakdown?.INTERVIEW ?? 0}</td>
                  <td className="px-3 py-2.5 text-emerald-400 tabular-nums">{u.statusBreakdown?.OFFER ?? 0}</td>
                  <td className="px-3 py-2.5">
                    <span className={u.gmailConnected ? 'text-emerald-400' : 'text-slate-700'}>
                      {u.gmailConnected ? '✓' : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
