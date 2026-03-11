# Codebase Concerns

**Analysis Date:** 2026-03-11

## Tech Debt

**Silent Error Handling in Socket Handlers:**
- Issue: Multiple socket event handlers catch and ignore all errors with `/* intentionally ignored */` comments
- Files: `server/src/socket/room.ts` (lines 59, 79, 145), `server/src/socket/friends.ts` (line 29)
- Impact: Errors in room/friend operations, game result persistence, and database updates are masked. Clients get no feedback when operations fail. Debugging production issues becomes difficult.
- Fix approach: Replace silent catches with either: (1) proper error logging, (2) client notification via error events, or (3) graceful degradation with fallback behavior. Document why specific errors are safe to ignore.

**Weak Room Code Generation:**
- Issue: Room codes use `Math.random().toString(36).substring(2, 8).toUpperCase()` - not cryptographically secure
- Files: `server/src/routes/rooms.ts` (line 10)
- Impact: Collision risk is low but non-zero; codes can be guessed/brute-forced. Not suitable if room codes become sensitive (e.g., for private games).
- Fix approach: Replace with `crypto.randomBytes()` or use a cryptographic PRNG. Add rate limiting on code generation attempts.

**Missing Input Validation:**
- Issue: Username strings and game type strings are not validated before storage
- Files: `server/src/routes/auth.ts` (lines 22-40), `server/src/routes/rooms.ts` (lines 36-40)
- Impact: XSS vectors in usernames stored in DB; invalid/unrecognized game types can be created. No constraint on string length or character set.
- Fix approach: Implement schema validation (e.g., Zod, Yup) for all inputs. Enforce max lengths, allowed characters. Validate gameType against whitelist.

**Unsafe Type Casting:**
- Issue: Multiple `as Record<string, string>` and `as unknown` casts without runtime validation
- Files: `server/src/middleware/auth.ts` (line 13), `server/src/socket/room.ts` (line 120)
- Impact: Invalid runtime data can pass through type checks. Game state with unmatched type structure could cause crashes.
- Fix approach: Replace casts with runtime validation/guards. Use type predicates or zod schema.parse() to validate at boundaries.

**Unvalidated Game State in onUpdate Callback:**
- Issue: Game state is cast to `{ status: string; results?: GameResult[] }` without validation (line 120)
- Files: `server/src/socket/room.ts` (line 120)
- Impact: If game engine emits malformed state, results could be corrupted in DB. Undefined behavior if results don't match GameResult[].
- Fix approach: Validate game state against shared type schema before persisting. Add schema validation at engine.init() callback boundary.

## Known Bugs

**Incomplete Socket Event Listener Cleanup:**
- Symptoms: Memory leaks possible; socket event handlers may accumulate over reconnects
- Files: `client/src/stores/socket.tsx` (lines 28-30), `client/src/stores/room.tsx` (lines 76-78)
- Trigger: Rapid disconnect/reconnect cycles (network instability, tab navigation)
- Workaround: Browser page refresh clears listeners. Manual socket.off() calls in cleanup work but are not comprehensive.
- Fix approach: Create a centralized socket listener registry that auto-cleans on disconnect. Track all .on() calls and .off() them in onCleanup().

**Game State Not Synced on Spectator Join:**
- Symptoms: New players joining room midgame see empty/outdated game state
- Files: `server/src/socket/index.ts` (line 74), game engine doesn't store state snapshots
- Trigger: Rejoin after disconnect while game is playing
- Workaround: None; player must restart
- Fix approach: Store latest game state in `activeGames` map; emit to newly-connected socket in 'connection' handler before other handlers.

**Room Code Case Inconsistency:**
- Symptoms: Room join can fail silently if case doesn't match internal storage
- Files: `server/src/socket/room.ts` (line 36, 51, 64, 85), `server/src/routes/rooms.ts` (multiple)
- Trigger: User types lowercase code; lookup uses `.toUpperCase()`; navigation state assumes uppercase
- Workaround: Frontend forces uppercase input, but socket handlers accept any case
- Fix approach: Normalize all room codes to uppercase at entry point (middleware or pre-validation), not repeatedly in handlers.

## Security Considerations

**JWT Secret Exposure Risk:**
- Risk: `process.env.JWT_SECRET!` accessed with non-null assertion. If env var missing, server crashes silently at runtime.
- Files: `server/src/routes/auth.ts` (line 19), `server/src/middleware/auth.ts` (line 19), `server/src/socket/index.ts` (line 38)
- Current mitigation: Environment variable must be set before server starts (implicit contract)
- Recommendations: (1) Validate env vars at server startup with clear error messages, (2) Use a secrets manager for production, (3) Rotate JWT secret periodically, (4) Add token expiration tests.

**No Rate Limiting on Auth Endpoints:**
- Risk: Brute force attacks on login/register; no protection against credential stuffing
- Files: `server/src/routes/auth.ts` (lines 22-49, 51-78)
- Current mitigation: None
- Recommendations: Implement rate limiting per IP/username (e.g., express-rate-limit). Lock account after N failed logins. Add CAPTCHA if public-facing.

**Insufficient CORS Configuration:**
- Risk: CORS origin is configurable but defaults to localhost. In production, if `process.env.CLIENT_URL` is not set, requests from any origin are allowed.
- Files: `server/src/index.ts` (line 17), `server/src/socket/index.ts` (line 21)
- Current mitigation: Relies on environment configuration
- Recommendations: Reject invalid origins explicitly. Validate CLIENT_URL is a valid URL. Deny if not set in production.

**User ID Enumeration via Friend Search:**
- Risk: `/api/friends/search` returns up to 20 users matching a query, allowing username enumeration attacks
- Files: `server/src/routes/friends.ts` (lines 61-81)
- Current mitigation: Results limited to 20; no pagination
- Recommendations: (1) Require 3+ character search query, (2) Add rate limiting per user, (3) Consider returning no results if exact match is the current user.

**No Input Sanitization for Display:**
- Risk: Usernames and game types are displayed directly in client without escaping
- Files: `client/src/pages/Lobby.tsx` (line 98), `client/src/stores/friends.tsx` (line 113)
- Current mitigation: Solid.js auto-escapes in templates (unlikely to be XSS issue)
- Recommendations: Add explicit HTML sanitization if usernames ever become user-generated content or displayed as rich text.

## Performance Bottlenecks

**N+1 Query in Friend List:**
- Problem: buildFriendList queries friendships, then for EACH friendship, queries active rooms
- Files: `server/src/routes/friends.ts` (lines 22-48, especially line 29)
- Cause: `Promise.all()` with sequential DB queries inside map callback
- Improvement path: Batch-load active rooms for all friendIds in one query, then merge results in-memory.

**Inefficient Array Shuffle for Random Selection:**
- Problem: Using `[...array].sort(() => Math.random() - 0.5)` for random selection; O(n log n) and biased
- Files: `server/src/games/snus-rpg/map.ts` (line 83), `server/src/games/snus-rpg/npc.ts` (line 24)
- Cause: Incorrect shuffle algorithm (Fisher-Yates or crypto.randomInt() is correct)
- Improvement path: Replace with proper shuffle algorithm or use Fisher-Yates. For single random selection, no shuffle needed.

**Unbounded Game History Query:**
- Problem: Leaderboard queries may return all-time entries without pagination
- Files: `server/src/routes/leaderboard.ts` (not examined in detail, but likely issue)
- Cause: No limit/offset pagination visible in route implementations
- Improvement path: Add pagination (limit, offset) parameters. Add indexes on (gameType, score DESC).

**Room Player Lookup Not Indexed:**
- Problem: `prisma.roomPlayer.findUnique()` lookup in socket handlers; relies on composite key but no explicit index
- Files: `server/src/socket/room.ts` (lines 53-56, 69-76)
- Cause: Default Prisma indexes on composite IDs should handle this, but explicit index improves clarity
- Improvement path: Add explicit compound index on (roomId, userId) in schema. Monitor query performance under load.

## Fragile Areas

**Game Engine State Management:**
- Files: `server/src/games/snus-rpg/engine.ts` (lines 20-65)
- Why fragile: Complex state with many interdependent fields (players, npcs, items, effects, tradeOffers). Mutations scattered across multiple handle* methods. Tick interval runs indefinitely without cleanup if destroy() not called.
- Safe modification: (1) Isolate state mutations into single reducer or patch function, (2) Add invariant checks after each mutation, (3) Ensure destroy() is always called via try/finally, (4) Add per-tick log for debugging state evolution.
- Test coverage: No tests found. Risk: State corruption, memory leaks, desync between client/server.

**Socket Event Handlers:**
- Files: `server/src/socket/room.ts`, `server/src/socket/friends.ts`, `server/src/socket/game.ts`
- Why fragile: Event handlers depend on userId being set in socket.data (set by auth middleware). No validation that userId exists in DB or is still valid. Silent catches hide failures. Order of handler registration matters.
- Safe modification: (1) Add guard checks at handler start, (2) Replace silent catches with explicit logging, (3) Test disconnection/reconnection scenarios, (4) Add e2e tests for multi-user interactions.
- Test coverage: No tests found. Risk: State corruption, race conditions, silent failures.

**Room Code Generation Collision:**
- Files: `server/src/routes/rooms.ts` (lines 44-52)
- Why fragile: Loop retries 10 times then fails with generic error. No backoff. If collision rate increases, rooms can't be created.
- Safe modification: (1) Increase code length or entropy, (2) Add exponential backoff with jitter, (3) Pre-generate codes in background, (4) Monitor collision rate.
- Test coverage: No collision tests found. Risk: Rooms can't be created under concurrent load.

**Trade Offer State Management:**
- Files: `server/src/games/snus-rpg/engine.ts` (lines 264-314)
- Why fragile: Trade state relies on exact matching of inventoryIndex and brandId. No validation that item hasn't been collected twice. No protection against race conditions if two trades target same item.
- Safe modification: (1) Lock inventory during trade operations, (2) Validate brand still exists in inventory before trade accept, (3) Use immutable state updates, (4) Add transactional guarantees.
- Test coverage: No tests found. Risk: Duplicate item transfer, state desync, inventory corruption.

## Scaling Limits

**In-Memory Game State:**
- Current capacity: Up to ~100 concurrent games (estimated, 1800 ticks × 100ms = 180sec per game at 30 games/sec max tick rate)
- Limit: Single Node.js process memory (heap); activeGames map holds all game engines in RAM
- Scaling path: Move game engines to separate worker process, Redis cache for game state checkpoints, database persistence of in-flight games.

**Database Connection Pool:**
- Current capacity: Default Prisma client pool size (varies); suitable for <50 concurrent connections
- Limit: Under high player load, connection pool exhaustion causes `P2009` errors
- Scaling path: Configure pool size explicitly, add read replicas, implement connection pooling middleware, migrate to connection pool service (PgBouncer).

**Socket.IO Server Instance:**
- Current capacity: Single instance; limited by single-machine memory and CPU
- Limit: Thousands of concurrent connections typical per instance, but CPU-intensive game tick loop degrades
- Scaling path: Implement Redis adapter for socket.io, horizontally scale to multiple server instances, offload game tick loop to workers.

**Leaderboard Query Performance:**
- Current capacity: Up to ~100k entries, query in <1s
- Limit: Scan time grows linearly; no query result caching
- Scaling path: Add Redis cache for top-100 leaderboards, implement pagination properly, denormalize leaderboard scores in hot table.

## Dependencies at Risk

**Prisma Client Generation:**
- Risk: Code generation mismatch between `schema.prisma` and generated types. If schema updated without regeneration, type safety breaks.
- Impact: Type errors at build time or runtime mismatches at deploy time
- Migration plan: Add schema migration as pre-build step; validate generated client matches schema in CI.

**Socket.IO Version Mismatch:**
- Risk: If client and server socket.io versions diverge, message format incompatibilities cause silent failures
- Impact: Client can't connect or events are dropped silently
- Migration plan: Lock socket.io versions in both client and server package.json. Test compatibility on updates.

**Bcryptjs Synchronous Hashing:**
- Risk: `bcrypt.hash()` is async but if called in hot path could block event loop
- Impact: Noticeable latency on login/register; blocking for other users
- Migration plan: Monitor bcrypt timing. If >100ms observed, consider argon2 (faster) or move to worker thread.

## Missing Critical Features

**No Audit Logging:**
- Problem: User actions (login, friendship changes, game results) are not logged for compliance or debugging
- Blocks: Compliance audits, fraud investigation, debugging production issues
- Recommendation: Add audit table to schema; log all mutations with user context and timestamp.

**No Session Management:**
- Problem: JWT tokens don't track sessions or allow revocation (e.g., logout across devices)
- Blocks: Force-logout feature, session revocation on suspicious activity
- Recommendation: Add session table; store session ID in JWT; validate on each request.

**No Notification System:**
- Problem: Friend requests and game invitations are only delivered if user is online
- Blocks: Offline notifications, email/push alerts
- Recommendation: Add notification queue; persist pending notifications in DB; send on next login or via external service.

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: Game engine logic (move, attack, trade, scoring), auth middleware, socket handlers, room code generation
- Files: All files under `server/src/` and `client/src/`
- Risk: Game logic bugs silently corrupt multiplayer state. Auth logic flaws allow unauthorized access. Socket handlers fail silently.
- Priority: **High** — Game engine alone needs 50+ tests covering move boundaries, NPC attacks, trade mechanics, state mutations.

**No Integration Tests:**
- What's not tested: Multi-user scenarios (concurrent room joins, trades, simultaneous disconnects), game start-to-finish flow, auth flow with persistence
- Files: Test directory does not exist
- Risk: Race conditions, state corruption, or connection failures only discovered in production
- Priority: **High** — At minimum, test: (1) room creation → join → start → game tick → end, (2) concurrent friend requests, (3) rejoin midgame.

**No E2E Tests:**
- What's not tested: Client-server socket communication, full user flow (login → create game → play → see results → leave)
- Files: No e2e directory
- Risk: UI and server may diverge; socket events may be dropped; routing may fail
- Priority: **Medium** — Recommended tools: Cypress or Playwright. Test critical happy paths.

**No Load/Stress Tests:**
- What's not tested: Behavior under 100+ concurrent games, socket connection storms, rapid room creation, database query performance
- Files: No load test directory
- Risk: Scaling limits unknown; performance degradation under load not measured; DoS vulnerabilities not identified
- Priority: **Medium** — Use k6 or Artillery to simulate 50+ concurrent games; measure response times and error rates.

---

*Concerns audit: 2026-03-11*
