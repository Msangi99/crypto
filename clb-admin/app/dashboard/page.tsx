"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Waves, Users, DollarSign, Activity, TrendingUp, Coins,
  ArrowUpRight, ArrowDownRight, CircleDot, Zap, ShieldCheck, Globe,
  ExternalLink, RefreshCw, Package, CreditCard, ArrowLeftRight,
  ChevronRight, Server, Database, Wifi,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { api } from "@/lib/api";

interface PoolStats {
  totalPools: number;
  activePools: number;
  totalValueLocked: number;
  totalMembers: number;
}

interface Pool {
  id: string;
  name: string;
  tokenSymbol: string;
  apy: number;
  totalStaked: number;
  status: string;
  memberCount: number;
}

interface HealthData {
  status: string;
  database: string;
  blockchain: string;
  uptime: number;
}

const CHART_COLORS = ["#F0B90B", "#00C853", "#3B82F6", "#FF3D57", "#A855F7"];

type Range = "7D" | "30D" | "90D";

async function fetchTVLHistory(days: number): Promise<Array<{ date: string; tvl: number; deposits: number }>> {
  try {
    const interval = days <= 7 ? "hourly" : "daily";
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/binancecoin/market_chart?vs_currency=usd&days=${days}&interval=${interval}`
    );
    const data = await res.json();
    if (!data.prices) return [];
    const step = days <= 7 ? Math.floor(data.prices.length / 7) || 1 : 1;
    return data.prices
      .filter((_: unknown, i: number) => i % step === 0)
      .slice(-days <= 7 ? 7 : days)
      .map((p: [number, number], i: number) => {
        const d = new Date(p[0]);
        return {
          date: days <= 7
            ? d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })
            : d.toLocaleDateString("en", { month: "short", day: "numeric" }),
          tvl: +(p[1] / 100).toFixed(2),
          deposits: Math.max(1, Math.round((data.total_volumes?.[i]?.[1] || 0) / 1e9)),
        };
      });
  } catch {
    return [];
  }
}

async function fetchVolumeData(): Promise<Array<{ day: string; deposits: number; withdrawals: number }>> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/binancecoin/market_chart?vs_currency=usd&days=7&interval=daily"
    );
    const data = await res.json();
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    if (!data.total_volumes) return days.map((d) => ({ day: d, deposits: 0, withdrawals: 0 }));
    return data.total_volumes.slice(0, 7).map((v: [number, number], i: number) => ({
      day: days[new Date(v[0]).getDay() === 0 ? 6 : new Date(v[0]).getDay() - 1] || days[i],
      deposits: +(v[1] / 1e9).toFixed(2),
      withdrawals: +(v[1] / 2.5e9).toFixed(2),
    }));
  } catch {
    return [];
  }
}

function SkeletonCard() {
  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-5 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="space-y-3 flex-1">
          <div className="h-3 w-24 bg-[#2A2A2A] rounded" />
          <div className="h-7 w-32 bg-[#2A2A2A] rounded" />
          <div className="h-3 w-16 bg-[#2A2A2A] rounded" />
        </div>
        <div className="w-11 h-11 rounded-xl bg-[#2A2A2A]" />
      </div>
    </div>
  );
}

const quickActions = [
  { label: "Manage Pools", href: "/dashboard/pools", icon: Waves, color: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10 hover:bg-[#F0B90B]/20" },
  { label: "View Users", href: "/dashboard/users", icon: Users, color: "text-[#3B82F6]", bg: "bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20" },
  { label: "Packages", href: "/dashboard/packages", icon: Package, color: "text-[#A855F7]", bg: "bg-[#A855F7]/10 hover:bg-[#A855F7]/20" },
  { label: "Payments", href: "/dashboard/payments", icon: CreditCard, color: "text-[#00C853]", bg: "bg-[#00C853]/10 hover:bg-[#00C853]/20" },
  { label: "Transactions", href: "/dashboard/transactions", icon: ArrowLeftRight, color: "text-[#FF3D57]", bg: "bg-[#FF3D57]/10 hover:bg-[#FF3D57]/20" },
  { label: "Security", href: "/dashboard/security", icon: ShieldCheck, color: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10 hover:bg-[#F0B90B]/20" },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-[#333] rounded-lg p-3 shadow-xl text-xs space-y-1.5">
      <p className="text-[#888] font-medium mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#ccc] capitalize">{p.name}:</span>
          <span className="text-white font-mono font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tvlRange, setTvlRange] = useState<Range>("30D");
  const [tvlData, setTvlData] = useState<Array<{ date: string; tvl: number; deposits: number }>>([]);
  const [volumeData, setVolumeData] = useState<Array<{ day: string; deposits: number; withdrawals: number }>>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const poolDistribution = useMemo(() => {
    if (!pools.length) return [{ name: "No Pools", value: 1, fill: "#2A2A2A" }];
    return pools.map((p, i) => ({
      name: p.name,
      value: Number(p.totalStaked) || 1,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [pools]);

  const totalDistribution = useMemo(
    () => poolDistribution.reduce((s, p) => s + p.value, 0),
    [poolDistribution]
  );

  const loadData = useCallback(async (days: number) => {
    try {
      const [statsRes, poolsRes, healthRes, tvl, vol] = await Promise.all([
        api.getPoolStats(),
        api.getPools(1, 5),
        api.health(),
        fetchTVLHistory(days),
        fetchVolumeData(),
      ]);
      setStats(statsRes.stats);
      setPools(poolsRes.data);
      setHealth(healthRes as HealthData);
      if (tvl.length) setTvlData(tvl);
      if (vol.length) setVolumeData(vol);
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    }
  }, []);

  useEffect(() => {
    loadData(30).finally(() => setLoading(false));
  }, [loadData]);

  useEffect(() => {
    const days = tvlRange === "7D" ? 7 : tvlRange === "30D" ? 30 : 90;
    fetchTVLHistory(days).then((d) => { if (d.length) setTvlData(d); });
  }, [tvlRange]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const days = tvlRange === "7D" ? 7 : tvlRange === "30D" ? 30 : 90;
    await loadData(days);
    setRefreshing(false);
  };

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const statCards = [
    {
      title: "Total Value Locked",
      value: `${stats?.totalValueLocked?.toFixed(4) || "0.0000"}`,
      unit: "BNB",
      change: "+12.5%",
      up: true,
      icon: DollarSign,
      accentColor: "#F0B90B",
      gradient: "from-[#F0B90B]/15 via-transparent to-transparent",
    },
    {
      title: "Active Pools",
      value: String(stats?.activePools || 0),
      unit: `/ ${stats?.totalPools || 0} total`,
      change: "All operational",
      up: true,
      icon: Waves,
      accentColor: "#00C853",
      gradient: "from-[#00C853]/15 via-transparent to-transparent",
    },
    {
      title: "Total Members",
      value: String(stats?.totalMembers || 0),
      unit: "users",
      change: "+3 this week",
      up: true,
      icon: Users,
      accentColor: "#3B82F6",
      gradient: "from-[#3B82F6]/15 via-transparent to-transparent",
    },
    {
      title: "Network Status",
      value: health?.status === "ok" ? "Online" : "Offline",
      unit: `${Math.floor((health?.uptime || 0) / 60)}m uptime`,
      change: health?.status === "ok" ? "All systems normal" : "Issues detected",
      up: health?.status === "ok",
      icon: Zap,
      accentColor: health?.status === "ok" ? "#00C853" : "#FF3D57",
      gradient: health?.status === "ok" ? "from-[#00C853]/15 via-transparent to-transparent" : "from-[#FF3D57]/15 via-transparent to-transparent",
    },
  ];

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#666] uppercase tracking-widest mb-1">
            {now.toLocaleDateString("en", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
          <h1 className="text-2xl font-bold text-white tracking-tight">{greeting()}, Admin 👋</h1>
          <p className="text-sm text-[#666] mt-0.5">Here's what's happening with CLB today.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] text-sm text-[#999] hover:text-white hover:border-[#3A3A3A] transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Badge className="bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/20 gap-1.5 px-3 py-1.5 text-xs">
            <CircleDot className="w-3 h-3" /> Live
          </Badge>
          <Badge className="bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 px-3 py-1.5 text-xs">BSC Testnet</Badge>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card) => (
            <div
              key={card.title}
              className="relative bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl overflow-hidden group hover:border-[#3A3A3A] transition-all duration-300 cursor-default"
              style={{ boxShadow: `0 0 0 0 ${card.accentColor}` }}
            >
              {/* Gradient bg */}
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} pointer-events-none`} />
              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${card.accentColor}55, transparent)` }} />
              <div className="relative p-5">
                <div className="flex items-start justify-between mb-4">
                  <p className="text-xs font-semibold text-[#666] uppercase tracking-wider">{card.title}</p>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${card.accentColor}15` }}
                  >
                    <card.icon className="w-4.5 h-4.5" style={{ color: card.accentColor }} />
                  </div>
                </div>
                <div className="flex items-end gap-2 mb-1">
                  <p className="text-3xl font-bold text-white tracking-tight leading-none">{card.value}</p>
                  <p className="text-sm text-[#666] mb-0.5">{card.unit}</p>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {card.up
                    ? <ArrowUpRight className="w-3.5 h-3.5 text-[#00C853]" />
                    : <ArrowDownRight className="w-3.5 h-3.5 text-[#FF3D57]" />
                  }
                  <span className={`text-xs font-medium ${card.up ? "text-[#00C853]" : "text-[#FF3D57]"}`}>
                    {card.change}
                  </span>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <p className="text-xs font-semibold text-[#555] uppercase tracking-widest mb-3">Quick Actions</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-[#2A2A2A] ${action.bg} transition-all duration-200 group hover:border-[#3A3A3A] hover:scale-[1.03]`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${action.bg}`}>
                <action.icon className={`w-4.5 h-4.5 ${action.color}`} />
              </div>
              <span className="text-[11px] font-medium text-[#888] group-hover:text-white transition-colors text-center leading-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* TVL Area Chart */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A] lg:col-span-2 shadow-none">
          <CardHeader className="pb-3 border-b border-[#1F1F1F]">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-[#F0B90B]" />
                </div>
                TVL Overview
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-3 text-[11px] text-[#666] mr-2">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F0B90B]" /> TVL</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#00C853]" /> Deposits</span>
                </div>
                {(["7D", "30D", "90D"] as Range[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTvlRange(r)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                      tvlRange === r
                        ? "bg-[#F0B90B] text-black"
                        : "text-[#666] hover:text-white hover:bg-[#2A2A2A]"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-[240px] bg-[#151515] rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={tvlData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F0B90B" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#F0B90B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="depGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C853" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#00C853" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" vertical={false} />
                  <XAxis dataKey="date" stroke="#333" tick={{ fontSize: 10, fill: "#555" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="#333" tick={{ fontSize: 10, fill: "#555" }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="tvl" stroke="#F0B90B" strokeWidth={2} fill="url(#tvlGrad)" dot={false} />
                  <Area type="monotone" dataKey="deposits" stroke="#00C853" strokeWidth={1.5} fill="url(#depGrad)" dot={false} strokeDasharray="5 3" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pool Distribution */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A] shadow-none">
          <CardHeader className="pb-3 border-b border-[#1F1F1F]">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center">
                <Waves className="w-3.5 h-3.5 text-[#F0B90B]" />
              </div>
              Pool Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-4">
            {loading ? (
              <div className="w-36 h-36 rounded-full bg-[#2A2A2A] animate-pulse mx-auto mb-4" />
            ) : (
              <div className="relative">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={poolDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {poolDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#111", border: "1px solid #2A2A2A", borderRadius: 8, fontSize: 11 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[10px] text-[#666] uppercase tracking-wide">Total</p>
                  <p className="text-base font-bold text-white">{totalDistribution.toFixed(1)}</p>
                  <p className="text-[10px] text-[#666]">BNB</p>
                </div>
              </div>
            )}
            <div className="w-full space-y-2 mt-3">
              {poolDistribution.map((item, i) => {
                const pct = totalDistribution > 0 ? ((item.value / totalDistribution) * 100).toFixed(1) : "0";
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.fill }} />
                        <span className="text-[#aaa] truncate max-w-[100px]">{item.name}</span>
                      </span>
                      <span className="text-[#666] font-mono">{pct}%</span>
                    </div>
                    <div className="h-1 w-full bg-[#222] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: item.fill }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly Volume */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A] shadow-none">
          <CardHeader className="pb-3 border-b border-[#1F1F1F]">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#3B82F6]/10 flex items-center justify-center">
                <Activity className="w-3.5 h-3.5 text-[#3B82F6]" />
              </div>
              Weekly Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="h-[180px] bg-[#151515] rounded-lg animate-pulse" />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={volumeData} barGap={3} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E1E1E" vertical={false} />
                    <XAxis dataKey="day" stroke="#333" tick={{ fontSize: 10, fill: "#555" }} tickLine={false} axisLine={false} />
                    <YAxis stroke="#333" tick={{ fontSize: 10, fill: "#555" }} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="deposits" fill="#00C853" radius={[3, 3, 0, 0]} barSize={12} />
                    <Bar dataKey="withdrawals" fill="#FF3D57" radius={[3, 3, 0, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-5 mt-3 text-[11px] text-[#666]">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#00C853]" /> Deposits</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#FF3D57]" /> Withdrawals</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Pools */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A] shadow-none">
          <CardHeader className="pb-3 border-b border-[#1F1F1F]">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center">
                  <Coins className="w-3.5 h-3.5 text-[#F0B90B]" />
                </div>
                Active Pools
              </CardTitle>
              <Link href="/dashboard/pools" className="text-[11px] text-[#555] hover:text-[#F0B90B] flex items-center gap-1 transition-colors">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            {loading ? (
              <div className="space-y-2.5">
                {Array(4).fill(0).map((_, i) => (
                  <div key={i} className="h-12 bg-[#151515] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : pools.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-[#555]">
                <Waves className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">No pools created yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pools.map((pool) => (
                  <div
                    key={pool.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#111] border border-[#222] hover:border-[#2A2A2A] transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center shrink-0">
                      <Coins className="w-3.5 h-3.5 text-[#F0B90B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{pool.name}</p>
                      <p className="text-[10px] text-[#555]">{pool.memberCount} members · {pool.tokenSymbol}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#00C853]">{pool.apy}%</p>
                      <p className="text-[10px] text-[#555] uppercase tracking-wide">APY</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A] shadow-none">
          <CardHeader className="pb-3 border-b border-[#1F1F1F]">
            <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#00C853]/10 flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00C853]" />
              </div>
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2">
            {[
              {
                label: "API Server",
                value: health?.status === "ok" ? "Operational" : "Degraded",
                ok: health?.status === "ok",
                icon: Server,
                detail: `${Math.floor((health?.uptime || 0) / 60)}m uptime`,
              },
              {
                label: "Database",
                value: health?.database === "connected" ? "Connected" : "Disconnected",
                ok: health?.database === "connected",
                icon: Database,
                detail: "PostgreSQL",
              },
              {
                label: "Blockchain",
                value: health?.blockchain === "connected" ? "Connected" : "Disconnected",
                ok: health?.blockchain === "connected",
                icon: Wifi,
                detail: "BSC Testnet",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-[#111] border border-[#222]">
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${item.ok ? "bg-[#00C853]/10" : "bg-[#FF3D57]/10"}`}>
                    <item.icon className={`w-3.5 h-3.5 ${item.ok ? "text-[#00C853]" : "text-[#FF3D57]"}`} />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{item.label}</p>
                    <p className="text-[10px] text-[#555]">{item.detail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${item.ok ? "bg-[#00C853] shadow-[0_0_6px_#00C853]" : "bg-[#FF3D57] shadow-[0_0_6px_#FF3D57]"}`} />
                  <span className={`text-[11px] font-medium ${item.ok ? "text-[#00C853]" : "text-[#FF3D57]"}`}>{item.value}</span>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between p-3 rounded-lg bg-[#111] border border-[#222]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 text-[#F0B90B]" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white">Contract</p>
                  <p className="text-[10px] text-[#555]">BSC Testnet (97)</p>
                </div>
              </div>
              <a
                href="https://testnet.bscscan.com/address/0x5fA4d61B529F88069a46B83451540aC4c2f96200"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-mono text-[#F0B90B] hover:text-[#F0B90B]/80 transition-colors"
              >
                0x5fA4…6200 <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="mt-3 p-3 rounded-lg bg-gradient-to-r from-[#00C853]/5 to-transparent border border-[#00C853]/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-[#666]">Overall Health Score</span>
                <span className="text-[11px] font-bold text-[#00C853]">98%</span>
              </div>
              <div className="h-1.5 w-full bg-[#222] rounded-full overflow-hidden">
                <div className="h-full w-[98%] rounded-full bg-gradient-to-r from-[#00C853] to-[#00C853]/70" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
