import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import * as adminService from '../../services/adminService';

const STATUS_META = {
  '':          { label: 'All',       color: '' },
  APPLIED:     { label: 'Applied',   color: 'text-blue-400' },
  INTERVIEW:   { label: 'Interview', color: 'text-violet-400' },
  OFFER:       { label: 'Offer',     color: 'text-emerald-400' },
  REJECTED:    { label: 'Rejected',  color: 'text-rose-400' },
  GHOSTED:     { label: 'Ghosted',   color: 'text-slate-400' },
  WITHDRAWN:   { label: 'Withdrawn', color: 'text-orange-400' },
};

const STATUS_BADGE = {
  APPLIED:   'bg-blue-500/20 text-blue-300',
  INTERVIEW: 'bg-violet-500/20 text-violet-300',
  OFFER:     'bg-emerald-500/20 text-emerald-300',
  REJECTED:  'bg-rose-500/20 text-rose-300',
  GHOSTED:   'bg-slate-600/30 text-slate-400',
  WITHDRAWN: 'bg-orange-500/20 text-orange-300',
};

const PAGE_SIZE = 50;

export default function AdminApplicationsPage() {
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-applications', page, status],
    queryFn: () => adminService.getAllApplications({ page, size: PAGE_SIZE, status }),
    keepPreviousData: true,
  });

  const apps = data?.applications || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const start = page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);

  function handleStatus(s) {
    setStatus(s);
    setPage(0);
  }

  return (
    <div className="p-5 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-[13px] font-semibold text-white">
          Applications{' '}
          <span className="text-slate-500 font-normal">
            ({isFetching ? '…' : total.toLocaleString()})
          </span>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1 ml-auto">
          {Object.entries(STATUS_META).map(([s, meta]) => (
            <button
              key={s}
              onClick={() => handleStatus(s)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-all ${
                status === s
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]'
              }`}>
              {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#13151d] border border-white/[0.07] rounded-xl overflow-x-auto">
        <table className="w-full text-[12px] min-w-[760px]">
          <thead className="border-b border-white/[0.07]">
            <tr>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-6">#</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Company</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Role</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Platform</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Applied</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">User</th>
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? [...Array(10)].map((_, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-3 py-3">
                      <div className="h-3 rounded bg-white/5 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
              : apps.length === 0
              ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-600">
                    No applications found
                  </td>
                </tr>
              )
              : apps.map((app, idx) => (
                <tr key={app.id}
                  className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors">
                  <td className="px-3 py-2.5 text-slate-700 tabular-nums">{start + idx}</td>

                  <td className="px-3 py-2.5 text-slate-200 font-medium">{app.company}</td>

                  <td className="px-3 py-2.5 text-slate-400 max-w-[200px]">
                    <span className="block truncate">{app.role}</span>
                  </td>

                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGE[app.status] || 'bg-slate-600/30 text-slate-400'}`}>
                      {app.status}
                    </span>
                  </td>

                  <td className="px-3 py-2.5 text-slate-500">{app.platform || '—'}</td>

                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                    {app.appliedAt
                      ? new Date(app.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                      : '—'}
                  </td>

                  <td className="px-3 py-2.5">
                    <Link
                      to={`/admin/users/${app.userId}`}
                      className="group flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                        {(app.userDisplayName || app.userEmail || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-slate-400 group-hover:text-indigo-300 transition-colors truncate max-w-[140px]">
                        {app.userEmail}
                      </span>
                    </Link>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
            <span className="text-[11px] text-slate-600">
              {start}–{end} of {total.toLocaleString()} records
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="px-2 py-1 text-[11px] text-slate-500 hover:text-white disabled:opacity-30 transition-colors">
                «
              </button>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded transition-all disabled:opacity-30">
                Prev
              </button>
              <span className="px-3 py-1 text-[11px] text-slate-500 tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded transition-all disabled:opacity-30">
                Next
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 text-[11px] text-slate-500 hover:text-white disabled:opacity-30 transition-colors">
                »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
