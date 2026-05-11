import {
  type LandingPoolRow,
  type ApiPublicPool,
  mapApiPoolsToLandingRows,
} from "./publicPools";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export type CoinGeckoPriceEntry = { usd: number; usd_24h_change?: number | null };

export type LandingPublicBundle = {
  pools: LandingPoolRow[];
  poolStats: {
    totalPools: number;
    activePools: number;
    totalValueLocked: number;
    totalMembers: number;
  } | null;
  geoPrices: Record<string, CoinGeckoPriceEntry> | null;
  tokenPrices: Array<{ token: string; priceUsd: number; change24h?: number }> | null;
  referralStats: {
    totalReferrals: number;
    totalRewardsDistributed: number;
  } | null;
  miningPackagesCount: number | null;
  health: {
    database: string;
    blockchain: string;
    status?: string;
  } | null;
};

async function readJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const emptyBundle = (): LandingPublicBundle => ({
  pools: [],
  poolStats: null,
  geoPrices: null,
  tokenPrices: null,
  referralStats: null,
  miningPackagesCount: null,
  health: null,
});

/**
 * One parallel fetch of all unauthenticated landing data from the CLB API.
 * Never throws — returns partial data when individual calls fail.
 */
export async function fetchLandingPublicBundle(): Promise<LandingPublicBundle> {
  const base = API_BASE;
  try {
    const [
      poolsRes,
      statsRes,
      pricesRes,
      tokenPricesRes,
      refRes,
      miningRes,
      healthRes,
    ] = await Promise.all([
      fetch(`${base}/api/pools?status=ACTIVE&limit=50&page=1`, { cache: "no-store" }),
      fetch(`${base}/api/pools/stats`, { cache: "no-store" }),
      fetch(`${base}/api/prices`, { cache: "no-store" }),
      fetch(`${base}/api/tokens/prices`, { cache: "no-store" }),
      fetch(`${base}/api/referrals/stats`, { cache: "no-store" }),
      fetch(`${base}/api/mining-packages`, { cache: "no-store" }),
      fetch(`${base}/health`, { cache: "no-store" }),
    ]);

    const poolsBody = await readJson<{ success?: boolean; data?: ApiPublicPool[] }>(poolsRes);
    const rawPools = Array.isArray(poolsBody?.data) ? poolsBody.data : [];
    const pools = mapApiPoolsToLandingRows(rawPools);

    const statsBody = await readJson<{ success?: boolean; stats?: LandingPublicBundle["poolStats"] }>(statsRes);
    const poolStats = statsBody?.stats ?? null;

    const pricesBody = await readJson<{ success?: boolean; prices?: Record<string, CoinGeckoPriceEntry> }>(pricesRes);
    const geoPrices = pricesBody?.prices ?? null;

    const tokenBody = await readJson<{
      success?: boolean;
      prices?: Array<{ token: string; priceUsd: number; change24h?: number }>;
    }>(tokenPricesRes);
    const tokenPrices = tokenBody?.prices ?? null;

    const refBody = await readJson<{
      success?: boolean;
      stats?: { totalReferrals: number; totalRewardsDistributed: number };
    }>(refRes);
    const referralStats = refBody?.stats
      ? {
          totalReferrals: Number(refBody.stats.totalReferrals) || 0,
          totalRewardsDistributed: Number(refBody.stats.totalRewardsDistributed) || 0,
        }
      : null;

    const miningBody = await readJson<{ success?: boolean; packages?: unknown[] }>(miningRes);
    const miningPackagesCount = Array.isArray(miningBody?.packages) ? miningBody.packages.length : null;

    const healthBody = await readJson<{
      status?: string;
      database?: string;
      blockchain?: string;
    }>(healthRes);
    const health =
      healthBody &&
      typeof healthBody.database === "string" &&
      typeof healthBody.blockchain === "string"
        ? {
            status: healthBody.status,
            database: healthBody.database,
            blockchain: healthBody.blockchain,
          }
        : null;

    return {
      pools,
      poolStats,
      geoPrices,
      tokenPrices,
      referralStats,
      miningPackagesCount,
      health,
    };
  } catch {
    return emptyBundle();
  }
}

export function formatUsdPrice(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 100 ? 0 : 2,
  }).format(n);
}

export function formatPctChange(ch: number | null | undefined): { text: string; up: boolean } | null {
  if (ch == null || !Number.isFinite(ch)) return null;
  const text = `${ch >= 0 ? "+" : ""}${ch.toFixed(2)}%`;
  return { text, up: ch >= 0 };
}

/** TVL number shown in hero (unit matches pool `totalStaked` aggregate — labeled BNB on the page). */
export function formatTvlBnb(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (value < 0) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `${(value / 1000).toFixed(1)}K`;
  if (value >= 1) return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return value.toFixed(4);
}

export type TickerSegment = {
  key: string;
  title: string;
  mid: string;
  tail?: string | null;
  /** When tail is a % move, false paints red; otherwise tail uses green "up" style. */
  tailUp?: boolean | null;
};

/** Marquee segments built from live API fields (same order/style as the original ticker). */
export function buildTickerSegments(b: LandingPublicBundle | null): TickerSegment[] {
  const g = b?.geoPrices;
  const seg: TickerSegment[] = [];

  const pushUsdPair = (key: string, title: string, row: CoinGeckoPriceEntry | undefined) => {
    if (row && row.usd > 0) {
      const ch = formatPctChange(row.usd_24h_change ?? null);
      seg.push({
        key,
        title,
        mid: formatUsdPrice(row.usd),
        tail: ch?.text ?? null,
        tailUp: ch ? ch.up : true,
      });
    } else {
      seg.push({ key, title, mid: "—", tail: null, tailUp: null });
    }
  };

  pushUsdPair("btc", "BTC/USDT", g?.BTC);
  pushUsdPair("eth", "ETH/USDT", g?.ETH);
  pushUsdPair("bnb", "BNB/USDT", g?.BNB);

  const clb = b?.tokenPrices?.find((t) => t.token === "CLB");
  const bnbUsd = g?.BNB?.usd;
  if (clb && bnbUsd && bnbUsd > 0) {
    const ratio = clb.priceUsd / bnbUsd;
    const ch = formatPctChange(clb.change24h ?? null);
    seg.push({
      key: "clbnb",
      title: "CLB/BNB",
      mid: ratio.toFixed(6),
      tail: ch?.text ?? null,
      tailUp: ch ? ch.up : true,
    });
  } else {
    seg.push({ key: "clbnb", title: "CLB/BNB", mid: "—", tail: null, tailUp: null });
  }

  const ps = b?.poolStats;
  if (ps) {
    seg.push({
      key: "pools",
      title: "Pools",
      mid: `${ps.activePools}/${ps.totalPools} active`,
      tail: ps.totalMembers > 0 ? `${ps.totalMembers} members` : null,
      tailUp: true,
    });
  } else {
    seg.push({ key: "pools", title: "Pools", mid: "—", tail: null, tailUp: null });
  }

  const rs = b?.referralStats;
  if (rs) {
    seg.push({
      key: "ref",
      title: "Referrals",
      mid: String(rs.totalReferrals),
      tail: `Rewards ${formatCompactNumber(rs.totalRewardsDistributed)}`,
      tailUp: true,
    });
  } else {
    seg.push({ key: "ref", title: "Referrals", mid: "—", tail: null, tailUp: null });
  }

  const mc = b?.miningPackagesCount;
  seg.push({
    key: "mining",
    title: "Mining packages",
    mid: mc != null ? String(mc) : "—",
    tail: "live catalog",
    tailUp: true,
  });

  return seg;
}

/** Extra trust-row labels from `/health` (prepended before static marketing pills). */
export function trustPillsFromHealth(b: LandingPublicBundle | null): [string, string][] {
  const out: [string, string][] = [];
  const h = b?.health;
  if (!h) return out;
  const dbOk = h.database === "connected";
  out.push([dbOk ? "#00C896" : "#FF4F8B", `Database: ${h.database}`]);
  const chainOk = h.blockchain === "connected";
  out.push([chainOk ? "#F3BA2F" : "#FF4F8B", `RPC: ${h.blockchain}`]);
  return out;
}

export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
