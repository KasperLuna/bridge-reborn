import type { Session } from "@/lib/types";

const KEY = "bridge.session";

export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
