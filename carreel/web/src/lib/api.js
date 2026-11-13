import { createContext, createElement, useContext, useEffect, useState, useCallback } from 'react';

const TOKEN_KEY = 'carreel.token';
const readToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const writeToken = (t) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable (private mode) */ }
};

export async function api(path, { method = 'GET', body, form } = {}) {
  const token = readToken();
  const headers = token ? { authorization: `Bearer ${token}` } : {};
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(path, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [prompt, setPrompt] = useState(false);
  useEffect(() => { if (readToken()) api('/api/me').then(setUser).catch(() => writeToken(null)); }, []);
  const login = useCallback(async (handle) => {
    const r = await api('/api/auth/login', { method: 'POST', body: { handle } });
    writeToken(r.token); setUser(r.user); setPrompt(false);
  }, []);
  const register = useCallback(async (data) => {
    const r = await api('/api/auth/register', { method: 'POST', body: data });
    writeToken(r.token); setUser(r.user); setPrompt(false);
  }, []);
  const logout = useCallback(() => { writeToken(null); setUser(null); }, []);
  // Wrap an action that needs a signed-in user; opens the sign-in sheet otherwise.
  const requireAuth = useCallback((fn) => (...args) => (user ? fn(...args) : setPrompt(true)), [user]);
  return createElement(AuthCtx.Provider, { value: { user, login, register, logout, requireAuth, prompt, setPrompt } }, children);
}
export const useAuth = () => useContext(AuthCtx);

let metaPromise = null;
export function useMeta() {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    if (!metaPromise) metaPromise = api('/api/meta');
    metaPromise.then(setMeta).catch(() => { metaPromise = null; });
  }, []);
  return meta;
}
