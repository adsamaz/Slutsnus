# Technology Stack

**Analysis Date:** 2026-03-11

## Languages

**Primary:**
- TypeScript 5.7.3 - Used across server, client, and shared packages

## Runtime

**Environment:**
- Node.js (version not pinned, use .nvmrc recommended)

**Package Manager:**
- npm with workspaces
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Express 4.21.2 - REST API server framework (`/c/Users/addes/Git/Slutsnus/server/src/index.ts`)
- Solid.js 1.9.3 - Client UI framework
- Socket.io 4.8.1 (server 4.8.1, client 4.8.1) - Real-time bidirectional communication (`/c/Users/addes/Git/Slutsnus/server/src/socket/index.ts`)

**Routing:**
- @solidjs/router 0.15.3 - Client-side routing

**Build/Dev:**
- Vite 6.1.0 - Client development server and build tool (`/c/Users/addes/Git/Slutsnus/client/vite.config.ts`)
- vite-plugin-solid 2.11.0 - Solid.js support for Vite
- ts-node-dev 2.0.0 - Development server for TypeScript with auto-reload
- TypeScript compiler (tsc) - For building server and shared packages

**Build Orchestration:**
- concurrently 9.1.2 - Runs server and client dev servers in parallel
- wait-on 9.0.4 - Ensures server is ready before starting client

## Key Dependencies

**Critical:**
- @prisma/client 5.22.0 (server) / 7.5.0 (root) - Database ORM (`/c/Users/addes/Git/Slutsnus/server/prisma/schema.prisma`)
- bcryptjs 2.4.3 - Password hashing (`/c/Users/addes/Git/Slutsnus/server/src/routes/auth.ts`)
- jsonwebtoken 9.0.2 - JWT token generation and verification (`/c/Users/addes/Git/Slutsnus/server/src/middleware/auth.ts`)
- uuid 11.0.3 - Unique identifier generation

**HTTP & Middleware:**
- cors 2.8.5 - Cross-origin resource sharing
- cookie 0.7.2 - Cookie parsing utility
- cookie-parser 1.4.7 - Express middleware for parsing cookies
- express 4.21.2 - Web server framework

**Configuration:**
- dotenv 17.3.1 - Environment variable loading

**Database:**
- Prisma 5.22.0 - Database toolkit and ORM

**Path Resolution:**
- tsconfig-paths 4.2.0 - TypeScript path mapping support for imports

## Configuration

**Environment:**
- Configured via `.env` file (not committed)
- Key variables: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CLIENT_URL`, `NODE_ENV`

**Build:**
- TypeScript configuration: `tsconfig.base.json` (base), `client/tsconfig.json`, `server/tsconfig.json`, `shared/tsconfig.json`
- ESLint config: `eslint.config.js` (flat config format)
- Prettier config: `.prettierrc`
- Vite config: `client/vite.config.ts`

**Workspace:**
- Root `package.json` defines monorepo with three workspaces: `shared`, `server`, `client`
- Shared types compiled to dist for use by both server and client

## Platform Requirements

**Development:**
- Node.js (no specific version pinned)
- npm
- TypeScript support

**Production:**
- Node.js runtime
- PostgreSQL database
- Environment variables: `DATABASE_URL`, `JWT_SECRET`, `PORT`, `CLIENT_URL`, `NODE_ENV=production`
- Server runs on port 4000 (configurable via `PORT`)
- Client runs on port 3003 in dev (configurable in Vite config)

---

*Stack analysis: 2026-03-11*
