const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

/** Public pool row from GET /api/pools (serialized pool + memberCount). */
export type ApiPublicPool = {
  id: string;
  name: string;
  minDeposit: number;
  tokenSymbol: string;
  apy: number;
  status: string;
  leverageRatio?: number | null;
  heldAsset?: string | null;
  phase1Target?: number | null;
  phase2Target?: number | null;
};

export type LandingPoolRow = {
  id: string;
  name: string;
  minDeposit: number;
  tokenSymbol: string;
  multLabel: string;
  progressPercent: number;
  indicatorColor: string;
  leverageRatio: number | null;
  apy: number;
  heldAsset: string | null;
  phase1Target: number | null;
  phase2Target: number | null;
};

const TIER_COLORS = ["#F0A500", "#1A6BFF", "#00C896", "#6270CE", "#FF4F8B"];

export function formatMinStakeAmount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1e8) / 1e8;
  if (Number.isInteger(rounded)) return String(rounded);
  return String(rounded).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function poolMultLabel(pool: Pick<ApiPublicPool, "leverageRatio" | "apy">): string {
  const lev = pool.leverageRatio;
  if (lev != null && lev > 0) return `${lev}x`;
  const apy = pool.apy;
  if (apy > 0) return `${apy % 1 === 0 ? String(apy) : apy.toFixed(2)}%`;
  return "—";
}

export function poolProgressPercent(pool: Pick<ApiPublicPool, "leverageRatio" | "apy">): number {
  const lev = pool.leverageRatio;
  if (lev != null && lev > 0) {
    return Math.min(100, Math.max(18, Math.round((lev / 60) * 100)));
  }
  const apy = pool.apy;
  if (apy > 0) return Math.min(100, Math.max(15, Math.round(Math.min(apy, 100))));
  return 12;
}

function mapApiPoolToLandingRow(p: ApiPublicPool, index: number): LandingPoolRow {
  return {
    id: p.id,
    name: p.name,
    minDeposit: Number(p.minDeposit),
    tokenSymbol: p.tokenSymbol || "BNB",
    multLabel: poolMultLabel(p),
    progressPercent: poolProgressPercent(p),
    indicatorColor: TIER_COLORS[index % TIER_COLORS.length],
    leverageRatio: p.leverageRatio != null && p.leverageRatio > 0 ? Number(p.leverageRatio) : null,
    apy: Number(p.apy) || 0,
    heldAsset: p.heldAsset ?? null,
    phase1Target: p.phase1Target != null && Number.isFinite(Number(p.phase1Target)) ? Number(p.phase1Target) : null,
    phase2Target: p.phase2Target != null && Number.isFinite(Number(p.phase2Target)) ? Number(p.phase2Target) : null,
  };
}

/** Sort by min stake ascending and map to landing rows (shared with bundle fetch). */
export function mapApiPoolsToLandingRows(raw: ApiPublicPool[]): LandingPoolRow[] {
  const sorted = [...raw].sort((a, b) => (a.minDeposit ?? 0) - (b.minDeposit ?? 0));
  return sorted.map((p, i) => mapApiPoolToLandingRow(p, i));
}

/**
 * Active pools for the marketing landing (no auth). Sorted by min stake ascending.
 */
export async function fetchActiveLandingPools(): Promise<LandingPoolRow[]> {
  const url = `${API_BASE}/api/pools?status=ACTIVE&limit=50&page=1`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Pools request failed: ${res.status}`);
  }
  const body = (await res.json()) as {
    success?: boolean;
    data?: ApiPublicPool[];
  };
  const raw = Array.isArray(body.data) ? body.data : [];
  return mapApiPoolsToLandingRows(raw);
}
