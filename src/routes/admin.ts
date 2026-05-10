import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { liquidationService } from '../services/liquidationService';
import { serializeMiningPackage } from './miningPackages';
import type { MiningPackagePeriodUnit } from '@prisma/client';

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
  getSettings: {
    tags: ['Admin'],
    summary: 'Get platform settings',
    description: 'Returns global platform configuration flags',
  },
  updateSettings: {
    tags: ['Admin'],
    summary: 'Update platform settings',
    description: 'Updates global platform configuration (merge any provided fields)',
    body: {
      type: 'object',
      properties: {
        freePoolsEnabled: { type: 'boolean' },
        depositTreasuryAddress: { type: ['string', 'null'], description: 'BEP-20 address where users send USDT (Receive flow)' },
        usdtBep20Address: { type: ['string', 'null'], description: 'USDT contract on BSC; null uses server env default' },
      },
    },
  },
  listPoolPackages: {
    tags: ['Admin'],
    summary: 'List pool packages',
    description:
      'Full pool rows for admin (dashboard). There is no fixed pool count — create/edit via POST/PUT /api/pools as admin. Fields: claim fee (creditMinUsd or minDeposit), loan credit (creditCreditedUsd).',
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

  // ─── GET /admin/settings — platform settings ─────
  fastify.get(
    '/settings',
    { schema: adminSchemas.getSettings, preHandler: [adminMiddleware] },
    async () => {
      const settings = await prisma.platformSettings.upsert({
        where: { id: 'default' },
        update: {},
        create: {
          id: 'default',
          freePoolsEnabled: false,
        },
      });

      return {
        success: true,
        settings: {
          freePoolsEnabled: settings.freePoolsEnabled,
          depositTreasuryAddress: settings.depositTreasuryAddress,
          usdtBep20Address: settings.usdtBep20Address,
        },
      };
    }
  );

  // ─── PUT /admin/settings — update platform settings ─────
  fastify.put<{
    Body: {
      freePoolsEnabled?: boolean;
      depositTreasuryAddress?: string | null;
      usdtBep20Address?: string | null;
    };
  }>(
    '/settings',
    { schema: adminSchemas.updateSettings, preHandler: [adminMiddleware] },
    async (request, reply) => {
      const b = request.body || {};
      if (
        b.freePoolsEnabled === undefined &&
        b.depositTreasuryAddress === undefined &&
        b.usdtBep20Address === undefined
      ) {
        return reply.status(400).send({
          success: false,
          error: 'Provide at least one setting to update',
        });
      }

      const settings = await prisma.platformSettings.upsert({
        where: { id: 'default' },
        update: {
          ...(b.freePoolsEnabled !== undefined && { freePoolsEnabled: b.freePoolsEnabled }),
          ...(b.depositTreasuryAddress !== undefined && {
            depositTreasuryAddress: b.depositTreasuryAddress,
          }),
          ...(b.usdtBep20Address !== undefined && { usdtBep20Address: b.usdtBep20Address }),
        },
        create: {
          id: 'default',
          freePoolsEnabled: b.freePoolsEnabled ?? false,
          ...(b.depositTreasuryAddress !== undefined && {
            depositTreasuryAddress: b.depositTreasuryAddress,
          }),
          ...(b.usdtBep20Address !== undefined && { usdtBep20Address: b.usdtBep20Address }),
        },
      });

      return {
        success: true,
        settings: {
          freePoolsEnabled: settings.freePoolsEnabled,
          depositTreasuryAddress: settings.depositTreasuryAddress,
          usdtBep20Address: settings.usdtBep20Address,
        },
      };
    }
  );

  // ─── GET /admin/pool-packages — all pools for package editor ─────
  fastify.get(
    '/pool-packages',
    { schema: adminSchemas.listPoolPackages, preHandler: [adminMiddleware] },
    async () => {
      const rows = await prisma.pool.findMany({
        orderBy: { updatedAt: 'desc' },
      });
      const pools = rows.map((p) => ({
        ...p,
        minDeposit: Number(p.minDeposit),
        maxDeposit: p.maxDeposit != null ? Number(p.maxDeposit) : null,
        apy: Number(p.apy),
        totalStaked: Number(p.totalStaked),
        creditMinUsd: p.creditMinUsd != null ? Number(p.creditMinUsd) : null,
        creditCreditedUsd: p.creditCreditedUsd != null ? Number(p.creditCreditedUsd) : null,
      }));
      return { success: true, count: pools.length, pools };
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

  const miningPeriodUnits: MiningPackagePeriodUnit[] = ['MINUTE', 'HOUR', 'DAY'];
  const miningTokens = ['CLB', 'CLBg', 'CLBs'] as const;

  function parseMiningPeriodUnit(v: string): MiningPackagePeriodUnit | null {
    const u = String(v || '').toUpperCase();
    return miningPeriodUnits.includes(u as MiningPackagePeriodUnit) ? (u as MiningPackagePeriodUnit) : null;
  }

  // ─── CLB mining machine packages ─────────────────────────────
  fastify.get('/mining-packages', { preHandler: [adminMiddleware] }, async () => {
    const rows = await prisma.clbMiningPackage.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    return { success: true, packages: rows.map(serializeMiningPackage) };
  });

  fastify.post<{
    Body: {
      name: string;
      description?: string | null;
      tokenSymbol?: string;
      tokensPerPeriod: number;
      periodLength: number;
      periodUnit: string;
      isFree?: boolean;
      priceUsd?: number | null;
      sortOrder?: number;
      isActive?: boolean;
    };
  }>('/mining-packages', { preHandler: [adminMiddleware] }, async (request, reply) => {
    const b = request.body;
    if (!b?.name || typeof b.name !== 'string' || !b.name.trim()) {
      return reply.status(400).send({ success: false, error: 'Package name is required' });
    }
    const tpp = Number(b.tokensPerPeriod);
    if (!Number.isFinite(tpp) || tpp <= 0) {
      return reply.status(400).send({ success: false, error: 'tokensPerPeriod must be a positive number' });
    }
    const pl = parseInt(String(b.periodLength), 10);
    if (!Number.isFinite(pl) || pl < 1) {
      return reply.status(400).send({ success: false, error: 'periodLength must be a positive integer' });
    }
    const unit = parseMiningPeriodUnit(b.periodUnit);
    if (!unit) {
      return reply.status(400).send({ success: false, error: 'periodUnit must be MINUTE, HOUR, or DAY' });
    }
    const sym = (b.tokenSymbol?.trim() || 'CLB') as string;
    const tokenSymbol = miningTokens.includes(sym as (typeof miningTokens)[number]) ? sym : 'CLB';
    const isFree = Boolean(b.isFree);
    if (!isFree) {
      const p = b.priceUsd;
      if (p != null && (typeof p !== 'number' || !Number.isFinite(p) || p < 0)) {
        return reply.status(400).send({ success: false, error: 'priceUsd must be a non-negative number when not free' });
      }
    }

    const row = await prisma.clbMiningPackage.create({
      data: {
        name: b.name.trim(),
        description: b.description?.trim() || null,
        tokenSymbol,
        tokensPerPeriod: new Prisma.Decimal(String(tpp)),
        periodLength: pl,
        periodUnit: unit,
        isFree,
        priceUsd: isFree ? null : new Prisma.Decimal(String(b.priceUsd ?? 0)),
        sortOrder: b.sortOrder ?? 0,
        isActive: b.isActive ?? true,
      },
    });
    return { success: true, package: serializeMiningPackage(row) };
  });

  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string;
      description?: string | null;
      tokenSymbol?: string;
      tokensPerPeriod?: number;
      periodLength?: number;
      periodUnit?: string;
      isFree?: boolean;
      priceUsd?: number | null;
      sortOrder?: number;
      isActive?: boolean;
    };
  }>('/mining-packages/:id', { preHandler: [adminMiddleware] }, async (request, reply) => {
    const existing = await prisma.clbMiningPackage.findUnique({ where: { id: request.params.id } });
    if (!existing) {
      return reply.status(404).send({ success: false, error: 'Package not found' });
    }
    const b = request.body;
    const data: Prisma.ClbMiningPackageUpdateInput = {};

    if (b.name !== undefined) {
      if (typeof b.name !== 'string' || !b.name.trim()) {
        return reply.status(400).send({ success: false, error: 'Invalid name' });
      }
      data.name = b.name.trim();
    }
    if (b.description !== undefined) {
      data.description = b.description === null || b.description === '' ? null : String(b.description).trim();
    }
    if (b.tokenSymbol !== undefined) {
      const sym = b.tokenSymbol.trim();
      if (!miningTokens.includes(sym as (typeof miningTokens)[number])) {
        return reply.status(400).send({ success: false, error: 'tokenSymbol must be CLB, CLBg, or CLBs' });
      }
      data.tokenSymbol = sym;
    }
    if (b.tokensPerPeriod !== undefined) {
      const tpp = Number(b.tokensPerPeriod);
      if (!Number.isFinite(tpp) || tpp <= 0) {
        return reply.status(400).send({ success: false, error: 'tokensPerPeriod must be positive' });
      }
      data.tokensPerPeriod = new Prisma.Decimal(String(tpp));
    }
    if (b.periodLength !== undefined) {
      const pl = parseInt(String(b.periodLength), 10);
      if (!Number.isFinite(pl) || pl < 1) {
        return reply.status(400).send({ success: false, error: 'periodLength must be a positive integer' });
      }
      data.periodLength = pl;
    }
    if (b.periodUnit !== undefined) {
      const unit = parseMiningPeriodUnit(b.periodUnit);
      if (!unit) {
        return reply.status(400).send({ success: false, error: 'periodUnit must be MINUTE, HOUR, or DAY' });
      }
      data.periodUnit = unit;
    }
    if (b.sortOrder !== undefined) {
      data.sortOrder = parseInt(String(b.sortOrder), 10) || 0;
    }
    if (b.isActive !== undefined) {
      data.isActive = Boolean(b.isActive);
    }
    if (b.isFree !== undefined) {
      data.isFree = Boolean(b.isFree);
    }
    if (b.priceUsd !== undefined) {
      const isFree = b.isFree !== undefined ? Boolean(b.isFree) : existing.isFree;
      if (isFree) {
        data.priceUsd = null;
      } else {
        const p = b.priceUsd;
        if (p != null && (typeof p !== 'number' || !Number.isFinite(p) || p < 0)) {
          return reply.status(400).send({ success: false, error: 'Invalid priceUsd' });
        }
        data.priceUsd = new Prisma.Decimal(String(p ?? 0));
      }
    } else if (b.isFree === true) {
      data.priceUsd = null;
    }

    if (b.isFree === false && b.priceUsd === undefined && data.priceUsd === undefined) {
      data.priceUsd = existing.priceUsd ?? new Prisma.Decimal(0);
    }

    const row = await prisma.clbMiningPackage.update({
      where: { id: request.params.id },
      data,
    });
    return { success: true, package: serializeMiningPackage(row) };
  });

  fastify.delete<{ Params: { id: string } }>(
    '/mining-packages/:id',
    { preHandler: [adminMiddleware] },
    async (request, reply) => {
      const existing = await prisma.clbMiningPackage.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Package not found' });
      }
      await prisma.clbMiningPackage.delete({ where: { id: request.params.id } });
      return { success: true, message: 'Package deleted' };
    }
  );
}
