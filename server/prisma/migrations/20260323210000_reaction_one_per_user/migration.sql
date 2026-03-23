-- Drop old unique constraint (postId, userId, emoji)
DROP INDEX IF EXISTS "FredagReaction_postId_userId_emoji_key";

-- Remove duplicate reactions per user per post, keeping the most recent
DELETE FROM "FredagReaction" r1
USING "FredagReaction" r2
WHERE r1."postId" = r2."postId"
  AND r1."userId" = r2."userId"
  AND r1."createdAt" < r2."createdAt";

-- Add new unique constraint (postId, userId)
CREATE UNIQUE INDEX "FredagReaction_postId_userId_key" ON "FredagReaction"("postId", "userId");
