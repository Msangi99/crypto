import { Prisma } from '@prisma/client';
import prisma from '../config/db';

/**
 * Referral Reward Structure (per design spec):
 *
 *  Trigger 1 — Referred user "Claims Pool"
 *    → Referrer gets 20% of pool reward → added to claimedPoolCreditUsd (Loan Amount)
 *
 *  Trigger 2 — Referred user "Buys Mining Package"
 *    → Referrer gets 20% of purchase price → added to depositCreditUsd (Available Credit)
 *
 *  Trigger 3 — Referred user "Claims Mined Tokens"
 *    → Referrer gets 10% of claimed tokens → added to token balance (CLB Balance)
 */

const POOL_CLAIM_RATE = 0.20;       // 20% of pool loan credit → referrer Loan Amount
const MINING_BUY_RATE = 0.20;       // 20% of mining purchase → referrer Available Credit
const TOKEN_CLAIM_RATE = 0.10;      // 10% of claimed tokens → referrer CLB Balance

/**
 * Find the referrer of a given user (the person who referred them).
 * Returns null if the user was not referred by anyone.
 */
async function getReferrerId(referredUserId: string): Promise<string | null> {
  const referral = await prisma.referral.findUnique({
    where: { referredId: referredUserId },
    select: { referrerId: true },
  });
  return referral?.referrerId ?? null;
}

/**
 * TRIGGER 1: Referred user claims a pool.
 * Referrer gets 20% of the loan credit amount → added to claimedPoolCreditUsd.
 *
 * @param referredUserId - the user who claimed the pool
 * @param loanCreditUsd  - the loan credit amount given to the referred user
 * @param tx             - optional Prisma transaction client
 */
export async function onPoolClaimed(
  referredUserId: string,
  loanCreditUsd: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const referrerId = await getReferrerId(referredUserId);
  if (!referrerId) return;

  const rewardUsd = loanCreditUsd * POOL_CLAIM_RATE;
  if (rewardUsd <= 0) return;

  const db = tx ?? prisma;

  await db.user.update({
    where: { id: referrerId },
    data: { claimedPoolCreditUsd: { increment: new Prisma.Decimal(rewardUsd) } },
  });

  await db.referral.updateMany({
    where: { referrerId, referredId: referredUserId },
    data: { reward: { increment: new Prisma.Decimal(rewardUsd) } },
  });

  await db.transaction.create({
    data: {
      userId: referrerId,
      type: 'REFERRAL_BONUS',
      amount: rewardUsd,
      status: 'SUCCESS',
      metadata: {
        trigger: 'POOL_CLAIM',
        referredUserId,
        loanCreditUsd,
        rewardUsd,
        rewardType: 'LOAN_AMOUNT',
        description: `Referral bonus: ${POOL_CLAIM_RATE * 100}% of $${loanCreditUsd} pool credit → Loan Amount`,
      },
    },
  });

  await db.notification.create({
    data: {
      userId: referrerId,
      type: 'REWARD',
      title: '🎁 Referral Bonus — Pool Claim!',
      body: `Your referral claimed a pool! You earned $${rewardUsd.toFixed(2)} added to your Loan Amount.`,
      data: {
        trigger: 'POOL_CLAIM',
        rewardUsd,
        rewardType: 'LOAN_AMOUNT',
      },
    },
  });

  console.log(`[Referral] Pool claim bonus: $${rewardUsd.toFixed(2)} → referrer ${referrerId.slice(0, 8)}`);
}

/**
 * TRIGGER 2: Referred user buys a mining package.
 * Referrer gets 20% of purchase price → added to depositCreditUsd (Available Credit).
 *
 * @param referredUserId  - the user who bought the mining package
 * @param purchasePriceUsd - the USD price the referred user paid
 * @param tx               - optional Prisma transaction client
 */
export async function onMiningPackageBought(
  referredUserId: string,
  purchasePriceUsd: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const referrerId = await getReferrerId(referredUserId);
  if (!referrerId) return;

  const rewardUsd = purchasePriceUsd * MINING_BUY_RATE;
  if (rewardUsd <= 0) return;

  const db = tx ?? prisma;

  await db.user.update({
    where: { id: referrerId },
    data: { depositCreditUsd: { increment: new Prisma.Decimal(rewardUsd) } },
  });

  await db.referral.updateMany({
    where: { referrerId, referredId: referredUserId },
    data: { reward: { increment: new Prisma.Decimal(rewardUsd) } },
  });

  await db.transaction.create({
    data: {
      userId: referrerId,
      type: 'REFERRAL_BONUS',
      amount: rewardUsd,
      status: 'SUCCESS',
      metadata: {
        trigger: 'MINING_PACKAGE_BUY',
        referredUserId,
        purchasePriceUsd,
        rewardUsd,
        rewardType: 'AVAILABLE_CREDIT',
        description: `Referral bonus: ${MINING_BUY_RATE * 100}% of $${purchasePriceUsd} mining purchase → Available Credit`,
      },
    },
  });

  await db.notification.create({
    data: {
      userId: referrerId,
      type: 'REWARD',
      title: '🎁 Referral Bonus — Mining Package!',
      body: `Your referral bought a mining package! You earned $${rewardUsd.toFixed(2)} added to your Available Credit.`,
      data: {
        trigger: 'MINING_PACKAGE_BUY',
        rewardUsd,
        rewardType: 'AVAILABLE_CREDIT',
      },
    },
  });

  console.log(`[Referral] Mining package bonus: $${rewardUsd.toFixed(2)} → referrer ${referrerId.slice(0, 8)}`);
}

/**
 * TRIGGER 3: Referred user claims mined tokens.
 * Referrer gets 10% of claimed tokens → added to their CLB token balance.
 *
 * @param referredUserId - the user who claimed tokens
 * @param tokenSymbol    - token symbol (e.g., 'CLB')
 * @param claimedAmount  - number of tokens claimed
 * @param tx             - optional Prisma transaction client
 */
export async function onMinedTokensClaimed(
  referredUserId: string,
  tokenSymbol: string,
  claimedAmount: number,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const referrerId = await getReferrerId(referredUserId);
  if (!referrerId) return;

  const rewardTokens = claimedAmount * TOKEN_CLAIM_RATE;
  if (rewardTokens <= 0) return;

  const db = tx ?? prisma;

  await db.tokenBalance.upsert({
    where: { userId_token: { userId: referrerId, token: tokenSymbol } },
    create: { userId: referrerId, token: tokenSymbol, balance: rewardTokens },
    update: { balance: { increment: rewardTokens } },
  });

  await db.tokenTransfer.create({
    data: {
      fromUserId: referredUserId, // tokens flow from referred user's action
      toUserId: referrerId,
      token: tokenSymbol,
      amount: rewardTokens,
      type: 'REWARD',
      status: 'COMPLETED',
      note: `Referral bonus: ${TOKEN_CLAIM_RATE * 100}% of ${claimedAmount} ${tokenSymbol} from referred user claim`,
    },
  });

  await db.referral.updateMany({
    where: { referrerId, referredId: referredUserId },
    data: { reward: { increment: new Prisma.Decimal(rewardTokens) } },
  });

  await db.transaction.create({
    data: {
      userId: referrerId,
      type: 'REFERRAL_BONUS',
      amount: rewardTokens,
      status: 'SUCCESS',
      metadata: {
        trigger: 'TOKEN_CLAIM',
        referredUserId,
        tokenSymbol,
        claimedAmount,
        rewardTokens,
        rewardType: 'CLB_BALANCE',
        description: `Referral bonus: ${TOKEN_CLAIM_RATE * 100}% of ${claimedAmount} ${tokenSymbol} → CLB Balance`,
      },
    },
  });

  await db.notification.create({
    data: {
      userId: referrerId,
      type: 'REWARD',
      title: '🎁 Referral Bonus — Token Claim!',
      body: `Your referral claimed ${claimedAmount} ${tokenSymbol}! You earned ${rewardTokens.toFixed(4)} ${tokenSymbol} added to your balance.`,
      data: {
        trigger: 'TOKEN_CLAIM',
        rewardTokens,
        tokenSymbol,
        rewardType: 'CLB_BALANCE',
      },
    },
  });

  console.log(`[Referral] Token claim bonus: ${rewardTokens.toFixed(4)} ${tokenSymbol} → referrer ${referrerId.slice(0, 8)}`);
}
