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

export interface Question {
  id: string;
  sequence_number: number;
  question_text: string;
  difficulty: string;
  skill: string;
  question_type: string;
  parent_question_id?: string | null;
}

export interface Progress {
  current: number;
  total: number;
  skills_covered: string[];
  skills_remaining: string[];
}

export interface InterviewStartResponse {
  session_id: string;
  status: string;
  interviewer_message: string;
  question: Question;
  progress: Progress;
}

export interface EvaluationResponse {
  question_id: string;
  overall_score: number;
  technical_correctness: number;
  conceptual_depth: number;
  communication_clarity: number;
  relevance: number;
  problem_solving: number;
  completeness: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

export interface AnswerRequest {
  question_id: string;
  answer_text: string;
  response_time_seconds?: number;
}

export interface AnswerResponse {
  evaluation: EvaluationResponse;
  next_question: Question | null;
  progress: Progress;
  interview_complete: boolean;
  closing_message: string | null;
}

export interface InterviewCompleteResponse {
  session_id: string;
  status: string;
  questions_asked: number;
  question_budget: number;
  message: string;
}

export interface ConversationEntry {
  type: 'question' | 'answer' | 'system';
  text: string;
  question?: Question;
  evaluation?: EvaluationResponse;
  timestamp: number;
}

export interface QuestionEvaluation {
  overall_score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

export interface ReportQuestion {
  sequence_number: number;
  question_text: string;
  answer_text: string;
  evaluation: QuestionEvaluation;
}

export interface ReportResponse {
  id: string;
  session_id: string;
  overall_score: number;
  technical_score: number;
  communication_score: number;
  problem_solving_score: number;
  confidence_score: number;
  readiness_level: string;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  recommended_topics: string[];
  category_breakdown: Record<string, number>;
  questions: ReportQuestion[];
  created_at: string;
}

export interface InterviewHistoryItem {
  id: string;
  role_name: string;
  experience_level: string;
  status: string;
  overall_score: number | null;
  questions_asked: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface InterviewHistoryResponse {
  interviews: InterviewHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}
