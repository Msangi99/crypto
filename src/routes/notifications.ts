import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';

export default async function notificationRoutes(fastify: FastifyInstance) {
  // GET /notifications — list user notifications (paginated)
  fastify.get(
    '/',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;
      const { page = '1', limit = '20', unreadOnly = 'false' } = request.query as any;

      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
      const onlyUnread = unreadOnly === 'true';

      const where: any = { userId };
      if (onlyUnread) where.isRead = false;

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId, isRead: false } }),
      ]);

      return {
        success: true,
        notifications,
        unreadCount,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    }
  );

  // GET /notifications/unread-count — quick badge count
  fastify.get(
    '/unread-count',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;

      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });

      return { success: true, unreadCount };
    }
  );

  // PATCH /notifications/:id/read — mark single notification as read
  fastify.patch<{ Params: { id: string } }>(
    '/:id/read',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { id } = request.params;

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        return reply.status(404).send({ success: false, error: 'Notification not found' });
      }

      await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      return { success: true };
    }
  );

  // PATCH /notifications/mark-all-read — mark all as read
  fastify.patch(
    '/mark-all-read',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;

      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });

      return { success: true };
    }
  );

  // DELETE /notifications/:id — delete a notification
  fastify.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { id } = request.params;

      const notification = await prisma.notification.findFirst({
        where: { id, userId },
      });

      if (!notification) {
        return reply.status(404).send({ success: false, error: 'Notification not found' });
      }

      await prisma.notification.delete({ where: { id } });

      return { success: true };
    }
  );
}
