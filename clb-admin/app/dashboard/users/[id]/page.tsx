"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Banknote,
  TrendingUp,
  RefreshCw,
  Layers,
  Activity,
  Plus,
  Minus,
  Pencil,
  Save,
  Shield,
  User,
  Cpu,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, type AdminMiningPackage } from "@/lib/api";
import { toast } from "sonner";

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

type PoolMember = {
  id: string;
  joinedAt: string;
  share: unknown;
  pool: {
    id: string;
    name: string;
    tokenSymbol: string;
    status: string;
    minDeposit?: unknown;
    supportsAppCredit?: boolean;
    creditMinUsd?: unknown | null;
    creditCreditedUsd?: unknown | null;
  };
};

const LOAN_STATUSES = [
  "PENDING",
  "ACTIVE",
  "SETTLED",
  "LIQUIDATED",
  "CANCELLED",
  "REPAID",
  "MARGIN_CALL",
] as const;

function LoanRowEditor({
  userId,
  loan,
  onSaved,
}: {
  userId: string;
  loan: Record<string, unknown>;
  onSaved: () => void;
}) {
  const loanId = String(loan.id);
  const [loanAmount, setLoanAmount] = useState(String(num(loan.loanAmount)));
  const [drawnAmount, setDrawnAmount] = useState(String(num(loan.drawnAmount)));
  const [availableCredit, setAvailableCredit] = useState(String(num(loan.availableCredit)));
  const [interestRate, setInterestRate] = useState(String(num(loan.interestRate)));
  const [ltvPercent, setLtvPercent] = useState(String(num(loan.ltvPercent)));
  const [status, setStatus] = useState(String(loan.status ?? "PENDING"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoanAmount(String(num(loan.loanAmount)));
    setDrawnAmount(String(num(loan.drawnAmount)));
    setAvailableCredit(String(num(loan.availableCredit)));
    setInterestRate(String(num(loan.interestRate)));
    setLtvPercent(String(num(loan.ltvPercent)));
    setStatus(String(loan.status ?? "PENDING"));
  }, [loan]);

  const parseNonNeg = (s: string, label: string): number | null => {
    const n = Number(String(s).trim());
    if (!Number.isFinite(n) || n < 0) {
      toast.error(`${label} must be a non-negative number`);
      return null;
    }
    return n;
  };

  const saveLoan = async (e: FormEvent) => {
    e.preventDefault();
    const la = parseNonNeg(loanAmount, "Loan amount");
    const dr = parseNonNeg(drawnAmount, "Drawn amount");
    const ac = parseNonNeg(availableCredit, "Available credit");
    const ir = parseNonNeg(interestRate, "Interest rate");
    const ltv = parseNonNeg(ltvPercent, "LTV %");
    if (la === null || dr === null || ac === null || ir === null || ltv === null) return;

    setSaving(true);
    try {
      await api.updateAdminUserLoan(userId, loanId, {
        loanAmount: la,
        drawnAmount: dr,
        availableCredit: ac,
        interestRate: ir,
        ltvPercent: ltv,
        status,
      });
      toast.success("Loan updated");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update loan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={saveLoan}
      className="rounded-lg border border-[#2A2A2A] bg-[#0D0D0D] p-4 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-[#F0B90B]">
          {loanId.slice(0, 8)}… · {String(loan.loanType)}
        </span>
        <Badge
          className={
            loan.status === "ACTIVE"
              ? "bg-[#00C853]/10 text-[#00C853] text-[10px]"
              : "bg-[#666]/20 text-[#ccc] text-[10px]"
          }
        >
          {String(loan.status)}
        </Badge>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-[#888]">
        <div>
          Collateral: {String(loan.collateralChain)}{" "}
          <span className="text-white font-mono">{num(loan.collateralAmount)}</span>
        </div>
        <div>
          Collateral USD:{" "}
          <span className="text-white font-mono">{num(loan.collateralValueUsd)}</span>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] text-[#999]">Loan / limit (USD)</Label>
          <Input
            inputMode="decimal"
            value={loanAmount}
            onChange={(e) => setLoanAmount(e.target.value)}
            className="bg-[#111] border-[#333] text-white font-mono h-9 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[#999]">Drawn (USD)</Label>
          <Input
            inputMode="decimal"
            value={drawnAmount}
            onChange={(e) => setDrawnAmount(e.target.value)}
            className="bg-[#111] border-[#333] text-white font-mono h-9 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[#999]">Available credit</Label>
          <Input
            inputMode="decimal"
            value={availableCredit}
            onChange={(e) => setAvailableCredit(e.target.value)}
            className="bg-[#111] border-[#333] text-white font-mono h-9 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[#999]">Interest % (APR)</Label>
          <Input
            inputMode="decimal"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            className="bg-[#111] border-[#333] text-white font-mono h-9 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[#999]">LTV %</Label>
          <Input
            inputMode="decimal"
            value={ltvPercent}
            onChange={(e) => setLtvPercent(e.target.value)}
            className="bg-[#111] border-[#333] text-white font-mono h-9 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-[#999]">Status</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full h-9 rounded-md border border-[#333] bg-[#111] px-2 text-xs text-white"
          >
            {LOAN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={saving}
        className="bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535]"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save loan"}
      </Button>
    </form>
  );
}

type TxRow = {
  id: string;
  type: string;
  amount: unknown;
  status: string;
  txHash: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [depositStr, setDepositStr] = useState("0");
  const [loanStr, setLoanStr] = useState("0");
  const [swapStr, setSwapStr] = useState("0");
  const [savingCredits, setSavingCredits] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ username: "", email: "", role: "USER" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [miningPackages, setMiningPackages] = useState<AdminMiningPackage[]>([]);
  const [miningPackageId, setMiningPackageId] = useState("");
  const [miningPayout, setMiningPayout] = useState("");
  const [savingMining, setSavingMining] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.getAdminUser(id);
      if (!res.success || !res.user) {
        toast.error("User not found");
        setUser(null);
        return;
      }
      const u = res.user;
      setUser(u);
      setDepositStr(String(num(u.depositCreditUsd)));
      setLoanStr(String(num(u.claimedPoolCreditUsd)));
      setSwapStr(String(num(u.swapHoldingsUsd)));
      setEditForm({
        username: u.username || "",
        email: (u.email as string) || "",
        role: String(u.role || "USER"),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    api
      .getAdminMiningPackages()
      .then((r) => {
        if (!cancelled && r.packages) setMiningPackages(r.packages);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const sub = user.miningSubscription as Record<string, unknown> | undefined;
    if (sub && typeof sub === "object") {
      setMiningPackageId(String(sub.packageId ?? ""));
      setMiningPayout(String(sub.payoutAddress ?? ""));
    } else {
      setMiningPackageId("");
      setMiningPayout("");
    }
  }, [user]);

  const parseUsd = (s: string): number | null => {
    const t = s.trim();
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };

  const bumpDeposit = (delta: number) => {
    const cur = parseUsd(depositStr) ?? 0;
    setDepositStr(String(Math.max(0, cur + delta)));
  };

  const saveCredits = async () => {
    const d = parseUsd(depositStr);
    const l = parseUsd(loanStr);
    const s = parseUsd(swapStr);
    if (d === null || l === null || s === null) {
      toast.error("Balances must be non-negative numbers");
      return;
    }
    setSavingCredits(true);
    try {
      await api.patchAdminUserCredits(id, {
        depositCreditUsd: d,
        claimedPoolCreditUsd: l,
        swapHoldingsUsd: s,
      });
      toast.success("Balances updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update balances");
    } finally {
      setSavingCredits(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await api.updateAdminUser(id, {
        username: editForm.username || undefined,
        email: editForm.email || undefined,
        role: editForm.role,
      });
      toast.success("Profile saved");
      setEditOpen(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const saveMining = async () => {
    setSavingMining(true);
    try {
      await api.upsertAdminUserMining(id, {
        packageId: miningPackageId.trim() || undefined,
        payoutAddress: miningPayout.trim() || undefined,
      });
      toast.success(
        user?.miningSubscription ? "Mining subscription updated" : "Mining subscription created"
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save mining subscription");
    } finally {
      setSavingMining(false);
    }
  };

  if (!id) {
    return (
      <div className="text-[#999]">
        Invalid user id.{" "}
        <Link href="/dashboard/users" className="text-[#F0B90B] underline">
          Back to users
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#F0B90B]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/users"
          className="inline-flex items-center gap-2 text-sm text-[#F0B90B] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Users
        </Link>
        <p className="text-[#999]">Could not load this user.</p>
      </div>
    );
  }

  const memberships = (user.poolMemberships as PoolMember[] | undefined) ?? [];
  const transactions = (user.transactions as TxRow[] | undefined) ?? [];
  const loans = (user.loans as Record<string, unknown>[] | undefined) ?? [];
  const tokenBalances = (user.tokenBalances as Record<string, unknown>[] | undefined) ?? [];
  const creditDraws = (user.creditDraws as Record<string, unknown>[] | undefined) ?? [];
  const miningSub = user.miningSubscription as Record<string, unknown> | undefined;
  const miningPkg = miningSub?.package as Record<string, unknown> | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/users"
            className="inline-flex items-center gap-2 text-sm text-[#F0B90B] hover:underline mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> All users
          </Link>
          <h2 className="text-2xl font-bold text-white tracking-tight">Manage user</h2>
          <p className="text-sm text-[#888] mt-1">
            Balances, pool minimums, mining engine, on-chain-style loans, and token balances — edit
            what you need; sensitive fields are hidden from this API.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load()}
          className="border-[#2A2A2A] text-[#ccc] shrink-0"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-[#1A1A1A] border-[#2A2A2A] overflow-hidden">
            <CardHeader className="pb-2 border-b border-[#2A2A2A]">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <User className="w-4 h-4 text-[#F0B90B]" />
                    {(user.username as string) || "Unnamed"}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs text-[#666] break-all mt-1">
                    {String(user.walletAddress)}
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge
                    className={
                      user.role === "ADMIN"
                        ? "bg-[#F0B90B]/10 text-[#F0B90B]"
                        : "bg-[#3B82F6]/10 text-[#3B82F6]"
                    }
                  >
                    {String(user.role)}
                  </Badge>
                  <Badge
                    className={
                      user.isActive
                        ? "bg-[#00C853]/10 text-[#00C853]"
                        : "bg-[#FF3D57]/10 text-[#FF3D57]"
                    }
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-[#0D0D0D] p-2.5 border border-[#2A2A2A]">
                  <span className="text-[#666] block">User ID</span>
                  <span className="text-white font-mono truncate block">{String(user.id)}</span>
                </div>
                <div className="rounded-lg bg-[#0D0D0D] p-2.5 border border-[#2A2A2A]">
                  <span className="text-[#666] block">Joined</span>
                  <span className="text-white">
                    {new Date(String(user.createdAt)).toLocaleString()}
                  </span>
                </div>
              </div>
              {!editOpen ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#888]">Email</span>
                    <span className="text-white">{(user.email as string) || "—"}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-[#2A2A2A] text-[#ccc]"
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    Edit profile & role
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-[#999] text-xs">Username</Label>
                    <Input
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      className="bg-[#0D0D0D] border-[#2A2A2A] text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[#999] text-xs">Email</Label>
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="bg-[#0D0D0D] border-[#2A2A2A] text-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[#999] text-xs flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Role
                    </Label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      className="w-full h-10 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 text-sm text-white"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="MODERATOR">MODERATOR</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535]"
                      onClick={saveProfile}
                      disabled={savingProfile}
                    >
                      {savingProfile ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5 mr-1.5" /> Save
                        </>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-[#999]"
                      onClick={() => {
                        setEditOpen(false);
                        setEditForm({
                          username: (user.username as string) || "",
                          email: (user.email as string) || "",
                          role: String(user.role || "USER"),
                        });
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-linear-to-br from-[#1A1A1A] to-[#141414] border-[#2A2A2A]">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Banknote className="w-4 h-4 text-[#F0B90B]" />
                In-app balances (USD)
              </CardTitle>
              <CardDescription className="text-[#777]">
                These are platform credits, not on-chain balances. Use precise values; save applies all
                three fields together.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-[#aaa] text-xs flex items-center gap-1">
                    <Banknote className="w-3 h-3 text-[#F0B90B]" /> Deposit credit
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={depositStr}
                    onChange={(e) => setDepositStr(e.target.value)}
                    className="bg-[#0D0D0D] border-[#2A2A2A] text-white font-mono"
                  />
                  <div className="flex flex-wrap gap-1">
                    {[10, 100, 500].map((step) => (
                      <span key={`p-${step}`} className="flex gap-0.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px] border-[#333] text-[#ccc]"
                          onClick={() => bumpDeposit(step)}
                        >
                          <Plus className="w-3 h-3 mr-0.5" />
                          {step}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px] border-[#333] text-[#ccc]"
                          onClick={() => bumpDeposit(-step)}
                        >
                          <Minus className="w-3 h-3 mr-0.5" />
                          {step}
                        </Button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[#aaa] text-xs flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-400" /> Loan / pool credit
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={loanStr}
                    onChange={(e) => setLoanStr(e.target.value)}
                    className="bg-[#0D0D0D] border-[#2A2A2A] text-white font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[#aaa] text-xs flex items-center gap-1">
                    <Activity className="w-3 h-3 text-violet-400" /> Swap holdings
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={swapStr}
                    onChange={(e) => setSwapStr(e.target.value)}
                    className="bg-[#0D0D0D] border-[#2A2A2A] text-white font-mono"
                  />
                </div>
              </div>
              <Button
                className="w-full sm:w-auto bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold"
                onClick={saveCredits}
                disabled={savingCredits}
              >
                {savingCredits ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save balances
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#F0B90B]" />
                Pool memberships ({memberships.length})
              </CardTitle>
              <CardDescription className="text-[#666] text-xs">
                Min deposit / claim fee / packaged loan credit come from each pool (admin sets these
                under Packages).
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {memberships.length === 0 ? (
                <p className="text-sm text-[#666] py-4 text-center">No pool memberships</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                      <TableHead className="text-[#888] whitespace-nowrap">Pool</TableHead>
                      <TableHead className="text-[#888]">Sym</TableHead>
                      <TableHead className="text-[#888] text-right whitespace-nowrap">
                        Min dep
                      </TableHead>
                      <TableHead className="text-[#888] text-right whitespace-nowrap">
                        Claim fee
                      </TableHead>
                      <TableHead className="text-[#888] text-right whitespace-nowrap">
                        Pkg loan
                      </TableHead>
                      <TableHead className="text-[#888] text-right">Share</TableHead>
                      <TableHead className="text-[#888] whitespace-nowrap">Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberships.map((m) => {
                      const p = m.pool;
                      const minDep = num(p.minDeposit);
                      const claimFee = p.supportsAppCredit
                        ? num(p.creditMinUsd ?? p.minDeposit)
                        : minDep;
                      const pkgLoan = p.supportsAppCredit ? num(p.creditCreditedUsd) : null;
                      return (
                        <TableRow key={m.id} className="border-[#2A2A2A]">
                          <TableCell className="text-white text-sm max-w-[140px] truncate">
                            {p.name}
                          </TableCell>
                          <TableCell className="text-[#F0B90B] font-mono text-xs">
                            {p.tokenSymbol}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-[#ccc]">
                            ${minDep.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-[#FCD535]">
                            {p.supportsAppCredit ? `$${claimFee.toLocaleString()}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-emerald-300/90">
                            {pkgLoan != null && Number.isFinite(pkgLoan)
                              ? `$${pkgLoan.toLocaleString()}`
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-[#ccc]">
                            {num(m.share)}
                          </TableCell>
                          <TableCell className="text-[#666] text-[10px] whitespace-nowrap">
                            {new Date(m.joinedAt).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#F0B90B]" />
                Mining engine (CLB machine)
              </CardTitle>
              <CardDescription className="text-[#666] text-xs">
                Package = hash rate / tokens per period. Assign package and BSC payout address.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {miningSub && miningPkg ? (
                <div className="rounded-lg bg-[#0D0D0D] border border-[#2A2A2A] p-3 text-xs space-y-1">
                  <div className="text-white font-medium">{String(miningPkg.name)}</div>
                  <div className="text-[#888]">
                    {num(miningPkg.tokensPerPeriod)} {String(miningPkg.tokenSymbol)} /{" "}
                    {String(miningPkg.periodLength)} {String(miningPkg.periodUnit).toLowerCase()}
                    {miningPkg.isFree ? " · free tier" : ` · $${num(miningPkg.priceUsd)}`}
                  </div>
                  <div className="text-[#666] font-mono break-all">
                    Payout: {String(miningSub.payoutAddress)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#666]">No mining subscription yet — create one below.</p>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[#999] text-xs">Package (engine)</Label>
                  <select
                    value={miningPackageId}
                    onChange={(e) => setMiningPackageId(e.target.value)}
                    className="w-full h-10 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 text-sm text-white"
                  >
                    <option value="">Select package…</option>
                    {miningPackages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} · {pkg.tokensPerPeriod} {pkg.tokenSymbol}/{pkg.periodLength}{" "}
                        {pkg.periodUnit}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[#999] text-xs">Payout address</Label>
                  <Input
                    value={miningPayout}
                    onChange={(e) => setMiningPayout(e.target.value)}
                    placeholder="0x…"
                    className="bg-[#0D0D0D] border-[#2A2A2A] text-white font-mono text-xs"
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={saveMining}
                disabled={savingMining}
                className="bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535]"
              >
                {savingMining ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {miningSub ? "Update mining" : "Create mining subscription"}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Loans ({loans.length})
              </CardTitle>
              <CardDescription className="text-[#666] text-xs">
                Adjust limits, drawn balance, APR, LTV, and status. Logged under transactions
                (LOAN).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loans.length === 0 ? (
                <p className="text-sm text-[#666] py-2">No loan records for this user.</p>
              ) : (
                loans.map((loan) => (
                  <LoanRowEditor key={String(loan.id)} userId={id} loan={loan} onSaved={load} />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#F0B90B]" />
                Token balances (CLB ledger)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tokenBalances.length === 0 ? (
                <p className="text-sm text-[#666]">No token balance rows.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                      <TableHead className="text-[#888]">Token</TableHead>
                      <TableHead className="text-[#888] text-right">Balance</TableHead>
                      <TableHead className="text-[#888] text-right">Locked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokenBalances.map((tb) => (
                      <TableRow key={String(tb.id)} className="border-[#2A2A2A]">
                        <TableCell className="font-mono text-[#F0B90B] text-xs">
                          {String(tb.token)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-white">
                          {num(tb.balance)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-[#888]">
                          {num(tb.locked)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-400" />
                Credit line activity
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {creditDraws.length === 0 ? (
                <p className="text-sm text-[#666]">No credit draw / repay events.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                      <TableHead className="text-[#888]">Type</TableHead>
                      <TableHead className="text-[#888] text-right">Amount</TableHead>
                      <TableHead className="text-[#888] text-right">Avail after</TableHead>
                      <TableHead className="text-[#888]">Loan</TableHead>
                      <TableHead className="text-[#888]">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditDraws.map((cd) => {
                      const ln = cd.loan as Record<string, unknown> | undefined;
                      return (
                        <TableRow key={String(cd.id)} className="border-[#2A2A2A]">
                          <TableCell className="text-xs font-mono text-white">{String(cd.type)}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-[#ccc]">
                            {num(cd.amount)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono text-[#888]">
                            {num(cd.availableCreditAfter)}
                          </TableCell>
                          <TableCell className="text-[10px] text-[#666] font-mono">
                            {ln ? `${String(ln.status)} · ${String(ln.loanType)}` : "—"}
                          </TableCell>
                          <TableCell className="text-[10px] text-[#666] whitespace-nowrap">
                            {new Date(String(cd.createdAt)).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#F0B90B]" />
                Recent transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {transactions.length === 0 ? (
                <p className="text-sm text-[#666] py-4 text-center">No transactions</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                      <TableHead className="text-[#888]">Type</TableHead>
                      <TableHead className="text-[#888]">Amount</TableHead>
                      <TableHead className="text-[#888]">Status</TableHead>
                      <TableHead className="text-[#888]">Note</TableHead>
                      <TableHead className="text-[#888]">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t) => {
                      const meta = t.metadata;
                      const kind =
                        meta && typeof meta === "object"
                          ? (meta as { kind?: string }).kind
                          : undefined;
                      const isAdminBal = kind === "ADMIN_CREDIT_BALANCE";
                      const isAdminLoan = kind === "ADMIN_LOAN_UPDATE";
                      const isAdminRow = isAdminBal || isAdminLoan;
                      return (
                        <TableRow
                          key={t.id}
                          className={`border-[#2A2A2A] ${isAdminRow ? "bg-[#F0B90B]/5" : ""}`}
                        >
                          <TableCell className="text-white text-xs font-mono">{t.type}</TableCell>
                          <TableCell className="text-[#ccc] text-xs">{num(t.amount)}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                t.status === "SUCCESS"
                                  ? "bg-[#00C853]/10 text-[#00C853] text-[10px]"
                                  : "bg-[#666]/20 text-[#999] text-[10px]"
                              }
                            >
                              {t.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[#888] text-[10px] max-w-[140px] truncate">
                            {isAdminBal
                              ? "Admin balance change"
                              : isAdminLoan
                                ? "Admin loan update"
                                : "—"}
                          </TableCell>
                          <TableCell className="text-[#666] text-[10px] whitespace-nowrap">
                            {new Date(t.createdAt).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
