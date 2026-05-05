/**
 * Client-side helper for POST /api/sessions/start. Handles the cross-device
 * 409 ("active_session_elsewhere") response so each session page can render a
 * "take over from other device" prompt instead of duplicating the fetch logic.
 */

export interface ActiveSessionInfo {
  id: string;
  mode: "review" | "deep_dive" | "audit";
  device: string | null;
  started_at: string;
}

export type StartSessionResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "empty" }
  | { kind: "conflict"; active: ActiveSessionInfo }
  | { kind: "error"; message: string };

export interface StartSessionInput {
  mode: "review" | "deep_dive" | "audit";
  material_id?: string;
  audit_id?: string;
  item_count?: number;
  force?: boolean;
}

function detectDevice(): "desktop" | "mobile" {
  if (typeof window === "undefined") return "desktop";
  return window.matchMedia?.("(max-width: 767px)").matches ? "mobile" : "desktop";
}

export async function startSession<T>(input: StartSessionInput): Promise<StartSessionResult<T>> {
  let res: Response;
  try {
    res = await fetch("/api/sessions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device: detectDevice(), ...input }),
    });
  } catch {
    return { kind: "error", message: "Błąd sieci." };
  }

  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    if (body?.error === "active_session_elsewhere" && body?.active_session) {
      return { kind: "conflict", active: body.active_session as ActiveSessionInfo };
    }
    return { kind: "error", message: body?.error ?? "HTTP 409" };
  }

  if (res.status === 404) return { kind: "empty" };

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { kind: "error", message: body?.error ?? `HTTP ${res.status}` };
  }

  const data = (await res.json()) as T;
  return { kind: "ok", data };
}
