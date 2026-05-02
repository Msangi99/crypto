import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { Prisma } from '@prisma/client';

const schemas = {
  listTransactions: {
    tags: ['Transactions'],
    summary: 'List user transactions',
    description: 'Returns a paginated list of transactions for the authenticated user',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1 },
        limit: { type: 'integer', default: 20 },
        type: { type: 'string', enum: ['DEPOSIT', 'WITHDRAWAL', 'REWARD', 'REFERRAL_BONUS', 'FEE'] },
        status: { type: 'string', enum: ['PENDING', 'SUCCESS', 'FAILED'] },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          transactions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                type: { type: 'string' },
                amount: { type: 'number' },
                txHash: { type: 'string', nullable: true },
                fromAddress: { type: 'string', nullable: true },
                toAddress: { type: 'string', nullable: true },
                status: { type: 'string' },
                createdAt: { type: 'string' },
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
  getTransaction: {
    tags: ['Transactions'],
    summary: 'Get transaction by ID',
    params: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          transaction: { type: 'object' },
        },
      },
    },
  },
};

export default async function transactionRoutes(fastify: FastifyInstance) {
  // All transaction routes are protected
  fastify.addHook('preHandler', authMiddleware);

  // GET /transactions — list user transactions
  fastify.get<{
    Querystring: { page?: number; limit?: number; type?: string; status?: string };
  }>(
    '/',
    { schema: schemas.listTransactions },
    async (request: FastifyRequest<{
      Querystring: { page?: number; limit?: number; type?: string; status?: string };
    }>) => {
      const userId = request.userId!;
      const page = request.query.page || 1;
      const limit = request.query.limit || 20;
      const skip = (page - 1) * limit;

      const where: Prisma.TransactionWhereInput = { userId };
      if (request.query.type) where.type = request.query.type as any;
      if (request.query.status) where.status = request.query.status as any;

      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.transaction.count({ where }),
      ]);

      return {
        success: true,
        transactions: transactions.map((t) => ({
          ...t,
          amount: Number(t.amount),
          createdAt: t.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // GET /transactions/:id — single transaction
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { schema: schemas.getTransaction },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const tx = await prisma.transaction.findFirst({
        where: {
          id: request.params.id,
          userId: request.userId!,
        },
      });

      if (!tx) {
        return reply.status(404).send({ success: false, error: 'Transaction not found' });
      }

      return { success: true, transaction: { ...tx, amount: Number(tx.amount) } };
    }
  );
}
