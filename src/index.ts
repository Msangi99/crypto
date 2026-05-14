import path from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './config/env';
import prisma from './config/db';
import { verifyConnection } from './config/blockchain';
import { tokenService } from './services/tokenService';
import { eventService } from './services/eventService';
import { liquidationService } from './services/liquidationService';

// Route imports
import authRoutes from './routes/auth';
import poolRoutes from './routes/pool';
import referralRoutes from './routes/referral';
import priceRoutes from './routes/price';
import transactionRoutes from './routes/transaction';
import adminRoutes from './routes/admin';
import userDashboardRoutes from './routes/userDashboard';
import notificationRoutes from './routes/notifications';
import loanRoutes from './routes/loans';
import tokenRoutes from './routes/tokens';
import withdrawalRoutes from './routes/withdrawals';
import miningPackageRoutes from './routes/miningPackages';
import userMiningRoutes from './routes/userMining';
import creditWalletRoutes from './routes/creditWallet';
import { mobileAppPublicPlugin, mobileAppAdminPlugin } from './routes/mobileAppReleases';

function parseExtraCorsOrigins(): Set<string> {
  const raw = env.CORS_EXTRA_ORIGINS;
  if (!raw.trim()) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

const extraCorsOrigins = parseExtraCorsOrigins();

/** HTTPS apex + any subdomain of cryptoloanboost.com (RegExp avoids subtle URL-parse mismatches). */
const CLB_HTTPS_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*cryptoloanboost\.com$/i;
const LOCAL_DEV_ORIGINS = [/^http:\/\/localhost(?::\d+)?$/i, /^http:\/\/127\.0\.0\.1(?::\d+)?$/i];

function browserOriginAllowed(origin: string): boolean {
  const o = origin.trim();
  if (!o) return false;
  if (extraCorsOrigins.has(o)) return true;
  if (CLB_HTTPS_ORIGIN.test(o)) return true;
  return LOCAL_DEV_ORIGINS.some((re) => re.test(o));
}

function productionCorsOriginOption(): (string | RegExp)[] {
  return [...extraCorsOrigins, CLB_HTTPS_ORIGIN, ...LOCAL_DEV_ORIGINS];
}
const buildApp = async () => {
  const fastify = Fastify({
    logger: {
      level: env.NODE_ENV === 'development' ? 'info' : 'warn',
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // ─── CORS ──────────────────────────────────────
  // Explicit allowlist fixes admin (e.g. cryptoloanboost.com → api.cryptoloanboost.com) when proxies
  // strip reflected origins or preflight needs predictable Access-Control-Allow-Origin + credentials.
  await fastify.register(cors, {
    // In dev, reflect any Origin. In prod, use string + RegExp list so @fastify/cors always sets ACAO
    // when the browser Origin matches (including 401 responses).
    origin: env.NODE_ENV === 'development' ? true : productionCorsOriginOption(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'Origin', 'X-Requested-With'],
    maxAge: 86400,
  });

  // If an allowed browser origin somehow reaches the wire without ACAO (e.g. proxy stripping upstream
  // headers), attach it on send so 401/403 bodies stay readable to fetch/XHR instead of masking as CORS.
  fastify.addHook('onSend', async (request, reply, payload) => {
    const raw = request.headers.origin;
    if (typeof raw !== 'string' || raw.length === 0) return payload;
    const origin = raw.trim();
    if (reply.getHeader('access-control-allow-origin')) return payload;
    const allowed = env.NODE_ENV === 'development' || browserOriginAllowed(origin);
    if (!allowed) return payload;
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    return payload;
  });

  // ─── JWT ───────────────────────────────────────
  await fastify.register(jwt, {
    secret: env.JWT_SECRET,
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 200 * 1024 * 1024,
      files: 1,
    },
  });

  // ─── Swagger Documentation ─────────────────────
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'CLB DApp Backend API',
        description: 'REST API for CLB Decentralized Application — Pools, Referrals, Blockchain Integration',
        version: '1.0.0',
        contact: {
          name: 'CLB Team',
        },
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      tags: [
        { name: 'Auth', description: 'Authentication & wallet verification' },
        { name: 'Pools', description: 'Staking & liquidity pool management' },
        { name: 'Referrals', description: 'Referral system & rewards' },
        { name: 'Prices', description: 'Live cryptocurrency prices' },
        { name: 'Transactions', description: 'Transaction history' },
        { name: 'User Dashboard', description: 'User personal dashboard, portfolio, referrals & market data' },
        { name: 'Health', description: 'System health checks' },
        { name: 'Credit Wallet', description: 'BEP-20 USDT treasury receive, in-app balances, pool credit claim' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
  });

  // ─── Health Check Route ────────────────────────
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns the status of the API, database, and blockchain connections',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
              database: { type: 'string' },
              blockchain: { type: 'string' },
              clbOnChain: {
                type: 'object',
                properties: {
                  configured: { type: 'boolean' },
                  hasTokenAddress: { type: 'boolean' },
                  hasPrivateKey: { type: 'boolean' },
                  hasAbi: { type: 'boolean' },
                  chainId: { type: 'number' },
                  abiResolvedFrom: { type: ['string', 'null'] },
                  cwd: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      let dbStatus = 'disconnected';
      let blockchainStatus = 'disconnected';

      try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
      } catch {
        dbStatus = 'error';
      }

      try {
        const connected = await verifyConnection();
        blockchainStatus = connected ? 'connected' : 'error';
      } catch {
        blockchainStatus = 'error';
      }

      const clb = tokenService.getConfigStatus('CLB');

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbStatus,
        blockchain: blockchainStatus,
        /** Why transfers fail with "not configured" — check hasAbi, abiResolvedFrom. */
        clbOnChain: {
          configured: clb.configured,
          hasTokenAddress: clb.hasTokenAddress,
          hasPrivateKey: clb.hasPrivateKey,
          hasAbi: clb.hasAbi,
          chainId: clb.chainId,
          abiResolvedFrom: clb.abiResolvedFrom,
          cwd: clb.cwd,
        },
      };
    }
  );

  // ─── Register Routes ──────────────────────────
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(poolRoutes, { prefix: '/api/pools' });
  await fastify.register(referralRoutes, { prefix: '/api/referrals' });
  await fastify.register(priceRoutes, { prefix: '/api/prices' });
  await fastify.register(transactionRoutes, { prefix: '/api/transactions' });
  await fastify.register(adminRoutes, { prefix: '/api/admin' });
  await fastify.register(userDashboardRoutes, { prefix: '/api/user' });
  await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
  await fastify.register(loanRoutes, { prefix: '/api/loans' });
  await fastify.register(tokenRoutes, { prefix: '/api/tokens' });
  await fastify.register(withdrawalRoutes, { prefix: '/api/withdrawals' });
  await fastify.register(miningPackageRoutes, { prefix: '/api/mining-packages' });
  await fastify.register(userMiningRoutes, { prefix: '/api/mining' });
  await fastify.register(creditWalletRoutes, { prefix: '/api/credit-wallet' });
  await fastify.register(mobileAppPublicPlugin, { prefix: '/api/public' });
  await fastify.register(mobileAppAdminPlugin, { prefix: '/api/admin/mobile-app' });

  // ─── Root: JSON discovery (production) or static DApp (development) ──
  if (env.NODE_ENV !== 'development') {
    fastify.get('/', async () => ({
      name: 'CLB DApp Backend',
      version: '1.0.0',
      docs: `/docs`,
      health: `/health`,
      endpoints: {
        auth: '/api/auth',
        pools: '/api/pools',
        referrals: '/api/referrals',
        prices: '/api/prices',
        transactions: '/api/transactions',
        admin: '/api/admin',
        adminPoolPackages: '/api/admin/pool-packages',
        user: '/api/user',
        loans: '/api/loans',
        tokens: '/api/tokens',
        withdrawals: '/api/withdrawals',
        miningPackages: '/api/mining-packages',
        mining: '/api/mining',
        creditWallet: '/api/credit-wallet',
        publicMobileApp: '/api/public/mobile-app',
        adminMobileApp: '/api/admin/mobile-app',
      },
    }));
  }

  // Serve `app.cryptoloanboost.com/` from API origin in dev so DApp + `/api/*` share localhost
  if (env.NODE_ENV === 'development') {
    const dappRoot = path.join(__dirname, '..', 'app.cryptoloanboost.com');
    await fastify.register(fastifyStatic, {
      root: dappRoot,
      prefix: '/',
      decorateReply: false,
    });
  }

  return fastify;
};

// ─── Start Server ─────────────────────────────────
const start = async () => {
  try {
    const app = await buildApp();

    // Connect to database
    await prisma.$connect();
    console.log('🗄️  Database connected');

    // Verify blockchain connection
    await verifyConnection();

    // Start blockchain event listeners
    eventService.startListening();

    // Start auto-liquidation price monitoring
    liquidationService.startMonitoring();

    // Start server
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`\n🚀 Server running at http://localhost:${env.PORT}`);
    console.log(`📖 Swagger docs at http://localhost:${env.PORT}/docs\n`);
  } catch (err) {
    console.error('❌ Server startup failed:', err);
    process.exit(1);
  }
};

start();
