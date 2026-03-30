/*
  Warnings:

  - You are about to drop the column `description` on the `Progress` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Progress` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,missionId]` on the table `Progress` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `authorId` to the `Mission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contentJson` to the `Mission` table without a default value. This is not possible if the table is not empty.
  - Added the required column `missionId` to the `Progress` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Progress` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('not_started', 'in_progress', 'complete');

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "authorId" TEXT NOT NULL,
ADD COLUMN     "contentJson" JSONB NOT NULL,
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Progress" DROP COLUMN "description",
DROP COLUMN "title",
ADD COLUMN     "missionId" TEXT NOT NULL,
ADD COLUMN     "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "status" "ProgressStatus" NOT NULL DEFAULT 'not_started',
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Progress_userId_missionId_key" ON "Progress"("userId", "missionId");

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
