"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, Loader2, ArrowUpRight, ArrowDownLeft, Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  fromAddress: string | null;
  toAddress: string | null;
  txHash: string | null;
  status: string;
  createdAt: string;
}

const typeIcons: Record<string, typeof ArrowUpRight> = {
  DEPOSIT: ArrowDownLeft,
  WITHDRAWAL: ArrowUpRight,
  REFERRAL_BONUS: Gift,
};

const typeColors: Record<string, string> = {
  DEPOSIT: "text-[#00C853]",
  WITHDRAWAL: "text-[#FF3D57]",
  REFERRAL_BONUS: "text-[#F0B90B]",
};

const statusColors: Record<string, string> = {
  SUCCESS: "bg-[#00C853]/10 text-[#00C853] border-[#00C853]/20",
  PENDING: "bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20",
  FAILED: "bg-[#FF3D57]/10 text-[#FF3D57] border-[#FF3D57]/20",
};

function shortAddr(addr: string | null) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadTransactions = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.getTransactions(p, 20);
      setTransactions(res.transactions);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTransactions(page); }, [page]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Transactions</h2>
        <p className="text-[#999] mt-1">All deposits, withdrawals, and referral bonuses</p>
      </div>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-[#F0B90B]" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#F0B90B]" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-12">
              <ArrowLeftRight className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
              <p className="text-[#999]">No transactions yet</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                    <TableHead className="text-[#999]">Type</TableHead>
                    <TableHead className="text-[#999]">Amount</TableHead>
                    <TableHead className="text-[#999]">From</TableHead>
                    <TableHead className="text-[#999]">To</TableHead>
                    <TableHead className="text-[#999]">Tx Hash</TableHead>
                    <TableHead className="text-[#999]">Status</TableHead>
                    <TableHead className="text-[#999]">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const Icon = typeIcons[tx.type] || ArrowLeftRight;
                    const color = typeColors[tx.type] || "text-[#999]";
                    return (
                      <TableRow key={tx.id} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                        <TableCell>
                          <span className={`flex items-center gap-2 ${color}`}>
                            <Icon className="w-4 h-4" />
                            {tx.type}
                          </span>
                        </TableCell>
                        <TableCell className="text-white font-medium">{tx.amount} BNB</TableCell>
                        <TableCell className="font-mono text-xs text-[#999]">{shortAddr(tx.fromAddress)}</TableCell>
                        <TableCell className="font-mono text-xs text-[#999]">{shortAddr(tx.toAddress)}</TableCell>
                        <TableCell>
                          {tx.txHash ? (
                            <a
                              href={`https://testnet.bscscan.com/tx/${tx.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-[#F0B90B] hover:underline"
                            >
                              {tx.txHash.slice(0, 10)}...
                            </a>
                          ) : (
                            <span className="text-xs text-[#666]">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[tx.status] || "bg-[#2A2A2A] text-[#999]"}>
                            {tx.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-[#666]">
                          {new Date(tx.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="border-[#2A2A2A] text-[#999]">
                    Previous
                  </Button>
                  <span className="text-sm text-[#999]">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="border-[#2A2A2A] text-[#999]">
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
