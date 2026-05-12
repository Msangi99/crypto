"use client";

import { useEffect, useState } from "react";
import { ArrowUpDown, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function DepositsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadDeposits = async (currentPage = 1) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/deposits?page=${currentPage}&limit=${limit}&search=${encodeURIComponent(search)}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("clb_token")}`,
            "Content-Type": "application/json",
          },
        }
      );
      const data = await res.json();
      if (res.ok) {
        setDeposits(data.deposits || []);
        setTotal(data.total || 0);
      } else {
        toast.error(data.error || "Failed to load deposits");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load deposits");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDeposits(page);
  }, [page, search]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDeposits(page);
  };

  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Deposits</h2>
          <p className="text-[#999] mt-1">View and manage all USDT treasury deposits</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535]"
        >
          {refreshing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-[#00C853]" />
            All Deposits
          </CardTitle>
          <CardDescription className="text-[#999]">
            Total: {total} deposits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search by wallet address or tx hash..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="bg-[#0D0D0D] border-[#2A2A2A]"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#F0B90B]" />
            </div>
          ) : deposits.length === 0 ? (
            <div className="text-center py-12 text-[#666]">No deposits found</div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-4 text-xs text-[#999] uppercase tracking-wide px-4 py-2">
                <div className="col-span-2">Date</div>
                <div className="col-span-2">User</div>
                <div className="col-span-2">Amount</div>
                <div className="col-span-2">From</div>
                <div className="col-span-2">To</div>
                <div className="col-span-2">Status</div>
              </div>
              {deposits.map((deposit) => (
                <div
                  key={deposit.id}
                  className="grid grid-cols-12 gap-4 items-center px-4 py-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]"
                >
                  <div className="col-span-2">
                    <div className="text-white text-sm">{formatDate(deposit.createdAt)}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[#F0B90B] text-sm font-mono">{formatAddress(deposit.user.walletAddress)}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-white text-sm font-semibold">${deposit.amount.toFixed(2)}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[#999] text-xs font-mono">{formatAddress(deposit.fromAddress)}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[#999] text-xs font-mono">{formatAddress(deposit.toAddress)}</div>
                  </div>
                  <div className="col-span-2">
                    <Badge
                      className={
                        deposit.status === "CONFIRMED"
                          ? "bg-[#00C853]/10 text-[#00C853] border-[#00C853]/20"
                          : deposit.status === "PENDING"
                          ? "bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20"
                          : "bg-[#FF4757]/10 text-[#FF4757] border-[#FF4757]/20"
                      }
                    >
                      {deposit.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#2A2A2A]">
              <Button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                variant="outline"
                className="bg-[#0D0D0D] border-[#2A2A2A] text-white hover:bg-[#1A1A1A]"
              >
                Previous
              </Button>
              <span className="text-[#999] text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                variant="outline"
                className="bg-[#0D0D0D] border-[#2A2A2A] text-white hover:bg-[#1A1A1A]"
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
