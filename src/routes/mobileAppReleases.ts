import '@fastify/multipart';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import prisma from '../config/db';
import { adminOnlyMiddleware } from '../middleware/adminOnly';

const APK_SUBDIR = 'apk';
const MAX_APK_BYTES = 200 * 1024 * 1024;

function uploadsRoot(): string {
  return path.join(process.cwd(), 'uploads');
}

function absStoragePath(rel: string): string {
  return path.join(uploadsRoot(), rel);
}

async function ensureApkDir(): Promise<void> {
  await fs.mkdir(path.join(uploadsRoot(), APK_SUBDIR), { recursive: true });
}

export const mobileAppPublicPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get('/mobile-app', async () => {
    const row = await prisma.mobileAppRelease.findFirst({
      where: { isPublished: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!row) {
      return { success: true, published: null };
    }
    return {
      success: true,
      published: {
        id: row.id,
        version: row.version,
        originalFileName: row.originalFileName,
        releaseNotes: row.releaseNotes,
        updatedAt: row.updatedAt.toISOString(),
        fileSizeBytes: Number(row.fileSizeBytes),
        downloadPath: '/api/public/mobile-app/download',
      },
    };
  });

  fastify.get('/mobile-app/download', async (_request, reply) => {
    const row = await prisma.mobileAppRelease.findFirst({
      where: { isPublished: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!row) {
      return reply.status(404).send({ success: false, error: 'No published APK' });
    }
    const abs = absStoragePath(row.storagePath);
    try {
      await fs.access(abs);
    } catch {
      return reply.status(404).send({ success: false, error: 'APK file missing on server' });
    }
    const safeName = (row.originalFileName || `clb-${row.version}.apk`).replace(/[^\w.\-]+/g, '_');
    return reply
      .type('application/vnd.android.package-archive')
      .header('Content-Disposition', `attachment; filename="${safeName}"`)
      .send(createReadStream(abs));
  });
};

export const mobileAppAdminPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.get(
    '/releases',
    { preHandler: [adminOnlyMiddleware] },
    async () => {
      const rows = await prisma.mobileAppRelease.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return {
        success: true,
        releases: rows.map((r) => ({
          id: r.id,
          version: r.version,
          originalFileName: r.originalFileName,
          fileSizeBytes: Number(r.fileSizeBytes),
          releaseNotes: r.releaseNotes,
          isPublished: r.isPublished,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })),
      };
    }
  );

  fastify.post(
    '/releases',
    { preHandler: [adminOnlyMiddleware] },
    async (request, reply) => {
      if (!request.isMultipart()) {
        return reply.status(400).send({ success: false, error: 'Expected multipart/form-data' });
      }

      let version = '';
      let releaseNotes = '';
      let filePart: { filename: string; file: NodeJS.ReadableStream } | null = null;

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          if (part.fieldname === 'file') {
            const name = part.filename || '';
            if (!name.toLowerCase().endsWith('.apk')) {
              return reply.status(400).send({ success: false, error: 'Only .apk files are allowed' });
            }
            filePart = { filename: name, file: part.file };
          } else {
            part.file.resume();
          }
        } else if (part.fieldname === 'version') {
          version = String(part.value ?? '').trim();
        } else if (part.fieldname === 'releaseNotes') {
          releaseNotes = String(part.value ?? '').trim();
        }
      }

      if (!version) {
        return reply.status(400).send({ success: false, error: 'version is required' });
      }
      if (!filePart) {
        return reply.status(400).send({ success: false, error: 'file is required' });
      }

      const id = randomUUID();
      const relPath = path.join(APK_SUBDIR, `${id}.apk`);
      const absPath = absStoragePath(relPath);

      await ensureApkDir();

      try {
        await pipeline(filePart.file, createWriteStream(absPath));
      } catch (e) {
        await fs.unlink(absPath).catch(() => undefined);
        request.log.error(e);
        return reply.status(500).send({ success: false, error: 'Failed to save APK' });
      }

      let size: bigint;
      try {
        const st = await fs.stat(absPath);
        size = BigInt(st.size);
        if (st.size > MAX_APK_BYTES) {
          await fs.unlink(absPath);
          return reply.status(400).send({
            success: false,
            error: `APK exceeds maximum size of ${MAX_APK_BYTES / (1024 * 1024)} MB`,
          });
        }
      } catch (e) {
        await fs.unlink(absPath).catch(() => undefined);
        request.log.error(e);
        return reply.status(500).send({ success: false, error: 'Failed to verify APK' });
      }

      try {
        const row = await prisma.mobileAppRelease.create({
          data: {
            id,
            version,
            originalFileName: filePart.filename,
            storagePath: relPath.replace(/\\/g, '/'),
            fileSizeBytes: size,
            releaseNotes: releaseNotes || null,
            isPublished: false,
          },
        });
        return {
          success: true,
          release: {
            id: row.id,
            version: row.version,
            originalFileName: row.originalFileName,
            fileSizeBytes: Number(row.fileSizeBytes),
            releaseNotes: row.releaseNotes,
            isPublished: row.isPublished,
            createdAt: row.createdAt.toISOString(),
          },
        };
      } catch (e) {
        await fs.unlink(absPath).catch(() => undefined);
        request.log.error(e);
        return reply.status(500).send({ success: false, error: 'Failed to record release' });
      }
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/releases/:id/publish',
    { preHandler: [adminOnlyMiddleware] },
    async (request, reply) => {
      const { id } = request.params;
      const existing = await prisma.mobileAppRelease.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Release not found' });
      }
      try {
        await fs.access(absStoragePath(existing.storagePath));
      } catch {
        return reply.status(400).send({ success: false, error: 'APK file missing — re-upload' });
      }

      await prisma.$transaction([
        prisma.mobileAppRelease.updateMany({
          where: { isPublished: true },
          data: { isPublished: false },
        }),
        prisma.mobileAppRelease.update({
          where: { id },
          data: { isPublished: true },
        }),
      ]);

      const row = await prisma.mobileAppRelease.findUnique({ where: { id } });
      return { success: true, release: row };
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/releases/:id/unpublish',
    { preHandler: [adminOnlyMiddleware] },
    async (request, reply) => {
      const { id } = request.params;
      const existing = await prisma.mobileAppRelease.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Release not found' });
      }
      await prisma.mobileAppRelease.update({
        where: { id },
        data: { isPublished: false },
      });
      return { success: true };
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/releases/:id',
    { preHandler: [adminOnlyMiddleware] },
    async (request, reply) => {
      const { id } = request.params;
      const existing = await prisma.mobileAppRelease.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ success: false, error: 'Release not found' });
      }
      if (existing.isPublished) {
        return reply.status(400).send({
          success: false,
          error: 'Unpublish this release first, then delete it',
        });
      }
      const abs = absStoragePath(existing.storagePath);
      await prisma.mobileAppRelease.delete({ where: { id } });
      await fs.unlink(abs).catch(() => undefined);
      return { success: true };
    }
  );
};
