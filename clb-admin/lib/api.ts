const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("clb_token") : null;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API Error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Health
  health: () => request<{ status: string; database: string; blockchain: string }>("/health"),

  // Auth
  getNonce: (wallet: string) =>
    request<{ success: boolean; nonce: string }>(`/api/auth/nonce/${wallet}`),
  verify: (walletAddress: string, signature: string) =>
    request<{
      success: boolean;
      token: string;
      user: { id: string; walletAddress: string; username: string | null; role: string };
    }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ walletAddress, signature }),
    }),
  adminLogin: (email: string, password: string) =>
    request<{
      success: boolean;
      token: string;
      user: { id: string; walletAddress: string; username: string | null; role: string };
    }>("/api/auth/admin-login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  getProfile: () =>
    request<{
      success: boolean;
      user: {
        id: string;
        walletAddress: string;
        username: string | null;
        email: string | null;
        role: string;
        isActive: boolean;
        createdAt: string;
      };
    }>("/api/auth/profile"),
  updateProfile: (data: { username?: string; email?: string }) =>
    request<{ success: boolean; user: Record<string, unknown> }>("/api/auth/profile", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Pools
  getPools: (page = 1, limit = 20) =>
    request<{
      success: boolean;
      data: Array<{
        id: string;
        name: string;
        description: string | null;
        tokenSymbol: string;
        minDeposit: number;
        maxDeposit: number | null;
        apy: number;
        totalStaked: number;
        status: string;
        startDate: string;
        memberCount: number;
        contractAddress: string | null;
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/pools?page=${page}&limit=${limit}`),
  getPoolStats: () =>
    request<{
      success: boolean;
      stats: {
        totalPools: number;
        activePools: number;
        totalValueLocked: number;
        totalMembers: number;
      };
    }>("/api/pools/stats"),
  createPool: (data: {
    name: string;
    description?: string;
    tokenSymbol?: string;
    minDeposit?: number;
    maxDeposit?: number;
    apy?: number;
    contractAddress?: string;
    endDate?: string;
  }) =>
    request<{ success: boolean; pool: Record<string, unknown> }>("/api/pools", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Transactions
  getTransactions: (page = 1, limit = 20) =>
    request<{
      success: boolean;
      transactions: Array<{
        id: string;
        type: string;
        amount: number;
        fromAddress: string | null;
        toAddress: string | null;
        txHash: string | null;
        status: string;
        createdAt: string;
      }>;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/api/transactions?page=${page}&limit=${limit}`),

  // Referrals
  getReferralStats: () =>
    request<{
      success: boolean;
      stats: {
        totalReferrals: number;
        totalRewardsDistributed: number;
        topReferrers: Array<{
          walletAddress: string;
          count: number;
          totalReward: number;
        }>;
      };
    }>("/api/referrals/stats"),

  // Prices
  getPrices: () =>
    request<{
      success: boolean;
      prices: Record<string, { usd: number; usd_24h_change: number }>;
    }>("/api/prices"),
};
