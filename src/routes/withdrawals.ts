import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { WITHDRAW_FEES, isPlatformToken } from '../config/tokens';

function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export default async function withdrawalRoutes(fastify: FastifyInstance) {

  // ─── POST /withdrawals/request — Request a withdrawal ──
  fastify.post<{
    Body: { token: string; amount: number; toAddress: string };
  }>(
    '/request',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{
      Body: { token: string; amount: number; toAddress: string };
    }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { token, amount, toAddress } = request.body;

      if (!token || !amount || !toAddress) {
        return reply.status(400).send({ success: false, error: 'Missing required fields' });
      }

      const isPlatform = isPlatformToken(token);
      const fee = WITHDRAW_FEES[token] || 0;
      const netAmount = amount - fee;
      const normalizedToAddress = toAddress.toLowerCase();

      if (netAmount <= 0) {
        return reply.status(400).send({
          success: false,
          error: `Amount must be greater than the ${fee} ${token} fee`,
        });
      }

      if (isPlatform && !isValidEvmAddress(toAddress)) {
        return reply.status(400).send({
          success: false,
          error: 'Enter a valid BNB Smart Chain wallet address',
        });
      }

      if (isPlatform && token === 'USDT') {
        // USDT withdrawals come from referral earnings stored on the User record
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          return reply.status(404).send({ success: false, error: 'User not found' });
        }

        let available = Number(user.referralEarningsUsd);

        // Legacy accounts may have referral bonus transactions but a zero cached balance.
        // Rebuild once from ledger and persist so withdrawals work correctly.
        if (available <= 0) {
          const [bonusAgg, withdrawnAgg] = await Promise.all([
            prisma.transaction.aggregate({
              where: {
                userId,
                type: 'REFERRAL_BONUS',
                status: 'SUCCESS',
              },
              _sum: { amount: true },
            }),
            prisma.withdrawal.aggregate({
              where: {
                userId,
                token: 'USDT',
                status: { in: ['PENDING', 'PROCESSING', 'COMPLETED'] },
              },
              _sum: { amount: true },
            }),
          ]);

          const totalBonuses = Number(bonusAgg._sum.amount || 0);
          const totalWithdrawn = Number(withdrawnAgg._sum.amount || 0);
          const rebuiltAvailable = Math.max(0, totalBonuses - totalWithdrawn);

          if (rebuiltAvailable > 0) {
            await prisma.user.update({
              where: { id: userId },
              data: { referralEarningsUsd: rebuiltAvailable },
            });
            available = rebuiltAvailable;
          }
        }

        if (available < amount) {
          return reply.status(400).send({
            success: false,
            error: `Insufficient USDT balance. Available: ${available.toFixed(2)}`,
          });
        }

        // Deduct immediately to prevent double-spend while PENDING
        await prisma.user.update({
          where: { id: userId },
          data: { referralEarningsUsd: { decrement: amount } },
        });
      } else if (isPlatform) {
        const balance = await prisma.tokenBalance.findUnique({
          where: { userId_token: { userId, token } },
        });
        const available = balance
          ? Number(balance.balance) - Number(balance.locked)
          : 0;

        if (available < amount) {
          return reply.status(400).send({
            success: false,
            error: `Insufficient ${token} balance. Available: ${available.toFixed(2)}`,
          });
        }

        // Lock the balance so it can't be double-spent while PENDING
        await prisma.tokenBalance.update({
          where: { userId_token: { userId, token } },
          data: { locked: { increment: amount } },
        });
      }

      const withdrawal = await prisma.withdrawal.create({
        data: {
          userId,
          token,
          amount,
          toAddress: normalizedToAddress,
          fee,
          status: 'PENDING',
        },
      });

      await prisma.transaction.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          amount,
          toAddress: normalizedToAddress,
          status: 'PENDING',
          metadata: { withdrawalId: withdrawal.id, token, fee, netAmount },
        },
      });

      await prisma.notification.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          title: 'Withdrawal Requested',
          body: `Your withdrawal of ${netAmount.toFixed(6)} ${token} to ${toAddress.slice(0, 8)}...${toAddress.slice(-4)} has been submitted and is awaiting admin approval.`,
          data: { withdrawalId: withdrawal.id, token, amount, netAmount },
        },
      });

      return {
        success: true,
        message: 'Withdrawal request submitted. Admin will review and process it manually.',
        withdrawal: {
          id: withdrawal.id,
          token,
          amount: Number(withdrawal.amount),
          fee: Number(withdrawal.fee),
          netAmount,
          toAddress: withdrawal.toAddress,
          status: withdrawal.status,
          createdAt: withdrawal.createdAt,
        },
      };
    }
  );

  // ─── GET /withdrawals — List user withdrawals ──────────
  fastify.get<{ Querystring: { page?: string; limit?: string; status?: string } }>(
    '/',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{
      Querystring: { page?: string; limit?: string; status?: string };
    }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 50);
      const skip = (page - 1) * limit;

      const where: any = { userId };
      if (request.query.status) where.status = request.query.status;

      const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.withdrawal.count({ where }),
      ]);

      return {
        success: true,
        withdrawals: withdrawals.map((w) => ({
          id: w.id,
          token: w.token,
          amount: Number(w.amount),
          fee: Number(w.fee),
          toAddress: w.toAddress,
          status: w.status,
          txHash: w.txHash,
          createdAt: w.createdAt,
          processedAt: w.processedAt,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    }
  );

  // ─── GET /withdrawals/:id — Withdrawal detail ──────────
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { id } = request.params;

      const withdrawal = await prisma.withdrawal.findFirst({
        where: { id, userId },
      });

      if (!withdrawal) {
        return reply.status(404).send({ success: false, error: 'Withdrawal not found' });
      }

      return {
        success: true,
        withdrawal: {
          id: withdrawal.id,
          token: withdrawal.token,
          amount: Number(withdrawal.amount),
          fee: Number(withdrawal.fee),
          toAddress: withdrawal.toAddress,
          status: withdrawal.status,
          txHash: withdrawal.txHash,
          createdAt: withdrawal.createdAt,
          processedAt: withdrawal.processedAt,
        },
      };
    }
  );

  // ─── GET /withdrawals/fees — Withdrawal fee info ───────
  fastify.get('/fees', async () => {
    return {
      success: true,
      fees: Object.entries(WITHDRAW_FEES).map(([token, fee]) => ({
        token,
        fee,
        minAmount: 0,
      })),
    };
  });
}
