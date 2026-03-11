# Architecture

**Analysis Date:** 2026-03-11

## Pattern Overview

**Overall:** Full-stack real-time multiplayer game platform with modular game engine architecture

**Key Characteristics:**
- Monorepo structure (workspaces: shared, server, client)
- Real-time communication via Socket.IO with JWT authentication
- Pluggable game engine pattern supporting multiple game types
- Layered separation: shared types, backend services, frontend stores

## Layers

**Shared Package (`shared/src/`):**
- Purpose: Single source of truth for type definitions across client and server
- Location: `shared/src/types.ts`
- Contains: Type interfaces for rooms, players, game actions, WebSocket events, Snus RPG entities
- Depends on: Nothing (zero dependencies)
- Used by: Server and client code (imported as `@slutsnus/shared`)

**Server Application Layer (`server/src/`):**
- Purpose: HTTP API and WebSocket server orchestration
- Location: `server/src/index.ts` (Express + HTTP server setup)
- Contains: Route handlers, Socket.IO handlers, middleware
- Depends on: Express, Socket.IO, Prisma, bcryptjs, JWT
- Used by: Client via HTTP and WebSocket

**Server Data Layer (`server/src/db/`):**
- Purpose: Database abstraction and ORM instance
- Location: `server/src/db/client.ts`
- Contains: Prisma client singleton
- Depends on: Prisma ORM, database schema
- Used by: Routes and socket handlers for persistence

**Server Route Handlers (`server/src/routes/`):**
- Purpose: HTTP REST endpoints for authentication and metadata
- Location: `server/src/routes/auth.ts`, `rooms.ts`, `friends.ts`, `leaderboard.ts`
- Contains: Register, login, logout, /me, room CRUD, friends operations, leaderboard queries
- Depends on: Prisma, bcryptjs, JWT, shared types
- Used by: Client HTTP calls

**Server Socket Layer (`server/src/socket/`):**
- Purpose: Real-time event handling and game state synchronization
- Location: `server/src/socket/index.ts` (server init), `room.ts`, `game.ts`, `friends.ts`
- Contains: Connection auth, room lifecycle (join/leave/start), game action routing, friend online status
- Depends on: Socket.IO, Prisma, game registry, shared types
- Used by: Client socket emissions

**Game Engine Registry (`server/src/games/registry.ts`):**
- Purpose: Factory pattern for instantiating game engines
- Location: `server/src/games/registry.ts`
- Contains: GameEngine interface definition, gameRegistry mapping game types to engine classes
- Depends on: SnusRpgEngine class
- Used by: Room handlers when starting a game

**Game Engines (`server/src/games/snus-rpg/`):**
- Purpose: Game-specific simulation and state management
- Location: `server/src/games/snus-rpg/engine.ts`, `map.ts`, `brands.ts`, `npc.ts`
- Contains: SnusRpgEngine (main loop with tick system), map generation, brand definitions, NPC AI
- Depends on: Shared types, uuid
- Used by: Socket.IO game action handlers via activeGames map

**Client App (`client/src/`):**
- Purpose: Solid.js SPA with routing, state management, and game rendering
- Location: `client/src/index.tsx` (entry), `client/src/App.tsx` (router + provider setup)
- Contains: Route definitions, provider nesting (Auth, Socket, Room, Friends)
- Depends on: Solid.js, @solidjs/router, Socket.IO client, shared types
- Used by: Renders in browser

**Client Pages (`client/src/pages/`):**
- Purpose: Top-level route components with page-specific logic
- Location: `Home.tsx`, `Login.tsx`, `Register.tsx`, `Lobby.tsx`, `GamePage.tsx`, `GameDetail.tsx`, `Friends.tsx`, `Leaderboard.tsx`, `Profile.tsx`
- Contains: Page-level state orchestration, form handling, navigation
- Depends on: Stores, Socket.IO, Router
- Used by: App router

**Client Stores (`client/src/stores/`):**
- Purpose: Global state management using Solid.js context
- Location: `auth.tsx`, `socket.tsx`, `room.tsx`, `friends.tsx`
- Contains: Auth provider (user + token), Socket provider (connection management), Room provider (current room state), Friends provider (friend list + online status)
- Depends on: Solid.js, Socket.IO, shared types
- Used by: Page components via context hooks

**Client Components (`client/src/components/`):**
- Purpose: Reusable UI elements
- Location: `Button.tsx`, `Modal.tsx`, `Toast.tsx`, `Navbar.tsx`, `ProtectedRoute.tsx`, `SnusIcon.tsx`
- Contains: Common UI primitives and logic (auth guard, notifications, navigation)
- Depends on: Solid.js, Router
- Used by: Pages and other components

**Client Games (`client/src/games/`):**
- Purpose: Game renderer and UX
- Location: `client/src/games/GameContainer.tsx`, `snus-rpg/index.tsx`, `snus-rpg/renderer.ts`, `snus-rpg/hud.tsx`, `snus-rpg/EndScreen.tsx`, `snus-rpg/TradeModal.tsx`
- Contains: Game loop (canvas rendering), HUD (score, inventory, effects), trade UI, end screen
- Depends on: Solid.js, Socket.IO, shared types
- Used by: GamePage route

## Data Flow

**Authentication Flow:**
1. User enters credentials on Login/Register page
2. Page POST to `/api/auth/register` or `/api/auth/login` (HTTP)
3. Server hashes password (bcryptjs), creates/validates user (Prisma), signs JWT
4. Server sets httpOnly cookie with JWT token
5. Client stores user state in AuthProvider
6. AuthProvider auto-connects Socket.IO when user exists

**Room Lifecycle:**
1. User navigates to `/games/:slug` (GameDetail page shows room creation)
2. User clicks "Create" or "Join" (HTTP POST to `/api/rooms`)
3. Server creates Room record (Prisma), returns code
4. User navigates to `/lobby/:code`
5. Lobby component emits `room:join` via Socket.IO
6. Server adds player to room (Prisma RoomPlayer), broadcasts `room:update`
7. Players click "Ready" → emit `room:ready` → server updates ready flag, broadcasts update
8. Host clicks "Start Game" → emit `room:start`
9. Server instantiates game engine (SnusRpgEngine) from registry, stores in activeGames Map
10. Engine.init() sets up state, starts tick loop (100ms intervals)
11. Server emits `room:started` → client navigates to `/game/:code`

**Game Action Flow:**
1. Player presses key (up/down/left/right/space) on GamePage
2. Key handler emits `game:action` with action object via Socket.IO
3. Socket game handler receives, gets engine from activeGames map, calls engine.handleEvent(userId, action)
4. Engine processes action (movement, attack, trade), mutates state
5. Engine calls onStateUpdate callback
6. onStateUpdate emits `game:state` to all players in room
7. Client GamePage receives update, stores in component state
8. Solid.js reactive effects trigger re-render
9. Canvas render loop (requestAnimationFrame) draws new state from props
10. HUD updates with score, inventory, effects, trade offers

**Game End Flow:**
1. Engine detects win condition (all items collected OR time expired)
2. Engine.endGame() calculates results, sets status to 'ended'
3. onStateUpdate emits `game:state` with ended status
4. Socket emits `game:end` with results array
5. Client GamePage shows EndScreen component
6. Server persists GameSession, GameSessionPlayer, LeaderboardEntry records (Prisma)
7. Client can navigate to `/leaderboard` or play again

**Friends & Invites:**
1. User navigates to `/friends`
2. Page emits `friends:list` request on mount
3. Server returns friend list with online status from onlineUsers map
4. In Lobby, user clicks "Invite" for online friend
5. Emits `friends:invite` with targetUserId and roomCode
6. Server emits `friends:invite` to target user (broadcast)
7. Target user sees notification in Lobby or wherever they are
8. Target accepts → emits `friends:inviteAccept` → server joins them to room

## State Management

**Server-side:**
- `onlineUsers` (Map<userId, Set<socketId>>): Tracks connected players
- `activeGames` (Map<roomCode, GameEngine>): Holds in-progress game instances
- `engine.state` (SnusRpgState): Immutable-style updates, spread operators for player/effect mutations

**Client-side:**
- `AuthState`: { user, token }
- `RoomState`: { room } (current room info)
- `SocketState`: Socket.IO client instance
- `FriendsState`: { friends } (list with online/status)
- Component local state: ready flag, trade modal visibility, etc.

**Database (Prisma):**
- User, Room, RoomPlayer, GameSession, GameSessionPlayer, LeaderboardEntry, Friendship tables
- Migrations in `server/prisma/migrations/`

## Key Abstractions

**GameEngine Interface:**
- Purpose: Defines contract for game implementations
- Examples: `SnusRpgEngine` implements GameEngine
- Pattern: Factory pattern via gameRegistry, dependency injection of onStateUpdate callback
- Methods: init(roomId, players, onStateUpdate), handleEvent(playerId, action), getState(), destroy()

**SnusRpgState:**
- Purpose: Complete game state snapshot (players, items, NPCs, map, ticks, trade offers)
- File: `shared/src/types.ts` (SnusRpgState interface)
- Immutability: Engine uses spread operators and map mutations; state is frozen at emission time

**RoomInfo & RoomPlayer:**
- Purpose: Abstraction over database Room/RoomPlayer for client consumption
- File: `shared/src/types.ts`
- Pattern: Server builds RoomInfo via buildRoomInfo() helper in room.ts, broadcasts to clients

**Socket Event Types:**
- Purpose: Type-safe Socket.IO messaging with ClientToServerEvents and ServerToClientEvents interfaces
- File: `shared/src/types.ts`
- Pattern: Declared at shared level, passed as generics to Socket.IO Server/Client constructors

**GameAction:**
- Purpose: Generic action type for extensible game commands
- File: `shared/src/types.ts`
- Pattern: { type: string, payload?: unknown } allows any game to define custom actions

## Entry Points

**Server (`server/src/index.ts`):**
- Triggers: npm run dev or node dist/index.js
- Responsibilities: Initialize Express, set up CORS, parse JSON/cookies, mount routes, initialize Socket.IO, listen on PORT

**Client (`client/src/index.tsx`):**
- Triggers: Vite dev server or built bundle
- Responsibilities: Render Solid.js App component into #root DOM element, initialize routing and provider context

**Socket Connection (`server/src/socket/index.ts`):**
- Triggers: Client connects after authentication
- Responsibilities: Verify JWT from httpOnly cookie, register connection, track online users, attach event handlers

**Game Start (`server/src/socket/room.ts`, room:start event):**
- Triggers: Host emits room:start after all players ready
- Responsibilities: Fetch room + players from DB, instantiate engine, set up tick loop, sync state to clients

**Game Tick Loop (`server/src/games/snus-rpg/engine.ts`):**
- Triggers: setInterval every 100ms after engine.init()
- Responsibilities: Increment tick counter, move NPCs, resolve attacks, collect items, expire effects, check win conditions, emit state updates

## Error Handling

**Strategy:** Try-catch blocks in async route handlers and socket handlers; errors logged to console and sent as JSON responses or socket error events

**Patterns:**
- HTTP errors: Return JSON with { error: 'message' } and appropriate status codes (400, 401, 404, 409, 500)
- Socket errors: Emit 'room:error' or 'game:error' events to client
- Game engine: Return early (guards) rather than throw; state remains valid
- Client: Catch errors in async effects, display toast notifications via ToastContainer

**Common Error Cases:**
- Invalid username/password (401)
- Username already taken (409)
- Room not found (404)
- Unauthorized game start (only host can start)
- Player not ready when game starts
- Invalid game type in registry
- Expired JWT token (socket middleware)

## Cross-Cutting Concerns

**Logging:**
- Server: console.log/error in route handlers and socket events
- Client: No structured logging, uses browser console

**Validation:**
- Server routes: Basic typeof checks on request body (username, password required)
- Socket handlers: Guard checks on room/player existence, game state
- Game engine: Validation of move coordinates, inventory indices, distance checks for trades

**Authentication:**
- Server: JWT in httpOnly cookie, verified in socket.io middleware via parse of cookie header
- Client: AuthProvider context, ProtectedRoute wrapper on authenticated pages
- Session: Automatic socket reconnect when user logs out (effect in SocketProvider watches authState.user)

---

*Architecture analysis: 2026-03-11*
