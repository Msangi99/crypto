"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Ticket, Hash, Users, Copy, Check, ExternalLink,
  Clock, CheckCircle2, AlertTriangle, Info, Loader2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { api } from "@/lib/api";

interface ReceiptToken {
  id: string;
  tokenId: string;
  holder: string;
  holderName: string | null;
  poolName: string;
  poolSymbol: string;
  amount: number;
  txHash: string | null;
  status: string;
  mintedAt: string;
}

const CONTRACT_ADDRESS = "0x5fA4d61B529F88069a46B83451540aC4c2f96200";

const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
  CONFIRMED: { color: "text-[#00C853]", bg: "bg-[#00C853]/10", icon: CheckCircle2 },
  PENDING: { color: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10", icon: Clock },
  FAILED: { color: "text-[#FF3D57]", bg: "bg-[#FF3D57]/10", icon: AlertTriangle },
};

const tokenSpec = [
  { label: "Standard", value: "BEP-20 (ERC-20 compatible)" },
  { label: "Name", value: "CryptoLoanBoost Receipt" },
  { label: "Symbol", value: "CLB-R" },
  { label: "Decimals", value: "0 (non-divisible)" },
  { label: "Transferable", value: "No (soulbound)" },
  { label: "Burnable", value: "Yes (on redemption)" },
];

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ReceiptsPage() {
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<ReceiptToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminReceipts(page, limit);
      setReceipts(res.receipts);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load receipts:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { loadReceipts(); }, [loadReceipts]);

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    toast.success("Copied!");
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  const totalPages = Math.ceil(total / limit);
  const confirmedCount = receipts.filter((r) => r.status === "CONFIRMED").length;
  const pendingCount = receipts.filter((r) => r.status === "PENDING").length;
  const totalValue = receipts.filter((r) => r.status === "CONFIRMED").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Pool Receipt Tokens (BEP-20)</h2>
        <p className="text-sm text-[#888] mt-1">Track minted receipt tokens — non-transferable proof of pool investment</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Minted", value: total, color: "#F0B90B", icon: Ticket },
          { label: "Confirmed", value: confirmedCount, color: "#00C853", icon: CheckCircle2 },
          { label: "Pending", value: pendingCount, color: "#F0B90B", icon: Clock },
          { label: "Confirmed TVL", value: `${totalValue.toFixed(4)} BNB`, color: "#F0B90B", icon: Users },
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
              <Badge className="bg-[#2A2A2A] text-[#999] text-xs ml-2">{total} total</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#F0B90B]" /></div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-12">
                <Ticket className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
                <p className="text-[#999]">No receipt tokens minted yet</p>
                <p className="text-xs text-[#666] mt-1">Receipts are generated when users deposit into pools</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                      <TableHead className="text-[#999]">Token ID</TableHead>
                      <TableHead className="text-[#999]">Holder</TableHead>
                      <TableHead className="text-[#999]">Pool</TableHead>
                      <TableHead className="text-[#999]">Amount</TableHead>
                      <TableHead className="text-[#999]">Minted</TableHead>
                      <TableHead className="text-[#999]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((r) => {
                      const st = statusConfig[r.status] || statusConfig.PENDING;
                      const StIcon = st.icon;
                      const isBTC = r.poolSymbol === "BTCB" || r.poolSymbol === "BTC";
                      return (
                        <TableRow key={r.id} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                          <TableCell className="font-mono text-xs text-[#F0B90B] font-semibold">{r.tokenId}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-mono text-xs text-white">{shortAddr(r.holder)}</p>
                              {r.holderName && <p className="text-[10px] text-[#666]">{r.holderName}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-xs text-white">{r.poolName}</p>
                              <Badge className={`text-[10px] mt-0.5 ${isBTC ? "bg-[#F7931A]/10 text-[#F7931A]" : "bg-[#627EEA]/10 text-[#627EEA]"}`}>{r.poolSymbol}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-white">{r.amount.toFixed(4)} BNB</TableCell>
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
      </div>
    </div>
  );
}
