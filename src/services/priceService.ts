import { env } from '../config/env';

interface PriceData {
  [coin: string]: {
    usd: number;
    usd_24h_change?: number;
    usd_market_cap?: number;
  };
}

// In-memory cache
let priceCache: PriceData = {};
let lastFetch = 0;
const CACHE_TTL = 60_000; // 1 minute

export const priceService = {
  // Fetch popular crypto prices from CoinGecko
  async getPrices(): Promise<PriceData> {
    const now = Date.now();
    if (now - lastFetch < CACHE_TTL && Object.keys(priceCache).length > 0) {
      return priceCache;
    }

    try {
      const coinIds = 'bitcoin,ethereum,binancecoin,solana,cardano,dogecoin,polkadot,matic-network,avalanche-2,chainlink,uniswap,ripple,litecoin';
      const url = `${env.COINGECKO_API_URL}/simple/price?ids=${coinIds}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json() as Record<string, { usd: number; usd_24h_change?: number; usd_market_cap?: number }>;

      priceCache = {
        BTC: { usd: data.bitcoin?.usd ?? 0, usd_24h_change: data.bitcoin?.usd_24h_change },
        ETH: { usd: data.ethereum?.usd ?? 0, usd_24h_change: data.ethereum?.usd_24h_change },
        BNB: { usd: data.binancecoin?.usd ?? 0, usd_24h_change: data.binancecoin?.usd_24h_change },
        SOL: { usd: data.solana?.usd ?? 0, usd_24h_change: data.solana?.usd_24h_change },
        ADA: { usd: data.cardano?.usd ?? 0, usd_24h_change: data.cardano?.usd_24h_change },
        DOGE: { usd: data.dogecoin?.usd ?? 0, usd_24h_change: data.dogecoin?.usd_24h_change },
        DOT: { usd: data.polkadot?.usd ?? 0, usd_24h_change: data.polkadot?.usd_24h_change },
        MATIC: { usd: data['matic-network']?.usd ?? 0, usd_24h_change: data['matic-network']?.usd_24h_change },
        AVAX: { usd: data['avalanche-2']?.usd ?? 0, usd_24h_change: data['avalanche-2']?.usd_24h_change },
        LINK: { usd: data.chainlink?.usd ?? 0, usd_24h_change: data.chainlink?.usd_24h_change },
        UNI: { usd: data.uniswap?.usd ?? 0, usd_24h_change: data.uniswap?.usd_24h_change },
        XRP: { usd: data.ripple?.usd ?? 0, usd_24h_change: data.ripple?.usd_24h_change },
        LTC: { usd: data.litecoin?.usd ?? 0, usd_24h_change: data.litecoin?.usd_24h_change },
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
        SOL: { usd: 0 },
        ADA: { usd: 0 },
        DOGE: { usd: 0 },
        DOT: { usd: 0 },
        MATIC: { usd: 0 },
        AVAX: { usd: 0 },
        LINK: { usd: 0 },
        UNI: { usd: 0 },
        XRP: { usd: 0 },
        LTC: { usd: 0 },
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
