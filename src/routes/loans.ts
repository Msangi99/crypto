import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { tokenService } from '../services/tokenService';
import { creditLineService } from '../services/creditLineService';
import { priceService } from '../services/priceService';

// CLB Token tiers based on collateral value
const TOKEN_TIERS: Record<string, { minUsd: number; token: string; ltv: number; interest: number }> = {
  CLBg: { minUsd: 5000, token: 'CLBg', ltv: 60, interest: 5 },   // Gold tier: $5k+
  CLBs: { minUsd: 1000, token: 'CLBs', ltv: 50, interest: 8 },   // Silver tier: $1k+
  CLB:  { minUsd: 100,  token: 'CLB',  ltv: 40, interest: 12 },   // Standard tier: $100+
};

function getTier(usdValue: number): typeof TOKEN_TIERS[string] {
  if (usdValue >= 5000) return TOKEN_TIERS.CLBg;
  if (usdValue >= 1000) return TOKEN_TIERS.CLBs;
  return TOKEN_TIERS.CLB;
}

export default async function loanRoutes(fastify: FastifyInstance) {

  // ─── POST /loans/request — Request a new loan ──────────
  fastify.post<{
    Body: {
      collateralChain: string;
      collateralAmount: number;
      collateralPriceUsd: number;
      targetPriceUsd?: number;
    };
  }>(
    '/request',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{
      Body: {
        collateralChain: string;
        collateralAmount: number;
        collateralPriceUsd: number;
        targetPriceUsd?: number;
      };
    }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { collateralChain, collateralAmount, collateralPriceUsd, targetPriceUsd } = request.body;

      if (!collateralChain || !collateralAmount || !collateralPriceUsd) {
        return reply.status(400).send({ success: false, error: 'Missing required fields' });
      }
      if (collateralAmount <= 0) {
        return reply.status(400).send({ success: false, error: 'Amount must be positive' });
      }

      const collateralValueUsd = collateralAmount * collateralPriceUsd;
      const tier = getTier(collateralValueUsd);
      const loanAmount = (collateralValueUsd * tier.ltv) / 100;
      const target = targetPriceUsd || collateralPriceUsd * 1.5; // Default: 50% price increase

      // Liquidation price: price at which LTV hits 80% (margin call)
      // loanAmount / (collateralAmount * liquidationPrice) = 0.80
      // liquidationPrice = loanAmount / (collateralAmount * 0.80)
      const liquidationPrice = loanAmount / (collateralAmount * 0.80);

      // Create loan
      const loan = await prisma.loan.create({
        data: {
          userId,
          collateralChain: collateralChain.toUpperCase(),
          collateralAmount,
          collateralPriceUsd,
          collateralValueUsd,
          loanAmount,
          loanToken: tier.token,
          targetPriceUsd: target,
          ltvPercent: tier.ltv,
          interestRate: tier.interest,
          liquidationPriceUsd: liquidationPrice,
          status: 'PENDING',
        },
      });

      // Create a deposit record for tracking
      await prisma.deposit.create({
        data: {
          userId,
          amount: collateralAmount,
          amountUsd: collateralValueUsd,
          chain: collateralChain.toUpperCase(),
          status: 'PENDING',
          loanId: loan.id,
        },
      });

      // Notify user
      await prisma.notification.create({
        data: {
          userId,
          type: 'LOAN',
          title: 'Loan Request Created',
          body: `Your ${tier.token} loan request for ${loanAmount.toFixed(2)} tokens is pending. Please send ${collateralAmount} ${collateralChain.toUpperCase()} to complete.`,
          data: { loanId: loan.id, token: tier.token, amount: loanAmount },
        },
      });

      return {
        success: true,
        loan: {
          id: loan.id,
          collateralChain: loan.collateralChain,
          collateralAmount: Number(loan.collateralAmount),
          collateralValueUsd: Number(loan.collateralValueUsd),
          loanAmount: Number(loan.loanAmount),
          loanToken: loan.loanToken,
          targetPriceUsd: Number(loan.targetPriceUsd),
          ltvPercent: Number(loan.ltvPercent),
          interestRate: Number(loan.interestRate),
          status: loan.status,
          createdAt: loan.createdAt,
        },
      };
    }
  );

  // ─── POST /loans/:id/confirm-deposit — Confirm deposit & issue tokens ─
  fastify.post<{ Params: { id: string }; Body: { txHash: string } }>(
    '/:id/confirm-deposit',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { txHash: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { id } = request.params;
      const { txHash } = request.body;

      if (!txHash) {
        return reply.status(400).send({ success: false, error: 'txHash is required' });
      }

      const loan = await prisma.loan.findFirst({
        where: { id, userId, status: 'PENDING' },
        include: { deposits: true },
      });

      if (!loan) {
        return reply.status(404).send({ success: false, error: 'Loan not found or not pending' });
      }

      // Update deposit with txHash
      const deposit = loan.deposits[0];
      if (deposit) {
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: { txHash, status: 'CONFIRMING', confirmations: 1 },
        });
      }

      // Activate loan & issue CLB tokens
      const [updatedLoan] = await prisma.$transaction([
        prisma.loan.update({
          where: { id },
          data: { status: 'ACTIVE' },
        }),
        // Upsert token balance
        prisma.tokenBalance.upsert({
          where: { userId_token: { userId, token: loan.loanToken } },
          create: { userId, token: loan.loanToken, balance: loan.loanAmount },
          update: { balance: { increment: loan.loanAmount } },
        }),
        // Record token transfer
        prisma.tokenTransfer.create({
          data: {
            fromUserId: userId,
            token: loan.loanToken,
            amount: loan.loanAmount,
            type: 'LOAN_ISSUE',
            status: 'COMPLETED',
            txHash,
            note: `Loan #${id.slice(0, 8)} — ${loan.collateralAmount} ${loan.collateralChain} collateral`,
          },
        }),
        // Confirm deposit
        prisma.deposit.update({
          where: { id: deposit?.id },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        }),
        // Transaction log
        prisma.transaction.create({
          data: {
            userId,
            type: 'LOAN',
            amount: loan.loanAmount,
            txHash,
            status: 'SUCCESS',
            metadata: {
              loanId: id,
              token: loan.loanToken,
              collateral: `${loan.collateralAmount} ${loan.collateralChain}`,
            },
          },
        }),
      ]);

      // Mint tokens on-chain (so they appear in Trust Wallet)
      let onChainTxHash: string | undefined;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.walletAddress && tokenService.isConfigured()) {
        try {
          const mintResult = await tokenService.mint(
            loan.loanToken,
            user.walletAddress,
            Number(loan.loanAmount)
          );
          onChainTxHash = mintResult?.txHash;
        } catch (err: any) {
          console.error('[Loan] On-chain mint failed (tokens still tracked in DB):', err.message);
        }
      }

      // Notify
      await prisma.notification.create({
        data: {
          userId,
          type: 'LOAN',
          title: `${loan.loanToken} Tokens Issued!`,
          body: `${Number(loan.loanAmount).toFixed(2)} ${loan.loanToken} tokens have been added to your wallet.${onChainTxHash ? ' Check Trust Wallet!' : ''}`,
          data: { loanId: id, amount: Number(loan.loanAmount), onChainTxHash },
        },
      });

      return {
        success: true,
        message: `${Number(loan.loanAmount).toFixed(2)} ${loan.loanToken} tokens issued to your wallet`,
        loan: {
          id: updatedLoan.id,
          status: updatedLoan.status,
          loanAmount: Number(updatedLoan.loanAmount),
          loanToken: updatedLoan.loanToken,
        },
        onChainTxHash,
      };
    }
  );

  // ─── GET /loans — List user loans ─────────────────────
  fastify.get(
    '/',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;

      const loans = await prisma.loan.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { deposits: { select: { txHash: true, status: true } } },
      });

      return {
        success: true,
        loans: loans.map((l) => ({
          id: l.id,
          collateralChain: l.collateralChain,
          collateralAmount: Number(l.collateralAmount),
          collateralPriceUsd: Number(l.collateralPriceUsd),
          collateralValueUsd: Number(l.collateralValueUsd),
          loanAmount: Number(l.loanAmount),
          loanToken: l.loanToken,
          targetPriceUsd: Number(l.targetPriceUsd),
          ltvPercent: Number(l.ltvPercent),
          interestRate: Number(l.interestRate),
          liquidationPriceUsd: l.liquidationPriceUsd ? Number(l.liquidationPriceUsd) : null,
          settlementPriceUsd: l.settlementPriceUsd ? Number(l.settlementPriceUsd) : null,
          profitUsd: l.profitUsd ? Number(l.profitUsd) : null,
          platformFeeUsd: l.platformFeeUsd ? Number(l.platformFeeUsd) : null,
          status: l.status,
          createdAt: l.createdAt,
          settledAt: l.settledAt,
          liquidatedAt: l.liquidatedAt,
          deposits: l.deposits,
        })),
      };
    }
  );

  // ─── GET /loans/:id — Loan detail ─────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { id } = request.params;

      const loan = await prisma.loan.findFirst({
        where: { id, userId },
        include: { deposits: true },
      });

      if (!loan) {
        return reply.status(404).send({ success: false, error: 'Loan not found' });
      }

      return {
        success: true,
        loan: {
          id: loan.id,
          collateralChain: loan.collateralChain,
          collateralAmount: Number(loan.collateralAmount),
          collateralPriceUsd: Number(loan.collateralPriceUsd),
          collateralValueUsd: Number(loan.collateralValueUsd),
          loanAmount: Number(loan.loanAmount),
          loanToken: loan.loanToken,
          targetPriceUsd: Number(loan.targetPriceUsd),
          ltvPercent: Number(loan.ltvPercent),
          interestRate: Number(loan.interestRate),
          liquidationPriceUsd: loan.liquidationPriceUsd ? Number(loan.liquidationPriceUsd) : null,
          settlementPriceUsd: loan.settlementPriceUsd ? Number(loan.settlementPriceUsd) : null,
          profitUsd: loan.profitUsd ? Number(loan.profitUsd) : null,
          platformFeeUsd: loan.platformFeeUsd ? Number(loan.platformFeeUsd) : null,
          status: loan.status,
          createdAt: loan.createdAt,
          settledAt: loan.settledAt,
          liquidatedAt: loan.liquidatedAt,
          deposits: loan.deposits.map((d) => ({
            id: d.id,
            amount: Number(d.amount),
            chain: d.chain,
            txHash: d.txHash,
            status: d.status,
            confirmedAt: d.confirmedAt,
          })),
        },
      };
    }
  );

  // ─── GET /loans/tiers — Available loan tiers ──────────
  fastify.get('/tiers', async () => {
    return {
      success: true,
      tiers: Object.entries(TOKEN_TIERS).map(([key, t]) => ({
        token: t.token,
        minUsd: t.minUsd,
        ltv: t.ltv,
        interestRate: t.interest,
        description: key === 'CLBg' ? 'Gold Tier' : key === 'CLBs' ? 'Silver Tier' : 'Standard Tier',
      })),
    };
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══ DYNAMIC CREDIT LINE ROUTES ═════════════════════════════════
  // ═══════════════════════════════════════════════════════════════

  // ─── POST /loans/credit-line/request — Request a dynamic credit line ─
  fastify.post<{
    Body: {
      collateralChain: string;
      collateralAmount: number;
      collateralPriceUsd: number;
    };
  }>(
    '/credit-line/request',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{
      Body: {
        collateralChain: string;
        collateralAmount: number;
        collateralPriceUsd: number;
      };
    }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { collateralChain, collateralAmount, collateralPriceUsd } = request.body;

      if (!collateralChain || !collateralAmount || !collateralPriceUsd) {
        return reply.status(400).send({ success: false, error: 'Missing required fields' });
      }
      if (collateralAmount <= 0) {
        return reply.status(400).send({ success: false, error: 'Amount must be positive' });
      }

      const collateralValueUsd = collateralAmount * collateralPriceUsd;
      const tier = getTier(collateralValueUsd);

      // For credit lines: max credit = 60% LTV (higher than fixed loans)
      const maxCreditLimit = (collateralValueUsd * 60) / 100;

      // Calculate margin call price (75% LTV) and liquidation price (85% LTV)
      const marginCallPrice = maxCreditLimit / (collateralAmount * 0.75);
      const liquidationPrice = maxCreditLimit / (collateralAmount * 0.85);

      // Create credit line
      const loan = await prisma.loan.create({
        data: {
          userId,
          loanType: 'DYNAMIC_CREDIT',
          collateralChain: collateralChain.toUpperCase(),
          collateralAmount,
          collateralPriceUsd,
          collateralValueUsd,
          loanAmount: maxCreditLimit, // This is the max credit limit
          drawnAmount: 0,
          availableCredit: maxCreditLimit,
          loanToken: tier.token,
          ltvPercent: 60, // Credit line LTV
          interestRate: tier.interest,
          marginCallPriceUsd: marginCallPrice,
          liquidationPriceUsd: liquidationPrice,
          status: 'PENDING',
        },
      });

      // Create deposit record
      await prisma.deposit.create({
        data: {
          userId,
          amount: collateralAmount,
          amountUsd: collateralValueUsd,
          chain: collateralChain.toUpperCase(),
          status: 'PENDING',
          loanId: loan.id,
        },
      });

      // Notify user
      await prisma.notification.create({
        data: {
          userId,
          type: 'LOAN',
          title: 'Credit Line Requested',
          body: `Your ${tier.token} credit line with $${maxCreditLimit.toFixed(2)} limit is pending. Send ${collateralAmount} ${collateralChain.toUpperCase()} to activate.`,
          data: { loanId: loan.id, token: tier.token, maxCreditLimit },
        },
      });

      return {
        success: true,
        message: 'Credit line requested. Deposit collateral to activate.',
        creditLine: {
          id: loan.id,
          collateralChain: loan.collateralChain,
          collateralAmount: Number(loan.collateralAmount),
          collateralValueUsd: Number(loan.collateralValueUsd),
          maxCreditLimit: Number(loan.loanAmount),
          availableCredit: Number(loan.availableCredit),
          loanToken: loan.loanToken,
          marginCallPrice: Number(loan.marginCallPriceUsd),
          liquidationPrice: Number(loan.liquidationPriceUsd),
          status: loan.status,
        },
      };
    }
  );

  // ─── POST /loans/credit-line/:id/activate — Activate credit line after deposit ─
  fastify.post<{ Params: { id: string }; Body: { txHash: string } }>(
    '/credit-line/:id/activate',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { txHash: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { id } = request.params;
      const { txHash } = request.body;

      if (!txHash) {
        return reply.status(400).send({ success: false, error: 'txHash is required' });
      }

      const loan = await prisma.loan.findFirst({
        where: { id, userId, loanType: 'DYNAMIC_CREDIT', status: 'PENDING' },
        include: { deposits: true },
      });

      if (!loan) {
        return reply.status(404).send({ success: false, error: 'Credit line not found or not pending' });
      }

      // Update deposit
      const deposit = loan.deposits[0];
      if (deposit) {
        await prisma.deposit.update({
          where: { id: deposit.id },
          data: { txHash, status: 'CONFIRMED', confirmedAt: new Date() },
        });
      }

      // Activate credit line (no tokens issued yet - user draws later)
      const updatedLoan = await prisma.loan.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          lastCreditUpdateAt: new Date(),
        },
      });

      // Notify user
      await prisma.notification.create({
        data: {
          userId,
          type: 'LOAN',
          title: '✅ Credit Line Activated',
          body: `Your ${loan.loanToken} credit line is now active! Available: $${Number(loan.availableCredit).toFixed(2)}. Draw as needed.`,
          data: { loanId: id, availableCredit: Number(loan.availableCredit) },
        },
      });

      return {
        success: true,
        message: 'Credit line activated',
        creditLine: {
          id: updatedLoan.id,
          status: updatedLoan.status,
          maxCreditLimit: Number(updatedLoan.loanAmount),
          availableCredit: Number(updatedLoan.availableCredit),
          drawnAmount: Number(updatedLoan.drawnAmount),
          loanToken: updatedLoan.loanToken,
        },
      };
    }
  );

  // ─── POST /loans/credit-line/:id/draw — Draw from credit line ─
  fastify.post<{ Params: { id: string }; Body: { amount: number } }>(
    '/credit-line/:id/draw',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { amount: number } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { id } = request.params;
      const { amount } = request.body;

      if (!amount || amount <= 0) {
        return reply.status(400).send({ success: false, error: 'Amount must be positive' });
      }

      const result = await creditLineService.drawCredit(id, userId, amount);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return {
        success: true,
        message: `Successfully drew $${result.drawAmount?.toFixed(2)}`,
        newAvailableCredit: result.newAvailableCredit,
      };
    }
  );

  // ─── POST /loans/credit-line/:id/repay — Repay to credit line ─
  fastify.post<{ Params: { id: string }; Body: { amount: number } }>(
    '/credit-line/:id/repay',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string }; Body: { amount: number } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { id } = request.params;
      const { amount } = request.body;

      if (!amount || amount <= 0) {
        return reply.status(400).send({ success: false, error: 'Amount must be positive' });
      }

      const result = await creditLineService.repayCredit(id, userId, amount);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return {
        success: true,
        message: `Successfully repaid $${result.repayAmount?.toFixed(2)}`,
        newAvailableCredit: result.newAvailableCredit,
        newDrawnAmount: result.newDrawnAmount,
      };
    }
  );

  // ─── GET /loans/credit-line/:id/status — Get credit line current status ─
  fastify.get<{ Params: { id: string } }>(
    '/credit-line/:id/status',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { id } = request.params;

      const loan = await prisma.loan.findFirst({
        where: { id, userId, loanType: 'DYNAMIC_CREDIT' },
      });

      if (!loan) {
        return reply.status(404).send({ success: false, error: 'Credit line not found' });
      }

      // Calculate current status
      const status = await creditLineService.calculateCreditLine(id);

      if (!status) {
        return reply.status(500).send({ success: false, error: 'Failed to calculate credit line status' });
      }

      return {
        success: true,
        creditLine: status,
      };
    }
  );

  // ─── GET /loans/credit-line/:id/history — Get credit line draw/repay history ─
  fastify.get<{ Params: { id: string } }>(
    '/credit-line/:id/history',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { id } = request.params;

      const loan = await prisma.loan.findFirst({
        where: { id, userId, loanType: 'DYNAMIC_CREDIT' },
      });

      if (!loan) {
        return reply.status(404).send({ success: false, error: 'Credit line not found' });
      }

      const history = await creditLineService.getCreditLineHistory(id, userId);

      return {
        success: true,
        history: history.map((h) => ({
          id: h.id,
          type: h.type,
          amount: Number(h.amount),
          collateralPriceUsd: Number(h.collateralPriceUsd),
          availableCreditAfter: Number(h.availableCreditAfter),
          drawnAmountAfter: Number(h.drawnAmountAfter),
          note: h.note,
          createdAt: h.createdAt,
        })),
      };
    }
  );

  // ─── GET /loans/credit-line/list — Get all user's credit lines ─
  fastify.get(
    '/credit-line/list',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;

      const creditLines = await creditLineService.getUserCreditLines(userId);

      return {
        success: true,
        creditLines,
      };
    }
  );

  // ═══════════════════════════════════════════════════════════════
  // ═══ LEVERAGED POOL ENTRY WITH LOAN CREDIT ═══════════════════════
  // ═══════════════════════════════════════════════════════════════

  // Tier → Leverage map (from design doc: $100→10x, $200→15x ... $1000→60x)
  const POOL_TIER_LEVERAGE: Record<number, number> = {
    100: 10, 200: 15, 300: 20, 400: 25, 500: 30,
    600: 35, 700: 40, 800: 45, 900: 50, 1000: 60,
  };

  function getPoolTierLeverage(entryFeeUsd: number): number {
    const tiers = Object.keys(POOL_TIER_LEVERAGE).map(Number).sort((a, b) => b - a);
    for (const tier of tiers) {
      if (entryFeeUsd >= tier) return POOL_TIER_LEVERAGE[tier];
    }
    return 10; // default minimum leverage
  }

  // Liquidation targets from design doc
  const LIQUIDATION_TARGETS = {
    BTC: { phase1: 150_000, phase2: 200_000 },
    ETH: { phase1: 15_000, phase2: 20_000 },
  };

  // ─── POST /loans/enter-pool-credit — Use loan credit as pool entry fee ─
  fastify.post<{
    Body: {
      asset: 'BTC' | 'ETH' | 'BNB';
      entryFeeUsd: number;
    };
  }>(
    '/enter-pool-credit',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{ Body: { asset: 'BTC' | 'ETH' | 'BNB'; entryFeeUsd: number } }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { asset, entryFeeUsd } = request.body;

      if (!asset || !['BTC', 'ETH', 'BNB'].includes(asset)) {
        return reply.status(400).send({ success: false, error: 'Asset must be BTC, ETH, or BNB' });
      }
      if (!entryFeeUsd || entryFeeUsd < 100) {
        return reply.status(400).send({ success: false, error: 'Minimum entry fee is $100' });
      }

      // Get user's loan credit balance
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { claimedPoolCreditUsd: true, walletAddress: true },
      });

      if (!user) {
        return reply.status(404).send({ success: false, error: 'User not found' });
      }

      const creditBalance = Number(user.claimedPoolCreditUsd);
      if (creditBalance < entryFeeUsd) {
        return reply.status(400).send({
          success: false,
          error: `Insufficient loan credit. You have $${creditBalance.toFixed(2)} but need $${entryFeeUsd}`,
        });
      }

      // Get current price
      const prices = await priceService.getPrices();
      const assetPrice = prices[asset]?.usd || 0;
      if (assetPrice <= 0) {
        return reply.status(503).send({ success: false, error: 'Price feed unavailable' });
      }

      // Calculate leverage and position
      const leverage = getPoolTierLeverage(entryFeeUsd);
      const positionValueUsd = entryFeeUsd * leverage;
      const cryptoAmount = positionValueUsd / assetPrice;

      // Use entry fee as "collateral value" and position value as "loan amount"
      // This is a special loan type where user pays with loan credit instead of crypto
      const result = await prisma.$transaction(async (tx) => {
        // Deduct from loan credit
        await tx.user.update({
          where: { id: userId },
          data: { claimedPoolCreditUsd: { decrement: entryFeeUsd } },
        });

        // Create the leveraged position loan
        const loan = await tx.loan.create({
          data: {
            userId,
            loanType: 'FIXED_LOAN',
            collateralChain: asset, // The asset being held
            collateralAmount: cryptoAmount,
            collateralPriceUsd: assetPrice,
            collateralValueUsd: positionValueUsd, // Total leveraged value
            loanAmount: positionValueUsd, // Loan amount = position value
            availableCredit: 0,
            loanToken: 'CLB',
            targetPriceUsd: LIQUIDATION_TARGETS[asset as keyof typeof LIQUIDATION_TARGETS]?.phase2 || assetPrice * 1.5,
            ltvPercent: 100 / leverage, // Effective LTV based on leverage
            interestRate: 0, // No interest for pool entries
            liquidationPriceUsd: assetPrice * 0.5, // 50% price drop = liquidation
            status: 'ACTIVE', // Immediately active, no need for deposit
            settledAt: null,
          },
        });

        // Record as transaction
        await tx.transaction.create({
          data: {
            userId,
            type: 'LOAN',
            amount: entryFeeUsd,
            status: 'SUCCESS',
            metadata: {
              loanId: loan.id,
              asset,
              entryFeeUsd,
              leverage,
              positionValueUsd,
              cryptoAmount,
              source: 'LOAN_CREDIT_POOL_ENTRY',
            },
          },
        });

        return { loan, leverage, positionValueUsd, cryptoAmount };
      });

      // Notify user
      await prisma.notification.create({
        data: {
          userId,
          type: 'LOAN',
          title: 'Leveraged Position Opened!',
          body: `You entered a ${result.leverage}x leveraged ${asset} position worth $${result.positionValueUsd.toFixed(2)} using $${entryFeeUsd} loan credit.`,
          data: {
            loanId: result.loan.id,
            asset,
            leverage: result.leverage,
            cryptoAmount: result.cryptoAmount,
          },
        },
      });

      return {
        success: true,
        message: `Successfully opened ${result.leverage}x leveraged ${asset} position`,
        loan: {
          id: result.loan.id,
          asset,
          entryFeeUsd,
          leverage: result.leverage,
          positionValueUsd: result.positionValueUsd,
          cryptoAmount: result.cryptoAmount,
          status: 'ACTIVE',
        },
        remainingCredit: creditBalance - entryFeeUsd,
      };
    }
  );
}
