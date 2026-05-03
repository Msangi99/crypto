/*
  Warnings:

  - A unique constraint covering the columns `[secretKey]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "secretKey" TEXT,
ADD COLUMN     "secretKeyIv" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_secretKey_key" ON "users"("secretKey");
