import { ethers } from 'ethers';
import { provider } from '../config/blockchain';
import { env } from '../config/env';
import prisma from '../config/db';
import PoolManagerABI from '../../contracts/abi/PoolManager.json';

let contract: ethers.Contract | null = null;

const isValidAddress = (addr: string): boolean => {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
};

const getContract = (): ethers.Contract | null => {
  if (!env.POOL_MANAGER_CONTRACT || !isValidAddress(env.POOL_MANAGER_CONTRACT)) return null;
  if (!contract) {
    contract = new ethers.Contract(env.POOL_MANAGER_CONTRACT, PoolManagerABI, provider);
  }
  return contract;
};

let listenersActive = false;
let pollingInterval: NodeJS.Timeout | null = null;

export const eventService = {
  // Start listening for blockchain events
  startListening(): void {
    const c = getContract();
    if (!c) {
      console.warn('⚠️  No contract address — event listener not started');
      return;
    }

    if (listenersActive) {
      console.warn('⚠️  Event listeners already active');
      return;
    }

    console.log('⏸️  Event polling DISABLED — public BSC RPC rate limits eth_getLogs');
    console.log('💡 Enable after deploying contract and using paid RPC endpoint');
    listenersActive = true;

    // TODO: Re-enable polling when contract is deployed with paid RPC
    // const pollEvents = async () => { ... };
    // pollingInterval = setInterval(pollEvents, 15000);
  },

  async handleDepositEvent(user: string, poolId: bigint, amount: bigint): Promise<void> {
    console.log(`📥 Deposit detected — user: ${user}, pool: ${poolId}, amount: ${ethers.formatEther(amount)} BNB`);

    try {
      const dbUser = await prisma.user.findUnique({
        where: { walletAddress: user.toLowerCase() },
      });
      if (!dbUser) return;

      await prisma.deposit.create({
        data: {
          userId: dbUser.id,
          poolId: poolId.toString(),
          amount: parseFloat(ethers.formatEther(amount)),
          txHash: `event-${Date.now()}`,
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        },
      });

      console.log(`✅ Deposit recorded for ${user}`);
    } catch (error) {
      console.error('❌ Error processing Deposited event:', error);
    }
  },

  async handleWithdrawEvent(user: string, poolId: bigint, amount: bigint): Promise<void> {
    console.log(`📤 Withdrawal detected — user: ${user}, pool: ${poolId}, amount: ${ethers.formatEther(amount)} BNB`);

    try {
      const dbUser = await prisma.user.findUnique({
        where: { walletAddress: user.toLowerCase() },
      });
      if (!dbUser) return;

      await prisma.transaction.create({
        data: {
          userId: dbUser.id,
          type: 'WITHDRAWAL',
          amount: parseFloat(ethers.formatEther(amount)),
          fromAddress: env.POOL_MANAGER_CONTRACT,
          toAddress: user,
          status: 'SUCCESS',
        },
      });

      console.log(`✅ Withdrawal recorded for ${user}`);
    } catch (error) {
      console.error('❌ Error processing Withdrawn event:', error);
    }
  },

  async handleReferralEvent(referrer: string, referred: string, reward: bigint): Promise<void> {
    console.log(`🎁 Referral reward — referrer: ${referrer}, referred: ${referred}, reward: ${ethers.formatEther(reward)} BNB`);

    try {
      const referrerUser = await prisma.user.findUnique({
        where: { walletAddress: referrer.toLowerCase() },
      });
      if (!referrerUser) return;

      await prisma.transaction.create({
        data: {
          userId: referrerUser.id,
          type: 'REFERRAL_BONUS',
          amount: parseFloat(ethers.formatEther(reward)),
          fromAddress: env.POOL_MANAGER_CONTRACT,
          toAddress: referrer,
          status: 'SUCCESS',
        },
      });

      console.log(`✅ Referral reward recorded for ${referrer}`);
    } catch (error) {
      console.error('❌ Error processing ReferralRewarded event:', error);
    }
  },

  // Stop listening
  stopListening(): void {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    listenersActive = false;
    const c = getContract();
    if (c) {
      c.removeAllListeners();
    }
    console.log('🛑 Event listeners stopped');
  },
};
