import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api.js';
import { storage } from '../lib/storage.js';

const AuthContext = createContext(null);
const LEGACY_TOKEN_STORAGE_KEY = 'miami-closet-token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadCurrentUser() {
      if (loggingOut) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        storage.remove(LEGACY_TOKEN_STORAGE_KEY);
        const response = await apiFetch('/api/auth/me');
        if (!ignore) {
          if (response.user) {
            setUser(response.user);
          } else {
            setUser(null);
            storage.remove(LEGACY_TOKEN_STORAGE_KEY);
          }
        }
      } catch {
        if (!ignore) {
          setUser(null);
          storage.remove(LEGACY_TOKEN_STORAGE_KEY);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadCurrentUser();
    return () => {
      ignore = true;
    };
  }, [loggingOut]);

  const value = useMemo(
    () => ({
      token: null,
      user,
      loading,
      isAuthenticated: Boolean(user),
      async login(email, password) {
        const response = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        storage.remove(LEGACY_TOKEN_STORAGE_KEY);
        setLoggingOut(false);
        setUser(response.user);
        return response.user;
      },
      async register(payload) {
        const response = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: payload,
        });
        storage.remove(LEGACY_TOKEN_STORAGE_KEY);
        setLoggingOut(false);
        setUser(response.user);
        return response.user;
      },
      logout() {
        setLoggingOut(true);
        storage.remove(LEGACY_TOKEN_STORAGE_KEY);
        setUser(null);
        setLoading(false);
        void apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
