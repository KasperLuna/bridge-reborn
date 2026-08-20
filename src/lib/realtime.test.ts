import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (e?: Event) => void;

let visibilityHandler: Handler | null = null;
let onlineHandler: Handler | null = null;

const doc = {
  visibilityState: "hidden",
  addEventListener: (_t: string, h: Handler) => {
    visibilityHandler = h;
  },
  removeEventListener: (_t: string, h: Handler) => {
    if (visibilityHandler === h) visibilityHandler = null;
  },
} as unknown as Document;

const win = {
  addEventListener: (_t: string, h: Handler) => {
    onlineHandler = h;
  },
  removeEventListener: (_t: string, h: Handler) => {
    if (onlineHandler === h) onlineHandler = null;
  },
} as unknown as Window;

describe("onRealtimeReconnect resync on page return", () => {
  let unsubSpy: ReturnType<typeof vi.spyOn>;
  let realtime: typeof import("./realtime");
  let pb: typeof import("./pb").pb;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    vi.resetModules();
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", win);
    visibilityHandler = null;
    onlineHandler = null;
    pb = (await import("./pb")).pb;
    realtime = await import("./realtime");
    unsubSpy = vi
      .spyOn(pb.realtime, "unsubscribe")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    unsubSpy.mockRestore();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("forces a reset when the tab returns with a stale socket", async () => {
    const cb = vi.fn();
    const off = realtime.onRealtimeReconnect(cb);
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:31Z"));
      doc.visibilityState = "visible";
      visibilityHandler?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(unsubSpy).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  it("does not reset when the socket is fresh", async () => {
    const cb = vi.fn();
    const off = realtime.onRealtimeReconnect(cb);
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:05Z"));
      doc.visibilityState = "visible";
      visibilityHandler?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(unsubSpy).not.toHaveBeenCalled();
      expect(cb).not.toHaveBeenCalled();
    } finally {
      off();
    }
  });

  it("resets on the online event regardless of staleness", async () => {
    const cb = vi.fn();
    const off = realtime.onRealtimeReconnect(cb);
    try {
      onlineHandler?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(unsubSpy).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  it("stops resyncing after the last callback is removed", async () => {
    const cb = vi.fn();
    const off = realtime.onRealtimeReconnect(cb);
    off();
    vi.setSystemTime(new Date("2026-01-01T00:00:31Z"));
    doc.visibilityState = "visible";
    visibilityHandler?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(unsubSpy).not.toHaveBeenCalled();
    expect(cb).not.toHaveBeenCalled();
  });
});
