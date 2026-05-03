"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, Search, Loader2, Shield, UserCheck, UserX,
  Pencil, Trash2, Plus, ChevronLeft, ChevronRight, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatsCard } from "@/components/stats-card";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface User {
  id: string;
  walletAddress: string;
  username: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("clb_token");
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  return res.json();
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ username: "", email: "", role: "USER" });
  const [saving, setSaving] = useState(false);
  const [viewUser, setViewUser] = useState<User | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth<{ users: User[]; total: number }>(`/api/admin/users?page=${page}&limit=15&search=${search}`);
      if (res.users) {
        setUsers(res.users);
        setTotalUsers(res.total || res.users.length);
      } else {
        // Fallback: use profile endpoint for single admin demo
        const profile = await fetchWithAuth<{ success: boolean; user: User }>("/api/auth/profile");
        if (profile.success) {
          setUsers([profile.user]);
          setTotalUsers(1);
        }
      }
    } catch {
      // fallback
      const profile = await fetchWithAuth<{ success: boolean; user: User }>("/api/auth/profile");
      if (profile.success) { setUsers([profile.user]); setTotalUsers(1); }
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleEdit = (user: User) => {
    setEditUser(user);
    setEditForm({ username: user.username || "", email: user.email || "", role: user.role });
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await fetchWithAuth(`/api/admin/users/${editUser.id}`, {
        method: "PUT",
        body: JSON.stringify(editForm),
      });
      toast.success("User updated!");
      setEditUser(null);
      loadUsers();
    } catch {
      toast.error("Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await fetchWithAuth(`/api/admin/users/${user.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      toast.success(`User ${user.isActive ? "deactivated" : "activated"}`);
      loadUsers();
    } catch {
      toast.error("Failed to update user status");
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user ${user.walletAddress}? This cannot be undone.`)) return;
    try {
      await fetchWithAuth(`/api/admin/users/${user.id}`, { method: "DELETE" });
      toast.success("User deleted");
      loadUsers();
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const activeUsers = users.filter((u) => u.isActive).length;
  const adminUsers = users.filter((u) => u.role === "ADMIN").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">User Management</h2>
        <p className="text-sm text-[#888] mt-1">View, create, edit, and manage all platform users</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Total Users" value={totalUsers} icon={Users} color="blue" />
        <StatsCard title="Active Users" value={activeUsers} icon={UserCheck} color="green" />
        <StatsCard title="Admins" value={adminUsers} icon={Shield} color="gold" />
      </div>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-[#F0B90B]" /> All Users
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#666]" />
                <input
                  type="text"
                  placeholder="Search wallet or username..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="h-9 w-64 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] pl-9 pr-3 text-sm text-white placeholder:text-[#666] focus:outline-none focus:ring-1 focus:ring-[#F0B90B]"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#F0B90B]" /></div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-[#2A2A2A] mx-auto mb-4" />
              <p className="text-[#999]">No users found</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                    <TableHead className="text-[#999]">Wallet</TableHead>
                    <TableHead className="text-[#999]">Username</TableHead>
                    <TableHead className="text-[#999]">Email</TableHead>
                    <TableHead className="text-[#999]">Role</TableHead>
                    <TableHead className="text-[#999]">Status</TableHead>
                    <TableHead className="text-[#999]">Joined</TableHead>
                    <TableHead className="text-[#999] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                      <TableCell className="font-mono text-xs text-[#F0B90B]">{shortAddr(user.walletAddress)}</TableCell>
                      <TableCell className="text-white">{user.username || "—"}</TableCell>
                      <TableCell className="text-[#999] text-sm">{user.email || "—"}</TableCell>
                      <TableCell>
                        <Badge className={user.role === "ADMIN" ? "bg-[#F0B90B]/10 text-[#F0B90B]" : "bg-[#3B82F6]/10 text-[#3B82F6]"}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={user.isActive ? "bg-[#00C853]/10 text-[#00C853]" : "bg-[#FF3D57]/10 text-[#FF3D57]"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[#666]">{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setViewUser(user)} className="p-1.5 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-white" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleEdit(user)} className="p-1.5 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-white" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleToggleActive(user)} className={`p-1.5 rounded-md ${user.isActive ? "hover:bg-[#FF3D57]/10 text-[#999] hover:text-[#FF3D57]" : "hover:bg-[#00C853]/10 text-[#999] hover:text-[#00C853]"}`} title={user.isActive ? "Deactivate" : "Activate"}>
                            {user.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => handleDelete(user)} className="p-1.5 rounded-md hover:bg-[#FF3D57]/10 text-[#999] hover:text-[#FF3D57]" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalUsers > 15 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="border-[#2A2A2A] text-[#999]">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-[#999]">Page {page}</span>
                  <Button variant="outline" size="sm" disabled={users.length < 15} onClick={() => setPage(page + 1)} className="border-[#2A2A2A] text-[#999]">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* View User Dialog */}
      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white sm:max-w-md">
          <DialogHeader><DialogTitle>User Details</DialogTitle></DialogHeader>
          {viewUser && (
            <div className="space-y-3 mt-2">
              {[
                { label: "ID", value: viewUser.id },
                { label: "Wallet", value: viewUser.walletAddress },
                { label: "Username", value: viewUser.username || "—" },
                { label: "Email", value: viewUser.email || "—" },
                { label: "Role", value: viewUser.role },
                { label: "Status", value: viewUser.isActive ? "Active" : "Inactive" },
                { label: "Joined", value: new Date(viewUser.createdAt).toLocaleString() },
              ].map((item) => (
                <div key={item.label} className="flex justify-between p-2.5 rounded bg-[#0D0D0D]">
                  <span className="text-xs text-[#999]">{item.label}</span>
                  <span className="text-xs text-white font-mono truncate max-w-[250px]">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white sm:max-w-md">
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="bg-[#0D0D0D] border-[#2A2A2A]" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="w-full h-10 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 text-sm text-white">
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="MODERATOR">MODERATOR</option>
              </select>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Pencil className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
