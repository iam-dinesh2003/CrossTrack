import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const pageMeta = {
  '/dashboard':           { title: 'Dashboard',       subtitle: "Here's your application overview" },
  '/applications':        { title: 'Applications',    subtitle: 'Manage all your job applications' },
  '/applications/kanban': { title: 'Kanban Board',    subtitle: 'Drag and drop to update status' },
  '/analytics':           { title: 'Analytics',       subtitle: 'Track your application performance' },
  '/ghost-jobs':          { title: 'Ghost Jobs',       subtitle: 'Applications with no response' },
  '/settings':            { title: 'Settings',         subtitle: 'Manage your account and preferences' },
  '/coach':               { title: 'Career Coach',     subtitle: 'Your AI-powered personal career advisor' },
  '/follow-ups':          { title: 'Follow-Ups',       subtitle: 'Smart follow-up reminders for your applications' },
  '/ai/match-score':      { title: 'Match Score',      subtitle: 'AI resume-job match analysis & cover letter generation' },
  '/ai/interview-prep':   { title: 'Interview Prep',   subtitle: 'AI-generated interview preparation materials' },
  '/ai/mock-interview':   { title: 'Mock Interview',   subtitle: 'Practice with an AI interviewer' },
  '/ai/interview-notes':  { title: 'Interview Notes',  subtitle: 'Record and summarize your interviews' },
  '/resumes':             { title: 'Resume Variants',  subtitle: 'Manage multiple resume versions for different roles' },
  '/job-discovery':       { title: 'Job Discovery',    subtitle: 'AI matches jobs from 20+ portals to your resume' },
};

export default function Layout() {
  const { pathname } = useLocation();
  const meta = pageMeta[pathname] || { title: 'CrossTrack', subtitle: '' };
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header
        title={meta.title}
        subtitle={meta.subtitle}
        onMenuClick={() => setSidebarOpen(true)}
      />
      <main className="md:ml-[260px] mt-[68px] p-4 sm:p-7">
        <div className="page-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
