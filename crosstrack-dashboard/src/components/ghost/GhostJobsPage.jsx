import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ghost, AlertTriangle, Clock, Skull, ExternalLink, Trash2, RefreshCw, X } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import * as applicationService from '../../services/applicationService';
import * as gmailService from '../../services/gmailService';

const GHOST_L1_DAYS = 28;
const GHOST_L2_DAYS = 60;
const GHOST_L3_DAYS = 120;

function getGhostLevel(appliedAt) {
  if (!appliedAt) return 0;
  const days = differenceInDays(new Date(), new Date(appliedAt));
  if (days >= GHOST_L3_DAYS) return 3;
  if (days >= GHOST_L2_DAYS) return 2;
  if (days >= GHOST_L1_DAYS) return 1;
  return 0;
}

const LEVEL_CONFIG = {
  1: {
    label: 'Level 1 — Possibly Ghosted',
    sublabel: '28+ days, no response',
    color: 'text-amber-700',
    bg: 'bg-gradient-to-br from-amber-50 to-yellow-50/50',
    border: 'border-amber-200/80',
    badge: 'bg-gradient-to-r from-amber-400 to-yellow-500',
    icon: Clock,
    iconGradient: 'from-amber-400 to-yellow-500',
    iconShadow: 'shadow-amber-200/50',
    daysBg: 'bg-amber-50',
    daysText: 'text-amber-600',
  },
  2: {
    label: 'Level 2 — Likely Ghosted',
    sublabel: '60+ days, no response',
    color: 'text-orange-700',
    bg: 'bg-gradient-to-br from-orange-50 to-amber-50/50',
    border: 'border-orange-200/80',
    badge: 'bg-gradient-to-r from-orange-400 to-orange-500',
    icon: AlertTriangle,
    iconGradient: 'from-orange-400 to-orange-500',
    iconShadow: 'shadow-orange-200/50',
    daysBg: 'bg-orange-50',
    daysText: 'text-orange-600',
  },
  3: {
    label: 'Level 3 — Dead Applications',
    sublabel: '120+ days, time to clean up',
    color: 'text-rose-700',
    bg: 'bg-gradient-to-br from-rose-50 to-red-50/50',
    border: 'border-rose-200/80',
    badge: 'bg-gradient-to-r from-rose-400 to-red-500',
    icon: Skull,
    iconGradient: 'from-rose-400 to-red-500',
    iconShadow: 'shadow-rose-200/50',
    daysBg: 'bg-rose-50',
    daysText: 'text-rose-600',
  },
};

export default function GhostJobsPage() {
  const queryClient = useQueryClient();
  const [showCleanupModal, setShowCleanupModal] = useState(false);

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
    onError: () => toast.error('Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => applicationService.deleteApplication(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success('Application deleted');
    },
  });

  const cleanupMutation = useMutation({
    mutationFn: gmailService.cleanupGhosts,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      toast.success(`${data.deleted} dead application(s) removed`);
      setShowCleanupModal(false);
    },
    onError: () => toast.error('Cleanup failed'),
  });

  // Categorize APPLIED apps by ghost level
  const appliedApps = applications.filter(a => a.status === 'APPLIED');
  const level1 = appliedApps.filter(a => getGhostLevel(a.appliedAt) === 1);
  const level2 = appliedApps.filter(a => getGhostLevel(a.appliedAt) === 2);
  const level3 = appliedApps.filter(a => getGhostLevel(a.appliedAt) === 3);
  const confirmedGhosted = applications.filter(a => a.status === 'GHOSTED');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-3 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <SummaryCard icon={Clock} gradient="from-amber-400 to-yellow-500" shadow="shadow-amber-200/50" label="L1: Possibly Ghosted" value={level1.length} sub="28+ days" />
        <SummaryCard icon={AlertTriangle} gradient="from-orange-400 to-orange-500" shadow="shadow-orange-200/50" label="L2: Likely Ghosted" value={level2.length} sub="60+ days" />
        <SummaryCard icon={Skull} gradient="from-rose-400 to-red-500" shadow="shadow-rose-200/50" label="L3: Dead" value={level3.length} sub="120+ days" />
        <SummaryCard icon={Ghost} gradient="from-gray-400 to-gray-500" shadow="shadow-gray-200/50" label="Confirmed Ghosted" value={confirmedGhosted.length} sub="Manually marked" />
      </div>

      {/* Level 3 Cleanup Banner */}
      {level3.length > 0 && (
        <div className="bg-gradient-to-r from-rose-50 to-red-50/50 border-2 border-rose-200/80 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-rose-400 to-red-500 shadow-lg shadow-rose-200/50">
              <Skull size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-rose-800">
                {level3.length} application{level3.length > 1 ? 's' : ''} with no response for 120+ days
              </p>
              <p className="text-sm text-rose-600 mt-0.5">
                These are very unlikely to respond. Want to clean them up?
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCleanupModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-rose-200/50 transition-all"
          >
            Review & Clean Up
          </button>
        </div>
      )}

      {/* Ghost Level Sections */}
      {[
        { level: 1, apps: level1 },
        { level: 2, apps: level2 },
        { level: 3, apps: level3 },
      ].map(({ level, apps }) => {
        if (apps.length === 0) return null;
        const config = LEVEL_CONFIG[level];
        const Icon = config.icon;

        return (
          <div key={level} className={clsx('rounded-2xl border overflow-hidden', config.border)}>
            <div className={clsx('px-5 py-4 border-b flex items-center gap-3', config.border, config.bg)}>
              <div className={clsx('p-2 rounded-xl bg-gradient-to-br shadow-lg', config.iconGradient, config.iconShadow)}>
                <Icon size={16} className="text-white" />
              </div>
              <div>
                <h3 className={clsx('font-bold', config.color)}>{config.label}</h3>
                <p className="text-xs text-gray-500">{config.sublabel}</p>
              </div>
              <span className={clsx('text-[11px] text-white font-bold px-2.5 py-0.5 rounded-full ml-auto shadow-sm', config.badge)}>
                {apps.length}
              </span>
            </div>
            <div className="bg-white divide-y divide-gray-50/80 rounded-b-2xl">
              {apps.map(app => {
                const days = differenceInDays(new Date(), new Date(app.appliedAt));
                return (
                  <div key={app.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/50 transition group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{app.role}</p>
                      <p className="text-xs text-gray-500">{app.company}</p>
                    </div>
                    <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full', config.daysBg, config.daysText)}>
                      {days} days
                    </span>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => updateStatusMutation.mutate({ id: app.id, status: 'GHOSTED' })}
                        className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition font-medium">
                        Mark Ghosted
                      </button>
                      <button onClick={() => updateStatusMutation.mutate({ id: app.id, status: 'INTERVIEW' })}
                        className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition font-medium">
                        Got Response
                      </button>
                      {level === 3 && (
                        <button onClick={() => {
                          if (confirm('Delete this application?')) deleteMutation.mutate(app.id);
                        }}
                          className="text-xs px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition font-medium">
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Confirmed Ghosted Section */}
      <div className="bg-white rounded-2xl border border-gray-100/80 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100/80 flex items-center gap-3 bg-gradient-to-r from-gray-50 to-white">
          <div className="p-2 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 shadow-lg shadow-gray-200/50">
            <Ghost size={16} className="text-white" />
          </div>
          <h3 className="font-bold text-gray-800">Confirmed Ghosted</h3>
          <span className="text-[11px] bg-gray-200 text-gray-600 font-bold px-2.5 py-0.5 rounded-full ml-2">{confirmedGhosted.length}</span>
        </div>
        {confirmedGhosted.length === 0 ? (
          <div className="px-5 py-14 text-center text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-3">
              <Ghost size={32} className="opacity-30" />
            </div>
            <p className="text-sm font-medium">No ghosted applications</p>
            <p className="text-xs mt-1 text-gray-300">Great — all your applications have responses!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50/80">
            {confirmedGhosted.map(app => {
              const days = differenceInDays(new Date(), new Date(app.appliedAt));
              return (
                <div key={app.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-gray-50/50 transition group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{app.role}</p>
                    <p className="text-xs text-gray-500">{app.company}</p>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">{days} days</span>
                  {app.url && (
                    <a href={app.url} target="_blank" rel="noopener noreferrer"
                      className="text-gray-400 hover:text-indigo-500 transition">
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button onClick={() => updateStatusMutation.mutate({ id: app.id, status: 'APPLIED' })}
                    className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition font-medium opacity-0 group-hover:opacity-100">
                    Re-apply
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* No ghosts at all */}
      {level1.length === 0 && level2.length === 0 && level3.length === 0 && confirmedGhosted.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100/80 shadow-sm p-14 text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center mx-auto mb-4">
            <Ghost size={40} className="text-gray-300" />
          </div>
          <p className="text-gray-500 font-semibold text-lg">No ghost applications detected</p>
          <p className="text-sm text-gray-400 mt-1.5">Applications with no response after 28 days will appear here</p>
        </div>
      )}

      {/* Cleanup Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100/50 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100/80">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center shadow-lg shadow-rose-200/50">
                  <Skull size={16} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Clean Up Dead Applications</h3>
              </div>
              <button onClick={() => setShowCleanupModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition">
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                The following {level3.length} application{level3.length > 1 ? 's have' : ' has'} had no response for <strong>120+ days</strong>.
                It's extremely unlikely you'll hear back.
              </p>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {level3.map(app => (
                  <div key={app.id} className="flex items-center justify-between p-3 bg-rose-50/50 rounded-xl border border-rose-100/80">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{app.company}</p>
                      <p className="text-xs text-gray-500">{app.role}</p>
                    </div>
                    <span className="text-xs text-rose-500 font-semibold">
                      {differenceInDays(new Date(), new Date(app.appliedAt))} days
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCleanupModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200/80 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
                  Keep All
                </button>
                <button
                  onClick={() => cleanupMutation.mutate()}
                  disabled={cleanupMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-red-500 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-rose-200/50 transition-all disabled:opacity-50"
                >
                  {cleanupMutation.isPending ? 'Deleting...' : `Delete All ${level3.length}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, gradient, shadow, label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100/80 card-hover">
      <div className="flex items-center gap-3">
        <div className={clsx('p-3 rounded-xl bg-gradient-to-br shadow-lg', gradient, shadow)}>
          <Icon size={22} className="text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-extrabold text-gray-900">{value}</p>
          <p className="text-[10px] text-gray-400 font-medium">{sub}</p>
        </div>
      </div>
    </div>
  );
}
