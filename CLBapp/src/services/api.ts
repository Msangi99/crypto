import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

/**
 * Must match the API where you edit pools in admin.
 * - Admin uses `NEXT_PUBLIC_API_URL` (see clb-admin/lib/api.ts), default localhost:3000.
 * - Set in CLBapp: `EXPO_PUBLIC_API_URL=https://your-api` in `.env` then restart Expo (`npx expo start -c`).
 * - If unset, production API is used (changes on localhost admin will not show here).
 */
const BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://api.cryptoloanboost.com').replace(/\/$/, '');

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('clb_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 — token expired or logged in from another device
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const msg = error.response?.data?.error || '';
      // Clear stored auth data
      await SecureStore.deleteItemAsync('clb_token');
      // Notify app to redirect to login
      if (typeof globalThis.__CLB_AUTH_EXPIRED__ === 'function') {
        globalThis.__CLB_AUTH_EXPIRED__(msg);
      }
    }
    return Promise.reject(error);
  }
);

// Global callback for auth expiry (set by RootNavigator)
declare global {
  var __CLB_AUTH_EXPIRED__: ((msg?: string) => void) | undefined;
}

// ─── Auth ─────────────────────────────────────────────────
// Backend flow: GET /nonce (creates user if new) → POST /verify (returns JWT)
// Dev flow: POST /dev-login (no signature needed, for mobile app testing)
export const authAPI = {
  getNonce: (walletAddress: string) =>
    api.get(`/api/auth/nonce/${walletAddress}`),
  verify: (walletAddress: string, signature: string) =>
    api.post('/api/auth/verify', { walletAddress, signature }),
  devLogin: (walletAddress: string, opts?: { email?: string; recoveryPhrase?: string; accountPassword?: string }) =>
    api.post('/api/auth/dev-login', { walletAddress, ...opts }),
  /** Read-only: true if no CLB account exists for this address (create-wallet flow before PIN). */
  checkWalletAvailable: (walletAddress: string) =>
    api.get<{ success: boolean; available: boolean; walletAddress: string }>(
      `/api/auth/wallet-available/${encodeURIComponent(walletAddress)}`
    ),
  createWallet: () =>
    api.post('/api/auth/create-wallet'),
  setupPin: (pin: string, enableBiometric = false) =>
    api.post('/api/auth/setup-pin', { pin, enableBiometric }),
  verifyPin: (pin: string) =>
    api.post('/api/auth/verify-pin', { pin }),
  toggleBiometric: (enabled: boolean) =>
    api.post('/api/auth/biometric', { enabled }),
  getProfile: () =>
    api.get('/api/auth/profile'),
  updateProfile: (data: { username?: string; email?: string; avatar?: string }) =>
    api.put('/api/auth/profile', data),
  // Secret key / recovery phrase
  viewSecretKey: (pin: string) =>
    api.post('/api/auth/secret-key', { pin }),
  generateSecretKey: () =>
    api.post('/api/auth/secret-key/generate'),
  importAccount: (secretKey: string, pin?: string) =>
    api.post('/api/auth/import', { secretKey, ...(pin ? { pin } : {}) }),
  /** Restore by BEP-20 + phrase OR account password (from registration) + PIN when set */
  recoverAccount: (body: {
    walletAddress: string;
    method: 'phrase' | 'password';
    phrase?: string;
    accountPassword?: string;
    pin?: string;
  }) => api.post('/api/auth/recover', body),
};

// ─── User Dashboard ────────────────────────────────────────
export const userAPI = {
  dashboard: () => api.get('/api/user/dashboard'),
  portfolio: () => api.get('/api/user/portfolio'),
  position: (poolId: string) => api.get(`/api/user/portfolio/${poolId}`),
  referralTree: () => api.get('/api/user/referrals/tree'),
  referralEarnings: () => api.get('/api/user/referrals/earnings'),
  receipts: () => api.get('/api/user/receipts'),
  activity: (limit = 20, page = 1) =>
    api.get(`/api/user/activity?limit=${limit}&page=${page}`),
  calculator: (poolFee: number, asset: string) =>
    api.post('/api/user/calculator', { poolFee, asset }),
  market: () => api.get('/api/user/market'),
};

// ─── Referrals ───────────────────────────────────────────────
export const referralsAPI = {
  apply: (code: string) =>
    api.post('/api/referrals/apply', { code }),
};

// ─── Pools ────────────────────────────────────────────────
export const poolsAPI = {
  list: (page = 1, limit = 10) =>
    api.get(`/api/pools?page=${page}&limit=${limit}`),
  stats: () => api.get('/api/pools/stats'),
  settings: () => api.get('/api/pools/settings'),
  detail: (id: string) => api.get(`/api/pools/${id}`),
  deposit: (poolId: string, amount: number, txHash?: string) =>
    api.post(`/api/pools/${poolId}/deposit`, { amount, ...(txHash ? { txHash } : {}) }),
  claimCredit: (poolId: string) =>
    api.post(`/api/pools/${poolId}/claim-credit`),
};

// ─── Credit wallet API (depositCreditUsd = Deposit wallet; claimedPoolCreditUsd = Loan credit) ───
export const creditWalletAPI = {
  config: () =>
    api.get<{
      success: boolean;
      config: {
        chainId: number;
        networkLabel: string;
        assetSymbol: string;
        assetStandard: string;
        usdtContractAddress: string;
        treasuryAddress: string | null;
        minConfirmations: number;
        treasuryConfigured: boolean;
      };
    }>('/api/credit-wallet/config'),
  balances: () =>
    api.get<{
      success: boolean;
      balances: {
        depositCreditUsd: number;
        claimedPoolCreditUsd: number;
        swapHoldingsUsd: number;
      };
    }>('/api/credit-wallet/balances'),
  confirmDeposit: (txHash: string) =>
    api.post<{
      success: boolean;
      creditedUsd?: number;
      newDepositCreditUsd?: number;
      error?: string;
    }>('/api/credit-wallet/confirm-deposit', { txHash }),
  poolEligibility: () =>
    api.get<{
      success: boolean;
      depositCreditUsd: number;
      claimedPoolCreditUsd?: number;
      claimFeeSpendableUsd?: number;
      pools: Array<{
        poolId: string;
        name: string;
        supportsAppCredit: boolean;
        creditMinUsd: number;
        creditCreditedUsd: number | null;
        packageMisconfigured?: boolean;
        canClaimWithCredit: boolean;
      }>;
    }>('/api/credit-wallet/pool-eligibility'),
};

// ─── Price ────────────────────────────────────────────────
export const priceAPI = {
  current: () => api.get('/api/price'),
};

// ─── Notifications ────────────────────────────────────────
export const notificationsAPI = {
  list: (page = 1, limit = 20, unreadOnly = false) =>
    api.get(`/api/notifications?page=${page}&limit=${limit}&unreadOnly=${unreadOnly}`),
  unreadCount: () =>
    api.get('/api/notifications/unread-count'),
  markRead: (id: string) =>
    api.patch(`/api/notifications/${id}/read`),
  markAllRead: () =>
    api.patch('/api/notifications/mark-all-read'),
  delete: (id: string) =>
    api.delete(`/api/notifications/${id}`),
};

// ─── Loans ─────────────────────────────────────────────────
export const loansAPI = {
  request: (data: {
    collateralChain: string;
    collateralAmount: number;
    collateralPriceUsd: number;
    targetPriceUsd?: number;
  }) => api.post('/api/loans/request', data),
  confirmDeposit: (loanId: string, txHash: string) =>
    api.post(`/api/loans/${loanId}/confirm-deposit`, { txHash }),
  list: () => api.get('/api/loans'),
  detail: (id: string) => api.get(`/api/loans/${id}`),
  tiers: () => api.get('/api/loans/tiers'),
};

export type MiningPackageDto = {
  id: string;
  name: string;
  description: string | null;
  tokenSymbol: string;
  tokensPerPeriod: number;
  periodLength: number;
  periodUnit: 'MINUTE' | 'HOUR' | 'DAY';
  isFree: boolean;
  priceUsd: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

// ─── CLB mining packages (public list for Mine CLB screen) ───
export const miningPackagesAPI = {
  list: () => api.get<{ success: boolean; packages: MiningPackageDto[] }>('/api/mining-packages'),
};

export type MiningSubscriptionDto = {
  id: string;
  packageId: string;
  payoutAddress: string;
  startedAt: string;
  package: MiningPackageDto;
  tokenSymbol: string;
  accruedTokens: number;
  periodProgressPct: number;
};

// ─── User mining machine (auth) ─────────────────────────────
export const miningUserAPI = {
  subscription: () =>
    api.get<{ success: boolean; subscription: MiningSubscriptionDto | null }>('/api/mining/subscription'),
  subscribe: (body: { packageId: string; payoutAddress: string }) =>
    api.post<{
      success: boolean;
      subscription: MiningSubscriptionDto | null;
      upgraded?: boolean;
      balances?: { depositCreditUsd: number; claimedPoolCreditUsd: number };
    }>('/api/mining/subscribe', body),
  claim: () =>
    api.post<{
      success: boolean;
      claimed: number;
      token: string;
      message?: string;
    }>('/api/mining/claim'),
};

// ─── Tokens (CLB, CLBg, CLBs) ──────────────────────────────
export const tokensAPI = {
  balances: () => api.get('/api/tokens/balances'),
  prices: () => api.get('/api/tokens/prices'),
  contracts: () => api.get('/api/tokens/contracts'),
  transfer: (data: {
    toAddress: string;
    token: string;
    amount: number;
    note?: string;
    delivery?: 'INTERNAL' | 'ON_CHAIN';
  }) => api.post('/api/tokens/transfer', data),
  history: (page = 1, limit = 20, token?: string) =>
    api.get(`/api/tokens/history?page=${page}&limit=${limit}${token ? `&token=${token}` : ''}`),
  syncStatus: () => api.get('/api/tokens/sync-status'),
  syncPortfolio: () => api.post('/api/tokens/sync-portfolio'),
};

// ─── Withdrawals ────────────────────────────────────────────
export const withdrawalsAPI = {
  request: (data: { token: string; amount: number; toAddress: string }) =>
    api.post('/api/withdrawals/request', data),
  list: (page = 1, limit = 20, status?: string) =>
    api.get(`/api/withdrawals?page=${page}&limit=${limit}${status ? `&status=${status}` : ''}`),
  detail: (id: string) => api.get(`/api/withdrawals/${id}`),
  fees: () => api.get('/api/withdrawals/fees'),
};

// ─── Health ───────────────────────────────────────────────
export const healthAPI = {
  check: () => api.get('/health'),
};
