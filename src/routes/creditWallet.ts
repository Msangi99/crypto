import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { env } from '../config/env';
import { authMiddleware } from '../middleware/auth';
import { depositConfirmRateLimit } from '../middleware/rateLimit';
import { resolveTreasuryUsdtConfig, verifyUsdtTreasuryDeposit } from '../services/treasuryUsdtDeposit';
import { monitorTreasuryDeposits } from '../services/treasuryDepositMonitor';

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
  requestDeposit: {
    tags: ['Credit Wallet'],
    summary: 'Create a pending deposit request',
    description:
      'Creates a PENDING deposit record with the requested amount and chain. Admin sees it immediately in the Deposit Requests page.',
    body: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Deposit amount in USDT' },
        chain: { type: 'string', description: 'Network chain (e.g. BSC)' },
      },
      required: ['amount'],
    },
  },
  confirmDeposit: {
    tags: ['Credit Wallet'],
    summary: 'Confirm BEP-20 USDT treasury deposit',
    description:
      'Attaches a txHash to an existing PENDING deposit and verifies on-chain. If no depositId is provided, creates one.',
    body: {
      type: 'object',
      properties: {
        txHash: { type: 'string' },
        depositId: { type: 'string', description: 'Optional ID of the pending deposit request to confirm' },
      },
      required: ['txHash'],
    },
  },
  poolEligibility: {
    tags: ['Credit Wallet'],
    summary: 'Pool claim eligibility (app credit)',
    description:
      'Which pools support credit claim and whether the user can claim each pool now. Claim fee is paid from deposit credit only (loan credit is not used).',
  },
  depositHistory: {
    tags: ['Credit Wallet'],
    summary: 'User deposit history',
    description: 'List of all USDT treasury deposits for the authenticated user.',
  },
  monitorDeposits: {
    tags: ['Admin'],
    summary: 'Trigger treasury deposit monitoring',
    description: 'Manually trigger automatic deposit detection (admin only). Should be called periodically by cron job.',
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
      const { treasury, usdt, minConfirmations, minDepositUsd } = await resolveTreasuryUsdtConfig();
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
          minDepositUsd,
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
          referralEarningsUsd: true,
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
          referralEarningsUsd: num(user.referralEarningsUsd),
        },
      };
    }
  );

  // ─── POST /request-deposit — create a PENDING deposit request ─────
  fastify.post<{ Body: { amount: number; chain?: string } }>(
    '/request-deposit',
    { schema: schemas.requestDeposit, preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { amount: number; chain?: string } }>, reply: FastifyReply) => {
      const amt = Number(request.body?.amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return reply.status(400).send({ success: false, error: 'Amount must be a positive number' });
      }

      const chain = (request.body?.chain || 'BSC').trim().toUpperCase();

      const { treasury, minDepositUsd } = await resolveTreasuryUsdtConfig();
      if (!treasury) {
        return reply.status(503).send({
          success: false,
          error: 'Treasury address not configured',
        });
      }

      if (minDepositUsd && amt < minDepositUsd) {
        return reply.status(400).send({
          success: false,
          error: `Minimum deposit is $${minDepositUsd} USDT`,
        });
      }

      const user = await prisma.user.findUnique({ where: { id: request.userId! } });
      if (!user?.walletAddress) {
        return reply.status(400).send({ success: false, error: 'User wallet not set' });
      }

      const deposit = await prisma.deposit.create({
        data: {
          userId: user.id,
          poolId: null,
          amount: new Prisma.Decimal(amt),
          amountUsd: new Prisma.Decimal(amt),
          chain,
          fromAddress: user.walletAddress,
          toAddress: treasury,
          txHash: null,
          status: 'PENDING',
          confirmations: 0,
        },
      });

      return {
        success: true,
        deposit: {
          id: deposit.id,
          amount: num(deposit.amount),
          amountUsd: num(deposit.amountUsd),
          chain: deposit.chain,
          fromAddress: deposit.fromAddress,
          toAddress: deposit.toAddress,
          status: deposit.status,
          createdAt: deposit.createdAt,
        },
      };
    }
  );

  // ─── POST /confirm-deposit — attach txHash and verify on-chain ─────
  fastify.post<{ Body: { txHash: string; depositId?: string } }>(
    '/confirm-deposit',
    { schema: schemas.confirmDeposit, preHandler: [authMiddleware, depositConfirmRateLimit] },
    async (request: FastifyRequest<{ Body: { txHash: string; depositId?: string } }>, reply: FastifyReply) => {
      const raw = request.body?.txHash?.trim() || '';
      if (!raw.startsWith('0x') || raw.length < 66) {
        return reply.status(400).send({ success: false, error: 'Invalid transaction hash' });
      }
      const txHash = raw;
      const bodyDepositId = request.body?.depositId?.trim() || null;

      const { treasury, usdt, minDepositUsd } = await resolveTreasuryUsdtConfig();
      if (!treasury) {
        return reply.status(503).send({
          success: false,
          error: 'Treasury address not configured — admin must set depositTreasuryAddress in platform settings',
        });
      }
      if (!usdt) {
        return reply.status(503).send({ success: false, error: 'USDT contract not configured' });
      }

      // Check if this txHash was already used
      const existingByHash = await prisma.deposit.findUnique({ where: { txHash } });
      if (existingByHash && existingByHash.status === 'CONFIRMED') {
        return reply.status(409).send({
          success: false,
          error: 'This transaction was already used for a deposit',
        });
      }

      const user = await prisma.user.findUnique({ where: { id: request.userId! } });
      if (!user?.walletAddress) {
        return reply.status(400).send({ success: false, error: 'User wallet not set' });
      }

      // Resolve the deposit record to update
      let depositId: string | undefined;

      if (bodyDepositId) {
        // User is confirming a specific pending deposit request
        const pendingDeposit = await prisma.deposit.findUnique({ where: { id: bodyDepositId } });
        if (!pendingDeposit) {
          return reply.status(404).send({ success: false, error: 'Deposit request not found' });
        }
        if (pendingDeposit.userId !== request.userId) {
          return reply.status(403).send({ success: false, error: 'This deposit does not belong to you' });
        }
        if (pendingDeposit.status === 'CONFIRMED') {
          return reply.status(409).send({ success: false, error: 'This deposit is already confirmed' });
        }
        // Attach the txHash to this deposit
        await prisma.deposit.update({
          where: { id: bodyDepositId },
          data: { txHash },
        });
        depositId = bodyDepositId;
      } else if (existingByHash) {
        depositId = existingByHash.id;
      } else {
        // No deposit request exists — create one on the fly
        try {
          const pending = await prisma.deposit.create({
            data: {
              userId: user.id,
              poolId: null,
              amount: new Prisma.Decimal(0),
              amountUsd: new Prisma.Decimal(0),
              chain: 'BSC',
              fromAddress: user.walletAddress,
              toAddress: treasury,
              txHash,
              status: 'PENDING',
              confirmations: 0,
            },
          });
          depositId = pending.id;
        } catch (e: unknown) {
          const code = e && typeof e === 'object' && 'code' in e ? (e as { code?: string }).code : '';
          if (code === 'P2002') {
            return reply.status(409).send({ success: false, error: 'This transaction was already recorded' });
          }
          throw e;
        }
      }

      // Attempt on-chain verification
      let amount: Prisma.Decimal;
      try {
        const v = await verifyUsdtTreasuryDeposit(txHash, user.walletAddress, treasury, usdt, minDepositUsd);
        amount = v.amount;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Verification failed';
        await prisma.deposit.update({
          where: { id: depositId },
          data: { status: 'FAILED' },
        });
        return reply.status(400).send({
          success: false,
          error: msg,
          depositStatus: 'FAILED',
          message: 'Deposit recorded as failed. Admin can review and update status manually.',
        });
      }

      if (amount.lte(0)) {
        await prisma.deposit.update({
          where: { id: depositId },
          data: { status: 'FAILED' },
        });
        return reply.status(400).send({
          success: false,
          error: 'Zero amount detected on-chain',
          depositStatus: 'FAILED',
        });
      }

      // Verification passed — confirm deposit and credit user
      try {
        const updated = await prisma.$transaction(async (tx) => {
          await tx.deposit.update({
            where: { id: depositId },
            data: {
              amount,
              amountUsd: amount,
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
          return reply.status(409).send({ success: false, error: 'This transaction was already recorded' });
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

  fastify.get(
    '/deposit-history',
    { schema: schemas.depositHistory, preHandler: [authMiddleware] },
    async (request: FastifyRequest) => {
      const deposits = await prisma.deposit.findMany({
        where: {
          userId: request.userId!,
          poolId: null, // Only treasury deposits (not pool deposits)
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          amountUsd: true,
          chain: true,
          fromAddress: true,
          toAddress: true,
          txHash: true,
          status: true,
          confirmations: true,
          confirmedAt: true,
          createdAt: true,
        },
      });

      return {
        success: true,
        deposits: deposits.map((d) => ({
          id: d.id,
          amount: num(d.amount),
          amountUsd: num(d.amountUsd),
          chain: d.chain,
          fromAddress: d.fromAddress,
          toAddress: d.toAddress,
          txHash: d.txHash,
          status: d.status,
          confirmations: d.confirmations,
          confirmedAt: d.confirmedAt,
          createdAt: d.createdAt,
        })),
      };
    }
  );

  // Admin-only endpoint to trigger treasury deposit monitoring
  fastify.post(
    '/monitor-deposits',
    { schema: schemas.monitorDeposits, preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Admin-only check
      if (request.userRole !== 'ADMIN') {
        return reply.status(403).send({ success: false, error: 'Admin access required' });
      }

      const result = await monitorTreasuryDeposits();
      return {
        success: true,
        processed: result.processed,
        errors: result.errors,
      };
    }
  );
}
