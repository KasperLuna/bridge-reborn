# bridge-reborn

Real-time Bridge & Bid Whist, rebuilt clean. Next.js 15 App Router + React 19 + Tailwind 4 + Zustand + PocketBase (realtime).

## Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, Zustand, Motion (Framer Motion).
- **Backend**: Next.js API routes (server-authoritative mutations), PocketBase for storage + realtime.
- **Game logic**: pure, dependency-free module in `src/lib/game` (Vitest-tested).

## Setup

```sh
pnpm install
cp .env.example .env

# Start PocketBase (port 8091)
docker compose up -d --build

# Create the first superuser (PB 0.39+)
docker compose exec pocketbase /pb/pocketbase superuser upsert admin@bridge.local adminadmin

# Import the collection schema
node scripts/import-schema.mjs

# Start the app
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command          | Purpose                |
| ---------------- | ---------------------- |
| `pnpm dev`       | Dev server (Turbopack) |
| `pnpm build`     | Production build       |
| `pnpm test`      | Vitest (domain logic)  |
| `pnpm typecheck` | TypeScript check       |
| `pnpm lint`      | ESLint                 |

## Architecture

- All mutations go through `src/app/api/**` route handlers. The server is the
  single validation point and writes via an admin PocketBase client
  (`src/server/pb.ts`). Clients only read + subscribe.
- Pure game logic lives in `src/lib/game` (cards, bidding, trick, scoring,
  seats) with no PocketBase imports, shared by server and client.
- Zustand stores (`src/store`) hold client state; realtime wiring lives in
  `src/hooks/useGameSync.ts` and `src/hooks/useRoomSync.ts`.
- PocketBase schema is `pb_schema.json` (9 collections).

## Notes

- PocketBase maps to host port `8091` (the sibling `bridge` repo already uses
  `8090`). Change `docker-compose.yml` + `.env` together if you need another port.
- Double-dummy results are computed natively in `src/lib/game/dd-solver.ts`
  (pure TS, no external service) and stored on `hands.dd_result`.
