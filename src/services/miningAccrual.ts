import type { MiningPackagePeriodUnit } from '@prisma/client';

export function periodDurationMs(unit: MiningPackagePeriodUnit, length: number): number {
  const L = Math.max(1, length | 0);
  switch (unit) {
    case 'MINUTE':
      return L * 60_000;
    case 'HOUR':
      return L * 3_600_000;
    case 'DAY':
      return L * 86_400_000;
    default:
      return L * 86_400_000;
  }
}

/**
 * Linear accrual: tokens grow steadily across each period (not only when a full period completes).
 * Rate = tokensPerPeriod per (periodLength × unit). Example: 10 CLB, length 1, MINUTE → 10 CLB/min smooth.
 */
export function computeMiningProgress(
  tokensPerPeriod: number,
  unit: MiningPackagePeriodUnit,
  periodLength: number,
  startedAt: Date,
  now: Date = new Date(),
): { accruedTokens: number; periodProgressPct: number } {
  const periodMs = periodDurationMs(unit, periodLength);
  if (periodMs <= 0 || !Number.isFinite(tokensPerPeriod) || tokensPerPeriod <= 0) {
    return { accruedTokens: 0, periodProgressPct: 0 };
  }
  const elapsed = Math.max(0, now.getTime() - startedAt.getTime());
  const accruedTokens = (elapsed / periodMs) * tokensPerPeriod;
  const into = elapsed % periodMs;
  const periodProgressPct = Math.min(100, (into / periodMs) * 100);
  return { accruedTokens, periodProgressPct };
}
