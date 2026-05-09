import { FastifyInstance } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { serializeMiningPackage } from './miningPackages';
import { computeMiningProgress } from '../services/miningAccrual';

function isBscAddress(addr: string): boolean {
  return /^0x[a-f0-9]{40}$/i.test(addr.trim());
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

      if (existing && existing.packageId !== packageId) {
        await prisma.userMiningSubscription.update({
          where: { userId },
          data: {
            packageId,
            payoutAddress: norm,
            startedAt: new Date(),
          },
        });
        const subscription = await buildSubscriptionResponse(userId);
        return { success: true, subscription, upgraded: true };
      }

      await prisma.userMiningSubscription.create({
        data: {
          userId,
          packageId,
          payoutAddress: norm,
        },
      });
      const subscription = await buildSubscriptionResponse(userId);
      return { success: true, subscription };
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
    if (!['CLB', 'CLBg', 'CLBs'].includes(token)) {
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

    return {
      success: true,
      claimed: accruedTokens,
      token,
      message: 'Mining accrual added to your in-app balance. Timer reset for the next accrual.',
    };
  });
}
