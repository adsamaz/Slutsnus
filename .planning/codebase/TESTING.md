# Testing Patterns

**Analysis Date:** 2026-03-11

## Test Framework

**Status:** No testing framework configured

**Current State:**
- No Jest, Vitest, or other test runner found in `package.json` files
- No test configuration files (`jest.config.js`, `vitest.config.ts`) present
- No test files found in source directories (`*.test.ts`, `*.spec.ts`)
- ESLint and Prettier configured for code quality, but no automated tests

**Implication:**
Testing must be added as a future phase. The codebase has no automated test coverage.

## Test File Organization

**Proposed Pattern (Not Yet Implemented):**
- Co-located test files recommended based on project structure
- Tests should be placed in same directory as code being tested
- Example for new tests:
  - Source: `server/src/routes/auth.ts` → Test: `server/src/routes/auth.test.ts`
  - Source: `client/src/components/Button.tsx` → Test: `client/src/components/Button.test.tsx`

**Naming Convention:**
- Suffix with `.test.ts` or `.test.tsx`
- Alternative: `.spec.ts` or `.spec.tsx`

## Test Types Not Yet Implemented

**Unit Tests:**
- Would test individual functions and components in isolation
- Recommended scope: Route handlers, game engine logic, utility functions, components
- Currently no unit tests exist

**Integration Tests:**
- Would test interactions between modules (e.g., database + routes, socket + game engine)
- Recommended scope: API endpoints with actual database, socket event handling
- Currently no integration tests exist

**E2E Tests:**
- Would test full user flows (login → create room → play game)
- Currently no E2E testing framework configured

## Critical Areas Needing Tests

**Server (High Priority):**
- `server/src/routes/auth.ts` - Authentication logic (register, login, logout, /me endpoint)
- `server/src/middleware/auth.ts` - JWT verification and request augmentation
- `server/src/games/snus-rpg/engine.ts` - Game state management and event handling (large, complex file with ~327 lines)
- `server/src/socket/index.ts` - Socket connection, authentication, user tracking
- `server/src/games/snus-rpg/npc.ts` - NPC behavior logic
- Database operations via Prisma client

**Client (Medium Priority):**
- `client/src/stores/auth.tsx` - Auth state management and API calls
- `client/src/stores/room.tsx` - Room state management and API calls
- `client/src/components/Button.tsx` - Component rendering with variant handling
- `client/src/pages/Home.tsx` - Game selection and room join/create flows
- Socket event handling in `stores/socket.tsx`

**Shared (Low Priority):**
- Type definitions are self-documenting
- Limited logic in shared package

## Mocking Approach (Recommended)

**Database Mocking:**
- Use Prisma mock client for testing database operations
- Or use in-memory database approach for integration tests
- Avoid real database calls in unit tests

**Socket.io Mocking:**
- Mock Socket.io events for testing handlers
- Mock socket.emit and socket.broadcast

**HTTP Client Mocking:**
- Mock fetch API for client store tests
- Test both success and error responses

**Example Pattern for Implementation:**
```typescript
// Unit test for route handler
describe('POST /auth/register', () => {
    it('should return 409 if username exists', async () => {
        // Mock prisma.user.findUnique to return existing user
        // Call handler with request
        // Assert 409 status response
    });
});

// Component test
describe('Button component', () => {
    it('should apply primary variant class by default', () => {
        // Render Button with default props
        // Assert button has 'btn btn-primary' class
    });
});
```

## Test Coverage Gaps

**Untested Areas:**
- `server/src/games/snus-rpg/engine.ts` - Game state transitions, item collection, trading, NPC combat (327 lines, most complex file)
- `server/src/routes/auth.ts` - Login/register validation, password hashing, JWT signing
- `server/src/routes/friends.ts` - Friend requests, pending/accepted status management
- `server/src/routes/leaderboard.ts` - Score tracking and ranking
- `server/src/routes/rooms.ts` - Room creation, joining, player management
- `server/src/socket/room.ts` - Socket room events
- `server/src/socket/game.ts` - Game state distribution via sockets
- `client/src/stores/auth.tsx` - Login, register, logout flows, error handling
- `client/src/stores/room.tsx` - Room creation, joining, leaving
- `client/src/pages/` - All pages lack tests

**Risk Level:** HIGH - No coverage means bugs can slip through untested game logic and authentication flows.

## Error Handling Testing

**What to Test:**
- Invalid credentials in login
- Duplicate username in registration
- Missing required fields
- Network errors in fetch calls
- Invalid JWT tokens
- Socket authentication failures
- Game boundary conditions (invalid moves, out-of-bounds positions)

**Current Pattern (from auth.ts):**
```typescript
try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        res.status(409).json({ error: 'Username already taken' });
        return;
    }
    // ...
} catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
}
```

Tests should verify both the success path and error path behavior.

## Async Testing Pattern (Recommended)

**Client (Solid.js):**
```typescript
// Test async store actions
describe('useAuth', () => {
    it('should set user on successful login', async () => {
        // Mock fetch to return user
        // Call login action
        // Assert user state updated
    });
});
```

**Server (Express + Socket.io):**
```typescript
// Test async route handlers
describe('POST /auth/login', () => {
    it('should set cookie and return user', async () => {
        // Mock prisma and bcrypt
        // Call handler
        // Assert cookie header and response
    });
});
```

## Recommended Testing Stack

**For Implementation:**
- **Test Runner:** Vitest (modern, fast, good TypeScript support)
- **Assertion Library:** Vitest's built-in expect (compatible with Jest)
- **Mocking:** Vitest mocking utilities, or `@testing-library/jest-dom` for DOM testing
- **Server Mocking:** `node-fetch-mock` or `jest-fetch-mock`
- **Database Testing:** Prisma's testing utilities or in-memory SQLite

**Run Commands (When Implemented):**
```bash
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
```

---

*Testing analysis: 2026-03-11*
