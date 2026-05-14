import type { FastifyBaseLogger } from 'fastify';
import { Prisma } from '@prisma/client';
import prisma from '../config/db';

/** Pool columns from first schema revision (always present after init migration). */
const poolSelectLegacy = {
  id: true,
  name: true,
  description: true,
  contractAddress: true,
  tokenSymbol: true,
  minDeposit: true,
  maxDeposit: true,
  apy: true,
  totalStaked: true,
  status: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Pool + in-app claim + leveraged fields (current Prisma schema). */
const poolSelectFull = {
  ...poolSelectLegacy,
  supportsAppCredit: true,
  creditMinUsd: true,
  creditCreditedUsd: true,
  heldAsset: true,
  leverageRatio: true,
  phase1Target: true,
  phase2Target: true,
  profitSplit: true,
  entryPrice: true,
} as const;

function warn(log: FastifyBaseLogger | undefined, label: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  log?.warn({ adminUserDetail: label, err: msg });
}

async function poolMembersForUser(userId: string, log?: FastifyBaseLogger) {
  try {
    return await prisma.poolMember.findMany({
      where: { userId },
      include: { pool: { select: poolSelectFull } },
    });
  } catch (e) {
    warn(log, 'poolMemberships_full', e);
    try {
      return await prisma.poolMember.findMany({
        where: { userId },
        include: { pool: { select: poolSelectLegacy } },
      });
    } catch (e2) {
      warn(log, 'poolMemberships_legacy', e2);
      return prisma.poolMember.findMany({ where: { userId } }).catch(() => []);
    }
  }
}

async function depositsForUser(userId: string, log?: FastifyBaseLogger) {
  try {
    return await prisma.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { pool: { select: poolSelectFull } },
    });
  } catch (e) {
    warn(log, 'deposits_full', e);
    try {
      return await prisma.deposit.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { pool: { select: poolSelectLegacy } },
      });
    } catch (e2) {
      warn(log, 'deposits_legacy', e2);
      return prisma.deposit
        .findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
        .catch(() => []);
    }
  }
}

function isPrismaKnown(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code?: unknown }).code === 'string'
  );
}

/**
 * Loads admin user hub payload. User row is one query; relations are loaded separately so a
 * missing column on `pools` (or another table) cannot blank the entire admin user page.
 */
export async function loadAdminUserDetailBundle(userId: string, log?: FastifyBaseLogger) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const [
    poolMemberships,
    transactions,
    deposits,
    referrals,
    referredBy,
    loans,
    miningSubscription,
    tokenBalances,
    creditDraws,
  ] = await Promise.all([
    poolMembersForUser(userId, log),
    prisma.transaction
      .findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 })
      .catch((e) => {
        warn(log, 'transactions', e);
        return [];
      }),
    depositsForUser(userId, log),
    prisma.referral
      .findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: 'desc' },
        take: 80,
        include: {
          referred: {
            select: {
              id: true,
              walletAddress: true,
              username: true,
              email: true,
              createdAt: true,
            },
          },
        },
      })
      .catch((e) => {
        warn(log, 'referrals', e);
        return [];
      }),
    prisma.referral
      .findUnique({
        where: { referredId: userId },
        include: {
          referrer: {
            select: {
              id: true,
              walletAddress: true,
              username: true,
              email: true,
              referralCode: true,
            },
          },
        },
      })
      .catch((e) => {
        warn(log, 'referredBy', e);
        return null;
      }),
    prisma.loan
      .findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 40 })
      .catch((e) => {
        warn(log, 'loans', e);
        return [];
      }),
    prisma.userMiningSubscription
      .findUnique({
        where: { userId },
        include: { package: true },
      })
      .catch((e) => {
        warn(log, 'miningSubscription', e);
        return null;
      }),
    prisma.tokenBalance
      .findMany({ where: { userId } })
      .catch((e) => {
        warn(log, 'tokenBalances', e);
        return [];
      }),
    prisma.creditDraw
      .findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { loan: { select: { id: true, loanType: true, status: true } } },
      })
      .catch((e) => {
        warn(log, 'creditDraws', e);
        return prisma.creditDraw
          .findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
          })
          .catch(() => []);
      }),
  ]);

  return {
    ...user,
    poolMemberships,
    transactions,
    deposits,
    referrals,
    referredBy,
    loans,
    miningSubscription,
    tokenBalances,
    creditDraws,
  };
}

export function formatAdminUserDbError(err: unknown): { status: number; body: Record<string, unknown> } {
  if (isPrismaKnown(err)) {
    const code = err.code;
    const meta = err.meta as Record<string, unknown> | undefined;
    if (code === 'P2022') {
      const col = typeof meta?.column === 'string' ? meta.column : 'unknown column';
      return {
        status: 503,
        body: {
          success: false,
          error: `Database schema is out of date (${col}). On the API host run: npx prisma migrate deploy`,
          prismaCode: code,
        },
      };
    }
    return {
      status: 503,
      body: {
        success: false,
        error: err.message || 'Database request failed',
        prismaCode: code,
      },
    };
  }
  const msg = err instanceof Error ? err.message : 'Internal server error';
  return {
    status: 500,
    body: { success: false, error: msg },
  };
}
