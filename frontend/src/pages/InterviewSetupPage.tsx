import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getRoles, createInterview } from '../services/api';
import { useSessionId } from '../hooks/useSessionId';
import type { Role } from '../types/role';
import type { ExperienceLevel, Difficulty } from '../types/interview';

const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string; description: string }[] = [
  { value: 'fresher', label: 'Fresher', description: '0-1 years experience' },
  { value: 'junior', label: 'Junior', description: '1-3 years experience' },
  { value: 'mid', label: 'Mid-Level', description: '3-5 years experience' },
  { value: 'senior', label: 'Senior', description: '5+ years experience' },
];

const DIFFICULTIES: { value: Difficulty; label: string; description: string }[] = [
  { value: 'adaptive', label: 'Adaptive', description: 'AI adjusts difficulty based on your answers' },
  { value: 'easy', label: 'Easy', description: 'Foundational concepts and basics' },
  { value: 'medium', label: 'Medium', description: 'Applied knowledge and scenarios' },
  { value: 'hard', label: 'Hard', description: 'Deep expertise and system design' },
];

const DURATIONS = [15, 30, 45, 60];

export default function InterviewSetupPage() {
  const navigate = useNavigate();
  const userId = useSessionId();

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [experience, setExperience] = useState<ExperienceLevel>('junior');
  const [difficulty, setDifficulty] = useState<Difficulty>('adaptive');
  const [duration, setDuration] = useState(30);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  });

  const mutation = useMutation({
    mutationFn: createInterview,
    onSuccess: (session) => {
      navigate(`/interview/${session.id}/lobby`);
    },
  });

  const handleStart = () => {
    if (!selectedRole) return;
    mutation.mutate({
      user_id: userId,
      role_id: selectedRole.id,
      experience_level: experience,
      difficulty,
      duration_minutes: duration,
      focus_areas: focusAreas.length > 0 ? focusAreas : undefined,
    });
  };

  const toggleFocusArea = (slug: string) => {
    setFocusAreas((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-500 text-lg">Loading roles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load roles. Make sure the backend is running.
        </div>
      </div>
    );
  }

  const roles = data?.roles ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">Set Up Your Interview</h1>
      <p className="mt-2 text-gray-600">Choose a role, experience level, and configure your mock interview.</p>

      {/* Step 1: Role Selection */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">1. Choose a Role</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => {
                setSelectedRole(role);
                setFocusAreas([]);
              }}
              className={`text-left rounded-xl p-5 border-2 transition-all cursor-pointer ${
                selectedRole?.id === role.id
                  ? 'border-primary-500 bg-primary-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-sm'
              }`}
            >
              <h3 className="font-semibold text-gray-900">{role.name}</h3>
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{role.description}</p>
              <p className="mt-2 text-xs text-gray-400">{role.skills.length} skills covered</p>
            </button>
          ))}
        </div>
      </section>

      {selectedRole && (
        <>
          {/* Step 2: Experience Level */}
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">2. Experience Level</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {EXPERIENCE_LEVELS.map((lvl) => (
                <button
                  key={lvl.value}
                  onClick={() => setExperience(lvl.value)}
                  className={`rounded-lg p-3 border-2 text-center transition-all cursor-pointer ${
                    experience === lvl.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-primary-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{lvl.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{lvl.description}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Step 3: Difficulty */}
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">3. Difficulty</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className={`rounded-lg p-3 border-2 text-center transition-all cursor-pointer ${
                    difficulty === d.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-primary-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{d.label}</div>
                  <div className="text-xs text-gray-500 mt-1">{d.description}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Step 4: Duration */}
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">4. Duration</h2>
            <div className="flex gap-3">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`rounded-lg px-5 py-3 border-2 font-medium transition-all cursor-pointer ${
                    duration === d
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 bg-white hover:border-primary-300 text-gray-700'
                  }`}
                >
                  {d} min
                </button>
              ))}
            </div>
          </section>

          {/* Step 5: Focus Areas (optional) */}
          <section className="mt-10">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">5. Focus Areas <span className="text-sm font-normal text-gray-400">(optional)</span></h2>
            <p className="text-sm text-gray-500 mb-4">Select specific skills to emphasize. Leave empty for balanced coverage.</p>
            <div className="flex flex-wrap gap-2">
              {selectedRole.skills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => toggleFocusArea(skill.slug)}
                  className={`rounded-full px-4 py-1.5 text-sm border transition-all cursor-pointer ${
                    focusAreas.includes(skill.slug)
                      ? 'border-primary-500 bg-primary-100 text-primary-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-primary-300'
                  }`}
                >
                  {skill.name}
                </button>
              ))}
            </div>
          </section>

          {/* Summary & Start */}
          <section className="mt-12 bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Interview Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Role</span>
                <p className="font-medium text-gray-900">{selectedRole.name}</p>
              </div>
              <div>
                <span className="text-gray-500">Experience</span>
                <p className="font-medium text-gray-900 capitalize">{experience}</p>
              </div>
              <div>
                <span className="text-gray-500">Difficulty</span>
                <p className="font-medium text-gray-900 capitalize">{difficulty}</p>
              </div>
              <div>
                <span className="text-gray-500">Duration</span>
                <p className="font-medium text-gray-900">{duration} minutes</p>
              </div>
            </div>
            {focusAreas.length > 0 && (
              <div className="mt-4 text-sm">
                <span className="text-gray-500">Focus: </span>
                <span className="text-gray-900">{focusAreas.join(', ')}</span>
              </div>
            )}
            <button
              onClick={handleStart}
              disabled={mutation.isPending}
              className="mt-6 w-full py-3 rounded-lg bg-primary-600 text-white font-semibold text-lg hover:bg-primary-700 transition-colors shadow-lg shadow-primary-600/25 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {mutation.isPending ? 'Creating Interview...' : 'Start Interview'}
            </button>
            {mutation.error && (
              <p className="mt-3 text-sm text-red-600">
                Failed to create interview. Please try again.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
