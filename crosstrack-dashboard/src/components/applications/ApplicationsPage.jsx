import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, ExternalLink, X, FileText, Upload, Download, Puzzle, Mail, MoreHorizontal, SlidersHorizontal, Stethoscope, Loader2, TrendingUp, AlertTriangle, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as applicationService from '../../services/applicationService';
import aiService from '../../services/aiService';
import AddApplicationModal from './AddApplicationModal';

const statusStyles = {
  APPLIED: { bg: 'bg-indigo-50', text: 'text-indigo-600', dot: 'bg-indigo-500', ring: 'ring-indigo-100' },
  INTERVIEW: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', ring: 'ring-emerald-100' },
  OFFER: { bg: 'bg-cyan-50', text: 'text-cyan-600', dot: 'bg-cyan-500', ring: 'ring-cyan-100' },
  REJECTED: { bg: 'bg-rose-50', text: 'text-rose-600', dot: 'bg-rose-500', ring: 'ring-rose-100' },
  GHOSTED: { bg: 'bg-gray-100', text: 'text-gray-500', dot: 'bg-gray-400', ring: 'ring-gray-100' },
  WITHDRAWN: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', ring: 'ring-amber-100' },
};

const platformBadge = {
  LINKEDIN: { label: 'LinkedIn', bg: 'bg-gradient-to-r from-blue-500 to-blue-600' },
  INDEED: { label: 'Indeed', bg: 'bg-gradient-to-r from-indigo-500 to-violet-600' },
  HANDSHAKE: { label: 'Handshake', bg: 'bg-gradient-to-r from-orange-400 to-orange-500' },
  GREENHOUSE: { label: 'Greenhouse', bg: 'bg-gradient-to-r from-green-400 to-green-500' },
  LEVER: { label: 'Lever', bg: 'bg-gradient-to-r from-teal-400 to-teal-500' },
  WORKDAY: { label: 'Workday', bg: 'bg-gradient-to-r from-amber-400 to-amber-500' },
  ICIMS: { label: 'iCIMS', bg: 'bg-gradient-to-r from-cyan-400 to-cyan-500' },
  SMARTRECRUITERS: { label: 'SmartRecruiters', bg: 'bg-gradient-to-r from-purple-400 to-purple-500' },
  ASHBY: { label: 'Ashby', bg: 'bg-gradient-to-r from-violet-400 to-violet-500' },
  JOBVITE: { label: 'Jobvite', bg: 'bg-gradient-to-r from-rose-400 to-rose-500' },
  TALEO: { label: 'Taleo', bg: 'bg-gradient-to-r from-sky-400 to-sky-500' },
  SAP_SUCCESSFACTORS: { label: 'SAP', bg: 'bg-gradient-to-r from-blue-400 to-blue-500' },
  BAMBOOHR: { label: 'BambooHR', bg: 'bg-gradient-to-r from-lime-400 to-lime-500' },
  COMPANY_DIRECT: { label: 'Company Site', bg: 'bg-gradient-to-r from-emerald-400 to-emerald-500' },
  OTHER: { label: 'Other', bg: 'bg-gradient-to-r from-gray-400 to-gray-500' },
};

const STATUSES = ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED', 'WITHDRAWN'];

export default function ApplicationsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [autopsyResult, setAutopsyResult] = useState(null);
  const [autopsyApp, setAutopsyApp] = useState(null);

  const autopsyMutation = useMutation({
    mutationFn: (applicationId) => aiService.analyzeRejection(applicationId),
    onSuccess: (data) => setAutopsyResult(data),
    onError: () => toast.error('Autopsy failed — check your AI API key'),
  });

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationService.getApplications,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => applicationService.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => applicationService.deleteApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Application deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const deleteAllMutation = useMutation({
    mutationFn: () => applicationService.deleteAllApplications(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success(`${data.deleted} applications deleted`);
    },
    onError: () => toast.error('Failed to delete all'),
  });

  const uploadResumeMutation = useMutation({
    mutationFn: ({ id, file }) => applicationService.uploadResume(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Resume uploaded!');
    },
    onError: () => toast.error('Upload failed. Max 5MB, PDF/DOC only.'),
  });

  const uploadCoverLetterMutation = useMutation({
    mutationFn: ({ id, file }) => applicationService.uploadCoverLetter(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Cover letter uploaded!');
    },
    onError: () => toast.error('Upload failed. Max 5MB, PDF/DOC only.'),
  });

  const handleFileUpload = (appId, type, file) => {
    if (!file) return;
    if (type === 'resume') {
      uploadResumeMutation.mutate({ id: appId, file });
    } else {
      uploadCoverLetterMutation.mutate({ id: appId, file });
    }
  };

  const handleDownload = async (appId, type, fileName) => {
    try {
      const response = type === 'resume'
        ? await applicationService.downloadResume(appId)
        : await applicationService.downloadCoverLetter(appId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const filtered = applications.filter(app => {
    const matchSearch = !search ||
      app.company.toLowerCase().includes(search.toLowerCase()) ||
      app.role.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || app.status === statusFilter;
    const matchPlatform = platformFilter === 'ALL' || app.platform === platformFilter;
    return matchSearch && matchStatus && matchPlatform;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-3 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[250px] relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search company or role..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200/80 rounded-xl text-sm focus:outline-none input-glow transition shadow-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-gray-400" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-gray-200/80 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 shadow-sm cursor-pointer">
            <option value="ALL">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-gray-200/80 rounded-xl text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 shadow-sm cursor-pointer">
          <option value="ALL">All Platforms</option>
          {[...new Set(applications.map(a => a.platform))].sort().map(p => (
            <option key={p} value={p}>{platformBadge[p]?.label || p}</option>
          ))}
        </select>

        {applications.length > 0 && (
          <button
            onClick={() => {
              if (confirm(`Are you sure you want to delete ALL ${applications.length} applications? This cannot be undone!`)) {
                deleteAllMutation.mutate();
              }
            }}
            disabled={deleteAllMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-500 text-white rounded-xl text-sm font-semibold hover:bg-rose-600 transition shadow-sm hover:shadow-md disabled:opacity-50 btn-press">
            <Trash2 size={15} /> {deleteAllMutation.isPending ? 'Deleting...' : 'Delete All'}
          </button>
        )}

        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-indigo-200 transition-all btn-press">
          <Plus size={16} /> Add Application
        </button>
      </div>

      {/* Table */}
      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-gray-50 to-gray-50/50 border-b border-gray-100">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider">Company</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider">Role</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider">Platform</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider">Applied</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider">Documents</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-500 text-[12px] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <div className="flex flex-col items-center text-gray-400">
                      <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                        <span className="text-2xl">📭</span>
                      </div>
                      <p className="font-medium">{applications.length === 0 ? 'No applications yet' : 'No matches found'}</p>
                      <p className="text-xs text-gray-300 mt-1">
                        {applications.length === 0 ? 'Start tracking your job applications!' : 'Try adjusting your filters'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((app, idx) => {
                  const s = statusStyles[app.status] || statusStyles.APPLIED;
                  return (
                    <tr key={app.id} className={clsx(
                      'border-b border-gray-50/80 table-row-hover group',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                    )}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {app.url ? (
                            <a href={app.url} target="_blank" rel="noopener noreferrer"
                              className="font-semibold text-gray-800 hover:text-indigo-600 transition flex items-center gap-1 group/link">
                              {app.company}
                              <ExternalLink size={11} className="opacity-0 group-hover/link:opacity-50 transition" />
                            </a>
                          ) : (
                            <span className="font-semibold text-gray-800">{app.company}</span>
                          )}
                          {app.source === 'EXTENSION' && (
                            <span title="Captured by extension" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-violet-100 text-violet-600 rounded-md text-[9px] font-bold">
                              <Puzzle size={9} /> EXT
                            </span>
                          )}
                          {app.source === 'EMAIL_SCAN' && (
                            <span title="Detected from email" className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-sky-100 text-sky-600 rounded-md text-[9px] font-bold">
                              <Mail size={9} /> EMAIL
                            </span>
                          )}
                        </div>
                        {app.location && <p className="text-[11px] text-gray-400 mt-0.5">{app.location}</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        {app.url ? (
                          <a href={app.url} target="_blank" rel="noopener noreferrer"
                            className="text-gray-700 hover:text-indigo-600 transition font-medium">
                            {app.role}
                          </a>
                        ) : (
                          <span className="text-gray-700 font-medium">{app.role}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={clsx('text-[10px] text-white font-bold px-2.5 py-1 rounded-full shadow-sm', platformBadge[app.platform]?.bg || 'bg-gray-500')}>
                          {platformBadge[app.platform]?.label || app.platform}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <select
                          value={app.status}
                          onChange={e => updateStatusMutation.mutate({ id: app.id, status: e.target.value })}
                          className={clsx(
                            'text-[11px] font-semibold px-3 py-1.5 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 transition',
                            s.bg, s.text, s.ring
                          )}
                        >
                          {STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
                        </select>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs font-medium">
                        {app.appliedAt ? format(new Date(app.appliedAt), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {app.resumeFileName && (
                            <button
                              onClick={() => handleDownload(app.id, 'resume', app.resumeFileName)}
                              className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-semibold hover:bg-indigo-100 transition"
                              title={`Resume: ${app.resumeFileName}`}
                            >
                              <FileText size={12} /> CV
                            </button>
                          )}
                          {app.coverLetterFileName && (
                            <button
                              onClick={() => handleDownload(app.id, 'cover-letter', app.coverLetterFileName)}
                              className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-semibold hover:bg-emerald-100 transition"
                              title={`Cover Letter: ${app.coverLetterFileName}`}
                            >
                              <FileText size={12} /> CL
                            </button>
                          )}
                          {!app.resumeFileName && !app.coverLetterFileName && (
                            <span className="text-[10px] text-gray-300">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {app.url && (
                            <a href={app.url} target="_blank" rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition">
                              <ExternalLink size={14} />
                            </a>
                          )}
                          {app.status === 'REJECTED' && (
                            <button onClick={() => { setAutopsyApp(app); setAutopsyResult(null); autopsyMutation.mutate(app.id); }}
                              className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition"
                              title="Run Application Autopsy — AI rejection analysis">
                              <Stethoscope size={14} />
                            </button>
                          )}
                          <button onClick={() => {
                              if (confirm('Delete this application?')) deleteMutation.mutate(app.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3.5 bg-gradient-to-r from-gray-50 to-gray-50/50 text-[12px] text-gray-500 border-t border-gray-100 font-medium">
          Showing {filtered.length} of {applications.length} applications
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && <AddApplicationModal onClose={() => setShowAdd(false)} />}

      {/* Application Autopsy Modal */}
      {autopsyApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-200/50">
                  <Stethoscope size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Application Autopsy</h3>
                  <p className="text-[11px] text-slate-400">{autopsyApp.company} · {autopsyApp.role}</p>
                </div>
              </div>
              <button onClick={() => { setAutopsyApp(null); setAutopsyResult(null); }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition">
                <X size={16} />
              </button>
            </div>

            {autopsyMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 size={28} className="animate-spin text-rose-400" />
                <p className="text-sm text-slate-400">Analyzing rejection patterns...</p>
              </div>
            ) : autopsyResult ? (
              <div className="space-y-4">
                {/* Possible Reasons */}
                {autopsyResult.possibleReasons?.length > 0 && (
                  <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100">
                    <h4 className="flex items-center gap-2 text-xs font-semibold text-rose-700 mb-2">
                      <AlertTriangle size={13} /> Possible Rejection Reasons
                    </h4>
                    <ul className="space-y-1.5">
                      {autopsyResult.possibleReasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-rose-600">
                          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Patterns */}
                {autopsyResult.patterns?.length > 0 && (
                  <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100">
                    <h4 className="flex items-center gap-2 text-xs font-semibold text-amber-700 mb-2">
                      <TrendingUp size={13} /> Patterns Detected
                    </h4>
                    <ul className="space-y-1.5">
                      {autopsyResult.patterns.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-amber-700">
                          <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Improvements */}
                {autopsyResult.improvements?.length > 0 && (
                  <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <h4 className="flex items-center gap-2 text-xs font-semibold text-indigo-700 mb-2">
                      <Lightbulb size={13} /> Actionable Improvements
                    </h4>
                    <ul className="space-y-1.5">
                      {autopsyResult.improvements.map((imp, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-indigo-700">
                          <span className="w-5 h-5 mt-0.5 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[9px] font-bold">{i + 1}</span>
                          {imp}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Encouragement */}
                {autopsyResult.encouragement && (
                  <p className="text-xs text-slate-500 text-center italic px-4 py-3 bg-slate-50 rounded-xl">
                    💙 {autopsyResult.encouragement}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
