"use client";

import { useEffect, useState } from "react";
import {
  Users, Trophy, Coins, Loader2, GitBranch, ArrowRight, Percent, Network,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

const referralLevels = [
  { level: 1, percentage: 20, color: "#F0B90B", description: "Direct referrer gets 20% (pool claim / mining purchase triggers)", example: "User A refers User B → A gets 20%" },
  { level: 2, percentage: 7, color: "#00C853", description: "Second-level upline gets 7%", example: "B refers C → A gets 7% from C" },
  { level: 3, percentage: 4, color: "#3B82F6", description: "Third-level upline gets 4%", example: "C refers D → A gets 4% from D" },
  { level: 4, percentage: 3, color: "#A855F7", description: "Fourth-level upline gets 3%", example: "D refers E → A gets 3% from E" },
  { level: 5, percentage: 1, color: "#FF3D57", description: "Fifth-level upline gets 1%", example: "E refers F → A gets 1% from F" },
];

const totalCommission = referralLevels.reduce((sum, l) => sum + l.percentage, 0);

function formatReferralUsdt(n: number) {
  return `${(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
}

// Mock referral tree for visualization
const mockTree = {
  address: "0xfde8...aafb",
  label: "Admin (You)",
  children: [
    {
      address: "0xa1b2...c3d4",
      label: "User A (L1 — 20%)",
      level: 1,
      earned: 25.0,
      children: [
        { address: "0xb5c6...d7e8", label: "User B (L2 — 7%)", level: 2, earned: 4.0, children: [
          { address: "0xc9d0...e1f2", label: "User C (L3 — 4%)", level: 3, earned: 1.25, children: [] },
        ]},
        { address: "0xf3a4...b5c6", label: "User D (L2 — 7%)", level: 2, earned: 2.0, children: [] },
      ],
    },
    {
      address: "0xe5f6...7890",
      label: "User E (L1 — 20%)",
      level: 1,
      earned: 50.0,
      children: [
        { address: "0x1234...5678", label: "User F (L2 — 7%)", level: 2, earned: 8.0, children: [
          { address: "0x9abc...def0", label: "User G (L3 — 4%)", level: 3, earned: 2.5, children: [
            { address: "0x2345...6789", label: "User H (L4 — 3%)", level: 4, earned: 0.75, children: [
              { address: "0x3456...789a", label: "User I (L5 — 1%)", level: 5, earned: 0.1, children: [] },
            ]},
          ]},
        ]},
      ],
    },
  ],
};

interface TreeNode {
  address: string;
  label: string;
  level?: number;
  earned?: number;
  children: TreeNode[];
}

function TreeBranch({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const levelConfig = referralLevels.find((l) => l.level === (node.level || 0));
  const color = levelConfig?.color || "#F0B90B";
  return (
    <div className={depth > 0 ? "ml-6 mt-2" : ""}>
      <div className="flex items-center gap-2">
        {depth > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-4 h-px" style={{ backgroundColor: color }} />
            <ArrowRight className="w-3 h-3" style={{ color }} />
          </div>
        )}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
          <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
            <span className="text-[10px] font-bold" style={{ color }}>{node.level ? `L${node.level}` : "⭐"}</span>
          </div>
          <div>
            <p className="text-xs text-white font-medium">{node.label}</p>
            <p className="text-[10px] font-mono text-[#666]">{node.address}</p>
          </div>
          {node.earned !== undefined && (
            <Badge className="text-[10px] ml-1" style={{ backgroundColor: `${color}20`, color }}>
              +{formatReferralUsdt(node.earned)}
            </Badge>
          )}
        </div>
      </div>
      {node.children.map((child) => (
        <TreeBranch key={child.address} node={child} depth={depth + 1} />
      ))}
    </div>
  );
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
        <h2 className="text-2xl font-bold text-white tracking-tight">5-Level Referral System</h2>
        <p className="text-sm text-[#888] mt-1">Multi-level commission — L1: 20%, L2: 7%, L3: 4%, L4: 3%, L5: 1%. Total: {totalCommission}%.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard title="Total Referrals" value={stats?.totalReferrals || 0} icon={Users} color="blue" />
        <StatsCard title="Total Rewards" value={formatReferralUsdt(stats?.totalRewardsDistributed ?? 0)} icon={Coins} color="gold" />
        <StatsCard title="Top Referrers" value={stats?.topReferrers?.length || 0} icon={Trophy} color="green" />
        <StatsCard title="Commission Rate" value={`${totalCommission}%`} icon={Percent} color="gold" />
      </div>

      {/* 5-Level Commission Structure */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#F0B90B]" />
            Commission Structure (pool claim / mining purchase)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {referralLevels.map((lvl) => (
              <div key={lvl.level} className="flex items-center gap-3 p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${lvl.color}15` }}>
                  <span className="text-sm font-bold" style={{ color: lvl.color }}>L{lvl.level}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{lvl.percentage}%</span>
                    <span className="text-xs text-[#888]">{lvl.description}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#2A2A2A] overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(lvl.percentage / 20) * 100}%`, backgroundColor: lvl.color }} />
                  </div>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-[10px] text-[#666]">{lvl.example}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 p-3 rounded-lg bg-[#F0B90B]/5 border border-[#F0B90B]/20 flex items-center justify-between">
            <span className="text-xs text-[#F0B90B] font-medium">Total (L1–L5, paying levels only)</span>
            <span className="text-sm font-bold text-[#F0B90B]">{totalCommission}%</span>
          </div>
        </CardContent>
      </Card>

      {/* Referral Tree Visualization */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Network className="w-4 h-4 text-[#F0B90B]" />
            Referral Network Tree (Demo)
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <TreeBranch node={mockTree} />
        </CardContent>
      </Card>

      {/* Leaderboard */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#F0B90B]" />
            Top Referrers Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stats?.topReferrers?.length ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
              <p className="text-[#999]">No referrals yet. Network will grow as users join pools.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                  <TableHead className="text-[#999]">Rank</TableHead>
                  <TableHead className="text-[#999]">Wallet</TableHead>
                  <TableHead className="text-[#999]">Referrals</TableHead>
                  <TableHead className="text-[#999]">L1 rewards</TableHead>
                  <TableHead className="text-[#999]">Total rewards</TableHead>
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
                    <TableCell className="text-[#F0B90B]">{formatReferralUsdt(referrer.totalReward * 0.54)}</TableCell>
                    <TableCell className="text-[#00C853] font-medium">{formatReferralUsdt(referrer.totalReward)}</TableCell>
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
