-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'ACTIVE', 'SETTLED', 'LIQUIDATED', 'CANCELLED', 'REPAID');

-- CreateEnum
CREATE TYPE "TokenTransferType" AS ENUM ('INTERNAL', 'EXTERNAL', 'LOAN_ISSUE', 'LOAN_REPAY', 'REWARD');

-- CreateEnum
CREATE TYPE "TokenTxStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED');

-- AlterEnum
ALTER TYPE "DepositStatus" ADD VALUE 'CONFIRMING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'LOAN';
ALTER TYPE "NotificationType" ADD VALUE 'TRANSFER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TransactionType" ADD VALUE 'LOAN';
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER';

-- DropForeignKey
ALTER TABLE "deposits" DROP CONSTRAINT "deposits_poolId_fkey";

-- AlterTable
ALTER TABLE "deposits" ADD COLUMN     "amountUsd" DECIMAL(65,30),
ADD COLUMN     "chain" TEXT NOT NULL DEFAULT 'BNB',
ADD COLUMN     "confirmations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fromAddress" TEXT,
ADD COLUMN     "loanId" TEXT,
ADD COLUMN     "toAddress" TEXT,
ALTER COLUMN "poolId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collateralChain" TEXT NOT NULL,
    "collateralAmount" DECIMAL(65,30) NOT NULL,
    "collateralPriceUsd" DECIMAL(65,30) NOT NULL,
    "collateralValueUsd" DECIMAL(65,30) NOT NULL,
    "loanAmount" DECIMAL(65,30) NOT NULL,
    "loanToken" TEXT NOT NULL DEFAULT 'CLB',
    "targetPriceUsd" DECIMAL(65,30) NOT NULL,
    "ltvPercent" DECIMAL(65,30) NOT NULL DEFAULT 50,
    "interestRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "liquidatedAt" TIMESTAMP(3),

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_balances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "locked" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "token_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_transfers" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT,
    "toAddress" TEXT,
    "token" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "type" "TokenTransferType" NOT NULL,
    "status" "TokenTxStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "toAddress" TEXT NOT NULL,
    "fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loans_userId_status_idx" ON "loans"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "token_balances_userId_token_key" ON "token_balances"("userId", "token");

-- CreateIndex
CREATE UNIQUE INDEX "token_transfers_txHash_key" ON "token_transfers"("txHash");

-- CreateIndex
CREATE INDEX "token_transfers_fromUserId_createdAt_idx" ON "token_transfers"("fromUserId", "createdAt");

-- CreateIndex
CREATE INDEX "token_transfers_toUserId_createdAt_idx" ON "token_transfers"("toUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawals_txHash_key" ON "withdrawals"("txHash");

-- CreateIndex
CREATE INDEX "withdrawals_userId_status_idx" ON "withdrawals"("userId", "status");

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_balances" ADD CONSTRAINT "token_balances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_transfers" ADD CONSTRAINT "token_transfers_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_transfers" ADD CONSTRAINT "token_transfers_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
