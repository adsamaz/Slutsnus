-- CreateTable
CREATE TABLE "VacationEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "icon" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationHiddenUser" (
    "viewerId" TEXT NOT NULL,
    "hiddenUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacationHiddenUser_pkey" PRIMARY KEY ("viewerId","hiddenUserId")
);

-- CreateIndex
CREATE INDEX "VacationEntry_startDate_endDate_idx" ON "VacationEntry"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "VacationEntry" ADD CONSTRAINT "VacationEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationHiddenUser" ADD CONSTRAINT "VacationHiddenUser_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationHiddenUser" ADD CONSTRAINT "VacationHiddenUser_hiddenUserId_fkey" FOREIGN KEY ("hiddenUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
