/**
 * Returns true when the user is mid-session — review/deep-dive run/audit run.
 * The top + bottom nav hide on these paths to give the question full canvas.
 */
export function isSessionRunPath(path: string): boolean {
  if (path === "/sessions/review") return true;
  return /^\/sessions\/(deep-dive|audit)\/[^/]+$/.test(path);
}

/**
 * Returns true when the path is a child of the given top-level nav item.
 * Used for active-state highlighting in TopNav and BottomNav.
 */
export function isPathInside(path: string, prefix: string): boolean {
  if (path === prefix) return true;
  return path.startsWith(prefix + "/");
}
