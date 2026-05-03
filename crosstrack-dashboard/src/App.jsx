import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AdminRoute from './components/auth/AdminRoute';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import Layout from './components/layout/Layout';
import DashboardPage from './components/dashboard/DashboardPage';
import ApplicationsPage from './components/applications/ApplicationsPage';
import KanbanPage from './components/applications/KanbanPage';
import AnalyticsPage from './components/analytics/AnalyticsPage';
import GhostJobsPage from './components/ghost/GhostJobsPage';
import SettingsPage from './components/settings/SettingsPage';
import GmailCallback from './components/GmailCallback';
import CoachPage from './components/coach/CoachPage';
import FollowUpsPage from './components/followups/FollowUpsPage';
import MatchScorePage from './components/ai/MatchScorePage';
import InterviewPrepPage from './components/ai/InterviewPrepPage';
import MockInterviewPage from './components/ai/MockInterviewPage';
import InterviewNotesPage from './components/ai/InterviewNotesPage';
import ResumesPage from './components/resumes/ResumesPage';
import JobDiscoveryPage from './components/jobs/JobDiscoveryPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import AdminLayout from './components/admin/AdminLayout';
import AdminDashboardPage from './components/admin/AdminDashboardPage';
import AdminUsersPage from './components/admin/AdminUsersPage';
import AdminUserDetailPage from './components/admin/AdminUserDetailPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 30000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/applications" element={<ApplicationsPage />} />
                <Route path="/applications/kanban" element={<KanbanPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/ghost-jobs" element={<GhostJobsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                {/* AI Features */}
                <Route path="/coach" element={<CoachPage />} />
                <Route path="/follow-ups" element={<FollowUpsPage />} />
                <Route path="/ai/match-score" element={<MatchScorePage />} />
                <Route path="/ai/interview-prep" element={<InterviewPrepPage />} />
                <Route path="/ai/mock-interview" element={<MockInterviewPage />} />
                <Route path="/ai/interview-notes" element={<InterviewNotesPage />} />
                <Route path="/resumes" element={<ResumesPage />} />
                <Route path="/job-discovery" element={<JobDiscoveryPage />} />
              </Route>
            </Route>

            {/* Admin Routes — completely separate layout, admin-only */}
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboardPage />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
              </Route>
            </Route>

            {/* Gmail OAuth Callback */}
            <Route path="/gmail-callback" element={<ProtectedRoute />}>
              <Route index element={<GmailCallback />} />
            </Route>

            {/* Redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
