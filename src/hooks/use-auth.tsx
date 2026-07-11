import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { api, ApiError, UserCreate, UserLogin, UserRead } from '@/lib/api';
import { clearStoredSession, loadStoredSession, saveStoredSession } from '@/lib/auth-storage';
import { registerForPushNotificationsAsync } from '@/lib/push-notifications';
import { clearSession, setSession, setUnauthorizedHandler } from '@/lib/session';

type AuthStatus = 'loading' | 'signedIn' | 'signedOut';

type AuthContextValue = {
  status: AuthStatus;
  user: UserRead | null;
  login: (payload: UserLogin) => Promise<void>;
  register: (payload: UserCreate) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function establishSession(token: string): Promise<UserRead> {
  setSession({ token, userId: null });
  const me = await api.me();
  setSession({ token, userId: me.id });
  await saveStoredSession({ token, userId: me.id });
  return me;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<UserRead | null>(null);

  const logout = useCallback(async () => {
    clearSession();
    await clearStoredSession();
    setUser(null);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
    });
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  useEffect(() => {
    // Web push permission must be requested from an explicit user gesture (the
    // Settings "Enable notifications" button), not fired automatically here —
    // browsers block or discourage unsolicited permission prompts.
    if (status !== 'signedIn' || Platform.OS === 'web') return;
    let cancelled = false;

    (async () => {
      const result = await registerForPushNotificationsAsync();
      if (cancelled || 'error' in result) return;
      try {
        await api.registerPushToken({ token: result.token, platform: result.platform });
      } catch {
        // Best-effort — a failed registration shouldn't affect the signed-in session.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    let mounted = true;
    async function restore() {
      const stored = await loadStoredSession();
      if (!stored.token) {
        if (mounted) setStatus('signedOut');
        return;
      }
      try {
        const me = await establishSession(stored.token);
        if (mounted) {
          setUser(me);
          setStatus('signedIn');
        }
      } catch {
        clearSession();
        await clearStoredSession();
        if (mounted) setStatus('signedOut');
      }
    }
    restore();
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (payload: UserLogin) => {
    const token = await api.login(payload);
    const me = await establishSession(token.access_token);
    setUser(me);
    setStatus('signedIn');
  }, []);

  const register = useCallback(async (payload: UserCreate) => {
    const token = await api.register(payload);
    const me = await establishSession(token.access_token);
    setUser(me);
    setStatus('signedIn');
  }, []);

  const value = useMemo(() => ({ status, user, login, register, logout }), [status, user, login, register, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export function authErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return fallback;
}
