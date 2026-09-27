import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserProfile, AuthTokenResponse, ProfileSetupData } from '../types/auth';
import { getAccessToken, setTokens, clearTokens } from '../services/tokenStorage';
import { getProfile, setupProfileAPI, logoutAPI, refreshAuthToken } from '../services/api';

interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  user: UserProfile | null;
}

interface AuthContextValue extends AuthState {
  login: (tokens: AuthTokenResponse) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: ProfileSetupData) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    isProfileComplete: false,
    user: null,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const token = await getAccessToken();
      if (!token) {
        setState({ isLoading: false, isAuthenticated: false, isProfileComplete: false, user: null });
        return;
      }

      try {
        const user = await getProfile();
        setState({
          isLoading: false,
          isAuthenticated: true,
          isProfileComplete: user.is_profile_complete,
          user,
        });
      } catch {
        await clearTokens();
        setState({ isLoading: false, isAuthenticated: false, isProfileComplete: false, user: null });
      }
    } catch {
      setState({ isLoading: false, isAuthenticated: false, isProfileComplete: false, user: null });
    }
  }

  const login = useCallback(async (tokens: AuthTokenResponse) => {
    await setTokens(tokens.access_token, tokens.refresh_token);
    setState({
      isLoading: false,
      isAuthenticated: true,
      isProfileComplete: tokens.user.is_profile_complete,
      user: tokens.user,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutAPI();
    } catch {
      // ignore — clearing tokens is enough
    }
    await clearTokens();
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
