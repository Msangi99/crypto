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
  getProfile: () =>
    api.get('/api/auth/profile'),
  updateProfile: (data: { username?: string; email?: string }) =>
    api.put('/api/auth/profile', data),
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
};

// ─── Price ────────────────────────────────────────────────
export const priceAPI = {
  current: () => api.get('/api/price'),
};

// ─── Health ───────────────────────────────────────────────
export const healthAPI = {
  check: () => api.get('/health'),
};
