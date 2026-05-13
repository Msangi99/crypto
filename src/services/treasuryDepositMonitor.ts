import { ethers } from 'ethers';
import { Prisma } from '@prisma/client';
import prisma from '../config/db';
import { provider } from '../config/blockchain';
import { env } from '../config/env';
import { resolveTreasuryUsdtConfig } from './treasuryUsdtDeposit';

const TRANSFER_IFACE = new ethers.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

interface MonitoredDeposit {
  txHash: string;
  fromAddress: string;
  amount: Prisma.Decimal;
  decimals: number;
}

/**
 * Polls the treasury address for new USDT transfers and auto-credits users
 * This service should be called periodically (e.g., every 1-2 minutes)
 */
export async function monitorTreasuryDeposits(): Promise<{
  processed: number;
  errors: string[];
}> {
  const result = { processed: 0, errors: [] as string[] };

  try {
    const { treasury, usdt } = await resolveTreasuryUsdtConfig();
    
    if (!treasury || !usdt) {
      return result; // Treasury not configured, skip monitoring
    }

    // Get the latest block number
    const latestBlock = await provider.getBlockNumber();
    
    // Get the last monitored block from settings (or start from 100 blocks ago for initial run)
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
    const lastMonitoredBlock = settings?.lastMonitoredBlock 
      ? Number(settings.lastMonitoredBlock) 
      : latestBlock - 100;

    // Ensure we don't try to fetch too many blocks at once
    const startBlock = Math.max(lastMonitoredBlock, latestBlock - 1000);
    
    console.log(`[TreasuryMonitor] Scanning blocks ${startBlock} to ${latestBlock} for USDT transfers to ${treasury}`);

    // Get USDT contract
    const usdtContract = new ethers.Contract(
      usdt,
      ['function decimals() view returns (uint8)', 'event Transfer(address indexed from, address indexed to, uint256 value)'],
      provider
    );
    const decimals = Number(await usdtContract.decimals());

    // Query Transfer events to the treasury address
    const filter = usdtContract.filters.Transfer(null, treasury);
    const events = await usdtContract.queryFilter(filter, startBlock, latestBlock);

    console.log(`[TreasuryMonitor] Found ${events.length} Transfer events`);

    for (const event of events) {
      try {
        const txHash = event.transactionHash;

        // Skip if already processed
        const existing = await prisma.deposit.findUnique({ where: { txHash } });
        if (existing) continue;

        // Parse the event log to get Transfer event args
        let parsed: ethers.LogDescription | null = null;
        try {
          parsed = TRANSFER_IFACE.parseLog({
            topics: event.topics as string[],
            data: event.data,
          });
        } catch {
          continue;
        }

        if (!parsed || parsed.name !== 'Transfer') continue;

        const fromAddress = (parsed.args[0] as string).toLowerCase();
        const toAddress = (parsed.args[1] as string).toLowerCase();
        const value = parsed.args[2] as bigint;

        // Only process transfers to the treasury
        if (toAddress !== treasury.toLowerCase() || value === 0n) continue;

        // Find user by wallet address
        const user = await prisma.user.findFirst({
          where: { walletAddress: ethers.getAddress(fromAddress).toLowerCase() },
        });

        if (!user) {
          console.log(`[TreasuryMonitor] No user found for address ${fromAddress}`);
          continue;
        }

        // Get transaction receipt for confirmation count
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt || receipt.status !== 1) continue;

        const currentBlock = await provider.getBlockNumber();
        const confirms = receipt.blockNumber != null ? currentBlock - receipt.blockNumber + 1 : 0;

        if (confirms < env.USDT_DEPOSIT_MIN_CONFIRMATIONS) {
          console.log(`[TreasuryMonitor] Transaction ${txHash} has only ${confirms} confirmations, waiting...`);
          continue;
        }

        // Convert amount to USD
        const human = ethers.formatUnits(value, decimals);
        const amount = new Prisma.Decimal(human);

        // Credit the user
        await prisma.$transaction(async (tx) => {
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
              confirmations: confirms,
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
                kind: 'TREASURY_USDT_AUTO',
                usdtContract: usdt,
                autoDetected: true,
              },
            },
          });

          const updated = await tx.user.update({
            where: { id: user.id },
            data: { depositCreditUsd: { increment: amount } },
            select: { depositCreditUsd: true },
          });

          // Notify user
          await tx.notification.create({
            data: {
              userId: user.id,
              type: 'DEPOSIT',
              title: '💰 Deposit Auto-Credited',
              body: `Your USDT deposit of $${amount.toFixed(2)} was automatically detected and credited to your deposit wallet.`,
              data: {
                txHash,
                amount: Number(amount),
                newDepositCreditUsd: Number(updated.depositCreditUsd),
              },
            },
          });

          console.log(`[TreasuryMonitor] Auto-credited user ${user.walletAddress} with $${amount.toFixed(2)}`);
        });

        result.processed++;
      } catch (err: any) {
        const msg = err.message || String(err);
        console.error(`[TreasuryMonitor] Error processing event: ${msg}`);
        result.errors.push(msg);
      }
    }

    // Update last monitored block
    await prisma.platformSettings.upsert({
      where: { id: 'default' },
      update: { lastMonitoredBlock: latestBlock },
      create: { id: 'default', freePoolsEnabled: false, lastMonitoredBlock: latestBlock },
    });

    console.log(`[TreasuryMonitor] Completed: processed ${result.processed} deposits, ${result.errors.length} errors`);
  } catch (err: any) {
    console.error(`[TreasuryMonitor] Fatal error: ${err.message}`);
    result.errors.push(err.message);
  }

  return result;
}
