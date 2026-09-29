'use client';

import { useSyncExternalStore } from 'react';

export type SessionUser = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_staff: boolean;
};

export type Session = { access: string; refresh: string; user: SessionUser | null };

const STORAGE_KEY = 'fleet:session';
const listeners = new Set<() => void>();
let cached: { raw: string | null; session: Session | null } = { raw: null, session: null };

function read(): Session | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw !== cached.raw) {
    let session: Session | null = null;
    try {
      session = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      session = null;
    }
    cached = { raw, session };
  }
  return cached.session;
}

function emit() {
  listeners.forEach((l) => l());
}

export function getSession() {
  return typeof window === 'undefined' ? null : read();
}

export function setSession(session: Session | null) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

export function updateTokens(tokens: { access: string; refresh?: string }) {
  const current = getSession();
  if (current) setSession({ ...current, ...tokens });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useSession(): Session | null | undefined {
  return useSyncExternalStore(subscribe, getSession, () => undefined);
}

export function safeNext(next: string | null | undefined) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login')
    ? next
    : '/';
}
