import { ethers } from 'ethers';
import { env } from './env';

// BSC Provider (testnet or mainnet based on CHAIN_ID)
const rpcUrl = env.CHAIN_ID === 56 ? env.BSC_RPC_URL : env.BSC_TESTNET_RPC_URL;

export const provider = new ethers.JsonRpcProvider(rpcUrl);

// Wallet signer for write operations
export const getWalletSigner = (): ethers.Wallet | null => {
  if (!env.PRIVATE_KEY) {
    console.warn('⚠️  PRIVATE_KEY not set — write operations disabled');
    return null;
  }
  return new ethers.Wallet(env.PRIVATE_KEY, provider);
};

// Verify BSC connection
export const verifyConnection = async (): Promise<boolean> => {
  try {
    const network = await provider.getNetwork();
    console.log(`🔗 Connected to BSC — Chain ID: ${network.chainId}`);
    return true;
  } catch (error) {
    console.error('❌ BSC connection failed:', error);
    return false;
  }
};
