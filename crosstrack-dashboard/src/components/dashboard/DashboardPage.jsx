import { useQuery } from '@tanstack/react-query';
import { Briefcase, TrendingUp, CalendarCheck, Ghost } from 'lucide-react';
import * as applicationService from '../../services/applicationService';
import StatCard from './StatCard';
import ApplicationsChart from './ApplicationsChart';
import StatusDonut from './StatusDonut';
import PlatformBreakdown from './PlatformBreakdown';
import RecentApplications from './RecentApplications';
import InterviewSchedule from './InterviewSchedule';
import TopRolesBreakdown from './TopRolesBreakdown';

export default function DashboardPage() {
  const { data: applications = [], isLoading: appsLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: applicationService.getApplications,
  });

  const totalApps = applications.length;
  const thisWeek = applications.filter(a => {
    const d = new Date(a.appliedAt);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).length;
  const interviews = applications.filter(a => a.status === 'INTERVIEW').length;
  const ghosted = applications.filter(a => a.status === 'GHOSTED').length;

  const statusCounts = {};
  applications.forEach(a => { statusCounts[a.status] = (statusCounts[a.status] || 0) + 1; });

  const platformCounts = {};
  applications.forEach(a => { platformCounts[a.platform] = (platformCounts[a.platform] || 0) + 1; });

  // Build weekly data from actual applications
  const weeklyData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + mondayOffset + i);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const count = applications.filter(a => {
      const d = new Date(a.appliedAt);
      return d >= targetDate && d < nextDay;
    }).length;

    return { day, applications: count };
  });

  if (appsLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-10 h-10 border-3 border-indigo-100 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title="Total Applications" value={totalApps} icon={Briefcase} color="purple" />
        <StatCard title="This Week" value={thisWeek} icon={TrendingUp} color="blue" />
        <StatCard title="Interviews" value={interviews} icon={CalendarCheck} color="green" />
        <StatCard title="Ghosted" value={ghosted} icon={Ghost} color="orange" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <ApplicationsChart weeklyData={weeklyData} />
        </div>
        <StatusDonut statusCounts={statusCounts} />
      </div>

      {/* Recent + Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <RecentApplications applications={applications} />
        </div>
        <div className="space-y-5">
          <PlatformBreakdown platformCounts={platformCounts} />
          <InterviewSchedule applications={applications} />
        </div>
      </div>

      {/* Top Roles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TopRolesBreakdown applications={applications} />
      </div>
    </div>
  );
}
