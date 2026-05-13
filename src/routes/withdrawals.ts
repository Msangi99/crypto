import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { tokenService } from '../services/tokenService';
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

      // Check balance for CLB tokens
      if (isPlatform) {
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

        if (!tokenService.isConfigured(token)) {
          const config = tokenService.getConfigStatus(token);
          return reply.status(503).send({
            success: false,
            error: `On-chain ${token} withdrawals are not configured yet.`,
            config,
          });
        }

        const [withdrawal, txLog] = await prisma.$transaction([
          prisma.tokenBalance.update({
            where: { userId_token: { userId, token } },
            data: { balance: { decrement: amount } },
          }),
          prisma.withdrawal.create({
            data: {
              userId,
              token,
              amount,
              toAddress: normalizedToAddress,
              fee,
              status: 'PROCESSING',
            },
          }),
          prisma.transaction.create({
            data: {
              userId,
              type: 'WITHDRAWAL',
              amount,
              toAddress: normalizedToAddress,
              status: 'PENDING',
              metadata: { token, fee, netAmount, directOnChain: true },
            },
          }),
        ]).then(([, createdWithdrawal, createdTx]) => [createdWithdrawal, createdTx] as const);

        let txHash: string | undefined;
        try {
          const result = await tokenService.sendOnChain(token, normalizedToAddress, netAmount, { preferMint: true });
          if (!result?.txHash) throw new Error(`On-chain ${token} withdrawal did not return a transaction hash`);
          txHash = result.txHash;
        } catch (err: any) {
          await prisma.$transaction([
            prisma.tokenBalance.update({
              where: { userId_token: { userId, token } },
              data: { balance: { increment: amount } },
            }),
            prisma.withdrawal.update({
              where: { id: withdrawal.id },
              data: { status: 'FAILED', processedAt: new Date() },
            }),
            prisma.transaction.update({
              where: { id: txLog.id },
              data: {
                status: 'FAILED',
                metadata: { token, fee, netAmount, directOnChain: true, error: err?.message || 'On-chain withdrawal failed' },
              },
            }),
          ]);

          return reply.status(502).send({
            success: false,
            error: 'On-chain withdrawal failed. Balance refunded.',
            detail: err?.message,
          });
        }

        const completedWithdrawal = await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: { status: 'COMPLETED', txHash, processedAt: new Date() },
        });

        await prisma.$transaction([
          prisma.transaction.update({
            where: { id: txLog.id },
            data: {
              txHash,
              status: 'SUCCESS',
              metadata: { withdrawalId: withdrawal.id, token, fee, netAmount, directOnChain: true },
            },
          }),
          prisma.notification.create({
            data: {
              userId,
              type: 'WITHDRAWAL',
              title: `${token} sent to wallet`,
              body: `${netAmount.toFixed(6)} ${token} was sent on BNB Smart Chain to ${toAddress.slice(0, 8)}...${toAddress.slice(-4)}.`,
              data: { withdrawalId: withdrawal.id, token, amount, netAmount, txHash },
            },
          }),
        ]);

        return {
          success: true,
          withdrawal: {
            id: completedWithdrawal.id,
            token,
            amount: Number(completedWithdrawal.amount),
            fee: Number(completedWithdrawal.fee),
            netAmount,
            toAddress: completedWithdrawal.toAddress,
            status: completedWithdrawal.status,
            txHash,
            explorerUrl: tokenService.getExplorerTxUrl(txHash),
            createdAt: completedWithdrawal.createdAt,
            processedAt: completedWithdrawal.processedAt,
          },
        };
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

      // Transaction log
      await prisma.transaction.create({
        data: {
          userId,
          type: 'WITHDRAWAL',
          amount,
          toAddress: normalizedToAddress,
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
