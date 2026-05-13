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
  ArrowDownToLine,
  User,
  Search,
  Edit3,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Deposit = {
  id: string;
  amount: number;
  amountUsd: number;
  chain: string;
  fromAddress: string | null;
  toAddress: string | null;
  txHash: string | null;
  status: string;
  confirmations: number;
  confirmedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    walletAddress: string;
    username: string | null;
    email: string | null;
  };
  pool: { id: string; name: string; tokenSymbol: string } | null;
};

const STATUS_FILTER = ["ALL", "PENDING", "CONFIRMING", "CONFIRMED", "FAILED", "REFUNDED"] as const;
const DEPOSIT_STATUSES = ["PENDING", "CONFIRMING", "CONFIRMED", "FAILED", "REFUNDED"] as const;

function statusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge variant="outline" className="border-yellow-500/40 text-yellow-400 bg-yellow-500/10"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    case "CONFIRMING":
      return <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/10"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Confirming</Badge>;
    case "CONFIRMED":
      return <Badge variant="outline" className="border-green-500/40 text-green-400 bg-green-500/10"><CheckCircle2 className="w-3 h-3 mr-1" />Confirmed</Badge>;
    case "FAILED":
      return <Badge variant="outline" className="border-red-500/40 text-red-400 bg-red-500/10"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
    case "REFUNDED":
      return <Badge variant="outline" className="border-orange-500/40 text-orange-400 bg-orange-500/10"><AlertTriangle className="w-3 h-3 mr-1" />Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function shortAddr(a: string | null | undefined) {
  if (!a || a.length < 12) return a || "—";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}

export default function DepositRequestsPage() {
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Edit dialog state
  const [editDialog, setEditDialog] = useState<Deposit | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editTxHash, setEditTxHash] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (currentPage = 1) => {
    setLoading(true);
    try {
      const status = statusFilter === "ALL" ? undefined : statusFilter;
      const res = await api.getAdminDeposits(currentPage, limit, status, search || undefined);
      setDeposits(res.deposits || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load deposits");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [limit, statusFilter, search]);

  useEffect(() => {
    load(page);
  }, [page, statusFilter, search, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(page);
  };

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const totalPages = Math.ceil(total / limit);
  const pendingCount = deposits.filter((d) => d.status === "PENDING").length;

  const openEditDialog = (deposit: Deposit) => {
    setEditDialog(deposit);
    setEditStatus(deposit.status);
    setEditTxHash(deposit.txHash || "");
  };

  const handleSave = async () => {
    if (!editDialog) return;
    setSaving(true);
    try {
      const payload: { status?: string; txHash?: string | null } = {};
      if (editStatus !== editDialog.status) payload.status = editStatus;
      if (editTxHash !== (editDialog.txHash || "")) {
        payload.txHash = editTxHash.trim() || null;
      }
      if (!payload.status && payload.txHash === undefined) {
        toast.info("No changes to save");
        setSaving(false);
        return;
      }
      await api.updateDepositStatus(editDialog.id, payload);
      toast.success("Deposit updated successfully");
      setEditDialog(null);
      load(page);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update deposit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <ArrowDownToLine className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Deposit Requests</h1>
            <p className="text-sm text-[#999] mt-0.5">
              View and manage all deposit transactions.
              {pendingCount > 0 && (
                <span className="ml-2 text-yellow-400 font-semibold">
                  {pendingCount} pending
                </span>
              )}
            </p>
          </div>
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

      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
          <Input
            placeholder="Search by address, tx hash, or wallet…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="bg-[#1A1A1A] border-[#2A2A2A] text-white pl-10"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSearch}
          className="border-[#2A2A2A] text-[#999] hover:text-white"
        >
          Search
        </Button>
        {search && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }}
            className="border-[#2A2A2A] text-[#999] hover:text-white"
          >
            Clear
          </Button>
        )}
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
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "border-[#2A2A2A] text-[#999] hover:text-white"
            }
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      <Card className="bg-[#111] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            Deposit Requests
            <Badge variant="outline" className="border-blue-500/40 text-blue-400 bg-blue-500/10 text-xs font-normal">
              {total} total
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : deposits.length === 0 ? (
            <div className="text-center py-16 text-[#666]">No deposit requests found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2A2A2A] text-[#666] text-xs uppercase">
                    <th className="text-left py-3 px-2">User</th>
                    <th className="text-right py-3 px-2">Amount</th>
                    <th className="text-left py-3 px-2">Chain</th>
                    <th className="text-left py-3 px-2">From Address</th>
                    <th className="text-left py-3 px-2">To Address</th>
                    <th className="text-left py-3 px-2">Tx Hash</th>
                    <th className="text-left py-3 px-2">Status</th>
                    <th className="text-left py-3 px-2">Date</th>
                    <th className="text-right py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => (
                    <tr key={d.id} className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A]/50">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-[#666]" />
                          </div>
                          <div>
                            <div className="text-white font-medium text-xs">
                              {d.user.username || "Anonymous"}
                            </div>
                            {d.user.email && (
                              <div className="text-[#666] text-xs">{d.user.email}</div>
                            )}
                            <div className="flex items-center gap-1">
                              <code className="text-[10px] text-[#777]">{shortAddr(d.user.walletAddress)}</code>
                              <button
                                onClick={() => copyText(d.user.walletAddress)}
                                className="p-0.5 hover:bg-[#2A2A2A] rounded transition-colors"
                              >
                                <Copy className="w-2.5 h-2.5 text-[#666] hover:text-white" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="text-white font-mono">{d.amount.toFixed(4)}</div>
                        {d.amountUsd > 0 && (
                          <div className="text-[#666] text-xs font-mono">${d.amountUsd.toFixed(2)}</div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline" className="border-[#2A2A2A] text-[#999] text-xs">
                          {d.chain}
                        </Badge>
                        {d.pool && (
                          <div className="text-[#666] text-xs mt-0.5">{d.pool.tokenSymbol}</div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {d.fromAddress ? (
                          <div className="flex items-center gap-1">
                            <code className="text-xs text-[#ccc] bg-[#1A1A1A] px-1.5 py-0.5 rounded">
                              {shortAddr(d.fromAddress)}
                            </code>
                            <button
                              onClick={() => copyText(d.fromAddress!)}
                              className="p-0.5 hover:bg-[#2A2A2A] rounded transition-colors"
                            >
                              <Copy className="w-3 h-3 text-[#666] hover:text-white" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#444] text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {d.toAddress ? (
                          <div className="flex items-center gap-1">
                            <code className="text-xs text-[#ccc] bg-[#1A1A1A] px-1.5 py-0.5 rounded">
                              {shortAddr(d.toAddress)}
                            </code>
                            <button
                              onClick={() => copyText(d.toAddress!)}
                              className="p-0.5 hover:bg-[#2A2A2A] rounded transition-colors"
                            >
                              <Copy className="w-3 h-3 text-[#666] hover:text-white" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[#444] text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {d.txHash ? (
                          <div className="flex items-center gap-1">
                            <code className="text-xs text-[#ccc] bg-[#1A1A1A] px-1.5 py-0.5 rounded">
                              {shortAddr(d.txHash)}
                            </code>
                            <button
                              onClick={() => copyText(d.txHash!)}
                              className="p-0.5 hover:bg-[#2A2A2A] rounded transition-colors"
                              title="Copy tx hash"
                            >
                              <Copy className="w-3 h-3 text-[#666] hover:text-white" />
                            </button>
                            <a
                              href={`https://bscscan.com/tx/${d.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-0.5 hover:bg-[#2A2A2A] rounded transition-colors"
                              title="View on BscScan"
                            >
                              <ExternalLink className="w-3 h-3 text-blue-400 hover:text-blue-300" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-[#444] text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {statusBadge(d.status)}
                        {d.confirmations > 0 && (
                          <div className="text-[#666] text-xs mt-0.5">{d.confirmations} conf.</div>
                        )}
                      </td>
                      <td className="py-3 px-2 text-[#666] text-xs whitespace-nowrap">
                        {new Date(d.createdAt).toLocaleDateString()}
                        <br />
                        {new Date(d.createdAt).toLocaleTimeString()}
                        {d.confirmedAt && (
                          <>
                            <br />
                            <span className="text-green-500">
                              ✓ {new Date(d.confirmedAt).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(d)}
                          className="border-[#2A2A2A] text-[#999] hover:text-white hover:border-blue-500/40 text-xs h-7 px-2"
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          Update
                        </Button>
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

      {/* Edit Deposit Dialog */}
      <Dialog open={!!editDialog} onOpenChange={(open) => !open && setEditDialog(null)}>
        <DialogContent className="bg-[#111] border-[#2A2A2A] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Deposit</DialogTitle>
          </DialogHeader>
          {editDialog && (
            <div className="space-y-4">
              <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A]">
                <div className="text-[#666] text-xs mb-1">Depositor</div>
                <div className="text-white text-sm font-medium">
                  {editDialog.user.username || "Anonymous"}
                  {editDialog.user.email && (
                    <span className="text-[#666] font-normal ml-2">({editDialog.user.email})</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <code className="text-xs text-[#999]">{shortAddr(editDialog.user.walletAddress)}</code>
                  <button onClick={() => copyText(editDialog.user.walletAddress)} className="p-0.5 hover:bg-[#2A2A2A] rounded">
                    <Copy className="w-3 h-3 text-[#666]" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A]">
                  <div className="text-[#666] text-xs mb-1">Amount</div>
                  <div className="text-white font-mono font-semibold">{editDialog.amount.toFixed(4)}</div>
                  {editDialog.amountUsd > 0 && (
                    <div className="text-[#666] text-xs font-mono">${editDialog.amountUsd.toFixed(2)} USD</div>
                  )}
                </div>
                <div className="bg-[#1A1A1A] rounded-lg p-3 border border-[#2A2A2A]">
                  <div className="text-[#666] text-xs mb-1">Chain</div>
                  <div className="text-white font-mono font-semibold">{editDialog.chain}</div>
                  {editDialog.pool && (
                    <div className="text-[#666] text-xs">{editDialog.pool.name}</div>
                  )}
                </div>
              </div>

              {editDialog.fromAddress && (
                <div className="space-y-1">
                  <Label className="text-[#999] text-xs">From Address</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md px-3 py-2 text-sm text-white break-all select-all">
                      {editDialog.fromAddress}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => copyText(editDialog.fromAddress!)} className="border-[#2A2A2A] text-[#999] shrink-0">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {editDialog.toAddress && (
                <div className="space-y-1">
                  <Label className="text-[#999] text-xs">To Address</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-[#1A1A1A] border border-[#2A2A2A] rounded-md px-3 py-2 text-sm text-white break-all select-all">
                      {editDialog.toAddress}
                    </code>
                    <Button variant="outline" size="sm" onClick={() => copyText(editDialog.toAddress!)} className="border-[#2A2A2A] text-[#999] shrink-0">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-[#999]">Status</Label>
                <Select value={editStatus} onValueChange={(v) => v && setEditStatus(v)}>
                  <SelectTrigger className="bg-[#1A1A1A] border-[#2A2A2A] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                    {DEPOSIT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="text-white hover:bg-[#2A2A2A]">
                        {s.charAt(0) + s.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[#999]">Transaction Hash</Label>
                <Input
                  placeholder="0x..."
                  value={editTxHash}
                  onChange={(e) => setEditTxHash(e.target.value)}
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white"
                />
                <p className="text-xs text-[#666]">
                  The on-chain transaction hash for this deposit. Leave empty if not yet available.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)} className="border-[#2A2A2A] text-[#999]">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
