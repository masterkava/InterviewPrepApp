import { Link, Outlet, useLocation } from 'react-router-dom';

export default function AppLayout() {
  const location = useLocation();
  const hideFooter = location.pathname.includes('/session');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary-700">
              <span className="text-2xl">&#x1f3af;</span>
              InterviewPrep
            </Link>
            <nav className="flex items-center gap-6">
              <Link
                to="/question-bank"
                className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
              >
                Question Bank
              </Link>
              <Link
                to="/history"
                className="text-sm text-gray-600 hover:text-primary-600 transition-colors"
              >
                Interview History
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {!hideFooter && (
        <footer className="bg-white border-t border-gray-200 py-6">
          <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
            InterviewPrepApp &mdash; AI-Powered Mock Interview Platform
          </div>
        </footer>
      )}
    </div>
  );
}
