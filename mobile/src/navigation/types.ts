import type { NavigatorScreenParams } from '@react-navigation/native';
import type { Question, Progress, InterviewMode } from '../types/interview';

export type TabParamList = {
  Home: undefined;
  'Question Bank': undefined;
  History: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  OTPVerification: { email: string };
  ProfileSetup: undefined;
  MainTabs: NavigatorScreenParams<TabParamList>;
  InterviewSetup: undefined;
  InterviewLobby: { interviewId: string; mode: InterviewMode };
  Interview: {
    interviewId: string;
    mode: InterviewMode;
    firstQuestion: Question;
    progress: Progress;
  };
  VoiceInterview: {
    interviewId: string;
    firstQuestion: Question;
    progress: Progress;
  };
  InterviewComplete: { interviewId: string };
  Report: { interviewId: string };
};
