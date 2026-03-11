# Coding Conventions

**Analysis Date:** 2026-03-11

## Naming Patterns

**Files:**
- PascalCase for components: `Button.tsx`, `Navbar.tsx`, `GamePage.tsx`
- camelCase for utilities and services: `auth.ts`, `client.ts`, `engine.ts`, `npc.ts`
- index.ts for barrel exports: `src/index.ts` re-exports from other modules
- Lowercase for directories: `components/`, `routes/`, `games/`, `middleware/`, `socket/`, `stores/`

**Functions:**
- camelCase for all function names: `signToken()`, `initSocket()`, `generateCode()`, `handleMove()`, `collectItem()`
- Async functions prefixed with handlers when used as event handlers: `handleCreate()`, `handleJoin()`, `handleMove()`, `handleAttack()`
- Private methods in classes prefixed with `private`: `private tick()`, `private getFloorTiles()`, `private allItemsCollected()`

**Variables:**
- camelCase for variables: `const app = express()`, `const state`, `const player`, `const snusItems`
- UPPER_SNAKE_CASE for constants: `COOKIE_OPTIONS`, `GAME_DURATION_TICKS`, `TICK_INTERVAL_MS`, `MAP_WIDTH`, `MAP_HEIGHT`
- Underscore prefix for unused parameters: `(_req, res: Response)`, `(_value)` (used in eslint config with `argsIgnorePattern: "^_"`)

**Types:**
- PascalCase for interfaces and types: `AuthState`, `RoomInfo`, `GameEngine`, `SnusRpgState`, `PlayerInfo`
- Suffix `-Request` for request types: `RegisterRequest`, `LoginRequest`
- Suffix `-Response` for response types: `AuthResponse`
- Generic event types with event name: `ClientToServerEvents`, `ServerToClientEvents`

## Code Style

**Formatting:**
- Prettier configured with specific rules
- 2-space indentation (tabWidth: 2)
- Print width: 100 characters
- Single quotes (singleQuote: true)
- Trailing commas in all contexts (trailingComma: "all")
- Semicolons required (semi: true)

**Linting:**
- ESLint with TypeScript plugin (`@typescript-eslint/eslint-plugin`)
- TypeScript strict mode enabled
- Rules:
  - `@typescript-eslint/no-explicit-any` as warning
  - `@typescript-eslint/no-unused-vars` with underscore pattern ignored
  - `no-undef` disabled (handled by TypeScript)
- JSX support enabled

## Import Organization

**Order:**
1. External libraries (e.g., `import express from 'express'`)
2. Framework/library utilities (e.g., `import { createContext, useContext } from 'solid-js'`)
3. Relative imports from modules (e.g., `import { prisma } from '../db/client'`)
4. Shared package imports (e.g., `import { RegisterRequest } from '@slutsnus/shared'`)

**Path Aliases:**
- `@slutsnus/shared`: Maps to `../shared/src/index.ts` in server and client projects
- Configured in each workspace's `tsconfig.json` with paths field

**Example pattern from `server/src/routes/auth.ts`:**
```typescript
import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { RegisterRequest, LoginRequest } from '@slutsnus/shared';
```

## Error Handling

**Patterns:**
- Try-catch blocks for async operations (database, HTTP requests, JWT verification)
- Empty catch blocks (`catch { }`) are used when error details are not needed
- Error details logged to console in some cases: `console.error('Register error:', err)`
- HTTP responses use standard status codes:
  - 400 for missing/invalid request data
  - 401 for authentication failures
  - 409 for conflict (e.g., username exists)
  - 404 for not found
  - 500 for server errors
- Response pattern: `res.status(code).json({ error: 'message' })`
- Client-side error handling converts responses to Error objects: `throw new Error(err.error)`
- Socket.io auth middleware uses `next(new Error('message'))` for failures
- Validation checks before operations (early returns): `if (!username || !password) { res.status(400)...return; }`

**Example from `server/src/routes/auth.ts`:**
```typescript
try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        res.status(409).json({ error: 'Username already taken' });
        return;
    }
    // ... proceed with creation
} catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
}
```

## Logging

**Framework:** Console-based logging (`console.log`, `console.error`)

**Patterns:**
- Server startup: `console.log(\`Server running on http://localhost:${PORT}\`)`
- Errors logged with context: `console.error('Register error:', err)`
- No structured logging framework used
- Limited to critical points (startup, errors)

## Comments

**When to Comment:**
- Section separators for file organization (seen in shared types):
  ```typescript
  // ─────────────────────────────────────────────────
  // Core User
  // ─────────────────────────────────────────────────
  ```
- Inline comments for non-obvious logic: `// Notify friends of online status`
- Comments for game mechanics: `// Move NPCs`, `// NPC attacks`, `// Win condition`

**JSDoc/TSDoc:**
- Not widely used in the codebase
- No function documentation headers observed
- Type annotations provide inline documentation

## Function Design

**Size:** Functions are moderately sized (20–100 lines for game logic, 5–30 lines for routes/handlers)

**Parameters:**
- Explicit typed parameters (no implicit any)
- Payload objects for complex event handlers: `payload: { direction: string }`, `payload: { targetPlayerId: string; inventoryIndex: number; displayedName: string }`
- Response objects used as continuation pattern: `res: Response` parameter in Express handlers
- Socket parameter for real-time handlers

**Return Values:**
- Explicit return types on functions
- Handlers return void: `function initSocket(httpServer: HttpServer): void`
- Async functions return Promise types: `async (): Promise<void>`, `async (): Promise<string>`
- Private methods with explicit void returns

## Module Design

**Exports:**
- Router exports from route files: `export default router`
- Named exports for handlers and utilities: `export const gameRegistry`, `export function authMiddleware`
- Context and provider exports from stores: `export const AuthProvider`, `export function useAuth()`
- Barrel export pattern in shared: `export * from './types'` in `src/index.ts`

**Barrel Files:**
- `src/index.ts` in shared package re-exports types: `export * from './types'`
- Individual feature exports in other packages (e.g., `export default router` per route)

## State Management

**Solid.js Pattern (Client):**
- Context-based state management using `createContext`
- Store pattern with `createStore` for reactive state
- Provider components for context setup: `AuthProvider`, `RoomProvider`
- Custom hooks for accessing context: `useAuth()`, `useRoom()`
- Tuple return pattern: `[state, actions]` from context

**Backend Pattern:**
- Global maps for session state: `export const onlineUsers = new Map<string, Set<string>>()`
- Instance variables in engine classes: `private state!: SnusRpgState`
- Event handlers for state mutations via Socket.io

## Type Safety

**TypeScript Configuration:**
- Target: ES2022
- Module: ESNext
- Strict mode enabled
- `esModuleInterop: true`
- `skipLibCheck: true` for faster compilation
- Declaration maps and source maps enabled
- Each workspace extends `tsconfig.base.json`

**Type Patterns:**
- Interface definitions for data structures (no type aliases for objects)
- Union types for status fields: `'waiting' | 'playing' | 'ended'`
- Record types for lookups: `Record<string, SnusPlayer>`
- Generic constraints on game engine: `GameEngine` interface with typed methods

---

*Convention analysis: 2026-03-11*
