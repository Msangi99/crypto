import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ethers } from 'ethers';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';

// Swagger schemas
const schemas = {
  getNonce: {
    tags: ['Auth'],
    summary: 'Get nonce for wallet signature',
    description: 'Returns a unique nonce for the given wallet address to sign for authentication',
    params: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string', description: 'Ethereum/BSC wallet address' },
      },
      required: ['walletAddress'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          nonce: { type: 'string' },
        },
      },
    },
  },
  verifyWallet: {
    tags: ['Auth'],
    summary: 'Verify wallet signature and get JWT',
    description: 'Verifies the signed nonce message and returns a JWT token',
    body: {
      type: 'object',
      properties: {
        walletAddress: { type: 'string' },
        signature: { type: 'string' },
      },
      required: ['walletAddress', 'signature'],
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          token: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              walletAddress: { type: 'string' },
              username: { type: 'string', nullable: true },
              role: { type: 'string' },
            },
          },
        },
      },
    },
  },
  getProfile: {
    tags: ['Auth'],
    summary: 'Get current user profile',
    description: 'Returns the authenticated user profile (requires JWT)',
    headers: {
      type: 'object',
      properties: {
        authorization: { type: 'string', description: 'Bearer <JWT token>' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              walletAddress: { type: 'string' },
              username: { type: 'string', nullable: true },
              email: { type: 'string', nullable: true },
              role: { type: 'string' },
              isActive: { type: 'boolean' },
              createdAt: { type: 'string' },
            },
          },
        },
      },
    },
  },
  updateProfile: {
    tags: ['Auth'],
    summary: 'Update user profile',
    description: 'Update username and/or email for the authenticated user',
    body: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        email: { type: 'string', format: 'email' },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              walletAddress: { type: 'string' },
              username: { type: 'string', nullable: true },
              email: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
  },
};

export default async function authRoutes(fastify: FastifyInstance) {
  // GET /auth/nonce/:walletAddress — get nonce for signing
  fastify.get<{ Params: { walletAddress: string } }>(
    '/nonce/:walletAddress',
    { schema: schemas.getNonce },
    async (request, reply) => {
      const { walletAddress } = request.params;
      const normalized = walletAddress.toLowerCase();

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { walletAddress: normalized },
      });

      if (!user) {
        user = await prisma.user.create({
          data: { walletAddress: normalized },
        });
      }

      return { success: true, nonce: user.nonce };
    }
  );

  // POST /auth/verify — verify wallet signature, return JWT
  fastify.post<{ Body: { walletAddress: string; signature: string } }>(
    '/verify',
    { schema: schemas.verifyWallet },
    async (request, reply) => {
      const { walletAddress, signature } = request.body;
      const normalized = walletAddress.toLowerCase();

      const user = await prisma.user.findUnique({
        where: { walletAddress: normalized },
      });

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found. Get nonce first.' });
      }

      // Verify signature
      const message = `Sign this message to authenticate.\nNonce: ${user.nonce}`;
      try {
        const recoveredAddress = ethers.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== normalized) {
          return reply.status(401).send({ success: false, error: 'Signature verification failed' });
        }
      } catch {
        return reply.status(401).send({ success: false, error: 'Invalid signature' });
      }

      // Rotate nonce
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { nonce: crypto.randomUUID() },
      });

      // Generate JWT
      const token = fastify.jwt.sign(
        { id: user.id, walletAddress: normalized },
        { expiresIn: '7d' }
      );

      return {
        success: true,
        token,
        user: {
          id: updatedUser.id,
          walletAddress: updatedUser.walletAddress,
          username: updatedUser.username,
          role: updatedUser.role,
        },
      };
    }
  );

  // GET /auth/profile — get user profile (protected)
  fastify.get(
    '/profile',
    { schema: schemas.getProfile, preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.userId },
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

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      return { success: true, user };
    }
  );

  // PUT /auth/profile — update profile (protected)
  fastify.put<{ Body: { username?: string; email?: string } }>(
    '/profile',
    { schema: schemas.updateProfile, preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { username?: string; email?: string } }>, reply: FastifyReply) => {
      const { username, email } = request.body;

      const user = await prisma.user.update({
        where: { id: request.userId },
        data: {
          ...(username && { username }),
          ...(email && { email }),
        },
        select: {
          id: true,
          walletAddress: true,
          username: true,
          email: true,
        },
      });

      return { success: true, user };
    }
  );
}
