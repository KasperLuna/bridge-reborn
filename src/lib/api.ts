import type { Seat } from "@/lib/game/types";
import type { KickVote, RoomSeat, Session } from "@/lib/types";

async function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, "POST", body);
}

async function patch<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, "PATCH", body);
}

async function request<T>(
  url: string,
  method: "POST" | "PATCH",
  body: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof data.error === "string" && data.error
        ? data.error
        : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function joinRoom(
  code: string,
  username: string,
  wantSpectator = false,
  password?: string,
): Promise<Session> {
  return post<Session>("/api/rooms/join", {
    code,
    username,
    wantSpectator,
    ...(password ? { password } : {}),
  });
}

/** Starts a quick game: `solo` (1 human + 3 bots) or `pairs` (2 humans). */
export function quickGame(
  mode: "solo" | "pairs",
  username: string,
): Promise<Session> {
  return post<Session>("/api/rooms/quick", { mode, username });
}

export function claimSeat(
  session: Session,
  seat: Seat | null,
): Promise<{
  seatId: string;
  seat: Seat | null;
  isSpectator: boolean;
  ready: boolean;
}> {
  return post("/api/rooms/seats/claim", { ...session, seat });
}

export function leaveSeat(session: Session): Promise<{ ok: true }> {
  return post("/api/rooms/seats/leave", session);
}

export type KickResult = {
  ok: true;
  kicked?: string;
  vote?: KickVote;
};

export function startKick(
  session: Session,
  targetUsername: string,
): Promise<KickResult> {
  return post(`/api/rooms/${session.code}/kick`, {
    ...session,
    targetUsername,
  });
}

export function castKickVote(
  session: Session,
  voteId: string,
  yes: boolean,
): Promise<KickResult> {
  return post(`/api/rooms/${session.code}/kick/vote`, {
    ...session,
    voteId,
    yes,
  });
}

export function setReady(
  session: Session,
  ready: boolean,
): Promise<{ ready: boolean }> {
  return post("/api/rooms/seats/ready", { ...session, ready });
}

export function setRuleset(
  session: Session,
  presetId: string,
): Promise<{ ok: true }> {
  return patch(`/api/rooms/${session.code}/ruleset`, {
    ...session,
    presetId,
  }).then(() => ({ ok: true as const }));
}

export function setPrivacy(
  session: Session,
  privacy: "public" | "private",
  password?: string,
): Promise<{ ok: true }> {
  return patch(`/api/rooms/${session.code}/privacy`, {
    ...session,
    privacy,
    ...(password ? { password } : {}),
  }).then(() => ({ ok: true as const }));
}

export function startGame(session: Session): Promise<{ ok: true }> {
  return post(`/api/rooms/${session.code}/start`, session);
}

export function addBot(
  session: Session,
  seat?: Seat,
): Promise<{ ok: true; seat: RoomSeat }> {
  return post(`/api/rooms/${session.code}/bots`, {
    roomId: session.roomId,
    seatId: session.seatId,
    username: session.username,
    ...(seat ? { seat } : {}),
  });
}

export function kickBot(
  session: Session,
  targetUsername: string,
): Promise<{ ok: true; kicked: string }> {
  return post(`/api/rooms/${session.code}/bots/kick`, {
    ...session,
    targetUsername,
  });
}

export function newGame(session: Session): Promise<{ ok: true }> {
  return post(`/api/rooms/${session.code}/new-game`, session);
}

export function submitBid(
  session: Session,
  handId: string,
  call: string,
): Promise<{ ok: true }> {
  return post(`/api/hands/${handId}/bid`, { ...session, call });
}

export function playCard(
  session: Session,
  handId: string,
  card: string,
): Promise<{ ok: true }> {
  return post(`/api/hands/${handId}/play`, { ...session, card });
}

export function concede(
  session: Session,
  handId: string,
  action: "concede" | "leave",
): Promise<{ ok: true; winnerSide: "NS" | "EW"; reason: string }> {
  return post(`/api/hands/${handId}/concede`, { ...session, action });
}
