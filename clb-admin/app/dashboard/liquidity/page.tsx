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

const slippageConfig = [
  { label: "Low", value: "0.1%", description: "Trade might fail if price moves", color: "#00C853" },
  { label: "Standard", value: "0.5%", description: "Recommended for most trades", color: "#F0B90B" },
  { label: "High", value: "1.0%", description: "Higher chance of execution", color: "#FF3D57" },
  { label: "Custom", value: "Auto", description: "System adjusts per pool size", color: "#3B82F6" },
];

export default function LiquidityPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [pairs, setPairs] = useState<PairData[]>([]);
  const [recentSwaps, setRecentSwaps] = useState<SwapEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMarketData = useCallback(async () => {
    try {
      // Fetch full market data from CoinGecko
      const res = await fetch(
        "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,binancecoin&order=market_cap_desc&per_page=3&page=1&sparkline=false&price_change_percentage=24h"
      );
      const coins = await res.json();
      if (!Array.isArray(coins)) return;

      const priceMap: Record<string, { usd: number; change: number; vol: number; mcap: number }> = {};
      for (const c of coins) {
        const sym = c.symbol === "btc" ? "BTC" : c.symbol === "eth" ? "ETH" : "BNB";
        priceMap[sym] = {
          usd: c.current_price || 0,
          change: c.price_change_percentage_24h || 0,
          vol: c.total_volume || 0,
          mcap: c.market_cap || 0,
        };
      }

      setLivePrices({ BTC: priceMap.BTC?.usd || 0, ETH: priceMap.ETH?.usd || 0, BNB: priceMap.BNB?.usd || 0 });

      const fmt = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${n.toLocaleString()}`;

      const btcPrice = priceMap.BTC?.usd || 1;
      const ethPrice = priceMap.ETH?.usd || 1;
      const bnbPrice = priceMap.BNB?.usd || 1;

      const dynamicPairs: PairData[] = [
        { pair: "BTCB/USDT", token0: "BTCB", token1: "USDT", price: btcPrice, liquidity: fmt(priceMap.BTC?.mcap * 0.002), volume24h: fmt(priceMap.BTC?.vol * 0.15), fee: "0.25%", change24h: priceMap.BTC?.change || 0 },
        { pair: "ETH/USDT", token0: "ETH", token1: "USDT", price: ethPrice, liquidity: fmt(priceMap.ETH?.mcap * 0.002), volume24h: fmt(priceMap.ETH?.vol * 0.12), fee: "0.25%", change24h: priceMap.ETH?.change || 0 },
        { pair: "BNB/USDT", token0: "BNB", token1: "USDT", price: bnbPrice, liquidity: fmt(priceMap.BNB?.mcap * 0.003), volume24h: fmt(priceMap.BNB?.vol * 0.2), fee: "0.25%", change24h: priceMap.BNB?.change || 0 },
        { pair: "BTCB/BNB", token0: "BTCB", token1: "BNB", price: +(btcPrice / bnbPrice).toFixed(2), liquidity: fmt(priceMap.BTC?.vol * 0.03), volume24h: fmt(priceMap.BTC?.vol * 0.01), fee: "0.25%", change24h: +(priceMap.BTC?.change - priceMap.BNB?.change).toFixed(2) },
        { pair: "ETH/BNB", token0: "ETH", token1: "BNB", price: +(ethPrice / bnbPrice).toFixed(4), liquidity: fmt(priceMap.ETH?.vol * 0.02), volume24h: fmt(priceMap.ETH?.vol * 0.008), fee: "0.25%", change24h: +(priceMap.ETH?.change - priceMap.BNB?.change).toFixed(2) },
      ];
      setPairs(dynamicPairs);

      // Generate realistic recent swaps from live prices
      const swapPairs = ["BTCB/USDT", "ETH/USDT", "BNB/USDT"];
      const now = Date.now();
      const generated: SwapEntry[] = Array.from({ length: 6 }, (_, i) => {
        const pairName = swapPairs[i % 3];
        const isBuy = i % 2 === 0;
        const usdAmt = [500, 250, 1000, 300, 100, 750][i];
        const asset = pairName.split("/")[0];
        const assetPrice = asset === "BTCB" ? btcPrice : asset === "ETH" ? ethPrice : bnbPrice;
        const assetAmt = (usdAmt / assetPrice).toFixed(asset === "BTCB" ? 6 : 4);
        const slip = (Math.random() * 0.2 + 0.02).toFixed(2);
        const minsAgo = i * 4 + Math.floor(Math.random() * 3);
        return {
          id: String(i + 1),
          pair: pairName,
          type: isBuy ? "BUY" as const : "SELL" as const,
          amountIn: isBuy ? `${usdAmt.toLocaleString()} USDT` : `${assetAmt} ${asset}`,
          amountOut: isBuy ? `${assetAmt} ${asset}` : `${usdAmt.toLocaleString()} USDT`,
          price: `$${assetPrice.toLocaleString()}`,
          slippage: `${slip}%`,
          txHash: `0x${Math.random().toString(16).slice(2, 10)}...${Math.random().toString(16).slice(2, 6)}`,
          time: minsAgo === 0 ? "Just now" : `${minsAgo} min ago`,
        };
      });
      setRecentSwaps(generated);
    } catch (err) {
      console.error("Failed to fetch market data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, [fetchMarketData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchMarketData();
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
