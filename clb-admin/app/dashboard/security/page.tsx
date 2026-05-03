"use client";

import { useState } from "react";
import {
  ShieldAlert, ShieldCheck, Lock, Key, AlertTriangle,
  CheckCircle2, Clock, ExternalLink, Pause, Play,
  FileSearch, Users, Fingerprint, Globe,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AuditEntry {
  auditor: string;
  status: "PASSED" | "IN_PROGRESS" | "SCHEDULED" | "NOT_STARTED";
  date: string;
  findings: { critical: number; high: number; medium: number; low: number; info: number };
  reportUrl: string | null;
}

interface MultiSigKey {
  label: string;
  address: string;
  role: string;
  lastActive: string;
}

const audits: AuditEntry[] = [
  {
    auditor: "CertiK",
    status: "SCHEDULED",
    date: "Q3 2026",
    findings: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    reportUrl: null,
  },
  {
    auditor: "PeckShield",
    status: "NOT_STARTED",
    date: "Q4 2026",
    findings: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    reportUrl: null,
  },
  {
    auditor: "Hacken",
    status: "NOT_STARTED",
    date: "TBD",
    findings: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    reportUrl: null,
  },
];

const multiSigKeys: MultiSigKey[] = [
  { label: "Deployer (Admin 1)", address: "0x5fA4d61B529F88069a46B83451540aC4c2f96200", role: "Owner / Deployer", lastActive: "Active now" },
  { label: "Admin 2 (Treasury)", address: "0x0000...0002", role: "Treasury Manager", lastActive: "Pending setup" },
  { label: "Admin 3 (Security)", address: "0x0000...0003", role: "Security Officer", lastActive: "Pending setup" },
  { label: "Admin 4 (Operations)", address: "0x0000...0004", role: "Operations Lead", lastActive: "Pending setup" },
  { label: "Admin 5 (Reserve)", address: "0x0000...0005", role: "Reserve Signer", lastActive: "Pending setup" },
];

const securityFeatures = [
  { name: "ReentrancyGuard", status: true, description: "Prevents re-entrant attacks on all external functions" },
  { name: "Ownable2Step", status: true, description: "Two-step ownership transfer to prevent accidental loss" },
  { name: "Pausable", status: true, description: "Emergency pause capability for all user-facing functions" },
  { name: "AccessControl", status: true, description: "Role-based access for Admin, Moderator, and User" },
  { name: "Pull Over Push", status: true, description: "Users withdraw funds instead of automatic sends" },
  { name: "Rate Limiting", status: false, description: "Limit deposits per block to prevent flash-loan attacks" },
  { name: "Timelock Controller", status: false, description: "24-hour delay for critical admin operations" },
  { name: "Gnosis Safe Multi-Sig", status: false, description: "3-of-5 multi-sig for contract upgrades and withdrawals" },
];

const auditStatusConfig = {
  PASSED: { color: "text-[#00C853]", bg: "bg-[#00C853]/10", icon: CheckCircle2 },
  IN_PROGRESS: { color: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10", icon: Clock },
  SCHEDULED: { color: "text-[#3B82F6]", bg: "bg-[#3B82F6]/10", icon: Clock },
  NOT_STARTED: { color: "text-[#666]", bg: "bg-[#2A2A2A]", icon: Clock },
};

export default function SecurityPage() {
  const [paused, setPaused] = useState(false);

  const handleEmergencyPause = () => {
    if (!confirm(paused
      ? "Are you sure you want to UNPAUSE the contract? This will re-enable all user operations."
      : "⚠️ EMERGENCY PAUSE ⚠️\n\nThis will immediately halt ALL deposits, withdrawals, and pool operations.\n\nAre you absolutely sure?"
    )) return;
    setPaused(!paused);
    toast.success(paused ? "Contract UNPAUSED — operations resumed" : "⚠️ Contract PAUSED — all operations halted");
  };

  const enabledCount = securityFeatures.filter((f) => f.status).length;
  const totalFeatures = securityFeatures.length;
  const securityScore = Math.round((enabledCount / totalFeatures) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Security & Audit Management</h2>
          <p className="text-sm text-[#888] mt-1">Contract audits, multi-sig configuration, and emergency controls</p>
        </div>
        <Button
          onClick={handleEmergencyPause}
          className={paused
            ? "bg-[#00C853] hover:bg-[#00C853]/80 text-white font-semibold"
            : "bg-[#FF3D57] hover:bg-[#FF3D57]/80 text-white font-semibold"
          }
        >
          {paused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
          {paused ? "Unpause Contract" : "Emergency Pause"}
        </Button>
      </div>

      {/* Contract Status Banner */}
      {paused && (
        <div className="p-4 rounded-xl bg-[#FF3D57]/10 border border-[#FF3D57]/30 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-[#FF3D57] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[#FF3D57]">CONTRACT IS PAUSED</p>
            <p className="text-xs text-[#FF3D57]/70">All deposits, withdrawals, and pool operations are currently halted.</p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${securityScore >= 80 ? "bg-[#00C853]/10" : securityScore >= 50 ? "bg-[#F0B90B]/10" : "bg-[#FF3D57]/10"}`}>
              <ShieldCheck className={`w-5 h-5 ${securityScore >= 80 ? "text-[#00C853]" : securityScore >= 50 ? "text-[#F0B90B]" : "text-[#FF3D57]"}`} />
            </div>
            <div>
              <p className="text-xs text-[#888] uppercase tracking-wider">Security Score</p>
              <p className="text-xl font-bold text-white">{securityScore}%</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
              <FileSearch className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div>
              <p className="text-xs text-[#888] uppercase tracking-wider">Audits</p>
              <p className="text-xl font-bold text-white">{audits.filter((a) => a.status === "PASSED").length}/{audits.length} passed</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F0B90B]/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-[#F0B90B]" />
            </div>
            <div>
              <p className="text-xs text-[#888] uppercase tracking-wider">Multi-Sig</p>
              <p className="text-xl font-bold text-white">3 of 5 required</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${paused ? "bg-[#FF3D57]/10" : "bg-[#00C853]/10"}`}>
              {paused ? <Pause className="w-5 h-5 text-[#FF3D57]" /> : <Play className="w-5 h-5 text-[#00C853]" />}
            </div>
            <div>
              <p className="text-xs text-[#888] uppercase tracking-wider">Status</p>
              <p className={`text-xl font-bold ${paused ? "text-[#FF3D57]" : "text-[#00C853]"}`}>{paused ? "Paused" : "Active"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Audit Status */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-[#F0B90B]" />
              Smart Contract Audits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {audits.map((audit) => {
              const cfg = auditStatusConfig[audit.status];
              const StatusIcon = cfg.icon;
              return (
                <div key={audit.auditor} className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                      <StatusIcon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{audit.auditor}</p>
                      <p className="text-xs text-[#666]">{audit.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${cfg.bg} ${cfg.color} text-xs`}>
                      {audit.status.replace("_", " ")}
                    </Badge>
                    {audit.reportUrl && (
                      <a href={audit.reportUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md hover:bg-[#2A2A2A] text-[#999] hover:text-[#F0B90B]">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Security Features */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#F0B90B]" />
              Security Features
              <Badge className="bg-[#2A2A2A] text-[#999] text-xs ml-2">{enabledCount}/{totalFeatures} active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {securityFeatures.map((feat) => (
              <div key={feat.name} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {feat.status ? (
                    <CheckCircle2 className="w-4 h-4 text-[#00C853] shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-[#666] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs font-medium ${feat.status ? "text-white" : "text-[#666]"}`}>{feat.name}</p>
                    <p className="text-[10px] text-[#666] truncate">{feat.description}</p>
                  </div>
                </div>
                <Badge className={feat.status ? "bg-[#00C853]/10 text-[#00C853] text-[10px]" : "bg-[#2A2A2A] text-[#666] text-[10px]"}>
                  {feat.status ? "ENABLED" : "PLANNED"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Multi-Sig Keys */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Key className="w-4 h-4 text-[#F0B90B]" />
              Gnosis Safe Multi-Sig (3 of 5)
            </CardTitle>
            <Badge className="bg-[#F0B90B]/10 text-[#F0B90B] text-xs">
              Threshold: 3/5
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {multiSigKeys.map((key, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F0B90B]/10 flex items-center justify-center">
                  <Fingerprint className="w-4 h-4 text-[#F0B90B]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{key.label}</p>
                  <p className="text-xs font-mono text-[#666]">{key.address.length > 20 ? `${key.address.slice(0, 10)}…${key.address.slice(-6)}` : key.address}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#999]">{key.role}</p>
                <p className={`text-[10px] ${key.lastActive === "Active now" ? "text-[#00C853]" : "text-[#666]"}`}>{key.lastActive}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Penetration Testing */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#3B82F6]" />
            Penetration Testing & Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Smart Contract Pentest", status: "Scheduled", color: "text-[#3B82F6]", bg: "bg-[#3B82F6]/10" },
              { label: "API Security Audit", status: "In Progress", color: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10" },
              { label: "Frontend XSS/CSRF Check", status: "Not Started", color: "text-[#666]", bg: "bg-[#2A2A2A]" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A] text-center">
                <p className="text-xs text-[#888] mb-2">{item.label}</p>
                <Badge className={`${item.bg} ${item.color} text-xs`}>{item.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
