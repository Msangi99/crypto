"use client";

import { useState } from "react";
import { Settings, User, Shield, Globe, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile({
        username: username || undefined,
        email: email || undefined,
      });
      await refreshProfile();
      toast.success("Profile updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <p className="text-[#999] mt-1">Manage your admin profile and system settings</p>
      </div>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-5 h-5 text-[#F0B90B]" />
            Admin Profile
          </CardTitle>
          <CardDescription className="text-[#999]">Update your display name and email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[#999]">Wallet Address</Label>
            <div className="flex items-center gap-2">
              <Input value={user?.walletAddress || ""} disabled className="bg-[#0D0D0D] border-[#2A2A2A] font-mono text-xs text-[#666]" />
              <Badge className="bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20">ADMIN</Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Display Name</Label>
            <Input placeholder="Enter your name" value={username} onChange={(e) => setUsername(e.target.value)} className="bg-[#0D0D0D] border-[#2A2A2A]" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-[#0D0D0D] border-[#2A2A2A]" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#00C853]" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-[#999]">Contract Address</span>
            <a
              href="https://testnet.bscscan.com/address/0x5fA4d61B529F88069a46B83451540aC4c2f96200"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-[#F0B90B] hover:underline"
            >
              0x5fA4...6200
            </a>
          </div>
          <Separator className="bg-[#2A2A2A]" />
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-[#999]">Network</span>
            <Badge className="bg-[#F0B90B]/10 text-[#F0B90B]">BSC Testnet (97)</Badge>
          </div>
          <Separator className="bg-[#2A2A2A]" />
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-[#999]">Backend API</span>
            <span className="text-sm text-[#999] font-mono">localhost:3000</span>
          </div>
          <Separator className="bg-[#2A2A2A]" />
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-[#999]">Database</span>
            <Badge className="bg-[#00C853]/10 text-[#00C853]">Neon PostgreSQL</Badge>
          </div>
          <Separator className="bg-[#2A2A2A]" />
          <div className="flex justify-between items-start py-2">
            <span className="text-sm text-[#999]">Referral System</span>
            <div className="text-right text-xs space-y-0.5">
              <p className="text-white">5-Level Commission (of Pool Fee)</p>
              <p className="text-[#F0B90B]">L1: 20% · L2: 8% · L3: 5% · L4: 3% · L5: 1%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#3B82F6]" />
            Quick Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <a href="https://testnet.bscscan.com/address/0x5fA4d61B529F88069a46B83451540aC4c2f96200" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A] hover:border-[#F0B90B]/30 transition-colors">
            <span className="text-sm text-white">View Contract on BscScan</span>
            <Settings className="w-4 h-4 text-[#999]" />
          </a>
          <a href="http://localhost:3000/docs" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A] hover:border-[#F0B90B]/30 transition-colors">
            <span className="text-sm text-white">Swagger API Docs</span>
            <Settings className="w-4 h-4 text-[#999]" />
          </a>
          <a href="https://github.com/Msangi99/crypto" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A] hover:border-[#F0B90B]/30 transition-colors">
            <span className="text-sm text-white">GitHub Repository</span>
            <Settings className="w-4 h-4 text-[#999]" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
