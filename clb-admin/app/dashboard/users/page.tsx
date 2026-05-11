"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Loader2,
  Shield,
  UserCheck,
  UserX,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Settings2,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatsCard } from "@/components/stats-card";
import { api } from "@/lib/api";
import { toast } from "sonner";

const PAGE_SIZE = 15;

interface User {
  id: string;
  walletAddress: string;
  username: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  depositCreditUsd: number;
  claimedPoolCreditUsd: number;
  swapHoldingsUsd: number;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function fmtUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [viewUser, setViewUser] = useState<User | null>(null);
  /** Prevents double-submit; tracks which row + action is in flight */
  const [pendingAction, setPendingAction] = useState<
    { userId: string; kind: "toggle" | "delete" } | null
  >(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminUsers(page, PAGE_SIZE, search);
      setUsers(res.users as User[]);
      setTotalUsers(res.total ?? res.users.length);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleActive = async (user: User) => {
    setPendingAction({ userId: user.id, kind: "toggle" });
    try {
      await api.updateAdminUser(user.id, { isActive: !user.isActive });
      toast.success(`User ${user.isActive ? "deactivated" : "activated"}`);
      if (viewUser?.id === user.id) setViewUser({ ...user, isActive: !user.isActive });
      loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update user status");
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user ${user.walletAddress}? This cannot be undone.`)) return;
    setPendingAction({ userId: user.id, kind: "delete" });
    try {
      await api.deleteAdminUser(user.id);
      toast.success("User deleted");
      setViewUser((v) => (v?.id === user.id ? null : v));
      loadUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete user");
    } finally {
      setPendingAction(null);
    }
  };

  const activeUsers = users.filter((u) => u.isActive).length;
  const adminUsers = users.filter((u) => u.role === "ADMIN").length;
  const hasNextPage = page * PAGE_SIZE < totalUsers;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">User Management</h2>
        <p className="text-sm text-[#888] mt-1">
          Click the settings icon (⚙) for the{" "}
          <strong className="text-[#ccc] font-medium">full page</strong> - overview, deposit /
          loan / mining, referrals, and all activity.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Total Users" value={totalUsers} icon={Users} color="blue" />
        <StatsCard title="Active Users" value={activeUsers} icon={UserCheck} color="green" />
        <StatsCard title="Admins" value={adminUsers} icon={Shield} color="gold" />
      </div>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-[#F0B90B]" /> All Users
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
              <input
                type="text"
                placeholder="Search wallet or username..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-64 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] pl-9 pr-3 text-sm text-white placeholder:text-[#666] focus:outline-none focus:ring-1 focus:ring-[#F0B90B]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#F0B90B]" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
              <p className="text-[#999]">No users found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                      <TableHead className="text-[#999]">Wallet</TableHead>
                      <TableHead className="text-[#999]">Username</TableHead>
                      <TableHead className="text-[#999] hidden md:table-cell">Email</TableHead>
                      <TableHead className="text-[#999] text-right">
                        <span className="inline-flex items-center gap-1 justify-end">
                          <Banknote className="w-3 h-3 text-[#F0B90B]" /> Deposit
                        </span>
                      </TableHead>
                      <TableHead className="text-[#999] text-right hidden lg:table-cell">Loan</TableHead>
                      <TableHead className="text-[#999] text-right hidden lg:table-cell">Swap</TableHead>
                      <TableHead className="text-[#999]">Role</TableHead>
                      <TableHead className="text-[#999]">Status</TableHead>
                      <TableHead className="text-[#999] hidden sm:table-cell">Joined</TableHead>
                      <TableHead className="text-[#999] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                        <TableCell className="font-mono text-xs text-[#F0B90B] whitespace-nowrap">
                          {shortAddr(user.walletAddress)}
                        </TableCell>
                        <TableCell className="text-white text-sm">{user.username || "—"}</TableCell>
                        <TableCell className="text-[#999] text-sm hidden md:table-cell max-w-[140px] truncate">
                          {user.email || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono text-[#FCD535]">
                          ${fmtUsd(Number(user.depositCreditUsd) || 0)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono text-emerald-400/90 hidden lg:table-cell">
                          ${fmtUsd(Number(user.claimedPoolCreditUsd) || 0)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono text-violet-300/90 hidden lg:table-cell">
                          ${fmtUsd(Number(user.swapHoldingsUsd) || 0)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              user.role === "ADMIN"
                                ? "bg-[#F0B90B]/10 text-[#F0B90B]"
                                : "bg-[#3B82F6]/10 text-[#3B82F6]"
                            }
                          >
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              user.isActive
                                ? "bg-[#00C853]/10 text-[#00C853]"
                                : "bg-[#FF3D57]/10 text-[#FF3D57]"
                            }
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-[#666] hidden sm:table-cell whitespace-nowrap">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5 flex-wrap">
                            <Link
                              href={`/dashboard/users/${user.id}`}
                              className={`p-1.5 rounded-md hover:bg-[#F0B90B]/15 text-[#F0B90B] ring-1 ring-transparent hover:ring-[#F0B90B]/30 ${pendingAction ? "pointer-events-none opacity-50" : ""}`}
                              title="Full page - overview, balances, loans, mining, referrals, activity"
                              aria-disabled={!!pendingAction}
                            >
                              <Settings2 className="w-3.5 h-3.5" />
                            </Link>
                            <button
                              type="button"
                              disabled={!!pendingAction}
                              onClick={() => setViewUser(user)}
                              className="p-1.5 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-white disabled:opacity-40 disabled:pointer-events-none"
                              title="Quick view"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={pendingAction?.userId === user.id}
                              onClick={() => handleToggleActive(user)}
                              className={`p-1.5 rounded-md disabled:opacity-40 disabled:pointer-events-none ${user.isActive ? "hover:bg-[#FF3D57]/10 text-[#999] hover:text-[#FF3D57]" : "hover:bg-[#00C853]/10 text-[#999] hover:text-[#00C853]"}`}
                              title={user.isActive ? "Deactivate" : "Activate"}
                            >
                              {pendingAction?.userId === user.id && pendingAction.kind === "toggle" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : user.isActive ? (
                                <UserX className="w-3.5 h-3.5" />
                              ) : (
                                <UserCheck className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              disabled={pendingAction?.userId === user.id}
                              onClick={() => handleDelete(user)}
                              className="p-1.5 rounded-md hover:bg-[#FF3D57]/10 text-[#999] hover:text-[#FF3D57] disabled:opacity-40 disabled:pointer-events-none"
                              title="Delete"
                            >
                              {pendingAction?.userId === user.id && pendingAction.kind === "delete" ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalUsers > PAGE_SIZE && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                    className="border-[#2A2A2A] text-[#999]"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-[#999]">
                    Page {page} of {Math.max(1, Math.ceil(totalUsers / PAGE_SIZE))}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasNextPage}
                    onClick={() => setPage(page + 1)}
                    className="border-[#2A2A2A] text-[#999]"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!viewUser}
        onOpenChange={(open) => {
          if (!open) setViewUser(null);
        }}
      >
        <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick summary</DialogTitle>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-3 mt-2">
              {(
                [
                  { label: "ID", value: viewUser.id },
                  { label: "Wallet", value: viewUser.walletAddress },
                  { label: "Username", value: viewUser.username || "—" },
                  { label: "Email", value: viewUser.email || "—" },
                  { label: "Deposit credit (USD)", value: `$${fmtUsd(viewUser.depositCreditUsd)}` },
                  { label: "Loan credit (USD)", value: `$${fmtUsd(viewUser.claimedPoolCreditUsd)}` },
                  { label: "Swap (USD)", value: `$${fmtUsd(viewUser.swapHoldingsUsd)}` },
                  { label: "Role", value: viewUser.role },
                  { label: "Status", value: viewUser.isActive ? "Active" : "Inactive" },
                  { label: "Joined", value: new Date(viewUser.createdAt).toLocaleString() },
                ] as const
              ).map((item) => (
                <div key={item.label} className="flex justify-between gap-2 p-2.5 rounded bg-[#0D0D0D]">
                  <span className="text-xs text-[#999] shrink-0">{item.label}</span>
                  <span className="text-xs text-white font-mono truncate text-right">{item.value}</span>
                </div>
              ))}
              <Link
                href={`/dashboard/users/${viewUser.id}`}
                className="flex h-10 w-full items-center justify-center rounded-md bg-[#F0B90B] text-[#0D0D0D] text-sm font-semibold hover:bg-[#FCD535]"
              >
                Open full management
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
