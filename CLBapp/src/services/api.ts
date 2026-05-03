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
export const authAPI = {
  login: (walletAddress: string, signature: string) =>
    api.post('/api/auth/login', { walletAddress, signature }),
  register: (walletAddress: string, referralCode?: string) =>
    api.post('/api/auth/register', { walletAddress, referralCode }),
  nonce: (walletAddress: string) =>
    api.get(`/api/auth/nonce/${walletAddress}`),
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
  calculator: (depositUsd: number, asset: string, tier: number) =>
    api.post('/api/user/calculator', { depositUsd, asset, tier }),
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
