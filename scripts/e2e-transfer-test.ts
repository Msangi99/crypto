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
 *   E2E_SKIP_SEED=1                (skip DB balance seed — use if sender already has CLB)
 *
 * DATABASE_URL in .env must be the same database your API uses (local or production).
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

  console.log('1) Health / CLB on-chain config:', `${apiUrl}/health`);
  const healthRes = await fetch(`${apiUrl}/health`);
  const health = await healthRes.json();
  console.log(JSON.stringify(health.clbOnChain, null, 2));
  if (!health.clbOnChain?.configured) {
    console.error('\n❌ Server reports CLB on-chain NOT configured. Fix ABI path + env on this server, then retry.');
    process.exit(1);
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

  if (process.env.E2E_SKIP_SEED !== '1') {
    const prisma = new PrismaClient();
    try {
      console.log('\n3) Seed ledger balance (CLB) for sender in DB (same DATABASE_URL as API)');
      await prisma.tokenBalance.upsert({
        where: { userId_token: { userId, token: 'CLB' } },
        create: { userId, token: 'CLB', balance: 1_000_000 },
        update: { balance: 1_000_000 },
      });
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log('\n3) Skip seed (E2E_SKIP_SEED=1) — sender must already have CLB ledger balance');
  }

  const netStr = `${amount} CLB (1% fee applies to external)`;
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
