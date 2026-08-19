const KEY = "bridge.lastName";

export function savedName(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberName(name: string) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // ignore storage failures; prefill is best-effort
  }
}
