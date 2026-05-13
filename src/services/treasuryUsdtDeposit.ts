import { ethers } from 'ethers';
import { Prisma } from '@prisma/client';
import { provider } from '../config/blockchain';
import prisma from '../config/db';
import { env } from '../config/env';

const TRANSFER_IFACE = new ethers.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

export async function resolveTreasuryUsdtConfig(): Promise<{
  treasury: string | null;
  usdt: string;
  minConfirmations: number;
  minDepositUsd: number;
}> {
  const settings = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
  const treasury = settings?.depositTreasuryAddress?.trim() || null;
  const usdt = (settings?.usdtBep20Address?.trim() || env.USDT_BEP20_ADDRESS || '').trim();
  const minDepositUsd = settings?.depositMinUsd ? Number(settings.depositMinUsd.toString()) : env.USDT_DEPOSIT_MIN_USD;
  return {
    treasury,
    usdt,
    minConfirmations: env.USDT_DEPOSIT_MIN_CONFIRMATIONS,
    minDepositUsd,
  };
}

/**
 * Confirms a BEP-20 USDT transfer from the user's wallet to the treasury in `txHash`.
 * Sums all matching Transfer logs in the receipt.
 */
export async function verifyUsdtTreasuryDeposit(
  txHash: string,
  userWalletAddress: string,
  treasury: string,
  usdtContract: string,
  _minDepositUsd: number
): Promise<{ amount: Prisma.Decimal; decimals: number }> {
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) {
    throw new Error('Transaction not found or failed');
  }

  const c = new ethers.Contract(usdtContract, ['function decimals() view returns (uint8)'], provider);
  const decimals = Number(await c.decimals());

  const userLc = ethers.getAddress(userWalletAddress).toLowerCase();
  const treasuryLc = ethers.getAddress(treasury).toLowerCase();
  const usdtLc = usdtContract.toLowerCase();

  let total = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdtLc) continue;
    let parsed: ethers.LogDescription | null = null;
    try {
      parsed = TRANSFER_IFACE.parseLog({
        topics: log.topics as string[],
        data: log.data,
      });
    } catch {
      continue;
    }
    if (!parsed || parsed.name !== 'Transfer') continue;
    const from = (parsed.args[0] as string).toLowerCase();
    const to = (parsed.args[1] as string).toLowerCase();
    const value = parsed.args[2] as bigint;
    if (from === userLc && to === treasuryLc) total += value;
  }

  if (total === 0n) {
    throw new Error('No USDT transfer from your wallet to the treasury address in this transaction');
  }

  const human = ethers.formatUnits(total, decimals);
  const amount = new Prisma.Decimal(human);

  const currentBlock = await provider.getBlockNumber();
  const confirms = receipt.blockNumber != null ? currentBlock - receipt.blockNumber + 1 : 0;
  if (confirms < env.USDT_DEPOSIT_MIN_CONFIRMATIONS) {
    throw new Error(
      `Waiting for confirmations (${confirms}/${env.USDT_DEPOSIT_MIN_CONFIRMATIONS})`
    );
  }

  return { amount, decimals };
}
