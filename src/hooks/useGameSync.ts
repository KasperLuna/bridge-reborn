"use client";

import { useEffect, useState } from "react";

import { pb } from "@/lib/pb";
import { onRealtimeReconnect, subscribe } from "@/lib/realtime";
import type {
  BidRecord,
  ContractRecord,
  Hand,
  HandResultRecord,
  PlayRecord,
  Room,
  Session,
  TrickRecord,
} from "@/lib/types";
import { useGameStore } from "@/store/game-store";
import { useRoomStore } from "@/store/room-store";

function upsert<T extends { id: string }>(
  list: T[],
  record: T,
  action: string,
) {
  const next = list.filter((x) => x.id !== record.id);
  if (action !== "delete") next.push(record);
  return next;
}

const byPos = (
  a: { sequence_position: number },
  b: { sequence_position: number },
) => a.sequence_position - b.sequence_position;
const bySeq = (a: { play_sequence: number }, b: { play_sequence: number }) =>
  a.play_sequence - b.play_sequence;
const byNum = (a: { trick_number: number }, b: { trick_number: number }) =>
  a.trick_number - b.trick_number;

/** Fetches the current game state and keeps it in sync via realtime. */
export function useGameSync(session: Session | null) {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!session) return;
    const roomId = session.roomId;
    const gameStore = useGameStore.getState();
    const roomStore = useRoomStore.getState();
    let disposed = false;
    let unsubs: (() => void)[] = [];

    const fetchAll = async () => {
      try {
        const room = await pb.collection("rooms").getOne<Room>(roomId);
        if (disposed) return;
        roomStore.setRoom(room);

        const hands = await pb.collection("hands").getList<Hand>(1, 1, {
          filter: pb.filter("room_id = {:roomId}", { roomId }),
          sort: "-created",
        });
        const hand = hands.items[0] ?? null;
        gameStore.setHand(hand);

        let bids: BidRecord[] = [];
        let contract: ContractRecord | null = null;
        let tricks: TrickRecord[] = [];
        let plays: PlayRecord[] = [];
        let result: HandResultRecord | null = null;

        if (hand) {
          const handId = hand.id;
          [bids, contract, tricks, plays, result] = await Promise.all([
            pb.collection("bids").getFullList<BidRecord>({
              filter: pb.filter("hand_id = {:handId}", { handId }),
              sort: "sequence_position",
            }),
            pb
              .collection("contracts")
              .getFirstListItem<ContractRecord>(
                pb.filter("hand_id = {:handId}", { handId }),
              )
              .catch(() => null),
            pb.collection("tricks").getFullList<TrickRecord>({
              filter: pb.filter("hand_id = {:handId}", { handId }),
              sort: "trick_number",
            }),
            pb.collection("plays").getFullList<PlayRecord>({
              filter: pb.filter("hand_id = {:handId}", { handId }),
              sort: "play_sequence",
            }),
            pb
              .collection("hand_results")
              .getFirstListItem<HandResultRecord>(
                pb.filter("hand_id = {:handId}", { handId }),
              )
              .catch(() => null),
          ]);
        }

        if (disposed) return;
        gameStore.setBids(bids);
        gameStore.setContract(contract);
        gameStore.setTricks(tricks);
        gameStore.setPlays(plays);
        gameStore.setResult(result);

        // (Re)subscribe with the now-known ids.
        unsubs.forEach((u) => u());
        unsubs = [
          subscribe<Room>("rooms", `id = "${roomId}"`, (e) => {
            if (e.action === "delete") roomStore.setRoom(null);
            else roomStore.setRoom(e.record);
          }),
        ];

        if (hand) {
          const handId = hand.id;
          unsubs.push(
            subscribe<Hand>("hands", `room_id = "${roomId}"`, (e) => {
              const current = useGameStore.getState().hand;
              if (!current || e.record.id !== current.id) {
                // A new hand appeared (next game); refetch everything.
                setRefreshKey((k) => k + 1);
                return;
              }
              gameStore.setHand(e.record);
            }),
            subscribe<BidRecord>("bids", `hand_id = "${handId}"`, (e) => {
              gameStore.setBids(
                upsert(useGameStore.getState().bids, e.record, e.action).sort(
                  byPos,
                ),
              );
            }),
            subscribe<ContractRecord>(
              "contracts",
              `hand_id = "${handId}"`,
              (e) => {
                gameStore.setContract(e.action === "delete" ? null : e.record);
              },
            ),
            subscribe<TrickRecord>("tricks", `hand_id = "${handId}"`, (e) => {
              gameStore.setTricks(
                upsert(useGameStore.getState().tricks, e.record, e.action).sort(
                  byNum,
                ),
              );
            }),
            subscribe<PlayRecord>("plays", `hand_id = "${handId}"`, (e) => {
              gameStore.setPlays(
                upsert(useGameStore.getState().plays, e.record, e.action).sort(
                  bySeq,
                ),
              );
            }),
            subscribe<HandResultRecord>(
              "hand_results",
              `hand_id = "${handId}"`,
              (e) => {
                gameStore.setResult(e.action === "delete" ? null : e.record);
              },
            ),
          );
        }
      } catch {
        // keep last known state
      }
    };

    void fetchAll();

    const offReconnect = onRealtimeReconnect(() => setRefreshKey((k) => k + 1));

    return () => {
      disposed = true;
      offReconnect();
      unsubs.forEach((u) => u());
    };
  }, [session, refreshKey]);

  return { refresh: () => setRefreshKey((k) => k + 1) };
}
