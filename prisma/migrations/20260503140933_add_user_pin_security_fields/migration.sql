-- AlterTable
ALTER TABLE "users" ADD COLUMN     "biometricEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pinHash" TEXT,
ADD COLUMN     "pinSalt" TEXT;
