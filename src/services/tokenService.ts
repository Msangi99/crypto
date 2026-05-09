import { ethers, Wallet, Contract } from 'ethers';
import { env } from '../config/env';
import path from 'path';
import fs from 'fs';

/** Resolve CLBToken ABI — production often fails if only `dist/` is copied and `contracts/abi` is missing. */
function loadClbAbi(): { abi: any[]; resolvedFrom: string | null; tried: string[] } {
  const tried: string[] = [];
  const candidates: string[] = [];

  const envOverride = process.env.CLB_TOKEN_ABI_PATH?.trim();
  if (envOverride) candidates.push(envOverride);

  candidates.push(
    path.join(__dirname, '../../contracts/abi/CLBToken.json'),
    path.join(process.cwd(), 'contracts/abi/CLBToken.json'),
  );

  for (const p of candidates) {
    tried.push(p);
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return { abi: parsed, resolvedFrom: p, tried };
        }
      }
    } catch {
      // try next
    }
  }

  try {
    // Same resolution as compiled `require` from dist/services → repo/contracts
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('../../contracts/abi/CLBToken.json') as unknown;
    tried.push('require(../../contracts/abi/CLBToken.json)');
    if (Array.isArray(mod) && mod.length > 0) {
      return { abi: mod, resolvedFrom: 'require:../../contracts/abi/CLBToken.json', tried };
    }
  } catch {
    // ignore
  }

  console.warn('⚠️  CLBToken ABI not found. Set CLB_TOKEN_ABI_PATH or copy contracts/abi/CLBToken.json next to the app. Tried:', tried);
  return { abi: [], resolvedFrom: null, tried };
}

const { abi: CLB_ABI, resolvedFrom: CLB_ABI_RESOLVED_FROM, tried: CLB_ABI_TRIED } = loadClbAbi();

function trimAddr(v: string): string {
  return (v || '').trim();
}

// Token contract addresses from env
const TOKEN_ADDRESSES: Record<string, string> = {
  CLB: trimAddr(env.CLB_TOKEN_ADDRESS),
  CLBg: trimAddr(env.CLBG_TOKEN_ADDRESS),
  CLBs: trimAddr(env.CLBS_TOKEN_ADDRESS),
  GLM: trimAddr(env.GLM_TOKEN_ADDRESS),
};

// BSC provider
const BSC_RPC = env.CHAIN_ID === 56 ? env.BSC_RPC_URL : env.BSC_TESTNET_RPC_URL;
const provider = new ethers.JsonRpcProvider(BSC_RPC);

// Hot wallet (minter) — same key used to deploy tokens
const PRIVATE_KEY = env.PRIVATE_KEY;
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
  isConfigured(token = 'CLB'): boolean {
    return !!wallet && CLB_ABI.length > 0 && !!TOKEN_ADDRESSES[token];
  },

  getConfigStatus(token = 'CLB') {
    return {
      token,
      configured: !!wallet && CLB_ABI.length > 0 && !!TOKEN_ADDRESSES[token],
      hasTokenAddress: !!TOKEN_ADDRESSES[token],
      hasPrivateKey: !!wallet,
      hasAbi: CLB_ABI.length > 0,
      chainId: env.CHAIN_ID,
      abiResolvedFrom: CLB_ABI_RESOLVED_FROM,
      abiTriedPaths: CLB_ABI_TRIED,
      cwd: process.cwd(),
    };
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
   * Send tokens on-chain using the best available method:
   * - prefer mint() when contract exposes it (CLB family)
   * - otherwise fallback to transfer() (standard ERC-20/BEP-20 like GLM)
   */
  async sendOnChain(
    token: string,
    toAddress: string,
    amount: number,
    opts?: { preferMint?: boolean },
  ): Promise<{ txHash: string; method: 'mint' | 'transfer' } | null> {
    const contract = getTokenContract(token);
    if (!contract) {
      console.log(`[TokenService] Not configured for on-chain send of ${token}`);
      return null;
    }

    const amountWei = ethers.parseUnits(amount.toString(), 18);
    const preferMint = opts?.preferMint !== false;
    const canMint = contract.interface.hasFunction('mint(address,uint256)');

    if (preferMint && canMint) {
      try {
        const tx = await contract.mint(toAddress, amountWei);
        const receipt = await tx.wait();
        console.log(`[TokenService] Minted ${amount} ${token} to ${toAddress} — tx: ${receipt.hash}`);
        return { txHash: receipt.hash, method: 'mint' };
      } catch (err: any) {
        console.warn(`[TokenService] Mint path failed for ${token}, fallback to transfer:`, err?.message);
      }
    }

    try {
      const tx = await contract.transfer(toAddress, amountWei);
      const receipt = await tx.wait();
      console.log(`[TokenService] Transferred ${amount} ${token} to ${toAddress} — tx: ${receipt.hash}`);
      return { txHash: receipt.hash, method: 'transfer' };
    } catch (err: any) {
      console.error(`[TokenService] sendOnChain failed for ${token}:`, err.message);
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

  getExplorerTxUrl(txHash: string): string {
    const baseUrl = env.CHAIN_ID === 56 ? 'https://bscscan.com' : 'https://testnet.bscscan.com';
    return `${baseUrl}/tx/${txHash}`;
  },
};
