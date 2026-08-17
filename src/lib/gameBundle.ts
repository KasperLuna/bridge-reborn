import { pb } from "@/lib/pb";
import type {
  BidRecord,
  ContractRecord,
  Hand,
  HandResultRecord,
  PlayRecord,
  TrickRecord,
} from "@/lib/types";

export type HandBundle = {
  hand: Hand;
  bids: BidRecord[];
  tricks: TrickRecord[];
  plays: PlayRecord[];
  contract: ContractRecord | null;
  result: HandResultRecord | null;
};

export type GameBundle = {
  hand: Hand | null;
  bids: BidRecord[];
  tricks: TrickRecord[];
  plays: PlayRecord[];
  contract: ContractRecord | null;
  result: HandResultRecord | null;
};

/** Latest hand in a room, with its auction/play records. */
export async function fetchGameBundle(roomId: string): Promise<GameBundle> {
  const hands = await pb.collection("hands").getList<Hand>(1, 1, {
    filter: pb.filter("room_id = {:roomId}", { roomId }),
    sort: "-created",
  });
  const hand = hands.items[0] ?? null;
  if (!hand)
    return {
      hand: null,
      bids: [],
      tricks: [],
      plays: [],
      contract: null,
      result: null,
    };

  const handId = hand.id;
  const [bids, contract, tricks, plays, result] = await Promise.all([
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

  return { hand, bids, tricks, plays, contract, result };
}
