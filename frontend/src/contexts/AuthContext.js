import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { csrf, setSessionExpiredHandler } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));

    // The session cookie may already exist from an earlier visit
    api.get('/auth/me')
      .then(({ data }) => {
        csrf.save(data);
        setUser(data.user);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const startSession = useCallback((data) => {
    csrf.save(data);
    setUser(data.user);
    return data.user;
  }, []);

  // accountType is 'candidate' or 'hr'; the server refuses accounts of the other kind
  const login = useCallback(async (email, password, accountType = 'candidate') => {
    const { data } = await api.post('/auth/login', { email, password, account_type: accountType });
    return startSession(data);
  }, [startSession]);

  const register = useCallback(async (email, password, fullName) => {
    const { data } = await api.post('/auth/register', { email, password, full_name: fullName });
    return startSession(data);
  }, [startSession]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Clearing local state is enough if the server is unreachable
    }
    csrf.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
