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

export function computeMiningProgress(
  tokensPerPeriod: number,
  unit: MiningPackagePeriodUnit,
  periodLength: number,
  startedAt: Date,
  now: Date = new Date(),
): { accruedTokens: number; periodProgressPct: number } {
  const periodMs = periodDurationMs(unit, periodLength);
  if (periodMs <= 0) {
    return { accruedTokens: 0, periodProgressPct: 0 };
  }
  const elapsed = Math.max(0, now.getTime() - startedAt.getTime());
  const fullPeriods = Math.floor(elapsed / periodMs);
  const accruedTokens = fullPeriods * tokensPerPeriod;
  const into = elapsed % periodMs;
  const periodProgressPct = Math.min(100, (into / periodMs) * 100);
  return { accruedTokens, periodProgressPct };
}
