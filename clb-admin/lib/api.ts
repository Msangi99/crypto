const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export type AdminMiningPackage = {
  id: string;
  name: string;
  description: string | null;
  tokenSymbol: string;
  tokensPerPeriod: number;
  periodLength: number;
  periodUnit: "MINUTE" | "HOUR" | "DAY";
  isFree: boolean;
  priceUsd: number | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminMiningPackageInput = {
  name: string;
  description?: string | null;
  tokenSymbol?: string;
  tokensPerPeriod: number;
  periodLength: number;
  periodUnit: string;
  isFree?: boolean;
  priceUsd?: number | null;
  sortOrder?: number;
  isActive?: boolean;
};

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
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const msg =
      (typeof body.error === "string" && body.error) ||
      (typeof body.message === "string" && body.message) ||
      res.statusText;
    throw new Error(msg || `API Error: ${res.status}`);
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
    supportsAppCredit?: boolean;
    creditMinUsd?: number | null;
    creditCreditedUsd?: number | null;
  }) =>
    request<{ success: boolean; pool: Record<string, unknown> }>("/api/pools", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updatePool: (id: string, data: {
    name?: string; description?: string; tokenSymbol?: string;
    minDeposit?: number; maxDeposit?: number; apy?: number;
    status?: string; endDate?: string;
    contractAddress?: string | null;
    supportsAppCredit?: boolean;
    creditMinUsd?: number | null;
    creditCreditedUsd?: number | null;
  }) =>
    request<{ success: boolean; pool: Record<string, unknown> }>(`/api/pools/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getAdminPoolPackages: () =>
    request<{
      success: boolean;
      count: number;
      pools: Array<{
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
        endDate: string | null;
        contractAddress: string | null;
        supportsAppCredit: boolean;
        creditMinUsd: number | null;
        creditCreditedUsd: number | null;
        createdAt: string;
        updatedAt: string;
        memberCount: number;
      }>;
    }>("/api/admin/pool-packages"),
  deletePool: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/pools/${id}`, {
      method: "DELETE",
    }),

  // Admin — users
  getAdminUsers: (page = 1, limit = 15, search = "") =>
    request<{
      users: Array<{
        id: string;
        walletAddress: string;
        username: string | null;
        email: string | null;
        role: string;
        isActive: boolean;
        createdAt: string;
        depositCreditUsd: number;
        claimedPoolCreditUsd: number;
        swapHoldingsUsd: number;
      }>;
      total: number;
    }>(`/api/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),
  getAdminUser: (id: string) =>
    request<{
      success: boolean;
      user: Record<string, unknown> & {
        id: string;
        walletAddress: string;
        username: string | null;
        email: string | null;
        role: string;
        isActive: boolean;
        createdAt: string;
        depositCreditUsd?: unknown;
        claimedPoolCreditUsd?: unknown;
        swapHoldingsUsd?: unknown;
        poolMemberships?: unknown[];
        transactions?: unknown[];
        deposits?: unknown[];
        loans?: unknown[];
        miningSubscription?: unknown;
        tokenBalances?: unknown[];
        creditDraws?: unknown[];
        referredBy?: unknown;
        referralCode?: string | null;
      };
    }>(`/api/admin/users/${id}`),
  updateAdminUser: (
    id: string,
    data: { username?: string; email?: string; role?: string; isActive?: boolean }
  ) =>
    request<{ success: boolean; user: Record<string, unknown> }>(`/api/admin/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  patchAdminUserCredits: (
    id: string,
    data: {
      depositCreditUsd?: number;
      claimedPoolCreditUsd?: number;
      swapHoldingsUsd?: number;
    }
  ) =>
    request<{
      success: boolean;
      balances: {
        depositCreditUsd: number;
        claimedPoolCreditUsd: number;
        swapHoldingsUsd: number;
      };
      user: { id: string; walletAddress: string; username: string | null; email: string | null };
    }>(`/api/admin/users/${id}/credit-balances`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteAdminUser: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/users/${id}`, {
      method: "DELETE",
    }),
  updateAdminUserLoan: (
    userId: string,
    loanId: string,
    data: {
      loanAmount?: number;
      drawnAmount?: number;
      availableCredit?: number;
      interestRate?: number;
      ltvPercent?: number;
      status?: string;
    }
  ) =>
    request<{
      success: boolean;
      loan: {
        id: string;
        loanType: string;
        status: string;
        collateralChain: string;
        loanAmount: number;
        drawnAmount: number;
        availableCredit: number;
        interestRate: number;
        ltvPercent: number;
      };
    }>(`/api/admin/users/${userId}/loans/${loanId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  upsertAdminUserMining: (
    userId: string,
    data: { packageId?: string; payoutAddress?: string }
  ) =>
    request<{ success: boolean; subscription: Record<string, unknown> | null }>(
      `/api/admin/users/${userId}/mining-subscription`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    ),
  getAdminInvestments: (page = 1, limit = 20) =>
    request<{ investments: Array<{ id: string; userId: string; poolId: string; joinedAt: string; share: number; user: { id: string; walletAddress: string; username: string | null }; pool: { id: string; name: string; tokenSymbol: string; apy: number; status: string } }>; total: number }>(`/api/admin/investments?page=${page}&limit=${limit}`),
  getAdminTransactions: (page = 1, limit = 20, type?: string, status?: string) => {
    let url = `/api/admin/transactions?page=${page}&limit=${limit}`;
    if (type) url += `&type=${type}`;
    if (status) url += `&status=${status}`;
    return request<{ transactions: Array<{ id: string; userId: string; type: string; amount: number; txHash: string | null; fromAddress: string | null; toAddress: string | null; status: string; metadata: Record<string, unknown> | null; createdAt: string; user: { id: string; walletAddress: string; username: string | null } }>; total: number }>(url);
  },
  getAdminStats: () =>
    request<{ success: boolean; stats: { totalUsers: number; activeUsers: number; totalPools: number; totalTransactions: number; totalDeposits: number } }>("/api/admin/stats"),
  getAdminSettings: () =>
    request<{
      success: boolean;
      settings: {
        freePoolsEnabled: boolean;
        depositTreasuryAddress: string | null;
        usdtBep20Address: string | null;
        depositMinUsd: number | null;
      };
    }>("/api/admin/settings"),
  updateAdminSettings: (data: {
    freePoolsEnabled?: boolean;
    depositTreasuryAddress?: string | null;
    usdtBep20Address?: string | null;
    depositMinUsd?: number | null;
  }) =>
    request<{
      success: boolean;
      settings: {
        freePoolsEnabled: boolean;
        depositTreasuryAddress: string | null;
        usdtBep20Address: string | null;
        depositMinUsd: number | null;
      };
    }>("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getAdminReceipts: (page = 1, limit = 20) =>
    request<{ receipts: Array<{ id: string; tokenId: string; holder: string; holderName: string | null; poolName: string; poolSymbol: string; amount: number; txHash: string | null; status: string; mintedAt: string }>; total: number }>(`/api/admin/receipts?page=${page}&limit=${limit}`),

  getAdminMiningPackages: () =>
    request<{ success: boolean; packages: AdminMiningPackage[] }>("/api/admin/mining-packages"),
  createAdminMiningPackage: (body: AdminMiningPackageInput) =>
    request<{ success: boolean; package: AdminMiningPackage }>("/api/admin/mining-packages", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAdminMiningPackage: (id: string, body: Partial<AdminMiningPackageInput>) =>
    request<{ success: boolean; package: AdminMiningPackage }>(`/api/admin/mining-packages/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteAdminMiningPackage: (id: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/mining-packages/${id}`, {
      method: "DELETE",
    }),

  // Admin — withdrawals
  getAdminWithdrawals: (page = 1, limit = 20, status?: string, token?: string) => {
    let url = `/api/admin/withdrawals?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    if (token) url += `&token=${token}`;
    return request<{
      success: boolean;
      withdrawals: Array<{
        id: string;
        token: string;
        amount: number;
        fee: number;
        toAddress: string;
        status: string;
        txHash: string | null;
        createdAt: string;
        processedAt: string | null;
        user: { id: string; walletAddress: string; username: string | null; email: string | null };
      }>;
      total: number;
    }>(url);
  },
  approveWithdrawal: (id: string, txHash?: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/withdrawals/${id}/approve`, {
      method: "PUT",
      body: JSON.stringify({ txHash }),
    }),
  rejectWithdrawal: (id: string, reason?: string) =>
    request<{ success: boolean; message: string }>(`/api/admin/withdrawals/${id}/reject`, {
      method: "PUT",
      body: JSON.stringify({ reason }),
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
