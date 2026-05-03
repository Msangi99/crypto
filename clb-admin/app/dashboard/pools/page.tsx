"use client";

import { useEffect, useState } from "react";
import { Plus, Waves, TrendingUp, Users as UsersIcon, Loader2, Pencil, Trash2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface Pool {
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

export default function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    tokenSymbol: "BNB",
    minDeposit: "0.01",
    maxDeposit: "100",
    apy: "10",
    contractAddress: "0x5fA4d61B529F88069a46B83451540aC4c2f96200",
  });

  const [editPool, setEditPool] = useState<Pool | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", apy: "", minDeposit: "", status: "" });

  const loadPools = async () => {
    try {
      const res = await api.getPools(1, 50);
      setPools(res.data);
    } catch (err) {
      console.error("Failed to load pools:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPools(); }, []);

  const handleEditOpen = (pool: Pool) => {
    setEditPool(pool);
    setEditForm({
      name: pool.name,
      description: pool.description || "",
      apy: String(pool.apy),
      minDeposit: String(pool.minDeposit),
      status: pool.status,
    });
  };

  const handleEditSave = async () => {
    if (!editPool) return;
    try {
      await api.updatePool(editPool.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        apy: parseFloat(editForm.apy),
        minDeposit: parseFloat(editForm.minDeposit),
        status: editForm.status as "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED",
      });
      toast.success("Pool updated");
      setEditPool(null);
      loadPools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const handleDelete = async (pool: Pool) => {
    if (!confirm(`Delete "${pool.name}"? This will remove all associated deposits and memberships.`)) return;
    try {
      await api.deletePool(pool.id);
      toast.success("Pool deleted");
      loadPools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const handleStatusToggle = async (pool: Pool) => {
    const newStatus = pool.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      await api.updatePool(pool.id, { status: newStatus });
      toast.success(`Pool ${newStatus.toLowerCase()}`);
      loadPools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle status");
    }
  };

  const handleCreate = async () => {
    if (!form.name) { toast.error("Pool name is required"); return; }
    setCreating(true);
    try {
      await api.createPool({
        name: form.name,
        description: form.description || undefined,
        tokenSymbol: form.tokenSymbol,
        minDeposit: parseFloat(form.minDeposit),
        maxDeposit: parseFloat(form.maxDeposit),
        apy: parseFloat(form.apy),
        contractAddress: form.contractAddress || undefined,
      });
      toast.success("Pool created successfully!");
      setDialogOpen(false);
      setForm({ name: "", description: "", tokenSymbol: "BNB", minDeposit: "0.01", maxDeposit: "100", apy: "10", contractAddress: "0x5fA4d61B529F88069a46B83451540aC4c2f96200" });
      loadPools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create pool");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Pool Management</h2>
          <p className="text-[#999] mt-1">Create and manage staking pools</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] transition-colors cursor-pointer">
            <Plus className="w-4 h-4 mr-2" /> Create Pool
          </DialogTrigger>
          <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white">
            <DialogHeader>
              <DialogTitle>Create New Pool</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Pool Name *</Label>
                <Input placeholder="e.g. CLB Gold Pool" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Pool description..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Token Symbol</Label>
                  <Input value={form.tokenSymbol} onChange={(e) => setForm({ ...form, tokenSymbol: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
                </div>
                <div className="space-y-2">
                  <Label>APY (%)</Label>
                  <Input type="number" value={form.apy} onChange={(e) => setForm({ ...form, apy: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Min Deposit (BNB)</Label>
                  <Input type="number" step="0.01" value={form.minDeposit} onChange={(e) => setForm({ ...form, minDeposit: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
                </div>
                <div className="space-y-2">
                  <Label>Max Deposit (BNB)</Label>
                  <Input type="number" step="0.01" value={form.maxDeposit} onChange={(e) => setForm({ ...form, maxDeposit: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Contract Address</Label>
                <Input placeholder="0x..." value={form.contractAddress} onChange={(e) => setForm({ ...form, contractAddress: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A] font-mono text-xs" />
              </div>
              <Button onClick={handleCreate} disabled={creating} className="w-full bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold">
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Pool
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Waves className="w-5 h-5 text-[#F0B90B]" />
            All Pools
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#F0B90B]" />
            </div>
          ) : pools.length === 0 ? (
            <div className="text-center py-12">
              <Waves className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
              <p className="text-[#999]">No pools yet. Create your first pool!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                  <TableHead className="text-[#999]">Pool</TableHead>
                  <TableHead className="text-[#999]">APY</TableHead>
                  <TableHead className="text-[#999]">Total Staked</TableHead>
                  <TableHead className="text-[#999]">Members</TableHead>
                  <TableHead className="text-[#999]">Min/Max</TableHead>
                  <TableHead className="text-[#999]">Status</TableHead>
                  <TableHead className="text-[#999]">Created</TableHead>
                  <TableHead className="text-[#999]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pools.map((pool) => (
                  <TableRow key={pool.id} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{pool.name}</p>
                        <p className="text-xs text-[#666]">{pool.tokenSymbol}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[#00C853] font-medium flex items-center">
                        <TrendingUp className="w-3 h-3 mr-1" /> {pool.apy}%
                      </span>
                    </TableCell>
                    <TableCell className="text-white">{pool.totalStaked} BNB</TableCell>
                    <TableCell>
                      <span className="flex items-center text-[#999]">
                        <UsersIcon className="w-3 h-3 mr-1" /> {pool.memberCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-[#999]">
                      {pool.minDeposit} / {pool.maxDeposit || "∞"}
                    </TableCell>
                    <TableCell>
                      <Badge className={pool.status === "ACTIVE" ? "bg-[#00C853]/10 text-[#00C853] border-[#00C853]/20" : "bg-[#FF3D57]/10 text-[#FF3D57] border-[#FF3D57]/20"}>
                        {pool.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-[#666]">
                      {new Date(pool.startDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleStatusToggle(pool)} className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#999] hover:text-white" title={pool.status === "ACTIVE" ? "Pause" : "Activate"}>
                          {pool.status === "ACTIVE" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => handleEditOpen(pool)} className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#999] hover:text-white" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(pool)} className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#999] hover:text-[#FF3D57]" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editPool} onOpenChange={() => setEditPool(null)}>
        <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white">
          <DialogHeader>
            <DialogTitle>Edit Pool</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Pool Name</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>APY (%)</Label>
                <Input type="number" value={editForm.apy} onChange={(e) => setEditForm({ ...editForm, apy: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
              </div>
              <div className="space-y-2">
                <Label>Min Deposit</Label>
                <Input type="number" step="0.01" value={editForm.minDeposit} onChange={(e) => setEditForm({ ...editForm, minDeposit: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="w-full h-10 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 text-sm text-white">
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <Button onClick={handleEditSave} className="w-full bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
