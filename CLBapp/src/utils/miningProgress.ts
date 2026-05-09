export type MiningPeriodUnit = 'MINUTE' | 'HOUR' | 'DAY';

export function periodDurationMs(unit: MiningPeriodUnit, length: number): number {
  const L = Math.max(1, Math.floor(length) || 1);
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

export function computeMiningProgressLive(
  tokensPerPeriod: number,
  unit: MiningPeriodUnit,
  periodLength: number,
  startedAtIso: string,
  nowMs: number = Date.now(),
): { accruedTokens: number; periodProgressPct: number } {
  const started = new Date(startedAtIso).getTime();
  const periodMs = periodDurationMs(unit, periodLength);
  if (periodMs <= 0) return { accruedTokens: 0, periodProgressPct: 0 };
  const elapsed = Math.max(0, nowMs - started);
  const fullPeriods = Math.floor(elapsed / periodMs);
  const accruedTokens = fullPeriods * tokensPerPeriod;
  const into = elapsed % periodMs;
  const periodProgressPct = Math.min(100, (into / periodMs) * 100);
  return { accruedTokens, periodProgressPct };
}
