import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { priceService } from '../services/priceService';
import { REFERRAL_RATES } from '../services/referralRewardService';

// ─── CLB Tier → Leverage Map ─────────────────────────────
// From PDF: $100→10x, $200→15x, $300→20x … $1000→60x
const TIER_LEVERAGE: Record<number, number> = {
  100: 10, 200: 15, 300: 20, 400: 25, 500: 30,
  600: 35, 700: 40, 800: 45, 900: 50, 1000: 60,
};

// Liquidation targets from PDF
const LIQUIDATION_TARGETS = {
  BTC: { phase1: 150_000, phase2: 200_000 },
  ETH: { phase1: 15_000, phase2: 20_000 },
};

const REFERRAL_BASE_URL = 'https://cryptoloanboost.com/join?ref=';
function buildReferralLink(code: string): string {
  return `${REFERRAL_BASE_URL}${code}`;
}

// Profit split
const USER_PROFIT_SHARE = 0.85;

// Helper: get leverage for a deposit amount
function getLeverage(depositUsd: number): number {
  // Find closest tier ≤ depositUsd
  const tiers = Object.keys(TIER_LEVERAGE).map(Number).sort((a, b) => b - a);
  for (const tier of tiers) {
    if (depositUsd >= tier) return TIER_LEVERAGE[tier];
  }
  return 1; // fallback: no leverage
}

// Helper: calculate liquidation profit with proper sign handling
function calcLiquidationProfit(cryptoAmount: number, targetPrice: number, loanUsd: number, pct: number) {
  const grossValue = cryptoAmount * pct * targetPrice;
  const costBasis = loanUsd * pct;
  const grossProfit = grossValue - costBasis;
  // If grossProfit is negative, user loss = grossProfit (no platform fee on loss)
  const platformFee = grossProfit > 0 ? grossProfit * 0.15 : 0;
  const userProfit = grossProfit > 0 ? grossProfit * USER_PROFIT_SHARE : grossProfit;
  return { grossValue, costBasis, grossProfit, platformFee, userProfit };
}

// Estimate an entry price from 24h move so position value can
// react to current market price instead of mathematically canceling out.
function getEstimatedEntryPrice(currentPrice: number, change24hPct: number): number {
  if (currentPrice <= 0) return 0;
  const factor = 1 + (change24hPct / 100);
  if (factor <= 0) return currentPrice;
  return currentPrice / factor;
}

// ─── Swagger Schemas ──────────────────────────────────────
const schemas = {
  dashboard: {
    tags: ['User Dashboard'],
    summary: 'Personal dashboard overview',
    description: 'Aggregated stats: total invested, portfolio value, referral earnings, active pools, recent activity',
  },
  portfolio: {
    tags: ['User Dashboard'],
    summary: 'My investment portfolio',
    description: 'All pool positions with live prices, leverage, P&L, and liquidation targets',
  },
  positionDetail: {
    tags: ['User Dashboard'],
    summary: 'Single position detail',
    description: 'Detailed view of one pool position including phase 1 & phase 2 projections',
    params: { type: 'object', properties: { poolId: { type: 'string' } }, required: ['poolId'] },
  },
  referralTree: {
    tags: ['User Dashboard'],
    summary: '5-level referral tree',
    description: 'Full referral network across 5 levels with counts and earnings per level',
  },
  referralEarnings: {
    tags: ['User Dashboard'],
    summary: 'Referral earnings breakdown',
    description: 'Commission earnings broken down by level with totals',
  },
  myReceipts: {
    tags: ['User Dashboard'],
    summary: 'My receipt tokens',
    description: 'List of deposit receipt tokens (BEP-20 soulbound) for this user',
  },
  activity: {
    tags: ['User Dashboard'],
    summary: 'Recent activity feed',
    description: 'Chronological feed of deposits, withdrawals, referral bonuses, and pool events',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'string' },
        limit: { type: 'string' },
      },
    },
  },
  calculator: {
    tags: ['User Dashboard'],
    summary: 'Profit calculator',
    description: 'Calculate expected returns for a given pool fee and asset (BTC or ETH)',
    body: {
      type: 'object',
      required: ['poolFee', 'asset'],
      properties: {
        poolFee: { type: 'number', description: 'Pool entry fee in USD (100–1000)' },
        asset: { type: 'string', enum: ['BTC', 'ETH'], description: 'Crypto asset' },
      },
    },
  },
  market: {
    tags: ['User Dashboard'],
    summary: 'Live market data',
    description: 'BTC, ETH, BNB live prices with 24h change, ATH references, and CLB liquidation targets',
  },
};

export default async function userDashboardRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /user/dashboard — Personal dashboard overview
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  fastify.get(
    '/dashboard',
    { schema: schemas.dashboard },
    async (request: FastifyRequest) => {
      const userId = request.userId!;
      const prices = await priceService.getPrices();

      // Parallel queries
      const [
        user,
        memberships,
        deposits,
        referralStats,
        recentTx,
        referralCount,
      ] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, walletAddress: true, username: true, referralCode: true, createdAt: true },
        }),
        prisma.poolMember.findMany({
          where: { userId },
          include: { pool: true },
        }),
        prisma.deposit.findMany({
          where: { userId, status: 'CONFIRMED' },
        }),
        prisma.referral.aggregate({
          where: { referrerId: userId },
          _sum: { reward: true },
          _count: true,
        }),
        prisma.transaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.referral.count({ where: { referrerId: userId } }),
      ]);

      // Calculate total invested (sum of confirmed deposit amounts)
      const totalDeposited = deposits.reduce((sum, d) => sum + Number(d.amount), 0);
      const bnbPrice = prices.BNB?.usd || 0;

      // Calculate current portfolio value across all pool positions
      let portfolioValueUsd = 0;
      let totalLoanUsd = 0;
      const activePools = memberships.filter(m => m.pool.status === 'ACTIVE');

      for (const m of activePools) {
        const shareAmount = Number(m.share);
        const shareUsd = shareAmount * bnbPrice;
        const leverage = getLeverage(shareUsd);
        const asset = m.pool.tokenSymbol === 'BTC' || m.pool.tokenSymbol === 'BTCB' ? 'BTC' : 'ETH';
        const assetPrice = prices[asset]?.usd || 0;
        const assetChange24h = prices[asset]?.usd_24h_change || 0;
        const entryPrice = getEstimatedEntryPrice(assetPrice, assetChange24h);

        if (assetPrice > 0 && entryPrice > 0) {
          const loanUsd = shareUsd * leverage;
          totalLoanUsd += loanUsd;
          const cryptoAmount = loanUsd / entryPrice;
          // Current value of leveraged position = crypto held × current price
          portfolioValueUsd += cryptoAmount * assetPrice;
        }
      }

      // Unrealized P&L = current portfolio value - total loan (what was borrowed)
      const unrealizedPnl = portfolioValueUsd - totalLoanUsd;

      // Sum all REFERRAL_BONUS transactions (pool claim + mining buy + token claim)
      const referralBonusTx = await prisma.transaction.aggregate({
        where: { userId, type: 'REFERRAL_BONUS' },
        _sum: { amount: true },
      });
      const totalReferralEarnings = Number(referralBonusTx._sum.amount || 0);

      return {
        success: true,
        dashboard: {
          user: {
            id: user?.id,
            walletAddress: user?.walletAddress,
            username: user?.username,
            referralCode: user?.referralCode,
            memberSince: user?.createdAt,
          },
          stats: {
            totalDeposited: parseFloat(totalDeposited.toFixed(6)),
            totalDepositedUsd: parseFloat((totalDeposited * bnbPrice).toFixed(2)),
            portfolioValueUsd: parseFloat(portfolioValueUsd.toFixed(2)),
            totalLoanUsd: parseFloat(totalLoanUsd.toFixed(2)),
            unrealizedPnlUsd: parseFloat(unrealizedPnl.toFixed(2)),
            activePools: activePools.length,
            totalPools: memberships.length,
            totalDeposits: deposits.length,
            referralCount,
            referralEarnings: parseFloat(totalReferralEarnings.toFixed(2)),
            referralEarningsUsd: parseFloat(totalReferralEarnings.toFixed(2)),
          },
          prices: {
            BTC: prices.BTC,
            ETH: prices.ETH,
            BNB: prices.BNB,
          },
          recentActivity: recentTx.map(t => ({
            id: t.id,
            type: t.type,
            amount: Number(t.amount),
            status: t.status,
            createdAt: t.createdAt.toISOString(),
          })),
        },
      };
    }
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /user/portfolio — All investment positions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  fastify.get(
    '/portfolio',
    { schema: schemas.portfolio },
    async (request: FastifyRequest) => {
      const userId = request.userId!;
      const prices = await priceService.getPrices();
      const bnbPrice = prices.BNB?.usd || 0;

      const memberships = await prisma.poolMember.findMany({
        where: { userId },
        include: {
          pool: true,
        },
        orderBy: { joinedAt: 'desc' },
      });

      const positions = memberships.map(m => {
        const shareAmount = Number(m.share);
        const shareUsd = shareAmount * bnbPrice;
        const leverage = getLeverage(shareUsd);
        const loanUsd = shareUsd * leverage;

        const isBTC = m.pool.tokenSymbol === 'BTC' || m.pool.tokenSymbol === 'BTCB';
        const asset = isBTC ? 'BTC' : 'ETH';
        const assetPrice = prices[asset]?.usd || 0;
        const change24h = prices[asset]?.usd_24h_change || 0;
        const entryPrice = getEstimatedEntryPrice(assetPrice, change24h);

        const cryptoAmount = entryPrice > 0 ? loanUsd / entryPrice : 0;
        const currentValueUsd = cryptoAmount * assetPrice;
        const unrealizedPnl = currentValueUsd - loanUsd;
        const targets = LIQUIDATION_TARGETS[asset];

        // Phase 1: partial liquidation (40% at soft target)
        const p1 = calcLiquidationProfit(cryptoAmount, targets.phase1, loanUsd, 0.40);

        // Phase 2: remaining liquidation (60% at main target)
        const p2 = calcLiquidationProfit(cryptoAmount, targets.phase2, loanUsd, 0.60);

        const totalProjectedProfit = p1.userProfit + p2.userProfit;

        return {
          poolId: m.poolId,
          poolName: m.pool.name,
          poolStatus: m.pool.status,
          asset,
          tokenSymbol: m.pool.tokenSymbol,
          joinedAt: m.joinedAt.toISOString(),
          depositAmount: parseFloat(shareAmount.toFixed(6)),
          depositUsd: parseFloat(shareUsd.toFixed(2)),
          leverage,
          loanUsd: parseFloat(loanUsd.toFixed(2)),
          cryptoAmount: parseFloat(cryptoAmount.toFixed(8)),
          currentAssetPrice: assetPrice,
          change24h: parseFloat(change24h.toFixed(2)),
          currentValueUsd: parseFloat(currentValueUsd.toFixed(2)),
          unrealizedPnlUsd: parseFloat(unrealizedPnl.toFixed(2)),
          liquidationTargets: targets,
          projectedProfit: {
            phase1: parseFloat(p1.userProfit.toFixed(2)),
            phase2: parseFloat(p2.userProfit.toFixed(2)),
            total: parseFloat(totalProjectedProfit.toFixed(2)),
          },
        };
      });

      const totalInvestedUsd = positions.reduce((s, p) => s + p.depositUsd, 0);
      const totalCurrentValue = positions.reduce((s, p) => s + p.currentValueUsd, 0);
      const totalUnrealizedPnl = positions.reduce((s, p) => s + p.unrealizedPnlUsd, 0);
      const totalProjected = positions.reduce((s, p) => s + p.projectedProfit.total, 0);

      return {
        success: true,
        summary: {
          totalPositions: positions.length,
          totalInvestedUsd: parseFloat(totalInvestedUsd.toFixed(2)),
          totalCurrentValueUsd: parseFloat(totalCurrentValue.toFixed(2)),
          totalUnrealizedPnlUsd: parseFloat(totalUnrealizedPnl.toFixed(2)),
          totalProjectedProfitUsd: parseFloat(totalProjected.toFixed(2)),
        },
        positions,
      };
    }
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /user/portfolio/:poolId — Single position detail
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  fastify.get<{ Params: { poolId: string } }>(
    '/portfolio/:poolId',
    { schema: schemas.positionDetail },
    async (request: FastifyRequest<{ Params: { poolId: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { poolId } = request.params;
      const prices = await priceService.getPrices();
      const bnbPrice = prices.BNB?.usd || 0;

      const membership = await prisma.poolMember.findUnique({
        where: { userId_poolId: { userId, poolId } },
        include: { pool: true },
      });

      if (!membership) {
        return reply.status(404).send({ success: false, error: 'Position not found' });
      }

      // Get user's deposits for this pool
      const deposits = await prisma.deposit.findMany({
        where: { userId, poolId },
        orderBy: { createdAt: 'desc' },
      });

      const shareAmount = Number(membership.share);
      const shareUsd = shareAmount * bnbPrice;
      const leverage = getLeverage(shareUsd);
      const loanUsd = shareUsd * leverage;

      const isBTC = membership.pool.tokenSymbol === 'BTC' || membership.pool.tokenSymbol === 'BTCB';
      const asset = isBTC ? 'BTC' : 'ETH';
      const assetPrice = prices[asset]?.usd || 0;
      const change24h = prices[asset]?.usd_24h_change || 0;
      const entryPrice = getEstimatedEntryPrice(assetPrice, change24h);

      const cryptoAmount = entryPrice > 0 ? loanUsd / entryPrice : 0;
      const currentValueUsd = cryptoAmount * assetPrice;
      const unrealizedPnl = currentValueUsd - loanUsd;
      const targets = LIQUIDATION_TARGETS[asset];

      // Phase 1 calculation (partial 40% at soft target)
      const p1 = calcLiquidationProfit(cryptoAmount, targets.phase1, loanUsd, 0.40);
      const phase1 = {
        target: targets.phase1,
        liquidationPct: '40%',
        cryptoSold: parseFloat((cryptoAmount * 0.40).toFixed(8)),
        grossValue: parseFloat(p1.grossValue.toFixed(2)),
        platformFee: parseFloat(p1.platformFee.toFixed(2)),
        userProfit: parseFloat(p1.userProfit.toFixed(2)),
        upsideFromEntry: assetPrice > 0 ? `${((targets.phase1 / assetPrice - 1) * 100).toFixed(1)}%` : 'N/A',
      };

      // Phase 2 calculation (remaining 60% at main target)
      const p2 = calcLiquidationProfit(cryptoAmount, targets.phase2, loanUsd, 0.60);
      const phase2 = {
        target: targets.phase2,
        liquidationPct: '60%',
        cryptoSold: parseFloat((cryptoAmount * 0.60).toFixed(8)),
        grossValue: parseFloat(p2.grossValue.toFixed(2)),
        platformFee: parseFloat(p2.platformFee.toFixed(2)),
        userProfit: parseFloat(p2.userProfit.toFixed(2)),
        upsideFromEntry: assetPrice > 0 ? `${((targets.phase2 / assetPrice - 1) * 100).toFixed(1)}%` : 'N/A',
      };

      return {
        success: true,
        position: {
          pool: {
            id: membership.pool.id,
            name: membership.pool.name,
            tokenSymbol: membership.pool.tokenSymbol,
            status: membership.pool.status,
            apy: Number(membership.pool.apy),
          },
          asset,
          joinedAt: membership.joinedAt.toISOString(),
          depositAmount: parseFloat(shareAmount.toFixed(6)),
          depositUsd: parseFloat(shareUsd.toFixed(2)),
          leverage,
          loanUsd: parseFloat(loanUsd.toFixed(2)),
          cryptoAllocation: {
            amount: parseFloat(cryptoAmount.toFixed(8)),
            symbol: asset,
            currentPrice: assetPrice,
            change24h: parseFloat(change24h.toFixed(2)),
          },
          currentValueUsd: parseFloat(currentValueUsd.toFixed(2)),
          unrealizedPnlUsd: parseFloat(unrealizedPnl.toFixed(2)),
          profitSplit: { user: '85%', platform: '15%' },
          liquidation: { phase1, phase2 },
          totalProjectedProfit: parseFloat((phase1.userProfit + phase2.userProfit).toFixed(2)),
          deposits: deposits.map(d => ({
            id: d.id,
            amount: Number(d.amount),
            txHash: d.txHash,
            status: d.status,
            createdAt: d.createdAt.toISOString(),
          })),
        },
      };
    }
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /user/referrals/tree — 5-level referral tree
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  fastify.get(
    '/referrals/tree',
    { schema: schemas.referralTree },
    async (request: FastifyRequest) => {
      const userId = request.userId!;

      // Fetch user info and all REFERRAL_BONUS transactions in parallel
      const [user, bonusTx] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { referralCode: true },
        }),
        prisma.transaction.findMany({
          where: { userId, type: 'REFERRAL_BONUS' },
        }),
      ]);

      // Bucket earnings by level from transaction metadata (source of truth)
      const earningsByLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const tx of bonusTx) {
        const meta = tx.metadata as Record<string, unknown> | null;
        const lvl = typeof meta?.level === 'number' && meta.level >= 1 && meta.level <= 5
          ? meta.level
          : 1;
        earningsByLevel[lvl] = (earningsByLevel[lvl] ?? 0) + Number(tx.amount);
      }
      const totalBonusAll = bonusTx.reduce((s, t) => s + Number(t.amount), 0);

      // Build 5-level tree by traversing referral chains
      const tree: Array<{
        level: number;
        commissionRate: string;
        members: Array<{ walletAddress: string; username: string | null; joinedAt: string; status: string; reward: number }>;
        totalMembers: number;
        totalEarnings: number;
      }> = [];

      let currentReferrerIds = [userId];

      for (let level = 0; level < 5; level++) {
        if (currentReferrerIds.length === 0) {
          tree.push({
            level: level + 1,
            commissionRate: `${Math.round(REFERRAL_RATES[level] * 100)}%`,
            members: [],
            totalMembers: 0,
            totalEarnings: parseFloat((earningsByLevel[level + 1] ?? 0).toFixed(6)),
          });
          continue;
        }

        const referrals = await prisma.referral.findMany({
          where: { referrerId: { in: currentReferrerIds } },
          include: {
            referred: {
              select: { id: true, walletAddress: true, username: true, createdAt: true },
            },
          },
        });

        // Per-member rewards: sum transactions for this user at this level
        // that reference each specific referred user
        const memberRewards: Record<string, number> = {};
        for (const tx of bonusTx) {
          const meta = tx.metadata as Record<string, unknown> | null;
          const txLevel = typeof meta?.level === 'number' ? meta.level : 1;
          if (txLevel !== level + 1) continue;
          const refUserId = typeof meta?.referredUserId === 'string' ? meta.referredUserId : '';
          if (refUserId) {
            memberRewards[refUserId] = (memberRewards[refUserId] ?? 0) + Number(tx.amount);
          }
        }

        const members = referrals.map(r => ({
          walletAddress: r.referred.walletAddress,
          username: r.referred.username,
          joinedAt: r.createdAt.toISOString(),
          status: r.status,
          reward: parseFloat((memberRewards[r.referred.id] ?? 0).toFixed(6)),
        }));

        tree.push({
          level: level + 1,
          commissionRate: `${Math.round(REFERRAL_RATES[level] * 100)}%`,
          members,
          totalMembers: members.length,
          totalEarnings: parseFloat((earningsByLevel[level + 1] ?? 0).toFixed(6)),
        });

        // Next level: the referred users become the referrers
        currentReferrerIds = referrals.map(r => r.referredId);
      }

      const totalNetwork = tree.reduce((s, l) => s + l.totalMembers, 0);

      return {
        success: true,
        referralCode: user?.referralCode || null,
        referralLink: user?.referralCode ? buildReferralLink(user.referralCode) : null,
        totalNetwork,
        totalEarnings: parseFloat(totalBonusAll.toFixed(6)),
        levels: tree,
      };
    }
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /user/referrals/earnings — Earnings breakdown
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  fastify.get(
    '/referrals/earnings',
    { schema: schemas.referralEarnings },
    async (request: FastifyRequest) => {
      const userId = request.userId!;

      // Fetch all referral bonus transactions and direct referral edges in parallel
      const [bonusTx, directReferrals] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId, type: 'REFERRAL_BONUS' },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.referral.findMany({
          where: { referrerId: userId },
          include: {
            referred: { select: { walletAddress: true, username: true } },
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      // Bucket earnings by level and by trigger type
      const earningsByLevel: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const earningsByTrigger: Record<string, number> = {
        POOL_CLAIM: 0,
        MINING_PACKAGE_BUY: 0,
        TOKEN_CLAIM: 0,
      };
      for (const tx of bonusTx) {
        const meta = tx.metadata as Record<string, unknown> | null;
        const lvl = typeof meta?.level === 'number' && meta.level >= 1 && meta.level <= 5
          ? meta.level
          : 1;
        earningsByLevel[lvl] = (earningsByLevel[lvl] ?? 0) + Number(tx.amount);
        const trigger = typeof meta?.trigger === 'string' ? meta.trigger : 'POOL_CLAIM';
        earningsByTrigger[trigger] = (earningsByTrigger[trigger] ?? 0) + Number(tx.amount);
      }

      // Total = sum of ALL referral bonus transactions (pool claim + mining buy + token claim)
      const totalBonusReceived = bonusTx.reduce((s, t) => s + Number(t.amount), 0);

      return {
        success: true,
        earnings: {
          totalBonusReceived: parseFloat(totalBonusReceived.toFixed(6)),
          referralEarningsUsd: parseFloat(totalBonusReceived.toFixed(6)),
          earningsByTrigger: {
            poolClaim: parseFloat(earningsByTrigger.POOL_CLAIM.toFixed(6)),
            miningPackageBuy: parseFloat(earningsByTrigger.MINING_PACKAGE_BUY.toFixed(6)),
            tokenClaim: parseFloat(earningsByTrigger.TOKEN_CLAIM.toFixed(6)),
          },
          directReferrals: directReferrals.length,
          commissionRates: REFERRAL_RATES.map((rate, i) => ({
            level: i + 1,
            rate: `${Math.round(rate * 100)}%`,
            description: i === 0 ? 'Direct referrals' : `Level ${i + 1} network`,
            earned: parseFloat((earningsByLevel[i + 1] ?? 0).toFixed(6)),
          })),
          recentBonuses: bonusTx.slice(0, 20).map(t => ({
            id: t.id,
            amount: Number(t.amount),
            level: (t.metadata as Record<string, unknown> | null)?.level ?? 1,
            trigger: (t.metadata as Record<string, unknown> | null)?.trigger ?? null,
            rewardType: (t.metadata as Record<string, unknown> | null)?.rewardType ?? null,
            status: t.status,
            txHash: t.txHash,
            createdAt: t.createdAt.toISOString(),
          })),
          referralList: directReferrals.map(r => ({
            id: r.id,
            wallet: r.referred.walletAddress,
            username: r.referred.username,
            reward: Number(r.reward),
            status: r.status,
            joinedAt: r.createdAt.toISOString(),
          })),
        },
      };
    }
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /user/receipts — My receipt tokens
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  fastify.get(
    '/receipts',
    { schema: schemas.myReceipts },
    async (request: FastifyRequest) => {
      const userId = request.userId!;

      const deposits = await prisma.deposit.findMany({
        where: { userId },
        include: {
          pool: { select: { id: true, name: true, tokenSymbol: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      const receipts = deposits.map(d => ({
        receiptId: `CLB-R-${d.id.slice(0, 8).toUpperCase()}`,
        poolName: d.pool?.name ?? 'N/A',
        poolSymbol: d.pool?.tokenSymbol ?? '',
        amount: Number(d.amount),
        txHash: d.txHash,
        status: d.status,
        mintedAt: d.createdAt.toISOString(),
        tokenStandard: 'BEP-20 (soulbound)',
        transferable: false,
        burnable: true,
      }));

      return {
        success: true,
        total: receipts.length,
        receipts,
      };
    }
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /user/activity — Recent activity feed
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  fastify.get<{ Querystring: { page?: string; limit?: string } }>(
    '/activity',
    { schema: schemas.activity },
    async (request: FastifyRequest<{ Querystring: { page?: string; limit?: string } }>) => {
      const userId = request.userId!;
      const page = parseInt(request.query.page || '1', 10);
      const limit = parseInt(request.query.limit || '30', 10);
      const skip = (page - 1) * limit;

      // Fetch transactions, deposits, and referrals in parallel
      const [transactions, deposits, referrals, txTotal, depositTotal, referralTotal] = await Promise.all([
        prisma.transaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip,
        }),
        prisma.deposit.findMany({
          where: { userId },
          include: { pool: { select: { name: true, tokenSymbol: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        prisma.referral.findMany({
          where: { referrerId: userId },
          include: { referred: { select: { walletAddress: true, username: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
        prisma.transaction.count({ where: { userId } }),
        prisma.deposit.count({ where: { userId } }),
        prisma.referral.count({ where: { referrerId: userId } }),
      ]);

      // Build unified activity items from all sources
      type ActivityItem = { id: string; type: string; title: string; description: string; amount?: number; status: string; timestamp: string };
      const activities: ActivityItem[] = [];

      // Add transactions
      const typeLabels: Record<string, string> = {
        DEPOSIT: 'Pool Deposit',
        WITHDRAWAL: 'Withdrawal',
        REWARD: 'Reward Payout',
        REFERRAL_BONUS: 'Referral Commission',
        FEE: 'Platform Fee',
      };
      for (const tx of transactions) {
        activities.push({
          id: tx.id,
          type: tx.type,
          title: typeLabels[tx.type] || tx.type,
          description: tx.txHash ? `Tx: ${tx.txHash.slice(0, 10)}…` : '',
          amount: Number(tx.amount),
          status: tx.status,
          timestamp: tx.createdAt.toISOString(),
        });
      }

      // Add deposits as pool join events
      for (const d of deposits) {
        activities.push({
          id: d.id,
          type: 'POOL_DEPOSIT',
          title: `Joined ${d.pool?.name ?? 'Unknown'}`,
          description: `${d.pool?.tokenSymbol ?? ''} pool — ${Number(d.amount)} BNB`,
          amount: Number(d.amount),
          status: d.status,
          timestamp: d.createdAt.toISOString(),
        });
      }

      // Add referral events
      for (const r of referrals) {
        activities.push({
          id: r.id,
          type: 'REFERRAL',
          title: 'New Referral',
          description: `${r.referred.username || r.referred.walletAddress.slice(0, 10)}… joined`,
          amount: Number(r.reward),
          status: r.status,
          timestamp: r.createdAt.toISOString(),
        });
      }

      // Sort all activities by timestamp descending
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const totalItems = txTotal + depositTotal + referralTotal;

      return {
        success: true,
        activities: activities.slice(0, limit),
        pagination: {
          page,
          limit,
          total: totalItems,
          totalPages: Math.ceil(totalItems / limit),
        },
      };
    }
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // POST /user/calculator — Profit calculator
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  fastify.post<{ Body: { poolFee: number; asset: string } }>(
    '/calculator',
    { schema: schemas.calculator },
    async (request: FastifyRequest<{ Body: { poolFee: number; asset: string } }>, reply: FastifyReply) => {
      const { poolFee, asset: rawAsset } = request.body;
      const asset = rawAsset.toUpperCase();

      if (asset !== 'BTC' && asset !== 'ETH') {
        return reply.status(400).send({ success: false, error: 'Asset must be BTC or ETH' });
      }
      if (poolFee < 100 || poolFee > 1000) {
        return reply.status(400).send({ success: false, error: 'Pool fee must be between $100 and $1,000' });
      }

      const prices = await priceService.getPrices();
      const assetPrice = prices[asset]?.usd || 0;

      if (assetPrice <= 0) {
        return reply.status(503).send({ success: false, error: 'Price data unavailable' });
      }

      const leverage = getLeverage(poolFee);
      const loanUsd = poolFee * leverage;
      const cryptoAmount = loanUsd / assetPrice;
      const targets = LIQUIDATION_TARGETS[asset];

      // Phase 1: 40% partial liquidation at soft target
      const p1 = calcLiquidationProfit(cryptoAmount, targets.phase1, loanUsd, 0.40);

      // Phase 2: 60% full liquidation at main target
      const p2 = calcLiquidationProfit(cryptoAmount, targets.phase2, loanUsd, 0.60);

      const totalUserProfit = p1.userProfit + p2.userProfit;
      const roi = (totalUserProfit / poolFee) * 100;

      return {
        success: true,
        calculation: {
          input: {
            poolFee,
            asset,
            currentPrice: assetPrice,
          },
          leverage,
          loanUsd: parseFloat(loanUsd.toFixed(2)),
          cryptoReceived: {
            amount: parseFloat(cryptoAmount.toFixed(8)),
            symbol: asset,
          },
          phase1: {
            targetPrice: targets.phase1,
            upsideFromEntry: `${((targets.phase1 / assetPrice - 1) * 100).toFixed(1)}%`,
            liquidationPct: '40%',
            cryptoSold: parseFloat((cryptoAmount * 0.40).toFixed(8)),
            grossValue: parseFloat(p1.grossValue.toFixed(2)),
            platformFee: parseFloat(p1.platformFee.toFixed(2)),
            userProfit: parseFloat(p1.userProfit.toFixed(2)),
          },
          phase2: {
            targetPrice: targets.phase2,
            upsideFromEntry: `${((targets.phase2 / assetPrice - 1) * 100).toFixed(1)}%`,
            liquidationPct: '60%',
            cryptoSold: parseFloat((cryptoAmount * 0.60).toFixed(8)),
            grossValue: parseFloat(p2.grossValue.toFixed(2)),
            platformFee: parseFloat(p2.platformFee.toFixed(2)),
            userProfit: parseFloat(p2.userProfit.toFixed(2)),
          },
          totalUserProfit: parseFloat(totalUserProfit.toFixed(2)),
          roi: `${roi.toFixed(1)}%`,
          profitSplit: { user: '85%', platform: '15%' },
        },
      };
    }
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // GET /user/market — Live market data
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  fastify.get(
    '/market',
    { schema: schemas.market },
    async () => {
      const prices = await priceService.getPrices();

      // Coin metadata with icons and colors
      const coins = {
        BTC: { name: 'Bitcoin', icon: '₿', color: '#F7931A', colorDark: '#E07B00' },
        ETH: { name: 'Ethereum', icon: 'Ξ', color: '#627EEA', colorDark: '#3C5FBF' },
        BNB: { name: 'BNB', icon: 'B', color: '#F3BA2F', colorDark: '#D4A020' },
        SOL: { name: 'Solana', icon: '◎', color: '#00FFA3', colorDark: '#00CC82' },
        ADA: { name: 'Cardano', icon: '₳', color: '#0033AD', colorDark: '#002288' },
        DOGE: { name: 'Dogecoin', icon: 'Ð', color: '#C2A633', colorDark: '#9E8529' },
        DOT: { name: 'Polkadot', icon: '●', color: '#E6007A', colorDark: '#B3005F' },
        MATIC: { name: 'Polygon', icon: '⬡', color: '#8247E5', colorDark: '#6338B0' },
        AVAX: { name: 'Avalanche', icon: '▲', color: '#E84142', colorDark: '#B83334' },
        LINK: { name: 'Chainlink', icon: '🔗', color: '#2A5ADA', colorDark: '#1F46A8' },
        UNI: { name: 'Uniswap', icon: '🦄', color: '#FF007A', colorDark: '#CC0062' },
        XRP: { name: 'Ripple', icon: '✕', color: '#23292F', colorDark: '#1B2025' },
        LTC: { name: 'Litecoin', icon: 'Ł', color: '#BFBBBB', colorDark: '#999696' },
      };

      const coinsData = Object.entries(coins).map(([symbol, meta]) => ({
        symbol,
        name: meta.name,
        icon: meta.icon,
        color: meta.color,
        colorDark: meta.colorDark,
        price: prices[symbol]?.usd || 0,
        change24h: prices[symbol]?.usd_24h_change || 0,
        marketCap: prices[symbol]?.usd_market_cap || 0,
      }));

      return {
        success: true,
        market: {
          coins: coinsData,
          targets: {
            BTC: LIQUIDATION_TARGETS.BTC,
            ETH: LIQUIDATION_TARGETS.ETH,
          },
          tiers: Object.entries(TIER_LEVERAGE).map(([fee, lev]) => ({
            poolFee: Number(fee),
            leverage: `${lev}x`,
            loanUsd: Number(fee) * lev,
          })),
          referralRates: REFERRAL_RATES.map((rate, i) => ({
            level: i + 1,
            rate: `${Math.round(rate * 100)}%`,
          })),
        },
      };
    }
  );
}
