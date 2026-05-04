import { ethers, Wallet, Contract } from 'ethers';
import { env } from '../config/env';
import path from 'path';
import fs from 'fs';

// Load ABI
const abiPath = path.join(__dirname, '../../contracts/abi/CLBToken.json');
let CLB_ABI: any[] = [];
try {
  CLB_ABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
} catch {
  console.warn('⚠️  CLBToken ABI not found at', abiPath);
}

// Token contract addresses from env
const TOKEN_ADDRESSES: Record<string, string> = {
  CLB: process.env.CLB_TOKEN_ADDRESS || '',
  CLBg: process.env.CLBG_TOKEN_ADDRESS || '',
  CLBs: process.env.CLBS_TOKEN_ADDRESS || '',
};

// BSC provider
const BSC_RPC = process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org';
const provider = new ethers.JsonRpcProvider(BSC_RPC);

// Hot wallet (minter) — same key used to deploy tokens
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
let wallet: Wallet | null = null;
if (PRIVATE_KEY && PRIVATE_KEY.length >= 64 && !PRIVATE_KEY.includes('never-commit')) {
  wallet = new Wallet(PRIVATE_KEY, provider);
}

function getTokenContract(token: string): Contract | null {
  const address = TOKEN_ADDRESSES[token];
  if (!address || !wallet || CLB_ABI.length === 0) return null;
  return new Contract(address, CLB_ABI, wallet);
}

export const tokenService = {
  /**
   * Check if on-chain token service is configured
   */
  isConfigured(): boolean {
    return !!wallet && CLB_ABI.length > 0 && !!TOKEN_ADDRESSES.CLB;
  },

  /**
   * Get contract address for a token
   */
  getAddress(token: string): string {
    return TOKEN_ADDRESSES[token] || '';
  },

  /**
   * Mint tokens to a user's wallet (called when loan is issued)
   */
  async mint(token: string, toAddress: string, amount: number): Promise<{ txHash: string } | null> {
    const contract = getTokenContract(token);
    if (!contract) {
      console.log(`[TokenService] Not configured for on-chain mint of ${token}`);
      return null;
    }

    try {
      const amountWei = ethers.parseUnits(amount.toString(), 18);
      const tx = await contract.mint(toAddress, amountWei);
      const receipt = await tx.wait();
      console.log(`[TokenService] Minted ${amount} ${token} to ${toAddress} — tx: ${receipt.hash}`);
      return { txHash: receipt.hash };
    } catch (err: any) {
      console.error(`[TokenService] Mint failed:`, err.message);
      throw err;
    }
  },

  /**
   * Transfer tokens from hot wallet to a user (external transfer)
   */
  async transfer(token: string, toAddress: string, amount: number): Promise<{ txHash: string } | null> {
    const contract = getTokenContract(token);
    if (!contract) {
      console.log(`[TokenService] Not configured for on-chain transfer of ${token}`);
      return null;
    }

    try {
      const amountWei = ethers.parseUnits(amount.toString(), 18);
      const tx = await contract.transfer(toAddress, amountWei);
      const receipt = await tx.wait();
      console.log(`[TokenService] Transferred ${amount} ${token} to ${toAddress} — tx: ${receipt.hash}`);
      return { txHash: receipt.hash };
    } catch (err: any) {
      console.error(`[TokenService] Transfer failed:`, err.message);
      throw err;
    }
  },

  /**
   * Get on-chain balance of a user
   */
  async getBalance(token: string, address: string): Promise<number> {
    const contract = getTokenContract(token);
    if (!contract) return 0;

    try {
      const balance = await contract.balanceOf(address);
      return parseFloat(ethers.formatUnits(balance, 18));
    } catch {
      return 0;
    }
  },

  /**
   * Get all 3 token addresses for Trust Wallet import
   */
  getTokenAddresses(): Record<string, string> {
    return { ...TOKEN_ADDRESSES };
  },
};
