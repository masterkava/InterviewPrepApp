import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import InterviewCompletePage from './pages/InterviewCompletePage';
import InterviewHistoryPage from './pages/InterviewHistoryPage';
import InterviewLobbyPage from './pages/InterviewLobbyPage';
import InterviewPage from './pages/InterviewPage';
import InterviewReportPage from './pages/InterviewReportPage';
import InterviewSetupPage from './pages/InterviewSetupPage';
import VoiceInterviewPage from './pages/VoiceInterviewPage';
import LiveInterviewPage from './pages/LiveInterviewPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import OTPVerificationPage from './pages/OTPVerificationPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import NotFoundPage from './pages/NotFoundPage';
import QuestionBankPage from './pages/QuestionBankPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Full-screen routes (no AppLayout) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/interview/:interviewId/live-session" element={<LiveInterviewPage />} />
            </Route>

            <Route element={<AppLayout />}>
              {/* Public routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/otp-verification" element={<OTPVerificationPage />} />
              <Route path="/profile-setup" element={<ProfileSetupPage />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<LandingPage />} />
                <Route path="/history" element={<InterviewHistoryPage />} />
                <Route path="/question-bank" element={<QuestionBankPage />} />
                <Route path="/interview/setup" element={<InterviewSetupPage />} />
                <Route path="/interview/:interviewId/lobby" element={<InterviewLobbyPage />} />
                <Route path="/interview/:interviewId/session" element={<InterviewPage />} />
                <Route path="/interview/:interviewId/voice-session" element={<VoiceInterviewPage />} />
                <Route path="/interview/:interviewId/complete" element={<InterviewCompletePage />} />
                <Route path="/interview/:interviewId/report" element={<InterviewReportPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
