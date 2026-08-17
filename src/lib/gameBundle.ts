import { pb } from "@/lib/pb";
import type {
  BidRecord,
  ContractRecord,
  Game,
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
  game: Game | null;
  hands: HandBundle[];
};

/** Latest game in a room, with every hand and its auction/play records. */
export async function fetchGameBundle(roomId: string): Promise<GameBundle> {
  const games = await pb.collection("games").getList<Game>(1, 1, {
    filter: pb.filter("room_id = {:roomId}", { roomId }),
    sort: "-game_number",
  });
  const game = games.items[0] ?? null;
  if (!game) return { game: null, hands: [] };

  const hands = await pb.collection("hands").getFullList<Hand>({
    filter: pb.filter("game_id = {:gameId}", { gameId: game.id }),
    sort: "hand_number",
  });

  const bundles = await Promise.all(
    hands.map(async (hand) => {
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
    }),
  );

  return { game, hands: bundles };
}
