"use client";

import { useEffect, useState } from "react";
import { Cpu, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api, type AdminMiningPackage } from "@/lib/api";
import { toast } from "sonner";

type MiningPackageRow = AdminMiningPackage;

function periodLabel(length: number, unit: MiningPackageRow["periodUnit"]): string {
  const plural = length !== 1;
  if (unit === "MINUTE") return `${length} minute${plural ? "s" : ""}`;
  if (unit === "HOUR") return `${length} hour${plural ? "s" : ""}`;
  return `${length} day${plural ? "s" : ""}`;
}

const emptyForm = {
  name: "",
  description: "",
  tokenSymbol: "CLB",
  tokensPerPeriod: "0.1",
  periodLength: "1",
  periodUnit: "DAY" as MiningPackageRow["periodUnit"],
  isFree: false,
  priceUsd: "0",
  sortOrder: "0",
  isActive: true,
};

export default function ClbMiningPage() {
  const [packages, setPackages] = useState<MiningPackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<MiningPackageRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      const res = await api.getAdminMiningPackages();
      setPackages(res.packages ?? []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load mining packages");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (p: MiningPackageRow) => {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description || "",
      tokenSymbol: p.tokenSymbol,
      tokensPerPeriod: String(p.tokensPerPeriod),
      periodLength: String(p.periodLength),
      periodUnit: p.periodUnit,
      isFree: p.isFree,
      priceUsd: p.priceUsd != null ? String(p.priceUsd) : "0",
      sortOrder: String(p.sortOrder),
      isActive: p.isActive,
    });
    setEditOpen(true);
  };

  const submitCreate = async () => {
    if (!form.name.trim()) {
      toast.error("Package name is required");
      return;
    }
    setSaving(true);
    try {
      await api.createAdminMiningPackage({
        name: form.name.trim(),
        description: form.description.trim() || null,
        tokenSymbol: form.tokenSymbol,
        tokensPerPeriod: parseFloat(form.tokensPerPeriod),
        periodLength: parseInt(form.periodLength, 10),
        periodUnit: form.periodUnit,
        isFree: form.isFree,
        priceUsd: form.isFree ? null : parseFloat(form.priceUsd || "0"),
        sortOrder: parseInt(form.sortOrder, 10) || 0,
        isActive: form.isActive,
      });
      toast.success("Package created");
      setCreateOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!form.name.trim()) {
      toast.error("Package name is required");
      return;
    }
    setSaving(true);
    try {
      await api.updateAdminMiningPackage(editing.id, {
        name: form.name.trim(),
        description: form.description.trim() || null,
        tokenSymbol: form.tokenSymbol,
        tokensPerPeriod: parseFloat(form.tokensPerPeriod),
        periodLength: parseInt(form.periodLength, 10),
        periodUnit: form.periodUnit,
        isFree: form.isFree,
        priceUsd: form.isFree ? null : parseFloat(form.priceUsd || "0"),
        sortOrder: parseInt(form.sortOrder, 10) || 0,
        isActive: form.isActive,
      });
      toast.success("Package updated");
      setEditOpen(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: MiningPackageRow) => {
    if (!confirm(`Delete mining package "${p.name}"?`)) return;
    try {
      await api.deleteAdminMiningPackage(p.id);
      toast.success("Deleted");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const formFields = (
    <>
      <div className="space-y-2">
        <Label>Package name *</Label>
        <Input
          placeholder="e.g. Starter rig"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="bg-[#0D0D0D] border-[#2A2A2A]"
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          placeholder="Optional details shown in the app"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="bg-[#0D0D0D] border-[#2A2A2A] min-h-[72px]"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Token mined</Label>
          <Select
            value={form.tokenSymbol}
            onValueChange={(v) => {
              if (v) setForm({ ...form, tokenSymbol: v });
            }}
          >
            <SelectTrigger className="bg-[#0D0D0D] border-[#2A2A2A]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
              <SelectItem value="CLB">CLB</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sort order</Label>
          <Input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            className="bg-[#0D0D0D] border-[#2A2A2A]"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tokens per period *</Label>
          <Input
            type="number"
            step="any"
            value={form.tokensPerPeriod}
            onChange={(e) => setForm({ ...form, tokensPerPeriod: e.target.value })}
            className="bg-[#0D0D0D] border-[#2A2A2A]"
          />
        </div>
        <div className="space-y-2">
          <Label>Period length *</Label>
          <Input
            type="number"
            min={1}
            value={form.periodLength}
            onChange={(e) => setForm({ ...form, periodLength: e.target.value })}
            className="bg-[#0D0D0D] border-[#2A2A2A]"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Period unit *</Label>
        <Select
          value={form.periodUnit}
          onValueChange={(v) => {
            if (v === "MINUTE" || v === "HOUR" || v === "DAY") setForm({ ...form, periodUnit: v });
          }}
        >
          <SelectTrigger className="bg-[#0D0D0D] border-[#2A2A2A]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1A1A1A] border-[#2A2A2A]">
            <SelectItem value="MINUTE">Minutes</SelectItem>
            <SelectItem value="HOUR">Hours</SelectItem>
            <SelectItem value="DAY">Days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between rounded-lg border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2">
        <div>
          <p className="text-sm font-medium text-white">Free package</p>
          <p className="text-xs text-[#666]">No USD price — users see “Free”</p>
        </div>
        <Switch
          checked={form.isFree}
          onCheckedChange={(v) => setForm({ ...form, isFree: Boolean(v) })}
          aria-label="Free package"
        />
      </div>
      {!form.isFree && (
        <div className="space-y-2">
          <Label>Price (USD)</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.priceUsd}
            onChange={(e) => setForm({ ...form, priceUsd: e.target.value })}
            className="bg-[#0D0D0D] border-[#2A2A2A]"
          />
        </div>
      )}
      <div className="flex items-center justify-between rounded-lg border border-[#2A2A2A] bg-[#0D0D0D] px-3 py-2">
        <div>
          <p className="text-sm font-medium text-white">Active</p>
          <p className="text-xs text-[#666]">Inactive packages are hidden in the app</p>
        </div>
        <Switch
          checked={form.isActive}
          onCheckedChange={(v) => setForm({ ...form, isActive: Boolean(v) })}
          aria-label="Active"
        />
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">CLB mining</h2>
          <p className="text-sm text-[#888] mt-1">
            Define mining machine packages (output rate, time unit, price or free). They appear on the mobile{" "}
            <span className="text-[#F0B90B]">Mine CLB</span> screen.
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (open) setForm(emptyForm);
          }}
        >
          <DialogTrigger className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] transition-colors cursor-pointer">
            <Plus className="w-4 h-4 mr-2" /> New package
          </DialogTrigger>
          <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New mining package</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {formFields}
              <Button
                onClick={submitCreate}
                disabled={saving}
                className="w-full bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#F0B90B]" />
        </div>
      ) : packages.length === 0 ? (
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Cpu className="w-16 h-16 text-[#2A2A2A] mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No packages yet</h3>
            <p className="text-sm text-[#666] text-center max-w-md">
              Create a package with a name, how many tokens accrue per period, whether the period is minutes / hours /
              days, and a USD price or free.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {packages.map((p) => (
            <Card key={p.id} className="bg-[#1A1A1A] border-[#2A2A2A] hover:border-[#3A3A3A] transition-all group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/10 flex items-center justify-center shrink-0">
                      <Cpu className="w-5 h-5 text-[#F0B90B]" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-white text-base truncate">{p.name}</CardTitle>
                      <Badge className="mt-1 text-xs bg-[#2A2A2A] text-[#ccc] border-[#3A3A3A]">{p.tokenSymbol}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="p-1.5 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-white"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      className="p-1.5 rounded-md hover:bg-[#FF3D57]/10 text-[#999] hover:text-[#FF3D57]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 rounded-lg bg-[#0D0D0D] space-y-1">
                  <p className="text-lg font-bold text-white">
                    {p.tokensPerPeriod} <span className="text-[#F0B90B]">{p.tokenSymbol}</span>
                  </p>
                  <p className="text-xs text-[#888]">every {periodLabel(p.periodLength, p.periodUnit)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#888]">Price</span>
                  {p.isFree ? (
                    <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/20">Free</Badge>
                  ) : (
                    <span className="text-white font-semibold">${Number(p.priceUsd ?? 0).toFixed(2)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#666]">Sort {p.sortOrder}</span>
                  <Badge className={p.isActive ? "bg-[#00C853]/10 text-[#00C853]" : "bg-[#666]/20 text-[#999]"}>
                    {p.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {p.description && <p className="text-xs text-[#888] line-clamp-2">{p.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit mining package</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {formFields}
            <Button
              onClick={submitEdit}
              disabled={saving}
              className="w-full bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
