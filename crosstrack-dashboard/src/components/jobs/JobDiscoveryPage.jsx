import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Sparkles, MapPin, ExternalLink, CheckCircle, Briefcase, Zap, Clock,
  DollarSign, FileText, X, Target, AlertTriangle, TrendingUp, Loader2,
  ChevronDown, Copy, FileUp,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import * as jobService from '../../services/jobDiscoveryService';
import resumeService from '../../services/resumeService';
import aiService from '../../services/aiService';

// ── static data ─────────────────────────────────────────────────────────────

const EMP_TYPES = [
  { key: '',           label: 'All Types'   },
  { key: 'FULLTIME',   label: 'Full-Time'   },
  { key: 'PARTTIME',   label: 'Part-Time'   },
  { key: 'INTERN',     label: 'Internship'  },
  { key: 'CONTRACTOR', label: 'Contract'    },
];

const EXP_LEVELS = [
  { key: '',       label: 'Any Level'   },
  { key: 'entry',  label: 'Entry Level' },
  { key: 'mid',    label: 'Mid Level'   },
  { key: 'senior', label: 'Senior'      },
];

const DATE_FILTERS = [
  { key: '',    label: 'Any Time'  },
  { key: '1',   label: 'Last 24h'  },
  { key: '3',   label: 'Last 3 Days' },
  { key: '7',   label: 'Last Week' },
];

const SALARY_RANGES = [
  { key: '',          label: 'Any Salary'  },
  { key: '0-50000',   label: 'Up to $50k'  },
  { key: '50000-80000', label: '$50k–$80k' },
  { key: '80000-120000', label: '$80k–$120k' },
  { key: '120000-999999', label: '$120k+'  },
];

const COMPANY_TYPES = [
  { key: '',           label: 'Any Company'  },
  { key: 'startup',    label: 'Startup'      },
  { key: 'midsize',    label: 'Mid-size'     },
  { key: 'enterprise', label: 'Enterprise'   },
];

const PORTAL_FILTERS = [
  { key: 'COMPANY',      label: '🏢 Company Site' },
  { key: 'LINKEDIN',     label: 'in LinkedIn'     },
  { key: 'INDEED',       label: '🔵 Indeed'       },
  { key: 'GLASSDOOR',    label: '🟢 Glassdoor'    },
  { key: 'ZIPRECRUITER', label: '🟣 ZipRecruiter' },
  { key: 'HANDSHAKE',    label: '🟠 Handshake'    },
];

const VERDICT_CONFIG = {
  STRONG_MATCH:   { label: 'Strong Match',   color: 'text-emerald-600', ring: 'stroke-emerald-500' },
  GOOD_MATCH:     { label: 'Good Match',     color: 'text-blue-600',    ring: 'stroke-blue-500'    },
  MODERATE_MATCH: { label: 'Moderate Match', color: 'text-amber-600',   ring: 'stroke-amber-500'   },
  WEAK_MATCH:     { label: 'Weak Match',     color: 'text-rose-600',    ring: 'stroke-rose-500'    },
};

const LINK_SOURCE_LABEL = {
  COMPANY:      { label: 'Company Site', color: 'text-emerald-600' },
  LINKEDIN:     { label: 'LinkedIn',     color: 'text-blue-500'    },
  INDEED:       { label: 'Indeed',       color: 'text-indigo-500'  },
  GLASSDOOR:    { label: 'Glassdoor',    color: 'text-green-500'   },
  ZIPRECRUITER: { label: 'ZipRecruiter', color: 'text-violet-500'  },
  OTHER:        { label: 'Apply',        color: 'text-slate-400'   },
};

// ── helpers ──────────────────────────────────────────────────────────────────

function formatSalary(min, max, currency, period) {
  if (!min && !max) return null;
  const fmt = n => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${Math.round(n)}`);
  const p = period === 'HOUR' ? '/hr' : period === 'MONTH' ? '/mo' : '/yr';
  if (min && max) return `${fmt(min)} – ${fmt(max)}${p}`;
  if (min)        return `${fmt(min)}+${p}`;
  return `Up to ${fmt(max)}${p}`;
}

function timeAgo(isoString) {
  if (!isoString) return null;
  const diff  = Date.now() - new Date(isoString).getTime();
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (hours < 1)  return { label: 'Just now',   fresh: true  };
  if (hours < 24) return { label: `${hours}h ago`, fresh: true  };
  if (days === 1) return { label: 'Yesterday',  fresh: true  };
  if (days < 7)   return { label: `${days}d ago`, fresh: false };
  if (days < 30)  return { label: `${Math.floor(days / 7)}w ago`, fresh: false };
  return { label: `${Math.floor(days / 30)}mo ago`, fresh: false };
}

// ── sub-components ────────────────────────────────────────────────────────────

function MatchBadge({ score }) {
  if (score == null) return null;
  const color = score >= 80 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
              : score >= 60 ? 'bg-amber-100 text-amber-700 border-amber-200'
              :               'bg-slate-100 text-slate-500 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${color}`}>
      ✦ {score}% match
    </span>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={clsx(
        'px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border whitespace-nowrap',
        active
          ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
          : 'text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-50'
      )}>
      {label}
    </button>
  );
}

function ScoreCircle({ score, verdict }) {
  const cfg = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.MODERATE_MATCH;
  const circ = 2 * Math.PI * 40;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r="40" fill="none" stroke="#E2E8F0" strokeWidth="6" />
        <circle cx="44" cy="44" r="40" fill="none" className={cfg.ring} strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-800">{score}</span>
        <span className={`text-[9px] font-semibold ${cfg.color}`}>{cfg.label}</span>
      </div>
    </div>
  );
}

function JobCard({ job, onClick, appliedIds }) {
  const isApplied = appliedIds.has(job.jobId);
  const salary    = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const posted    = timeAgo(job.postedAt);
  const initial   = (job.company || '?').charAt(0).toUpperCase();

  return (
    <div
      onClick={() => onClick(job)}
      className={clsx(
        'card-premium rounded-2xl p-5 flex flex-col gap-3 transition-all hover:shadow-md group relative overflow-hidden cursor-pointer',
        isApplied && 'opacity-70'
      )}>
      {/* top-right badge */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5">
        {isApplied
          ? <span className="flex items-center gap-1 text-emerald-600 text-[11px] font-semibold"><CheckCircle size={13} /> Tracked</span>
          : <MatchBadge score={job.matchScore} />
        }
      </div>

      {/* header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[15px] flex-shrink-0 shadow-sm">
          {initial}
        </div>
        <div className="flex-1 min-w-0 pr-16">
          <h3 className="text-[14px] font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-indigo-600 transition-colors">
            {job.title}
          </h3>
          <p className="text-[13px] text-slate-500 mt-0.5">{job.company}</p>
        </div>
      </div>

      {/* meta badges */}
      <div className="flex flex-wrap gap-1.5">
        {job.remote && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
            🌐 Remote
          </span>
        )}
        {job.location && !job.remote && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-100">
            <MapPin size={10} /> {job.location}
          </span>
        )}
        {job.employmentType && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
            <Briefcase size={10} />
            {job.employmentType === 'FULLTIME' ? 'Full-Time'
              : job.employmentType === 'PARTTIME' ? 'Part-Time'
              : job.employmentType === 'INTERN'   ? 'Internship'
              : job.employmentType}
          </span>
        )}
      </div>

      {/* salary + time */}
      <div className="flex items-center gap-3 text-[12px]">
        {salary && (
          <span className="flex items-center gap-1 text-emerald-600 font-medium">
            <DollarSign size={12} /> {salary}
          </span>
        )}
        {posted && (
          <span className={clsx('flex items-center gap-1 font-medium', posted.fresh ? 'text-emerald-500' : 'text-slate-400')}>
            <Clock size={11} /> {posted.label}
            {posted.fresh && <span className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full border border-emerald-100 ml-0.5">NEW</span>}
          </span>
        )}
      </div>

      {/* match reason or snippet */}
      {job.matchReason ? (
        <p className="text-[11px] text-indigo-500 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100 leading-relaxed">
          ✦ {job.matchReason}
        </p>
      ) : job.snippet ? (
        <p className="text-[12px] text-slate-400 line-clamp-2 leading-relaxed">{job.snippet}</p>
      ) : null}

      {/* view details hint */}
      <div className="mt-auto pt-1 flex items-center justify-between text-[12px]">
        <span className="text-indigo-500 font-medium group-hover:underline">View details & AI tools →</span>
        {job.applyLink && (
          <a href={job.applyLink} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50">
            <ExternalLink size={12} /> Apply
          </a>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card-premium rounded-2xl p-5 space-y-3 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 bg-slate-100 rounded w-3/4" />
          <div className="h-3 bg-slate-100 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-5 bg-slate-100 rounded-full w-16" />
        <div className="h-5 bg-slate-100 rounded-full w-20" />
      </div>
      <div className="h-3 bg-slate-100 rounded w-full" />
      <div className="h-3 bg-slate-100 rounded w-4/5" />
      <div className="h-9 bg-slate-100 rounded-xl" />
    </div>
  );
}

// ── Job AI Panel ──────────────────────────────────────────────────────────────

function JobAIPanel({ job, onClose, onApply, appliedIds }) {
  const isApplied  = appliedIds.has(job.jobId);
  const salary     = formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod);
  const posted     = timeAgo(job.postedAt);
  const linkInfo   = LINK_SOURCE_LABEL[job.applyLinkSource] || LINK_SOURCE_LABEL.OTHER;

  const [resumes, setResumes]               = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [resumeText, setResumeText]         = useState('');
  const [matchResult, setMatchResult]       = useState(null);
  const [coverLetter, setCoverLetter]       = useState(null);
  const [copiedCL, setCopiedCL]             = useState(false);

  // use job's pre-computed score if available, until user runs detailed
  const quickScore  = job.matchScore;
  const quickReason = job.matchReason;

  useEffect(() => {
    resumeService.list().then(data => {
      setResumes(data || []);
      const def = (data || []).find(r => r.isDefault);
      if (def) setSelectedResumeId(def.id);
    }).catch(() => {});
  }, []);

  const loadResumeText = async (id) => {
    if (!id) return;
    try {
      const data = await resumeService.getText(id);
      if (data.text) setResumeText(data.text);
    } catch {}
  };

  useEffect(() => {
    if (selectedResumeId) loadResumeText(selectedResumeId);
  }, [selectedResumeId]);

  const jd = job.description || job.snippet || `${job.title} at ${job.company}. ${job.snippet || ''}`;

  const matchMutation = useMutation({
    mutationFn: () => aiService.getMatchScore(resumeText, jd),
    onSuccess: (data) => setMatchResult(data),
    onError: () => toast.error('Analysis failed'),
  });

  const clMutation = useMutation({
    mutationFn: () => aiService.generateCoverLetter({ resumeText, jobDescription: jd, company: job.company, role: job.title }),
    onSuccess: (data) => { setCoverLetter(data.coverLetter); toast.success('Cover letter ready!'); },
    onError: () => toast.error('Generation failed'),
  });

  const copyCoverLetter = () => {
    navigator.clipboard.writeText(coverLetter);
    setCopiedCL(true);
    setTimeout(() => setCopiedCL(false), 2000);
    toast.success('Copied!');
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* panel */}
      <div className="w-full max-w-md bg-white h-full flex flex-col overflow-hidden shadow-2xl">
        {/* colour bar */}
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 flex-shrink-0" />

        {/* header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[15px] flex-shrink-0 shadow-sm">
              {(job.company || '?').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-[14px] font-bold text-slate-900 leading-snug">{job.title}</h2>
              <p className="text-[13px] text-slate-500">{job.company}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition p-1 ml-2 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* job meta */}
          <div className="flex flex-wrap gap-1.5">
            {job.remote && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">🌐 Remote</span>
            )}
            {job.location && !job.remote && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-50 text-slate-600 border border-slate-100">
                <MapPin size={10} /> {job.location}
              </span>
            )}
            {job.employmentType && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Briefcase size={10} />
                {job.employmentType === 'FULLTIME' ? 'Full-Time'
                  : job.employmentType === 'PARTTIME' ? 'Part-Time'
                  : job.employmentType === 'INTERN' ? 'Internship'
                  : job.employmentType}
              </span>
            )}
            {salary && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                <DollarSign size={10} /> {salary}
              </span>
            )}
            {posted && (
              <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
                posted.fresh ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100')}>
                <Clock size={10} /> {posted.label}
              </span>
            )}
          </div>

          {/* snippet */}
          {job.snippet && (
            <p className="text-[13px] text-slate-500 leading-relaxed bg-slate-50 rounded-xl px-3.5 py-3 border border-slate-100">
              {job.snippet}
            </p>
          )}

          {/* resume selector */}
          {resumes.length > 0 && (
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <FileUp size={12} /> Resume for AI analysis
              </label>
              <select
                value={selectedResumeId || ''}
                onChange={e => setSelectedResumeId(Number(e.target.value))}
                className="w-full text-[13px] px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 bg-white">
                {resumes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* ── Match Score card ─────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <h3 className="text-[13px] font-semibold text-slate-700 flex items-center gap-2">
                <Target size={14} className="text-indigo-500" /> Match Score
              </h3>
              {!matchResult && (
                <button
                  onClick={() => matchMutation.mutate()}
                  disabled={!resumeText || matchMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg hover:shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed">
                  {matchMutation.isPending
                    ? <><Loader2 size={12} className="animate-spin" /> Analyzing…</>
                    : <><Sparkles size={12} /> Analyze</>
                  }
                </button>
              )}
            </div>

            <div className="px-4 pb-4">
              {/* quick score from search (before detailed run) */}
              {!matchResult && quickScore != null && (
                <div className="flex items-center gap-3 py-2">
                  <MatchBadge score={quickScore} />
                  {quickReason && <p className="text-[12px] text-indigo-500 leading-relaxed">✦ {quickReason}</p>}
                  <p className="text-[11px] text-slate-400 ml-auto">Run Analyze for full breakdown</p>
                </div>
              )}
              {!matchResult && quickScore == null && !matchMutation.isPending && (
                <p className="text-[12px] text-slate-400 py-2">
                  {resumeText ? 'Click Analyze to check how well this job fits your resume.' : 'Select a resume above to enable analysis.'}
                </p>
              )}
              {matchMutation.isPending && (
                <div className="flex items-center gap-2 py-3 text-[12px] text-indigo-500">
                  <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                  Analyzing fit with your resume…
                </div>
              )}
              {matchResult && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center gap-4">
                    <ScoreCircle score={matchResult.score} verdict={matchResult.verdict} />
                    <p className="text-[12px] text-slate-500 leading-relaxed">{matchResult.summary}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1 mb-1.5">
                        <CheckCircle size={11} /> Matching
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(matchResult.matchingSkills || []).map((s, i) => (
                          <span key={i} className="px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mb-1.5">
                        <AlertTriangle size={11} /> Missing
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(matchResult.missingSkills || []).map((s, i) => (
                          <span key={i} className="px-2 py-0.5 text-[10px] font-medium bg-rose-50 text-rose-700 rounded-full border border-rose-200">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  {(matchResult.suggestions || []).length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1 mb-1.5">
                        <TrendingUp size={11} /> Suggestions
                      </p>
                      <ul className="space-y-1.5">
                        {matchResult.suggestions.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600 leading-relaxed">
                            <span className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-[9px] font-bold">{i + 1}</span>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Cover Letter card ─────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
              <h3 className="text-[13px] font-semibold text-slate-700 flex items-center gap-2">
                <FileText size={14} className="text-purple-500" /> Cover Letter
              </h3>
              {!coverLetter && (
                <button
                  onClick={() => clMutation.mutate()}
                  disabled={!resumeText || clMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                  {clMutation.isPending
                    ? <><Loader2 size={12} className="animate-spin" /> Generating…</>
                    : <><Sparkles size={12} /> Generate</>
                  }
                </button>
              )}
              {coverLetter && (
                <button onClick={copyCoverLetter}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition">
                  {copiedCL ? <CheckCircle size={12} /> : <Copy size={12} />}
                  {copiedCL ? 'Copied!' : 'Copy'}
                </button>
              )}
            </div>
            <div className="px-4 pb-4">
              {clMutation.isPending && (
                <div className="flex items-center gap-2 py-3 text-[12px] text-indigo-500">
                  <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                  Writing cover letter based on your resume…
                </div>
              )}
              {!coverLetter && !clMutation.isPending && (
                <p className="text-[12px] text-slate-400 py-2">
                  {resumeText ? 'Generate a personalized cover letter for this role.' : 'Select a resume above to generate a cover letter.'}
                </p>
              )}
              {coverLetter && (
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 max-h-64 overflow-y-auto">
                  <p className="text-[12px] text-slate-600 leading-relaxed whitespace-pre-wrap">{coverLetter}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* sticky footer actions */}
        <div className="flex-shrink-0 border-t border-slate-100 px-5 py-3 flex gap-2 bg-white">
          <button
            onClick={() => onApply(job)}
            disabled={isApplied}
            className={clsx(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all',
              isApplied
                ? 'bg-emerald-50 text-emerald-600 cursor-default'
                : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-md hover:shadow-indigo-500/20'
            )}>
            {isApplied ? <><CheckCircle size={14} /> Tracked</> : <><Zap size={14} /> Track Application</>}
          </button>
          {job.applyLink && (
            <a href={job.applyLink} target="_blank" rel="noopener noreferrer"
              className={clsx(
                'flex items-center justify-center gap-1 px-4 rounded-xl border text-[12px] font-medium transition-all hover:shadow-sm',
                job.applyLinkSource === 'COMPANY'
                  ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                  : 'border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200'
              )}>
              <ExternalLink size={13} />
              <span className={linkInfo.color}>{linkInfo.label}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function JobDiscoveryPage() {
  const qc = useQueryClient();

  // search state
  const [draftQuery,      setDraftQuery]      = useState('');
  const [location,        setLocation]        = useState('');
  const [remote,          setRemote]          = useState(false);
  const [empType,         setEmpType]         = useState('');
  const [expLevel,        setExpLevel]        = useState('');
  const [dateFilter,      setDateFilter]      = useState('');
  const [salaryRange,     setSalaryRange]     = useState('');
  const [companyType,     setCompanyType]     = useState('');
  const [selectedPortals, setSelectedPortals] = useState(new Set());
  const [showFilters,     setShowFilters]     = useState(false);

  const [page,         setPage]         = useState(1);
  const [appliedIds,   setAppliedIds]   = useState(new Set());
  const [triggered,    setTriggered]    = useState(false);
  const [searchParams, setSearchParams] = useState(null);

  // match modal
  const [showMatchModal,    setShowMatchModal]    = useState(false);
  const [modalResumes,      setModalResumes]      = useState([]);
  const [selectedResumeId,  setSelectedResumeId]  = useState(null);
  const [modalRole,         setModalRole]         = useState('');

  // AI panel
  const [selectedJob, setSelectedJob] = useState(null);

  useEffect(() => {
    if (showMatchModal) {
      resumeService.list().then(data => {
        setModalResumes(data || []);
        const def = (data || []).find(r => r.isDefault);
        if (def && selectedResumeId == null) setSelectedResumeId(def.id);
      }).catch(() => {});
      setModalRole(draftQuery);
    }
  }, [showMatchModal]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['job-discovery', searchParams],
    queryFn: () => jobService.discoverJobs(searchParams),
    enabled: !!searchParams,
    staleTime: 5 * 60 * 1000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
  });

  const applyMutation = useMutation({
    mutationFn: jobService.quickApply,
    onSuccess: (res, variables) => {
      if (res.duplicate) {
        toast(res.message, { icon: '⚠️' });
      } else {
        toast.success(res.message);
        setAppliedIds(prev => new Set([...prev, variables._jobId]));
        qc.invalidateQueries(['applications']);
      }
    },
    onError: () => toast.error('Failed to track application'),
  });

  const handleMatchJobs = () => setShowMatchModal(true);

  const confirmMatch = () => {
    const [salMin, salMax] = salaryRange ? salaryRange.split('-').map(Number) : [null, null];
    const params = {
      query:          modalRole.trim() || draftQuery.trim(),
      page,
      location:       location.trim(),
      remote,
      employmentType: empType,
      publishers:     [...selectedPortals].join(','),
      resumeId:       selectedResumeId,
      experienceLevel: expLevel,
      datePosted:     dateFilter,
      salaryMin:      salMin || undefined,
      salaryMax:      salMax || undefined,
      companyType,
    };
    setDraftQuery(modalRole.trim() || draftQuery.trim());
    setSearchParams(params);
    setTriggered(true);
    setShowMatchModal(false);
  };

  const togglePortal = key => {
    setSelectedPortals(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleApply = useCallback((job) => {
    applyMutation.mutate({
      _jobId:     job.jobId,
      company:    job.company,
      role:       job.title,
      platform:   job.publisher || 'OTHER',
      url:        job.applyLink,
      location:   job.location,
      salaryRange: formatSalary(job.salaryMin, job.salaryMax, job.salaryCurrency, job.salaryPeriod),
    });
    if (job.applyLink) window.open(job.applyLink, '_blank', 'noopener,noreferrer');
  }, [applyMutation]);

  const jobs          = data?.jobs || [];
  const apiKeyMissing = data?.apiKeyMissing;
  const usedQuery     = data?.usedQuery;
  const isSearching   = isLoading || isFetching;

  const activeFilterCount = [empType, expLevel, dateFilter, salaryRange, companyType, remote ? '1' : ''].filter(Boolean).length
    + selectedPortals.size;

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles size={18} className="text-white" />
          </span>
          Job Discovery
        </h1>
        <p className="text-[14px] text-slate-400 mt-1">
          AI matches jobs from 20+ portals to your resume — only listings from the last 3 days.
        </p>
      </div>

      {/* Search + Filter Panel */}
      <div className="card-premium rounded-2xl p-4 sm:p-5 space-y-4">

        {/* Row 1: search + location */}
        <div className="flex gap-2 sm:gap-3 flex-col sm:flex-row">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Job title, skills… (blank = auto-detect from your profile)"
              value={draftQuery} onChange={e => setDraftQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleMatchJobs()}
              className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300" />
          </div>
          <div className="relative sm:w-44">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Location (optional)"
              value={location} onChange={e => setLocation(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleMatchJobs()}
              className="w-full pl-8 pr-4 py-2.5 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-300 placeholder:text-slate-300" />
          </div>
        </div>

        {/* Row 2: job type */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-20 flex-shrink-0">Job Type</span>
          <div className="flex flex-wrap gap-1.5">
            {EMP_TYPES.map(t => (
              <FilterChip key={t.key} label={t.label} active={empType === t.key} onClick={() => setEmpType(t.key)} />
            ))}
            <FilterChip label="🌐 Remote Only" active={remote} onClick={() => setRemote(!remote)} />
          </div>
        </div>

        {/* Row 3: portals */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-20 flex-shrink-0">Portals</span>
          <div className="flex flex-wrap gap-1.5">
            <FilterChip label="All Portals" active={selectedPortals.size === 0} onClick={() => setSelectedPortals(new Set())} />
            {PORTAL_FILTERS.map(p => (
              <FilterChip key={p.key} label={p.label} active={selectedPortals.has(p.key)} onClick={() => togglePortal(p.key)} />
            ))}
          </div>
        </div>

        {/* More filters toggle */}
        <div className="border-t border-slate-100 pt-3">
          <button type="button" onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-indigo-600 hover:text-indigo-700 transition">
            <ChevronDown size={14} className={clsx('transition-transform', showFilters && 'rotate-180')} />
            {showFilters ? 'Hide filters' : 'More filters'}
            {activeFilterCount > 0 && !showFilters && (
              <span className="ml-1 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="space-y-3 pt-1 border-t border-slate-100">
            {/* experience level */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-20 flex-shrink-0">Experience</span>
              <div className="flex flex-wrap gap-1.5">
                {EXP_LEVELS.map(l => (
                  <FilterChip key={l.key} label={l.label} active={expLevel === l.key} onClick={() => setExpLevel(l.key)} />
                ))}
              </div>
            </div>
            {/* date posted */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-20 flex-shrink-0">Posted</span>
              <div className="flex flex-wrap gap-1.5">
                {DATE_FILTERS.map(d => (
                  <FilterChip key={d.key} label={d.label} active={dateFilter === d.key} onClick={() => setDateFilter(d.key)} />
                ))}
              </div>
            </div>
            {/* salary */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-20 flex-shrink-0">Salary</span>
              <div className="flex flex-wrap gap-1.5">
                {SALARY_RANGES.map(s => (
                  <FilterChip key={s.key} label={s.label} active={salaryRange === s.key} onClick={() => setSalaryRange(s.key)} />
                ))}
              </div>
            </div>
            {/* company type */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide w-20 flex-shrink-0">Company</span>
              <div className="flex flex-wrap gap-1.5">
                {COMPANY_TYPES.map(c => (
                  <FilterChip key={c.key} label={c.label} active={companyType === c.key} onClick={() => setCompanyType(c.key)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Match Jobs button row */}
        <div className="pt-1 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
          {usedQuery && (
            <p className="text-[12px] text-indigo-500 flex items-center gap-1">
              <Sparkles size={11} /> Auto-searching: <span className="font-semibold">"{usedQuery}"</span>
            </p>
          )}
          <button type="button" onClick={handleMatchJobs} disabled={isSearching}
            className="ml-auto flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[13px] font-semibold hover:shadow-lg hover:shadow-indigo-500/30 transition-all btn-press disabled:opacity-60 disabled:cursor-not-allowed">
            {isSearching
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Matching jobs…</>
              : <><Sparkles size={14} /> Match Jobs</>
            }
          </button>
        </div>
      </div>

      {/* API key missing */}
      {apiKeyMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-2">
          <p className="text-[14px] font-semibold text-amber-800">RapidAPI Key Not Configured</p>
          <p className="text-[13px] text-amber-600">
            Get a free key at{' '}
            <a href="https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch" target="_blank" rel="noopener noreferrer" className="underline font-medium">rapidapi.com/jsearch</a>
            {' '}(200 free/month), restart with:
          </p>
          <code className="block bg-amber-100 text-amber-900 text-[12px] font-mono px-3 py-2 rounded-lg">
            export RAPIDAPI_KEY="your-key" && ./mvnw spring-boot:run
          </code>
        </div>
      )}

      {/* Loading skeletons */}
      {isSearching && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[13px] text-indigo-500">
            <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
            Fetching jobs + AI scoring against your resume… (~25s)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {/* Empty states */}
      {!isSearching && !triggered && (
        <div className="text-center py-20 text-slate-400">
          <Briefcase size={44} className="mx-auto mb-4 opacity-20" />
          <p className="text-[15px] font-medium text-slate-500">Set your filters and click Match Jobs</p>
          <p className="text-[13px] mt-1">AI will rank results by how well they match your resume</p>
        </div>
      )}
      {!isSearching && triggered && jobs.length === 0 && !apiKeyMissing && (
        <div className="text-center py-20 text-slate-400">
          <Briefcase size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-[15px]">No jobs found. Try removing filters or changing keywords.</p>
        </div>
      )}

      {/* Results */}
      {!isSearching && jobs.length > 0 && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[13px] text-slate-400">
              {jobs.length} jobs matched{usedQuery ? ` for "${usedQuery}"` : ''} · last 3 days
            </p>
            <div className="flex items-center gap-2">
              {jobs.some(j => j.matchScore != null) && (
                <span className="text-[11px] text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 flex items-center gap-1">
                  <Sparkles size={11} /> AI-ranked by resume match
                </span>
              )}
              <p className="text-[12px] text-slate-300">Page {page}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {jobs.map(job => (
              <JobCard key={job.jobId} job={job} onClick={setSelectedJob} appliedIds={appliedIds} />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-3 pt-2">
            <button onClick={() => { setPage(p => Math.max(1, p - 1)); handleMatchJobs(); }} disabled={page === 1}
              className="px-4 py-2 rounded-xl text-[13px] text-slate-500 border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition-all">
              ← Prev
            </button>
            <span className="px-4 py-2 text-[13px] text-slate-400">Page {page}</span>
            <button onClick={() => { setPage(p => p + 1); handleMatchJobs(); }} disabled={jobs.length < 10}
              className="px-4 py-2 rounded-xl text-[13px] text-slate-500 border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition-all">
              Next →
            </button>
          </div>
        </>
      )}

      {/* Match Modal */}
      {showMatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 relative">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-t-3xl" />
            <button onClick={() => setShowMatchModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition">
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-slate-900">Match Jobs</h2>
                <p className="text-[12px] text-slate-400">Select a resume and role for AI matching</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Target Role / Job Title</label>
              <input type="text" value={modalRole} onChange={e => setModalRole(e.target.value)}
                placeholder="e.g. Software Engineer, Data Analyst… (blank = auto-detect)"
                className="w-full px-3.5 py-2.5 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-300" />
            </div>
            <div className="mb-6">
              <label className="block text-[12px] font-semibold text-slate-600 mb-2">Resume for AI Matching</label>
              {modalResumes.length === 0 ? (
                <p className="text-[12px] text-slate-400 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                  No resumes uploaded yet. AI will score based on your profile.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {modalResumes.map(r => (
                    <button key={r.id} type="button" onClick={() => setSelectedResumeId(r.id)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all',
                        selectedResumeId === r.id
                          ? 'border-indigo-300 bg-indigo-50/70 ring-2 ring-indigo-100'
                          : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'
                      )}>
                      <FileText size={15} className={selectedResumeId === r.id ? 'text-indigo-500' : 'text-slate-400'} />
                      <span className="flex-1 text-[13px] font-medium text-slate-700 truncate">{r.name}</span>
                      {r.isDefault && (
                        <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">Default</span>
                      )}
                      {selectedResumeId === r.id && <CheckCircle size={14} className="text-indigo-500 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={confirmMatch}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold text-[14px] hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2">
              <Sparkles size={15} /> Find Matches
            </button>
          </div>
        </div>
      )}

      {/* AI Panel */}
      {selectedJob && (
        <JobAIPanel
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
          onApply={handleApply}
          appliedIds={appliedIds}
        />
      )}
    </div>
  );
}
