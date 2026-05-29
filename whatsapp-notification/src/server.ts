import Fastify from 'fastify';
import { config } from './config.js';
import type { AdminNotifyEvent, NotifyPayload } from './types.js';
import {
  getConnectionStatus,
  getQrDataUrl,
  sendAdminNotification,
  startWhatsApp,
} from './whatsapp.js';
import { setupPageHtml } from './setupPage.js';
import { getNotifySamples, getSample, sendAllSamples } from './testSamples.js';

const VALID_EVENTS = new Set<AdminNotifyEvent>([
  'WITHDRAWAL_REQUEST',
  'DEPOSIT_REQUEST',
  'NEW_USER',
  'PAYMENT',
  'DEPOSIT_CONFIRMED',
  'LOAN_REQUEST',
  'GENERAL',
]);

function checkSecret(request: { headers: Record<string, string | string[] | undefined> }): boolean {
  if (!config.notifySecret) return false;
  const header = request.headers['x-notify-secret'];
  const value = Array.isArray(header) ? header[0] : header;
  return value === config.notifySecret;
}

export async function buildServer() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => {
    const status = getConnectionStatus();
    return {
      ok: true,
      service: 'clb-whatsapp-notification',
      whatsapp: status,
    };
  });

  app.get('/setup', async (_request, reply) => {
    const status = getConnectionStatus();
    const qrDataUrl = status.hasQr ? await getQrDataUrl() : null;
    const samples = getNotifySamples(config.adminDashboardUrl);
    reply.type('text/html').send(setupPageHtml(qrDataUrl, status, samples));
  });

  app.get('/api/qr', async () => {
    const status = getConnectionStatus();
    const dataUrl = status.hasQr ? await getQrDataUrl() : null;
    return { ...status, qrDataUrl: dataUrl };
  });

  app.get('/api/samples', async () => {
    const samples = getNotifySamples(config.adminDashboardUrl);
    return {
      ok: true,
      count: samples.length,
      samples: samples.map((s) => ({ id: s.id, label: s.label, page: s.page, event: s.payload.event })),
    };
  });

  app.post<{ Params: { id: string } }>('/api/notify/sample/:id', async (request, reply) => {
    if (!checkSecret(request)) {
      return reply.status(401).send({ ok: false, error: 'Unauthorized' });
    }

    const sample = getSample(request.params.id, config.adminDashboardUrl);
    if (!sample) {
      return reply.status(404).send({ ok: false, error: 'Unknown sample id' });
    }

    const result = await sendAdminNotification(sample.payload);
    if (!result.ok) {
      return reply.status(503).send({ ok: false, error: result.error });
    }

    return { ok: true, id: sample.id, label: sample.label };
  });

  app.post('/api/notify/test-all', async (request, reply) => {
    if (!checkSecret(request)) {
      return reply.status(401).send({ ok: false, error: 'Unauthorized' });
    }

    const { sent, failed } = await sendAllSamples(config.adminDashboardUrl, sendAdminNotification, 3000);

    if (sent === 0 && failed.length > 0) {
      return reply.status(503).send({ ok: false, error: failed[0], failed });
    }

    return { ok: true, sent, total: getNotifySamples(config.adminDashboardUrl).length, failed };
  });

  app.post<{ Body: NotifyPayload }>('/api/notify', async (request, reply) => {
    if (!checkSecret(request)) {
      return reply.status(401).send({ ok: false, error: 'Unauthorized' });
    }

    const body = request.body;
    if (!body?.title || !body?.message) {
      return reply.status(400).send({ ok: false, error: 'title and message are required' });
    }

    const event = (body.event || 'GENERAL') as AdminNotifyEvent;
    if (!VALID_EVENTS.has(event)) {
      return reply.status(400).send({ ok: false, error: 'Invalid event type' });
    }

    const result = await sendAdminNotification({
      event,
      title: body.title,
      message: body.message,
      url: body.url,
      metadata: body.metadata,
    });

    if (!result.ok) {
      return reply.status(503).send({ ok: false, error: result.error });
    }

    return { ok: true };
  });

  app.post('/api/notify/test', async (request, reply) => {
    if (!checkSecret(request)) {
      return reply.status(401).send({ ok: false, error: 'Unauthorized' });
    }

    const result = await sendAdminNotification({
      event: 'GENERAL',
      title: 'Test alert',
      message: 'CLB WhatsApp notification service is working.',
      url: config.adminDashboardUrl,
    });

    if (!result.ok) {
      return reply.status(503).send({ ok: false, error: result.error });
    }

    return { ok: true };
  });

  return app;
}

export async function startServer(): Promise<void> {
  startWhatsApp();
  const app = await buildServer();
  await app.listen({ port: config.port, host: config.host });
  console.log(`[server] Listening on http://${config.host}:${config.port}`);
  console.log(`[server] Link WhatsApp: https://bot.cryptoloanboost.com/setup (or http://127.0.0.1:${config.port}/setup locally)`);
}
