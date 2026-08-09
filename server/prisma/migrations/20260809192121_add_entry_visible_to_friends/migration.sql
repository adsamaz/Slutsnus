-- AlterTable
ALTER TABLE "MushroomEntry" ADD COLUMN     "visibleToUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
