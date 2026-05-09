import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPublicClient, http, formatUnits, erc20Abi, type Address } from 'viem';
import { bsc } from 'viem/chains';
import { tokensAPI } from '../services/api';
import { useLivePrices } from './useLivePrices';

/**
 * On-chain wallet portfolio reader.
 *
 * Reads the actual BSC mainnet balances for the connected wallet — exactly the
 * same set Trust Wallet / MetaMask would show — and values each asset in USD
 * using:
 *   - Binance WS live ticker for BNB (via `useLivePrices`)
 *   - Hard $1 peg for known stablecoins (USDT, BUSD)
 *   - Backend `/api/tokens/prices` for CLB / CLBg / CLBs
 *
 * No private keys are ever touched — this is a pure read.
 */

export type OnChainAsset = {
  symbol: string;
  name: string;
  /** Raw on-chain balance, decimals already applied. */
  balance: number;
  /** USD value of that balance using the latest known price. */
  valueUsd: number;
  /** Latest USD price per token. 0 if unknown. */
  priceUsd: number;
  /** 24h % change (when known, e.g. from Binance WS). */
  change24h?: number;
  /** True for the chain's native gas token (BNB). */
  isNative: boolean;
  /** BEP-20 contract address (omitted for native BNB). */
  contractAddress?: Address;
  /** Number of token decimals. */
  decimals: number;
  /** A short tier / category label used for UI grouping. */
  tier: 'Native' | 'Stablecoin' | 'CLB';
};

type TokenConfig = {
  symbol: string;
  name: string;
  address?: Address;
  decimals: number;
  isNative: boolean;
  tier: OnChainAsset['tier'];
};

// Well-known BEP-20 stablecoin contracts on BSC mainnet (chainId 56).
// Addresses are case-insensitive but viem expects checksum-formatted strings.
const STATIC_TOKENS: TokenConfig[] = [
  {
    symbol: 'BNB',
    name: 'BNB',
    decimals: 18,
    isNative: true,
    tier: 'Native',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x55d398326f99059fF775485246999027B3197955',
    decimals: 18,
    isNative: false,
    tier: 'Stablecoin',
  },
  {
    symbol: 'BUSD',
    name: 'Binance USD',
    address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    decimals: 18,
    isNative: false,
    tier: 'Stablecoin',
  },
];

const STABLECOIN_SYMBOLS = new Set(['USDT', 'BUSD', 'USDC', 'DAI']);

// Module-level singleton so we don't recreate the client on every render.
const publicClient = createPublicClient({
  chain: bsc,
  transport: http('https://bsc-dataseed1.binance.org'),
});

function isValidAddress(addr?: string | null): addr is Address {
  return !!addr && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

/**
 * Fetch contract addresses for the CLB token family from the backend.
 * Cached at module scope because they never change for the lifetime of the app.
 */
let clbTokensCache: TokenConfig[] | null = null;
async function fetchClbTokens(): Promise<TokenConfig[]> {
  if (clbTokensCache) return clbTokensCache;
  try {
    const res = await tokensAPI.contracts();
    const contracts = res.data?.contracts ?? [];
    clbTokensCache = contracts
      .filter((c: any) => isValidAddress(c.address))
      .map((c: any): TokenConfig => ({
        symbol: c.token,
        name: c.name,
        address: c.address as Address,
        decimals: c.decimals ?? 18,
        isNative: false,
        tier: 'CLB',
      }));
    return clbTokensCache!;
  } catch {
    return [];
  }
}

/** Fetch CLB-family USD prices from the backend. */
let clbPriceCache: { at: number; prices: Record<string, { priceUsd: number; change24h?: number }> } = {
  at: 0,
  prices: {},
};
const CLB_PRICE_TTL_MS = 60_000;

async function fetchClbPrices(): Promise<Record<string, { priceUsd: number; change24h?: number }>> {
  if (Date.now() - clbPriceCache.at < CLB_PRICE_TTL_MS && Object.keys(clbPriceCache.prices).length > 0) {
    return clbPriceCache.prices;
  }
  try {
    const res = await tokensAPI.prices();
    const list: Array<{ token: string; priceUsd: number; change24h?: number }> = res.data?.prices ?? [];
    const map: Record<string, { priceUsd: number; change24h?: number }> = {};
    list.forEach((p) => {
      map[p.token] = { priceUsd: Number(p.priceUsd) || 0, change24h: p.change24h };
    });
    clbPriceCache = { at: Date.now(), prices: map };
    return map;
  } catch {
    return clbPriceCache.prices;
  }
}

export type UseOnChainWalletResult = {
  assets: OnChainAsset[];
  totalValueUsd: number;
  isLoading: boolean;
  isRefetching: boolean;
  error: string | null;
  /** Force a fresh on-chain read (e.g. on pull-to-refresh). */
  refetch: () => Promise<void>;
};

export function useOnChainWallet(walletAddress?: string | null): UseOnChainWalletResult {
  const [tokens, setTokens] = useState<TokenConfig[]>(STATIC_TOKENS);
  const [rawBalances, setRawBalances] = useState<Record<string, number>>({});
  const [clbPrices, setClbPrices] = useState<Record<string, { priceUsd: number; change24h?: number }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  // Live BNB price from Binance WS (already used elsewhere in the app).
  const livePrices = useLivePrices(['BNB']);

  // Bootstrap: pull CLB token list from the backend once and merge with statics.
  useEffect(() => {
    let alive = true;
    fetchClbTokens().then((clb) => {
      if (!alive) return;
      setTokens([...STATIC_TOKENS, ...clb]);
    });
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(
    async (mode: 'initial' | 'refetch') => {
      if (!isValidAddress(walletAddress)) {
        setRawBalances({});
        setError(null);
        return;
      }
      if (inFlight.current) return;
      inFlight.current = true;
      if (mode === 'initial') setIsLoading(true);
      else setIsRefetching(true);
      setError(null);

      const account = walletAddress as Address;
      try {
        const [nativeBalance, ...erc20Balances] = await Promise.all([
          publicClient.getBalance({ address: account }),
          ...tokens
            .filter((t) => !t.isNative && t.address)
            .map((t) =>
              publicClient
                .readContract({
                  address: t.address!,
                  abi: erc20Abi,
                  functionName: 'balanceOf',
                  args: [account],
                })
                .catch(() => 0n) as Promise<bigint>,
            ),
        ]);

        const next: Record<string, number> = {};
        const native = tokens.find((t) => t.isNative);
        if (native) {
          next[native.symbol] = Number(formatUnits(nativeBalance, native.decimals));
        }
        const erc20Tokens = tokens.filter((t) => !t.isNative && t.address);
        erc20Tokens.forEach((t, i) => {
          const raw = erc20Balances[i] ?? 0n;
          next[t.symbol] = Number(formatUnits(raw, t.decimals));
        });
        setRawBalances(next);

        // Refresh CLB prices alongside balances (cheap; cached for 60s).
        const prices = await fetchClbPrices();
        setClbPrices(prices);
      } catch (err: any) {
        setError(err?.shortMessage || err?.message || 'Failed to read on-chain balances');
      } finally {
        inFlight.current = false;
        if (mode === 'initial') setIsLoading(false);
        else setIsRefetching(false);
      }
    },
    [tokens, walletAddress],
  );

  useEffect(() => {
    load('initial');
  }, [load]);

  const refetch = useCallback(async () => {
    await load('refetch');
  }, [load]);

  const assets = useMemo<OnChainAsset[]>(() => {
    return tokens.map((t) => {
      const balance = rawBalances[t.symbol] ?? 0;

      let priceUsd = 0;
      let change24h: number | undefined;

      if (t.isNative && t.symbol === 'BNB') {
        priceUsd = livePrices.BNB?.price ?? 0;
        change24h = livePrices.BNB?.change24h;
      } else if (STABLECOIN_SYMBOLS.has(t.symbol)) {
        priceUsd = 1;
      } else {
        const p = clbPrices[t.symbol];
        if (p) {
          priceUsd = p.priceUsd;
          change24h = p.change24h;
        }
      }

      return {
        symbol: t.symbol,
        name: t.name,
        balance,
        priceUsd,
        valueUsd: balance * priceUsd,
        change24h,
        isNative: t.isNative,
        contractAddress: t.address,
        decimals: t.decimals,
        tier: t.tier,
      };
    });
  }, [tokens, rawBalances, livePrices, clbPrices]);

  const totalValueUsd = useMemo(
    () => assets.reduce((sum, a) => sum + a.valueUsd, 0),
    [assets],
  );

  return { assets, totalValueUsd, isLoading, isRefetching, error, refetch };
}
