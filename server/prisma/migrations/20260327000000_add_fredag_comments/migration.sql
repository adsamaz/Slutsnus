CREATE TABLE "FredagComment" (
    "id"        TEXT NOT NULL,
    "postId"    TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FredagComment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FredagComment" ADD CONSTRAINT "FredagComment_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "FredagPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FredagComment" ADD CONSTRAINT "FredagComment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
