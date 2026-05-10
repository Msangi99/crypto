import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { contractService } from '../services/contractService';
import { Prisma } from '@prisma/client';

// Swagger schemas
const schemas = {
  listPools: {
    tags: ['Pools'],
    summary: 'List all pools',
    description: 'Returns a paginated list of liquidity/staking pools',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1, minimum: 1 },
        limit: { type: 'integer', default: 10, minimum: 1, maximum: 100 },
        status: { type: 'string', enum: ['ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'] },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                description: { type: 'string', nullable: true },
                tokenSymbol: { type: 'string' },
                minDeposit: { type: 'number' },
                apy: { type: 'number' },
                totalStaked: { type: 'number' },
                status: { type: 'string' },
                startDate: { type: 'string' },
                memberCount: { type: 'integer' },
              },
            },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
        },
      },
    },
  },
  getPool: {
    tags: ['Pools'],
    summary: 'Get pool by ID',
    description: 'Returns detailed info for a single pool, including on-chain data if available',
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Pool UUID' },
      },
      required: ['id'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          pool: { type: 'object' },
          onChain: { type: 'object', nullable: true },
        },
      },
    },
  },
  createPool: {
    tags: ['Pools'],
    summary: 'Create a new pool (Admin)',
    description: 'Creates a new staking/liquidity pool. Requires admin privileges.',
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string' },
        tokenSymbol: { type: 'string', default: 'BNB' },
        minDeposit: { type: 'number', default: 0 },
        maxDeposit: { type: 'number', nullable: true },
        apy: { type: 'number', default: 0 },
        contractAddress: { type: 'string', nullable: true },
        endDate: { type: 'string', format: 'date-time', nullable: true },
      },
      required: ['name'],
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          pool: { type: 'object' },
        },
      },
    },
  },
  deposit: {
    tags: ['Pools'],
    summary: 'Record a deposit into a pool',
    description: 'Records a user deposit into a pool (the actual on-chain tx should be done by the client)',
    body: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        txHash: { type: 'string', description: 'Required unless free pool mode is enabled' },
      },
      required: ['amount'],
    },
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Pool ID' },
      },
      required: ['id'],
    },
    response: {
      201: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          deposit: { type: 'object' },
        },
      },
    },
  },
  poolStats: {
    tags: ['Pools'],
    summary: 'Get pool statistics',
    description: 'Returns aggregate pool statistics',
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          stats: {
            type: 'object',
            properties: {
              totalPools: { type: 'integer' },
              activePools: { type: 'integer' },
              totalValueLocked: { type: 'number' },
              totalMembers: { type: 'integer' },
            },
          },
        },
      },
    },
  },
  poolSettings: {
    tags: ['Pools'],
    summary: 'Get pool access settings',
    description: 'Returns global pool access mode flags used by clients',
  },
};

export default async function poolRoutes(fastify: FastifyInstance) {
  // GET /pools — list pools
  fastify.get<{ Querystring: { page?: number; limit?: number; status?: string } }>(
    '/',
    { schema: schemas.listPools },
    async (request, reply) => {
      const page = request.query.page || 1;
      const limit = request.query.limit || 10;
      const skip = (page - 1) * limit;

      const where: Prisma.PoolWhereInput = {};
      if (request.query.status) {
        where.status = request.query.status as any;
      }

      const [pools, total] = await Promise.all([
        prisma.pool.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { members: true } } },
        }),
        prisma.pool.count({ where }),
      ]);

      const data = pools.map((p) => ({
        ...p,
        memberCount: p._count.members,
        _count: undefined,
      }));

      return {
        success: true,
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // GET /pools/stats — aggregate stats
  fastify.get(
    '/stats',
    { schema: schemas.poolStats },
    async () => {
      const [totalPools, activePools, tvlResult, totalMembers] = await Promise.all([
        prisma.pool.count(),
        prisma.pool.count({ where: { status: 'ACTIVE' } }),
        prisma.pool.aggregate({ _sum: { totalStaked: true } }),
        prisma.poolMember.count(),
      ]);

      return {
        success: true,
        stats: {
          totalPools,
          activePools,
          totalValueLocked: Number(tvlResult._sum.totalStaked || 0),
          totalMembers,
        },
      };
    }
  );

  // GET /pools/settings — global pool access settings
  fastify.get(
    '/settings',
    { schema: schemas.poolSettings },
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
        },
      };
    }
  );

  // GET /pools/:id — single pool
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { schema: schemas.getPool },
    async (request, reply) => {
      const pool = await prisma.pool.findUnique({
        where: { id: request.params.id },
        include: {
          _count: { select: { members: true, deposits: true } },
        },
      });

      if (!pool) {
        return reply.status(404).send({ success: false, error: 'Pool not found' });
      }

      // Try to get on-chain data
      let onChain = null;
      if (pool.contractAddress) {
        try {
          onChain = await contractService.getPoolInfo(0); // pool index on-chain
        } catch {
          // On-chain data not available
        }
      }

      return { success: true, pool, onChain };
    }
  );

  // POST /pools — create pool (admin)
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      tokenSymbol?: string;
      minDeposit?: number;
      maxDeposit?: number;
      apy?: number;
      contractAddress?: string;
      endDate?: string;
    };
  }>(
    '/',
    { schema: schemas.createPool, preHandler: [authMiddleware] },
    async (request: FastifyRequest<{
      Body: {
        name: string;
        description?: string;
        tokenSymbol?: string;
        minDeposit?: number;
        maxDeposit?: number;
        apy?: number;
        contractAddress?: string;
        endDate?: string;
      };
    }>, reply: FastifyReply) => {
      // Check admin role
      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (!user || user.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: 'Admin access required' });
      }

      const { name, description, tokenSymbol, minDeposit, maxDeposit, apy, contractAddress, endDate } = request.body;

      const pool = await prisma.pool.create({
        data: {
          name,
          description,
          tokenSymbol: tokenSymbol || 'BNB',
          minDeposit: minDeposit || 0,
          maxDeposit,
          apy: apy || 0,
          contractAddress,
          endDate: endDate ? new Date(endDate) : undefined,
        },
      });

      return reply.status(201).send({ success: true, pool });
    }
  );

  // PUT /pools/:id — update pool (admin)
  fastify.put<{
    Params: { id: string };
    Body: {
      name?: string; description?: string; tokenSymbol?: string;
      minDeposit?: number; maxDeposit?: number; apy?: number;
      status?: string; endDate?: string;
      supportsAppCredit?: boolean;
      creditMinUsd?: number | null;
      creditCreditedUsd?: number | null;
    };
  }>(
    '/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (!user || user.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: 'Admin access required' });
      }

      const existing = await prisma.pool.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Pool not found' });
      }

      const {
        name,
        description,
        tokenSymbol,
        minDeposit,
        maxDeposit,
        apy,
        status,
        endDate,
        supportsAppCredit,
        creditMinUsd,
        creditCreditedUsd,
      } = request.body;

      const pool = await prisma.pool.update({
        where: { id: request.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(tokenSymbol !== undefined && { tokenSymbol }),
          ...(minDeposit !== undefined && { minDeposit }),
          ...(maxDeposit !== undefined && { maxDeposit }),
          ...(apy !== undefined && { apy }),
          ...(status !== undefined && { status: status as 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' }),
          ...(endDate !== undefined && { endDate: new Date(endDate) }),
          ...(supportsAppCredit !== undefined && { supportsAppCredit }),
          ...(creditMinUsd !== undefined && {
            creditMinUsd: creditMinUsd === null ? null : new Prisma.Decimal(creditMinUsd),
          }),
          ...(creditCreditedUsd !== undefined && {
            creditCreditedUsd: creditCreditedUsd === null ? null : new Prisma.Decimal(creditCreditedUsd),
          }),
        },
      });

      return { success: true, pool };
    }
  );

  // DELETE /pools/:id — delete pool (admin)
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const user = await prisma.user.findUnique({ where: { id: request.userId } });
      if (!user || user.role !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: 'Admin access required' });
      }

      const existing = await prisma.pool.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Pool not found' });
      }

      // Delete dependents first
      await prisma.deposit.deleteMany({ where: { poolId: request.params.id } });
      await prisma.poolMember.deleteMany({ where: { poolId: request.params.id } });
      await prisma.pool.delete({ where: { id: request.params.id } });

      return { success: true, message: 'Pool deleted' };
    }
  );

  // POST /pools/:id/deposit — record deposit
  fastify.post<{ Params: { id: string }; Body: { amount: number; txHash?: string } }>(
    '/:id/deposit',
    { schema: schemas.deposit, preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { amount: number; txHash?: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { amount, txHash } = request.body;

      // Verify pool exists
      const pool = await prisma.pool.findUnique({ where: { id } });
      if (!pool) {
        return reply.status(404).send({ success: false, error: 'Pool not found' });
      }
      if (pool.status !== 'ACTIVE') {
        return reply.status(400).send({ success: false, error: 'Pool is not active' });
      }

      const settings = await prisma.platformSettings.upsert({
        where: { id: 'default' },
        update: {},
        create: {
          id: 'default',
          freePoolsEnabled: false,
        },
      });
      const isFreeMode = settings.freePoolsEnabled;

      if (!isFreeMode && !txHash) {
        return reply.status(400).send({ success: false, error: 'txHash is required when free pool mode is disabled' });
      }

      // Create deposit + update pool + ensure membership — all in transaction
      const result = await prisma.$transaction(async (tx) => {
        const deposit = await tx.deposit.create({
          data: {
            userId: request.userId!,
            poolId: id,
            amount,
            txHash: isFreeMode ? null : txHash,
            status: isFreeMode ? 'CONFIRMED' : 'PENDING',
            confirmedAt: isFreeMode ? new Date() : null,
            confirmations: isFreeMode ? 1 : 0,
          },
        });

        await tx.transaction.create({
          data: {
            userId: request.userId!,
            type: 'DEPOSIT',
            amount,
            txHash: isFreeMode ? null : txHash,
            status: isFreeMode ? 'SUCCESS' : 'PENDING',
            metadata: isFreeMode
              ? {
                  mode: 'FREE_MODE',
                  note: 'Deposit created without on-chain payment',
                  poolId: id,
                }
              : {
                  poolId: id,
                },
          },
        });

        // Upsert pool membership
        await tx.poolMember.upsert({
          where: { userId_poolId: { userId: request.userId!, poolId: id } },
          create: { userId: request.userId!, poolId: id, share: amount },
          update: { share: { increment: amount } },
        });

        // Update pool total
        await tx.pool.update({
          where: { id },
          data: { totalStaked: { increment: amount } },
        });

        return deposit;
      });

      return reply.status(201).send({ success: true, deposit: result });
    }
  );

  // POST /pools/:id/claim-credit — stake into pool using in-app USDT credit (no on-chain pool tx)
  fastify.post<{ Params: { id: string } }>(
    '/:id/claim-credit',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id: poolId } = request.params;

      const pool = await prisma.pool.findUnique({ where: { id: poolId } });
      if (!pool) {
        return reply.status(404).send({ success: false, error: 'Pool not found' });
      }
      if (pool.status !== 'ACTIVE') {
        return reply.status(400).send({ success: false, error: 'Pool is not active' });
      }
      if (!pool.supportsAppCredit) {
        return reply.status(400).send({
          success: false,
          error: 'This pool does not support in-app credit claim',
        });
      }

      const creditMin = new Prisma.Decimal((pool.creditMinUsd ?? pool.minDeposit).toString());
      const creditGive = new Prisma.Decimal(
        (pool.creditCreditedUsd ?? pool.creditMinUsd ?? pool.minDeposit).toString()
      );

      try {
        const out = await prisma.$transaction(async (tx) => {
          const user = await tx.user.findUnique({ where: { id: request.userId! } });
          if (!user) throw new Error('USER_NOT_FOUND');
          const avail = new Prisma.Decimal(user.depositCreditUsd.toString());
          if (avail.lt(creditMin)) throw new Error('INSUFFICIENT_CREDIT');

          await tx.user.update({
            where: { id: user.id },
            data: {
              depositCreditUsd: { decrement: creditMin },
              claimedPoolCreditUsd: { increment: creditGive },
            },
          });

          const dep = await tx.deposit.create({
            data: {
              userId: user.id,
              poolId,
              amount: creditMin,
              amountUsd: creditMin,
              chain: 'BSC',
              status: 'CONFIRMED',
              confirmations: 1,
              confirmedAt: new Date(),
              txHash: null,
            },
          });

          await tx.transaction.create({
            data: {
              userId: user.id,
              type: 'DEPOSIT',
              amount: creditMin,
              status: 'SUCCESS',
              metadata: {
                poolId,
                source: 'APP_CREDIT_CLAIM',
                creditedClaimedUsd: creditGive.toString(),
              },
            },
          });

          await tx.poolMember.upsert({
            where: { userId_poolId: { userId: user.id, poolId } },
            create: { userId: user.id, poolId, share: creditMin },
            update: { share: { increment: creditMin } },
          });

          await tx.pool.update({
            where: { id: poolId },
            data: { totalStaked: { increment: creditMin } },
          });

          const refreshed = await tx.user.findUnique({
            where: { id: user.id },
            select: { depositCreditUsd: true, claimedPoolCreditUsd: true },
          });

          return { deposit: dep, balances: refreshed };
        });

        return {
          success: true,
          deposit: out.deposit,
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
            error: 'Insufficient deposit credit for this pool minimum',
          });
        }
        if (msg === 'USER_NOT_FOUND') {
          return reply.status(404).send({ success: false, error: 'User not found' });
        }
        throw e;
      }
    }
  );
}
