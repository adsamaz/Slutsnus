-- CreateTable
CREATE TABLE "FredagPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FredagPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FredagReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FredagReaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FredagReaction_postId_userId_emoji_key" ON "FredagReaction"("postId", "userId", "emoji");

-- AddForeignKey
ALTER TABLE "FredagPost" ADD CONSTRAINT "FredagPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FredagReaction" ADD CONSTRAINT "FredagReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "FredagPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FredagReaction" ADD CONSTRAINT "FredagReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
