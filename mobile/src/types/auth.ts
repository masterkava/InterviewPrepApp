export type UserType = 'student' | 'fresher' | 'experienced';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  user_type: UserType | null;
  target_role: string | null;
  years_of_experience: number | null;
  is_profile_complete: boolean;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  is_profile_complete: boolean;
  user: UserProfile;
}

export interface ProfileSetupData {
  display_name: string;
  user_type: UserType;
  target_role: string;
  years_of_experience?: number;
}

export interface ProfileSetupResponse {
  user: UserProfile;
  message: string;
}

export interface RequestOTPResponse {
  message: string;
  expires_in_seconds: number;
}
