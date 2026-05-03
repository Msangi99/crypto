"use client";

import { useState } from "react";
import {
  Ticket, Hash, Users, Copy, Check, ExternalLink,
  Clock, CheckCircle2, AlertTriangle, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface ReceiptToken {
  tokenId: string;
  holder: string;
  poolName: string;
  asset: string;
  tier: number;
  mintedAt: string;
  status: "ACTIVE" | "REDEEMED" | "EXPIRED";
  txHash: string;
}

const CONTRACT_ADDRESS = "0x5fA4d61B529F88069a46B83451540aC4c2f96200";

const mockReceipts: ReceiptToken[] = [
  { tokenId: "CLB-001", holder: "0xfde8...aafb", poolName: "Gold BTC Pool", asset: "BTC", tier: 500, mintedAt: "2026-05-03T10:00:00Z", status: "ACTIVE", txHash: "0xabc1...def2" },
  { tokenId: "CLB-002", holder: "0xa1b2...c3d4", poolName: "Silver ETH Pool", asset: "ETH", tier: 250, mintedAt: "2026-05-02T14:30:00Z", status: "ACTIVE", txHash: "0xghi3...jkl4" },
  { tokenId: "CLB-003", holder: "0xe5f6...7890", poolName: "Platinum BTC Pool", asset: "BTC", tier: 1000, mintedAt: "2026-04-28T09:00:00Z", status: "ACTIVE", txHash: "0xmno5...pqr6" },
  { tokenId: "CLB-004", holder: "0x1234...5678", poolName: "Starter BTC Pool", asset: "BTC", tier: 100, mintedAt: "2026-04-25T16:00:00Z", status: "REDEEMED", txHash: "0xstu7...vwx8" },
  { tokenId: "CLB-005", holder: "0x9abc...def0", poolName: "Gold ETH Pool", asset: "ETH", tier: 500, mintedAt: "2026-04-20T11:00:00Z", status: "EXPIRED", txHash: "0xyz9...abc0" },
];

const statusConfig = {
  ACTIVE: { color: "text-[#00C853]", bg: "bg-[#00C853]/10", icon: CheckCircle2 },
  REDEEMED: { color: "text-[#3B82F6]", bg: "bg-[#3B82F6]/10", icon: CheckCircle2 },
  EXPIRED: { color: "text-[#FF3D57]", bg: "bg-[#FF3D57]/10", icon: AlertTriangle },
};

const tokenSpec = [
  { label: "Standard", value: "BEP-20 (ERC-20 compatible)" },
  { label: "Name", value: "CryptoLoanBoost Receipt" },
  { label: "Symbol", value: "CLB-R" },
  { label: "Decimals", value: "0 (non-divisible)" },
  { label: "Transferable", value: "No (soulbound)" },
  { label: "Burnable", value: "Yes (on redemption)" },
];

export default function ReceiptsPage() {
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const receipts = mockReceipts;

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    toast.success("Copied!");
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const activeCount = receipts.filter((r) => r.status === "ACTIVE").length;
  const redeemedCount = receipts.filter((r) => r.status === "REDEEMED").length;
  const totalTierValue = receipts.filter((r) => r.status === "ACTIVE").reduce((s, r) => s + r.tier, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Pool Receipt Tokens (BEP-20)</h2>
        <p className="text-sm text-[#888] mt-1">Track minted receipt tokens — non-transferable proof of pool investment</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Minted", value: receipts.length, color: "#F0B90B", icon: Ticket },
          { label: "Active", value: activeCount, color: "#00C853", icon: CheckCircle2 },
          { label: "Redeemed", value: redeemedCount, color: "#3B82F6", icon: Hash },
          { label: "Active TVL", value: `$${totalTierValue.toLocaleString()}`, color: "#F0B90B", icon: Users },
        ].map((s) => (
          <Card key={s.label} className="bg-[#1A1A1A] border-[#2A2A2A]">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xs text-[#888] uppercase tracking-wider">{s.label}</p>
                <p className="text-xl font-bold text-white">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Token Spec */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-[#F0B90B]" /> Token Specification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tokenSpec.map((item) => (
              <div key={item.label} className="flex justify-between p-2.5 rounded bg-[#0D0D0D]">
                <span className="text-xs text-[#999]">{item.label}</span>
                <span className="text-xs text-white font-medium">{item.value}</span>
              </div>
            ))}
            <div className="pt-2">
              <div className="flex items-center justify-between p-2.5 rounded bg-[#0D0D0D]">
                <span className="text-xs text-[#999]">Contract</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-[#F0B90B]">{CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-6)}</span>
                  <button onClick={() => copyAddress(CONTRACT_ADDRESS)} className="text-[#666] hover:text-white">
                    {copiedAddr === CONTRACT_ADDRESS ? <Check className="w-3 h-3 text-[#00C853]" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[#F0B90B]/5 border border-[#F0B90B]/20 flex items-start gap-2 mt-2">
              <Info className="w-3.5 h-3.5 text-[#F0B90B] mt-0.5 shrink-0" />
              <p className="text-[10px] text-[#F0B90B]">Receipt tokens are soulbound (non-transferable). They serve as on-chain proof of pool participation and are burned upon redemption at Phase 1 or Phase 2 liquidation.</p>
            </div>
          </CardContent>
        </Card>

        {/* Receipts Table */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A] lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Ticket className="w-4 h-4 text-[#F0B90B]" /> Minted Receipts
              <Badge className="bg-[#2A2A2A] text-[#999] text-xs ml-2">{receipts.length} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                  <TableHead className="text-[#999]">Token ID</TableHead>
                  <TableHead className="text-[#999]">Holder</TableHead>
                  <TableHead className="text-[#999]">Pool</TableHead>
                  <TableHead className="text-[#999]">Tier</TableHead>
                  <TableHead className="text-[#999]">Minted</TableHead>
                  <TableHead className="text-[#999]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r) => {
                  const st = statusConfig[r.status];
                  const StIcon = st.icon;
                  return (
                    <TableRow key={r.tokenId} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                      <TableCell className="font-mono text-xs text-[#F0B90B] font-semibold">{r.tokenId}</TableCell>
                      <TableCell className="font-mono text-xs text-white">{r.holder}</TableCell>
                      <TableCell>
                        <div>
                          <p className="text-xs text-white">{r.poolName}</p>
                          <Badge className={`text-[10px] mt-0.5 ${r.asset === "BTC" ? "bg-[#F7931A]/10 text-[#F7931A]" : "bg-[#627EEA]/10 text-[#627EEA]"}`}>{r.asset}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-white">${r.tier}</TableCell>
                      <TableCell className="text-xs text-[#666]">{new Date(r.mintedAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge className={`${st.bg} ${st.color} text-xs gap-1`}>
                          <StIcon className="w-3 h-3" /> {r.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
