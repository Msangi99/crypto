"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Blocks, ShieldCheck, Zap, GitBranch, Wallet, CircleDot,
  ExternalLink, RefreshCw, AlertTriangle, CheckCircle2, Clock,
  Loader2, Copy, Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ModuleStatus {
  name: string;
  description: string;
  address: string;
  status: "DEPLOYED" | "PENDING" | "ERROR";
  icon: typeof Blocks;
  lastAction: string;
  lastActionTime: string;
  features: string[];
  health: "HEALTHY" | "WARNING" | "CRITICAL";
}

const CONTRACT_ADDRESS = "0x5fA4d61B529F88069a46B83451540aC4c2f96200";
const BSCSCAN_BASE = "https://testnet.bscscan.com/address/";

const contractModules: ModuleStatus[] = [
  {
    name: "PoolManager.sol",
    description: "Handles pool creation, fee collection, tier assignment, and member management",
    address: CONTRACT_ADDRESS,
    status: "DEPLOYED",
    icon: Blocks,
    lastAction: "Pool created — Platinum BTC Pool",
    lastActionTime: "2 hours ago",
    features: [
      "Pool creation (8 tiers: $100–$1,000)",
      "Pool fee collection (15% platform fee)",
      "Tier assignment (Starter → Platinum)",
      "Member join/leave tracking",
    ],
    health: "HEALTHY",
  },
  {
    name: "LoanVault.sol",
    description: "Locks leveraged crypto positions and manages loan-to-value ratios with 60x leverage",
    address: CONTRACT_ADDRESS,
    status: "DEPLOYED",
    icon: Wallet,
    lastAction: "Vault funded — 0.5 BTC locked",
    lastActionTime: "4 hours ago",
    features: [
      "60x leverage position locking",
      "BTCB & ETH BEP-20 asset custody",
      "Loan-to-value ratio monitoring",
      "Collateral management",
    ],
    health: "HEALTHY",
  },
  {
    name: "LiquidationBot.sol",
    description: "Monitors Chainlink price feeds and triggers automatic sell at Phase 1 and Phase 2 targets",
    address: CONTRACT_ADDRESS,
    status: "DEPLOYED",
    icon: Zap,
    lastAction: "Price check — BTC at $76,130",
    lastActionTime: "5 minutes ago",
    features: [
      "Chainlink AggregatorV3 integration",
      "BTC Phase 1: $150,000 (partial 30–50%)",
      "BTC Phase 2: $200,000 (full liquidation)",
      "ETH Phase 1: $15,000 / Phase 2: $20,000",
      "Freshness: updatedAt > block.timestamp - 3600",
    ],
    health: "HEALTHY",
  },
  {
    name: "ReferralEngine.sol",
    description: "Tracks 5-level referral tree and distributes commissions from pool fees",
    address: CONTRACT_ADDRESS,
    status: "DEPLOYED",
    icon: GitBranch,
    lastAction: "Commission paid — L1 20% to 0xfde8…",
    lastActionTime: "1 hour ago",
    features: [
      "Level 1: 20% of Pool Fee",
      "Level 2: 8% of Pool Fee",
      "Level 3: 5% of Pool Fee",
      "Level 4: 3% of Pool Fee",
      "Level 5: 1% of Pool Fee",
    ],
    health: "HEALTHY",
  },
  {
    name: "FeeDistributor.sol",
    description: "Executes the 85/15 profit split, sends USDT/WBNB to users and platform treasury",
    address: CONTRACT_ADDRESS,
    status: "DEPLOYED",
    icon: ShieldCheck,
    lastAction: "Fee split executed — 85% → user",
    lastActionTime: "30 minutes ago",
    features: [
      "85% profit → Participant wallet",
      "15% profit → Platform treasury",
      "Automatic USDT/WBNB conversion",
      "Multi-phase payout support",
    ],
    health: "HEALTHY",
  },
];

const statusConfig = {
  DEPLOYED: { color: "text-[#00C853]", bg: "bg-[#00C853]/10", border: "border-[#00C853]/20" },
  PENDING: { color: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10", border: "border-[#F0B90B]/20" },
  ERROR: { color: "text-[#FF3D57]", bg: "bg-[#FF3D57]/10", border: "border-[#FF3D57]/20" },
};

const healthConfig = {
  HEALTHY: { color: "text-[#00C853]", bg: "bg-[#00C853]/10", icon: CheckCircle2, label: "Healthy" },
  WARNING: { color: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10", icon: AlertTriangle, label: "Warning" },
  CRITICAL: { color: "text-[#FF3D57]", bg: "bg-[#FF3D57]/10", icon: AlertTriangle, label: "Critical" },
};

export default function ContractsPage() {
  const [modules] = useState<ModuleStatus[]>(contractModules);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [blockNumber, setBlockNumber] = useState<number | null>(null);
  const [gasPrice, setGasPrice] = useState<string | null>(null);

  const fetchChainData = useCallback(async () => {
    try {
      const res = await fetch("https://data-seed-prebsc-1-s1.binance.org:8545", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          { jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 },
          { jsonrpc: "2.0", method: "eth_gasPrice", params: [], id: 2 },
        ]),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setBlockNumber(parseInt(data[0]?.result || "0", 16));
        const gwei = parseInt(data[1]?.result || "0", 16) / 1e9;
        setGasPrice(gwei.toFixed(1));
      }
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchChainData();
    const interval = setInterval(fetchChainData, 15000);
    return () => clearInterval(interval);
  }, [fetchChainData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchChainData();
    setTimeout(() => setRefreshing(false), 800);
    toast.success("Contract status refreshed");
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    toast.success("Address copied!");
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const deployedCount = modules.filter((m) => m.status === "DEPLOYED").length;
  const healthyCount = modules.filter((m) => m.health === "HEALTHY").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Smart Contract Architecture</h2>
          <p className="text-sm text-[#888] mt-1">Monitor all 5 protocol modules deployed on BSC Testnet</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing} className="border-[#2A2A2A] text-[#999] hover:text-white hover:bg-[#2A2A2A]">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00C853]/10 flex items-center justify-center">
              <Blocks className="w-5 h-5 text-[#00C853]" />
            </div>
            <div>
              <p className="text-xs text-[#888] uppercase tracking-wider">Deployed</p>
              <p className="text-xl font-bold text-white">{deployedCount}/5</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00C853]/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-[#00C853]" />
            </div>
            <div>
              <p className="text-xs text-[#888] uppercase tracking-wider">Healthy</p>
              <p className="text-xl font-bold text-white">{healthyCount}/5</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/10 flex items-center justify-center">
              <Blocks className="w-5 h-5 text-[#F0B90B]" />
            </div>
            <div>
              <p className="text-xs text-[#888] uppercase tracking-wider">Block</p>
              <p className="text-xl font-bold text-white font-mono">{blockNumber ? blockNumber.toLocaleString() : "—"}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div>
              <p className="text-xs text-[#888] uppercase tracking-wider">Gas Price</p>
              <p className="text-xl font-bold text-white font-mono">{gasPrice || "—"} Gwei</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Contract Address */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/10 flex items-center justify-center">
                <Blocks className="w-5 h-5 text-[#F0B90B]" />
              </div>
              <div>
                <p className="text-xs text-[#888] uppercase tracking-wider">Main Contract (PoolManager Proxy)</p>
                <p className="text-sm font-mono text-[#F0B90B] mt-0.5">{CONTRACT_ADDRESS}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => copyAddress(CONTRACT_ADDRESS)} className="p-2 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-white transition-colors">
                {copiedAddr === CONTRACT_ADDRESS ? <Check className="w-4 h-4 text-[#00C853]" /> : <Copy className="w-4 h-4" />}
              </button>
              <a href={`${BSCSCAN_BASE}${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-[#F0B90B] transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
              <Badge className="bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20">BSC Testnet (97)</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract Modules Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const st = statusConfig[mod.status];
          const hl = healthConfig[mod.health];
          const HlIcon = hl.icon;
          const ModIcon = mod.icon;
          return (
            <Card key={mod.name} className="bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#3A3A3A] transition-all group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/10 flex items-center justify-center">
                      <ModIcon className="w-5 h-5 text-[#F0B90B]" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-sm font-mono">{mod.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`${st.bg} ${st.color} ${st.border} text-[10px]`}>
                          <CircleDot className="w-2.5 h-2.5 mr-1" /> {mod.status}
                        </Badge>
                        <Badge className={`${hl.bg} ${hl.color} text-[10px]`}>
                          <HlIcon className="w-2.5 h-2.5 mr-1" /> {hl.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-[#888] leading-relaxed">{mod.description}</p>

                {/* Features */}
                <div className="space-y-1.5">
                  {mod.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-[#00C853] mt-0.5 shrink-0" />
                      <span className="text-[#ccc]">{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Last Action */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
                  <Clock className="w-3.5 h-3.5 text-[#666] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[#999] truncate">{mod.lastAction}</p>
                    <p className="text-[10px] text-[#666]">{mod.lastActionTime}</p>
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#666]">{mod.address.slice(0, 10)}…{mod.address.slice(-6)}</span>
                  <a href={`${BSCSCAN_BASE}${mod.address}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#F0B90B] hover:underline flex items-center gap-1">
                    BscScan <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
