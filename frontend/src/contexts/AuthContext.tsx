import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { UserProfile, AuthTokenResponse, ProfileSetupData } from '../types/auth';
import { getAccessToken, setTokens, clearTokens } from '../services/tokenStorage';
import { getProfile, setupProfileAPI, logoutAPI } from '../services/api';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  user: UserProfile | null;
}

interface AuthContextValue extends AuthState {
  login: (tokens: AuthTokenResponse) => void;
  logout: () => Promise<void>;
  updateProfile: (data: ProfileSetupData) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    isProfileComplete: false,
    user: null,
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setState({ isLoading: false, isAuthenticated: false, isProfileComplete: false, user: null });
      return;
    }

    getProfile()
      .then((user) => {
        setState({
          isLoading: false,
          isAuthenticated: true,
          isProfileComplete: user.is_profile_complete,
          user,
        });
      })
      .catch(() => {
        clearTokens();
        setState({ isLoading: false, isAuthenticated: false, isProfileComplete: false, user: null });
      });
  }, []);

  const login = useCallback((tokens: AuthTokenResponse) => {
    setTokens(tokens.access_token, tokens.refresh_token);
    setState({
      isLoading: false,
      isAuthenticated: true,
      isProfileComplete: tokens.user.is_profile_complete,
      user: tokens.user,
    });
  }, []);

  const logout = useCallback(async () => {
    try { await logoutAPI(); } catch { /* ignore */ }
    clearTokens();
    setState({ isLoading: false, isAuthenticated: false, isProfileComplete: false, user: null });
  }, []);

  const updateProfile = useCallback(async (data: ProfileSetupData) => {
    const res = await setupProfileAPI(data);
    setState((prev) => ({
      ...prev,
      isProfileComplete: res.user.is_profile_complete,
      user: res.user,
    }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
