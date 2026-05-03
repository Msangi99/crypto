"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp, Loader2, Bitcoin, Clock, Target, CheckCircle2,
  AlertTriangle, DollarSign, Users, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatsCard } from "@/components/stats-card";
import { api } from "@/lib/api";

interface Investment {
  id: string;
  userId: string;
  poolId: string;
  joinedAt: string;
  share: number;
  user: { id: string; walletAddress: string; username: string | null };
  pool: { id: string; name: string; tokenSymbol: string; apy: number; status: string };
}

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

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ totalPools: 0, activePools: 0, totalValueLocked: 0, totalMembers: 0 });
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [investRes, poolsRes, statsRes] = await Promise.all([
        api.getAdminInvestments(page, limit),
        api.getPools(1, 50),
        api.getPoolStats(),
      ]);
      setInvestments(investRes.investments);
      setTotal(investRes.total);
      setPools(poolsRes.data);
      setStats(statsRes.stats);
    } catch (err) {
      console.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / limit);

  if (loading && investments.length === 0) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#F0B90B]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Active Investments</h2>
        <p className="text-sm text-[#888] mt-1">Track all user pool memberships and positions from the database</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Investments" value={`$${stats.totalValueLocked.toLocaleString()}`} icon={DollarSign} color="gold" />
        <StatsCard title="Active Pools" value={stats.activePools} icon={TrendingUp} color="green" />
        <StatsCard title="Total Members" value={stats.totalMembers} icon={Users} color="blue" />
        <StatsCard title="Total Positions" value={total} icon={Target} color="red" />
      </div>

      {/* Real Investments Table */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#F0B90B]" />
            Investment Positions
            <Badge className="bg-[#2A2A2A] text-[#999] text-xs ml-2">{total} total</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {investments.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
              <p className="text-[#999]">No investment positions yet</p>
              <p className="text-xs text-[#666] mt-1">Positions appear when users deposit into pools</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                    <TableHead className="text-[#999]">User</TableHead>
                    <TableHead className="text-[#999]">Pool</TableHead>
                    <TableHead className="text-[#999]">Asset</TableHead>
                    <TableHead className="text-[#999]">Share</TableHead>
                    <TableHead className="text-[#999]">Pool Status</TableHead>
                    <TableHead className="text-[#999]">Profit Share</TableHead>
                    <TableHead className="text-[#999]">Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.map((inv) => {
                    const isBTC = inv.pool.tokenSymbol === "BTCB" || inv.pool.tokenSymbol === "BTC";
                    return (
                      <TableRow key={inv.id} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                        <TableCell>
                          <div>
                            <p className="font-mono text-xs text-[#F0B90B]">{shortAddr(inv.user.walletAddress)}</p>
                            {inv.user.username && <p className="text-[10px] text-[#666]">{inv.user.username}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-white text-sm font-medium">{inv.pool.name}</TableCell>
                        <TableCell>
                          <Badge className={isBTC ? "bg-[#F7931A]/10 text-[#F7931A]" : "bg-[#627EEA]/10 text-[#627EEA]"}>
                            {isBTC ? <Bitcoin className="w-3 h-3 mr-1" /> : <DollarSign className="w-3 h-3 mr-1" />}
                            {inv.pool.tokenSymbol}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-white font-semibold">{Number(inv.share).toFixed(4)}</TableCell>
                        <TableCell>
                          <Badge className={inv.pool.status === "ACTIVE" ? "bg-[#00C853]/10 text-[#00C853]" : "bg-[#FF3D57]/10 text-[#FF3D57]"}>
                            {inv.pool.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[#00C853] font-medium">{inv.pool.apy}%</TableCell>
                        <TableCell className="text-xs text-[#666]">{new Date(inv.joinedAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="border-[#2A2A2A] text-[#999]">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-[#999]">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="border-[#2A2A2A] text-[#999]">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
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
