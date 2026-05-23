import { writable, get } from 'svelte/store';

/** @typedef {{ id: number, username: string, full_name: string, email: string, role: string, contact?: string, barangay?: string, address?: string, avatar_url?: string | null }} UserData */

/** @type {import('svelte/store').Writable<UserData | null>} */
export const user = writable(null);

/** @type {import('svelte/store').Writable<string | null>} */
export const token = writable(null);

if (typeof localStorage !== 'undefined') {
  const t = localStorage.getItem('sk_portal_token');
  const u = localStorage.getItem('sk_portal_user');
  if (t) token.set(t);
  if (u) try { user.set(JSON.parse(u)); } catch {}
}

/**
 * @param {UserData} userData
 * @param {string} tokenValue
 */
export function login(userData, tokenValue) {
  token.set(tokenValue);
  user.set(userData);
  localStorage.setItem('sk_portal_token', tokenValue);
  localStorage.setItem('sk_portal_user', JSON.stringify(userData));
}

export function logout() {
  token.set(null);
  user.set(null);
  localStorage.removeItem('sk_portal_token');
  localStorage.removeItem('sk_portal_user');
}

/**
 * @param {Partial<UserData>} patch
 */
export function updateUser(patch) {
  user.update((u) => {
    if (!u) return u;
    const updated = { ...u, ...patch };
    localStorage.setItem('sk_portal_user', JSON.stringify(updated));
    return updated;
  });
}

export const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/**
 * @param {string} path
 * @param {{ method?: string, headers?: Record<string, string>, body?: unknown }} [options]
 * @returns {Promise<any>}
 */
export async function apiFetch(path, options = {}) {
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
    logout();
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}