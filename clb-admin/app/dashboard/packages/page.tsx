"use client";

import { useEffect, useState } from "react";
import {
  Package, Plus, Loader2, Bitcoin, DollarSign, TrendingUp,
  Target, Percent, Layers, Pencil, Trash2, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { toast } from "sonner";

/** Matches backend tier → leverage (PDF). */
const TIER_LEVERAGE: Record<number, number> = {
  100: 10, 200: 15, 300: 20, 400: 25, 500: 30,
  600: 35, 700: 40, 800: 45, 900: 50, 1000: 60,
};

function leverageForDepositUsd(usd: number): number {
  const tiers = Object.keys(TIER_LEVERAGE).map(Number).sort((a, b) => b - a);
  for (const tier of tiers) {
    if (usd >= tier) return TIER_LEVERAGE[tier];
  }
  return 1;
}

interface PoolPackage {
  id: string;
  name: string;
  description: string | null;
  tokenSymbol: string;
  minDeposit: number;
  maxDeposit: number | null;
  apy: number;
  totalStaked: number;
  status: string;
  startDate: string;
  memberCount: number;
  contractAddress: string | null;
  supportsAppCredit: boolean;
  creditMinUsd: number | null;
  creditCreditedUsd: number | null;
}

const defaultTiers = [
  { name: "Starter BTC Pool", asset: "BTC", price: 100, phase1Target: "$150,000", phase2Target: "$200,000", profitSplit: "85/15" },
  { name: "Silver BTC Pool", asset: "BTC", price: 250, phase1Target: "$150,000", phase2Target: "$200,000", profitSplit: "85/15" },
  { name: "Gold BTC Pool", asset: "BTC", price: 500, phase1Target: "$150,000", phase2Target: "$200,000", profitSplit: "85/15" },
  { name: "Platinum BTC Pool", asset: "BTC", price: 1000, phase1Target: "$150,000", phase2Target: "$200,000", profitSplit: "85/15" },
  { name: "Starter ETH Pool", asset: "ETH", price: 100, phase1Target: "$15,000", phase2Target: "$20,000", profitSplit: "85/15" },
  { name: "Silver ETH Pool", asset: "ETH", price: 250, phase1Target: "$15,000", phase2Target: "$20,000", profitSplit: "85/15" },
  { name: "Gold ETH Pool", asset: "ETH", price: 500, phase1Target: "$15,000", phase2Target: "$20,000", profitSplit: "85/15" },
  { name: "Platinum ETH Pool", asset: "ETH", price: 1000, phase1Target: "$15,000", phase2Target: "$20,000", profitSplit: "85/15" },
];

const emptyCreateForm = () => ({
  name: "",
  description: "",
  tokenSymbol: "BTCB",
  minDeposit: "100",
  maxDeposit: "",
  apy: "0",
  contractAddress: "",
  supportsAppCredit: true,
  creditMinUsd: "100",
  creditCreditedUsd: "1000",
});

export default function PackagesPage() {
  const [packages, setPackages] = useState<PoolPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<PoolPackage | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    minDeposit: "100",
    maxDeposit: "",
    apy: "0",
    status: "ACTIVE",
    tokenSymbol: "BTCB",
    contractAddress: "",
    supportsAppCredit: true,
    creditMinUsd: "100",
    creditCreditedUsd: "1000",
  });
  const [form, setForm] = useState(emptyCreateForm);

  const loadPackages = async () => {
    try {
      const res = await api.getAdminPoolPackages();
      setPackages(res.pools);
    } catch (err) {
      console.error("Failed to load packages:", err);
      toast.error("Failed to load packages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPackages(); }, []);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Package name required");
      return;
    }
    const min = parseFloat(form.minDeposit);
    if (!Number.isFinite(min) || min < 0) {
      toast.error("Valid minimum / entry (USD) required");
      return;
    }
    if (form.supportsAppCredit) {
      const fee = parseFloat(form.creditMinUsd);
      const loan = parseFloat(form.creditCreditedUsd);
      if (!Number.isFinite(fee) || fee <= 0) {
        toast.error("Claim fee (USD) must be greater than 0");
        return;
      }
      if (!Number.isFinite(loan) || loan <= 0) {
        toast.error("Loan credit (USD) must be greater than 0 — e.g. fee 100 → loan 1000");
        return;
      }
    }

    setCreating(true);
    try {
      const payload: Parameters<typeof api.createPool>[0] = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        tokenSymbol: form.tokenSymbol,
        minDeposit: min,
        maxDeposit: form.maxDeposit.trim() ? parseFloat(form.maxDeposit) : undefined,
        apy: parseFloat(form.apy) || 0,
        contractAddress: form.contractAddress.trim() || undefined,
        supportsAppCredit: form.supportsAppCredit,
      };
      if (form.supportsAppCredit) {
        payload.creditMinUsd = parseFloat(form.creditMinUsd);
        payload.creditCreditedUsd = parseFloat(form.creditCreditedUsd);
      }

      await api.createPool(payload);
      toast.success("Package created");
      setDialogOpen(false);
      setForm(emptyCreateForm());
      loadPackages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create package");
    } finally {
      setCreating(false);
    }
  };

  const seedDefaultTiers = async () => {
    setCreating(true);
    try {
      for (const tier of defaultTiers) {
        const lev = leverageForDepositUsd(tier.price);
        const loanUsd = tier.price * lev;
        const desc = `Leverage up to ${lev}x | Phase 1: ${tier.phase1Target} | Phase 2: ${tier.phase2Target} | ${tier.profitSplit} profit split | In-app: $${tier.price} claim → $${loanUsd} loan credit`;
        await api.createPool({
          name: tier.name,
          description: desc,
          tokenSymbol: tier.asset === "BTC" ? "BTCB" : "ETH",
          minDeposit: tier.price,
          maxDeposit: tier.price,
          apy: 0,
          supportsAppCredit: true,
          creditMinUsd: tier.price,
          creditCreditedUsd: loanUsd,
        });
      }
      toast.success(`${defaultTiers.length} packages created with claim → loan credit`);
      loadPackages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to seed packages");
    } finally {
      setCreating(false);
    }
  };

  const handleEditOpen = (pkg: PoolPackage) => {
    setEditPkg(pkg);
    setEditForm({
      name: pkg.name,
      description: pkg.description || "",
      minDeposit: String(pkg.minDeposit),
      maxDeposit: pkg.maxDeposit != null ? String(pkg.maxDeposit) : "",
      apy: String(pkg.apy),
      status: pkg.status,
      tokenSymbol: pkg.tokenSymbol,
      contractAddress: pkg.contractAddress || "",
      supportsAppCredit: pkg.supportsAppCredit,
      creditMinUsd: pkg.creditMinUsd != null ? String(pkg.creditMinUsd) : String(pkg.minDeposit),
      creditCreditedUsd: pkg.creditCreditedUsd != null ? String(pkg.creditCreditedUsd) : "",
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editPkg) return;
    setCreating(true);
    try {
      const min = parseFloat(editForm.minDeposit);
      const body: Parameters<typeof api.updatePool>[1] = {
        name: editForm.name,
        description: editForm.description,
        minDeposit: min,
        maxDeposit: editForm.maxDeposit.trim() ? parseFloat(editForm.maxDeposit) : undefined,
        apy: parseFloat(editForm.apy) || 0,
        status: editForm.status,
        tokenSymbol: editForm.tokenSymbol,
        contractAddress: editForm.contractAddress.trim() || undefined,
        supportsAppCredit: editForm.supportsAppCredit,
      };
      if (editForm.supportsAppCredit) {
        body.creditMinUsd = parseFloat(editForm.creditMinUsd);
        body.creditCreditedUsd = parseFloat(editForm.creditCreditedUsd);
      } else {
        body.creditMinUsd = null;
        body.creditCreditedUsd = null;
      }

      await api.updatePool(editPkg.id, body);
      toast.success("Package updated");
      setEditDialogOpen(false);
      setEditPkg(null);
      loadPackages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (pkg: PoolPackage) => {
    if (!confirm(`Delete "${pkg.name}"? This will also remove all deposits and memberships for this pool.`)) return;
    try {
      await api.deletePool(pkg.id);
      toast.success("Package deleted");
      loadPackages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleStatusToggle = async (pkg: PoolPackage) => {
    const newStatus = pkg.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await api.updatePool(pkg.id, { status: newStatus });
      toast.success(`Pool ${newStatus === "ACTIVE" ? "activated" : "paused"}`);
      loadPackages();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const getAssetColor = (symbol: string) => {
    if (symbol === "BTCB" || symbol === "BTC") return { bg: "bg-[#F7931A]/10", text: "text-[#F7931A]", border: "border-[#F7931A]/20" };
    if (symbol === "ETH") return { bg: "bg-[#627EEA]/10", text: "text-[#627EEA]", border: "border-[#627EEA]/20" };
    return { bg: "bg-[#F0B90B]/10", text: "text-[#F0B90B]", border: "border-[#F0B90B]/20" };
  };

  const syncFeeFromMin = () => {
    setForm((f) => ({ ...f, creditMinUsd: f.minDeposit }));
  };

  const suggestedLoan = () => {
    const fee = parseFloat(form.creditMinUsd);
    if (!Number.isFinite(fee) || fee <= 0) return null;
    const lev = leverageForDepositUsd(fee);
    return fee * lev;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Investment Packages</h2>
          <p className="text-sm text-[#888] mt-1 max-w-xl">
            Create unlimited pool packages. Enable in-app claim so users spend deposit balance (claim fee) and receive loan credit (e.g. $100 → $1,000) before swapping to crypto. The CLB mobile app must call the same API as this admin (admin{" "}
            <code className="text-[#ccc]">NEXT_PUBLIC_API_URL</code>, app{" "}
            <code className="text-[#ccc]">EXPO_PUBLIC_API_URL</code>) or toggles here will not match what users see.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {packages.length === 0 && (
            <Button onClick={seedDefaultTiers} disabled={creating} variant="outline" className="border-[#2A2A2A] text-[#999] hover:text-white hover:bg-[#2A2A2A]">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Layers className="w-4 h-4 mr-2" />}
              Seed default tiers
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] transition-colors cursor-pointer">
              <Plus className="w-4 h-4 mr-2" /> New package
            </DialogTrigger>
            <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create investment package</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-4">
                <div className="space-y-2">
                  <Label>Package name *</Label>
                  <Input
                    placeholder="e.g. Gold BTC — $500 claim"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="bg-[#0D0D0D] border-[#2A2A2A]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Asset / symbol</Label>
                    <Select value={form.tokenSymbol} onValueChange={(v) => { if (v) setForm({ ...form, tokenSymbol: v }); }}>
                      <SelectTrigger className="bg-[#0D0D0D] border-[#2A2A2A]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                        <SelectItem value="BTCB">BTC (BTCB)</SelectItem>
                        <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                        <SelectItem value="BNB">BNB</SelectItem>
                        <SelectItem value="USDT">USDT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Min entry (USD)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.minDeposit}
                      onChange={(e) => setForm({ ...form, minDeposit: e.target.value })}
                      className="bg-[#0D0D0D] border-[#2A2A2A]"
                    />
                    <p className="text-[10px] text-[#666]">Shown as pool tier; also used as claim fee if you match it below.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max deposit (USD, optional)</Label>
                    <Input
                      type="number"
                      value={form.maxDeposit}
                      onChange={(e) => setForm({ ...form, maxDeposit: e.target.value })}
                      className="bg-[#0D0D0D] border-[#2A2A2A]"
                      placeholder="Empty = no cap"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>APY / display % (optional)</Label>
                    <Input
                      type="number"
                      value={form.apy}
                      onChange={(e) => setForm({ ...form, apy: e.target.value })}
                      className="bg-[#0D0D0D] border-[#2A2A2A]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Contract address (optional)</Label>
                  <Input
                    placeholder="0x… (leave empty if not on-chain)"
                    value={form.contractAddress}
                    onChange={(e) => setForm({ ...form, contractAddress: e.target.value })}
                    className="bg-[#0D0D0D] border-[#2A2A2A] font-mono text-xs"
                  />
                </div>

                <div className="rounded-lg border border-[#2A2A2A] bg-[#0D0D0D] p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-[#F0B90B]" />
                      <div>
                        <p className="text-sm font-semibold text-white">In-app claim (deposit balance)</p>
                        <p className="text-xs text-[#888]">User pays claim fee from USDT deposit credit only; loan line increases by configured loan credit.</p>
                      </div>
                    </div>
                    <Switch
                      checked={form.supportsAppCredit}
                      onCheckedChange={(v) => setForm({ ...form, supportsAppCredit: Boolean(v) })}
                    />
                  </div>

                  {form.supportsAppCredit && (
                    <div className="space-y-4 pt-2 border-t border-[#2A2A2A]">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Claim fee (USD)</Label>
                            <button type="button" onClick={syncFeeFromMin} className="text-[10px] text-[#F0B90B] hover:underline">
                              Same as min entry
                            </button>
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.creditMinUsd}
                            onChange={(e) => setForm({ ...form, creditMinUsd: e.target.value })}
                            className="bg-[#1A1A1A] border-[#2A2A2A]"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Loan credit after claim (USD)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={form.creditCreditedUsd}
                            onChange={(e) => setForm({ ...form, creditCreditedUsd: e.target.value })}
                            className="bg-[#1A1A1A] border-[#2A2A2A]"
                          />
                        </div>
                      </div>
                      {suggestedLoan() != null && (
                        <p className="text-xs text-[#666]">
                          PDF tier hint for this fee: ~{leverageForDepositUsd(parseFloat(form.creditMinUsd) || 0)}× → suggested loan ≈ ${suggestedLoan()!.toLocaleString()} (adjust as needed).
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    placeholder="Notes for admins or users…"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="bg-[#0D0D0D] border-[#2A2A2A] min-h-[80px]"
                  />
                </div>

                <Button onClick={handleCreate} disabled={creating} className="w-full bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create package
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#F0B90B]" /></div>
      ) : packages.length === 0 ? (
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="w-16 h-16 text-[#2A2A2A] mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No packages yet</h3>
            <p className="text-sm text-[#666] mb-4 text-center max-w-md">
              Add packages with optional in-app claim (fee → loan credit). Seed creates 8 BTC/ETH tiers with leverage-based loan amounts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {packages.map((pkg) => {
            const colors = getAssetColor(pkg.tokenSymbol);
            const descParts = (pkg.description ?? "").split("|").map((s: string) => s.trim());
            const claimFee = pkg.creditMinUsd ?? pkg.minDeposit;
            const loanCr = pkg.creditCreditedUsd;
            return (
              <Card key={pkg.id} className="bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#3A3A3A] transition-all group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center`}>
                        {pkg.tokenSymbol === "BTCB" || pkg.tokenSymbol === "BTC" ? (
                          <Bitcoin className={`w-5 h-5 ${colors.text}`} />
                        ) : (
                          <DollarSign className={`w-5 h-5 ${colors.text}`} />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-white text-base">{pkg.name}</CardTitle>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <Badge className={`${colors.bg} ${colors.text} ${colors.border} text-xs`}>
                            {pkg.tokenSymbol}
                          </Badge>
                          {pkg.supportsAppCredit && (
                            <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/20 text-xs">
                              In-app claim
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" onClick={() => handleStatusToggle(pkg)} className="p-1.5 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-[#F0B90B]" title={pkg.status === "ACTIVE" ? "Pause pool" : "Activate pool"}>
                        {pkg.status === "ACTIVE" ? "⏸" : "▶"}
                      </button>
                      <button type="button" onClick={() => handleEditOpen(pkg)} className="p-1.5 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-white">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => handleDelete(pkg)} className="p-1.5 rounded-md hover:bg-[#FF3D57]/10 text-[#999] hover:text-[#FF3D57]">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D]">
                    <span className="text-2xl font-bold text-white">${pkg.minDeposit}</span>
                    <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/20">{pkg.status}</Badge>
                  </div>
                  {pkg.supportsAppCredit && loanCr != null && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-[#0D0D0D] border border-[#2A2A2A]">
                        <span className="text-[#888] block">Claim fee</span>
                        <span className="text-white font-semibold">${claimFee}</span>
                      </div>
                      <div className="p-2 rounded bg-[#0D0D0D] border border-[#2A2A2A]">
                        <span className="text-[#888] block">Loan credit</span>
                        <span className="text-[#F0B90B] font-semibold">${loanCr.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 p-2 rounded bg-[#0D0D0D]">
                      <Percent className="w-3 h-3 text-[#F0B90B]" />
                      <span className="text-[#999]">APY:</span>
                      <span className="text-white font-medium">{pkg.apy}%</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded bg-[#0D0D0D]">
                      <TrendingUp className="w-3 h-3 text-[#00C853]" />
                      <span className="text-[#999]">Members:</span>
                      <span className="text-white font-medium">{pkg.memberCount}</span>
                    </div>
                  </div>
                  {descParts.length > 1 && (
                    <div className="space-y-1.5 pt-1">
                      {descParts.map((part, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <Target className="w-3 h-3 text-[#F0B90B] shrink-0" />
                          <span className="text-[#999]">{part}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-[#666] pt-1">
                    TVL: {pkg.totalStaked} {pkg.tokenSymbol}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Package name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset</Label>
                <Select value={editForm.tokenSymbol} onValueChange={(v) => { if (v) setEditForm({ ...editForm, tokenSymbol: v }); }}>
                  <SelectTrigger className="bg-[#0D0D0D] border-[#2A2A2A]"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                    <SelectItem value="BTCB">BTC (BTCB)</SelectItem>
                    <SelectItem value="ETH">ETH</SelectItem>
                    <SelectItem value="BNB">BNB</SelectItem>
                    <SelectItem value="USDT">USDT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Min entry (USD)</Label>
                <Input type="number" value={editForm.minDeposit} onChange={(e) => setEditForm({ ...editForm, minDeposit: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max deposit (optional)</Label>
                <Input type="number" value={editForm.maxDeposit} onChange={(e) => setEditForm({ ...editForm, maxDeposit: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
              </div>
              <div className="space-y-2">
                <Label>APY %</Label>
                <Input type="number" value={editForm.apy} onChange={(e) => setEditForm({ ...editForm, apy: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contract (optional)</Label>
              <Input value={editForm.contractAddress} onChange={(e) => setEditForm({ ...editForm, contractAddress: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A] font-mono text-xs" />
            </div>
            <div className="rounded-lg border border-[#2A2A2A] bg-[#0D0D0D] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-white">In-app claim</Label>
                <Switch
                  checked={editForm.supportsAppCredit}
                  onCheckedChange={(v) => setEditForm({ ...editForm, supportsAppCredit: Boolean(v) })}
                />
              </div>
              {editForm.supportsAppCredit && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#2A2A2A]">
                  <div className="space-y-2">
                    <Label>Claim fee (USD)</Label>
                    <Input type="number" value={editForm.creditMinUsd} onChange={(e) => setEditForm({ ...editForm, creditMinUsd: e.target.value })} className="bg-[#1A1A1A] border-[#2A2A2A]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Loan credit (USD)</Label>
                    <Input type="number" value={editForm.creditCreditedUsd} onChange={(e) => setEditForm({ ...editForm, creditCreditedUsd: e.target.value })} className="bg-[#1A1A1A] border-[#2A2A2A]" />
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => { if (v) setEditForm({ ...editForm, status: v }); }}>
                <SelectTrigger className="bg-[#0D0D0D] border-[#2A2A2A]"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="PAUSED">Paused</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
            </div>
            <Button onClick={handleEditSave} disabled={creating} className="w-full bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
