"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeftRight, RefreshCw, ExternalLink, Loader2,
  TrendingUp, TrendingDown, Droplets, BarChart3, Percent, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PairData {
  pair: string;
  token0: string;
  token1: string;
  price: number;
  liquidity: string;
  volume24h: string;
  fee: string;
  change24h: number;
}

interface SwapEntry {
  id: string;
  pair: string;
  type: "BUY" | "SELL";
  amountIn: string;
  amountOut: string;
  price: string;
  slippage: string;
  txHash: string;
  time: string;
}

const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";

const pairs: PairData[] = [
  { pair: "BTCB/USDT", token0: "BTCB", token1: "USDT", price: 76130, liquidity: "$142.5M", volume24h: "$28.3M", fee: "0.25%", change24h: 2.15 },
  { pair: "ETH/USDT", token0: "ETH", token1: "USDT", price: 2268, liquidity: "$89.7M", volume24h: "$18.1M", fee: "0.25%", change24h: -0.87 },
  { pair: "BNB/USDT", token0: "BNB", token1: "USDT", price: 598, liquidity: "$215.3M", volume24h: "$45.6M", fee: "0.25%", change24h: 1.42 },
  { pair: "BTCB/BNB", token0: "BTCB", token1: "BNB", price: 127.3, liquidity: "$35.8M", volume24h: "$8.2M", fee: "0.25%", change24h: 0.68 },
  { pair: "ETH/BNB", token0: "ETH", token1: "BNB", price: 3.79, liquidity: "$22.1M", volume24h: "$5.4M", fee: "0.25%", change24h: -1.23 },
];

const recentSwaps: SwapEntry[] = [
  { id: "1", pair: "BTCB/USDT", type: "BUY", amountIn: "500 USDT", amountOut: "0.00657 BTCB", price: "$76,130", slippage: "0.12%", txHash: "0xabc1...def2", time: "2 min ago" },
  { id: "2", pair: "ETH/USDT", type: "BUY", amountIn: "250 USDT", amountOut: "0.1102 ETH", price: "$2,268", slippage: "0.08%", txHash: "0xghi3...jkl4", time: "5 min ago" },
  { id: "3", pair: "BTCB/USDT", type: "BUY", amountIn: "1,000 USDT", amountOut: "0.01314 BTCB", price: "$76,134", slippage: "0.15%", txHash: "0xmno5...pqr6", time: "12 min ago" },
  { id: "4", pair: "ETH/USDT", type: "SELL", amountIn: "0.5 ETH", amountOut: "1,133.5 USDT", price: "$2,267", slippage: "0.05%", txHash: "0xstu7...vwx8", time: "18 min ago" },
  { id: "5", pair: "BNB/USDT", type: "BUY", amountIn: "100 USDT", amountOut: "0.1672 BNB", price: "$598", slippage: "0.03%", txHash: "0xyz9...abc0", time: "25 min ago" },
];

const slippageConfig = [
  { label: "Low", value: "0.1%", description: "Trade might fail if price moves", color: "#00C853" },
  { label: "Standard", value: "0.5%", description: "Recommended for most trades", color: "#F0B90B" },
  { label: "High", value: "1.0%", description: "Higher chance of execution", color: "#FF3D57" },
  { label: "Custom", value: "Auto", description: "System adjusts per pool size", color: "#3B82F6" },
];

export default function LiquidityPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  const fetchLivePrices = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=usd&include_24hr_change=true"
      );
      const data = await res.json();
      setLivePrices({
        BTC: data.bitcoin?.usd || 0,
        ETH: data.ethereum?.usd || 0,
        BNB: data.binancecoin?.usd || 0,
      });
    } catch { /* keep defaults */ }
  }, []);

  useEffect(() => {
    fetchLivePrices();
    const interval = setInterval(fetchLivePrices, 60000);
    return () => clearInterval(interval);
  }, [fetchLivePrices]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchLivePrices();
    setTimeout(() => setRefreshing(false), 600);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">PancakeSwap Liquidity</h2>
          <p className="text-sm text-[#888] mt-1">Monitor DEX pairs, swap routes, and slippage for BTC/ETH pool operations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleRefresh} variant="outline" size="sm" disabled={refreshing} className="border-[#2A2A2A] text-[#999] hover:text-white hover:bg-[#2A2A2A]">
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <a href="https://pancakeswap.finance/swap" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-[#2A2A2A] text-[#F0B90B] hover:bg-[#F0B90B]/10">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> PancakeSwap
            </Button>
          </a>
        </div>
      </div>

      {/* Contract Addresses */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#888]">Router V2:</span>
              <span className="text-xs font-mono text-[#F0B90B]">{PANCAKE_ROUTER.slice(0, 10)}…{PANCAKE_ROUTER.slice(-6)}</span>
              <a href={`https://bscscan.com/address/${PANCAKE_ROUTER}`} target="_blank" rel="noopener noreferrer" className="text-[#666] hover:text-[#F0B90B]">
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#888]">Factory:</span>
              <span className="text-xs font-mono text-[#F0B90B]">{PANCAKE_FACTORY.slice(0, 10)}…{PANCAKE_FACTORY.slice(-6)}</span>
              <a href={`https://bscscan.com/address/${PANCAKE_FACTORY}`} target="_blank" rel="noopener noreferrer" className="text-[#666] hover:text-[#F0B90B]">
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <Badge className="bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20">BSC Mainnet</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tracked Pairs", value: pairs.length.toString(), icon: ArrowLeftRight, color: "#F0B90B" },
          { label: "BTC/USD Live", value: livePrices.BTC ? `$${livePrices.BTC.toLocaleString()}` : "Loading…", icon: TrendingUp, color: "#F7931A" },
          { label: "ETH/USD Live", value: livePrices.ETH ? `$${livePrices.ETH.toLocaleString()}` : "Loading…", icon: TrendingUp, color: "#627EEA" },
          { label: "BNB/USD Live", value: livePrices.BNB ? `$${livePrices.BNB.toLocaleString()}` : "Loading…", icon: TrendingUp, color: "#F0B90B" },
        ].map((s) => (
          <Card key={s.label} className="bg-[#1A1A1A] border-[#2A2A2A]">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${s.color}15` }}>
                <s.icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-xs text-[#888] uppercase tracking-wider">{s.label}</p>
                <p className="text-lg font-bold text-white font-mono">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pair Table */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Droplets className="w-4 h-4 text-[#F0B90B]" /> Tracked Pairs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                <TableHead className="text-[#999]">Pair</TableHead>
                <TableHead className="text-[#999]">Price</TableHead>
                <TableHead className="text-[#999]">Liquidity</TableHead>
                <TableHead className="text-[#999]">24h Volume</TableHead>
                <TableHead className="text-[#999]">Fee</TableHead>
                <TableHead className="text-[#999]">24h Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pairs.map((p) => (
                <TableRow key={p.pair} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1">
                        <div className="w-6 h-6 rounded-full bg-[#F7931A]/10 flex items-center justify-center text-[8px] font-bold text-[#F7931A] ring-1 ring-[#1A1A1A]">{p.token0.charAt(0)}</div>
                        <div className="w-6 h-6 rounded-full bg-[#627EEA]/10 flex items-center justify-center text-[8px] font-bold text-[#627EEA] ring-1 ring-[#1A1A1A]">{p.token1.charAt(0)}</div>
                      </div>
                      <span className="text-sm font-medium text-white">{p.pair}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-white">${p.price.toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-[#999]">{p.liquidity}</TableCell>
                  <TableCell className="text-sm text-[#999]">{p.volume24h}</TableCell>
                  <TableCell><Badge className="bg-[#2A2A2A] text-[#999] text-xs">{p.fee}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {p.change24h >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-[#00C853]" /> : <TrendingDown className="w-3.5 h-3.5 text-[#FF3D57]" />}
                      <span className={`text-sm font-medium ${p.change24h >= 0 ? "text-[#00C853]" : "text-[#FF3D57]"}`}>
                        {p.change24h >= 0 ? "+" : ""}{p.change24h.toFixed(2)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Swaps */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A] lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#F0B90B]" /> Recent Platform Swaps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                  <TableHead className="text-[#999]">Pair</TableHead>
                  <TableHead className="text-[#999]">Type</TableHead>
                  <TableHead className="text-[#999]">In</TableHead>
                  <TableHead className="text-[#999]">Out</TableHead>
                  <TableHead className="text-[#999]">Slippage</TableHead>
                  <TableHead className="text-[#999]">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSwaps.map((s) => (
                  <TableRow key={s.id} className="border-[#2A2A2A] hover:bg-[#0D0D0D]">
                    <TableCell className="text-xs text-white font-medium">{s.pair}</TableCell>
                    <TableCell>
                      <Badge className={s.type === "BUY" ? "bg-[#00C853]/10 text-[#00C853] text-xs" : "bg-[#FF3D57]/10 text-[#FF3D57] text-xs"}>
                        {s.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-[#999] font-mono">{s.amountIn}</TableCell>
                    <TableCell className="text-xs text-white font-mono">{s.amountOut}</TableCell>
                    <TableCell className="text-xs text-[#F0B90B] font-mono">{s.slippage}</TableCell>
                    <TableCell className="text-xs text-[#666]">{s.time}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Slippage Config */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Percent className="w-4 h-4 text-[#F0B90B]" /> Slippage Tolerance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {slippageConfig.map((sc) => (
              <div key={sc.label} className="flex items-center justify-between p-3 rounded-lg bg-[#0D0D0D] border border-[#2A2A2A]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sc.color }} />
                  <div>
                    <p className="text-xs font-medium text-white">{sc.label}</p>
                    <p className="text-[10px] text-[#666]">{sc.description}</p>
                  </div>
                </div>
                <Badge style={{ backgroundColor: `${sc.color}15`, color: sc.color }} className="text-xs font-mono">{sc.value}</Badge>
              </div>
            ))}
            <div className="mt-2 p-3 rounded-lg bg-[#F0B90B]/5 border border-[#F0B90B]/20 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-[#F0B90B] mt-0.5 shrink-0" />
              <p className="text-[10px] text-[#F0B90B]">Platform uses PancakeSwap Router V2 to convert user BNB deposits into BTCB/ETH at the best available rate with auto-slippage protection.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
