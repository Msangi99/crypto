import { ethers } from 'ethers';
import { provider } from '../config/blockchain';
import { env } from '../config/env';
import prisma from '../config/db';
import PoolManagerABI from '../../contracts/abi/PoolManager.json';

let contract: ethers.Contract | null = null;

const getContract = (): ethers.Contract | null => {
  if (!env.POOL_MANAGER_CONTRACT) return null;
  if (!contract) {
    contract = new ethers.Contract(env.POOL_MANAGER_CONTRACT, PoolManagerABI, provider);
  }
  return contract;
};

export const eventService = {
  // Start listening for blockchain events
  startListening(): void {
    const c = getContract();
    if (!c) {
      console.warn('⚠️  No contract address — event listener not started');
      return;
    }

    console.log('👂 Starting blockchain event listeners...');

    // Listen for Deposit events
    c.on('Deposited', async (user: string, poolId: bigint, amount: bigint) => {
      console.log(`📥 Deposit detected — user: ${user}, pool: ${poolId}, amount: ${ethers.formatEther(amount)} BNB`);

      try {
        // Find user by wallet
        const dbUser = await prisma.user.findUnique({
          where: { walletAddress: user.toLowerCase() },
        });
        if (!dbUser) return;

        // Record deposit in database
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
    });

    // Listen for Withdrawal events
    c.on('Withdrawn', async (user: string, poolId: bigint, amount: bigint) => {
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
    });

    // Listen for Referral Reward events
    c.on('ReferralRewarded', async (referrer: string, referred: string, reward: bigint) => {
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
    });

    console.log('✅ All event listeners active');
  },

  // Stop listening
  stopListening(): void {
    const c = getContract();
    if (c) {
      c.removeAllListeners();
      console.log('🛑 Event listeners stopped');
    }
  },
};
