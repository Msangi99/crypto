import { env } from '../config/env';

interface PriceData {
  [coin: string]: {
    usd: number;
    usd_24h_change?: number;
  };
}

// In-memory cache
let priceCache: PriceData = {};
let lastFetch = 0;
const CACHE_TTL = 60_000; // 1 minute

export const priceService = {
  // Fetch BTC, ETH, BNB prices from CoinGecko
  async getPrices(): Promise<PriceData> {
    const now = Date.now();
    if (now - lastFetch < CACHE_TTL && Object.keys(priceCache).length > 0) {
      return priceCache;
    }

    try {
      const url = `${env.COINGECKO_API_URL}/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=usd&include_24hr_change=true`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json() as Record<string, { usd: number; usd_24h_change?: number }>;

      priceCache = {
        BTC: { usd: data.bitcoin.usd, usd_24h_change: data.bitcoin.usd_24h_change },
        ETH: { usd: data.ethereum.usd, usd_24h_change: data.ethereum.usd_24h_change },
        BNB: { usd: data.binancecoin.usd, usd_24h_change: data.binancecoin.usd_24h_change },
      };
      lastFetch = now;

      return priceCache;
    } catch (error) {
      console.error('❌ Price fetch error:', error);
      // Return cached data if available, otherwise empty
      if (Object.keys(priceCache).length > 0) return priceCache;
      return {
        BTC: { usd: 0 },
        ETH: { usd: 0 },
        BNB: { usd: 0 },
      };
    }
  },

  // Get single coin price
  async getCoinPrice(symbol: string): Promise<{ usd: number; usd_24h_change?: number }> {
    const prices = await this.getPrices();
    const upper = symbol.toUpperCase();
    return prices[upper] || { usd: 0 };
  },
};
