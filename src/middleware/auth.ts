import { FastifyRequest, FastifyReply } from 'fastify';

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
    }>();
    request.userId = decoded.id;
    request.walletAddress = decoded.walletAddress;
    request.userRole = decoded.role;
  } catch (err) {
    reply.status(401).send({
      success: false,
      error: 'Unauthorized — invalid or missing token',
    });
  }
}
