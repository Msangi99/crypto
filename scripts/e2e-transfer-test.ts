/**
 * End-to-end transfer test (same DB + API as .env):
 * 1) POST /api/auth/dev-login — creates/finds sender user
 * 2) Prisma — credits CLB ledger balance for sender
 * 3) POST /api/tokens/transfer — ON_CHAIN to recipient
 *
 * Usage:
 *   npm run dev   # terminal 1
 *   npx ts-node --transpile-only scripts/e2e-transfer-test.ts 0xRecipient... 1
 *
 * Env:
 *   API_URL=http://localhost:3000   (default)
 *   E2E_FROM_WALLET=0x...          (optional test sender; default below)
 *   E2E_SKIP_SEED=1              (skip DB balance seed)
 *   E2E_ALLOW_PROD_SEED=1        (allow Prisma seed when API_URL is production — only if DATABASE_URL is that DB)
 *   E2E_STRICT_HEALTH=1          (exit if /health has no clbOnChain or configured=false)
 *
 * DATABASE_URL in .env must be the same database your API uses (local or production).
 * Remote API: use E2E_SKIP_SEED=1 unless DATABASE_URL points at that server’s Postgres.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const DEFAULT_API = 'http://localhost:3000';
const DEFAULT_FROM = '0x1111111111111111111111111111111111111111';

async function main() {
  const apiUrl = (process.env.API_URL || DEFAULT_API).replace(/\/$/, '');
  const toAddress = process.argv[2] || '0xF702c05006426B0E6bAd3C44ACF92dBf437FA02f';
  const amount = parseFloat(process.argv[3] || '1');
  const fromWallet = (process.env.E2E_FROM_WALLET || DEFAULT_FROM).toLowerCase();

  if (!/^0x[a-f0-9]{40}$/.test(toAddress.toLowerCase())) {
    console.error('Invalid toAddress');
    process.exit(1);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('Invalid amount');
    process.exit(1);
  }

  console.log('1) GET /health:', `${apiUrl}/health`);
  const healthRes = await fetch(`${apiUrl}/health`);
  const health = (await healthRes.json()) as Record<string, unknown>;

  if (health.clbOnChain && typeof health.clbOnChain === 'object') {
    console.log('clbOnChain:', JSON.stringify(health.clbOnChain, null, 2));
    const c = health.clbOnChain as { configured?: boolean; hasAbi?: boolean; abiResolvedFrom?: string | null };
    if (!c.configured && process.env.E2E_STRICT_HEALTH === '1') {
      console.error('\n❌ E2E_STRICT_HEALTH=1 and clbOnChain.configured is false. Fix ABI + env on server, redeploy, retry.');
      process.exit(1);
    }
    if (!c.configured) {
      console.warn(
        '\n⚠️  Server says CLB on-chain not fully configured (hasAbi / key / address). Continuing anyway — transfer will show the real API error.\n' +
          '   If clbOnChain is missing entirely, deploy the latest backend (health must include clbOnChain for quick checks).\n' +
          '   Docker: CLB_TOKEN_ABI_PATH must exist *inside the container* (not only on the host under /root/crypto).',
      );
    }
  } else {
    console.warn(
      '\n⚠️  /health has no clbOnChain field — production is probably still on an older backend build.\n' +
        '   Deploy the latest code, then /health will show hasAbi + abiResolvedFrom.\n' +
        '   Continuing to dev-login + transfer so you still see the live API response…\n',
    );
    console.log('(raw health keys):', Object.keys(health).join(', '));
  }

  console.log('\n2) dev-login sender:', fromWallet);
  const loginRes = await fetch(`${apiUrl}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress: fromWallet }),
  });
  const loginJson = await loginRes.json();
  if (!loginRes.ok || !loginJson.token) {
    console.error('dev-login failed:', loginJson);
    process.exit(1);
  }
  const token = loginJson.token as string;
  const userId = loginJson.user?.id as string;

  const remoteProd = /cryptoloanboost\.com/i.test(apiUrl);
  const allowSeed = process.env.E2E_SKIP_SEED !== '1' && (!remoteProd || process.env.E2E_ALLOW_PROD_SEED === '1');

  if (allowSeed) {
    const prisma = new PrismaClient();
    try {
      console.log('\n3) Seed ledger balance (CLB) for sender (DATABASE_URL from this machine must match API DB)');
      await prisma.tokenBalance.upsert({
        where: { userId_token: { userId, token: 'CLB' } },
        create: { userId, token: 'CLB', balance: 1_000_000 },
        update: { balance: 1_000_000 },
      });
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log(
      remoteProd
        ? '\n3) Skip DB seed for production API (set E2E_ALLOW_PROD_SEED=1 only if DATABASE_URL is production Postgres). Sender needs CLB balance in DB.'
        : '\n3) Skip seed (E2E_SKIP_SEED=1)',
    );
  }

  console.log(`\n4) POST /api/tokens/transfer → ${toAddress} amount ${amount}`);
  const txRes = await fetch(`${apiUrl}/api/tokens/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      toAddress,
      token: 'CLB',
      amount,
      delivery: 'ON_CHAIN',
      note: 'e2e-transfer-test',
    }),
  });
  const txJson = await txRes.json();
  console.log('Status:', txRes.status);
  console.log(JSON.stringify(txJson, null, 2));

  if (!txRes.ok) {
    process.exit(1);
  }
  console.log('\n✅ Transfer API OK. Check explorerUrl / txHash above.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
