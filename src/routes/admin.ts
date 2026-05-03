import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';

// Admin-only middleware
async function adminMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await authMiddleware(request, reply);
  if (reply.sent) return;

  const user = await prisma.user.findUnique({
    where: { id: request.userId },
    select: { role: true },
  });

  if (!user || user.role !== 'ADMIN') {
    reply.status(403).send({ success: false, error: 'Forbidden — admin access required' });
  }
}

export default async function adminRoutes(fastify: FastifyInstance) {
  // ─── GET /admin/users — list all users with search & pagination ─────
  fastify.get<{
    Querystring: { page?: string; limit?: string; search?: string };
  }>(
    '/users',
    { preHandler: [adminMiddleware] },
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
    { preHandler: [adminMiddleware] },
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
    { preHandler: [adminMiddleware] },
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
    { preHandler: [adminMiddleware] },
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
    { preHandler: [adminMiddleware] },
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
    { preHandler: [adminMiddleware] },
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

  // ─── GET /admin/stats — aggregated dashboard stats ─────
  fastify.get(
    '/stats',
    { preHandler: [adminMiddleware] },
    async () => {
      const [totalUsers, activeUsers, totalPools, totalTransactions, totalDeposits] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.pool.count(),
        prisma.transaction.count(),
        prisma.deposit.count(),
      ]);

      return {
        success: true,
        stats: { totalUsers, activeUsers, totalPools, totalTransactions, totalDeposits },
      };
    }
  );
}
