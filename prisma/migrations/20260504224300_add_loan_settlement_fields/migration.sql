-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "liquidationPriceUsd" DECIMAL(65,30),
ADD COLUMN     "platformFeeUsd" DECIMAL(65,30),
ADD COLUMN     "profitUsd" DECIMAL(65,30),
ADD COLUMN     "settlementPriceUsd" DECIMAL(65,30);
