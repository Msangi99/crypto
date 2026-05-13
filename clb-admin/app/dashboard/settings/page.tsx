"use client";

import { useEffect, useState } from "react";
import { Settings, User, Shield, Globe, Loader2, Save, FlaskConical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [freePoolsEnabled, setFreePoolsEnabled] = useState(false);
  const [depositTreasuryAddress, setDepositTreasuryAddress] = useState("");
  const [usdtBep20Address, setUsdtBep20Address] = useState("");
  const [depositMinUsd, setDepositMinUsd] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingDeposit, setSavingDeposit] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      setLoadingSettings(true);
      try {
        const res = await api.getAdminSettings();
        setFreePoolsEnabled(Boolean(res.settings.freePoolsEnabled));
        setDepositTreasuryAddress(res.settings.depositTreasuryAddress?.trim() || "");
        setUsdtBep20Address(res.settings.usdtBep20Address?.trim() || "");
        setDepositMinUsd(res.settings.depositMinUsd ? String(res.settings.depositMinUsd) : "");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load system settings");
      } finally {
        setLoadingSettings(false);
      }
    };
    loadSettings();
  }, []);

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

  const handleSaveSystemSettings = async () => {
    setSavingSettings(true);
    try {
      await api.updateAdminSettings({ freePoolsEnabled });
      toast.success("Pool access mode updated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update system settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveDepositReceive = async () => {
    const raw = depositTreasuryAddress.trim();
    if (raw && (!raw.startsWith("0x") || raw.length !== 42)) {
      toast.error("Treasury must be a valid BEP-20 address (0x + 40 hex characters).");
      return;
    }
    const contractRaw = usdtBep20Address.trim();
    if (contractRaw && (!contractRaw.startsWith("0x") || contractRaw.length !== 42)) {
      toast.error("USDT contract must be a valid address or left empty.");
      return;
    }
    const minUsd = parseFloat(depositMinUsd);
    if (depositMinUsd && (isNaN(minUsd) || minUsd <= 0)) {
      toast.error("Minimum deposit must be a positive number.");
      return;
    }
    setSavingDeposit(true);
    try {
      await api.updateAdminSettings({
        depositTreasuryAddress: raw || null,
        usdtBep20Address: contractRaw || null,
        depositMinUsd: depositMinUsd ? minUsd : null,
      });
      toast.success("USDT receive settings saved. Mobile app will show QR + address.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save deposit settings");
    } finally {
      setSavingDeposit(false);
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
              <p className="text-[#F0B90B]">L1: 20% · L2: 7% · L3: 4% · L4: 3% · L5: 1%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#F0B90B]" />
            USDT deposit receive (mobile app)
          </CardTitle>
          <CardDescription className="text-[#999]">
            Users tap Deposit in the CLB app, choose BEP-20 USDT, and send to this treasury address. The app shows a QR code
            and copy button only after you save a valid address here. Must match your API server chain (BSC mainnet 56 or testnet 97).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSettings ? (
            <div className="flex items-center gap-2 text-[#999] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Treasury wallet (BEP-20) — where users send USDT *</Label>
                <Input
                  placeholder="0x… your platform hot wallet on BSC"
                  value={depositTreasuryAddress}
                  onChange={(e) => setDepositTreasuryAddress(e.target.value)}
                  className="bg-[#0D0D0D] border-[#2A2A2A] font-mono text-xs"
                />
                <p className="text-xs text-[#666]">
                  This is the &quot;receive&quot; address shown in the app. Without it, the app shows &quot;Not configured&quot;.
                </p>
              </div>
              <div className="space-y-2">
                <Label>USDT contract (optional)</Label>
                <Input
                  placeholder="Leave empty → use server .env USDT_BEP20_ADDRESS"
                  value={usdtBep20Address}
                  onChange={(e) => setUsdtBep20Address(e.target.value)}
                  className="bg-[#0D0D0D] border-[#2A2A2A] font-mono text-xs"
                />
                <p className="text-xs text-[#666]">
                  Override only if your USDT token address differs from the default for your chain.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Minimum deposit amount (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="10"
                  value={depositMinUsd}
                  onChange={(e) => setDepositMinUsd(e.target.value)}
                  className="bg-[#0D0D0D] border-[#2A2A2A] font-mono text-xs"
                />
                <p className="text-xs text-[#666]">
                  Minimum USDT deposit amount. Leave empty to use server default (10 USD).
                </p>
              </div>
              <Button
                onClick={handleSaveDepositReceive}
                disabled={loadingSettings || savingDeposit}
                className="bg-[#00C853] text-white hover:bg-[#00E676] font-semibold"
              >
                {savingDeposit ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save USDT receive settings
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-[#F0B90B]" />
            Pool Access Mode
          </CardTitle>
          <CardDescription className="text-[#999]">
            Control whether pool joins require real on-chain payment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingSettings ? (
            <div className="flex items-center gap-2 text-[#999] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading pool access settings...
            </div>
          ) : (
            <fieldset className="space-y-3 border border-[#2A2A2A] rounded-lg p-4 bg-[#0D0D0D]">
              <legend className="px-2 text-xs uppercase tracking-wide text-[#999]">Free Pools Mode</legend>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white font-medium">Allow Free Pool Join</p>
                  <p className="text-xs text-[#999] mt-1">
                    When enabled, users can join pools without real payment and deposits are marked as FREE_MODE.
                  </p>
                </div>
                <Switch checked={freePoolsEnabled} onCheckedChange={setFreePoolsEnabled} aria-label="Allow free pool join mode" />
              </div>
            </fieldset>
          )}
          <div className="rounded-md border border-[#F0B90B]/30 bg-[#F0B90B]/10 p-3 text-xs text-[#F0B90B]">
            Warning: Enabling free pools bypasses real payment checks for all clients.
          </div>
          <Button onClick={handleSaveSystemSettings} disabled={loadingSettings || savingSettings} className="bg-[#F0B90B] text-[#0D0D0D] hover:bg-[#FCD535] font-semibold">
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Pool Access Mode
          </Button>
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
