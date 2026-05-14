import { FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from './auth';

export async function adminOnlyMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authMiddleware(request, reply);
  if (reply.sent) return;
  if (request.userRole !== 'ADMIN') {
    reply.status(403).send({ success: false, error: 'Forbidden — admin access required' });
  }
}
