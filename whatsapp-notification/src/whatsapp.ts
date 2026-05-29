import path from 'node:path';
import fs from 'node:fs';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  Browsers,
  type WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import { config } from './config.js';
import type { ConnectionStatus, NotifyPayload } from './types.js';
import { formatNotifyText } from './templates.js';

let sock: WASocket | null = null;
let connectionState: ConnectionStatus['state'] = 'close';
let lastQr: string | null = null;
let lastQrAt: Date | null = null;
let linkedUser: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let starting = false;
let cachedWaVersion: [number, number, number] | null = null;

function ensureAuthDir(): void {
  fs.mkdirSync(config.authDir, { recursive: true });
}

function clearAuthDir(): void {
  const authPath = path.resolve(config.authDir);
  if (!fs.existsSync(authPath)) return;
  for (const entry of fs.readdirSync(authPath)) {
    fs.rmSync(path.join(authPath, entry), { recursive: true, force: true });
  }
}

async function resolveWaVersion(forceRefresh = false): Promise<[number, number, number]> {
  if (cachedWaVersion && !forceRefresh) return cachedWaVersion;

  const { version, isLatest, error } = await fetchLatestWaWebVersion({});
  cachedWaVersion = version as [number, number, number];

  if (error) {
    console.warn('[whatsapp] Using bundled WA version (fetch failed):', error);
  } else {
    console.log(`[whatsapp] WA Web version ${version.join('.')} (latest=${isLatest})`);
  }

  return cachedWaVersion;
}

export function getConnectionStatus(): ConnectionStatus {
  return {
    state: connectionState,
    connected: connectionState === 'open',
    hasQr: Boolean(lastQr),
    qrGeneratedAt: lastQrAt ? lastQrAt.toISOString() : null,
    linkedUser,
  };
}

export async function getQrDataUrl(): Promise<string | null> {
  if (!lastQr) return null;
  return qrcode.toDataURL(lastQr, { margin: 2, width: 320 });
}

function resolveAdminJid(): string | null {
  if (config.adminWhatsAppNumber) {
    const digits = config.adminWhatsAppNumber.replace(/\D/g, '');
    if (!digits) return null;
    return `${digits}@s.whatsapp.net`;
  }
  if (linkedUser) return linkedUser;
  return sock?.user?.id ?? null;
}

export async function sendAdminNotification(payload: NotifyPayload): Promise<{ ok: boolean; error?: string }> {
  if (!sock || connectionState !== 'open') {
    return { ok: false, error: 'WhatsApp not connected — scan QR at /setup first' };
  }

  const jid = resolveAdminJid();
  if (!jid) {
    return {
      ok: false,
      error: 'No admin JID — set ADMIN_WHATSAPP_NUMBER or link device first',
    };
  }

  try {
    await sock.sendMessage(jid, { text: formatNotifyText(payload, config.adminDashboardUrl) });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function connectOnce(options: { refreshVersion?: boolean; clearAuth?: boolean } = {}): Promise<void> {
  if (starting) return;
  starting = true;
  ensureAuthDir();

  if (options.clearAuth) {
    clearAuthDir();
  }

  try {
    const authPath = path.resolve(config.authDir);
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const version = await resolveWaVersion(options.refreshVersion);

    connectionState = 'connecting';
    sock = makeWASocket({
      version,
      browser: Browsers.macOS('Chrome'),
      auth: state,
      logger: pino({ level: 'warn' }),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      getMessage: async () => undefined,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionState = 'qr';
        lastQr = qr;
        lastQrAt = new Date();
        console.log('\n[whatsapp] Link device — scan QR (browser: http://127.0.0.1:8080/setup)\n');
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === 'open') {
        connectionState = 'open';
        lastQr = null;
        lastQrAt = null;
        linkedUser = sock?.user?.id ?? null;
        console.log(`[whatsapp] Connected as ${linkedUser ?? 'unknown'}`);
      }

      if (connection === 'close') {
        connectionState = 'close';
        linkedUser = null;
        sock = null;

        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          console.warn('[whatsapp] Logged out — clearing auth and waiting for new QR scan');
          clearAuthDir();
          scheduleReconnect({ refreshVersion: true });
          return;
        }

        if (statusCode === DisconnectReason.restartRequired) {
          console.log('[whatsapp] Restart required — reconnecting…');
          scheduleReconnect({ delayMs: 1000 });
          return;
        }

        if (statusCode === 405) {
          console.warn('[whatsapp] WA version rejected (405) — fetching latest version…');
          cachedWaVersion = null;
          scheduleReconnect({ refreshVersion: true, delayMs: 2000 });
          return;
        }

        console.warn(`[whatsapp] Connection closed (${statusCode ?? 'unknown'}) — reconnecting in 5s`);
        scheduleReconnect({ delayMs: 5000 });
      }
    });
  } finally {
    starting = false;
  }
}

function scheduleReconnect(options: { refreshVersion?: boolean; clearAuth?: boolean; delayMs?: number } = {}): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delayMs = options.delayMs ?? 5000;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectOnce(options);
  }, delayMs);
}

export function startWhatsApp(): void {
  void connectOnce();
}

export async function logoutWhatsApp(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    await sock.logout();
    sock = null;
  }
  clearAuthDir();
  connectionState = 'close';
  linkedUser = null;
  lastQr = null;
  lastQrAt = null;
  cachedWaVersion = null;
}
