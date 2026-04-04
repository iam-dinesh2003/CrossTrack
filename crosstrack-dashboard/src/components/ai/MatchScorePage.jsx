import { useState } from 'react';
import { Target, Sparkles, FileText, Copy, CheckCircle, AlertTriangle, TrendingUp, Loader2, FileUp } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import aiService from '../../services/aiService';
import resumeService from '../../services/resumeService';
import toast from 'react-hot-toast';

const VERDICT_CONFIG = {
  STRONG_MATCH: { label: 'Strong Match', color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'stroke-emerald-500' },
  GOOD_MATCH: { label: 'Good Match', color: 'text-blue-600', bg: 'bg-blue-50', ring: 'stroke-blue-500' },
  MODERATE_MATCH: { label: 'Moderate Match', color: 'text-amber-600', bg: 'bg-amber-50', ring: 'stroke-amber-500' },
  WEAK_MATCH: { label: 'Weak Match', color: 'text-rose-600', bg: 'bg-rose-50', ring: 'stroke-rose-500' },
};

function ScoreCircle({ score, verdict }) {
  const config = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.MODERATE_MATCH;
  const circumference = 2 * Math.PI * 58;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r="58" fill="none" stroke="#E2E8F0" strokeWidth="8" />
        <circle cx="64" cy="64" r="58" fill="none" className={config.ring} strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-800">{score}</span>
        <span className={`text-[10px] font-medium ${config.color}`}>{config.label}</span>
      </div>
    </div>
  );
}

export default function MatchScorePage() {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [result, setResult] = useState(null);
  const [coverLetter, setCoverLetter] = useState(null);
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');

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

  const matchMutation = useMutation({
    mutationFn: () => aiService.getMatchScore(resumeText, jobDescription),
    onSuccess: (data) => setResult(data),
    onError: () => toast.error('Analysis failed'),
  });

  const coverLetterMutation = useMutation({
    mutationFn: () => aiService.generateCoverLetter({ resumeText, jobDescription, company, role }),
    onSuccess: (data) => { setCoverLetter(data.coverLetter); toast.success('Cover letter generated!'); },
    onError: () => toast.error('Generation failed'),
  });

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

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
      {/* Input Section */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <FileText size={16} className="text-indigo-500" /> Your Resume
            </label>
            {resumes.length > 0 && (
              <div className="flex items-center gap-2">
                <FileUp size={13} className="text-slate-400" />
                <select
                  onChange={e => loadResume(e.target.value)}
                  defaultValue=""
                  className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer hover:bg-indigo-100 transition"
                >
                  <option value="" disabled>Load from saved resumes</option>
                  {resumes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.name} {r.isDefault ? '(Default)' : ''} {!r.hasParsedText ? '— no text' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <textarea value={resumeText} onChange={e => setResumeText(e.target.value)}
            rows={10} placeholder="Paste your resume text here or select a saved resume above..."
            className="w-full px-4 py-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-100">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3">
            <Target size={16} className="text-purple-500" /> Job Description
          </label>
          <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)}
            rows={10} placeholder="Paste the job description here..."
            className="w-full px-4 py-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition" />
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-3">
        <button onClick={() => matchMutation.mutate()} disabled={!resumeText.trim() || !jobDescription.trim() || matchMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl hover:shadow-lg hover:shadow-indigo-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
          {matchMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
          {matchMutation.isPending ? 'Analyzing...' : 'Analyze Match'}
        </button>
        {result && (
          <>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name"
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <input value={role} onChange={e => setRole(e.target.value)} placeholder="Role title"
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-100" />
            <button onClick={() => coverLetterMutation.mutate()} disabled={coverLetterMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition disabled:opacity-50">
              {coverLetterMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Generate Cover Letter
            </button>
          </>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="grid grid-cols-3 gap-5">
          {/* Score */}
          <div className="bg-white rounded-2xl p-6 border border-slate-100 flex flex-col items-center card-hover">
            <ScoreCircle score={result.score} verdict={result.verdict} />
            <p className="text-sm text-slate-500 mt-3 text-center">{result.summary}</p>
          </div>

          {/* Skills */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 card-hover">
            <div className="space-y-4">
              <div>
                <h4 className="flex items-center gap-2 text-xs font-semibold text-emerald-600 mb-2">
                  <CheckCircle size={14} /> Matching Skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(result.matchingSkills || []).map((s, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="flex items-center gap-2 text-xs font-semibold text-rose-600 mb-2">
                  <AlertTriangle size={14} /> Missing Skills
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(result.missingSkills || []).map((s, i) => (
                    <span key={i} className="px-2.5 py-1 text-xs font-medium bg-rose-50 text-rose-700 rounded-full border border-rose-200">{s}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Suggestions */}
          <div className="bg-white rounded-2xl p-5 border border-slate-100 card-hover">
            <h4 className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-3">
              <TrendingUp size={14} /> Suggestions
            </h4>
            <ul className="space-y-2">
              {(result.suggestions || []).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                  <span className="w-5 h-5 mt-0.5 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Cover Letter */}
      {coverLetter && (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 card-hover">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Sparkles size={16} className="text-indigo-500" /> Generated Cover Letter
            </h3>
            <button onClick={() => copyToClipboard(coverLetter)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition">
              <Copy size={12} /> Copy
            </button>
          </div>
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{coverLetter}</p>
          </div>
        </div>
      )}
    </div>
  );
}
