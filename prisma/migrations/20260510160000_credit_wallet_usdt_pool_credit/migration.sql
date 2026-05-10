-- In-app USDT credit ledger, treasury settings, pool app-credit flags

ALTER TABLE "platform_settings" ADD COLUMN "depositTreasuryAddress" TEXT;
ALTER TABLE "platform_settings" ADD COLUMN "usdtBep20Address" TEXT;

ALTER TABLE "users" ADD COLUMN "depositCreditUsd" DECIMAL(36,18) NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "claimedPoolCreditUsd" DECIMAL(36,18) NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "swapHoldingsUsd" DECIMAL(36,18) NOT NULL DEFAULT 0;

ALTER TABLE "pools" ADD COLUMN "supportsAppCredit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "pools" ADD COLUMN "creditMinUsd" DECIMAL(36,18);
ALTER TABLE "pools" ADD COLUMN "creditCreditedUsd" DECIMAL(36,18);
