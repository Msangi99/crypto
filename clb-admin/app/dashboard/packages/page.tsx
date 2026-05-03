"use client";

import { useEffect, useState } from "react";
import {
  Package, Plus, Loader2, Bitcoin, DollarSign, TrendingUp,
  Target, Percent, Layers, Pencil, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { toast } from "sonner";

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
}

const defaultTiers = [
  { name: "Starter BTC Pool", asset: "BTC", price: 100, leverage: "60x", phase1Target: "$150,000", phase2Target: "$200,000", profitSplit: "85/15" },
  { name: "Silver BTC Pool", asset: "BTC", price: 250, leverage: "60x", phase1Target: "$150,000", phase2Target: "$200,000", profitSplit: "85/15" },
  { name: "Gold BTC Pool", asset: "BTC", price: 500, leverage: "60x", phase1Target: "$150,000", phase2Target: "$200,000", profitSplit: "85/15" },
  { name: "Platinum BTC Pool", asset: "BTC", price: 1000, leverage: "60x", phase1Target: "$150,000", phase2Target: "$200,000", profitSplit: "85/15" },
  { name: "Starter ETH Pool", asset: "ETH", price: 100, leverage: "60x", phase1Target: "$15,000", phase2Target: "$20,000", profitSplit: "85/15" },
  { name: "Silver ETH Pool", asset: "ETH", price: 250, leverage: "60x", phase1Target: "$15,000", phase2Target: "$20,000", profitSplit: "85/15" },
  { name: "Gold ETH Pool", asset: "ETH", price: 500, leverage: "60x", phase1Target: "$15,000", phase2Target: "$20,000", profitSplit: "85/15" },
  { name: "Platinum ETH Pool", asset: "ETH", price: 1000, leverage: "60x", phase1Target: "$15,000", phase2Target: "$20,000", profitSplit: "85/15" },
];

export default function PackagesPage() {
  const [packages, setPackages] = useState<PoolPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editPkg, setEditPkg] = useState<PoolPackage | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", minDeposit: "100", apy: "85", status: "ACTIVE" });
  const [form, setForm] = useState<{
    name: string; description: string; tokenSymbol: string; minDeposit: string;
    maxDeposit: string; apy: string; leverage: string; phase1Target: string;
    phase2Target: string;
  }>({
    name: "", description: "", tokenSymbol: "BTC", minDeposit: "100",
    maxDeposit: "100", apy: "85", leverage: "60", phase1Target: "150000",
    phase2Target: "200000",
  });

  const loadPackages = async () => {
    try {
      const res = await api.getPools(1, 50);
      setPackages(res.data);
    } catch (err) {
      console.error("Failed to load packages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPackages(); }, []);

  const handleCreate = async () => {
    if (!form.name) { toast.error("Package name required"); return; }
    setCreating(true);
    try {
      const desc = `${form.leverage}x leverage | Phase 1: $${Number(form.phase1Target).toLocaleString()} | Phase 2: $${Number(form.phase2Target).toLocaleString()} | 85/15 profit split`;
      await api.createPool({
        name: form.name,
        description: desc,
        tokenSymbol: form.tokenSymbol,
        minDeposit: parseFloat(form.minDeposit),
        maxDeposit: parseFloat(form.maxDeposit),
        apy: parseFloat(form.apy),
        contractAddress: "0x5fA4d61B529F88069a46B83451540aC4c2f96200",
      });
      toast.success("Package created!");
      setDialogOpen(false);
      setForm({ name: "", description: "", tokenSymbol: "BTC", minDeposit: "100", maxDeposit: "100", apy: "85", leverage: "60", phase1Target: "150000", phase2Target: "200000" });
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
        const desc = `${tier.leverage} leverage | Phase 1: ${tier.phase1Target} | Phase 2: ${tier.phase2Target} | ${tier.profitSplit} profit split`;
        await api.createPool({
          name: tier.name,
          description: desc,
          tokenSymbol: tier.asset === "BTC" ? "BTCB" : "ETH",
          minDeposit: tier.price,
          maxDeposit: tier.price,
          apy: 85,
          contractAddress: "0x5fA4d61B529F88069a46B83451540aC4c2f96200",
        });
      }
      toast.success(`${defaultTiers.length} default packages created!`);
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
      apy: String(pkg.apy),
      status: pkg.status,
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editPkg) return;
    setCreating(true);
    try {
      await api.updatePool(editPkg.id, {
        name: editForm.name,
        description: editForm.description,
        minDeposit: parseFloat(editForm.minDeposit),
        apy: parseFloat(editForm.apy),
        status: editForm.status,
      });
      toast.success("Package updated!");
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Investment Packages</h2>
          <p className="text-sm text-[#888] mt-1">Create and manage pool tiers for BTC & ETH leveraged investments</p>
        </div>
        <div className="flex items-center gap-2">
          {packages.length === 0 && (
            <Button onClick={seedDefaultTiers} disabled={creating} variant="outline" className="border-[#2A2A2A] text-[#999] hover:text-white hover:bg-[#2A2A2A]">
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Layers className="w-4 h-4 mr-2" />}
              Seed Default Tiers
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] transition-colors cursor-pointer">
              <Plus className="w-4 h-4 mr-2" /> New Package
            </DialogTrigger>
            <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Investment Package</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Package Name *</Label>
                  <Input placeholder="e.g. Gold BTC Pool" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Asset</Label>
                    <Select value={form.tokenSymbol} onValueChange={(v) => {
                      if (!v) return;
                      const isBTC = v === "BTC";
                      setForm({ ...form, tokenSymbol: v, phase1Target: isBTC ? "150000" : "15000", phase2Target: isBTC ? "200000" : "20000" });
                    }}>
                      <SelectTrigger className="bg-[#0D0D0D] border-[#2A2A2A]"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
                        <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                        <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Leverage</Label>
                    <Input type="number" value={form.leverage} onChange={(e) => setForm({ ...form, leverage: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pool Price (USD)</Label>
                    <Input type="number" value={form.minDeposit} onChange={(e) => setForm({ ...form, minDeposit: e.target.value, maxDeposit: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Profit Share (%)</Label>
                    <Input type="number" value={form.apy} onChange={(e) => setForm({ ...form, apy: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Phase 1 Target ($)</Label>
                    <Input type="number" value={form.phase1Target} onChange={(e) => setForm({ ...form, phase1Target: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Phase 2 Target ($)</Label>
                    <Input type="number" value={form.phase2Target} onChange={(e) => setForm({ ...form, phase2Target: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Package details..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Package
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Package Cards */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-[#F0B90B]" /></div>
      ) : packages.length === 0 ? (
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="w-16 h-16 text-[#2A2A2A] mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Packages Yet</h3>
            <p className="text-sm text-[#666] mb-4 text-center max-w-md">Create investment packages for your users. Use &quot;Seed Default Tiers&quot; to auto-create all 8 standard BTC &amp; ETH packages ($100 - $1,000).</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {packages.map((pkg) => {
            const colors = getAssetColor(pkg.tokenSymbol);
            const descParts = (pkg.description ?? "").split("|").map((s: string) => s.trim());
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
                        <Badge className={`${colors.bg} ${colors.text} ${colors.border} text-xs mt-1`}>
                          {pkg.tokenSymbol}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleStatusToggle(pkg)} className="p-1.5 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-[#F0B90B]" title={pkg.status === "ACTIVE" ? "Pause pool" : "Activate pool"}>
                        {pkg.status === "ACTIVE" ? "⏸" : "▶"}
                      </button>
                      <button onClick={() => handleEditOpen(pkg)} className="p-1.5 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-white">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDelete(pkg)} className="p-1.5 rounded-md hover:bg-[#FF3D57]/10 text-[#999] hover:text-[#FF3D57]">
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
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 p-2 rounded bg-[#0D0D0D]">
                      <Percent className="w-3 h-3 text-[#F0B90B]" />
                      <span className="text-[#999]">Profit:</span>
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
                    Staked: {pkg.totalStaked} {pkg.tokenSymbol}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Package Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pool Price (USD)</Label>
                <Input type="number" value={editForm.minDeposit} onChange={(e) => setEditForm({ ...editForm, minDeposit: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
              </div>
              <div className="space-y-2">
                <Label>Profit Share (%)</Label>
                <Input type="number" value={editForm.apy} onChange={(e) => setEditForm({ ...editForm, apy: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
              </div>
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
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
