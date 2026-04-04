import { useState, useRef, useEffect } from 'react';
import { Mic, Building2, Briefcase, Send, RotateCcw, Loader2, CheckCircle, Star, TrendingUp, AlertTriangle, Trophy, FileUp } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import aiService from '../../services/aiService';
import resumeService from '../../services/resumeService';
import toast from 'react-hot-toast';

const INTERVIEW_TYPES = [
  { value: 'BEHAVIORAL', label: 'Behavioral', desc: 'Tell me about a time...' },
  { value: 'TECHNICAL', label: 'Technical', desc: 'System design, coding, architecture' },
  { value: 'MIXED', label: 'Mixed', desc: 'Both behavioral & technical' },
];

const FEELING_EMOJI = { GREAT: '🟢', GOOD: '🔵', NEUTRAL: '🟡', BAD: '🟠', TERRIBLE: '🔴' };

export default function MockInterviewPage() {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [interviewType, setInterviewType] = useState('BEHAVIORAL');
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  // Interview state
  const [started, setStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionNumber, setQuestionNumber] = useState(1);
  const [questionType, setQuestionType] = useState('');
  const [answer, setAnswer] = useState('');
  const [history, setHistory] = useState([]); // conversation history for context
  const [qaLog, setQaLog] = useState([]); // displayed Q&A log
  const [isComplete, setIsComplete] = useState(false);
  const [wrapUp, setWrapUp] = useState(null);
  const [tips, setTips] = useState('');

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const { data: resumes = [] } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => resumeService.list(),
  });

  const loadResume = async (id) => {
    if (!id) return;
    try {
      const data = await resumeService.getText(id);
      if (data.text) { setResumeText(data.text); toast.success(`Loaded "${data.name}"`); }
      else toast.error('No parsed text for this resume');
    } catch { toast.error('Failed to load resume'); }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [qaLog, started]);

  const startMutation = useMutation({
    mutationFn: () => aiService.startMockInterview({ company, role, interviewType, resumeText, jobDescription }),
    onSuccess: (data) => {
      setStarted(true);
      setCurrentQuestion(data.question);
      setQuestionNumber(data.questionNumber || 1);
      setQuestionType(data.questionType || 'BEHAVIORAL');
      setTips(data.tips || '');
      setQaLog([{ type: 'system', text: data.greeting }]);
      setHistory([{ role: 'assistant', content: `Greeting: ${data.greeting}\nQuestion: ${data.question}` }]);
      toast.success('Mock interview started!');
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: () => toast.error('Failed to start interview'),
  });

  const answerMutation = useMutation({
    mutationFn: (ans) => aiService.answerMockQuestion({
      company, role, interviewType, currentQuestion, answer: ans, questionNumber, history, jobDescription,
    }),
    onSuccess: (data, ans) => {
      const newQa = {
        type: 'qa',
        question: currentQuestion,
        questionType,
        questionNumber,
        answer: ans,
        feedback: data.feedback,
        score: data.score,
        tips,
      };

      setQaLog(prev => [...prev, newQa]);
      setHistory(prev => [
        ...prev,
        { role: 'user', content: ans },
        { role: 'assistant', content: `Feedback: ${data.feedback}\n${data.nextQuestion ? 'Next question: ' + data.nextQuestion : 'Interview complete.'}` },
      ]);

      if (data.isComplete) {
        setIsComplete(true);
        setWrapUp(data.wrapUp);
        setCurrentQuestion('');
      } else {
        setCurrentQuestion(data.nextQuestion);
        setQuestionNumber(data.questionNumber || questionNumber + 1);
        setQuestionType(data.questionType || 'BEHAVIORAL');
        setTips('');
      }
      setAnswer('');
      setTimeout(() => inputRef.current?.focus(), 100);
    },
    onError: () => toast.error('Failed to process answer'),
  });

  const handleSubmitAnswer = () => {
    if (!answer.trim() || answerMutation.isPending) return;
    answerMutation.mutate(answer);
  };

  const resetInterview = () => {
    setStarted(false); setCurrentQuestion(''); setQuestionNumber(1);
    setAnswer(''); setHistory([]); setQaLog([]); setIsComplete(false);
    setWrapUp(null); setTips('');
  };

  // ── Setup Screen ──
  if (!started) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-200/50">
              <Mic size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Mock Interview AI</h2>
              <p className="text-[11px] text-slate-400">Practice with an AI interviewer that gives real-time feedback</p>
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

          {/* Interview Type */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-600 mb-2 block">Interview Type</label>
            <div className="flex gap-3">
              {INTERVIEW_TYPES.map(t => (
                <button key={t.value} onClick={() => setInterviewType(t.value)}
                  className={`flex-1 p-3 rounded-xl border text-left transition ${
                    interviewType === t.value
                      ? 'border-indigo-300 bg-indigo-50 ring-2 ring-indigo-100'
                      : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                  }`}>
                  <p className="text-xs font-semibold text-slate-700">{t.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Job Description */}
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
              <FileUp size={13} className="text-emerald-400" /> Job Description (recommended)
            </label>
            <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value)} rows={4}
              placeholder="Paste the job description here — skills, requirements, responsibilities. This helps generate highly targeted questions based on what the role actually demands..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 transition" />
            {jobDescription.trim() && (
              <p className="text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                <CheckCircle size={10} /> Questions will be tailored to this job's specific requirements
              </p>
            )}
          </div>

          {/* Resume (optional) */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-600">Resume (optional)</label>
              {resumes.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <FileUp size={12} className="text-slate-400" />
                  <select onChange={e => loadResume(e.target.value)} defaultValue=""
                    className="text-[11px] font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1 cursor-pointer hover:bg-indigo-100 transition">
                    <option value="" disabled>Load saved resume</option>
                    {resumes.map(r => (
                      <option key={r.id} value={r.id}>{r.name} {r.isDefault ? '(Default)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <textarea value={resumeText} onChange={e => setResumeText(e.target.value)} rows={3}
              placeholder="Paste resume for personalized questions..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 transition" />
          </div>

          <button onClick={() => startMutation.mutate()} disabled={!company.trim() || !role.trim() || startMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-rose-500 to-orange-500 rounded-xl hover:shadow-lg hover:shadow-rose-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {startMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />}
            {startMutation.isPending ? 'Starting Interview...' : 'Start Mock Interview'}
          </button>
        </div>
      </div>
    );
  }

  // ── Interview In Progress ──
  return (
    <div className="flex flex-col h-[calc(100vh-130px)]">
      {/* Header */}
      <div className="bg-white rounded-2xl p-4 border border-slate-100 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-200/50">
            <Mic size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Mock Interview — {company} ({role})</h2>
            <p className="text-[11px] text-slate-400">{interviewType} Interview · Question #{questionNumber}</p>
          </div>
        </div>
        <button onClick={resetInterview}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 bg-slate-50 rounded-lg hover:bg-slate-100 transition">
          <RotateCcw size={13} /> New Interview
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {qaLog.map((item, i) => (
            <div key={i}>
              {item.type === 'system' && (
                <div className="flex justify-start message-fade-in">
                  <div className="max-w-[80%] px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-md">
                    <p className="text-sm text-slate-700">{item.text}</p>
                  </div>
                </div>
              )}
              {item.type === 'qa' && (
                <div className="space-y-3">
                  {/* Question */}
                  <div className="flex justify-start message-fade-in">
                    <div className="max-w-[80%] px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-md">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Q{item.questionNumber}</span>
                        <span className="text-[10px] text-slate-400">{item.questionType}</span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium">{item.question}</p>
                    </div>
                  </div>
                  {/* Answer */}
                  <div className="flex justify-end message-fade-in">
                    <div className="max-w-[80%] px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-2xl rounded-br-md">
                      <p className="text-sm whitespace-pre-wrap">{item.answer}</p>
                    </div>
                  </div>
                  {/* Feedback */}
                  <div className="flex justify-start message-fade-in">
                    <div className="max-w-[80%] px-4 py-3 bg-amber-50 border border-amber-100 rounded-2xl rounded-bl-md">
                      <div className="flex items-center gap-2 mb-1">
                        <Star size={12} className="text-amber-500" />
                        <span className="text-[10px] font-bold text-amber-700">Score: {item.score}/10</span>
                      </div>
                      <p className="text-sm text-amber-800">{item.feedback}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Current Question */}
          {currentQuestion && !isComplete && (
            <div className="flex justify-start message-fade-in">
              <div className="max-w-[80%] px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Q{questionNumber}</span>
                  <span className="text-[10px] text-slate-400">{questionType}</span>
                </div>
                <p className="text-sm text-slate-700 font-medium">{currentQuestion}</p>
              </div>
            </div>
          )}

          {/* Loading */}
          {answerMutation.isPending && (
            <div className="flex justify-start message-fade-in">
              <div className="bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="typing-dot"></div>
                    <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <span className="text-[10px] text-slate-400">Evaluating your answer...</span>
                </div>
              </div>
            </div>
          )}

          {/* Wrap-Up / Results */}
          {isComplete && wrapUp && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100 message-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <Trophy size={24} className="text-indigo-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-800">Interview Complete!</h3>
                  <p className="text-xs text-slate-500">Here's your performance summary</p>
                </div>
                <div className="ml-auto text-3xl font-bold text-indigo-600">{wrapUp.overallScore}/100</div>
              </div>

              <p className="text-sm text-slate-600 mb-4 leading-relaxed">{wrapUp.overallFeedback}</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 border border-emerald-100">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mb-2">
                    <CheckCircle size={13} /> Strengths
                  </h4>
                  <ul className="space-y-1.5">
                    {(wrapUp.strengths || []).map((s, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 mt-1 rounded-full bg-emerald-400 flex-shrink-0" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-white rounded-xl p-4 border border-amber-100">
                  <h4 className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 mb-2">
                    <TrendingUp size={13} /> Areas to Improve
                  </h4>
                  <ul className="space-y-1.5">
                    {(wrapUp.improvements || []).map((s, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="w-1.5 h-1.5 mt-1 rounded-full bg-amber-400 flex-shrink-0" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button onClick={resetInterview}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl hover:shadow-lg transition-all">
                <RotateCcw size={14} /> Start New Interview
              </button>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        {!isComplete && (
          <div className="px-6 py-4 border-t border-slate-100">
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitAnswer(); } }}
                placeholder="Type your answer... (Shift+Enter for new line)"
                rows={3}
                className="flex-1 px-4 py-3 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition"
              />
              <button onClick={handleSubmitAnswer} disabled={answerMutation.isPending || !answer.trim()}
                className="p-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-200/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {answerMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
