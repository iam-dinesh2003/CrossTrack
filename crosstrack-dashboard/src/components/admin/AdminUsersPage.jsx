import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import * as adminService from '../../services/adminService';

// Tiny colored badge for a status count
function StatusCount({ label, count, colorClass }) {
  if (!count) return <span className="text-slate-700 tabular-nums w-6 text-center">—</span>;
  return (
    <span className={`inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${colorClass}`}>
      {count}
    </span>
  );
}

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

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'admins',  label: 'Admins' },
  { key: 'gmail',   label: 'Gmail Connected' },
  { key: 'no-apps', label: 'No Applications' },
];

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [activeFilter, setActiveFilter] = useState('all');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => adminService.getUsers(search),
    keepPreviousData: true,
  });

  const deleteMutation = useMutation({
    mutationFn: id => adminService.deleteUser(id),
    onSuccess: () => {
      toast.success('User deleted');
      qc.invalidateQueries(['admin-users']);
      qc.invalidateQueries(['admin-stats']);
      setConfirm(null);
    },
    onError: e => toast.error(e?.response?.data?.error || 'Delete failed'),
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => adminService.updateUserRole(id, role),
    onSuccess: () => {
      toast.success('Role updated');
      qc.invalidateQueries(['admin-users']);
      setConfirm(null);
    },
    onError: e => toast.error(e?.response?.data?.error || 'Update failed'),
  });

  const limitsMutation = useMutation({
    mutationFn: id => adminService.resetUserLimits(id),
    onSuccess: () => toast.success('AI limits reset for today'),
    onError: () => toast.error('Reset failed'),
  });

  // Filter
  const filtered = users.filter(u => {
    if (activeFilter === 'admins')  return u.role === 'ROLE_ADMIN';
    if (activeFilter === 'gmail')   return u.gmailConnected;
    if (activeFilter === 'no-apps') return u.applicationCount === 0;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortBy], bv = b[sortBy];
    if (sortBy === 'createdAt') { av = new Date(av); bv = new Date(bv); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span className="text-slate-700 ml-1">↕</span>;
    return <span className="text-indigo-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function Th({ col, children }) {
    return (
      <th onClick={() => toggleSort(col)}
        className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors select-none whitespace-nowrap">
        {children}<SortIcon col={col} />
      </th>
    );
  }

  return (
    <div className="p-5 space-y-4">
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          loading={deleteMutation.isPending || roleMutation.isPending}
          onConfirm={() => {
            if (confirm.type === 'delete') deleteMutation.mutate(confirm.id);
            if (confirm.type === 'role') roleMutation.mutate({ id: confirm.id, role: confirm.newRole });
          }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-[13px] font-semibold text-white">
          Users <span className="text-slate-500 font-normal">({sorted.length}{activeFilter !== 'all' ? ` of ${users.length}` : ''})</span>
        </div>
        {/* Filter chips */}
        <div className="flex gap-1">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setActiveFilter(f.key)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-all ${
                activeFilter === f.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by email or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="ml-auto w-64 px-3 py-1.5 text-[12px] bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      {/* Table */}
      <div className="bg-[#13151d] border border-white/[0.07] rounded-xl overflow-x-auto">
        <table className="w-full text-[12px] min-w-[960px]">
          <thead className="border-b border-white/[0.07]">
            <tr>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-6">#</th>
              <Th col="email">User</Th>
              <Th col="role">Role</Th>
              <Th col="applicationCount">Total</Th>
              {/* Status columns */}
              <th className="text-center px-2 py-2.5 text-[11px] font-semibold text-blue-500/70 uppercase tracking-wider">Applied</th>
              <th className="text-center px-2 py-2.5 text-[11px] font-semibold text-violet-500/70 uppercase tracking-wider">Interview</th>
              <th className="text-center px-2 py-2.5 text-[11px] font-semibold text-emerald-500/70 uppercase tracking-wider">Offer</th>
              <th className="text-center px-2 py-2.5 text-[11px] font-semibold text-rose-500/70 uppercase tracking-wider">Rejected</th>
              <th className="text-center px-2 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Ghosted</th>
              <th className="text-center px-2 py-2.5 text-[11px] font-semibold text-emerald-400/60 uppercase tracking-wider">Offer %</th>
              <Th col="resumeCount">Resumes</Th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Gmail</th>
              <Th col="createdAt">Joined</Th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Last Active</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(6)].map((_,i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {[...Array(15)].map((_,j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-3 rounded bg-white/5 animate-pulse"/>
                    </td>
                  ))}
                </tr>
              ))
              : sorted.length === 0
              ? (
                <tr><td colSpan={15} className="text-center py-10 text-slate-600">No users found</td></tr>
              )
              : sorted.map((u, idx) => (
                <tr key={u.id}
                  className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                  <td className="px-3 py-2.5 text-slate-700 tabular-nums">{idx + 1}</td>

                  {/* User */}
                  <td className="px-3 py-2.5">
                    <Link to={`/admin/users/${u.id}`} className="group flex items-center gap-2">
                      <div className="relative">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                          {(u.displayName || u.email || '?').charAt(0).toUpperCase()}
                        </div>
                        {(() => {
                          if (!u.lastActivityAt) return null;
                          const days = (Date.now() - new Date(u.lastActivityAt)) / 86400000;
                          const color = days <= 7 ? 'bg-emerald-400' : days <= 30 ? 'bg-amber-400' : 'bg-rose-400';
                          return <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${color} ring-1 ring-[#13151d]`} />;
                        })()}
                      </div>
                      <div>
                        <div className="text-slate-200 font-medium group-hover:text-indigo-300 transition-colors">{u.displayName || '—'}</div>
                        <div className="text-slate-600 text-[11px]">{u.email}</div>
                      </div>
                    </Link>
                  </td>

                  {/* Role */}
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      u.role === 'ROLE_ADMIN'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-700/50 text-slate-500'
                    }`}>
                      {u.role === 'ROLE_ADMIN' ? '★ Admin' : 'User'}
                    </span>
                  </td>

                  {/* Total apps */}
                  <td className="px-3 py-2.5 text-slate-200 font-semibold tabular-nums text-center">
                    {u.applicationCount}
                  </td>

                  {/* Status breakdown */}
                  <td className="px-2 py-2.5 text-center">
                    <StatusCount count={u.statusBreakdown?.APPLIED}   colorClass="bg-blue-500/20 text-blue-300" />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <StatusCount count={u.statusBreakdown?.INTERVIEW}  colorClass="bg-violet-500/20 text-violet-300" />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <StatusCount count={u.statusBreakdown?.OFFER}      colorClass="bg-emerald-500/20 text-emerald-300" />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <StatusCount count={u.statusBreakdown?.REJECTED}   colorClass="bg-rose-500/20 text-rose-300" />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <StatusCount count={u.statusBreakdown?.GHOSTED}    colorClass="bg-slate-600/40 text-slate-400" />
                  </td>

                  {/* Offer % */}
                  <td className="px-2 py-2.5 text-center">
                    {u.applicationCount > 0 ? (
                      <span className={`text-[11px] font-bold tabular-nums ${
                        Math.round((u.statusBreakdown?.OFFER || 0) / u.applicationCount * 100) > 0
                          ? 'text-emerald-400'
                          : 'text-slate-600'
                      }`}>
                        {Math.round((u.statusBreakdown?.OFFER || 0) / u.applicationCount * 100)}%
                      </span>
                    ) : <span className="text-slate-700">—</span>}
                  </td>

                  {/* Resumes */}
                  <td className="px-3 py-2.5 text-slate-400 tabular-nums text-center">{u.resumeCount}</td>

                  {/* Gmail */}
                  <td className="px-3 py-2.5">
                    <span className={`text-[11px] font-medium ${u.gmailConnected ? 'text-emerald-400' : 'text-slate-700'}`}>
                      {u.gmailConnected ? '● Connected' : '○ None'}
                    </span>
                  </td>

                  {/* Joined */}
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                  </td>

                  {/* Last Active */}
                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                    {u.lastActivityAt
                      ? new Date(u.lastActivityAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                      : <span className="text-slate-700">—</span>}
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end">
                      <Link to={`/admin/users/${u.id}`}
                        className="px-2 py-1 text-[11px] text-slate-400 hover:text-white hover:bg-white/10 rounded transition-all">
                        View
                      </Link>
                      <button
                        onClick={() => limitsMutation.mutate(u.id)}
                        disabled={limitsMutation.isPending}
                        className="px-2 py-1 text-[11px] text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all">
                        Reset AI
                      </button>
                      <button
                        onClick={() => setConfirm({
                          type: 'role',
                          id: u.id,
                          newRole: u.role === 'ROLE_ADMIN' ? 'ROLE_USER' : 'ROLE_ADMIN',
                          message: `${u.role === 'ROLE_ADMIN' ? 'Remove admin from' : 'Make admin'}: ${u.email}?`,
                        })}
                        className="px-2 py-1 text-[11px] text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-all">
                        {u.role === 'ROLE_ADMIN' ? 'Demote' : 'Promote'}
                      </button>
                      <button
                        onClick={() => setConfirm({
                          type: 'delete',
                          id: u.id,
                          message: `Delete "${u.email}" and ALL their data? This cannot be undone.`,
                        })}
                        className="px-2 py-1 text-[11px] text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
