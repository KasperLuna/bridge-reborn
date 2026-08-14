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
      unsub = u as Unsubscribe;
    });
  return () => {
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
};

/** Run `cb` whenever the realtime socket reconnects. Returns a cleanup fn. */
export function onRealtimeReconnect(cb: () => void): () => void {
  const rt = (pb as unknown as { realtime?: RealtimeHooks }).realtime;
  if (!rt) return () => {};
  const prevDisconnect = rt.onDisconnect;
  const prevConnect = rt.connect;

  rt.onDisconnect = () => {
    prevDisconnect?.();
  };

  if (prevConnect) {
    rt.connect = async () => {
      await prevConnect.call(rt);
      cb();
    };
  }

  return () => {
    rt.onDisconnect = prevDisconnect;
    rt.connect = prevConnect;
  };
}
