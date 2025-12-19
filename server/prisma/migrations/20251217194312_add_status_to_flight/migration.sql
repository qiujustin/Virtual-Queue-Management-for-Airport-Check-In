/*
  Warnings:

  - You are about to drop the column `estimatedServiceTime` on the `QueueEntry` table. All the data in the column will be lost.
  - Added the required column `password` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Flight" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "QueueEntry" DROP COLUMN "estimatedServiceTime",
ADD COLUMN     "serviceCompletedAt" TIMESTAMP(3),
ADD COLUMN     "serviceStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password" TEXT NOT NULL;
