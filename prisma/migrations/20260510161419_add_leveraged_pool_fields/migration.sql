-- AlterTable
ALTER TABLE "pools" ADD COLUMN     "entryPrice" DECIMAL(36,2),
ADD COLUMN     "heldAsset" TEXT DEFAULT 'BTC',
ADD COLUMN     "leverageRatio" INTEGER DEFAULT 10,
ADD COLUMN     "phase1Target" DECIMAL(36,2),
ADD COLUMN     "phase2Target" DECIMAL(36,2),
ADD COLUMN     "profitSplit" TEXT DEFAULT '85/15';
