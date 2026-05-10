-- In-app pool claim: default ON for new rows and backfill existing tiers
ALTER TABLE "pools" ALTER COLUMN "supportsAppCredit" SET DEFAULT true;

UPDATE "pools"
SET
  "supportsAppCredit" = true,
  "creditMinUsd" = CASE
    WHEN "creditMinUsd" IS NULL OR "creditMinUsd" = 0 THEN "minDeposit"
    ELSE "creditMinUsd"
  END,
  "creditCreditedUsd" = CASE
    WHEN "creditCreditedUsd" IS NULL OR "creditCreditedUsd" = 0 THEN "minDeposit" * 10
    ELSE "creditCreditedUsd"
  END
WHERE "minDeposit" > 0
  AND (
    "supportsAppCredit" = false
    OR "creditCreditedUsd" IS NULL
    OR "creditCreditedUsd" = 0
  );
