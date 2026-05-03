import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ethers } from 'ethers';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../config/db';
import { env } from '../config/env';
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
      // Dev mode: accept demo signatures (prefix 'demo-sig') to allow mobile app testing
      const isDemoSig = signature.startsWith('demo-sig') && env.NODE_ENV === 'development';

      if (!isDemoSig) {
        const message = `Sign this message to authenticate.\nNonce: ${user.nonce}`;
        try {
          const recoveredAddress = ethers.verifyMessage(message, signature);
          if (recoveredAddress.toLowerCase() !== normalized) {
            return reply.status(401).send({ success: false, error: 'Signature verification failed' });
          }
        } catch {
          return reply.status(401).send({ success: false, error: 'Invalid signature' });
        }
      } else {
        fastify.log.warn(`⚠️  DEV MODE: Skipping signature verification for ${normalized}`);
      }

      // Rotate nonce
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: { nonce: crypto.randomUUID() },
      });

      // Generate JWT (include role for admin middleware)
      const token = fastify.jwt.sign(
        { id: user.id, walletAddress: normalized, role: user.role },
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

  // POST /auth/dev-login — development login without signature (for mobile app testing)
  fastify.post<{ Body: { walletAddress: string } }>(
    '/dev-login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Dev login (no signature required)',
        description: 'Authenticates a wallet address without requiring a signature. Creates user if new. For development/testing only.',
        body: {
          type: 'object',
          properties: {
            walletAddress: { type: 'string' },
          },
          required: ['walletAddress'],
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
                  referralCode: { type: 'string', nullable: true },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { walletAddress } = request.body;
      const normalized = walletAddress.toLowerCase();

      // Find or create user
      let user = await prisma.user.findUnique({ where: { walletAddress: normalized } });

      if (!user) {
        user = await prisma.user.create({ data: { walletAddress: normalized } });
        fastify.log.info(`🆕 New user created via dev-login: ${normalized}`);
      }

      // Generate JWT
      const token = fastify.jwt.sign(
        { id: user.id, walletAddress: normalized, role: user.role },
        { expiresIn: '7d' }
      );

      return {
        success: true,
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          username: user.username,
          role: user.role,
          referralCode: user.referralCode,
        },
      };
    }
  );

  // POST /auth/setup-pin — set up PIN for mobile app security (protected)
  fastify.post<{ Body: { pin: string; enableBiometric?: boolean } }>(
    '/setup-pin',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { pin: string; enableBiometric?: boolean } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { pin, enableBiometric = false } = request.body;

      if (!pin || pin.length !== 6 || !/^\d+$/.test(pin)) {
        return reply.status(400).send({ success: false, error: 'PIN must be 6 digits' });
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const pinHash = crypto.createHash('sha256').update(pin + salt).digest('hex');

      await prisma.user.update({
        where: { id: userId },
        data: { pinHash, pinSalt: salt, biometricEnabled: enableBiometric },
      });

      return { success: true };
    }
  );

  // POST /auth/verify-pin — verify PIN on app open (protected)
  fastify.post<{ Body: { pin: string } }>(
    '/verify-pin',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { pin: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { pin } = request.body;

      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (!user?.pinHash || !user?.pinSalt) {
        return reply.status(400).send({ success: false, error: 'PIN not set up' });
      }

      const pinHash = crypto.createHash('sha256').update(pin + user.pinSalt).digest('hex');

      if (pinHash !== user.pinHash) {
        return reply.status(401).send({ success: false, error: 'Invalid PIN' });
      }

      return { success: true, biometricEnabled: user.biometricEnabled };
    }
  );

  // POST /auth/enable-biometric — enable/disable biometric unlock (protected)
  fastify.post<{ Body: { enabled: boolean } }>(
    '/biometric',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { enabled: boolean } }>) => {
      const userId = request.userId!;

      await prisma.user.update({
        where: { id: userId },
        data: { biometricEnabled: request.body.enabled },
      });

      return { success: true };
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
          avatar: true,
          referralCode: true,
          role: true,
          isActive: true,
          createdAt: true,
          pinHash: true,
          pinSalt: true,
          biometricEnabled: true,
        },
      });

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      return {
        success: true,
        user,
      };
    }
  );

  // POST /auth/admin-login — admin email/password login
  fastify.post<{ Body: { email: string; password: string } }>(
    '/admin-login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Admin login with email and password',
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 6 },
          },
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
    },
    async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
      const { email, password } = request.body;

      const user = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), role: 'ADMIN' },
      });

      if (!user || !user.passwordHash) {
        return reply.status(401).send({ success: false, error: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ success: false, error: 'Invalid email or password' });
      }

      const token = fastify.jwt.sign(
        { id: user.id, walletAddress: user.walletAddress, role: user.role },
        { expiresIn: '7d' }
      );

      return {
        success: true,
        token,
        user: {
          id: user.id,
          walletAddress: user.walletAddress,
          username: user.username,
          role: user.role,
        },
      };
    }
  );

  // PUT /auth/profile — update profile (protected)
  fastify.put<{ Body: { username?: string; email?: string; avatar?: string } }>(
    '/profile',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { username?: string; email?: string; avatar?: string } }>, reply: FastifyReply) => {
      const { username, email, avatar } = request.body;

      const user = await prisma.user.update({
        where: { id: request.userId },
        data: {
          ...(username !== undefined && { username }),
          ...(email !== undefined && { email }),
          ...(avatar !== undefined && { avatar }),
        },
        select: {
          id: true,
          walletAddress: true,
          username: true,
          email: true,
          avatar: true,
        },
      });

      return { success: true, user };
    }
  );
}
