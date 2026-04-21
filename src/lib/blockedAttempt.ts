// Tracks the last admin-only path an agent tried to open. Stored in
// sessionStorage so it survives the navigation to /agent but not a new tab.
const KEY = "salgon:lastBlockedAttempt";

export interface BlockedAttempt {
  path: string;
  at: number; // epoch ms
}

const ADMIN_PATH_LABELS: Record<string, string> = {
  "/": "Panel de Control",
  "/users": "Usuarios",
  "/pipeline": "Embudo de Ventas",
  "/availability": "Disponibilidad",
};

export function labelForAdminPath(path: string): string {
  if (ADMIN_PATH_LABELS[path]) return ADMIN_PATH_LABELS[path];
  // Match by prefix for nested paths like /users/123
  const prefix = Object.keys(ADMIN_PATH_LABELS).find(
    (p) => p !== "/" && (path === p || path.startsWith(p + "/")),
  );
  return prefix ? ADMIN_PATH_LABELS[prefix] : path;
}

export function recordBlockedAttempt(path: string) {
  if (typeof window === "undefined") return;
  try {
    const payload: BlockedAttempt = { path, at: Date.now() };
    window.sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

export function readBlockedAttempt(): BlockedAttempt | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BlockedAttempt;
    if (!parsed?.path || typeof parsed.at !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearBlockedAttempt() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
