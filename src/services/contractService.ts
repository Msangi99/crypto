import { ethers } from 'ethers';
import { provider, getWalletSigner } from '../config/blockchain';
import { env } from '../config/env';
import PoolManagerABI from '../../contracts/abi/PoolManager.json';

// Read-only contract instance
const getReadContract = (): ethers.Contract => {
  return new ethers.Contract(env.POOL_MANAGER_CONTRACT, PoolManagerABI, provider);
};

// Write contract instance (requires private key)
const getWriteContract = (): ethers.Contract | null => {
  const signer = getWalletSigner();
  if (!signer) return null;
  return new ethers.Contract(env.POOL_MANAGER_CONTRACT, PoolManagerABI, signer);
};

export const contractService = {
  // Get pool info from smart contract
  async getPoolInfo(poolId: number) {
    try {
      const contract = getReadContract();
      const [totalStaked, memberCount, apy, isActive] = await contract.getPoolInfo(poolId);
      return {
        totalStaked: ethers.formatEther(totalStaked),
        memberCount: Number(memberCount),
        apy: Number(apy),
        isActive,
      };
    } catch (error) {
      console.error('❌ getPoolInfo error:', error);
      throw new Error('Failed to fetch pool info from blockchain');
    }
  },

  // Get user stake amount
  async getUserStake(userAddress: string, poolId: number) {
    try {
      const contract = getReadContract();
      const stake = await contract.getUserStake(userAddress, poolId);
      return ethers.formatEther(stake);
    } catch (error) {
      console.error('❌ getUserStake error:', error);
      throw new Error('Failed to fetch user stake from blockchain');
    }
  },

  // Deposit into pool (server-side tx — used for admin/backend operations)
  async deposit(poolId: number, amountInBnb: string) {
    const contract = getWriteContract();
    if (!contract) throw new Error('Write operations disabled — no private key');

    try {
      const tx = await contract.deposit(poolId, {
        value: ethers.parseEther(amountInBnb),
      });
      const receipt = await tx.wait();
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      console.error('❌ deposit error:', error);
      throw new Error('Blockchain deposit failed');
    }
  },

  // Register referral on-chain
  async registerReferral(referrerAddress: string) {
    const contract = getWriteContract();
    if (!contract) throw new Error('Write operations disabled — no private key');

    try {
      const tx = await contract.registerReferral(referrerAddress);
      const receipt = await tx.wait();
      return { txHash: receipt.hash };
    } catch (error) {
      console.error('❌ registerReferral error:', error);
      throw new Error('Referral registration on blockchain failed');
    }
  },
};
