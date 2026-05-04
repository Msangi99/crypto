import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';

// Minimum withdrawal amounts
const MIN_WITHDRAW: Record<string, number> = {
  CLB: 10,
  CLBg: 1,
  CLBs: 5,
  BTC: 0.0001,
  ETH: 0.001,
  BNB: 0.01,
};

// Withdrawal fees (flat)
const WITHDRAW_FEES: Record<string, number> = {
  CLB: 1,
  CLBg: 0.1,
  CLBs: 0.5,
  BTC: 0.00005,
  ETH: 0.0005,
  BNB: 0.001,
};

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

      const isClbToken = ['CLB', 'CLBg', 'CLBs'].includes(token);
      const min = MIN_WITHDRAW[token] || 0;
      const fee = WITHDRAW_FEES[token] || 0;

      if (amount < min) {
        return reply.status(400).send({
          success: false,
          error: `Minimum withdrawal for ${token} is ${min}`,
        });
      }

      // Check balance for CLB tokens
      if (isClbToken) {
        const balance = await prisma.tokenBalance.findUnique({
          where: { userId_token: { userId, token } },
        });
        const available = balance
          ? Number(balance.balance) - Number(balance.locked)
          : 0;

        if (available < amount + fee) {
          return reply.status(400).send({
            success: false,
            error: `Insufficient ${token} balance. Available: ${available.toFixed(2)}, Need: ${(amount + fee).toFixed(2)} (incl. fee)`,
          });
        }

        // Lock the withdrawal amount
        await prisma.tokenBalance.update({
          where: { userId_token: { userId, token } },
          data: {
            balance: { decrement: amount + fee },
            locked: { increment: amount },
          },
        });
      }

      const withdrawal = await prisma.withdrawal.create({
        data: {
          userId,
          token,
          amount,
          toAddress: toAddress.toLowerCase(),
          fee,
          status: 'PENDING',
        },
      });

      // Transaction log
      await prisma.transaction.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          amount,
          toAddress: toAddress.toLowerCase(),
          status: 'PENDING',
          metadata: { withdrawalId: withdrawal.id, token, fee },
        },
      });

      // Notify
      await prisma.notification.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          title: 'Withdrawal Requested',
          body: `Your withdrawal of ${amount} ${token} to ${toAddress.slice(0, 8)}...${toAddress.slice(-4)} is being processed.`,
          data: { withdrawalId: withdrawal.id, token, amount },
        },
      });

      return {
        success: true,
        withdrawal: {
          id: withdrawal.id,
          token,
          amount: Number(withdrawal.amount),
          fee: Number(withdrawal.fee),
          netAmount: amount - fee,
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
        minAmount: MIN_WITHDRAW[token] || 0,
      })),
    };
  });
}
