"use client";

import { useState } from "react";
import {
  Wallet, Globe, Copy, Check, ExternalLink, Shield,
  Smartphone, Monitor, Link2, AlertTriangle, CheckCircle2, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  symbol: string;
  explorer: string;
  status: "ACTIVE" | "TESTNET" | "PLANNED";
}

interface WalletInfo {
  name: string;
  icon: string;
  supported: boolean;
  deepLink: string;
  features: string[];
}

const networks: NetworkConfig[] = [
  {
    name: "BSC Testnet",
    chainId: 97,
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
    symbol: "tBNB",
    explorer: "https://testnet.bscscan.com",
    status: "ACTIVE",
  },
  {
    name: "BSC Mainnet",
    chainId: 56,
    rpcUrl: "https://bsc-dataseed1.binance.org",
    symbol: "BNB",
    explorer: "https://bscscan.com",
    status: "PLANNED",
  },
];

const wallets: WalletInfo[] = [
  {
    name: "MetaMask",
    icon: "🦊",
    supported: true,
    deepLink: "https://metamask.io/download/",
    features: ["Browser Extension", "Mobile App", "EIP-1193 Provider", "BSC Network Support", "Hardware Wallet Integration"],
  },
  {
    name: "Trust Wallet",
    icon: "🛡️",
    supported: true,
    deepLink: "https://trustwallet.com/download",
    features: ["Mobile-First", "DApp Browser", "WalletConnect V2", "Built-in DEX", "Multi-Chain Support"],
  },
  {
    name: "WalletConnect",
    icon: "🔗",
    supported: true,
    deepLink: "https://walletconnect.com/",
    features: ["QR Code Scanning", "50+ Wallet Support", "Session Management", "Deep Linking", "WC V2 Protocol"],
  },
  {
    name: "Binance Wallet",
    icon: "💰",
    supported: false,
    deepLink: "https://www.binance.com/en/web3wallet",
    features: ["Binance Integration", "BSC Native", "Swap Support", "Pending Integration"],
  },
];

const tokenContracts = [
  { name: "BTCB (Bitcoin BEP-20)", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", network: "BSC Mainnet" },
  { name: "ETH (Ethereum BEP-20)", address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", network: "BSC Mainnet" },
  { name: "USDT (Tether BEP-20)", address: "0x55d398326f99059fF775485246999027B3197955", network: "BSC Mainnet" },
  { name: "WBNB (Wrapped BNB)", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", network: "BSC Mainnet" },
];

const setupSteps = [
  { step: 1, title: "Install MetaMask/Trust Wallet", description: "Download and install the wallet extension or mobile app" },
  { step: 2, title: "Add BSC Network", description: "Configure BSC Testnet (Chain ID: 97) or Mainnet (Chain ID: 56)" },
  { step: 3, title: "Get tBNB (Testnet)", description: "Use faucet at https://testnet.bnbchain.org/faucet-smart to get test BNB" },
  { step: 4, title: "Connect to DApp", description: "Visit the platform and click 'Connect Wallet' to authenticate" },
  { step: 5, title: "Select Pool & Invest", description: "Choose a pool tier ($100-$1000), select BTC or ETH, and confirm transaction" },
];

export default function WalletsPage() {
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAddr(text);
    toast.success("Copied!");
    setTimeout(() => setCopiedAddr(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Wallet Configuration</h2>
        <p className="text-sm text-[#888] mt-1">Network settings, supported wallets, and user setup guides for MetaMask & Trust Wallet</p>
      </div>

      {/* Network Configs */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#F0B90B]" /> Supported Networks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {networks.map((net) => (
            <div key={net.chainId} className="p-4 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-white">{net.name}</span>
                  <Badge className={
                    net.status === "ACTIVE" ? "bg-[#00C853]/10 text-[#00C853] text-xs"
                    : net.status === "TESTNET" ? "bg-[#F0B90B]/10 text-[#F0B90B] text-xs"
                    : "bg-[#2A2A2A] text-[#666] text-xs"
                  }>{net.status}</Badge>
                </div>
                <a href={net.explorer} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F0B90B] hover:underline flex items-center gap-1">
                  Explorer <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Chain ID", value: String(net.chainId) },
                  { label: "Symbol", value: net.symbol },
                  { label: "RPC URL", value: net.rpcUrl },
                  { label: "Explorer", value: net.explorer },
                ].map((item) => (
                  <div key={item.label} className="p-2 rounded bg-[#111] group">
                    <p className="text-[10px] text-[#888] uppercase">{item.label}</p>
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-mono text-white truncate">{item.value}</p>
                      <button onClick={() => copyToClipboard(item.value)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {copiedAddr === item.value ? <Check className="w-3 h-3 text-[#00C853]" /> : <Copy className="w-3 h-3 text-[#666]" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Supported Wallets */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[#F0B90B]" /> Supported Wallets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {wallets.map((w) => (
              <div key={w.name} className={`p-4 rounded-lg border ${w.supported ? "bg-[#0D0D0D] border-[#2A2A2A]" : "bg-[#0D0D0D]/50 border-[#2A2A2A]/50 opacity-70"}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{w.icon}</span>
                    <span className="text-sm font-semibold text-white">{w.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={w.supported ? "bg-[#00C853]/10 text-[#00C853] text-xs" : "bg-[#2A2A2A] text-[#666] text-xs"}>
                      {w.supported ? "Supported" : "Planned"}
                    </Badge>
                    <a href={w.deepLink} target="_blank" rel="noopener noreferrer" className="text-[#F0B90B] hover:text-[#FCD535]">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {w.features.map((f) => (
                    <Badge key={f} className="bg-[#2A2A2A] text-[#999] text-[10px]">{f}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Contracts */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#F0B90B]" /> BEP-20 Token Contracts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tokenContracts.map((tc) => (
              <div key={tc.name} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A] group">
                <div>
                  <p className="text-xs font-medium text-white">{tc.name}</p>
                  <p className="text-[10px] font-mono text-[#666]">{tc.address.slice(0, 14)}…{tc.address.slice(-8)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => copyToClipboard(tc.address)} className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#666] hover:text-white">
                    {copiedAddr === tc.address ? <Check className="w-3 h-3 text-[#00C853]" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <a href={`https://bscscan.com/token/${tc.address}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#666] hover:text-[#F0B90B]">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* User Setup Guide */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#F0B90B]" /> User Setup Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {setupSteps.map((s) => (
              <div key={s.step} className="flex items-start gap-3 p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
                <div className="w-7 h-7 rounded-full bg-[#F0B90B]/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-[#F0B90B]">{s.step}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-white">{s.title}</p>
                  <p className="text-[10px] text-[#666] mt-0.5">{s.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
