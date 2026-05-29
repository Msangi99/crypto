import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../config/db';
import { authMiddleware } from '../middleware/auth';
import { tokenService } from '../services/tokenService';
import { getTokenUsdQuotes } from '../services/tokenUsdPrices';
import { computePortfolioValueUsd } from '../services/portfolioValuation';
import { computeMiningProgress } from '../services/miningAccrual';
import { PLATFORM_TOKENS, isPlatformToken } from '../config/tokens';
import { notifyAdminPayment } from '../services/adminNotify';

/**
 * Smallest USD gap we'll bother minting on-chain CLB for, to avoid wasting gas
 * on dust-sized mints when prices wobble by a fraction of a cent between
 * "Sync to Wallet" presses.
 */
const MIN_SYNC_GAP_USD = 0.5;

function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export default async function tokenRoutes(fastify: FastifyInstance) {

  // ─── GET /tokens/balances — Get user token balances ────
  fastify.get(
    '/balances',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;

      const [balances, miningSub] = await Promise.all([
        prisma.tokenBalance.findMany({
          where: { userId },
        }),
        prisma.userMiningSubscription.findUnique({
          where: { userId },
          include: { package: true },
        }),
      ]);

      const miningAccruedByToken: Record<string, number> = Object.fromEntries(
        PLATFORM_TOKENS.map((t) => [t, 0]),
      );
      if (miningSub?.package) {
        const p = miningSub.package;
        const tpp = Number(p.tokensPerPeriod);
        const { accruedTokens } = computeMiningProgress(tpp, p.periodUnit, p.periodLength, miningSub.startedAt);
        const sym = p.tokenSymbol;
        if (isPlatformToken(sym)) {
          miningAccruedByToken[sym] = accruedTokens;
        }
      }

      const quotes = await getTokenUsdQuotes();
      const allTokens = PLATFORM_TOKENS;
      const result = allTokens.map((token) => {
        const found = balances.find((b) => b.token === token);
        const balance = found ? Number(found.balance) : 0;
        const locked = found ? Number(found.locked) : 0;
        const price = quotes[token]?.priceUsd ?? 0;
        const miningAccrued = miningAccruedByToken[token] ?? 0;
        const totalBalance = balance + miningAccrued;
        const availableLedger = balance - locked;
        const totalAvailable = availableLedger + miningAccrued;
        return {
          token,
          balance,
          locked,
          available: availableLedger,
          miningAccrued,
          totalBalance,
          totalAvailable,
          priceUsd: price,
          /** Ledger only (DB). */
          valueUsd: balance * price,
          /** Ledger + mining accrued at spot price. */
          valueUsdTotal: totalBalance * price,
        };
      });

      const totalValueUsd = result.reduce((sum, t) => sum + t.valueUsdTotal, 0);

      return { success: true, balances: result, totalValueUsd };
    }
  );

  // ─── GET /tokens/prices — Token prices ─────────────────
  fastify.get('/prices', async () => {
    const quotes = await getTokenUsdQuotes();
    return {
      success: true,
      prices: Object.entries(quotes).map(([token, q]) => ({
        token,
        priceUsd: q.priceUsd,
        ...(q.change24h != null ? { change24h: q.change24h } : {}),
      })),
    };
  });

  // ─── GET /tokens/contracts — Token contract addresses for Trust Wallet ─
  fastify.get('/contracts', async () => {
    const addresses = tokenService.getTokenAddresses();
    return {
      success: true,
      network: 'BNB Smart Chain (BEP-20)',
      chainId: 56,
      contracts: [
        { token: 'CLB', name: 'CryptoLoanBoost', address: addresses.CLB, decimals: 18 },
      ],
      instructions: [
        'Open Trust Wallet',
        'Tap "+" icon → Add Custom Token',
        'Network: Smart Chain (BEP-20)',
        'Paste the contract address',
        'Symbol and decimals will auto-fill',
        'Tap Save — token appears in your wallet!',
      ],
    };
  });

  // ─── POST /tokens/transfer — Transfer tokens to another user ─
  fastify.post<{
    Body: { toAddress: string; token: string; amount: number; note?: string; delivery?: 'INTERNAL' | 'ON_CHAIN' };
  }>(
    '/transfer',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{
      Body: { toAddress: string; token: string; amount: number; note?: string; delivery?: 'INTERNAL' | 'ON_CHAIN' };
    }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const { toAddress, token, amount, note, delivery } = request.body;

      if (!toAddress || !token || !amount) {
        return reply.status(400).send({ success: false, error: 'Missing required fields' });
      }
      if (amount <= 0) {
        return reply.status(400).send({ success: false, error: 'Amount must be positive' });
      }
      if (!isPlatformToken(token)) {
        return reply.status(400).send({ success: false, error: 'Invalid token' });
      }

      // Check sender balance
      const senderBalance = await prisma.tokenBalance.findUnique({
        where: { userId_token: { userId, token } },
      });

      const available = senderBalance
        ? Number(senderBalance.balance) - Number(senderBalance.locked)
        : 0;

      if (available < amount) {
        return reply.status(400).send({
          success: false,
          error: `Insufficient ${token} balance. Available: ${available.toFixed(2)}`,
        });
      }

      const forceOnChain = delivery === 'ON_CHAIN';
      const recipient = forceOnChain
        ? null
        : await prisma.user.findUnique({
            where: { walletAddress: toAddress.toLowerCase() },
          });

      const isInternal = !!recipient;
      const fee = isInternal ? 0 : amount * 0.01; // 1% fee for external transfers
      const netAmount = amount - fee;
      let txHash: string | undefined;
      let status: 'COMPLETED' = 'COMPLETED';

      if (isInternal) {
        // Internal transfer
        await prisma.$transaction([
          // Deduct from sender
          prisma.tokenBalance.update({
            where: { userId_token: { userId, token } },
            data: { balance: { decrement: amount } },
          }),
          // Add to recipient
          prisma.tokenBalance.upsert({
            where: { userId_token: { userId: recipient!.id, token } },
            create: { userId: recipient!.id, token, balance: netAmount },
            update: { balance: { increment: netAmount } },
          }),
          // Transfer record
          prisma.tokenTransfer.create({
            data: {
              fromUserId: userId,
              toUserId: recipient!.id,
              token,
              amount,
              fee,
              type: 'INTERNAL',
              status: 'COMPLETED',
              note,
            },
          }),
          // Transaction log
          prisma.transaction.create({
            data: {
              userId,
              type: 'TRANSFER',
              amount,
              toAddress: toAddress.toLowerCase(),
              status: 'SUCCESS',
              metadata: { token, toUser: recipient!.id, fee },
            },
          }),
        ]);

        // Notify recipient
        const sender = await prisma.user.findUnique({ where: { id: userId } });
        await prisma.notification.create({
          data: {
            userId: recipient!.id,
            type: 'TRANSFER',
            title: `${token} Received!`,
            body: `You received ${netAmount.toFixed(2)} ${token} from ${sender?.username || sender?.walletAddress?.slice(0, 8) + '...'}`,
            data: { amount: netAmount, token, fromAddress: sender?.walletAddress },
          },
        });

        if (sender) {
          notifyAdminPayment({
            user: sender,
            txType: 'TRANSFER',
            amount,
            status: 'SUCCESS',
            detail: `Internal ${token} transfer ${amount.toFixed(2)} → ${toAddress.slice(0, 10)}…`,
          });
        }
      } else {
        // External transfer (to Trust Wallet etc.) — on-chain mint
        if (!isValidEvmAddress(toAddress)) {
          return reply.status(400).send({
            success: false,
            error: 'Enter a valid BNB Smart Chain wallet address',
          });
        }

        if (!tokenService.isConfigured(token)) {
          const config = tokenService.getConfigStatus(token);
          return reply.status(503).send({
            success: false,
            error: `On-chain ${token} transfers are not configured yet.`,
            config,
          });
        }

        try {
          const result = await tokenService.sendOnChain(token, toAddress, netAmount, { preferMint: true });
          if (!result?.txHash) throw new Error(`On-chain ${token} transfer did not return a transaction hash`);
          txHash = result.txHash;
        } catch (err: any) {
          console.error('[External Transfer] On-chain mint failed:', err.message);
          return reply.status(502).send({
            success: false,
            error: 'On-chain transfer failed. No balance was deducted.',
            detail: err.message,
          });
        }

        await prisma.$transaction([
          prisma.tokenBalance.update({
            where: { userId_token: { userId, token } },
            data: { balance: { decrement: amount } },
          }),
          prisma.tokenTransfer.create({
            data: {
              fromUserId: userId,
              toAddress: toAddress.toLowerCase(),
              token,
              amount,
              fee,
              type: 'EXTERNAL',
              status,
              txHash,
              note,
            },
          }),
        ]);
      }

      return {
        success: true,
        transfer: {
          token,
          amount,
          fee,
          netAmount,
          toAddress,
          type: isInternal ? 'INTERNAL' : 'EXTERNAL',
          status: isInternal ? 'COMPLETED' : status,
          txHash,
          explorerUrl: txHash ? tokenService.getExplorerTxUrl(txHash) : null,
        },
      };
    }
  );

  // ─── GET /tokens/history — Transfer history ────────────
  fastify.get<{ Querystring: { page?: string; limit?: string; token?: string } }>(
    '/history',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest<{
      Querystring: { page?: string; limit?: string; token?: string };
    }>, reply: FastifyReply) => {
      const userId = request.userId!;
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 50);
      const skip = (page - 1) * limit;
      const tokenFilter = request.query.token;

      const where: any = {
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      };
      if (tokenFilter) where.token = tokenFilter;

      const [transfers, total] = await Promise.all([
        prisma.tokenTransfer.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            fromUser: { select: { walletAddress: true, username: true } },
            toUser: { select: { walletAddress: true, username: true } },
          },
        }),
        prisma.tokenTransfer.count({ where }),
      ]);

      return {
        success: true,
        transfers: transfers.map((t) => ({
          id: t.id,
          token: t.token,
          amount: Number(t.amount),
          fee: Number(t.fee),
          type: t.type,
          status: t.status,
          txHash: t.txHash,
          note: t.note,
          direction: t.fromUserId === userId ? 'OUT' : 'IN',
          counterparty: t.fromUserId === userId
            ? (t.toUser?.username || t.toAddress || 'System')
            : (t.fromUser?.username || t.fromUser?.walletAddress?.slice(0, 10) || 'System'),
          createdAt: t.createdAt,
        })),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      };
    }
  );

  // ─── GET /tokens/sync-status — Portfolio vs on-chain CLB gap ──────────
  // Lightweight read so the wallet UI can render the "in sync" state and
  // the "Sync N CLB to Wallet" CTA without needing to send a transaction.
  fastify.get(
    '/sync-status',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { walletAddress: true },
      });
      if (!user?.walletAddress) {
        return reply.status(400).send({ success: false, error: 'User has no wallet address' });
      }

      const [portfolioValueUsd, onChainBalance, quotes] = await Promise.all([
        computePortfolioValueUsd(userId),
        tokenService.getBalance('CLB', user.walletAddress),
        getTokenUsdQuotes(),
      ]);

      const clbPrice = quotes.CLB?.priceUsd || 1;
      const onChainValueUsd = onChainBalance * clbPrice;
      const gapUsd = Math.max(0, portfolioValueUsd - onChainValueUsd);
      const mintableClb = clbPrice > 0 ? gapUsd / clbPrice : 0;

      return {
        success: true,
        sync: {
          walletAddress: user.walletAddress,
          portfolioValueUsd,
          onChainCLBBalance: parseFloat(onChainBalance.toFixed(6)),
          onChainCLBValueUsd: parseFloat(onChainValueUsd.toFixed(2)),
          gapUsd: parseFloat(gapUsd.toFixed(2)),
          mintableClb: parseFloat(mintableClb.toFixed(6)),
          inSync: gapUsd < MIN_SYNC_GAP_USD,
          minSyncGapUsd: MIN_SYNC_GAP_USD,
          clbPriceUsd: clbPrice,
          chainConfigured: tokenService.isConfigured(),
        },
      };
    },
  );

  // ─── POST /tokens/sync-portfolio — Mint CLB to user's wallet ──────────
  // Mints (portfolioValueUsd − onChainCLBValueUsd) worth of CLB tokens to
  // the user's wallet so they can see their CLB DApp portfolio value
  // directly inside Trust Wallet / MetaMask. Idempotent: calling it twice
  // in a row is a no-op the second time because the gap closes after the
  // first mint.
  fastify.post(
    '/sync-portfolio',
    { preHandler: [authMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.userId!;

      if (!tokenService.isConfigured()) {
        return reply.status(503).send({
          success: false,
          error:
            'On-chain token service is not configured. Set CLB_TOKEN_ADDRESS and PRIVATE_KEY in the backend env.',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, walletAddress: true },
      });
      if (!user?.walletAddress) {
        return reply.status(400).send({ success: false, error: 'User has no wallet address' });
      }

      const [portfolioValueUsd, onChainBalance, quotes] = await Promise.all([
        computePortfolioValueUsd(userId),
        tokenService.getBalance('CLB', user.walletAddress),
        getTokenUsdQuotes(),
      ]);

      const clbPrice = quotes.CLB?.priceUsd || 1;
      const onChainValueUsd = onChainBalance * clbPrice;
      const gapUsd = portfolioValueUsd - onChainValueUsd;

      if (gapUsd < MIN_SYNC_GAP_USD) {
        return {
          success: true,
          alreadyInSync: true,
          minted: 0,
          sync: {
            portfolioValueUsd,
            onChainCLBBalance: parseFloat(onChainBalance.toFixed(6)),
            onChainCLBValueUsd: parseFloat(onChainValueUsd.toFixed(2)),
            gapUsd: parseFloat(Math.max(0, gapUsd).toFixed(2)),
          },
        };
      }

      const amountToMint = parseFloat((gapUsd / clbPrice).toFixed(6));

      let txHash: string | undefined;
      try {
        const result = await tokenService.mint('CLB', user.walletAddress, amountToMint);
        txHash = result?.txHash;
      } catch (err: any) {
        console.error('[Sync Portfolio] On-chain mint failed:', err.message);
        return reply.status(502).send({
          success: false,
          error: 'On-chain mint failed. No tokens were minted.',
          detail: err.message,
        });
      }

      // Record the on-chain mint in the platform ledger so it shows up in
      // history / activity. fromUserId == userId here because the schema
      // requires a sender; semantically the user is "materialising" their
      // portfolio value into their own external wallet.
      await prisma.$transaction([
        prisma.tokenTransfer.create({
          data: {
            fromUserId: userId,
            toAddress: user.walletAddress.toLowerCase(),
            token: 'CLB',
            amount: amountToMint,
            fee: 0,
            type: 'REWARD',
            status: txHash ? 'COMPLETED' : 'PENDING',
            txHash,
            note: `Portfolio sync — minted ${amountToMint} CLB to wallet`,
          },
        }),
        prisma.transaction.create({
          data: {
            userId,
            type: 'REWARD',
            amount: amountToMint,
            toAddress: user.walletAddress.toLowerCase(),
            txHash,
            status: txHash ? 'SUCCESS' : 'PENDING',
            metadata: {
              kind: 'PORTFOLIO_SYNC',
              token: 'CLB',
              gapUsd: parseFloat(gapUsd.toFixed(2)),
              portfolioValueUsd,
              onChainBalanceBefore: parseFloat(onChainBalance.toFixed(6)),
              clbPriceUsd: clbPrice,
            },
          },
        }),
        prisma.notification.create({
          data: {
            userId,
            type: 'TRANSFER',
            title: 'Portfolio synced to wallet',
            body: `Minted ${amountToMint.toFixed(2)} CLB ($${gapUsd.toFixed(2)}) to your wallet. Open Trust Wallet to view.`,
            data: { amount: amountToMint, token: 'CLB', txHash, gapUsd },
          },
        }),
      ]);

      notifyAdminPayment({
        user,
        txType: 'REWARD',
        amount: amountToMint,
        status: txHash ? 'SUCCESS' : 'PENDING',
        detail: `Portfolio sync — minted ${amountToMint.toFixed(2)} CLB ($${gapUsd.toFixed(2)})`,
        txHash,
      });

      return {
        success: true,
        alreadyInSync: false,
        minted: amountToMint,
        txHash,
        explorerUrl: txHash ? tokenService.getExplorerTxUrl(txHash) : null,
        sync: {
          portfolioValueUsd,
          onChainCLBBalanceBefore: parseFloat(onChainBalance.toFixed(6)),
          onChainCLBBalanceAfter: parseFloat((onChainBalance + amountToMint).toFixed(6)),
          gapUsd: parseFloat(gapUsd.toFixed(2)),
          clbPriceUsd: clbPrice,
        },
      };
    },
  );
}
