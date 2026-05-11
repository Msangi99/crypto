import prisma from '../config/db';
import { priceService } from './priceService';
import { tokenService } from './tokenService';

// LTV thresholds for credit lines
const CREDIT_LINE_LTV = 60; // 60% LTV for credit line (higher than fixed loans)
const MARGIN_CALL_LTV = 75; // 75% LTV triggers margin call warning
const LIQUIDATION_LTV = 85; // 85% LTV triggers forced liquidation

interface CreditLineSummary {
  loanId: string;
  collateralChain: string;
  collateralAmount: number;
  currentCollateralPrice: number;
  currentCollateralValue: number;
  maxCreditLimit: number;
  drawnAmount: number;
  availableCredit: number;
  currentLTV: number;
  marginCallPrice: number;
  liquidationPrice: number;
  status: string;
  isMarginCall: boolean;
}

interface DrawCreditResult {
  success: boolean;
  error?: string;
  drawAmount?: number;
  newAvailableCredit?: number;
  txHash?: string;
}

interface RepayCreditResult {
  success: boolean;
  error?: string;
  repayAmount?: number;
  newAvailableCredit?: number;
  newDrawnAmount?: number;
}

export const creditLineService = {
  /**
   * Calculate current credit line status for a DYNAMIC_CREDIT loan
   * The available credit rises and falls with collateral value
   */
  async calculateCreditLine(loanId: string): Promise<CreditLineSummary | null> {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, loanType: 'DYNAMIC_CREDIT' },
      include: { user: { select: { id: true, walletAddress: true } } },
    });

    if (!loan) {
      return null;
    }

    // Get current price
    const prices = await priceService.getPrices();
    const chain = loan.collateralChain.toUpperCase();
    const currentPrice = prices[chain]?.usd || 0;

    if (!currentPrice) {
      throw new Error(`No price available for ${chain}`);
    }

    const collateralAmount = Number(loan.collateralAmount);
    const drawnAmount = Number(loan.drawnAmount);

    // Current collateral value
    const currentCollateralValue = collateralAmount * currentPrice;

    // Max credit limit (60% LTV of current value)
    const maxCreditLimit = (currentCollateralValue * CREDIT_LINE_LTV) / 100;

    // Available credit = max credit - drawn amount
    const availableCredit = Math.max(0, maxCreditLimit - drawnAmount);

    // Current LTV
    const currentLTV = drawnAmount > 0 ? (drawnAmount / currentCollateralValue) * 100 : 0;

    // Margin call price: price where drawnAmount / (collateralAmount * price) = 75%
    // price = drawnAmount / (collateralAmount * 0.75)
    const marginCallPrice = drawnAmount > 0 ? drawnAmount / (collateralAmount * 0.75) : 0;

    // Liquidation price: price where drawnAmount / (collateralAmount * price) = 85%
    // price = drawnAmount / (collateralAmount * 0.85)
    const liquidationPrice = drawnAmount > 0 ? drawnAmount / (collateralAmount * 0.85) : 0;

    // Check if in margin call
    const isMarginCall = currentLTV >= MARGIN_CALL_LTV;

    // Update loan record with current values
    await prisma.loan.update({
      where: { id: loanId },
      data: {
        availableCredit,
        marginCallPriceUsd: marginCallPrice,
        liquidationPriceUsd: liquidationPrice,
        lastCreditUpdateAt: new Date(),
        status: isMarginCall ? 'MARGIN_CALL' : loan.status === 'MARGIN_CALL' ? 'ACTIVE' : loan.status,
      },
    });

    return {
      loanId: loan.id,
      collateralChain: loan.collateralChain,
      collateralAmount,
      currentCollateralPrice: currentPrice,
      currentCollateralValue,
      maxCreditLimit,
      drawnAmount,
      availableCredit,
      currentLTV,
      marginCallPrice,
      liquidationPrice,
      status: isMarginCall ? 'MARGIN_CALL' : loan.status,
      isMarginCall,
    };
  },

  /**
   * User draws/borrows from their credit line
   */
  async drawCredit(
    loanId: string,
    userId: string,
    amount: number
  ): Promise<DrawCreditResult> {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId, loanType: 'DYNAMIC_CREDIT' },
    });

    if (!loan) {
      return { success: false, error: 'Credit line not found' };
    }

    if (loan.status === 'LIQUIDATED' || loan.status === 'SETTLED') {
      return { success: false, error: 'Credit line is closed' };
    }

    // Recalculate current credit line
    const creditLine = await this.calculateCreditLine(loanId);
    if (!creditLine) {
      return { success: false, error: 'Failed to calculate credit line' };
    }

    // Check if in margin call
    if (creditLine.isMarginCall) {
      return {
        success: false,
        error: `Credit line is in margin call. Current LTV: ${creditLine.currentLTV.toFixed(1)}%. Please add collateral or repay first.`,
      };
    }

    // Check available credit
    if (amount > creditLine.availableCredit) {
      return {
        success: false,
        error: `Insufficient credit. Available: $${creditLine.availableCredit.toFixed(2)}, Requested: $${amount.toFixed(2)}`,
      };
    }

    // Get current price for the record
    const prices = await priceService.getPrices();
    const chain = loan.collateralChain.toUpperCase();
    const currentPrice = prices[chain]?.usd || 0;

    const newDrawnAmount = Number(loan.drawnAmount) + amount;
    const newAvailableCredit = creditLine.maxCreditLimit - newDrawnAmount;

    const loanToken = 'CLB';

    // Execute the draw
    await prisma.$transaction(async (tx) => {
      // Update loan
      await tx.loan.update({
        where: { id: loanId },
        data: {
          drawnAmount: newDrawnAmount,
          availableCredit: newAvailableCredit,
          loanToken,
          lastCreditUpdateAt: new Date(),
          status: 'ACTIVE',
        },
      });

      // Record the draw
      await tx.creditDraw.create({
        data: {
          loanId,
          userId,
          type: 'DRAW',
          amount,
          collateralPriceUsd: currentPrice,
          availableCreditAfter: newAvailableCredit,
          drawnAmountAfter: newDrawnAmount,
          note: `Drew $${amount.toFixed(2)} from credit line`,
        },
      });

      // Add tokens to user balance
      await tx.tokenBalance.upsert({
        where: { userId_token: { userId, token: loanToken } },
        create: {
          userId,
          token: loanToken,
          balance: amount,
        },
        update: {
          balance: { increment: amount },
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          type: 'LOAN',
          amount,
          status: 'SUCCESS',
          metadata: {
            event: 'CREDIT_DRAW',
            loanId,
            loanToken,
            collateralChain: loan.collateralChain,
            collateralPrice: currentPrice,
            newDrawnAmount,
            newAvailableCredit,
          },
        },
      });

      // Notify user
      await tx.notification.create({
        data: {
          userId,
          type: 'LOAN',
          title: '💰 Credit Line Draw',
          body: `You drew $${amount.toFixed(2)} ${loanToken} from your credit line. Available: $${newAvailableCredit.toFixed(2)}`,
          data: {
            loanId,
            event: 'CREDIT_DRAW',
            amount,
            newAvailableCredit,
            currentLTV: (newDrawnAmount / creditLine.currentCollateralValue) * 100,
          },
        },
      });
    });

    return {
      success: true,
      drawAmount: amount,
      newAvailableCredit,
    };
  },

  /**
   * User repays to their credit line
   */
  async repayCredit(
    loanId: string,
    userId: string,
    amount: number
  ): Promise<RepayCreditResult> {
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, userId, loanType: 'DYNAMIC_CREDIT' },
    });

    if (!loan) {
      return { success: false, error: 'Credit line not found' };
    }

    if (amount > Number(loan.drawnAmount)) {
      return {
        success: false,
        error: `Repay amount exceeds drawn amount. Drawn: $${Number(loan.drawnAmount).toFixed(2)}`,
      };
    }

    // Check user has enough tokens to repay
    const tokenBalance = await prisma.tokenBalance.findFirst({
      where: { userId, token: loan.loanToken },
    });

    if (!tokenBalance || Number(tokenBalance.balance) < amount) {
      return {
        success: false,
        error: `Insufficient ${loan.loanToken} balance to repay. Balance: $${Number(tokenBalance?.balance || 0).toFixed(2)}`,
      };
    }

    // Recalculate current credit line
    const creditLine = await this.calculateCreditLine(loanId);
    if (!creditLine) {
      return { success: false, error: 'Failed to calculate credit line' };
    }

    // Get current price
    const prices = await priceService.getPrices();
    const chain = loan.collateralChain.toUpperCase();
    const currentPrice = prices[chain]?.usd || 0;

    const newDrawnAmount = Number(loan.drawnAmount) - amount;
    const newAvailableCredit = creditLine.maxCreditLimit - newDrawnAmount;

    // Execute the repayment
    await prisma.$transaction(async (tx) => {
      // Update loan
      await tx.loan.update({
        where: { id: loanId },
        data: {
          drawnAmount: newDrawnAmount,
          availableCredit: newAvailableCredit,
          lastCreditUpdateAt: new Date(),
          status: newDrawnAmount === 0 ? 'REPAID' : 'ACTIVE',
        },
      });

      // Record the repayment
      await tx.creditDraw.create({
        data: {
          loanId,
          userId,
          type: 'REPAY',
          amount,
          collateralPriceUsd: currentPrice,
          availableCreditAfter: newAvailableCredit,
          drawnAmountAfter: newDrawnAmount,
          note: `Repaid $${amount.toFixed(2)} to credit line`,
        },
      });

      // Deduct tokens from user balance
      await tx.tokenBalance.update({
        where: { id: tokenBalance.id },
        data: {
          balance: { decrement: amount },
        },
      });

      // Burn the repaid tokens (optional - depends on your tokenomics)
      await tx.tokenTransfer.create({
        data: {
          fromUserId: userId,
          token: loan.loanToken,
          amount,
          type: 'LOAN_REPAY',
          status: 'COMPLETED',
          note: `Credit line repayment for loan ${loanId.slice(0, 8)}`,
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId,
          type: 'LOAN',
          amount,
          status: 'SUCCESS',
          metadata: {
            event: 'CREDIT_REPAY',
            loanId,
            loanToken: loan.loanToken,
            newDrawnAmount,
            newAvailableCredit,
          },
        },
      });

      // Notify user
      await tx.notification.create({
        data: {
          userId,
          type: 'LOAN',
          title: '✅ Credit Line Repayment',
          body: `You repaid $${amount.toFixed(2)} ${loan.loanToken} to your credit line. Available: $${newAvailableCredit.toFixed(2)}`,
          data: {
            loanId,
            event: 'CREDIT_REPAY',
            amount,
            newAvailableCredit,
            currentLTV: newDrawnAmount > 0 ? (newDrawnAmount / creditLine.currentCollateralValue) * 100 : 0,
          },
        },
      });
    });

    return {
      success: true,
      repayAmount: amount,
      newAvailableCredit,
      newDrawnAmount,
    };
  },

  /**
   * Monitor all active credit lines and update them
   * Called periodically by the liquidation service
   */
  async monitorAllCreditLines(): Promise<{
    updated: number;
    marginCalls: number;
    liquidated: number;
    errors: string[];
  }> {
    const result = { updated: 0, marginCalls: 0, liquidated: 0, errors: [] as string[] };

    try {
      const creditLines = await prisma.loan.findMany({
        where: {
          loanType: 'DYNAMIC_CREDIT',
          status: { in: ['ACTIVE', 'MARGIN_CALL'] },
        },
        include: { user: { select: { id: true, walletAddress: true } } },
      });

      if (creditLines.length === 0) {
        return result;
      }

      console.log(`[CreditLine] Monitoring ${creditLines.length} credit lines...`);

      for (const loan of creditLines) {
        try {
          const creditLine = await this.calculateCreditLine(loan.id);
          if (!creditLine) continue;

          result.updated++;

          // Check for liquidation
          if (creditLine.currentLTV >= LIQUIDATION_LTV) {
            await this.liquidateCreditLine(loan, creditLine);
            result.liquidated++;
            continue;
          }

          // Check for margin call
          if (creditLine.isMarginCall && loan.status !== 'MARGIN_CALL') {
            // Just entered margin call - notify user
            await prisma.notification.create({
              data: {
                userId: loan.userId,
                type: 'LOAN',
                title: '⚠️ Margin Call Warning',
                body: `Your ${loan.collateralChain} credit line LTV is ${creditLine.currentLTV.toFixed(1)}%. Add collateral or repay to avoid liquidation at ${LIQUIDATION_LTV}% LTV.`,
                data: {
                  loanId: loan.id,
                  event: 'MARGIN_CALL',
                  currentLTV: creditLine.currentLTV,
                  liquidationLTV: LIQUIDATION_LTV,
                },
              },
            });
            result.marginCalls++;
          }

          // Record credit line change if significant (>5% change in available credit)
          const prevAvailable = Number(loan.availableCredit);
          const change = Math.abs(creditLine.availableCredit - prevAvailable);
          const changePercent = prevAvailable > 0 ? (change / prevAvailable) * 100 : 0;

          if (changePercent > 5) {
            await prisma.creditDraw.create({
              data: {
                loanId: loan.id,
                userId: loan.userId,
                type: creditLine.availableCredit > prevAvailable ? 'CREDIT_INCREASE' : 'CREDIT_DECREASE',
                amount: change,
                collateralPriceUsd: creditLine.currentCollateralPrice,
                availableCreditAfter: creditLine.availableCredit,
                drawnAmountAfter: creditLine.drawnAmount,
                note: `Credit line ${creditLine.availableCredit > prevAvailable ? 'increased' : 'decreased'} due to ${loan.collateralChain} price change`,
              },
            });
          }
        } catch (err: any) {
          result.errors.push(`Loan ${loan.id.slice(0, 8)}: ${err.message}`);
        }
      }

      if (result.updated > 0 || result.marginCalls > 0 || result.liquidated > 0) {
        console.log(
          `[CreditLine] Updated: ${result.updated}, Margin Calls: ${result.marginCalls}, Liquidated: ${result.liquidated}`
        );
      }

      return result;
    } catch (err: any) {
      result.errors.push(err.message);
      return result;
    }
  },

  /**
   * Liquidate a credit line when LTV gets too high
   */
  async liquidateCreditLine(loan: any, creditLine: CreditLineSummary) {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Update loan status
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          status: 'LIQUIDATED',
          liquidatedAt: now,
          settlementPriceUsd: creditLine.currentCollateralPrice,
        },
      });

      // Record liquidation
      await tx.creditDraw.create({
        data: {
          loanId: loan.id,
          userId: loan.userId,
          type: 'MARGIN_AUTO_REPAY',
          amount: creditLine.drawnAmount,
          collateralPriceUsd: creditLine.currentCollateralPrice,
          availableCreditAfter: 0,
          drawnAmountAfter: 0,
          note: `Credit line liquidated at ${creditLine.currentLTV.toFixed(1)}% LTV`,
        },
      });

      // Deduct any remaining token balance
      await tx.tokenBalance.updateMany({
        where: { userId: loan.userId, token: loan.loanToken },
        data: { balance: 0 },
      });

      // Record transaction
      await tx.transaction.create({
        data: {
          userId: loan.userId,
          type: 'LOAN',
          amount: creditLine.drawnAmount,
          status: 'SUCCESS',
          metadata: {
            event: 'CREDIT_LINE_LIQUIDATION',
            loanId: loan.id,
            liquidationPrice: creditLine.currentCollateralPrice,
            drawnAmount: creditLine.drawnAmount,
            ltvAtLiquidation: creditLine.currentLTV,
          },
        },
      });

      // Notify user
      await tx.notification.create({
        data: {
          userId: loan.userId,
          type: 'LOAN',
          title: '🚨 Credit Line Liquidated',
          body: `Your ${loan.collateralChain} credit line was liquidated at ${creditLine.currentLTV.toFixed(1)}% LTV. Collateral has been seized to cover $${creditLine.drawnAmount.toFixed(2)} drawn.`,
          data: {
            loanId: loan.id,
            event: 'CREDIT_LINE_LIQUIDATION',
            liquidationPrice: creditLine.currentCollateralPrice,
            drawnAmount: creditLine.drawnAmount,
          },
        },
      });
    });

    console.log(
      `[CreditLine] 🚨 LIQUIDATED credit line ${loan.id.slice(0, 8)} — ` +
      `LTV reached ${creditLine.currentLTV.toFixed(1)}%, collateral seized`
    );
  },

  /**
   * Get all credit lines for a user with current status
   */
  async getUserCreditLines(userId: string): Promise<CreditLineSummary[]> {
    const loans = await prisma.loan.findMany({
      where: { userId, loanType: 'DYNAMIC_CREDIT' },
    });

    const summaries: CreditLineSummary[] = [];
    for (const loan of loans) {
      const summary = await this.calculateCreditLine(loan.id);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  },

  /**
   * Get credit line history (draws and repays)
   */
  async getCreditLineHistory(loanId: string, userId: string) {
    const history = await prisma.creditDraw.findMany({
      where: { loanId, userId },
      orderBy: { createdAt: 'desc' },
    });

    return history;
  },
};
