"use client";

import { useEffect, useState } from "react";
import { Users, Trophy, Coins, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatsCard } from "@/components/stats-card";
import { api } from "@/lib/api";

interface ReferralStats {
  totalReferrals: number;
  totalRewardsDistributed: number;
  topReferrers: Array<{
    walletAddress: string;
    count: number;
    totalReward: number;
  }>;
}

export default function ReferralsPage() {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.getReferralStats();
        setStats(res.stats);
      } catch (err) {
        console.error("Failed to load referral stats:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#F0B90B]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Referral System</h2>
        <p className="text-[#999] mt-1">Track referrals, rewards, and top performers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCard
          title="Total Referrals"
          value={stats?.totalReferrals || 0}
          icon={Users}
          color="blue"
        />
        <StatsCard
          title="Total Rewards Paid"
          value={`${stats?.totalRewardsDistributed?.toFixed(4) || "0"} BNB`}
          icon={Coins}
          color="gold"
        />
        <StatsCard
          title="Top Referrers"
          value={stats?.topReferrers?.length || 0}
          icon={Trophy}
          color="green"
        />
      </div>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#F0B90B]" />
            Top Referrers Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stats?.topReferrers?.length ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
              <p className="text-[#999]">No referrals yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                  <TableHead className="text-[#999]">Rank</TableHead>
                  <TableHead className="text-[#999]">Wallet</TableHead>
                  <TableHead className="text-[#999]">Referrals</TableHead>
                  <TableHead className="text-[#999]">Total Reward</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topReferrers.map((referrer, index) => (
                  <TableRow key={referrer.walletAddress} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                    <TableCell>
                      <span className={`w-8 h-8 rounded-full inline-flex items-center justify-center text-sm font-bold ${
                        index === 0 ? "bg-[#F0B90B]/20 text-[#F0B90B]" :
                        index === 1 ? "bg-[#C0C0C0]/20 text-[#C0C0C0]" :
                        index === 2 ? "bg-[#CD7F32]/20 text-[#CD7F32]" :
                        "bg-[#2A2A2A] text-[#999]"
                      }`}>
                        #{index + 1}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-white">
                      {referrer.walletAddress.slice(0, 6)}...{referrer.walletAddress.slice(-4)}
                    </TableCell>
                    <TableCell className="text-white font-medium">{referrer.count}</TableCell>
                    <TableCell className="text-[#F0B90B] font-medium">{referrer.totalReward.toFixed(4)} BNB</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
