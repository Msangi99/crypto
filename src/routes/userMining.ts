import { FastifyInstance } from 'fastify';
import { Prisma, type ClbMiningPackage } from '@prisma/client';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { serializeMiningPackage } from './miningPackages';
import { computeMiningProgress } from '../services/miningAccrual';
import { onMiningPackageBought, onMinedTokensClaimed } from '../services/referralRewardService';
import { notifyAdminPayment } from '../services/adminNotify';

function isBscAddress(addr: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(addr.trim());
}

/** USD to charge for activating a paid mining package (deposit wallet only — loan credit is not used). */
function miningActivationFeeUsd(pkg: ClbMiningPackage): Prisma.Decimal | null {
  if (pkg.isFree) return null;
  if (pkg.priceUsd == null) return null;
  const d = new Prisma.Decimal(pkg.priceUsd.toString());
  return d.gt(0) ? d : null;
}

async function debitMiningActivationUsd(
  tx: Prisma.TransactionClient,
  userId: string,
  pkg: ClbMiningPackage,
  feeUsd: Prisma.Decimal,
): Promise<{ fromDeposit: Prisma.Decimal }> {
  const user = await tx.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');
  const depBal = new Prisma.Decimal(user.depositCreditUsd.toString());
  if (depBal.lt(feeUsd)) throw new Error('INSUFFICIENT_CREDIT');
  await tx.user.update({
    where: { id: userId },
    data: {
      depositCreditUsd: { decrement: feeUsd },
    },
  });
  await tx.transaction.create({
    data: {
      userId,
      type: 'FEE',
      amount: feeUsd,
      status: 'SUCCESS',
      metadata: {
        event: 'MINING_PACKAGE_ACTIVATION',
        packageId: pkg.id,
        packageName: pkg.name,
        fromDepositUsd: feeUsd.toString(),
      },
    },
  });
  return { fromDeposit: feeUsd };
}

export default async function userMiningRoutes(fastify: FastifyInstance) {
  async function buildSubscriptionResponse(userId: string) {
    const sub = await prisma.userMiningSubscription.findUnique({
      where: { userId },
      include: { package: true },
    });
    if (!sub) return null;
    const tpp = Number(sub.package.tokensPerPeriod);
    const { accruedTokens, periodProgressPct } = computeMiningProgress(
      tpp,
      sub.package.periodUnit,
      sub.package.periodLength,
      sub.startedAt,
    );
    return {
      id: sub.id,
      packageId: sub.packageId,
      payoutAddress: sub.payoutAddress,
      startedAt: sub.startedAt.toISOString(),
      package: serializeMiningPackage(sub.package),
      tokenSymbol: sub.package.tokenSymbol,
      accruedTokens,
      periodProgressPct,
    };
  }

  fastify.get(
    '/subscription',
    { preHandler: [authMiddleware] },
    async (request) => {
      const userId = request.userId!;
      const subscription = await buildSubscriptionResponse(userId);
      return { success: true, subscription };
    },
  );

  fastify.post<{
    Body: { packageId?: string; payoutAddress?: string };
  }>(
    '/subscribe',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const userId = request.userId!;
      const { packageId, payoutAddress } = request.body;

      if (!packageId || typeof packageId !== 'string') {
        return reply.status(400).send({ success: false, error: 'packageId is required' });
      }
      if (!payoutAddress || typeof payoutAddress !== 'string') {
        return reply.status(400).send({ success: false, error: 'payoutAddress is required' });
      }
      const norm = payoutAddress.trim().toLowerCase();
      if (!isBscAddress(norm)) {
        return reply.status(400).send({ success: false, error: 'Invalid BSC payout address (0x + 40 hex)' });
      }

      const pkg = await prisma.clbMiningPackage.findFirst({
        where: { id: packageId, isActive: true },
      });
      if (!pkg) {
        return reply.status(404).send({ success: false, error: 'Mining package not found or inactive' });
      }

      const existing = await prisma.userMiningSubscription.findUnique({
        where: { userId },
      });

      if (existing && existing.packageId === packageId && existing.payoutAddress === norm) {
        const subscription = await buildSubscriptionResponse(userId);
        return { success: true, subscription };
      }

      if (existing && existing.packageId === packageId && existing.payoutAddress !== norm) {
        await prisma.userMiningSubscription.update({
          where: { userId },
          data: { payoutAddress: norm },
        });
        const subscription = await buildSubscriptionResponse(userId);
        return { success: true, subscription };
      }

      const feeUsd = miningActivationFeeUsd(pkg);
      if (!pkg.isFree && feeUsd == null) {
        return reply.status(400).send({
          success: false,
          error:
            'This mining package requires a price (USD). Ask an admin to set priceUsd on the package, or use a free tier.',
        });
      }

      const isPackageChangeOrNew = !existing || existing.packageId !== packageId;
      const upgraded = Boolean(existing && existing.packageId !== packageId);

      try {
        const out = await prisma.$transaction(async (tx) => {
          if (isPackageChangeOrNew && feeUsd != null) {
            await debitMiningActivationUsd(tx, userId, pkg, feeUsd);
          }

          if (existing && existing.packageId !== packageId) {
            await tx.userMiningSubscription.update({
              where: { userId },
              data: {
                packageId,
                payoutAddress: norm,
                startedAt: new Date(),
              },
            });
          } else if (!existing) {
            await tx.userMiningSubscription.create({
              data: {
                userId,
                packageId,
                payoutAddress: norm,
              },
            });
          }

          const balances = await tx.user.findUnique({
            where: { id: userId },
            select: { depositCreditUsd: true, claimedPoolCreditUsd: true },
          });

          return { balances };
        });

        const subscription = await buildSubscriptionResponse(userId);

        // Trigger referral reward: 20% of mining package price → referrer Available Credit
        if (isPackageChangeOrNew && feeUsd != null && Number(feeUsd) > 0) {
          onMiningPackageBought(userId, Number(feeUsd)).catch((err) =>
            console.error('[Referral] Mining package reward error:', err.message)
          );

          const payer = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, username: true, email: true, walletAddress: true },
          });
          if (payer) {
            notifyAdminPayment({
              user: payer,
              txType: 'FEE',
              amount: Number(feeUsd),
              status: 'SUCCESS',
              detail: `Mining package "${pkg.name}" activated ($${Number(feeUsd).toFixed(2)})`,
            });
          }
        }

        return {
          success: true,
          subscription,
          ...(upgraded ? { upgraded: true } : {}),
          balances: {
            depositCreditUsd: Number(out.balances?.depositCreditUsd ?? 0),
            claimedPoolCreditUsd: Number(out.balances?.claimedPoolCreditUsd ?? 0),
          },
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        if (msg === 'INSUFFICIENT_CREDIT') {
          return reply.status(400).send({
            success: false,
            error:
              'Insufficient deposit credit for this machine — add USDT via Receive so your deposit wallet covers the package price (loan credit is not used for mining).',
          });
        }
        if (msg === 'USER_NOT_FOUND') {
          return reply.status(404).send({ success: false, error: 'User not found' });
        }
        throw e;
      }
    },
  );

  /** Move computed mining accrual into app ledger (`token_balances`) and reset the mining timer. */
  fastify.post('/claim', { preHandler: [authMiddleware] }, async (request, reply) => {
    const userId = request.userId!;
    const sub = await prisma.userMiningSubscription.findUnique({
      where: { userId },
      include: { package: true },
    });
    if (!sub) {
      return reply.status(400).send({ success: false, error: 'No active mining subscription' });
    }
    const p = sub.package;
    const tpp = Number(p.tokensPerPeriod);
    const { accruedTokens } = computeMiningProgress(tpp, p.periodUnit, p.periodLength, sub.startedAt);
    if (!Number.isFinite(accruedTokens) || accruedTokens <= 0) {
      return reply.status(400).send({ success: false, error: 'Nothing to claim yet' });
    }
    const token = p.tokenSymbol;
    if (token !== 'CLB') {
      return reply.status(400).send({ success: false, error: 'Invalid mining token' });
    }

    await prisma.$transaction([
      prisma.tokenBalance.upsert({
        where: { userId_token: { userId, token } },
        create: { userId, token, balance: accruedTokens },
        update: { balance: { increment: accruedTokens } },
      }),
      prisma.userMiningSubscription.update({
        where: { userId },
        data: { startedAt: new Date() },
      }),
    ]);

    // Trigger referral reward: 10% of claimed tokens → referrer CLB Balance
    onMinedTokensClaimed(userId, token, accruedTokens).catch((err) =>
      console.error('[Referral] Token claim reward error:', err.message)
    );

    return {
      success: true,
      claimed: accruedTokens,
      token,
      message: 'Mining accrual added to your in-app balance. Timer reset for the next accrual.',
    };
  });
}
