import { writable, get } from 'svelte/store';

interface UserData {
  id: number;
  username: string;
  full_name: string;
  role: string;
  position?: string;
  email?: string;
}

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export const user           = writable<UserData | null>(null);
export const token          = writable<string | null>(null);
export const openProfileEdit = writable<boolean>(false);

if (typeof localStorage !== 'undefined') {
  const t = localStorage.getItem('sk_token');
  const u = localStorage.getItem('sk_user');
  if (t) token.set(t);
  if (u) try { user.set(JSON.parse(u)); } catch {}
}

export function login(userData: UserData, tokenValue: string) {
  token.set(tokenValue);
  user.set(userData);
  localStorage.setItem('sk_token', tokenValue);
  localStorage.setItem('sk_user', JSON.stringify(userData));
}

export function logout() {
  token.set(null);
  user.set(null);
  localStorage.removeItem('sk_token');
  localStorage.removeItem('sk_user');
}

export const API = import.meta.env.VITE_API_URL || 'https://event-tracker-system.onrender.com/api';

export async function apiFetch(path: string, options: FetchOptions = {}) {
  const t = get(token);
  const res = await fetch(`${API}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(options.headers ?? {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  // Auto-logout kapag expired/invalid token
  if (res.status === 401) {
    logout();
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}