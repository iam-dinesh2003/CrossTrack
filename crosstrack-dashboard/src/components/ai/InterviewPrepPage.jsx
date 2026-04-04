import { useState } from 'react';
import { GraduationCap, Building2, Briefcase, MessageSquare, HelpCircle, Lightbulb, Star, Loader2, FileText, FileUp } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import aiService from '../../services/aiService';
import resumeService from '../../services/resumeService';
import toast from 'react-hot-toast';

export default function InterviewPrepPage() {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [result, setResult] = useState(null);

  const { data: usage } = useQuery({
    queryKey: ['aiUsage'],
    queryFn: () => aiService.getUsage(),
  });
  const aiConfigured = usage?.aiConfigured !== false;

  const { data: resumes = [] } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => resumeService.list(),
  });

  const loadResume = async (id) => {
    if (!id) return;
    try {
      const data = await resumeService.getText(id);
      if (data.text) {
        setResumeText(data.text);
        toast.success(`Loaded "${data.name}" resume`);
      } else {
        toast.error('This resume has no parsed text. Edit it in Resumes page and paste the text.');
      }
    } catch {
      toast.error('Failed to load resume');
    }
  };

  const prepMutation = useMutation({
    mutationFn: () => aiService.getInterviewPrep({ company, role, resumeText }),
    onSuccess: (data) => { setResult(data); toast.success('Interview prep ready!'); },
    onError: () => toast.error('Failed to generate prep'),
  });

  return (
    <div className="space-y-6">
      {/* AI Setup Banner */}
      {!aiConfigured && (
        <div className="px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl flex items-center gap-3">
          <span className="text-amber-500 text-lg">⚠️</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-800">AI not configured</p>
            <p className="text-[11px] text-amber-600">
              Get a free key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="underline font-medium">aistudio.google.com</a>,
              then: <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-mono">AI_API_KEY=your-key ./mvnw spring-boot:run</code>
            </p>
          </div>
        </div>
      )}
      {/* Input */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200/50">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Interview Prep Generator</h2>
            <p className="text-[11px] text-slate-400">AI-powered preparation for your upcoming interview</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Building2 size={13} className="text-indigo-400" /> Company
            </label>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g., Google"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
              <Briefcase size={13} className="text-purple-400" /> Role
            </label>
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="e.g., Software Engineer"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <FileText size={13} className="text-slate-400" /> Resume (optional)
            </label>
            {resumes.length > 0 && (
              <div className="flex items-center gap-1.5">
                <FileUp size={12} className="text-slate-400" />
                <select
                  onChange={e => loadResume(e.target.value)}
                  defaultValue=""
                  className="text-[11px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer hover:bg-indigo-100 transition"
                >
                  <option value="" disabled>Load saved resume</option>
                  {resumes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.isDefault ? '(Default)' : ''} {!r.hasParsedText ? '— no text' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} rows={4}
            placeholder="Paste your resume text or select a saved resume above for personalized STAR story suggestions..."
            className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
        </div>

        <button onClick={() => prepMutation.mutate()} disabled={!company.trim() || !role.trim() || prepMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl hover:shadow-lg hover:shadow-indigo-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {prepMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <GraduationCap size={16} />}
          {prepMutation.isPending ? 'Generating...' : 'Generate Prep Material'}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5">
          {/* Company Overview */}
          {result.companyOverview && (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 card-hover">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <Building2 size={16} className="text-indigo-500" /> Company Overview
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">{result.companyOverview}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            {/* Behavioral Questions */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 card-hover">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <MessageSquare size={16} className="text-blue-500" /> Behavioral Questions
              </h3>
              <ul className="space-y-2.5">
                {(result.behavioralQuestions || []).map((q, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="w-5 h-5 mt-0.5 flex-shrink-0 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-[10px] font-bold">{i + 1}</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            {/* Technical Questions */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 card-hover">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <HelpCircle size={16} className="text-purple-500" /> Technical Questions
              </h3>
              <ul className="space-y-2.5">
                {(result.technicalQuestions || []).map((q, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="w-5 h-5 mt-0.5 flex-shrink-0 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 text-[10px] font-bold">{i + 1}</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* STAR Stories */}
          {(result.starStories || []).length > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 card-hover">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <Star size={16} className="text-amber-500" /> STAR Story Suggestions
              </h3>
              <div className="space-y-3">
                {result.starStories.map((s, i) => (
                  <div key={i} className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
                    <p className="text-xs font-medium text-amber-800 mb-1">Q: {s.question}</p>
                    <p className="text-xs text-amber-700 leading-relaxed">{s.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            {/* Questions to Ask */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 card-hover">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <HelpCircle size={16} className="text-emerald-500" /> Questions to Ask Them
              </h3>
              <ul className="space-y-2">
                {(result.questionsToAsk || []).map((q, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 mt-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>

            {/* Tips */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 card-hover">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
                <Lightbulb size={16} className="text-indigo-500" /> Pro Tips
              </h3>
              <ul className="space-y-2">
                {(result.tips || []).map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                    <span className="w-1.5 h-1.5 mt-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
