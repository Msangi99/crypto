"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Withdrawal = {
  id: string;
  token: string;
  amount: number;
  fee: number;
  toAddress: string;
  status: string;
  txHash: string | null;
  createdAt: string;
  processedAt: string | null;
  user: {
    id: string;
    walletAddress: string;
    username: string | null;
    email: string | null;
  };
};

const STATUS_FILTER = ["ALL", "PENDING", "COMPLETED", "REJECTED", "FAILED"] as const;

function statusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge variant="outline" className="border-yellow-500/40 text-yellow-400 bg-yellow-500/10"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    case "COMPLETED":
      return <Badge variant="outline" className="border-green-500/40 text-green-400 bg-green-500/10"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
    case "REJECTED":
      return <Badge variant="outline" className="border-red-500/40 text-red-400 bg-red-500/10"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
    case "FAILED":
      return <Badge variant="outline" className="border-red-500/40 text-red-400 bg-red-500/10"><AlertTriangle className="w-3 h-3 mr-1" />Failed</Badge>;
    case "PROCESSING":
      return <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/10"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function shortAddr(a: string) {
  if (!a || a.length < 12) return a || "—";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}

export default function WithdrawalsPage() {
  const [loading, setLoading] = useState(true);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const [approveDialog, setApproveDialog] = useState<Withdrawal | null>(null);
  const [approveTxHash, setApproveTxHash] = useState("");
  const [approving, setApproving] = useState(false);

  const [rejectDialog, setRejectDialog] = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const load = useCallback(async (currentPage = 1) => {
    setLoading(true);
    try {
      const status = statusFilter === "ALL" ? undefined : statusFilter;
      const res = await api.getAdminWithdrawals(currentPage, limit, status);
      setWithdrawals(res.withdrawals || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load withdrawals");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit, statusFilter]);

  useEffect(() => {
    load(page);
  }, [page, statusFilter, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(page);
  };

  const totalPages = Math.ceil(total / limit);
  const pendingCount = withdrawals.filter((w) => w.status === "PENDING").length;

  const handleApprove = async () => {
    if (!approveDialog) return;
    setApproving(true);
    try {
      await api.approveWithdrawal(approveDialog.id, approveTxHash || undefined);
      toast.success("Withdrawal approved");
      setApproveDialog(null);
      setApproveTxHash("");
      load(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialog) return;
    setRejecting(true);
    try {
      await api.rejectWithdrawal(rejectDialog.id, rejectReason || undefined);
      toast.success("Withdrawal rejected");
      setRejectDialog(null);
      setRejectReason("");
      load(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Withdrawals</h1>
          <p className="text-sm text-[#999] mt-1">
            Review and manually process user withdrawal requests.
            {pendingCount > 0 && (
              <span className="ml-2 text-yellow-400 font-semibold">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          className="border-[#2A2A2A] text-[#999] hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTER.map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? "default" : "outline"}
            size="sm"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={
              statusFilter === s
                ? "bg-[#F0B90B] text-black hover:bg-[#F0B90B]/90"
                : "border-[#2A2A2A] text-[#999] hover:text-white"
            }
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      <Card className="bg-[#111] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg">
            Withdrawal Requests
            <span className="text-sm font-normal text-[#666] ml-2">({total})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#F0B90B]" />
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="text-center py-16 text-[#666]">No withdrawal requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A2A2A] text-[#666] text-xs uppercase">
                    <th className="text-left py-3 px-2">User</th>
                    <th className="text-left py-3 px-2">Token</th>
                    <th className="text-right py-3 px-2">Amount</th>
                    <th className="text-right py-3 px-2">Fee</th>
                    <th className="text-right py-3 px-2">Net</th>
                    <th className="text-left py-3 px-2">To Address</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-left py-3 px-2">Date</th>
                    <th className="text-right py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A]/50">
                      <td className="py-3 px-2">
                        <div className="text-white font-medium text-xs">
                          {w.user.username || shortAddr(w.user.walletAddress)}
                        </div>
                        {w.user.email && (
                          <div className="text-[#666] text-xs">{w.user.email}</div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="border-[#333] text-[#ccc]">
                          {w.token}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-right text-white font-mono">
                        {w.amount.toFixed(4)}
                      </td>
                      <td className="py-3 px-2 text-right text-[#666] font-mono">
                        {w.fee.toFixed(4)}
                      </td>
                      <td className="py-3 px-2 text-right text-green-400 font-mono font-semibold">
                        {(w.amount - w.fee).toFixed(4)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          <code className="text-xs text-[#ccc] bg-[#1A1A1A] px-2 py-1 rounded">
                            {shortAddr(w.toAddress)}
                          </code>
                          <button
                            onClick={() => copyText(w.toAddress)}
                            className="p-1 hover:bg-[#2A2A2A] rounded transition-colors"
                            title="Copy full address"
                          >
                            <Copy className="w-3 h-3 text-[#666] hover:text-white" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-2">{statusBadge(w.status)}</td>
                      <td className="py-3 px-2 text-[#666] text-xs whitespace-nowrap">
                        {new Date(w.createdAt).toLocaleDateString()}
                        <br />
                        {new Date(w.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {w.status === "PENDING" ? (
                          <div className="flex gap-1 justify-end">
                            <Button
                              size="sm"
                              onClick={() => { setApproveDialog(w); setApproveTxHash(""); }}
                              className="bg-green-600 hover:bg-green-700 text-white text-xs h-7 px-2"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setRejectDialog(w); setRejectReason(""); }}
                              className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs h-7 px-2"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        ) : w.txHash ? (
                          <a
                            href={`https://bscscan.com/tx/${w.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#F0B90B] hover:underline text-xs inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            TxHash
                          </a>
                        ) : (
                          <span className="text-[#444] text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-[#2A2A2A]">
              <span className="text-xs text-[#666]">
                Page {page} of {totalPages} · {total} total
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="border-[#2A2A2A] text-[#999]"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="border-[#2A2A2A] text-[#999]"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={(open) => !open && setApproveDialog(null)}>
        <DialogContent className="bg-[#111] border-[#2A2A2A] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Approve Withdrawal</DialogTitle>
          </DialogHeader>
          {approveDialog && (
            <div className="space-y-4">
              <p className="text-sm text-[#999]">
                Send <strong className="text-white">{(approveDialog.amount - approveDialog.fee).toFixed(6)} {approveDialog.token}</strong> to the address below, then paste the transaction hash and confirm.
              </p>

              <div className="space-y-2">
                <Label className="text-[#999]">Recipient Address</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md px-3 py-2 text-sm text-white break-all select-all">
                    {approveDialog.toAddress}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(approveDialog.toAddress)}
                    className="border-[#2A2A2A] text-[#999] shrink-0"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A]">
                  <div className="text-[#666] text-xs mb-1">Gross Amount</div>
                  <div className="text-white font-mono font-semibold">{approveDialog.amount.toFixed(6)} {approveDialog.token}</div>
                </div>
                <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A]">
                  <div className="text-[#666] text-xs mb-1">Net (send this)</div>
                  <div className="text-green-400 font-mono font-semibold">{(approveDialog.amount - approveDialog.fee).toFixed(6)} {approveDialog.token}</div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[#999]">Transaction Hash (optional)</Label>
                <Input
                  placeholder="0x..."
                  value={approveTxHash}
                  onChange={(e) => setApproveTxHash(e.target.value)}
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white"
                />
                <p className="text-xs text-[#666]">
                  Paste the txHash after you send the funds. You can leave this empty and add it later.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)} className="border-[#2A2A2A] text-[#999]">
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={approving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {approving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => !open && setRejectDialog(null)}>
        <DialogContent className="bg-[#111] border-[#2A2A2A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Withdrawal</DialogTitle>
          </DialogHeader>
          {rejectDialog && (
            <div className="space-y-4">
              <p className="text-sm text-[#999]">
                Reject <strong className="text-white">{rejectDialog.amount.toFixed(4)} {rejectDialog.token}</strong> withdrawal
                for {rejectDialog.user.username || shortAddr(rejectDialog.user.walletAddress)}?
                The locked balance will be returned to the user.
              </p>
              <div className="space-y-2">
                <Label className="text-[#999]">Reason (optional)</Label>
                <Input
                  placeholder="e.g. Invalid address, suspicious activity..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)} className="border-[#2A2A2A] text-[#999]">
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={rejecting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {rejecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              Reject Withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
