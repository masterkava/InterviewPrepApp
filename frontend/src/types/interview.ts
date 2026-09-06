export interface InterviewConfig {
  user_id?: string;
  role_id: string;
  experience_level: ExperienceLevel;
  difficulty: Difficulty;
  duration_minutes: number;
  focus_areas?: string[];
}

export type ExperienceLevel = 'fresher' | 'junior' | 'mid' | 'senior';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'adaptive';

export interface InterviewSession {
  id: string;
  user_id: string;
  role: { id: string; name: string };
  experience_level: string;
  difficulty: string;
  duration_minutes: number;
  question_budget: number;
  focus_areas: string[] | null;
  status: string;
  created_at: string;
}
