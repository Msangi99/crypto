import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import crypto from 'crypto';

const REFERRAL_BASE_URL = 'https://cryptoloanboost.com/join?ref=';

function buildReferralLink(code: string): string {
  return `${REFERRAL_BASE_URL}${code}`;
}

// Swagger schemas
const schemas = {
  generateCode: {
    tags: ['Referrals'],
    summary: 'Generate referral code',
    description: 'Generates a unique referral code for the authenticated user',
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          code: { type: 'string' },
          referralLink: { type: 'string' },
        },
      },
    },
  },
  applyReferral: {
    tags: ['Referrals'],
    summary: 'Apply a referral code',
    description: 'Links the authenticated user to a referrer using a referral code',
    body: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Referral code to apply' },
      },
      required: ['code'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          message: { type: 'string' },
          referral: { type: 'object' },
        },
      },
    },
  },
  myReferrals: {
    tags: ['Referrals'],
    summary: 'Get my referrals',
    description: 'Returns a list of users referred by the authenticated user',
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1 },
        limit: { type: 'integer', default: 20 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          referrals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                referredWallet: { type: 'string' },
                reward: { type: 'number' },
                status: { type: 'string' },
                createdAt: { type: 'string' },
              },
            },
          },
          stats: {
            type: 'object',
            properties: {
              totalReferrals: { type: 'integer' },
              activeReferrals: { type: 'integer' },
              totalRewards: { type: 'number' },
            },
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
            },
          },
        },
      },
    },
  },
  referralStats: {
    tags: ['Referrals'],
    summary: 'Global referral statistics',
    description: 'Returns aggregate referral stats (admin)',
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          stats: {
            type: 'object',
            properties: {
              totalReferrals: { type: 'integer' },
              totalRewardsDistributed: { type: 'number' },
              topReferrers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    walletAddress: { type: 'string' },
                    count: { type: 'integer' },
                    totalReward: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

export default async function referralRoutes(fastify: FastifyInstance) {
  // POST /referrals/generate — generate code (protected)
  fastify.post(
    '/generate',
    { schema: schemas.generateCode, preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;

      // Return existing code if already set
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { referralCode: true } });
      if (user?.referralCode) {
        return {
          success: true,
          code: user.referralCode,
          referralLink: buildReferralLink(user.referralCode),
        };
      }

      // Generate and persist a unique CLB-XXXXXXXX referral code
      const code = `CLB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });

      return {
        success: true,
        code,
        referralLink: buildReferralLink(code),
      };
    }
  );

  // POST /referrals/apply — apply referral code (protected)
  fastify.post<{ Body: { code: string } }>(
    '/apply',
    { schema: schemas.applyReferral, preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { code: string } }>, reply: FastifyReply) => {
      // Normalize: uppercase and trim so mobile/web casing differences don't matter
      const code = (request.body.code || '').trim().toUpperCase();
      const userId = request.userId!;

      if (!code) {
        return reply.status(400).send({ success: false, error: 'Referral code is required' });
      }

      // Check if already referred
      const existing = await prisma.referral.findUnique({
        where: { referredId: userId },
      });
      if (existing) {
        return reply.status(400).send({ success: false, error: 'You have already been referred' });
      }

      // Find referrer by their stored referral code (stored uppercase)
      const referrer = await prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });

      if (!referrer) {
        return reply.status(404).send({ success: false, error: 'Invalid referral code' });
      }

      // Can't refer yourself
      if (referrer.id === userId) {
        return reply.status(400).send({ success: false, error: 'Cannot refer yourself' });
      }

      // Create referral record
      const referral = await prisma.referral.create({
        data: {
          referrerId: referrer.id,
          referredId: userId,
          code: `${code}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          status: 'ACTIVE',
        },
      });

      return {
        success: true,
        message: 'Referral applied successfully',
        referral,
      };
    }
  );

  // GET /referrals/my — list my referrals (protected)
  fastify.get<{ Querystring: { page?: number; limit?: number } }>(
    '/my',
    { schema: schemas.myReferrals, preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Querystring: { page?: number; limit?: number } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const page = request.query.page || 1;
      const limit = request.query.limit || 20;
      const skip = (page - 1) * limit;

      const [referrals, total, statsAgg] = await Promise.all([
        prisma.referral.findMany({
          where: { referrerId: userId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            referred: { select: { walletAddress: true } },
          },
        }),
        prisma.referral.count({ where: { referrerId: userId } }),
        prisma.referral.aggregate({
          where: { referrerId: userId },
          _sum: { reward: true },
          _count: true,
        }),
      ]);

      const activeCount = await prisma.referral.count({
        where: { referrerId: userId, status: 'ACTIVE' },
      });

      return {
        success: true,
        referrals: referrals.map((r) => ({
          id: r.id,
          referredWallet: r.referred.walletAddress,
          reward: Number(r.reward),
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
        stats: {
          totalReferrals: total,
          activeReferrals: activeCount,
          totalRewards: Number(statsAgg._sum.reward || 0),
        },
        pagination: { page, limit, total },
      };
    }
  );

  // GET /referrals/stats — global stats
  fastify.get(
    '/stats',
    { schema: schemas.referralStats },
    async () => {
      const [totalReferrals, rewardsAgg] = await Promise.all([
        prisma.referral.count(),
        prisma.referral.aggregate({ _sum: { reward: true } }),
      ]);

      // Top referrers
      const topReferrers = await prisma.referral.groupBy({
        by: ['referrerId'],
        _count: true,
        _sum: { reward: true },
        orderBy: { _count: { referrerId: 'desc' } },
        take: 10,
      });

      // Get wallet addresses for top referrers
      const userIds = topReferrers.map((r) => r.referrerId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, walletAddress: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u.walletAddress]));

      return {
        success: true,
        stats: {
          totalReferrals,
          totalRewardsDistributed: Number(rewardsAgg._sum.reward || 0),
          topReferrers: topReferrers.map((r) => ({
            walletAddress: userMap.get(r.referrerId) || 'unknown',
            count: r._count,
            totalReward: Number(r._sum.reward || 0),
          })),
        },
      };
    }
  );
}
