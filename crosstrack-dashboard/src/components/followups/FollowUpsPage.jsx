import { useState } from 'react';
import { Bell, Send, Clock, CheckCircle, XCircle, AlarmClock, Mail, ChevronDown, Loader2, Copy } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import followUpService from '../../services/followUpService';
import toast from 'react-hot-toast';

const TYPE_CONFIG = {
  GENTLE: { label: 'Gentle Follow-Up', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-400', days: '7 days' },
  SECOND: { label: 'Second Follow-Up', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400', days: '14 days' },
  FINAL: { label: 'Final Follow-Up', color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-400', days: '21 days' },
};

const STATUS_ICONS = {
  PENDING: Clock,
  SNOOZED: AlarmClock,
  SENT: CheckCircle,
  DISMISSED: XCircle,
};

export default function FollowUpsPage() {
  const [filter, setFilter] = useState('active');
  const [expandedId, setExpandedId] = useState(null);
  const queryClient = useQueryClient();

  const { data: followUps = [], isLoading } = useQuery({
    queryKey: ['followUps', filter],
    queryFn: () => followUpService.getFollowUps(filter),
  });

  const sentMutation = useMutation({
    mutationFn: (id) => followUpService.markSent(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['followUps'] }); toast.success('Marked as sent!'); },
  });

  const snoozeMutation = useMutation({
    mutationFn: ({ id, days }) => followUpService.snooze(id, days),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['followUps'] }); toast.success('Snoozed!'); },
  });

  const dismissMutation = useMutation({
    mutationFn: (id) => followUpService.dismiss(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['followUps'] }); toast.success('Dismissed'); },
  });

  const pending = followUps.filter(f => f.status === 'PENDING');
  const snoozed = followUps.filter(f => f.status === 'SNOOZED');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: 'Pending', count: pending.length, icon: Clock, gradient: 'from-blue-500 to-indigo-500', shadow: 'shadow-blue-200/50' },
          { label: 'Snoozed', count: snoozed.length, icon: AlarmClock, gradient: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-200/50' },
          { label: 'Total', count: followUps.length, icon: Bell, gradient: 'from-indigo-500 to-purple-500', shadow: 'shadow-indigo-200/50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-2xl p-5 border border-slate-100 card-hover">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 font-medium">{card.label}</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{card.count}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg ${card.shadow}`}>
                <card.icon size={20} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {['active', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition ${
              filter === f
                ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-200/50'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-300'
            }`}>
            {f === 'active' ? 'Active' : 'All'} Follow-Ups
          </button>
        ))}
      </div>

      {/* Follow-Up List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
      ) : followUps.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center mb-4">
            <Bell size={24} className="text-indigo-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">No follow-ups yet</h3>
          <p className="text-sm text-slate-400">Follow-up reminders are automatically created when your applications hit 7, 14, or 21 days.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {followUps.map(fu => {
            const config = TYPE_CONFIG[fu.type] || TYPE_CONFIG.GENTLE;
            const StatusIcon = STATUS_ICONS[fu.status] || Clock;
            const isExpanded = expandedId === fu.id;

            return (
              <div key={fu.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden card-hover">
                <div className="p-5 flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : fu.id)}>
                  <div className={`w-2 h-2 rounded-full ${config.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-700 truncate">{fu.company}</h4>
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${config.color}`}>{config.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{fu.role} · Due {fu.dueDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {fu.status === 'PENDING' && (
                      <>
                        <button onClick={e => { e.stopPropagation(); sentMutation.mutate(fu.id); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg hover:shadow-lg hover:shadow-indigo-200/50 transition">
                          <Send size={12} /> Send
                        </button>
                        <button onClick={e => { e.stopPropagation(); snoozeMutation.mutate({ id: fu.id, days: 3 }); }}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition">
                          <AlarmClock size={12} /> Snooze
                        </button>
                        <button onClick={e => { e.stopPropagation(); dismissMutation.mutate(fu.id); }}
                          className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition">
                          <XCircle size={14} />
                        </button>
                      </>
                    )}
                    <ChevronDown size={16} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {isExpanded && fu.aiDraftEmail && (
                  <div className="px-5 pb-5 pt-0">
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-indigo-500" />
                          <span className="text-xs font-medium text-slate-600">AI-Drafted Email</span>
                        </div>
                        <button onClick={() => { navigator.clipboard.writeText(fu.aiDraftEmail); toast.success('Copied to clipboard!'); }}
                          className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition">
                          <Copy size={11} /> Copy
                        </button>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{fu.aiDraftEmail}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
