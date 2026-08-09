-- AlterTable
ALTER TABLE "MushroomArea" ADD COLUMN     "visibleToUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
