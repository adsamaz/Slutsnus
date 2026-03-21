-- AlterTable
ALTER TABLE "LeaderboardEntry" ADD COLUMN     "timeTakenMs" INTEGER;

-- CreateTable
CREATE TABLE "WinLossRecord" (
    "userId" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WinLossRecord_pkey" PRIMARY KEY ("userId","gameType")
);

-- CreateIndex
CREATE INDEX "LeaderboardEntry_gameType_timeTakenMs_idx" ON "LeaderboardEntry"("gameType", "timeTakenMs" ASC);

-- AddForeignKey
ALTER TABLE "WinLossRecord" ADD CONSTRAINT "WinLossRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
