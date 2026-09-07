import { useNavigate, useParams } from 'react-router-dom';
import InterviewerAvatar from '../components/InterviewerAvatar';

export default function InterviewCompletePage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 text-center overflow-hidden">
        <div className="bg-gradient-to-br from-green-500 to-green-600 px-8 py-10 text-white">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
              &#10003;
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-bold">Interview Complete!</h1>
          <p className="mt-2 text-green-100">
            Great job! Your performance has been evaluated.
          </p>
        </div>

        <div className="px-8 py-8">
          <p className="text-gray-600">
            Your detailed report is being prepared with scores across technical knowledge,
            communication, and problem-solving, along with personalized recommendations.
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => navigate(`/interview/${interviewId}/report`)}
              className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold text-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25 cursor-pointer"
            >
              View Your Report
            </button>
            <button
              onClick={() => navigate('/interview/setup')}
              className="w-full py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-medium hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer"
            >
              Start Another Interview
            </button>
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-500 hover:text-primary-600 transition-colors cursor-pointer mt-2"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
