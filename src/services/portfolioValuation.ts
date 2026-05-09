import prisma from '../config/db';
import { priceService } from './priceService';

/**
 * Centralised portfolio valuation.
 *
 * Returns the current USD value of every active pool position a user holds
 * — exactly the same number rendered as `portfolioValueUsd` on the
 * `/api/user/dashboard` endpoint. Keeping this in one place means the
 * "sync to wallet" mint flow can never drift from the dashboard total.
 */

const TIER_LEVERAGE: Record<number, number> = {
  100: 10, 200: 15, 300: 20, 400: 25, 500: 30,
  600: 35, 700: 40, 800: 45, 900: 50, 1000: 60,
};

function getLeverage(depositUsd: number): number {
  const tiers = Object.keys(TIER_LEVERAGE).map(Number).sort((a, b) => b - a);
  for (const tier of tiers) {
    if (depositUsd >= tier) return TIER_LEVERAGE[tier];
  }
  return 1;
}

function getEstimatedEntryPrice(currentPrice: number, change24hPct: number): number {
  if (currentPrice <= 0) return 0;
  const factor = 1 + (change24hPct / 100);
  if (factor <= 0) return currentPrice;
  return currentPrice / factor;
}

export async function computePortfolioValueUsd(userId: string): Promise<number> {
  const [memberships, prices] = await Promise.all([
    prisma.poolMember.findMany({
      where: { userId },
      include: { pool: true },
    }),
    priceService.getPrices(),
  ]);

  const bnbPrice = prices.BNB?.usd ?? 0;
  const activePools = memberships.filter((m) => m.pool.status === 'ACTIVE');

  let portfolioValueUsd = 0;
  for (const m of activePools) {
    const shareAmount = Number(m.share);
    const shareUsd = shareAmount * bnbPrice;
    const leverage = getLeverage(shareUsd);
    const isBTC = m.pool.tokenSymbol === 'BTC' || m.pool.tokenSymbol === 'BTCB';
    const asset = isBTC ? 'BTC' : 'ETH';
    const assetPrice = prices[asset]?.usd ?? 0;
    const change24h = prices[asset]?.usd_24h_change ?? 0;
    const entryPrice = getEstimatedEntryPrice(assetPrice, change24h);

    if (assetPrice > 0 && entryPrice > 0) {
      const loanUsd = shareUsd * leverage;
      const cryptoAmount = loanUsd / entryPrice;
      portfolioValueUsd += cryptoAmount * assetPrice;
    }
  }

  return parseFloat(portfolioValueUsd.toFixed(2));
}
