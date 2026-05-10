import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { env } from '../config/env';
import { authMiddleware } from '../middleware/auth';
import { resolveTreasuryUsdtConfig, verifyUsdtTreasuryDeposit } from '../services/treasuryUsdtDeposit';

const schemas = {
  config: {
    tags: ['Credit Wallet'],
    summary: 'Public receive / USDT deposit config',
    description: 'Chain, USDT contract, treasury address (if configured), and confirmation policy.',
  },
  balances: {
    tags: ['Credit Wallet'],
    summary: 'In-app USD balances',
    description: 'Deposit credit, pool-claimed credit (loan balance), and swapped holdings (USD).',
  },
  confirmDeposit: {
    tags: ['Credit Wallet'],
    summary: 'Confirm BEP-20 USDT treasury deposit',
    description:
      'Verifies on-chain USDT Transfer from the authenticated user wallet to the admin treasury, then credits deposit balance.',
    body: {
      type: 'object',
      properties: { txHash: { type: 'string' } },
      required: ['txHash'],
    },
  },
  poolEligibility: {
    tags: ['Credit Wallet'],
    summary: 'Pool claim eligibility (app credit)',
    description:
      'Which pools support credit claim and whether the user can claim each pool now. Claim fee is paid from deposit credit only (loan credit is not used).',
  },
};

function num(d: Prisma.Decimal | null | undefined): number {
  if (d == null) return 0;
  return Number(d.toString());
}

export default async function creditWalletRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/config',
    { schema: schemas.config },
    async (_request, reply: FastifyReply) => {
      const { treasury, usdt, minConfirmations } = await resolveTreasuryUsdtConfig();
      if (!usdt) {
        return reply.status(503).send({
          success: false,
          error: 'USDT contract not configured',
        });
      }
      return {
        success: true,
        config: {
          chainId: env.CHAIN_ID,
          networkLabel: env.CHAIN_ID === 56 ? 'BSC Mainnet' : 'BSC Testnet',
          assetSymbol: 'USDT',
          assetStandard: 'BEP-20',
          usdtContractAddress: usdt,
          treasuryAddress: treasury,
          minConfirmations,
          treasuryConfigured: Boolean(treasury),
        },
      };
    }
  );

  fastify.get(
    '/balances',
    { schema: schemas.balances, preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.userId! },
        select: {
          depositCreditUsd: true,
          claimedPoolCreditUsd: true,
          swapHoldingsUsd: true,
        },
      });
      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }
      return {
        success: true,
        balances: {
          depositCreditUsd: num(user.depositCreditUsd),
          claimedPoolCreditUsd: num(user.claimedPoolCreditUsd),
          swapHoldingsUsd: num(user.swapHoldingsUsd),
        },
      };
    }
  );

  fastify.post<{ Body: { txHash: string } }>(
    '/confirm-deposit',
    { schema: schemas.confirmDeposit, preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { txHash: string } }>, reply: FastifyReply) => {
      const raw = request.body?.txHash?.trim() || '';
      if (!raw.startsWith('0x') || raw.length < 66) {
        return reply.status(400).send({ success: false, error: 'Invalid transaction hash' });
      }
      const txHash = raw;

      const { treasury, usdt } = await resolveTreasuryUsdtConfig();
      if (!treasury) {
        return reply.status(503).send({
          success: false,
          error: 'Treasury address not configured — admin must set depositTreasuryAddress in platform settings',
        });
      }
      if (!usdt) {
        return reply.status(503).send({ success: false, error: 'USDT contract not configured' });
      }

      const existing = await prisma.deposit.findUnique({ where: { txHash } });
      if (existing) {
        return reply.status(409).send({
          success: false,
          error: 'This transaction was already used for a deposit',
        });
      }

      const user = await prisma.user.findUnique({ where: { id: request.userId! } });
      if (!user?.walletAddress) {
        return reply.status(400).send({ success: false, error: 'User wallet not set' });
      }

      let amount: Prisma.Decimal;
      try {
        const v = await verifyUsdtTreasuryDeposit(txHash, user.walletAddress, treasury, usdt);
        amount = v.amount;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Verification failed';
        return reply.status(400).send({ success: false, error: msg });
      }

      if (amount.lte(0)) {
        return reply.status(400).send({ success: false, error: 'Zero amount' });
      }

      try {
        const updated = await prisma.$transaction(async (tx) => {
          await tx.deposit.create({
            data: {
              userId: user.id,
              poolId: null,
              amount,
              amountUsd: amount,
              chain: 'BSC',
              fromAddress: user.walletAddress,
              toAddress: treasury,
              txHash,
              status: 'CONFIRMED',
              confirmations: env.USDT_DEPOSIT_MIN_CONFIRMATIONS,
              confirmedAt: new Date(),
            },
          });

          await tx.transaction.create({
            data: {
              userId: user.id,
              type: 'DEPOSIT',
              amount,
              txHash,
              status: 'SUCCESS',
              fromAddress: user.walletAddress,
              toAddress: treasury,
              metadata: {
                kind: 'TREASURY_USDT',
                usdtContract: usdt,
              },
            },
          });

          return tx.user.update({
            where: { id: user.id },
            data: { depositCreditUsd: { increment: amount } },
            select: { depositCreditUsd: true },
          });
        });

        return {
          success: true,
          creditedUsd: num(amount),
          newDepositCreditUsd: num(updated.depositCreditUsd),
        };
      } catch (e: unknown) {
        const code = e && typeof e === 'object' && 'code' in e ? (e as { code?: string }).code : '';
        if (code === 'P2002') {
          return reply.status(409).send({
            success: false,
            error: 'This transaction was already recorded',
          });
        }
        throw e;
      }
    }
  );

  fastify.get(
    '/pool-eligibility',
    { schema: schemas.poolEligibility, preHandler: [authMiddleware] },
    async (request: FastifyRequest) => {
      const user = await prisma.user.findUnique({
        where: { id: request.userId! },
        select: { depositCreditUsd: true, claimedPoolCreditUsd: true },
      });
      const depositAvail = user ? new Prisma.Decimal(user.depositCreditUsd.toString()) : new Prisma.Decimal(0);
      const loanAvail = user ? new Prisma.Decimal(user.claimedPoolCreditUsd.toString()) : new Prisma.Decimal(0);

      const pools = await prisma.pool.findMany({
        where: { supportsAppCredit: true },
        select: {
          id: true,
          name: true,
          status: true,
          minDeposit: true,
          creditMinUsd: true,
          creditCreditedUsd: true,
          supportsAppCredit: true,
        },
      });

      const rows = pools.map((p) => {
        const min = p.creditMinUsd ?? p.minDeposit;
        const minN = new Prisma.Decimal(min.toString());
        const loanRaw = p.creditCreditedUsd;
        const loanConfigured =
          loanRaw != null && new Prisma.Decimal(loanRaw.toString()).gt(0);
        const loanCreditUsd = loanConfigured ? num(loanRaw) : null;
        const poolActive = p.status === 'ACTIVE';
        const canClaim = poolActive && loanConfigured && depositAvail.gte(minN);
        return {
          poolId: p.id,
          name: p.name,
          poolStatus: p.status,
          supportsAppCredit: p.supportsAppCredit,
          /** Claim fee (USD) — payable from deposit credit only */
          creditMinUsd: num(min),
          /** Loan balance (USD) after claim — null if admin did not set creditCreditedUsd */
          creditCreditedUsd: loanCreditUsd,
          packageMisconfigured: !loanConfigured,
          canClaimWithCredit: canClaim,
        };
      });

      return {
        success: true,
        depositCreditUsd: num(depositAvail),
        claimedPoolCreditUsd: num(loanAvail),
        /** USD available to pay pool claim fees (deposit wallet only). */
        claimFeeSpendableUsd: num(depositAvail),
        pools: rows,
      };
    }
  );
}
