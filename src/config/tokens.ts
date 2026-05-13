export const PLATFORM_TOKENS = ['CLB', 'USDT'] as const;

export type PlatformToken = (typeof PLATFORM_TOKENS)[number];

export const PLATFORM_TOKEN_SET = new Set<string>(PLATFORM_TOKENS);

export function isPlatformToken(token: string): token is PlatformToken {
  return PLATFORM_TOKEN_SET.has(token);
}

export const MIN_WITHDRAW: Record<string, number> = {
  CLB: 0,
  BTC: 0,
  ETH: 0,
  BNB: 0,
  USDT: 0,
};

export const WITHDRAW_FEES: Record<string, number> = {
  CLB: 1,
  BTC: 0.00005,
  ETH: 0.0005,
  BNB: 0.001,
  USDT: 1,
};
