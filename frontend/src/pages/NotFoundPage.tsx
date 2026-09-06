import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="mt-4 text-lg text-gray-600">Page not found</p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 px-6 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors cursor-pointer"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
