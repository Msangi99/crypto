import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';

// CLB token prices (in USD) — in production, these would come from an oracle/market
const TOKEN_PRICES: Record<string, number> = {
  CLB: 1.00,
  CLBg: 5.00,
  CLBs: 2.50,
};

export default async function tokenRoutes(fastify: FastifyInstance) {

  // ─── GET /tokens/balances — Get user token balances ────
  fastify.get(
    '/balances',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;

      const balances = await prisma.tokenBalance.findMany({
        where: { userId },
      });

      // Ensure all token types exist
      const allTokens = ['CLB', 'CLBg', 'CLBs'];
      const result = allTokens.map((token) => {
        const found = balances.find((b) => b.token === token);
        const balance = found ? Number(found.balance) : 0;
        const locked = found ? Number(found.locked) : 0;
        const price = TOKEN_PRICES[token] || 0;
        return {
          token,
          balance,
          locked,
          available: balance - locked,
          priceUsd: price,
          valueUsd: balance * price,
        };
      });

      const totalValueUsd = result.reduce((sum, t) => sum + t.valueUsd, 0);

      return { success: true, balances: result, totalValueUsd };
    }
  );

  // ─── GET /tokens/prices — Token prices ─────────────────
  fastify.get('/prices', async () => {
    return {
      success: true,
      prices: Object.entries(TOKEN_PRICES).map(([token, price]) => ({
        token,
        priceUsd: price,
        change24h: Math.random() * 6 - 2, // Simulated for now
      })),
    };
  });

  // ─── POST /tokens/transfer — Transfer tokens to another user ─
  fastify.post<{
    Body: { toAddress: string; token: string; amount: number; note?: string };
  }>(
    '/transfer',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{
      Body: { toAddress: string; token: string; amount: number; note?: string };
    }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { toAddress, token, amount, note } = request.body;

      if (!toAddress || !token || !amount) {
        return reply.status(400).send({ success: false, error: 'Missing required fields' });
      }
      if (amount <= 0) {
        return reply.status(400).send({ success: false, error: 'Amount must be positive' });
      }
      if (!['CLB', 'CLBg', 'CLBs'].includes(token)) {
        return reply.status(400).send({ success: false, error: 'Invalid token' });
      }

      // Check sender balance
      const senderBalance = await prisma.tokenBalance.findUnique({
        where: { userId_token: { userId, token } },
      });

      const available = senderBalance
        ? Number(senderBalance.balance) - Number(senderBalance.locked)
        : 0;

      if (available < amount) {
        return reply.status(400).send({
          success: false,
          error: `Insufficient ${token} balance. Available: ${available.toFixed(2)}`,
        });
      }

      // Find recipient by wallet address
      const recipient = await prisma.user.findUnique({
        where: { walletAddress: toAddress.toLowerCase() },
      });

      const isInternal = !!recipient;
      const fee = isInternal ? 0 : amount * 0.01; // 1% fee for external transfers
      const netAmount = amount - fee;

      if (isInternal) {
        // Internal transfer
        await prisma.$transaction([
          // Deduct from sender
          prisma.tokenBalance.update({
            where: { userId_token: { userId, token } },
            data: { balance: { decrement: amount } },
          }),
          // Add to recipient
          prisma.tokenBalance.upsert({
            where: { userId_token: { userId: recipient!.id, token } },
            create: { userId: recipient!.id, token, balance: netAmount },
            update: { balance: { increment: netAmount } },
          }),
          // Transfer record
          prisma.tokenTransfer.create({
            data: {
              fromUserId: userId,
              toUserId: recipient!.id,
              token,
              amount,
              fee,
              type: 'INTERNAL',
              status: 'COMPLETED',
              note,
            },
          }),
          // Transaction log
          prisma.transaction.create({
            data: {
              userId,
              type: 'TRANSFER',
              amount,
              toAddress: toAddress.toLowerCase(),
              status: 'SUCCESS',
              metadata: { token, toUser: recipient!.id, fee },
            },
          }),
        ]);

        // Notify recipient
        const sender = await prisma.user.findUnique({ where: { id: userId } });
        await prisma.notification.create({
          data: {
            userId: recipient!.id,
            type: 'TRANSFER',
            title: `${token} Received!`,
            body: `You received ${netAmount.toFixed(2)} ${token} from ${sender?.username || sender?.walletAddress?.slice(0, 8) + '...'}`,
            data: { amount: netAmount, token, fromAddress: sender?.walletAddress },
          },
        });
      } else {
        // External transfer (to Trust Wallet etc.)
        await prisma.$transaction([
          prisma.tokenBalance.update({
            where: { userId_token: { userId, token } },
            data: { balance: { decrement: amount } },
          }),
          prisma.tokenTransfer.create({
            data: {
              fromUserId: userId,
              toAddress: toAddress.toLowerCase(),
              token,
              amount,
              fee,
              type: 'EXTERNAL',
              status: 'PENDING', // Pending until on-chain confirmation
              note,
            },
          }),
        ]);
      }

      return {
        success: true,
        transfer: {
          token,
          amount,
          fee,
          netAmount,
          toAddress,
          type: isInternal ? 'INTERNAL' : 'EXTERNAL',
          status: isInternal ? 'COMPLETED' : 'PENDING',
        },
      };
    }
  );

  // ─── GET /tokens/history — Transfer history ────────────
  fastify.get<{ Querystring: { page?: string; limit?: string; token?: string } }>(
    '/history',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{
      Querystring: { page?: string; limit?: string; token?: string };
    }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 50);
      const skip = (page - 1) * limit;
      const tokenFilter = request.query.token;

      const where: any = {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      };
      if (tokenFilter) where.token = tokenFilter;

      const [transfers, total] = await Promise.all([
        prisma.tokenTransfer.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            fromUser: { select: { walletAddress: true, username: true } },
            toUser: { select: { walletAddress: true, username: true } },
          },
        }),
        prisma.tokenTransfer.count({ where }),
      ]);

      return {
        success: true,
        transfers: transfers.map((t) => ({
          id: t.id,
          token: t.token,
          amount: Number(t.amount),
          fee: Number(t.fee),
          type: t.type,
          status: t.status,
          txHash: t.txHash,
          note: t.note,
          direction: t.fromUserId === userId ? 'OUT' : 'IN',
          counterparty: t.fromUserId === userId
            ? (t.toUser?.username || t.toAddress || 'System')
            : (t.fromUser?.username || t.fromUser?.walletAddress?.slice(0, 10) || 'System'),
          createdAt: t.createdAt,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    }
  );
}
