import { Prisma } from '@prisma/client';

/**
 * In-app credit claim flow (admin-configurable per pool, unlimited pools — not a fixed count):
 * - User builds depositCreditUsd via USDT treasury receive.
 * - They pay claim fee `creditMinUsd` from that balance to open the package.
 * - Their loan / claimed line (`claimedPoolCreditUsd`) increases by `creditCreditedUsd` (e.g. fee $100 → loan $1000).
 */
export type PoolCreditInput = {
  supportsAppCredit?: boolean;
  creditMinUsd?: number | null;
  creditCreditedUsd?: number | null;
  minDeposit?: number | null;
};

function n(v: number | null | undefined): number {
  if (v == null || typeof v !== 'number' || !Number.isFinite(v)) return NaN;
  return v;
}

export function validatePoolCreditPackage(body: PoolCreditInput): { ok: true } | { ok: false; error: string } {
  if (!body.supportsAppCredit) return { ok: true };

  const feeFromCredit = n(body.creditMinUsd);
  const feeFromMin = n(body.minDeposit);
  const fee = Number.isFinite(feeFromCredit) && feeFromCredit > 0 ? feeFromCredit : feeFromMin > 0 ? feeFromMin : NaN;
  const loan = n(body.creditCreditedUsd);

  if (!Number.isFinite(fee) || fee <= 0) {
    return {
      ok: false,
      error:
        'When supportsAppCredit is true, set creditMinUsd (claim fee in USD from deposit balance) or minDeposit > 0 as the fee.',
    };
  }
  if (!Number.isFinite(loan) || loan <= 0) {
    return {
      ok: false,
      error:
        'When supportsAppCredit is true, creditCreditedUsd is required — USD credited to loan balance after claim (e.g. fee 100 → 1000).',
    };
  }
  return { ok: true };
}

/** Validate after applying a PATCH to an existing pool row. */
export function validatePoolCreditAfterPatch(
  existing: {
    supportsAppCredit: boolean;
    creditMinUsd: Prisma.Decimal | null;
    creditCreditedUsd: Prisma.Decimal | null;
    minDeposit: Prisma.Decimal;
  },
  patch: PoolCreditInput & { minDeposit?: number }
): { ok: true } | { ok: false; error: string } {
  const supports =
    patch.supportsAppCredit !== undefined ? Boolean(patch.supportsAppCredit) : existing.supportsAppCredit;
  if (!supports) return { ok: true };

  const creditMinUsd =
    patch.creditMinUsd !== undefined
      ? patch.creditMinUsd
      : existing.creditMinUsd != null
        ? Number(existing.creditMinUsd)
        : null;
  const minDeposit =
    patch.minDeposit !== undefined ? patch.minDeposit : Number(existing.minDeposit);
  const creditCreditedUsd =
    patch.creditCreditedUsd !== undefined
      ? patch.creditCreditedUsd
      : existing.creditCreditedUsd != null
        ? Number(existing.creditCreditedUsd)
        : null;

  return validatePoolCreditPackage({
    supportsAppCredit: true,
    creditMinUsd: creditMinUsd,
    creditCreditedUsd: creditCreditedUsd,
    minDeposit: minDeposit,
  });
}

export function claimFeeUsd(pool: {
  creditMinUsd: Prisma.Decimal | null;
  minDeposit: Prisma.Decimal;
}): Prisma.Decimal {
  return pool.creditMinUsd != null
    ? new Prisma.Decimal(pool.creditMinUsd.toString())
    : new Prisma.Decimal(pool.minDeposit.toString());
}

export function loanCreditUsdOrThrow(pool: {
  supportsAppCredit: boolean;
  creditCreditedUsd: Prisma.Decimal | null;
}): Prisma.Decimal {
  if (!pool.supportsAppCredit) {
    throw new Error('POOL_NO_APP_CREDIT');
  }
  if (pool.creditCreditedUsd == null) {
    throw new Error('POOL_MISSING_LOAN_CREDIT');
  }
  const v = new Prisma.Decimal(pool.creditCreditedUsd.toString());
  if (v.lte(0)) throw new Error('POOL_INVALID_LOAN_CREDIT');
  return v;
}
