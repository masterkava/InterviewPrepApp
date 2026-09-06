import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24">
      <div className="text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">
          Practice. Get Evaluated.
          <br />
          <span className="text-primary-600">Become Interview Ready.</span>
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
          An AI interviewer that behaves like a real interviewer — asks adaptive questions,
          evaluates your answers, and gives you a detailed performance report.
        </p>
        <div className="mt-10">
          <button
            onClick={() => navigate('/interview/setup')}
            className="inline-flex items-center px-8 py-3 rounded-lg bg-primary-600 text-white font-semibold text-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25 cursor-pointer"
          >
            Start Mock Interview
          </button>
        </div>
      </div>

      <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
        <FeatureCard
          title="Realistic AI Interviewer"
          description="Not a chatbot quiz — a structured interview with contextual follow-ups, adaptive difficulty, and natural progression."
        />
        <FeatureCard
          title="Rubric-Based Scoring"
          description="Transparent evaluation across technical correctness, conceptual depth, communication, and problem solving."
        />
        <FeatureCard
          title="Actionable Report"
          description="Detailed breakdown of strengths, weaknesses, and exactly which topics to study before your real interview."
        />
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}
