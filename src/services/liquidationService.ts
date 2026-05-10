import { LoanType } from '@prisma/client';
import prisma from '../config/db';
import { priceService } from './priceService';
import { tokenService } from './tokenService';
import { creditLineService } from './creditLineService';

// Liquidation thresholds — if collateral drops below this % of loan value, liquidate
const LIQUIDATION_LTV_THRESHOLD = 80; // 80% LTV = liquidation zone

// How often to check prices (ms)
const CHECK_INTERVAL = 60_000; // 1 minute

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

interface LiquidationResult {
  settled: string[];
  liquidated: string[];
  errors: string[];
}

export const liquidationService = {
  /**
   * Start the background price monitoring loop.
   * Called once from server startup.
   */
  startMonitoring() {
    if (intervalHandle) {
      console.log('[Liquidation] Already monitoring');
      return;
    }

    console.log(`⚡ Liquidation service started (checking every ${CHECK_INTERVAL / 1000}s)`);

    // Run once immediately, then on interval
    this.checkAllLoans().catch((err) =>
      console.error('[Liquidation] Initial check failed:', err.message)
    );

    intervalHandle = setInterval(() => {
      this.checkAllLoans().catch((err) =>
        console.error('[Liquidation] Periodic check failed:', err.message)
      );
    }, CHECK_INTERVAL);
  },

  /**
   * Stop the monitoring loop.
   */
  stopMonitoring() {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
      console.log('[Liquidation] Monitoring stopped');
    }
  },

  /**
   * Check all ACTIVE loans against current prices.
   * FIXED_LOAN:
   *   - If price >= targetPriceUsd → SETTLE (user wins)
   *   - If collateral value / loan value >= LIQUIDATION_LTV_THRESHOLD → LIQUIDATE
   * DYNAMIC_CREDIT:
   *   - Monitor credit line LTV, handle margin calls and liquidations
   *   - Update available credit as collateral price changes
   */
  async checkAllLoans(): Promise<LiquidationResult> {
    if (isProcessing) {
      return { settled: [], liquidated: [], errors: ['Skip: already processing'] };
    }

    isProcessing = true;
    const result: LiquidationResult = { settled: [], liquidated: [], errors: [] };

    try {
      // Get current prices
      const prices = await priceService.getPrices();
      if (!prices.BTC?.usd && !prices.ETH?.usd) {
        result.errors.push('No price data available');
        return result;
      }

      // ═══ CHECK 1: FIXED LOANS (target price settlement) ═══
      const fixedLoans = await prisma.loan.findMany({
        where: { status: 'ACTIVE', loanType: LoanType.FIXED_LOAN },
        include: { user: { select: { id: true, walletAddress: true } } },
      });

      if (fixedLoans.length > 0) {
        console.log(`[Liquidation] Checking ${fixedLoans.length} fixed loans...`);

        for (const loan of fixedLoans) {
          try {
            const chain = loan.collateralChain.toUpperCase();
            const currentPrice = prices[chain]?.usd;

            if (!currentPrice || currentPrice === 0) {
              result.errors.push(`No price for ${chain} (loan ${loan.id.slice(0, 8)})`);
              continue;
            }

            const targetPrice = Number(loan.targetPriceUsd);
            const collateralAmount = Number(loan.collateralAmount);
            const loanAmount = Number(loan.loanAmount);

            // Current collateral value
            const currentCollateralValue = collateralAmount * currentPrice;

            // ═══ CHECK 1A: TARGET PRICE HIT → SETTLE (user wins!) ═══
            if (currentPrice >= targetPrice) {
              await this.settleLoan(loan, currentPrice, currentCollateralValue);
              result.settled.push(loan.id);
              continue;
            }

            // ═══ CHECK 1B: COLLATERAL VALUE TOO LOW → LIQUIDATE ═══
            const currentLTV = (loanAmount / currentCollateralValue) * 100;
            if (currentLTV >= LIQUIDATION_LTV_THRESHOLD) {
              await this.liquidateLoan(loan, currentPrice, currentCollateralValue);
              result.liquidated.push(loan.id);
              continue;
            }
          } catch (err: any) {
            result.errors.push(`Loan ${loan.id.slice(0, 8)}: ${err.message}`);
          }
        }
      }

      // ═══ CHECK 2: DYNAMIC CREDIT LINES (margin calls, liquidations, credit updates) ═══
      const creditLineResult = await creditLineService.monitorAllCreditLines();
      result.errors.push(...creditLineResult.errors);

      if (result.settled.length > 0 || result.liquidated.length > 0 || creditLineResult.marginCalls > 0) {
        console.log(
          `[Liquidation] Fixed loans: ${result.settled.length} settled, ${result.liquidated.filter(id =>
            fixedLoans.some(loan => loan.id === id)
          ).length} liquidated | Credit lines: ${creditLineResult.updated} updated, ${creditLineResult.marginCalls} margin calls, ${creditLineResult.liquidated} liquidated`
        );
      }

      return result;
    } finally {
      isProcessing = false;
    }
  },

  /**
   * SETTLE: Collateral price reached target — user profits!
   * - Calculate profit = currentValue - originalLoanValue
   * - User keeps collateral + profit (CLB tokens remain)
   * - Notify user
   */
  async settleLoan(
    loan: any,
    currentPrice: number,
    currentCollateralValue: number
  ) {
    const loanAmount = Number(loan.loanAmount);
    const collateralAmount = Number(loan.collateralAmount);
    const originalCollateralValue = Number(loan.collateralValueUsd);

    // Profit = current collateral value - what was originally valued
    const grossProfit = currentCollateralValue - originalCollateralValue;
    const platformFee = grossProfit > 0 ? grossProfit * 0.15 : 0; // 15% platform fee on profit
    const userProfit = grossProfit - platformFee;

    const now = new Date();

    await prisma.$transaction([
      // Update loan status
      prisma.loan.update({
        where: { id: loan.id },
        data: {
          status: 'SETTLED',
          settledAt: now,
          settlementPriceUsd: currentPrice,
          profitUsd: userProfit,
          platformFeeUsd: platformFee,
        },
      }),
      // Record transaction
      prisma.transaction.create({
        data: {
          userId: loan.userId,
          type: 'LOAN',
          amount: userProfit,
          status: 'SUCCESS',
          metadata: {
            event: 'SETTLEMENT',
            loanId: loan.id,
            settlementPrice: currentPrice,
            grossProfit,
            platformFee,
            userProfit,
            collateral: `${collateralAmount} ${loan.collateralChain}`,
          },
        },
      }),
      // Notify user
      prisma.notification.create({
        data: {
          userId: loan.userId,
          type: 'LOAN',
          title: '🎉 Loan Settled — Target Reached!',
          body: `Your ${loan.collateralChain} collateral hit $${currentPrice.toLocaleString()}! Profit: $${userProfit.toFixed(2)}.`,
          data: {
            loanId: loan.id,
            event: 'SETTLEMENT',
            price: currentPrice,
            profit: userProfit,
          },
        },
      }),
    ]);

    console.log(
      `[Liquidation] ✅ SETTLED loan ${loan.id.slice(0, 8)} — ` +
      `${loan.collateralChain} hit $${currentPrice.toLocaleString()}, ` +
      `user profit: $${userProfit.toFixed(2)}`
    );
  },

  /**
   * LIQUIDATE: Collateral value dropped too low — margin call!
   * - Collateral is seized to cover the loan
   * - User loses some/all collateral
   * - CLB tokens may be burned
   */
  async liquidateLoan(
    loan: any,
    currentPrice: number,
    currentCollateralValue: number
  ) {
    const loanAmount = Number(loan.loanAmount);
    const collateralAmount = Number(loan.collateralAmount);

    // Loss = original collateral value - current value
    const loss = Number(loan.collateralValueUsd) - currentCollateralValue;

    const now = new Date();

    await prisma.$transaction([
      // Update loan status
      prisma.loan.update({
        where: { id: loan.id },
        data: {
          status: 'LIQUIDATED',
          liquidatedAt: now,
          settlementPriceUsd: currentPrice,
          profitUsd: -loss, // Negative = loss
          platformFeeUsd: 0,
        },
      }),
      // Deduct CLB tokens from user balance
      prisma.tokenBalance.updateMany({
        where: { userId: loan.userId, token: loan.loanToken },
        data: { balance: { decrement: loan.loanAmount } },
      }),
      // Record token burn transfer
      prisma.tokenTransfer.create({
        data: {
          fromUserId: loan.userId,
          token: loan.loanToken,
          amount: loan.loanAmount,
          type: 'LOAN_REPAY',
          status: 'COMPLETED',
          note: `Liquidation — ${loan.collateralChain} dropped to $${currentPrice.toLocaleString()}`,
        },
      }),
      // Transaction log
      prisma.transaction.create({
        data: {
          userId: loan.userId,
          type: 'LOAN',
          amount: loan.loanAmount,
          status: 'SUCCESS',
          metadata: {
            event: 'LIQUIDATION',
            loanId: loan.id,
            liquidationPrice: currentPrice,
            loss,
            collateral: `${collateralAmount} ${loan.collateralChain}`,
          },
        },
      }),
      // Notify user
      prisma.notification.create({
        data: {
          userId: loan.userId,
          type: 'LOAN',
          title: '⚠️ Loan Liquidated',
          body: `Your ${loan.collateralChain} collateral dropped to $${currentPrice.toLocaleString()}. Loan has been liquidated and ${Number(loan.loanAmount).toFixed(2)} ${loan.loanToken} tokens have been reclaimed.`,
          data: {
            loanId: loan.id,
            event: 'LIQUIDATION',
            price: currentPrice,
            loss,
          },
        },
      }),
    ]);

    console.log(
      `[Liquidation] ⚠️ LIQUIDATED loan ${loan.id.slice(0, 8)} — ` +
      `${loan.collateralChain} dropped to $${currentPrice.toLocaleString()}, ` +
      `loss: $${loss.toFixed(2)}`
    );
  },

  /**
   * Manual settlement by admin — forces a settlement at current market price.
   */
  async manualSettle(loanId: string): Promise<{ success: boolean; error?: string }> {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, status: 'ACTIVE' },
    });

    if (!loan) {
      return { success: false, error: 'Loan not found or not active' };
    }

    const prices = await priceService.getPrices();
    const chain = loan.collateralChain.toUpperCase();
    const currentPrice = prices[chain]?.usd;

    if (!currentPrice) {
      return { success: false, error: `No price available for ${chain}` };
    }

    const currentCollateralValue = Number(loan.collateralAmount) * currentPrice;
    await this.settleLoan(loan, currentPrice, currentCollateralValue);

    return { success: true };
  },

  /**
   * Get a summary of all active loans and their proximity to targets.
   */
  async getMonitoringSummary() {
    const prices = await priceService.getPrices();

    const activeLoans = await prisma.loan.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { walletAddress: true } } },
    });

    return activeLoans.map((loan) => {
      const chain = loan.collateralChain.toUpperCase();
      const currentPrice = prices[chain]?.usd || 0;
      const targetPrice = Number(loan.targetPriceUsd);
      const collateralAmount = Number(loan.collateralAmount);
      const loanAmount = Number(loan.loanAmount);
      const currentValue = collateralAmount * currentPrice;
      const currentLTV = loanAmount / currentValue * 100;
      const progressToTarget = (currentPrice / targetPrice) * 100;

      return {
        loanId: loan.id,
        wallet: loan.user.walletAddress,
        chain: loan.collateralChain,
        collateral: collateralAmount,
        currentPrice,
        targetPrice,
        progressToTarget: Math.min(progressToTarget, 100).toFixed(1) + '%',
        currentValue: currentValue.toFixed(2),
        currentLTV: currentLTV.toFixed(1) + '%',
        risk: currentLTV >= 70 ? 'HIGH' : currentLTV >= 50 ? 'MEDIUM' : 'LOW',
        loanToken: loan.loanToken,
        loanAmount: Number(loan.loanAmount),
      };
    });
  },
};
