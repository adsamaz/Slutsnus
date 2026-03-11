-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPlayer" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomPlayer_pkey" PRIMARY KEY ("roomId","userId")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "resultJson" TEXT,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSessionPlayer" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "GameSessionPlayer_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "addresseeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Room_code_key" ON "Room"("code");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_gameType_score_idx" ON "LeaderboardEntry"("gameType", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "Friendship"("requesterId", "addresseeId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPlayer" ADD CONSTRAINT "RoomPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSessionPlayer" ADD CONSTRAINT "GameSessionPlayer_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSessionPlayer" ADD CONSTRAINT "GameSessionPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
