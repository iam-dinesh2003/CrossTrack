import { Calendar, Clock, MapPin, Zap } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import clsx from 'clsx';

export default function InterviewSchedule({ applications = [] }) {
  const interviews = applications
    .filter(app => app.status === 'INTERVIEW')
    .sort((a, b) => {
      if (a.interviewDate && b.interviewDate) return new Date(a.interviewDate) - new Date(b.interviewDate);
      if (a.interviewDate) return -1;
      if (b.interviewDate) return 1;
      return new Date(b.appliedAt) - new Date(a.appliedAt);
    })
    .slice(0, 5);

  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-gray-900 text-[15px] tracking-tight">Upcoming Interviews</h3>
          <p className="text-[11px] text-gray-400 mt-0.5">Your scheduled interviews</p>
        </div>
        <div className="p-2 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg">
          <Calendar size={16} className="text-indigo-500" />
        </div>
      </div>

      {interviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
          <div className="empty-state-circle w-14 h-14 rounded-2xl flex items-center justify-center mb-3">
            <Calendar size={22} className="text-indigo-300" />
          </div>
          <p className="text-sm font-semibold text-gray-500">No interviews scheduled</p>
          <p className="text-xs mt-1 text-gray-400">Keep applying — you'll get there!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {interviews.map(app => {
            const hasDate = !!app.interviewDate;
            const interviewDate = hasDate ? new Date(app.interviewDate) : null;
            const past = hasDate && isPast(interviewDate) && !isToday(interviewDate);
            const today = hasDate && isToday(interviewDate);

            return (
              <div key={app.id} className={clsx(
                'p-3.5 rounded-xl border transition-all',
                past ? 'bg-gray-50/80 border-gray-200 opacity-40' :
                today ? 'bg-gradient-to-r from-emerald-50 to-teal-50/50 border-emerald-200 ring-2 ring-emerald-100 shadow-sm shadow-emerald-100' :
                'bg-gradient-to-r from-indigo-50/30 to-purple-50/20 border-indigo-100/60 hover:border-indigo-200/80 hover:shadow-sm'
              )}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800">{app.role}</p>
                    <p className="text-[11px] text-indigo-600 font-medium">{app.company}</p>
                  </div>
                  {today && (
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2.5 py-0.5 rounded-full shadow-sm shadow-emerald-200">
                      <Zap size={9} /> TODAY
                    </span>
                  )}
                  {past && (
                    <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2.5 py-0.5 rounded-full">DONE</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <span className={clsx(
                    'flex items-center gap-1 text-[10px] font-medium',
                    hasDate ? (today ? 'text-emerald-600' : 'text-gray-500') : 'text-gray-400'
                  )}>
                    <Clock size={11} />
                    {hasDate ? format(interviewDate, 'MMM d, yyyy h:mm a') : 'Date TBD'}
                  </span>
                  {app.location && (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400 font-medium">
                      <MapPin size={11} /> {app.location}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
