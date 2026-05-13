import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Prisma, LoanStatus } from '@prisma/client';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { liquidationService } from '../services/liquidationService';
import { serializePoolPublic } from '../services/poolSerialization';
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
  listDeposits: {
    tags: ['Admin'],
    summary: 'List all deposits',
    description: 'Paginated list of all deposits with optional search',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'string', description: 'Page number' },
        limit: { type: 'string', description: 'Items per page' },
        search: { type: 'string', description: 'Search by wallet address or tx hash' },
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
        depositMinUsd: { type: ['number', 'null'], description: 'Minimum USDT deposit amount in USD; null uses server env default' },
      },
    },
  },
  listPoolPackages: {
    tags: ['Admin'],
    summary: 'List pool packages',
    description:
      'Full pool rows for admin (dashboard). There is no fixed pool count — create/edit via POST/PUT /api/pools as admin. Fields: claim fee (creditMinUsd or minDeposit), loan credit (creditCreditedUsd).',
  },
  patchUserCredits: {
    tags: ['Admin'],
    summary: 'Set user in-app credit balances',
    description:
      'Sets deposit / loan / swap-hold USD balances (absolute values). Logs an audit row on transactions. At least one field required.',
    params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    body: {
      type: 'object',
      properties: {
        depositCreditUsd: { type: 'number', description: 'In-app deposit credit (USD)' },
        claimedPoolCreditUsd: { type: 'number', description: 'Loan / claimed pool credit (USD)' },
        swapHoldingsUsd: { type: 'number', description: 'Swap holdings (USD)' },
      },
    },
  },
  updateUserLoan: {
    tags: ['Admin'],
    summary: 'Update a user loan',
    description:
      'Adjust loan line amounts, LTV, interest, or status. At least one field required. Loan must belong to the user.',
    params: {
      type: 'object',
      properties: { userId: { type: 'string' }, loanId: { type: 'string' } },
      required: ['userId', 'loanId'],
    },
    body: {
      type: 'object',
      properties: {
        loanAmount: { type: 'number' },
        drawnAmount: { type: 'number' },
        availableCredit: { type: 'number' },
        interestRate: { type: 'number' },
        ltvPercent: { type: 'number' },
        status: {
          type: 'string',
          enum: [
            'PENDING',
            'ACTIVE',
            'SETTLED',
            'LIQUIDATED',
            'CANCELLED',
            'REPAID',
            'MARGIN_CALL',
          ],
        },
      },
    },
  },
  upsertUserMining: {
    tags: ['Admin'],
    summary: 'Create or update mining subscription',
    description:
      'Assign mining package (engine) and payout address. To create a new subscription both packageId and payoutAddress are required.',
    params: { type: 'object', properties: { userId: { type: 'string' } }, required: ['userId'] },
    body: {
      type: 'object',
      properties: {
        packageId: { type: 'string' },
        payoutAddress: { type: 'string' },
      },
    },
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

      const [rows, total] = await Promise.all([
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
            depositCreditUsd: true,
            claimedPoolCreditUsd: true,
            swapHoldingsUsd: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      const users = rows.map((u) => ({
        ...u,
        depositCreditUsd: Number(u.depositCreditUsd),
        claimedPoolCreditUsd: Number(u.claimedPoolCreditUsd),
        swapHoldingsUsd: Number(u.swapHoldingsUsd),
      }));

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
          transactions: { orderBy: { createdAt: 'desc' }, take: 100 },
          deposits: {
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: { pool: { select: { id: true, name: true, tokenSymbol: true } } },
          },
          referrals: {
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
          },
          referredBy: {
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
          },
          loans: { orderBy: { updatedAt: 'desc' }, take: 40 },
          miningSubscription: { include: { package: true } },
          tokenBalances: true,
          creditDraws: {
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { loan: { select: { id: true, loanType: true, status: true } } },
          },
        },
      });

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      const {
        passwordHash,
        nonce,
        pinHash,
        pinSalt,
        secretKey,
        secretKeyIv,
        ...safeUser
      } = user;
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

      if (isActive === false && existing.id === request.userId) {
        return reply.status(400).send({
          success: false,
          error: 'You cannot deactivate your own account while signed in',
        });
      }

      const normUsername =
        username === undefined ? undefined : username.trim() === '' ? null : username.trim();
      const normEmail =
        email === undefined ? undefined : email.trim() === '' ? null : email.trim();

      try {
        const user = await prisma.user.update({
          where: { id: request.params.id },
          data: {
            ...(normUsername !== undefined && { username: normUsername }),
            ...(normEmail !== undefined && { email: normEmail }),
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
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return reply.status(409).send({
            success: false,
            error: 'That email is already used by another account',
          });
        }
        throw err;
      }
    }
  );

  // ─── POST /admin/users/:id/credit-balances — set in-app USD credits ─────
  fastify.post<{
    Params: { id: string };
    Body: {
      depositCreditUsd?: number;
      claimedPoolCreditUsd?: number;
      swapHoldingsUsd?: number;
    };
  }>(
    '/users/:id/credit-balances',
    { schema: adminSchemas.patchUserCredits, preHandler: [adminMiddleware] },
    async (request, reply) => {
      const targetId = request.params.id;
      const b = request.body || {};
      const hasAny =
        b.depositCreditUsd !== undefined ||
        b.claimedPoolCreditUsd !== undefined ||
        b.swapHoldingsUsd !== undefined;
      if (!hasAny) {
        return reply.status(400).send({
          success: false,
          error: 'Provide at least one of depositCreditUsd, claimedPoolCreditUsd, swapHoldingsUsd',
        });
      }

      const check = (v: number | undefined, name: string): string | null => {
        if (v === undefined) return null;
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
          return `${name} must be a non-negative finite number`;
        }
        return null;
      };
      const err =
        check(b.depositCreditUsd, 'depositCreditUsd') ||
        check(b.claimedPoolCreditUsd, 'claimedPoolCreditUsd') ||
        check(b.swapHoldingsUsd, 'swapHoldingsUsd');
      if (err) {
        return reply.status(400).send({ success: false, error: err });
      }

      const existing = await prisma.user.findUnique({ where: { id: targetId } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      const before = {
        depositCreditUsd: Number(existing.depositCreditUsd),
        claimedPoolCreditUsd: Number(existing.claimedPoolCreditUsd),
        swapHoldingsUsd: Number(existing.swapHoldingsUsd),
      };

      const data: Prisma.UserUpdateInput = {};
      if (b.depositCreditUsd !== undefined) {
        data.depositCreditUsd = new Prisma.Decimal(b.depositCreditUsd);
      }
      if (b.claimedPoolCreditUsd !== undefined) {
        data.claimedPoolCreditUsd = new Prisma.Decimal(b.claimedPoolCreditUsd);
      }
      if (b.swapHoldingsUsd !== undefined) {
        data.swapHoldingsUsd = new Prisma.Decimal(b.swapHoldingsUsd);
      }

      const afterDeposit = b.depositCreditUsd ?? before.depositCreditUsd;
      const afterClaimed = b.claimedPoolCreditUsd ?? before.claimedPoolCreditUsd;
      const afterSwap = b.swapHoldingsUsd ?? before.swapHoldingsUsd;
      const deltaSum =
        Math.abs(afterDeposit - before.depositCreditUsd) +
        Math.abs(afterClaimed - before.claimedPoolCreditUsd) +
        Math.abs(afterSwap - before.swapHoldingsUsd);

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: targetId },
          data,
          select: {
            id: true,
            walletAddress: true,
            username: true,
            email: true,
            depositCreditUsd: true,
            claimedPoolCreditUsd: true,
            swapHoldingsUsd: true,
          },
        });

        await tx.transaction.create({
          data: {
            userId: targetId,
            type: 'TRANSFER',
            amount: new Prisma.Decimal(deltaSum > 0 ? deltaSum : 0),
            status: 'SUCCESS',
            metadata: {
              kind: 'ADMIN_CREDIT_BALANCE',
              adminUserId: request.userId,
              before,
              after: {
                depositCreditUsd: Number(u.depositCreditUsd),
                claimedPoolCreditUsd: Number(u.claimedPoolCreditUsd),
                swapHoldingsUsd: Number(u.swapHoldingsUsd),
              },
            },
          },
        });

        return u;
      });

      return {
        success: true,
        balances: {
          depositCreditUsd: Number(updated.depositCreditUsd),
          claimedPoolCreditUsd: Number(updated.claimedPoolCreditUsd),
          swapHoldingsUsd: Number(updated.swapHoldingsUsd),
        },
        user: {
          id: updated.id,
          walletAddress: updated.walletAddress,
          username: updated.username,
          email: updated.email,
        },
      };
    }
  );

  // ─── PUT /admin/users/:userId/loans/:loanId — admin adjust loan ─────
  fastify.put<{
    Params: { userId: string; loanId: string };
    Body: {
      loanAmount?: number;
      drawnAmount?: number;
      availableCredit?: number;
      interestRate?: number;
      ltvPercent?: number;
      status?: LoanStatus;
    };
  }>(
    '/users/:userId/loans/:loanId',
    { schema: adminSchemas.updateUserLoan, preHandler: [adminMiddleware] },
    async (request, reply) => {
      const { userId, loanId } = request.params;
      const b = request.body || {};
      const hasAny =
        b.loanAmount !== undefined ||
        b.drawnAmount !== undefined ||
        b.availableCredit !== undefined ||
        b.interestRate !== undefined ||
        b.ltvPercent !== undefined ||
        b.status !== undefined;
      if (!hasAny) {
        return reply.status(400).send({
          success: false,
          error: 'Provide at least one field to update',
        });
      }

      const nonNeg = (v: number | undefined, name: string): string | null => {
        if (v === undefined) return null;
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
          return `${name} must be a non-negative finite number`;
        }
        return null;
      };
      const err =
        nonNeg(b.loanAmount, 'loanAmount') ||
        nonNeg(b.drawnAmount, 'drawnAmount') ||
        nonNeg(b.availableCredit, 'availableCredit') ||
        nonNeg(b.interestRate, 'interestRate') ||
        nonNeg(b.ltvPercent, 'ltvPercent');
      if (err) {
        return reply.status(400).send({ success: false, error: err });
      }

      const loan = await prisma.loan.findFirst({
        where: { id: loanId, userId },
      });
      if (!loan) {
        return reply.status(404).send({ success: false, error: 'Loan not found for this user' });
      }

      const before = {
        loanAmount: Number(loan.loanAmount),
        drawnAmount: Number(loan.drawnAmount),
        availableCredit: Number(loan.availableCredit),
        interestRate: Number(loan.interestRate),
        ltvPercent: Number(loan.ltvPercent),
        status: loan.status,
      };

      const data: Prisma.LoanUpdateInput = {};
      if (b.loanAmount !== undefined) data.loanAmount = new Prisma.Decimal(b.loanAmount);
      if (b.drawnAmount !== undefined) data.drawnAmount = new Prisma.Decimal(b.drawnAmount);
      if (b.availableCredit !== undefined) {
        data.availableCredit = new Prisma.Decimal(b.availableCredit);
      }
      if (b.interestRate !== undefined) data.interestRate = new Prisma.Decimal(b.interestRate);
      if (b.ltvPercent !== undefined) data.ltvPercent = new Prisma.Decimal(b.ltvPercent);
      if (b.status !== undefined) data.status = b.status;

      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.loan.update({
          where: { id: loanId },
          data,
        });
        await tx.transaction.create({
          data: {
            userId,
            type: 'LOAN',
            amount: new Prisma.Decimal(0),
            status: 'SUCCESS',
            metadata: {
              kind: 'ADMIN_LOAN_UPDATE',
              adminUserId: request.userId,
              loanId,
              before,
              after: {
                loanAmount: Number(row.loanAmount),
                drawnAmount: Number(row.drawnAmount),
                availableCredit: Number(row.availableCredit),
                interestRate: Number(row.interestRate),
                ltvPercent: Number(row.ltvPercent),
                status: row.status,
              },
            },
          },
        });
        return row;
      });

      return {
        success: true,
        loan: {
          id: updated.id,
          loanType: updated.loanType,
          status: updated.status,
          collateralChain: updated.collateralChain,
          loanAmount: Number(updated.loanAmount),
          drawnAmount: Number(updated.drawnAmount),
          availableCredit: Number(updated.availableCredit),
          interestRate: Number(updated.interestRate),
          ltvPercent: Number(updated.ltvPercent),
        },
      };
    }
  );

  // ─── PUT /admin/users/:userId/mining-subscription ─────
  fastify.put<{
    Params: { userId: string };
    Body: { packageId?: string; payoutAddress?: string };
  }>(
    '/users/:userId/mining-subscription',
    { schema: adminSchemas.upsertUserMining, preHandler: [adminMiddleware] },
    async (request, reply) => {
      const { userId } = request.params;
      const { packageId, payoutAddress } = request.body || {};

      const userRow = await prisma.user.findUnique({ where: { id: userId } });
      if (!userRow) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      const existing = await prisma.userMiningSubscription.findUnique({
        where: { userId },
      });

      if (!existing) {
        const pid = packageId?.trim();
        const addr = payoutAddress?.trim();
        if (!pid || !addr) {
          return reply.status(400).send({
            success: false,
            error: 'packageId and payoutAddress are required to create a mining subscription',
          });
        }
        const pkg = await prisma.clbMiningPackage.findUnique({ where: { id: pid } });
        if (!pkg) {
          return reply.status(404).send({ success: false, error: 'Mining package not found' });
        }
        await prisma.userMiningSubscription.create({
          data: { userId, packageId: pid, payoutAddress: addr },
        });
      } else {
        if (packageId === undefined && payoutAddress === undefined) {
          return reply.status(400).send({
            success: false,
            error: 'Provide packageId and/or payoutAddress to update',
          });
        }
        const data: Prisma.UserMiningSubscriptionUpdateInput = {};
        if (packageId !== undefined) {
          const pid = packageId.trim();
          const pkg = await prisma.clbMiningPackage.findUnique({ where: { id: pid } });
          if (!pkg) {
            return reply.status(404).send({ success: false, error: 'Mining package not found' });
          }
          data.package = { connect: { id: pid } };
        }
        if (payoutAddress !== undefined) {
          data.payoutAddress = payoutAddress.trim();
        }
        await prisma.userMiningSubscription.update({
          where: { userId },
          data,
        });
      }

      const subscription = await prisma.userMiningSubscription.findUnique({
        where: { userId },
        include: { package: true },
      });

      return { success: true, subscription };
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

  // ─── GET /admin/deposits — all deposits ─────
  fastify.get<{
    Querystring: { page?: string; limit?: string; search?: string };
  }>(
    '/deposits',
    { schema: adminSchemas.listDeposits, preHandler: [adminMiddleware] },
    async (request) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = parseInt(request.query.limit || '20', 10);
      const search = request.query.search || '';
      const skip = (page - 1) * limit;

      const where = search
        ? {
            OR: [
              { fromAddress: { contains: search, mode: 'insensitive' as const } },
              { toAddress: { contains: search, mode: 'insensitive' as const } },
              { txHash: { contains: search, mode: 'insensitive' as const } },
              { user: { walletAddress: { contains: search, mode: 'insensitive' as const } } },
            ],
          }
        : {};

      const [deposits, total] = await Promise.all([
        prisma.deposit.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, walletAddress: true, username: true } },
            pool: { select: { id: true, name: true, tokenSymbol: true } },
          },
        }),
        prisma.deposit.count({ where }),
      ]);

      const formatted = deposits.map((d) => ({
        id: d.id,
        amount: Number(d.amount),
        amountUsd: Number(d.amountUsd),
        chain: d.chain,
        fromAddress: d.fromAddress,
        toAddress: d.toAddress,
        txHash: d.txHash,
        status: d.status,
        confirmations: d.confirmations,
        confirmedAt: d.confirmedAt,
        createdAt: d.createdAt,
        user: d.user,
        pool: d.pool,
      }));

      return { deposits: formatted, total, page, limit };
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
          depositMinUsd: settings.depositMinUsd ? Number(settings.depositMinUsd) : null,
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
      depositMinUsd?: number | null;
    };
  }>(
    '/settings',
    { schema: adminSchemas.updateSettings, preHandler: [adminMiddleware] },
    async (request, reply) => {
      const b = request.body || {};
      if (
        b.freePoolsEnabled === undefined &&
        b.depositTreasuryAddress === undefined &&
        b.usdtBep20Address === undefined &&
        b.depositMinUsd === undefined
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
          ...(b.depositMinUsd !== undefined && { depositMinUsd: b.depositMinUsd }),
        },
        create: {
          id: 'default',
          freePoolsEnabled: b.freePoolsEnabled ?? false,
          ...(b.depositTreasuryAddress !== undefined && {
            depositTreasuryAddress: b.depositTreasuryAddress,
          }),
          ...(b.usdtBep20Address !== undefined && { usdtBep20Address: b.usdtBep20Address }),
          ...(b.depositMinUsd !== undefined && { depositMinUsd: b.depositMinUsd }),
        },
      });

      return {
        success: true,
        settings: {
          freePoolsEnabled: settings.freePoolsEnabled,
          depositTreasuryAddress: settings.depositTreasuryAddress,
          usdtBep20Address: settings.usdtBep20Address,
          depositMinUsd: settings.depositMinUsd ? Number(settings.depositMinUsd) : null,
        },
      };
    }
  );

  // ─── GET /admin/withdrawals — list all withdrawal requests ─────
  fastify.get<{
    Querystring: { page?: string; limit?: string; status?: string };
  }>(
    '/withdrawals',
    { preHandler: [adminMiddleware] },
    async (request) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = parseInt(request.query.limit || '20', 10);
      const status = request.query.status;
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};
      if (status) where.status = status;

      const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, walletAddress: true, username: true, email: true } },
          },
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
          user: w.user,
        })),
        total,
        page,
        limit,
      };
    }
  );

  // ─── PUT /admin/withdrawals/:id/approve — mark withdrawal as completed ─────
  fastify.put<{
    Params: { id: string };
    Body: { txHash?: string };
  }>(
    '/withdrawals/:id/approve',
    { preHandler: [adminMiddleware] },
    async (request, reply) => {
      const { id } = request.params;
      const { txHash } = request.body || {};

      const withdrawal = await prisma.withdrawal.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!withdrawal) {
        return reply.status(404).send({ success: false, error: 'Withdrawal not found' });
      }
      if (withdrawal.status !== 'PENDING') {
        return reply.status(400).send({
          success: false,
          error: `Cannot approve a withdrawal with status "${withdrawal.status}"`,
        });
      }

      const netAmount = Number(withdrawal.amount) - Number(withdrawal.fee);
      const { isPlatformToken } = await import('../config/tokens');
      const isPlatform = isPlatformToken(withdrawal.token);

      await prisma.$transaction(async (tx) => {
        await tx.withdrawal.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            txHash: txHash || null,
            processedAt: new Date(),
          },
        });

        if (isPlatform) {
          await tx.tokenBalance.update({
            where: { userId_token: { userId: withdrawal.userId, token: withdrawal.token } },
            data: {
              balance: { decrement: Number(withdrawal.amount) },
              locked: { decrement: Number(withdrawal.amount) },
            },
          });
        }

        await tx.transaction.updateMany({
          where: {
            userId: withdrawal.userId,
            type: 'WITHDRAWAL',
            status: 'PENDING',
            metadata: { path: ['withdrawalId'], equals: id },
          },
          data: { status: 'SUCCESS', txHash: txHash || null },
        });

        await tx.notification.create({
          data: {
            userId: withdrawal.userId,
            type: 'WITHDRAWAL',
            title: `${withdrawal.token} Withdrawal Approved`,
            body: `Your withdrawal of ${netAmount.toFixed(6)} ${withdrawal.token} to ${withdrawal.toAddress.slice(0, 8)}...${withdrawal.toAddress.slice(-4)} has been processed.`,
            data: { withdrawalId: id, token: withdrawal.token, amount: Number(withdrawal.amount), netAmount, txHash },
          },
        });
      });

      return { success: true, message: 'Withdrawal approved and marked as completed' };
    }
  );

  // ─── PUT /admin/withdrawals/:id/reject — reject a withdrawal request ─────
  fastify.put<{
    Params: { id: string };
    Body: { reason?: string };
  }>(
    '/withdrawals/:id/reject',
    { preHandler: [adminMiddleware] },
    async (request, reply) => {
      const { id } = request.params;
      const { reason } = request.body || {};

      const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
      if (!withdrawal) {
        return reply.status(404).send({ success: false, error: 'Withdrawal not found' });
      }
      if (withdrawal.status !== 'PENDING') {
        return reply.status(400).send({
          success: false,
          error: `Cannot reject a withdrawal with status "${withdrawal.status}"`,
        });
      }

      const { isPlatformToken } = await import('../config/tokens');
      const isPlatform = isPlatformToken(withdrawal.token);

      await prisma.$transaction(async (tx) => {
        await tx.withdrawal.update({
          where: { id },
          data: { status: 'REJECTED', processedAt: new Date() },
        });

        if (isPlatform) {
          await tx.tokenBalance.update({
            where: { userId_token: { userId: withdrawal.userId, token: withdrawal.token } },
            data: { locked: { decrement: Number(withdrawal.amount) } },
          });
        }

        await tx.transaction.updateMany({
          where: {
            userId: withdrawal.userId,
            type: 'WITHDRAWAL',
            status: 'PENDING',
            metadata: { path: ['withdrawalId'], equals: id },
          },
          data: { status: 'FAILED' },
        });

        await tx.notification.create({
          data: {
            userId: withdrawal.userId,
            type: 'WITHDRAWAL',
            title: 'Withdrawal Rejected',
            body: reason
              ? `Your withdrawal request was rejected: ${reason}`
              : 'Your withdrawal request was rejected. Please contact support for more information.',
            data: { withdrawalId: id, reason: reason || null },
          },
        });
      });

      return { success: true, message: 'Withdrawal rejected' };
    }
  );

  // ─── GET /admin/pool-packages — all pools for package editor ─────
  fastify.get(
    '/pool-packages',
    { schema: adminSchemas.listPoolPackages, preHandler: [adminMiddleware] },
    async () => {
      const rows = await prisma.pool.findMany({
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { members: true } } },
      });
      const pools = rows.map((p) => serializePoolPublic(p));
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
  const miningTokens = ['CLB'] as const;

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
        return reply.status(400).send({ success: false, error: 'tokenSymbol must be CLB' });
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
