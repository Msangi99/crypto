"use client";

import { useState, useCallback, useEffect } from "react";
import {
  CreditCard, Search, Loader2, ArrowUpRight, ArrowDownRight,
  CheckCircle2, Clock, XCircle, Download, RefreshCw, Eye,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatsCard } from "@/components/stats-card";
import { api } from "@/lib/api";

interface Payment {
  id: string;
  userId: string;
  type: string;
  amount: number;
  txHash: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; walletAddress: string; username: string | null };
}

function shortTx(hash: string | null) {
  if (!hash) return "—";
  return `${hash.slice(0, 10)}...${hash.slice(-4)}`;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [viewPayment, setViewPayment] = useState<Payment | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const typeParam = typeFilter !== "ALL" ? typeFilter : undefined;
      const statusParam = statusFilter !== "ALL" ? statusFilter : undefined;
      const res = await api.getAdminTransactions(page, limit, typeParam, statusParam);
      setPayments(res.transactions);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load payments:", err);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, statusFilter]);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [typeFilter, statusFilter]);

  const totalPages = Math.ceil(total / limit);

  // Client-side search filter on loaded results
  const filtered = search
    ? payments.filter((p) => {
        const q = search.toLowerCase();
        return (
          p.user.walletAddress.toLowerCase().includes(q) ||
          (p.txHash && p.txHash.toLowerCase().includes(q)) ||
          p.id.toLowerCase().includes(q)
        );
      })
    : payments;

  const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle2 }> = {
    SUCCESS: { color: "text-[#00C853]", bg: "bg-[#00C853]/10", icon: CheckCircle2 },
    PENDING: { color: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10", icon: Clock },
    FAILED: { color: "text-[#FF3D57]", bg: "bg-[#FF3D57]/10", icon: XCircle },
  };

  const typeConfig: Record<string, { label: string; icon: typeof ArrowUpRight }> = {
    DEPOSIT: { label: "Deposit", icon: ArrowDownRight },
    WITHDRAWAL: { label: "Withdrawal", icon: ArrowUpRight },
    REWARD: { label: "Reward", icon: CheckCircle2 },
    REFERRAL_BONUS: { label: "Referral", icon: CheckCircle2 },
    FEE: { label: "Fee", icon: CreditCard },
  };

  const totalDeposits = payments.filter((p) => p.type === "DEPOSIT" && p.status === "SUCCESS").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalWithdrawals = payments.filter((p) => p.type === "WITHDRAWAL" && p.status === "SUCCESS").reduce((sum, p) => sum + Number(p.amount), 0);
  const totalReferrals = payments.filter((p) => p.type === "REFERRAL_BONUS" && p.status === "SUCCESS").reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingCount = payments.filter((p) => p.status === "PENDING").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Payment Management</h2>
        <p className="text-sm text-[#888] mt-1">View all deposits, withdrawals, rewards, referral bonuses, and platform fees</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Deposits" value={`${totalDeposits.toFixed(2)} BNB`} icon={ArrowDownRight} color="green" />
        <StatsCard title="Total Withdrawals" value={`${totalWithdrawals.toFixed(2)} BNB`} icon={ArrowUpRight} color="gold" />
        <StatsCard title="Referral Payouts" value={`${totalReferrals.toFixed(2)} BNB`} icon={CheckCircle2} color="blue" />
        <StatsCard title="Pending" value={pendingCount} icon={Clock} color="red" />
      </div>

      {/* Filters */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-50">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
              <input
                type="text"
                placeholder="Search wallet, tx hash, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] pl-9 pr-3 text-sm text-white placeholder:text-[#666] focus:outline-none focus:ring-1 focus:ring-[#F0B90B]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 text-sm text-white"
            >
              <option value="ALL">All Status</option>
              <option value="SUCCESS">Success</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 text-sm text-white"
            >
              <option value="ALL">All Types</option>
              <option value="DEPOSIT">Deposits</option>
              <option value="WITHDRAWAL">Withdrawals</option>
              <option value="REWARD">Rewards</option>
              <option value="REFERRAL_BONUS">Referral Bonuses</option>
              <option value="FEE">Platform Fees</option>
            </select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearch(""); setStatusFilter("ALL"); setTypeFilter("ALL"); }}
              className="border-[#2A2A2A] text-[#999] hover:text-white hover:bg-[#2A2A2A]"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#F0B90B]" />
              Payment History
              <Badge className="bg-[#2A2A2A] text-[#999] text-xs ml-2">{total} total</Badge>
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#F0B90B]" /></div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
              <p className="text-[#999]">No transactions found</p>
              <p className="text-xs text-[#666] mt-1">Transactions appear when users interact with pools</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                    <TableHead className="text-[#999]">Type</TableHead>
                    <TableHead className="text-[#999]">Amount</TableHead>
                    <TableHead className="text-[#999]">User</TableHead>
                    <TableHead className="text-[#999]">Tx Hash</TableHead>
                    <TableHead className="text-[#999]">Status</TableHead>
                    <TableHead className="text-[#999]">Date</TableHead>
                    <TableHead className="text-[#999]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((payment) => {
                    const st = statusConfig[payment.status] || statusConfig.PENDING;
                    const tp = typeConfig[payment.type] || typeConfig.DEPOSIT;
                    const StIcon = st.icon;
                    const TpIcon = tp.icon;
                    return (
                      <TableRow key={payment.id} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <TpIcon className="w-3.5 h-3.5 text-[#999]" />
                            <span className="text-xs text-white">{tp.label}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-white">{Number(payment.amount).toFixed(4)} BNB</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-mono text-xs text-[#F0B90B]">{shortAddr(payment.user.walletAddress)}</p>
                            {payment.user.username && <p className="text-[10px] text-[#666]">{payment.user.username}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-[#666]">
                          {payment.txHash ? (
                            <a href={`https://testnet.bscscan.com/tx/${payment.txHash}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#F0B90B] hover:underline">
                              {shortTx(payment.txHash)}
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${st.bg} ${st.color} gap-1`}>
                            <StIcon className="w-3 h-3" /> {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-[#999]">{new Date(payment.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <button onClick={() => setViewPayment(payment)} className="p-1.5 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-white" title="View details">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Payment Dialog */}
      <Dialog open={!!viewPayment} onOpenChange={() => setViewPayment(null)}>
        <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#F0B90B]" />
              Transaction Details
            </DialogTitle>
          </DialogHeader>
          {viewPayment && (
            <div className="space-y-3 mt-2">
              {[
                { label: "Type", value: viewPayment.type },
                { label: "Amount", value: `${Number(viewPayment.amount).toFixed(4)} BNB` },
                { label: "User", value: viewPayment.user.walletAddress },
                { label: "From", value: viewPayment.fromAddress || "—" },
                { label: "To", value: viewPayment.toAddress || "—" },
                { label: "Transaction Hash", value: viewPayment.txHash || "—" },
                { label: "Status", value: viewPayment.status },
                { label: "Date", value: new Date(viewPayment.createdAt).toLocaleString() },
              ].map((item) => (
                <div key={item.label} className="flex justify-between p-2.5 rounded bg-[#0D0D0D]">
                  <span className="text-xs text-[#999]">{item.label}</span>
                  <span className="text-xs text-white font-mono truncate max-w-62.5">{item.value}</span>
                </div>
              ))}
              {viewPayment.metadata && Object.keys(viewPayment.metadata).length > 0 && (
                <div className="p-3 rounded bg-[#0D0D0D] space-y-2">
                  <p className="text-xs text-[#888] font-medium uppercase">Metadata</p>
                  {Object.entries(viewPayment.metadata).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-xs text-[#999]">{k}</span>
                      <span className="text-xs text-white">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
              {viewPayment.txHash && (
                <a
                  href={`https://testnet.bscscan.com/tx/${viewPayment.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full p-3 rounded-lg bg-[#F0B90B]/10 text-[#F0B90B] text-sm font-medium hover:bg-[#F0B90B]/20 transition-colors"
                >
                  <ArrowUpRight className="w-4 h-4" /> View on BscScan
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
