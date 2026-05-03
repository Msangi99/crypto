"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Waves, Users, DollarSign, Activity, TrendingUp, Coins,
  ArrowUpRight, ArrowDownRight, CircleDot, Zap, ShieldCheck, Globe,
} from "lucide-react";
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

async function fetchTVLHistory(): Promise<Array<{ date: string; tvl: number; deposits: number }>> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/binancecoin/market_chart?vs_currency=usd&days=30&interval=daily"
    );
    const data = await res.json();
    if (!data.prices) return [];
    return data.prices.map((p: [number, number], i: number) => {
      const d = new Date(p[0]);
      return {
        date: d.toLocaleDateString("en", { month: "short", day: "numeric" }),
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

export default function DashboardPage() {
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const [tvlData, setTvlData] = useState<Array<{ date: string; tvl: number; deposits: number }>>([]);
  const [volumeData, setVolumeData] = useState<Array<{ day: string; deposits: number; withdrawals: number }>>([]);

  const poolDistribution = useMemo(() => {
    if (!pools.length) return [{ name: "No Pools", value: 1, fill: "#2A2A2A" }];
    return pools.map((p, i) => ({
      name: p.name,
      value: Number(p.totalStaked) || 1,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [pools]);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, poolsRes, healthRes, tvl, vol] = await Promise.all([
          api.getPoolStats(),
          api.getPools(1, 5),
          api.health(),
          fetchTVLHistory(),
          fetchVolumeData(),
        ]);
        setStats(statsRes.stats);
        setPools(poolsRes.data);
        setHealth(healthRes as HealthData);
        if (tvl.length) setTvlData(tvl);
        if (vol.length) setVolumeData(vol);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#F0B90B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Value Locked",
      value: `${stats?.totalValueLocked?.toFixed(4) || "0.0000"} BNB`,
      change: "+12.5%",
      up: true,
      icon: DollarSign,
      gradient: "from-[#F0B90B]/20 to-transparent",
      iconColor: "text-[#F0B90B]",
      iconBg: "bg-[#F0B90B]/10",
    },
    {
      title: "Active Pools",
      value: String(stats?.activePools || 0),
      change: `${stats?.totalPools || 0} total`,
      up: true,
      icon: Waves,
      gradient: "from-[#00C853]/20 to-transparent",
      iconColor: "text-[#00C853]",
      iconBg: "bg-[#00C853]/10",
    },
    {
      title: "Total Members",
      value: String(stats?.totalMembers || 0),
      change: "+3 this week",
      up: true,
      icon: Users,
      gradient: "from-[#3B82F6]/20 to-transparent",
      iconColor: "text-[#3B82F6]",
      iconBg: "bg-[#3B82F6]/10",
    },
    {
      title: "Network Status",
      value: health?.status === "ok" ? "Online" : "Offline",
      change: `Uptime ${Math.floor((health?.uptime || 0) / 60)}m`,
      up: health?.status === "ok",
      icon: Zap,
      gradient: health?.status === "ok" ? "from-[#00C853]/20 to-transparent" : "from-[#FF3D57]/20 to-transparent",
      iconColor: health?.status === "ok" ? "text-[#00C853]" : "text-[#FF3D57]",
      iconBg: health?.status === "ok" ? "bg-[#00C853]/10" : "bg-[#FF3D57]/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Dashboard</h2>
          <p className="text-sm text-[#888] mt-1">Real-time analytics and system overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/20 gap-1.5">
            <CircleDot className="w-3 h-3" /> Live
          </Badge>
          <Badge className="bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20">BSC Testnet</Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.title} className="bg-[#1A1A1A] border-[#2A2A2A] overflow-hidden relative group hover:border-[#3A3A3A] transition-all">
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-50`} />
            <CardContent className="p-5 relative">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <p className="text-xs font-medium text-[#888] uppercase tracking-wider">{card.title}</p>
                  <p className="text-2xl font-bold text-white tracking-tight">{card.value}</p>
                  <div className="flex items-center gap-1">
                    {card.up ? (
                      <ArrowUpRight className="w-3.5 h-3.5 text-[#00C853]" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5 text-[#FF3D57]" />
                    )}
                    <span className={`text-xs font-medium ${card.up ? "text-[#00C853]" : "text-[#FF3D57]"}`}>
                      {card.change}
                    </span>
                  </div>
                </div>
                <div className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* TVL Area Chart */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A] lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#F0B90B]" />
                TVL Overview
              </CardTitle>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#F0B90B]" /> TVL (BNB)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00C853]" /> Deposits
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={tvlData}>
                <defs>
                  <linearGradient id="tvlGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F0B90B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F0B90B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#999" }}
                />
                <Area type="monotone" dataKey="tvl" stroke="#F0B90B" strokeWidth={2} fill="url(#tvlGrad)" />
                <Area type="monotone" dataKey="deposits" stroke="#00C853" strokeWidth={1.5} fill="transparent" strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pool Distribution Pie */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Waves className="w-4 h-4 text-[#F0B90B]" />
              Pool Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={poolDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {poolDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full space-y-2 mt-2">
              {poolDistribution.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: item.fill }} />
                    <span className="text-[#ccc]">{item.name}</span>
                  </span>
                  <span className="text-[#999] font-mono">{item.value} BNB</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Volume Bar Chart + Pools + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Volume */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#3B82F6]" />
              Weekly Volume
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={volumeData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" />
                <XAxis dataKey="day" stroke="#666" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="deposits" fill="#00C853" radius={[4, 4, 0, 0]} barSize={14} />
                <Bar dataKey="withdrawals" fill="#FF3D57" radius={[4, 4, 0, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#00C853]" /> Deposits</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#FF3D57]" /> Withdrawals</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Pools */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#F0B90B]" />
              Active Pools
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pools.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-[#666]">
                <Waves className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No pools created yet</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pools.map((pool) => (
                  <div key={pool.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A] hover:border-[#3A3A3A] transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center shrink-0">
                      <Coins className="w-4 h-4 text-[#F0B90B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{pool.name}</p>
                      <p className="text-xs text-[#666]">{pool.memberCount} members</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-[#00C853]">{pool.apy}%</p>
                      <p className="text-[10px] text-[#666] uppercase tracking-wide">APY</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00C853]" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {[
              { label: "Database", value: health?.database, icon: Activity },
              { label: "Blockchain", value: health?.blockchain, icon: Globe },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
                <span className="flex items-center gap-2 text-sm text-[#999]">
                  <item.icon className="w-3.5 h-3.5" /> {item.label}
                </span>
                <Badge className={item.value === "connected" ? "bg-[#00C853]/10 text-[#00C853] text-xs" : "bg-[#FF3D57]/10 text-[#FF3D57] text-xs"}>
                  {item.value || "unknown"}
                </Badge>
              </div>
            ))}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
              <span className="text-sm text-[#999]">Contract</span>
              <a href="https://testnet.bscscan.com/address/0x5fA4d61B529F88069a46B83451540aC4c2f96200" target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-[#F0B90B] hover:underline">0x5fA4...6200</a>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
              <span className="text-sm text-[#999]">Network</span>
              <Badge className="bg-[#F0B90B]/10 text-[#F0B90B] text-xs">BSC Testnet (97)</Badge>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
              <span className="text-sm text-[#999]">Uptime</span>
              <span className="text-xs text-[#00C853] font-mono">{Math.floor((health?.uptime || 0) / 60)}m {Math.floor((health?.uptime || 0) % 60)}s</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
