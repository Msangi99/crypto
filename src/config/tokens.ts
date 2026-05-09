export const PLATFORM_TOKENS = ['CLB', 'CLBg', 'CLBs', 'GLM'] as const;

export type PlatformToken = (typeof PLATFORM_TOKENS)[number];

export const PLATFORM_TOKEN_SET = new Set<string>(PLATFORM_TOKENS);

export function isPlatformToken(token: string): token is PlatformToken {
  return PLATFORM_TOKEN_SET.has(token);
}

export const MIN_WITHDRAW: Record<string, number> = {
  CLB: 10,
  CLBg: 1,
  CLBs: 5,
  GLM: 1,
  BTC: 0.0001,
  ETH: 0.001,
  BNB: 0.01,
};

export const WITHDRAW_FEES: Record<string, number> = {
  CLB: 1,
  CLBg: 0.1,
  CLBs: 0.5,
  GLM: 0.1,
  BTC: 0.00005,
  ETH: 0.0005,
  BNB: 0.001,
};
