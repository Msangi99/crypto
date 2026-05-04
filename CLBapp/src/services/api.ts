import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = 'https://api.cryptoloanboost.com';

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
  devLogin: (walletAddress: string) =>
    api.post('/api/auth/dev-login', { walletAddress }),
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
  importAccount: (secretKey: string) =>
    api.post('/api/auth/import', { secretKey }),
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

// ─── Pools ────────────────────────────────────────────────
export const poolsAPI = {
  list: (page = 1, limit = 10) =>
    api.get(`/api/pools?page=${page}&limit=${limit}`),
  stats: () => api.get('/api/pools/stats'),
  detail: (id: string) => api.get(`/api/pools/${id}`),
  deposit: (poolId: string, amount: number, txHash: string) =>
    api.post(`/api/pools/${poolId}/deposit`, { amount, txHash }),
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
  }) => api.post('/api/tokens/transfer', data),
  history: (page = 1, limit = 20, token?: string) =>
    api.get(`/api/tokens/history?page=${page}&limit=${limit}${token ? `&token=${token}` : ''}`),
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
