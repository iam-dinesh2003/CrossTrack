import { useState } from 'react';
import { StickyNote, Plus, Sparkles, Trash2, ChevronDown, CheckCircle, AlertTriangle, ListTodo, Loader2, Building2, Briefcase, User, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import aiService from '../../services/aiService';
import toast from 'react-hot-toast';

const TYPES = ['PHONE_SCREEN', 'TECHNICAL', 'BEHAVIORAL', 'ONSITE', 'FINAL', 'GENERAL'];
const FEELINGS = [
  { value: 'GREAT', emoji: '🟢', label: 'Great' },
  { value: 'GOOD', emoji: '🔵', label: 'Good' },
  { value: 'NEUTRAL', emoji: '🟡', label: 'Neutral' },
  { value: 'BAD', emoji: '🟠', label: 'Bad' },
  { value: 'TERRIBLE', emoji: '🔴', label: 'Terrible' },
];

const TYPE_COLORS = {
  PHONE_SCREEN: 'bg-blue-50 text-blue-700 border-blue-200',
  TECHNICAL: 'bg-purple-50 text-purple-700 border-purple-200',
  BEHAVIORAL: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ONSITE: 'bg-amber-50 text-amber-700 border-amber-200',
  FINAL: 'bg-rose-50 text-rose-700 border-rose-200',
  GENERAL: 'bg-slate-50 text-slate-600 border-slate-200',
};

export default function InterviewNotesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ company: '', role: '', interviewType: 'GENERAL', interviewerName: '', rawNotes: '', overallFeeling: 'NEUTRAL' });
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['interviewNotes'],
    queryFn: () => aiService.listInterviewNotes(),
  });

  const createMutation = useMutation({
    mutationFn: () => aiService.createInterviewNote(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviewNotes'] });
      setShowCreate(false);
      setForm({ company: '', role: '', interviewType: 'GENERAL', interviewerName: '', rawNotes: '', overallFeeling: 'NEUTRAL' });
      toast.success('Interview note saved!');
    },
    onError: () => toast.error('Failed to save note'),
  });

  const summarizeMutation = useMutation({
    mutationFn: (id) => aiService.summarizeInterviewNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviewNotes'] });
      toast.success('AI summary generated!');
    },
    onError: () => toast.error('Failed to generate summary'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => aiService.deleteInterviewNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interviewNotes'] });
      toast.success('Note deleted');
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-200/50">
            <StickyNote size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Interview Notes</h2>
            <p className="text-[11px] text-slate-400">Record and AI-summarize your interview experiences</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl hover:shadow-lg hover:shadow-teal-200/50 transition-all">
          <Plus size={16} /> New Note
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Record Interview Notes</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><Building2 size={12} /> Company</label>
                  <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Google"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-100 transition" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><Briefcase size={12} /> Role</label>
                  <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="SWE"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-100 transition" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 flex items-center gap-1"><User size={12} /> Interviewer</label>
                  <input value={form.interviewerName} onChange={e => setForm({ ...form, interviewerName: e.target.value })} placeholder="Optional"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-100 transition" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1">Interview Type</label>
                  <select value={form.interviewType} onChange={e => setForm({ ...form, interviewType: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-100 transition">
                    {TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              {/* Feeling */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">How did it go?</label>
                <div className="flex gap-2">
                  {FEELINGS.map(f => (
                    <button key={f.value} onClick={() => setForm({ ...form, overallFeeling: f.value })}
                      className={`flex-1 py-2 rounded-lg text-center border transition ${
                        form.overallFeeling === f.value ? 'border-teal-300 bg-teal-50 ring-2 ring-teal-100' : 'border-slate-200 hover:border-slate-300'
                      }`}>
                      <span className="text-lg">{f.emoji}</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">{f.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Your Notes</label>
                <textarea value={form.rawNotes} onChange={e => setForm({ ...form, rawNotes: e.target.value })} rows={6}
                  placeholder="Write everything you remember... questions asked, your answers, what went well, what didn't, any red flags, vibes..."
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-teal-100 transition" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.company.trim() || !form.role.trim() || createMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-500 to-emerald-500 rounded-xl hover:shadow-lg disabled:opacity-50 transition-all">
                {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <StickyNote size={14} />}
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes List */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-teal-400" /></div>
      ) : notes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center mb-4">
            <StickyNote size={24} className="text-teal-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-700 mb-1">No interview notes yet</h3>
          <p className="text-sm text-slate-400">After each interview, record your notes here and let AI summarize key takeaways.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => {
            const isExpanded = expandedId === note.id;
            const feeling = FEELINGS.find(f => f.value === note.overallFeeling) || FEELINGS[2];
            const typeColor = TYPE_COLORS[note.interviewType] || TYPE_COLORS.GENERAL;

            return (
              <div key={note.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden card-hover">
                {/* Header */}
                <div className="p-5 flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : note.id)}>
                  <span className="text-xl">{feeling.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-700 truncate">{note.company}</h4>
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full border ${typeColor}`}>
                        {(note.interviewType || 'GENERAL').replace('_', ' ')}
                      </span>
                      {note.aiSummary && (
                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
                          AI Summarized
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {note.role}
                      {note.interviewerName && ` · with ${note.interviewerName}`}
                      {note.createdAt && ` · ${new Date(note.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!note.aiSummary && note.rawNotes && (
                      <button onClick={e => { e.stopPropagation(); summarizeMutation.mutate(note.id); }}
                        disabled={summarizeMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition">
                        {summarizeMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        AI Summarize
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(note.id); }}
                      className="p-1.5 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition">
                      <Trash2 size={14} />
                    </button>
                    <ChevronDown size={16} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4">
                    {/* Raw Notes */}
                    {note.rawNotes && (
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <h5 className="text-xs font-semibold text-slate-500 mb-2">Your Notes</h5>
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{note.rawNotes}</p>
                      </div>
                    )}

                    {/* AI Summary */}
                    {note.aiSummary && (
                      <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-100">
                        <h5 className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 mb-2">
                          <Sparkles size={12} /> AI Summary
                        </h5>
                        <p className="text-sm text-slate-700 leading-relaxed">{note.aiSummary}</p>
                      </div>
                    )}

                    {/* AI Generated Sections */}
                    {(note.keyQuestions?.length > 0 || note.wentWell?.length > 0 || note.toImprove?.length > 0) && (
                      <div className="grid grid-cols-2 gap-4">
                        {note.keyQuestions?.length > 0 && (
                          <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                            <h5 className="text-xs font-semibold text-blue-600 mb-2">Questions Asked</h5>
                            <ul className="space-y-1.5">
                              {note.keyQuestions.map((q, i) => (
                                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                  <span className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[9px] font-bold">{i + 1}</span>
                                  {q}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {note.wentWell?.length > 0 && (
                          <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                            <h5 className="flex items-center gap-1 text-xs font-semibold text-emerald-600 mb-2">
                              <CheckCircle size={12} /> Went Well
                            </h5>
                            <ul className="space-y-1.5">
                              {note.wentWell.map((w, i) => (
                                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                  <span className="w-1.5 h-1.5 mt-1 rounded-full bg-emerald-400 flex-shrink-0" />{w}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {note.toImprove?.length > 0 && (
                          <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100">
                            <h5 className="flex items-center gap-1 text-xs font-semibold text-amber-600 mb-2">
                              <AlertTriangle size={12} /> To Improve
                            </h5>
                            <ul className="space-y-1.5">
                              {note.toImprove.map((t, i) => (
                                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                  <span className="w-1.5 h-1.5 mt-1 rounded-full bg-amber-400 flex-shrink-0" />{t}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {note.followUpActions?.length > 0 && (
                          <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
                            <h5 className="flex items-center gap-1 text-xs font-semibold text-purple-600 mb-2">
                              <ListTodo size={12} /> Follow-Up Actions
                            </h5>
                            <ul className="space-y-1.5">
                              {note.followUpActions.map((a, i) => (
                                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                  <span className="w-1.5 h-1.5 mt-1 rounded-full bg-purple-400 flex-shrink-0" />{a}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
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
