import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api.js';
import { storage } from '../lib/storage.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => storage.get('miami-closet-token', null));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    let ignore = false;

    async function loadCurrentUser() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await apiFetch('/api/auth/me', { token });
        if (!ignore) {
          setUser(response.user);
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
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      isAuthenticated: Boolean(token && user),
      async login(email, password) {
        const response = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        storage.set('miami-closet-token', response.token);
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
        setToken(response.token);
        setUser(response.user);
        return response.user;
      },
      logout() {
        storage.remove('miami-closet-token');
        setToken(null);
        setUser(null);
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
