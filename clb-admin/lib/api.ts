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

export type AdminMobileReleaseUploadResult = {
  success: boolean;
  release: {
    id: string;
    version: string;
    originalFileName: string;
    fileSizeBytes: number;
    releaseNotes: string | null;
    isPublished: boolean;
    createdAt: string;
  };
};

/** Multipart APK upload with XMLHttpRequest so upload progress is observable (fetch has no upload progress). */
function uploadAdminMobileApkWithXhr(
  data: { version: string; releaseNotes?: string; file: Blob | File },
  onProgress?: (pct: number, phase: "upload" | "processing") => void
): Promise<AdminMobileReleaseUploadResult> {
  const token = typeof window !== "undefined" ? localStorage.getItem("clb_token") : null;
  const url = `${API_BASE}/api/admin/mobile-app/releases`;
  onProgress?.(0, "upload");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("version", data.version);
    if (data.releaseNotes) form.append("releaseNotes", data.releaseNotes);
    form.append("file", data.file);

    xhr.open("POST", url);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && e.total > 0) {
        const pct = Math.min(99, Math.round((100 * e.loaded) / e.total));
        onProgress?.(pct, "upload");
      }
    });

    xhr.onload = () => {
      onProgress?.(100, "processing");
      const ok = xhr.status >= 200 && xhr.status < 300;
      let body: Record<string, unknown> = {};
      try {
        body = xhr.responseText ? (JSON.parse(xhr.responseText) as Record<string, unknown>) : {};
      } catch {
        if (!ok) {
          reject(new Error(xhr.statusText || `HTTP ${xhr.status}`));
          return;
        }
        reject(new Error("Invalid JSON from server"));
        return;
      }
      if (!ok) {
        const msg =
          (typeof body.error === "string" && body.error) ||
          (typeof body.message === "string" && body.message) ||
          xhr.statusText ||
          `API Error: ${xhr.status}`;
        reject(new Error(msg));
        return;
      }
      resolve(body as AdminMobileReleaseUploadResult);
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "Could not reach API (network or CORS). After deploying API changes, confirm nginx allows large bodies (client_max_body_size 200m or higher) and long proxy timeouts for this route."
        )
      );
    xhr.onabort = () => reject(new Error("Upload cancelled"));

    xhr.send(form);
  });
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

  // Admin — deposits
  getAdminDeposits: (page = 1, limit = 20, status?: string, search?: string) => {
    let url = `/api/admin/deposits?page=${page}&limit=${limit}`;
    if (status) url += `&status=${status}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return request<{
      deposits: Array<{
        id: string;
        amount: number;
        amountUsd: number;
        chain: string;
        fromAddress: string | null;
        toAddress: string | null;
        txHash: string | null;
        status: string;
        confirmations: number;
        confirmedAt: string | null;
        createdAt: string;
        user: { id: string; walletAddress: string; username: string | null; email: string | null };
        pool: { id: string; name: string; tokenSymbol: string } | null;
      }>;
      total: number;
      page: number;
      limit: number;
    }>(url);
  },
  updateDepositStatus: (id: string, data: { status?: string; txHash?: string | null }) =>
    request<{
      success: boolean;
      deposit: Record<string, unknown>;
    }>(`/api/admin/deposits/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(data),
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

  // Admin — mobile app (Android APK)
  getAdminMobileReleases: () =>
    request<{
      success: boolean;
      releases: Array<{
        id: string;
        version: string;
        originalFileName: string;
        fileSizeBytes: number;
        releaseNotes: string | null;
        isPublished: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
    }>("/api/admin/mobile-app/releases"),

  uploadAdminMobileRelease: async (
    data: { version: string; releaseNotes?: string; file: Blob | File },
    onProgress?: (pct: number, phase: "upload" | "processing") => void
  ) => uploadAdminMobileApkWithXhr(data, onProgress),

  publishAdminMobileRelease: (id: string) =>
    request<{ success: boolean; release: unknown }>(`/api/admin/mobile-app/releases/${id}/publish`, {
      method: "POST",
    }),

  unpublishAdminMobileRelease: (id: string) =>
    request<{ success: boolean }>(`/api/admin/mobile-app/releases/${id}/unpublish`, {
      method: "POST",
    }),

  deleteAdminMobileRelease: (id: string) =>
    request<{ success: boolean }>(`/api/admin/mobile-app/releases/${id}`, {
      method: "DELETE",
    }),
};
