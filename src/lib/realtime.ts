import { pb } from "./pb";

export type RealtimeEvent<T> = { action: string; record: T };

type Unsubscribe = () => Promise<void>;

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
  onDisconnect?: () => void;
  connect?: () => Promise<void>;
  initConnect?: () => void;
  reconnectAttempts?: number;
};

/**
 * Run `cb` whenever the realtime socket reconnects. Returns a cleanup fn.
 * The SDK only opens the EventSource via `connect()` on the first connection;
 * reconnects bypass it and call `initConnect()` directly. Fire only when
 * `reconnectAttempts > 0` so the first connect isn't mistaken for a reconnect.
 */
export function onRealtimeReconnect(cb: () => void): () => void {
  const rt = (pb as unknown as { realtime?: RealtimeHooks }).realtime;
  if (!rt) return () => {};
  const prevInitConnect = rt.initConnect;
  const prevDisconnect = rt.onDisconnect;

  rt.initConnect = function () {
    const isReconnect = (rt.reconnectAttempts ?? 0) > 0;
    prevInitConnect?.call(rt);
    if (isReconnect) cb();
  };

  rt.onDisconnect = () => {
    prevDisconnect?.();
  };

  return () => {
    rt.onDisconnect = prevDisconnect;
    rt.initConnect = prevInitConnect;
  };
}
