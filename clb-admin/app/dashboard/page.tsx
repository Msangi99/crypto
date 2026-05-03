"use client";

import { useEffect, useState } from "react";
import { Waves, Users, DollarSign, Activity, TrendingUp, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatsCard } from "@/components/stats-card";
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

export default function DashboardPage() {
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [pools, setPools] = useState<Pool[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, poolsRes, healthRes] = await Promise.all([
          api.getPoolStats(),
          api.getPools(1, 5),
          api.health(),
        ]);
        setStats(statsRes.stats);
        setPools(poolsRes.data);
        setHealth(healthRes as HealthData);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Dashboard Overview</h2>
        <p className="text-[#999] mt-1">Welcome back. Here&apos;s what&apos;s happening with CLB.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Value Locked"
          value={`${stats?.totalValueLocked?.toFixed(4) || "0"} BNB`}
          icon={DollarSign}
          color="gold"
        />
        <StatsCard
          title="Active Pools"
          value={stats?.activePools || 0}
          subtitle={`${stats?.totalPools || 0} total pools`}
          icon={Waves}
          color="green"
        />
        <StatsCard
          title="Total Members"
          value={stats?.totalMembers || 0}
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="System Status"
          value={health?.status === "ok" ? "Online" : "Offline"}
          subtitle={`Uptime: ${Math.floor((health?.uptime || 0) / 60)}m`}
          icon={Activity}
          color={health?.status === "ok" ? "green" : "red"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Waves className="w-5 h-5 text-[#F0B90B]" />
              Active Pools
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pools.length === 0 ? (
              <p className="text-[#666] text-sm py-8 text-center">No pools created yet</p>
            ) : (
              <div className="space-y-3">
                {pools.map((pool) => (
                  <div
                    key={pool.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center">
                        <Coins className="w-5 h-5 text-[#F0B90B]" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{pool.name}</p>
                        <p className="text-xs text-[#666]">{pool.memberCount} members</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-[#00C853]">
                        <TrendingUp className="w-3 h-3 inline mr-1" />
                        {pool.apy}% APY
                      </p>
                      <p className="text-xs text-[#999]">{pool.totalStaked} {pool.tokenSymbol}</p>
                    </div>
                    <Badge
                      className={
                        pool.status === "ACTIVE"
                          ? "bg-[#00C853]/10 text-[#00C853] border-[#00C853]/20"
                          : "bg-[#FF3D57]/10 text-[#FF3D57] border-[#FF3D57]/20"
                      }
                    >
                      {pool.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#00C853]" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
              <span className="text-sm text-[#999]">Database</span>
              <Badge className={health?.database === "connected" ? "bg-[#00C853]/10 text-[#00C853]" : "bg-[#FF3D57]/10 text-[#FF3D57]"}>
                {health?.database || "unknown"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
              <span className="text-sm text-[#999]">Blockchain</span>
              <Badge className={health?.blockchain === "connected" ? "bg-[#00C853]/10 text-[#00C853]" : "bg-[#FF3D57]/10 text-[#FF3D57]"}>
                {health?.blockchain || "unknown"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
              <span className="text-sm text-[#999]">Contract</span>
              <span className="text-xs font-mono text-[#F0B90B]">0x5fA4...6200</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
              <span className="text-sm text-[#999]">Network</span>
              <Badge className="bg-[#F0B90B]/10 text-[#F0B90B]">BSC Testnet</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
