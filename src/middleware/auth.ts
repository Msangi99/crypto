import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';

// Extend FastifyRequest to include user info from JWT
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    walletAddress?: string;
    userRole?: string;
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const decoded = await request.jwtVerify<{
      id: string;
      walletAddress: string;
      role?: string;
      tokenVersion?: number;
    }>();
    request.userId = decoded.id;
    request.walletAddress = decoded.walletAddress;
    request.userRole = decoded.role;

    // Check tokenVersion — if user logged in on another device, old tokens are invalid
    if (decoded.tokenVersion !== undefined) {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { tokenVersion: true, isActive: true },
      });

      if (!user || !user.isActive) {
        return reply.status(401).send({
          success: false,
          error: 'Account deactivated',
        });
      }

      if (user.tokenVersion !== decoded.tokenVersion) {
        return reply.status(401).send({
          success: false,
          error: 'Session expired — logged in from another device',
        });
      }
    }
  } catch (err) {
    reply.status(401).send({
      success: false,
      error: 'Unauthorized — invalid or missing token',
    });
  }
}
