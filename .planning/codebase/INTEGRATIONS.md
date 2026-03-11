# External Integrations

**Analysis Date:** 2026-03-11

## APIs & External Services

**None detected** - Application is self-contained with no external API integrations (no Stripe, AWS, Supabase, etc.)

## Data Storage

**Databases:**
- PostgreSQL
  - Connection: `DATABASE_URL` environment variable
  - Client: Prisma 5.22.0 ORM (`/c/Users/addes/Git/Slutsnus/server/src/db/client.ts`)
  - Schema: `/c/Users/addes/Git/Slutsnus/server/prisma/schema.prisma`

**File Storage:**
- Local filesystem only - No external file storage service

**Caching:**
- None - No Redis or caching layer detected

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based authentication

**Implementation:**
- Approach: JWT tokens issued on login/register, stored in httpOnly cookies
- Password hashing: bcryptjs with 10 salt rounds
- Token secret: `JWT_SECRET` environment variable
- Token expiration: 7 days
- Cookie settings: httpOnly, sameSite=lax, secure (in production only), path=/
- Auth routes: `/c/Users/addes/Git/Slutsnus/server/src/routes/auth.ts`
- Auth middleware: `/c/Users/addes/Git/Slutsnus/server/src/middleware/auth.ts`
- Socket.io auth: JWT verification from cookies (`/c/Users/addes/Git/Slutsnus/server/src/socket/index.ts`)

**Endpoints:**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user (requires auth)

## Real-Time Communication

**Socket.io 4.8.1:**
- Protocol: WebSocket with fallback
- Server: `http://localhost:4000` (in production: `CLIENT_URL` environment variable)
- CORS enabled with credentials
- Client port: 3003 in dev, proxied via `/socket.io`
- Auth: JWT token from httpOnly cookie required

**Socket Events:**
- Client-to-server: `room:join`, `room:ready`, `room:leave`, `room:start`, `game:action`, `friends:invite`, `friends:inviteAccept`
- Server-to-client: `room:update`, `room:error`, `room:started`, `game:state`, `game:end`, `friends:status`, `friends:invite`, `friends:update`
- Handlers: `/c/Users/addes/Git/Slutsnus/server/src/socket/` (index.ts, game.ts, room.ts, friends.ts)

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- console.log only - No structured logging framework
- Log locations: Error logging in auth routes (`/c/Users/addes/Git/Slutsnus/server/src/routes/auth.ts`)

## CI/CD & Deployment

**Hosting:**
- Not specified - Target platform not detected

**CI Pipeline:**
- None detected - No GitHub Actions, GitLab CI, or other CI/CD configuration

**Database Management:**
- Prisma CLI commands available:
  - `npm run db:generate` - Generate Prisma client
  - `npm run db:migrate` - Run database migrations
  - `npm run db:studio` - Open Prisma Studio for data management

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT signing
- `PORT` - Server port (default: 4000)
- `CLIENT_URL` - Client origin URL for CORS and Socket.io (default: http://localhost:3000)
- `NODE_ENV` - Environment mode (development/production, affects secure cookie flag)

**Secrets location:**
- `.env` file (not committed to git) - Contains all secrets
- Example variables in `.env` but file contents not shown for security

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Database Schema

**Models in use:**
- User - User accounts with authentication
- Room - Game rooms/lobbies
- RoomPlayer - Many-to-many relationship between users and rooms
- GameSession - Records of completed games
- GameSessionPlayer - Game results per player
- LeaderboardEntry - Ranked scores per game type
- Friendship - Friend relationships with pending/accepted status

**Key relationships:**
- Users host rooms and join as players
- Game sessions track when games are played
- Leaderboard entries record best scores per game type
- Friendships track mutual connections between users

---

*Integration audit: 2026-03-11*
