import { writable, get } from 'svelte/store';

interface UserData {
  id: number;
  username: string;
  full_name: string;
  role: string;
  position?: string;
  email?: string;
  avatar_url?: string | null;
}

interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export const user            = writable<UserData | null>(null);
export const token           = writable<string | null>(null);
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

export function updateUser(patch: Partial<UserData>) {
  user.update((u) => {
    if (!u) return u;
    const updated = { ...u, ...patch };
    localStorage.setItem('sk_user', JSON.stringify(updated));
    return updated;
  });
}

export const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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

  if (res.status === 401) {
    const t = get(token);
    if (t) {
      logout();
      window.location.href = '/login';
      return;
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    const message = err?.error || err?.message || err?.detail
      || (res.status === 401 ? 'Invalid username/email or password.'
        : res.status === 403 ? 'Access denied.'
        : res.status === 404 ? 'Account not found.'
        : `Request failed (${res.status})`);
    throw new Error(message);
  }

  return res.json();
}