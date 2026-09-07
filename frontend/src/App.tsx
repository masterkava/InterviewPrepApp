import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import InterviewCompletePage from './pages/InterviewCompletePage';
import InterviewLobbyPage from './pages/InterviewLobbyPage';
import InterviewPage from './pages/InterviewPage';
import InterviewSetupPage from './pages/InterviewSetupPage';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';

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
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/interview/setup" element={<InterviewSetupPage />} />
            <Route path="/interview/:interviewId/lobby" element={<InterviewLobbyPage />} />
            <Route path="/interview/:interviewId/session" element={<InterviewPage />} />
            <Route path="/interview/:interviewId/complete" element={<InterviewCompletePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
