/**
 * Aligns with backend claimFeeUsd: use creditMinUsd when > 0, else minDeposit.
 * Avoids JS bug: (0 ?? minDeposit) keeps 0 and ignores minDeposit.
 */
export function usdNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : 0;
}

export function supportsAppCreditPool(pool: { supportsAppCredit?: unknown }): boolean {
  const v = pool?.supportsAppCredit;
  if (v === true || v === 1) return true;
  if (v === false || v === 0 || v == null) return false;
  if (typeof v === 'string') {
    const t = v.toLowerCase().trim();
    return t === 'true' || t === '1';
  }
  return false;
}

export function claimFeeFromPool(pool: {
  creditMinUsd?: unknown;
  minDeposit?: unknown;
}): number {
  const fromCredit = usdNum(pool.creditMinUsd);
  if (fromCredit > 0) return fromCredit;
  return usdNum(pool.minDeposit);
}

export function loanCreditFromPool(pool: { creditCreditedUsd?: unknown }): number | null {
  const n = usdNum(pool.creditCreditedUsd);
  return n > 0 ? n : null;
}
