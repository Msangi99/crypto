-- CreateEnum
CREATE TYPE "MiningPackagePeriodUnit" AS ENUM ('MINUTE', 'HOUR', 'DAY');

-- CreateTable
CREATE TABLE "clb_mining_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tokenSymbol" TEXT NOT NULL DEFAULT 'CLB',
    "tokensPerPeriod" DECIMAL(36,18) NOT NULL,
    "periodLength" INTEGER NOT NULL DEFAULT 1,
    "periodUnit" "MiningPackagePeriodUnit" NOT NULL,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "priceUsd" DECIMAL(18,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clb_mining_packages_pkey" PRIMARY KEY ("id")
);
