-- Sync DB with Prisma schema: LoanType, credit lines fields, CreditDraw, LoanStatus.MARGIN_CALL

-- CreateEnum
CREATE TYPE "LoanType" AS ENUM ('FIXED_LOAN', 'DYNAMIC_CREDIT');

-- AlterEnum
ALTER TYPE "LoanStatus" ADD VALUE 'MARGIN_CALL';

-- CreateEnum
CREATE TYPE "CreditDrawType" AS ENUM (
  'DRAW',
  'REPAY',
  'MARGIN_AUTO_REPAY',
  'CREDIT_INCREASE',
  'CREDIT_DECREASE'
);

-- AlterTable loans — new columns (existing rows become FIXED_LOAN)
ALTER TABLE "loans" ADD COLUMN "loanType" "LoanType" NOT NULL DEFAULT 'FIXED_LOAN';
ALTER TABLE "loans" ADD COLUMN "drawnAmount" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "loans" ADD COLUMN "availableCredit" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "loans" ADD COLUMN "marginCallPriceUsd" DECIMAL(65,30);
ALTER TABLE "loans" ADD COLUMN "lastCreditUpdateAt" TIMESTAMP(3);
ALTER TABLE "loans" ALTER COLUMN "targetPriceUsd" DROP NOT NULL;

-- CreateTable
CREATE TABLE "credit_draws" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "CreditDrawType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "collateralPriceUsd" DECIMAL(65,30) NOT NULL,
    "availableCreditAfter" DECIMAL(65,30) NOT NULL,
    "drawnAmountAfter" DECIMAL(65,30) NOT NULL,
    "txHash" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_draws_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loans_status_loanType_idx" ON "loans"("status", "loanType");
CREATE INDEX "credit_draws_loanId_idx" ON "credit_draws"("loanId");
CREATE INDEX "credit_draws_userId_idx" ON "credit_draws"("userId");

-- AddForeignKey
ALTER TABLE "credit_draws" ADD CONSTRAINT "credit_draws_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "loans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_draws" ADD CONSTRAINT "credit_draws_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
