import { Prisma } from '@prisma/client';
import prisma from '../config/db';

/**
 * Multi-Level Referral Reward Structure (L1–L5)
 *
 * Commission rates applied to the triggering amount at each upline level:
 *
 *  TRIGGER 1 — Referred user "Claims Pool"
 *    Reward type : claimedPoolCreditUsd  (Loan Amount)
 *    L1 → 20% | L2 → 7% | L3 → 4% | L4 → 3% | L5 → 1%
 *
 *  TRIGGER 2 — Referred user "Buys Mining Package"
 *    Reward type : depositCreditUsd  (Available Credit)
 *    L1 → 20% | L2 → 7% | L3 → 4% | L4 → 3% | L5 → 1%
 *
 *  TRIGGER 3 — Referred user "Claims Mined Tokens"
 *    Reward type : TokenBalance  (CLB Balance)
 *    L1 → 10% | L2 → 3.5% | L3 → 2% | L4 → 3% | L5 → 1%
 */

// Rates indexed [L1, L2, L3, L4, L5]
const POOL_CLAIM_RATES  = [0.20, 0.07, 0.04, 0.03, 0.01];
const MINING_BUY_RATES  = [0.20, 0.07, 0.04, 0.03, 0.01];
const TOKEN_CLAIM_RATES = [0.10, 0.035, 0.02, 0.03, 0.01];

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
 * Pays each upline (L1–L5) a share of `loanCreditUsd` → added to claimedPoolCreditUsd.
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

    // The referred user ID at this edge = the user directly below the beneficiary
    const referredAtLevel = i === 0 ? referredUserId : chain[i - 1];

    await db.user.update({
      where: { id: beneficiaryId },
      data: { claimedPoolCreditUsd: { increment: new Prisma.Decimal(rewardUsd) } },
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
          rate: `${rate * 100}%`,
          referredUserId,
          loanCreditUsd,
          rewardUsd,
          rewardType: 'LOAN_AMOUNT',
          description: `L${level} referral bonus: ${rate * 100}% of $${loanCreditUsd} pool credit → Loan Amount`,
        },
      },
    });

    await db.notification.create({
      data: {
        userId: beneficiaryId,
        type: 'REWARD',
        title: `Referral Bonus — Pool Claim (L${level})`,
        body: `A Level ${level} referral claimed a pool! You earned $${rewardUsd.toFixed(2)} added to your Loan Amount.`,
        data: { trigger: 'POOL_CLAIM', level, rewardUsd, rewardType: 'LOAN_AMOUNT' },
      },
    });

    console.log(
      `[Referral] Pool claim L${level}: $${rewardUsd.toFixed(2)} (${rate * 100}%) → ${beneficiaryId.slice(0, 8)}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 2: Mining package purchase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called when a referred user buys a mining package.
 * Pays each upline (L1–L5) a share of `purchasePriceUsd` → added to depositCreditUsd.
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
      data: { depositCreditUsd: { increment: new Prisma.Decimal(rewardUsd) } },
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
          rate: `${rate * 100}%`,
          referredUserId,
          purchasePriceUsd,
          rewardUsd,
          rewardType: 'AVAILABLE_CREDIT',
          description: `L${level} referral bonus: ${rate * 100}% of $${purchasePriceUsd} mining purchase → Available Credit`,
        },
      },
    });

    await db.notification.create({
      data: {
        userId: beneficiaryId,
        type: 'REWARD',
        title: `Referral Bonus — Mining Package (L${level})`,
        body: `A Level ${level} referral bought a mining package! You earned $${rewardUsd.toFixed(2)} added to your Available Credit.`,
        data: { trigger: 'MINING_PACKAGE_BUY', level, rewardUsd, rewardType: 'AVAILABLE_CREDIT' },
      },
    });

    console.log(
      `[Referral] Mining buy L${level}: $${rewardUsd.toFixed(2)} (${rate * 100}%) → ${beneficiaryId.slice(0, 8)}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TRIGGER 3: Mined token claim
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Called when a referred user claims mined tokens.
 * Pays each upline (L1–L5) a share of `claimedAmount` tokens → added to CLB Balance.
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

    await db.tokenBalance.upsert({
      where: { userId_token: { userId: beneficiaryId, token: tokenSymbol } },
      create: { userId: beneficiaryId, token: tokenSymbol, balance: rewardTokens },
      update: { balance: { increment: rewardTokens } },
    });

    await db.tokenTransfer.create({
      data: {
        fromUserId: referredUserId,
        toUserId: beneficiaryId,
        token: tokenSymbol,
        amount: rewardTokens,
        type: 'REWARD',
        status: 'COMPLETED',
        note: `L${level} referral bonus: ${rate * 100}% of ${claimedAmount} ${tokenSymbol} from referred user claim`,
      },
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
          rate: `${rate * 100}%`,
          referredUserId,
          tokenSymbol,
          claimedAmount,
          rewardTokens,
          rewardType: 'CLB_BALANCE',
          description: `L${level} referral bonus: ${rate * 100}% of ${claimedAmount} ${tokenSymbol} → CLB Balance`,
        },
      },
    });

    await db.notification.create({
      data: {
        userId: beneficiaryId,
        type: 'REWARD',
        title: `Referral Bonus — Token Claim (L${level})`,
        body: `A Level ${level} referral claimed ${claimedAmount} ${tokenSymbol}! You earned ${rewardTokens.toFixed(4)} ${tokenSymbol} added to your balance.`,
        data: { trigger: 'TOKEN_CLAIM', level, rewardTokens, tokenSymbol, rewardType: 'CLB_BALANCE' },
      },
    });

    console.log(
      `[Referral] Token claim L${level}: ${rewardTokens.toFixed(4)} ${tokenSymbol} (${rate * 100}%) → ${beneficiaryId.slice(0, 8)}`,
    );
  }
}
