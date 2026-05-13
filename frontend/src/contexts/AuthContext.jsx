import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api.js';
import { storage } from '../lib/storage.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => storage.get('miami-closet-token', null));
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
        const response = await apiFetch('/api/auth/me', token ? { token } : {});
        if (!ignore) {
          if (response.user) {
            setUser(response.user);
          } else {
            setToken(null);
            setUser(null);
            storage.remove('miami-closet-token');
          }
        }
      } catch {
        if (!ignore) {
          setToken(null);
          setUser(null);
          storage.remove('miami-closet-token');
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadCurrentUser();
    return () => {
      ignore = true;
    };
  }, [loggingOut, token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(user),
      async login(email, password) {
        const response = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        storage.set('miami-closet-token', response.token);
        setLoggingOut(false);
        setToken(response.token);
        setUser(response.user);
        return response.user;
      },
      async register(payload) {
        const response = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: payload,
        });
        storage.set('miami-closet-token', response.token);
        setLoggingOut(false);
        setToken(response.token);
        setUser(response.user);
        return response.user;
      },
      logout() {
        setLoggingOut(true);
        storage.remove('miami-closet-token');
        setToken(null);
        setUser(null);
        setLoading(false);
        void apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
      },
    }),
    [token, user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
