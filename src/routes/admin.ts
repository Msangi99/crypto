import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { liquidationService } from '../services/liquidationService';

// Admin-only middleware — reads role from JWT (no extra DB query)
async function adminMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authMiddleware(request, reply);
  if (reply.sent) return;

  if (request.userRole !== 'ADMIN') {
    reply.status(403).send({ success: false, error: 'Forbidden — admin access required' });
  }
}

// ─── Swagger Schema Definitions ─────────────────────
const adminSchemas = {
  listUsers: {
    tags: ['Admin'],
    summary: 'List all users',
    description: 'Paginated list of all users with optional search',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'string', description: 'Page number' },
        limit: { type: 'string', description: 'Items per page' },
        search: { type: 'string', description: 'Search by wallet, username, or email' },
      },
    },
  },
  getUser: {
    tags: ['Admin'],
    summary: 'Get user details',
    description: 'Get a single user with memberships, transactions, deposits, and referrals',
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  updateUser: {
    tags: ['Admin'],
    summary: 'Update user',
    description: 'Update user profile, role, or active status',
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    body: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        email: { type: 'string' },
        role: { type: 'string', enum: ['USER', 'ADMIN', 'MODERATOR'] },
        isActive: { type: 'boolean' },
      },
    },
  },
  deleteUser: {
    tags: ['Admin'],
    summary: 'Delete user',
    description: 'Delete a user and all dependent records (deposits, transactions, memberships, referrals)',
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  listInvestments: {
    tags: ['Admin'],
    summary: 'List investments',
    description: 'Paginated list of all pool memberships with user and pool details',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'string' },
        limit: { type: 'string' },
      },
    },
  },
  listTransactions: {
    tags: ['Admin'],
    summary: 'List transactions',
    description: 'Paginated list of all transactions with optional type/status filters',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'string' },
        limit: { type: 'string' },
        type: { type: 'string', enum: ['DEPOSIT', 'WITHDRAWAL', 'REWARD', 'REFERRAL_BONUS', 'FEE'] },
        status: { type: 'string', enum: ['PENDING', 'SUCCESS', 'FAILED'] },
      },
    },
  },
  listReceipts: {
    tags: ['Admin'],
    summary: 'List receipt tokens',
    description: 'Paginated list of deposit-based receipt tokens',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'string' },
        limit: { type: 'string' },
      },
    },
  },
  getStats: {
    tags: ['Admin'],
    summary: 'Dashboard stats',
    description: 'Aggregated platform statistics (users, pools, transactions, deposits)',
  },
};

export default async function adminRoutes(fastify: FastifyInstance) {
  // ─── GET /admin/users — list all users with search & pagination ─────
  fastify.get<{
    Querystring: { page?: string; limit?: string; search?: string };
  }>(
    '/users',
    { schema: adminSchemas.listUsers, preHandler: [adminMiddleware] },
    async (request) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = parseInt(request.query.limit || '15', 10);
      const search = request.query.search || '';
      const skip = (page - 1) * limit;

      const where = search
        ? {
            OR: [
              { walletAddress: { contains: search, mode: 'insensitive' as const } },
              { username: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            walletAddress: true,
            username: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      return { users, total, page, limit };
    }
  );

  // ─── GET /admin/users/:id — get single user detail ─────
  fastify.get<{ Params: { id: string } }>(
    '/users/:id',
    { schema: adminSchemas.getUser, preHandler: [adminMiddleware] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.params.id },
        include: {
          poolMemberships: { include: { pool: true } },
          transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
          deposits: { orderBy: { createdAt: 'desc' }, take: 20 },
          referrals: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      const { passwordHash, nonce, ...safeUser } = user;
      return { success: true, user: safeUser };
    }
  );

  // ─── PUT /admin/users/:id — update user ─────
  fastify.put<{
    Params: { id: string };
    Body: { username?: string; email?: string; role?: string; isActive?: boolean };
  }>(
    '/users/:id',
    { schema: adminSchemas.updateUser, preHandler: [adminMiddleware] },
    async (request, reply) => {
      const { username, email, role, isActive } = request.body;
      const existing = await prisma.user.findUnique({ where: { id: request.params.id } });

      if (!existing) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      const user = await prisma.user.update({
        where: { id: request.params.id },
        data: {
          ...(username !== undefined && { username }),
          ...(email !== undefined && { email }),
          ...(role !== undefined && { role: role as 'USER' | 'ADMIN' | 'MODERATOR' }),
          ...(isActive !== undefined && { isActive }),
        },
        select: {
          id: true,
          walletAddress: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
      });

      return { success: true, user };
    }
  );

  // ─── DELETE /admin/users/:id — delete user ─────
  fastify.delete<{ Params: { id: string } }>(
    '/users/:id',
    { schema: adminSchemas.deleteUser, preHandler: [adminMiddleware] },
    async (request, reply) => {
      const existing = await prisma.user.findUnique({ where: { id: request.params.id } });

      if (!existing) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      // Prevent self-deletion
      if (existing.id === request.userId) {
        return reply.status(400).send({ success: false, error: 'Cannot delete your own account' });
      }

      // Delete dependent records first
      await prisma.transaction.deleteMany({ where: { userId: request.params.id } });
      await prisma.deposit.deleteMany({ where: { userId: request.params.id } });
      await prisma.poolMember.deleteMany({ where: { userId: request.params.id } });
      await prisma.referral.deleteMany({ where: { OR: [{ referrerId: request.params.id }, { referredId: request.params.id }] } });
      await prisma.user.delete({ where: { id: request.params.id } });

      return { success: true, message: 'User deleted' };
    }
  );

  // ─── GET /admin/investments — all pool memberships ─────
  fastify.get<{
    Querystring: { page?: string; limit?: string };
  }>(
    '/investments',
    { schema: adminSchemas.listInvestments, preHandler: [adminMiddleware] },
    async (request) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = parseInt(request.query.limit || '20', 10);
      const skip = (page - 1) * limit;

      const [investments, total] = await Promise.all([
        prisma.poolMember.findMany({
          skip,
          take: limit,
          orderBy: { joinedAt: 'desc' },
          include: {
            user: { select: { id: true, walletAddress: true, username: true } },
            pool: { select: { id: true, name: true, tokenSymbol: true, apy: true, status: true } },
          },
        }),
        prisma.poolMember.count(),
      ]);

      return { investments, total, page, limit };
    }
  );

  // ─── GET /admin/transactions — all transactions ─────
  fastify.get<{
    Querystring: { page?: string; limit?: string; type?: string; status?: string };
  }>(
    '/transactions',
    { schema: adminSchemas.listTransactions, preHandler: [adminMiddleware] },
    async (request) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = parseInt(request.query.limit || '20', 10);
      const type = request.query.type;
      const status = request.query.status;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (type) where.type = type;
      if (status) where.status = status;

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, walletAddress: true, username: true } },
          },
        }),
        prisma.transaction.count({ where }),
      ]);

      return { transactions, total, page, limit };
    }
  );

  // ─── GET /admin/receipts — deposit-based receipt tokens ─────
  fastify.get<{
    Querystring: { page?: string; limit?: string };
  }>(
    '/receipts',
    { schema: adminSchemas.listReceipts, preHandler: [adminMiddleware] },
    async (request) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = parseInt(request.query.limit || '20', 10);
      const skip = (page - 1) * limit;

      const [deposits, total] = await Promise.all([
        prisma.deposit.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, walletAddress: true, username: true } },
            pool: { select: { id: true, name: true, tokenSymbol: true } },
          },
        }),
        prisma.deposit.count(),
      ]);

      // Map deposits to receipt tokens
      const receipts = deposits.map((d, idx) => ({
        id: d.id,
        tokenId: `CLB-R-${d.id.slice(0, 8).toUpperCase()}`,
        holder: d.user.walletAddress,
        holderName: d.user.username,
        poolName: d.pool?.name ?? 'N/A',
        poolSymbol: d.pool?.tokenSymbol ?? '',
        amount: Number(d.amount),
        txHash: d.txHash,
        status: d.status,
        mintedAt: d.createdAt,
      }));

      return { receipts, total, page, limit };
    }
  );

  // ─── GET /admin/stats — aggregated dashboard stats ─────
  fastify.get(
    '/stats',
    { schema: adminSchemas.getStats, preHandler: [adminMiddleware] },
    async () => {
      const [totalUsers, activeUsers, totalPools, totalTransactions, totalDeposits, activeLoans, settledLoans, liquidatedLoans] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.pool.count(),
        prisma.transaction.count(),
        prisma.deposit.count(),
        prisma.loan.count({ where: { status: 'ACTIVE' } }),
        prisma.loan.count({ where: { status: 'SETTLED' } }),
        prisma.loan.count({ where: { status: 'LIQUIDATED' } }),
      ]);

      return {
        success: true,
        stats: { totalUsers, activeUsers, totalPools, totalTransactions, totalDeposits, activeLoans, settledLoans, liquidatedLoans },
      };
    }
  );

  // ─── GET /admin/liquidation/monitor — active loans monitoring ─────
  fastify.get(
    '/liquidation/monitor',
    { preHandler: [adminMiddleware] },
    async () => {
      const summary = await liquidationService.getMonitoringSummary();
      return {
        success: true,
        activeLoans: summary.length,
        loans: summary,
      };
    }
  );

  // ─── POST /admin/liquidation/check — force price check now ─────
  fastify.post(
    '/liquidation/check',
    { preHandler: [adminMiddleware] },
    async () => {
      const result = await liquidationService.checkAllLoans();
      return {
        success: true,
        result,
      };
    }
  );

  // ─── POST /admin/liquidation/settle/:loanId — manual settlement ─────
  fastify.post<{ Params: { loanId: string } }>(
    '/liquidation/settle/:loanId',
    { preHandler: [adminMiddleware] },
    async (request, reply) => {
      const { loanId } = request.params;
      const result = await liquidationService.manualSettle(loanId);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return result;
    }
  );
}
