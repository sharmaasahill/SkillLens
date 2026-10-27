import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { csrf, setSessionExpiredHandler } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const avatarRef = useRef(null);

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

  // The profile photo is loaded once here and shared by the navigation bar and the Profile page.
  // It needs the sign-in cookie, so it is fetched like any other API call and shown from memory.
  const pictureVersion = user?.picture || null;
  useEffect(() => {
    const show = (url) => {
      if (avatarRef.current) URL.revokeObjectURL(avatarRef.current);
      avatarRef.current = url;
      setAvatarUrl(url);
    };
    if (!pictureVersion) {
      show(null);
      return undefined;
    }
    let cancelled = false;
    api.get('/profile/picture', { responseType: 'blob', params: { v: pictureVersion } })
      .then(({ data }) => { if (!cancelled) show(URL.createObjectURL(data)); })
      .catch(() => { if (!cancelled) show(null); });
    return () => { cancelled = true; };
  }, [pictureVersion]);

  const startSession = useCallback((data) => {
    csrf.save(data);
    setUser(data.user);
    return data.user;
  }, []);

  // One sign-in for everyone: the server decides whether the account is the admin or a user.
  // The admin with two-factor sign-in gets { twoFactor: challenge } instead, and sends the code next.
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.two_factor_required) return { twoFactor: data.challenge };
    return startSession(data);
  }, [startSession]);

  const verifyTwoFactor = useCallback(async (challenge, code) => {
    const { data } = await api.post('/auth/2fa', { challenge, code });
    return { user: startSession(data), recoveryLeft: data.recovery_codes_left };
  }, [startSession]);

  const register = useCallback(async (email, password, fullName, acceptPrivacy, dateOfBirth) => {
    const { data } = await api.post('/auth/register', {
      email, password, full_name: fullName, accept_privacy: acceptPrivacy, date_of_birth: dateOfBirth,
    });
    return startSession(data);
  }, [startSession]);

  // Read the account again after it changes, e.g. once a missing date of birth is added
  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
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
    () => ({ user, loading, avatarUrl, login, verifyTwoFactor, register, refreshUser, logout }),
    [user, loading, avatarUrl, login, verifyTwoFactor, register, refreshUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
