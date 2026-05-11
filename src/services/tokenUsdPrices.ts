import { env } from '../config/env';
import { tokenService } from './tokenService';

/** Used when CoinGecko has no listing, RPC fails, or addresses are unset. */
const FALLBACK_USD: Record<string, number> = {
  CLB: 1.0,
};

const TRACKED_TOKENS = ['CLB'] as const;

export type TokenUsdQuote = {
  priceUsd: number;
  /** null when unknown (fallback price or missing from API). */
  change24h: number | null;
};

let cache: { at: number; data: Record<string, TokenUsdQuote> } | null = null;
const TTL_MS = 60_000;

/**
 * Spot USD (+ optional 24h %) from CoinGecko for BEP-20 contracts on BSC.
 * Token must be indexed by CoinGecko; otherwise the address is omitted from the response and we fall back.
 */
async function fetchCoinGeckoBsc(): Promise<Partial<Record<string, TokenUsdQuote>>> {
  const addresses = TRACKED_TOKENS.map((t) => tokenService.getAddress(t).trim()).filter(Boolean);
  if (addresses.length === 0) return {};

  const uniqueLower = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const url = new URL(`${env.COINGECKO_API_URL}/simple/token_price/binance-smart-chain`);
  url.searchParams.set('contract_addresses', uniqueLower.join(','));
  url.searchParams.set('vs_currencies', 'usd');
  url.searchParams.set('include_24hr_change', 'true');

  const headers: Record<string, string> = {};
  if (env.COINGECKO_API_KEY) {
    headers['x-cg-pro-api-key'] = env.COINGECKO_API_KEY;
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    console.warn('[tokenUsdPrices] CoinGecko HTTP', res.status);
    return {};
  }

  const json = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;

  const addrToSymbol: Record<string, string> = {};
  for (const t of TRACKED_TOKENS) {
    const a = tokenService.getAddress(t).trim().toLowerCase();
    if (a) addrToSymbol[a] = t;
  }

  const out: Partial<Record<string, TokenUsdQuote>> = {};
  for (const [addr, row] of Object.entries(json)) {
    const sym = addrToSymbol[addr.toLowerCase()];
    if (!sym || row.usd == null || !Number.isFinite(row.usd)) continue;
    const ch = row.usd_24h_change;
    out[sym] = {
      priceUsd: row.usd,
      change24h: ch != null && Number.isFinite(ch) ? ch : null,
    };
  }
  return out;
}

export async function getTokenUsdQuotes(): Promise<Record<string, TokenUsdQuote>> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return cache.data;
  }

  let remote: Partial<Record<string, TokenUsdQuote>> = {};
  try {
    remote = await fetchCoinGeckoBsc();
  } catch (e) {
    console.warn('[tokenUsdPrices] CoinGecko fetch failed:', e);
  }

  const data: Record<string, TokenUsdQuote> = {};
  for (const t of TRACKED_TOKENS) {
    const r = remote[t];
    if (r) {
      data[t] = r;
    } else {
      data[t] = {
        priceUsd: FALLBACK_USD[t] ?? 0,
        change24h: null,
      };
    }
  }

  cache = { at: Date.now(), data };
  return data;
}
