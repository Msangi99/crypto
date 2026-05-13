import { Prisma } from '@prisma/client';
import prisma from '../config/db';

/**
 * Multi-Level Referral Reward Structure (L1–L5)
 *
 * All referral commissions are credited to `referralEarningsUsd` — a
 * dedicated referral-only balance that is separate from deposit credit,
 * loan credit, and token balances.
 *
 * Commission rates applied to the triggering amount at each upline level:
 *
 *  TRIGGER 1 — Referred user "Claims Pool"
 *    L1 → 20% | L2 → 7% | L3 → 4% | L4 → 3% | L5 → 1%
 *
 *  TRIGGER 2 — Referred user "Buys Mining Package"
 *    L1 → 20% | L2 → 7% | L3 → 4% | L4 → 3% | L5 → 1%
 *
 *  TRIGGER 3 — Referred user "Claims Mined Tokens"
 *    L1 → 10% | L2 → 7% | L3 → 2% | L4 → 3% | L5 → 1%
 */

// ── Canonical commission rates (single source of truth) ─────────────────────
// Rates indexed [L1, L2, L3, L4, L5]
export const POOL_CLAIM_RATES  = [0.20, 0.07, 0.04, 0.03, 0.01] as const;
export const MINING_BUY_RATES  = [0.20, 0.07, 0.04, 0.03, 0.01] as const;
export const TOKEN_CLAIM_RATES = [0.10, 0.07, 0.02, 0.03, 0.01] as const;

/** Default display rates (pool claim / mining purchase). */
export const REFERRAL_RATES = POOL_CLAIM_RATES;

export const REFERRAL_LEVEL_COUNT = 5;

/**
 * Walk the referral chain upward from `userId` and return up to 5 ancestor ids
 * in order: [L1 referrer, L2 referrer, L3 referrer, L4 referrer, L5 referrer].
 * Stops early if the chain ends before 5 levels.
 */
async function getReferralChain(userId: string): Promise<string[]> {
  const chain: string[] = [];
  let currentId = userId;

  for (let i = 0; i < 5; i++) {
    const edge = await prisma.referral.findUnique({
      where: { referredId: currentId },
      select: { referrerId: true },
    });
    if (!edge) break;
    chain.push(edge.referrerId);
    currentId = edge.referrerId;
  }

  return chain;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 1: Pool claim
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called when a referred user claims a pool.
 * Pays each upline (L1–L5) a share of `loanCreditUsd` → added to referralEarningsUsd.
 */
export async function onPoolClaimed(
  referredUserId: string,
  loanCreditUsd: number,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const chain = await getReferralChain(referredUserId);
  if (chain.length === 0) return;

  const db = tx ?? prisma;

  for (let i = 0; i < chain.length; i++) {
    const level = i + 1;
    const beneficiaryId = chain[i];
    const rate = POOL_CLAIM_RATES[i];
    const rewardUsd = loanCreditUsd * rate;
    if (rewardUsd <= 0) continue;

    const referredAtLevel = i === 0 ? referredUserId : chain[i - 1];

    await db.user.update({
      where: { id: beneficiaryId },
      data: { referralEarningsUsd: { increment: new Prisma.Decimal(rewardUsd) } },
    });

    await db.referral.updateMany({
      where: { referrerId: beneficiaryId, referredId: referredAtLevel },
      data: { reward: { increment: new Prisma.Decimal(rewardUsd) } },
    });

    await db.transaction.create({
      data: {
        userId: beneficiaryId,
        type: 'REFERRAL_BONUS',
        amount: rewardUsd,
        status: 'SUCCESS',
        metadata: {
          trigger: 'POOL_CLAIM',
          level,
          rate: `${Math.round(rate * 100)}%`,
          referredUserId,
          loanCreditUsd,
          rewardUsd,
          rewardType: 'REFERRAL_EARNINGS',
          description: `L${level} referral bonus: ${Math.round(rate * 100)}% of $${loanCreditUsd} pool credit → Referral Earnings`,
        },
      },
    });

    await db.notification.create({
      data: {
        userId: beneficiaryId,
        type: 'REWARD',
        title: `Referral Bonus — Pool Claim (L${level})`,
        body: `A Level ${level} referral claimed a pool! You earned $${rewardUsd.toFixed(2)} in referral earnings.`,
        data: { trigger: 'POOL_CLAIM', level, rewardUsd, rewardType: 'REFERRAL_EARNINGS' },
      },
    });

    console.log(
      `[Referral] Pool claim L${level}: $${rewardUsd.toFixed(2)} (${Math.round(rate * 100)}%) → ${beneficiaryId.slice(0, 8)}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 2: Mining package purchase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called when a referred user buys a mining package.
 * Pays each upline (L1–L5) a share of `purchasePriceUsd` → added to referralEarningsUsd.
 */
export async function onMiningPackageBought(
  referredUserId: string,
  purchasePriceUsd: number,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const chain = await getReferralChain(referredUserId);
  if (chain.length === 0) return;

  const db = tx ?? prisma;

  for (let i = 0; i < chain.length; i++) {
    const level = i + 1;
    const beneficiaryId = chain[i];
    const rate = MINING_BUY_RATES[i];
    const rewardUsd = purchasePriceUsd * rate;
    if (rewardUsd <= 0) continue;

    const referredAtLevel = i === 0 ? referredUserId : chain[i - 1];

    await db.user.update({
      where: { id: beneficiaryId },
      data: { referralEarningsUsd: { increment: new Prisma.Decimal(rewardUsd) } },
    });

    await db.referral.updateMany({
      where: { referrerId: beneficiaryId, referredId: referredAtLevel },
      data: { reward: { increment: new Prisma.Decimal(rewardUsd) } },
    });

    await db.transaction.create({
      data: {
        userId: beneficiaryId,
        type: 'REFERRAL_BONUS',
        amount: rewardUsd,
        status: 'SUCCESS',
        metadata: {
          trigger: 'MINING_PACKAGE_BUY',
          level,
          rate: `${Math.round(rate * 100)}%`,
          referredUserId,
          purchasePriceUsd,
          rewardUsd,
          rewardType: 'REFERRAL_EARNINGS',
          description: `L${level} referral bonus: ${Math.round(rate * 100)}% of $${purchasePriceUsd} mining purchase → Referral Earnings`,
        },
      },
    });

    await db.notification.create({
      data: {
        userId: beneficiaryId,
        type: 'REWARD',
        title: `Referral Bonus — Mining Package (L${level})`,
        body: `A Level ${level} referral bought a mining package! You earned $${rewardUsd.toFixed(2)} in referral earnings.`,
        data: { trigger: 'MINING_PACKAGE_BUY', level, rewardUsd, rewardType: 'REFERRAL_EARNINGS' },
      },
    });

    console.log(
      `[Referral] Mining buy L${level}: $${rewardUsd.toFixed(2)} (${Math.round(rate * 100)}%) → ${beneficiaryId.slice(0, 8)}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 3: Mined token claim
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called when a referred user claims mined tokens.
 * Pays each upline (L1–L5) a USD-equivalent share of `claimedAmount` → added to referralEarningsUsd.
 */
export async function onMinedTokensClaimed(
  referredUserId: string,
  tokenSymbol: string,
  claimedAmount: number,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const chain = await getReferralChain(referredUserId);
  if (chain.length === 0) return;

  const db = tx ?? prisma;

  for (let i = 0; i < chain.length; i++) {
    const level = i + 1;
    const beneficiaryId = chain[i];
    const rate = TOKEN_CLAIM_RATES[i];
    const rewardTokens = claimedAmount * rate;
    if (rewardTokens <= 0) continue;

    const referredAtLevel = i === 0 ? referredUserId : chain[i - 1];

    await db.user.update({
      where: { id: beneficiaryId },
      data: { referralEarningsUsd: { increment: new Prisma.Decimal(rewardTokens) } },
    });

    await db.referral.updateMany({
      where: { referrerId: beneficiaryId, referredId: referredAtLevel },
      data: { reward: { increment: new Prisma.Decimal(rewardTokens) } },
    });

    await db.transaction.create({
      data: {
        userId: beneficiaryId,
        type: 'REFERRAL_BONUS',
        amount: rewardTokens,
        status: 'SUCCESS',
        metadata: {
          trigger: 'TOKEN_CLAIM',
          level,
          rate: `${Math.round(rate * 100)}%`,
          referredUserId,
          tokenSymbol,
          claimedAmount,
          rewardTokens,
          rewardType: 'REFERRAL_EARNINGS',
          description: `L${level} referral bonus: ${Math.round(rate * 100)}% of ${claimedAmount} ${tokenSymbol} → Referral Earnings`,
        },
      },
    });

    await db.notification.create({
      data: {
        userId: beneficiaryId,
        type: 'REWARD',
        title: `Referral Bonus — Token Claim (L${level})`,
        body: `A Level ${level} referral claimed ${claimedAmount} ${tokenSymbol}! You earned ${rewardTokens.toFixed(4)} in referral earnings.`,
        data: { trigger: 'TOKEN_CLAIM', level, rewardTokens, tokenSymbol, rewardType: 'REFERRAL_EARNINGS' },
      },
    });

    console.log(
      `[Referral] Token claim L${level}: ${rewardTokens.toFixed(4)} ${tokenSymbol} (${Math.round(rate * 100)}%) → ${beneficiaryId.slice(0, 8)}`,
    );
  }
}
