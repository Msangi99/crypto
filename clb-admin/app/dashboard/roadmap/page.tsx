"use client";

import { useState } from "react";
import {
  Rocket, CheckCircle2, Clock, AlertCircle, Target,
  Shield, Monitor, Globe, ChevronDown, ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Milestone {
  title: string;
  status: "DONE" | "IN_PROGRESS" | "PENDING";
  date?: string;
}

interface Phase {
  id: number;
  name: string;
  subtitle: string;
  icon: typeof Rocket;
  color: string;
  status: "COMPLETED" | "IN_PROGRESS" | "UPCOMING";
  progress: number;
  eta: string;
  milestones: Milestone[];
}

const phases: Phase[] = [
  {
    id: 1,
    name: "Phase 1 — Foundation",
    subtitle: "Smart Contract Development & Core Architecture",
    icon: Target,
    color: "#00C853",
    status: "COMPLETED",
    progress: 100,
    eta: "Q1 2026 ✅",
    milestones: [
      { title: "PoolManager.sol — Pool creation, tier assignment, fee collection", status: "DONE", date: "Jan 2026" },
      { title: "LoanVault.sol — 60x leverage locking, BTCB/ETH custody", status: "DONE", date: "Jan 2026" },
      { title: "LiquidationBot.sol — Chainlink AggregatorV3, auto-sell triggers", status: "DONE", date: "Feb 2026" },
      { title: "ReferralEngine.sol — 5-level tree (20/8/5/3/1%)", status: "DONE", date: "Feb 2026" },
      { title: "FeeDistributor.sol — 85/15 profit split, USDT/WBNB payout", status: "DONE", date: "Feb 2026" },
      { title: "Prisma ORM + Neon PostgreSQL database setup", status: "DONE", date: "Mar 2026" },
      { title: "Fastify REST API — Auth, Pools, Users, Transactions", status: "DONE", date: "Mar 2026" },
      { title: "BSC Testnet deployment (Chain ID: 97)", status: "DONE", date: "Mar 2026" },
    ],
  },
  {
    id: 2,
    name: "Phase 2 — Security & Audit",
    subtitle: "Smart Contract Audits, Multi-Sig & Penetration Testing",
    icon: Shield,
    color: "#F0B90B",
    status: "IN_PROGRESS",
    progress: 35,
    eta: "Q3 2026",
    milestones: [
      { title: "CertiK smart contract audit — scheduled", status: "IN_PROGRESS", date: "Q3 2026" },
      { title: "PeckShield secondary audit", status: "PENDING", date: "Q4 2026" },
      { title: "Gnosis Safe multi-sig setup (3-of-5)", status: "IN_PROGRESS" },
      { title: "Hacken penetration testing", status: "PENDING" },
      { title: "ReentrancyGuard + Ownable2Step validation", status: "DONE", date: "Apr 2026" },
      { title: "Emergency pause mechanism", status: "DONE", date: "Apr 2026" },
      { title: "Rate limiting & timelock controller", status: "PENDING" },
    ],
  },
  {
    id: 3,
    name: "Phase 3 — Frontend & UX",
    subtitle: "Admin Dashboard, User Portal & Wallet Integration",
    icon: Monitor,
    color: "#3B82F6",
    status: "IN_PROGRESS",
    progress: 75,
    eta: "Q3 2026",
    milestones: [
      { title: "Admin dashboard — Overview, Analytics, Charts", status: "DONE", date: "Apr 2026" },
      { title: "Packages/Tiers management (8 pools: $100–$1000)", status: "DONE", date: "Apr 2026" },
      { title: "Users CRUD + Investments tracking", status: "DONE", date: "Apr 2026" },
      { title: "Payments & Transaction history", status: "DONE", date: "May 2026" },
      { title: "5-Level Referral tree visualization", status: "DONE", date: "May 2026" },
      { title: "Smart Contract monitor + Security page", status: "DONE", date: "May 2026" },
      { title: "Profit calculator + Liquidity page", status: "DONE", date: "May 2026" },
      { title: "User-facing portal (Pool selection, Wallet connect)", status: "IN_PROGRESS" },
      { title: "MetaMask + Trust Wallet integration guides", status: "DONE", date: "May 2026" },
      { title: "Mobile-responsive optimization", status: "PENDING" },
    ],
  },
  {
    id: 4,
    name: "Phase 4 — BSC Mainnet Launch",
    subtitle: "Production Deployment, Marketing & Community Growth",
    icon: Globe,
    color: "#A855F7",
    status: "UPCOMING",
    progress: 0,
    eta: "Q1 2027",
    milestones: [
      { title: "BSC Mainnet deployment (Chain ID: 56)", status: "PENDING" },
      { title: "Mainnet contract verification on BscScan", status: "PENDING" },
      { title: "PancakeSwap production liquidity provision", status: "PENDING" },
      { title: "Chainlink Mainnet price feed integration", status: "PENDING" },
      { title: "Marketing campaign & community launch", status: "PENDING" },
      { title: "Referral program activation", status: "PENDING" },
      { title: "First pool round opening", status: "PENDING" },
      { title: "Performance monitoring & optimization", status: "PENDING" },
    ],
  },
];

const milestoneStatusConfig = {
  DONE: { color: "text-[#00C853]", bg: "bg-[#00C853]/10", icon: CheckCircle2 },
  IN_PROGRESS: { color: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10", icon: Clock },
  PENDING: { color: "text-[#666]", bg: "bg-[#2A2A2A]", icon: AlertCircle },
};

const phaseStatusConfig = {
  COMPLETED: { color: "text-[#00C853]", bg: "bg-[#00C853]/10" },
  IN_PROGRESS: { color: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10" },
  UPCOMING: { color: "text-[#666]", bg: "bg-[#2A2A2A]" },
};

export default function RoadmapPage() {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 1: false, 2: true, 3: true, 4: false });

  const toggleExpand = (id: number) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const totalMilestones = phases.reduce((s, p) => s + p.milestones.length, 0);
  const doneMilestones = phases.reduce((s, p) => s + p.milestones.filter((m) => m.status === "DONE").length, 0);
  const overallProgress = Math.round((doneMilestones / totalMilestones) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Project Roadmap</h2>
        <p className="text-sm text-[#888] mt-1">CryptoLoanBoost development phases — Foundation → Security → Frontend → Mainnet</p>
      </div>

      {/* Overall Progress */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-[#F0B90B]" />
              <span className="text-sm font-semibold text-white">Overall Progress</span>
            </div>
            <span className="text-sm font-bold text-[#F0B90B]">{overallProgress}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-[#2A2A2A] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#00C853] via-[#F0B90B] to-[#3B82F6] transition-all" style={{ width: `${overallProgress}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[#666]">{doneMilestones} of {totalMilestones} milestones completed</span>
            <div className="flex gap-3">
              {phases.map((p) => (
                <div key={p.id} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-[10px] text-[#666]">P{p.id}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase Cards */}
      <div className="space-y-4">
        {phases.map((phase) => {
          const PhaseIcon = phase.icon;
          const pCfg = phaseStatusConfig[phase.status];
          const isExpanded = expanded[phase.id];
          const donePhaseMilestones = phase.milestones.filter((m) => m.status === "DONE").length;

          return (
            <Card key={phase.id} className="bg-[#1A1A1A] border-[#2A2A2A] overflow-hidden" style={{ borderLeftWidth: 4, borderLeftColor: phase.color }}>
              <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleExpand(phase.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${phase.color}15` }}>
                      <PhaseIcon className="w-5 h-5" style={{ color: phase.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-white text-sm">{phase.name}</CardTitle>
                        <Badge className={`${pCfg.bg} ${pCfg.color} text-[10px]`}>{phase.status.replace("_", " ")}</Badge>
                      </div>
                      <p className="text-xs text-[#666] mt-0.5">{phase.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-mono" style={{ color: phase.color }}>{phase.progress}%</p>
                      <p className="text-[10px] text-[#666]">ETA: {phase.eta}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-[#666]" /> : <ChevronDown className="w-4 h-4 text-[#666]" />}
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 rounded-full bg-[#2A2A2A] overflow-hidden mt-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${phase.progress}%`, backgroundColor: phase.color }} />
                </div>
                <p className="text-[10px] text-[#666] mt-1">{donePhaseMilestones}/{phase.milestones.length} milestones</p>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 space-y-1.5">
                  {phase.milestones.map((m, i) => {
                    const mCfg = milestoneStatusConfig[m.status];
                    const MIcon = mCfg.icon;
                    return (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
                        <MIcon className={`w-4 h-4 ${mCfg.color} shrink-0`} />
                        <span className={`text-xs flex-1 ${m.status === "PENDING" ? "text-[#666]" : "text-[#ccc]"}`}>{m.title}</span>
                        {m.date && <span className="text-[10px] text-[#666] shrink-0">{m.date}</span>}
                        <Badge className={`${mCfg.bg} ${mCfg.color} text-[10px] shrink-0`}>{m.status.replace("_", " ")}</Badge>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
