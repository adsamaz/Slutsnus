-- CreateTable
CREATE TABLE "MushroomEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "areaId" TEXT,
    "speciesId" TEXT,
    "customLabel" TEXT,
    "customColor" TEXT,
    "weightGrams" INTEGER NOT NULL,
    "foundDate" DATE NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MushroomEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MushroomArea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "polygonJson" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MushroomArea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MushroomEntry_userId_idx" ON "MushroomEntry"("userId");

-- CreateIndex
CREATE INDEX "MushroomEntry_areaId_foundDate_idx" ON "MushroomEntry"("areaId", "foundDate");

-- CreateIndex
CREATE INDEX "MushroomEntry_foundDate_idx" ON "MushroomEntry"("foundDate");

-- CreateIndex
CREATE INDEX "MushroomEntry_visibility_idx" ON "MushroomEntry"("visibility");

-- CreateIndex
CREATE INDEX "MushroomArea_userId_idx" ON "MushroomArea"("userId");

-- CreateIndex
CREATE INDEX "MushroomArea_visibility_idx" ON "MushroomArea"("visibility");

-- AddForeignKey
ALTER TABLE "MushroomEntry" ADD CONSTRAINT "MushroomEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MushroomEntry" ADD CONSTRAINT "MushroomEntry_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "MushroomArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MushroomArea" ADD CONSTRAINT "MushroomArea_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
