"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp, Loader2, Bitcoin, Clock, Target, CheckCircle2,
  AlertTriangle, DollarSign, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatsCard } from "@/components/stats-card";
import { api } from "@/lib/api";

interface Pool {
  id: string;
  name: string;
  tokenSymbol: string;
  apy: number;
  totalStaked: number;
  status: string;
  memberCount: number;
  startDate: string;
  description: string | null;
  minDeposit: number;
}

// Mock investment data — will be replaced with real API
const mockInvestments = [
  { id: "1", user: "0xfde8...aafb", pool: "Gold BTC Pool", asset: "BTC", amount: 500, leverage: "60x", entryPrice: "$76,130", phase1: "$150,000", phase2: "$200,000", status: "ACTIVE", purchasedAt: "2026-05-03", progress: 35 },
  { id: "2", user: "0xa1b2...c3d4", pool: "Silver ETH Pool", asset: "ETH", amount: 250, leverage: "60x", entryPrice: "$2,268", phase1: "$15,000", phase2: "$20,000", status: "ACTIVE", purchasedAt: "2026-05-02", progress: 12 },
  { id: "3", user: "0xe5f6...7890", pool: "Platinum BTC Pool", asset: "BTC", amount: 1000, leverage: "60x", entryPrice: "$76,130", phase1: "$150,000", phase2: "$200,000", status: "PHASE_1", purchasedAt: "2026-04-28", progress: 65 },
];

export default function InvestmentsPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalPools: 0, activePools: 0, totalValueLocked: 0, totalMembers: 0 });

  useEffect(() => {
    async function load() {
      try {
        const [poolsRes, statsRes] = await Promise.all([api.getPools(1, 50), api.getPoolStats()]);
        setPools(poolsRes.data);
        setStats(statsRes.stats);
      } catch (err) {
        console.error("Failed to load:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    ACTIVE: { color: "text-[#00C853]", bg: "bg-[#00C853]/10", label: "Active" },
    PHASE_1: { color: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10", label: "Phase 1 Hit" },
    PHASE_2: { color: "text-[#3B82F6]", bg: "bg-[#3B82F6]/10", label: "Phase 2 Hit" },
    LIQUIDATED: { color: "text-[#FF3D57]", bg: "bg-[#FF3D57]/10", label: "Liquidated" },
    COMPLETED: { color: "text-[#A855F7]", bg: "bg-[#A855F7]/10", label: "Completed" },
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#F0B90B]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Active Investments</h2>
        <p className="text-sm text-[#888] mt-1">Track all user pool purchases, maturity, and liquidation targets</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Investments" value={`$${stats.totalValueLocked.toLocaleString()}`} icon={DollarSign} color="gold" />
        <StatsCard title="Active Pools" value={stats.activePools} icon={TrendingUp} color="green" />
        <StatsCard title="Total Members" value={stats.totalMembers} icon={Users} color="blue" />
        <StatsCard title="Pending Liquidations" value={0} icon={AlertTriangle} color="red" />
      </div>

      {/* Live Investments Table */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#F0B90B]" />
            Investment Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                <TableHead className="text-[#999]">User</TableHead>
                <TableHead className="text-[#999]">Package</TableHead>
                <TableHead className="text-[#999]">Asset</TableHead>
                <TableHead className="text-[#999]">Amount</TableHead>
                <TableHead className="text-[#999]">Leverage</TableHead>
                <TableHead className="text-[#999]">Entry Price</TableHead>
                <TableHead className="text-[#999]">Phase 1 / Phase 2</TableHead>
                <TableHead className="text-[#999]">Progress</TableHead>
                <TableHead className="text-[#999]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockInvestments.map((inv) => {
                const st = statusConfig[inv.status] || statusConfig.ACTIVE;
                return (
                  <TableRow key={inv.id} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                    <TableCell className="font-mono text-xs text-[#F0B90B]">{inv.user}</TableCell>
                    <TableCell className="text-white text-sm">{inv.pool}</TableCell>
                    <TableCell>
                      <Badge className={inv.asset === "BTC" ? "bg-[#F7931A]/10 text-[#F7931A]" : "bg-[#627EEA]/10 text-[#627EEA]"}>
                        {inv.asset === "BTC" ? <Bitcoin className="w-3 h-3 mr-1" /> : <DollarSign className="w-3 h-3 mr-1" />}
                        {inv.asset}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-white font-medium">${inv.amount}</TableCell>
                    <TableCell><Badge className="bg-[#F0B90B]/10 text-[#F0B90B]">{inv.leverage}</Badge></TableCell>
                    <TableCell className="text-[#999] text-sm">{inv.entryPrice}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-[#F0B90B]" />
                        <span className="text-[#999]">{inv.phase1}</span>
                        <span className="text-[#666] mx-0.5">/</span>
                        <span className="text-[#999]">{inv.phase2}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="w-full max-w-[100px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-[#2A2A2A] overflow-hidden">
                            <div className="h-full rounded-full bg-[#F0B90B] transition-all" style={{ width: `${inv.progress}%` }} />
                          </div>
                          <span className="text-xs text-[#999]">{inv.progress}%</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${st.bg} ${st.color}`}>{st.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pool Summary Cards */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Pool Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pools.map((pool) => {
            const isBTC = pool.tokenSymbol === "BTCB" || pool.tokenSymbol === "BTC";
            return (
              <Card key={pool.id} className="bg-[#1A1A1A] border-[#2A2A2A]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-lg ${isBTC ? "bg-[#F7931A]/10" : "bg-[#627EEA]/10"} flex items-center justify-center`}>
                      {isBTC ? <Bitcoin className="w-4 h-4 text-[#F7931A]" /> : <DollarSign className="w-4 h-4 text-[#627EEA]" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{pool.name}</p>
                      <p className="text-xs text-[#666]">${pool.minDeposit} tier</p>
                    </div>
                    <Badge className={pool.status === "ACTIVE" ? "bg-[#00C853]/10 text-[#00C853] ml-auto" : "bg-[#FF3D57]/10 text-[#FF3D57] ml-auto"}>
                      {pool.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-[#0D0D0D] text-center">
                      <p className="text-[#999]">Members</p>
                      <p className="text-white font-semibold">{pool.memberCount}</p>
                    </div>
                    <div className="p-2 rounded bg-[#0D0D0D] text-center">
                      <p className="text-[#999]">Staked</p>
                      <p className="text-white font-semibold">{pool.totalStaked}</p>
                    </div>
                    <div className="p-2 rounded bg-[#0D0D0D] text-center">
                      <p className="text-[#999]">Profit</p>
                      <p className="text-[#00C853] font-semibold">{pool.apy}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
