import { pb } from "./pb";

export type RealtimeEvent<T> = { action: string; record: T };

type Unsubscribe = () => Promise<void>;

/** No realtime event in this long means the socket is assumed dead when the
    tab returns to the foreground (background tabs get frozen / sockets die
    silently). */
const RESYNC_STALE_MS = 30_000;

let lastRealtimeAt = Date.now();

/** Subscribe to a collection with a server-side filter. Returns an unsubscribe fn. */
export function subscribe<T>(
  collection: string,
  filter: string,
  onEvent: (e: RealtimeEvent<T>) => void,
): () => void {
  let unsub: Unsubscribe | null = null;
  let disposed = false;
  void pb
    .collection(collection)
    .subscribe(
      "*",
      (e) => {
        lastRealtimeAt = Date.now();
        onEvent({ action: e.action, record: e.record as T });
      },
      { filter },
    )
    .then((u) => {
      if (disposed) void (u as Unsubscribe)();
      else unsub = u as Unsubscribe;
    });
  return () => {
    disposed = true;
    if (unsub) void unsub();
  };
}

export async function unsubscribeAll(collections: string[]): Promise<void> {
  await Promise.all(
    collections.map((c) =>
      pb
        .collection(c)
        .unsubscribe("*")
        .catch(() => {}),
    ),
  );
}

type RealtimeHooks = {
  onDisconnect?: (topics: string[]) => void;
  initConnect?: () => void;
  reconnectAttempts?: number;
};

let resyncCbs: (() => void)[] = [];
let socketHooked = false;
let pageBound = false;
let originalInitConnect: (() => void) | undefined;
let originalOnDisconnect: ((topics: string[]) => void) | undefined;

const rt = () => (pb as unknown as { realtime?: RealtimeHooks }).realtime;

function fireResync(): void {
  resyncCbs.slice().forEach((cb) => cb());
}

/**
 * Tear down and rebuild the realtime socket, then run the resync callbacks.
 * `unsubscribe()` clears all topics and closes the EventSource (also resetting
 * the reconnect counter), so the next `subscribe()` opens a fresh connection.
 * Recovers from a silently dead socket that never fired an error.
 */
function forceRealtimeReset(): void {
  const realtime = rt();
  if (!realtime) {
    fireResync();
    return;
  }
  void (pb.realtime as { unsubscribe?: (topic?: string) => Promise<void> })
    .unsubscribe?.()
    .catch(() => {})
    .then(fireResync);
}

function hookSocketReconnect(): void {
  if (socketHooked) return;
  const realtime = rt();
  if (!realtime) return;
  socketHooked = true;
  originalInitConnect = realtime.initConnect;
  originalOnDisconnect = realtime.onDisconnect;

  realtime.initConnect = function () {
    const isReconnect = (realtime.reconnectAttempts ?? 0) > 0;
    originalInitConnect?.call(realtime);
    if (isReconnect) fireResync();
  };

  realtime.onDisconnect = (topics) => {
    originalOnDisconnect?.(topics);
  };
}

function unhookSocketReconnect(): void {
  if (!socketHooked) return;
  socketHooked = false;
  const realtime = rt();
  if (!realtime) return;
  realtime.initConnect = originalInitConnect;
  realtime.onDisconnect = originalOnDisconnect;
}

function onVisibilityChange(): void {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - lastRealtimeAt > RESYNC_STALE_MS) forceRealtimeReset();
}

function bindPageReturn(): void {
  if (pageBound || typeof document === "undefined") return;
  pageBound = true;
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", forceRealtimeReset);
}

function unbindPageReturn(): void {
  if (!pageBound) return;
  pageBound = false;
  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("online", forceRealtimeReset);
}

/**
 * Run `cb` whenever the realtime socket needs a resync. Returns a cleanup fn.
 * Fires when the SDK reconnects (`initConnect` with `reconnectAttempts > 0`),
 * and when the tab returns to the foreground or the network comes back with a
 * stale socket: both cases force the socket to rebuild and refetch state.
 */
export function onRealtimeReconnect(cb: () => void): () => void {
  resyncCbs.push(cb);
  if (resyncCbs.length === 1) {
    hookSocketReconnect();
    bindPageReturn();
  }
  return () => {
    resyncCbs = resyncCbs.filter((c) => c !== cb);
    if (resyncCbs.length === 0) {
      unhookSocketReconnect();
      unbindPageReturn();
    }
  };
}
