"use client";

import { useEffect, useState } from "react";

import { pb } from "@/lib/pb";
import { onRealtimeReconnect, subscribe } from "@/lib/realtime";
import type { Room, RoomSeat, Session } from "@/lib/types";
import { useRoomStore } from "@/store/room-store";

/** Fetches room + seats and keeps them in sync via realtime. */
export function useRoomSync(session: Session | null) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!session) return;
    const roomId = session.roomId;
    const store = useRoomStore.getState();
    let disposed = false;

    const fetchAll = async () => {
      try {
        const [room, seats] = await Promise.all([
          pb.collection("rooms").getOne<Room>(roomId),
          pb.collection("room_seats").getFullList<RoomSeat>({
            filter: pb.filter("room_id = {:roomId}", { roomId }),
            sort: "joined_at",
          }),
        ]);
        if (disposed) return;
        store.setRoom(room);
        store.setSeats(seats);
      } catch {
        if (!disposed) store.setRoom(null);
      }
    };

    void fetchAll();

    const unsubs = [
      subscribe<Room>("rooms", `id = "${roomId}"`, (e) => {
        if (e.action === "delete") store.setRoom(null);
        else store.setRoom(e.record);
      }),
      subscribe<RoomSeat>("room_seats", `room_id = "${roomId}"`, () => {
        void fetchAll();
      }),
    ];
    const offReconnect = onRealtimeReconnect(() => setRefreshKey((k) => k + 1));

    return () => {
      disposed = true;
      offReconnect();
      unsubs.forEach((u) => u());
    };
  }, [session, refreshKey]);

  return { refresh: () => setRefreshKey((k) => k + 1) };
}
