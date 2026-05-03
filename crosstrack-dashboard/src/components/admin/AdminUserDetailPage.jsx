import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import * as adminService from '../../services/adminService';

const SOURCE_BADGE = {
  EMAIL_SCAN: 'bg-blue-500/20 text-blue-300',
  MANUAL:     'bg-slate-600/30 text-slate-400',
  EXTENSION:  'bg-violet-500/20 text-violet-300',
};

const STATUS_COLORS = {
  APPLIED:   'bg-blue-500/20 text-blue-300 border border-blue-500/20',
  INTERVIEW: 'bg-violet-500/20 text-violet-300 border border-violet-500/20',
  OFFER:     'bg-emerald-500/20 text-emerald-300 border border-emerald-500/20',
  REJECTED:  'bg-rose-500/20 text-rose-300 border border-rose-500/20',
  GHOSTED:   'bg-slate-600/30 text-slate-400 border border-slate-600/30',
  WITHDRAWN: 'bg-orange-500/20 text-orange-300 border border-orange-500/20',
};

function ConfirmModal({ message, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 max-w-sm w-full mx-4 shadow-2xl">
        <p className="text-slate-200 text-[13px] leading-relaxed mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel}
            className="px-3 py-1.5 text-[12px] text-slate-400 hover:text-white bg-white/5 rounded-lg transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-3 py-1.5 text-[12px] font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-all disabled:opacity-50">
            {loading ? 'Processing...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin-user-detail', id],
    queryFn: () => adminService.getUserDetail(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminService.deleteUser(id),
    onSuccess: () => {
      toast.success('User deleted');
      qc.invalidateQueries(['admin-users']);
      qc.invalidateQueries(['admin-stats']);
      navigate('/admin/users');
    },
    onError: e => toast.error(e?.response?.data?.error || 'Delete failed'),
  });

  const roleMutation = useMutation({
    mutationFn: role => adminService.updateUserRole(id, role),
    onSuccess: () => {
      toast.success('Role updated');
      qc.invalidateQueries(['admin-user-detail', id]);
      qc.invalidateQueries(['admin-users']);
      setConfirm(null);
    },
    onError: e => toast.error(e?.response?.data?.error || 'Update failed'),
  });

  const limitsMutation = useMutation({
    mutationFn: () => adminService.resetUserLimits(id),
    onSuccess: () => toast.success('AI limits reset for today'),
    onError: () => toast.error('Reset failed'),
  });

  const repairMutation = useMutation({
    mutationFn: () => adminService.repairRoles(id),
    onSuccess: d => toast.success(`Repaired ${d.repaired} unknown roles`),
    onError: () => toast.error('Repair failed'),
  });

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!user) return <div className="p-5 text-slate-500 text-[13px]">User not found</div>;

  const isAdminUser = user.role === 'ROLE_ADMIN';

  const sb = user.statusBreakdown || {};
  const total = user.applicationCount || 0;
  const offerRate     = total > 0 ? Math.round((sb.OFFER    || 0) / total * 100) : 0;
  const interviewRate = total > 0 ? Math.round(((sb.OFFER || 0) + (sb.INTERVIEW || 0)) / total * 100) : 0;
  const ghostRate     = total > 0 ? Math.round((sb.GHOSTED  || 0) / total * 100) : 0;

  const topCompanies = Object.entries(
    (user.recentApplications || []).reduce((acc, app) => {
      if (app.company) acc[app.company] = (acc[app.company] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="p-5 space-y-4">
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          loading={deleteMutation.isPending || roleMutation.isPending}
          onConfirm={() => {
            if (confirm.type === 'delete') deleteMutation.mutate();
            if (confirm.type === 'role') roleMutation.mutate(confirm.newRole);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/admin/users" className="text-[12px] text-slate-500 hover:text-slate-300 transition-colors">
          ← Users
        </Link>
        <span className="text-slate-700">/</span>
        <span className="text-[12px] text-slate-300 font-medium">{user.displayName || user.email}</span>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => limitsMutation.mutate()}
            disabled={limitsMutation.isPending}
            className="px-2.5 py-1.5 text-[12px] text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all border border-white/[0.06]">
            {limitsMutation.isPending ? 'Resetting...' : 'Reset AI Limits'}
          </button>
          <button
            onClick={() => repairMutation.mutate()}
            disabled={repairMutation.isPending}
            className="px-2.5 py-1.5 text-[12px] text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all border border-white/[0.06]">
            {repairMutation.isPending ? 'Repairing...' : 'Repair Roles'}
          </button>
          <button
            onClick={() => setConfirm({
              type: 'role',
              newRole: isAdminUser ? 'ROLE_USER' : 'ROLE_ADMIN',
              message: `${isAdminUser ? 'Remove admin from' : 'Make admin'}: ${user.email}?`,
            })}
            className="px-2.5 py-1.5 text-[12px] text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all border border-white/[0.06]">
            {isAdminUser ? 'Demote to User' : 'Promote to Admin'}
          </button>
          <button
            onClick={() => setConfirm({
              type: 'delete',
              message: `Delete "${user.email}" and ALL their data (${user.applicationCount} apps, ${user.resumeCount} resumes, etc)? This cannot be undone.`,
            })}
            className="px-2.5 py-1.5 text-[12px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all border border-white/[0.06]">
            Delete User
          </button>
        </div>
      </div>

      {/* Profile + counters */}
      <div className="bg-[#13151d] border border-white/[0.07] rounded-xl p-4">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-semibold text-[15px]">{user.displayName || '—'}</span>
              {isAdminUser && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  ★ Admin
                </span>
              )}
            </div>
            <div className="text-slate-400 text-[12px] mt-0.5">{user.email}</div>
            <div className="text-slate-600 text-[11px] mt-0.5">
              Joined {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : '—'}
            </div>
          </div>

          {/* Gmail status */}
          <div className="text-right flex-shrink-0">
            <div className={`text-[12px] font-medium ${user.gmailConnected ? 'text-emerald-400' : 'text-slate-600'}`}>
              {user.gmailConnected ? `● Gmail Connected (${user.gmailAccountCount})` : '○ Gmail Not Connected'}
            </div>
          </div>
        </div>

        {/* Success metrics */}
        {total > 0 && (
          <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/[0.05]">
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-300 text-[12px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Offer Rate: {offerRate}%
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/20 text-violet-300 text-[12px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              Interview Rate: {interviewRate}%
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/20 text-rose-300 text-[12px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Ghost Rate: {ghostRate}%
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-300 text-[12px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Applied: {sb.APPLIED || 0}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/15 text-rose-400/80 text-[12px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60" />
              Rejected: {sb.REJECTED || 0}
            </span>
          </div>
        )}

        {/* Count grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4 pt-4 border-t border-white/[0.05]">
          {[
            { label: 'Applications',   value: user.applicationCount,  color: 'text-indigo-400' },
            { label: 'Resumes',        value: user.resumeCount,       color: 'text-emerald-400' },
            { label: 'Memories',       value: user.memoryCount,       color: 'text-violet-400' },
            { label: 'Coach Msgs',     value: user.coachMessageCount, color: 'text-amber-400' },
            { label: 'Follow-Ups',     value: user.followUpCount,     color: 'text-rose-400' },
            { label: 'Interview Notes',value: user.interviewNoteCount,color: 'text-cyan-400' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value ?? 0}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Usage */}
      {user.aiUsage && Object.keys(user.aiUsage).length > 0 && (
        <div className="bg-[#13151d] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Today's AI Usage
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(user.aiUsage).map(([category, stats]) => {
              const pct = stats.limit > 0 ? Math.min(100, Math.round((stats.used / stats.limit) * 100)) : 0;
              const barColor = pct >= 90 ? 'bg-rose-500/60' : pct >= 60 ? 'bg-amber-500/60' : 'bg-indigo-500/50';
              return (
                <div key={category} className="bg-white/[0.03] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wide truncate">{category}</span>
                    <span className="text-[11px] text-slate-300 tabular-nums ml-2 flex-shrink-0">
                      {stats.used}/{stats.limit}
                    </span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1">{stats.remaining} remaining</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resumes */}
      {user.resumeNames?.length > 0 && (
        <div className="bg-[#13151d] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Resumes ({user.resumeNames.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {user.resumeNames.map((name, i) => (
              <span key={i} className="px-2.5 py-1 text-[11px] bg-white/[0.04] text-slate-300 border border-white/[0.07] rounded-lg">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top Companies */}
      {topCompanies.length > 0 && (
        <div className="bg-[#13151d] border border-white/[0.07] rounded-xl p-4">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Top Companies Applied To
          </div>
          <div className="flex flex-wrap gap-2">
            {topCompanies.map(([company, count]) => (
              <span key={company} className="flex items-center gap-1.5 px-2.5 py-1 text-[12px] bg-white/[0.04] text-slate-300 border border-white/[0.07] rounded-lg">
                <span className="font-medium">{company}</span>
                <span className="text-slate-600 text-[11px]">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Applications table */}
      <div className="bg-[#13151d] border border-white/[0.07] rounded-xl overflow-x-auto">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
            Recent Applications
          </span>
          <span className="text-[11px] text-slate-600">
            {user.recentApplications?.length
              ? `${user.recentApplications.length} shown${user.applicationCount > 50 ? ` of ${user.applicationCount}` : ''}`
              : '0'}
          </span>
        </div>

        {!user.recentApplications?.length ? (
          <div className="py-10 text-center text-slate-600 text-[12px] px-3">No applications yet</div>
        ) : (
          <table className="w-full text-[12px] min-w-[600px]">
            <thead className="border-b border-white/[0.05]">
              <tr>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">#</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Company</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Platform</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Source</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Applied</th>
              </tr>
            </thead>
            <tbody>
              {user.recentApplications.map((app, idx) => (
                <tr key={app.id} className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                  <td className="px-3 py-2.5 text-slate-700 tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2.5 text-slate-200 font-medium">{app.company}</td>
                  <td className="px-3 py-2.5 text-slate-400 max-w-[220px] truncate">{app.role}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[app.status] || 'bg-slate-600/30 text-slate-400'}`}>
                      {app.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">{app.platform || '—'}</td>
                  <td className="px-3 py-2.5">
                    {app.source ? (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${SOURCE_BADGE[app.source] || 'bg-slate-600/30 text-slate-400'}`}>
                        {app.source === 'EMAIL_SCAN' ? 'Gmail' : app.source === 'EXTENSION' ? 'Ext' : 'Manual'}
                      </span>
                    ) : <span className="text-slate-700">—</span>}
                    {app.ghostLevel > 0 && (
                      <span className={`ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        app.ghostLevel === 1 ? 'bg-amber-500/20 text-amber-400' :
                        app.ghostLevel === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-rose-500/20 text-rose-400'
                      }`}>
                        G{app.ghostLevel}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                    {app.appliedAt
                      ? new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
