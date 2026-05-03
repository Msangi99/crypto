"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Circle, TrendingUp, TrendingDown, Bitcoin } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  lastUpdated: number;
  fresh: boolean;
}

export function Header() {
  const { user } = useAuth();
  const [prices, setPrices] = useState<PriceData[]>([]);

  const fetchPrices = useCallback(async () => {
    try {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true"
      );
      const data = await res.json();
      const now = Math.floor(Date.now() / 1000);
      const toPrice = (id: string, sym: string): PriceData => ({
        symbol: sym,
        price: data[id]?.usd || 0,
        change24h: data[id]?.usd_24h_change || 0,
        lastUpdated: data[id]?.last_updated_at || 0,
        fresh: now - (data[id]?.last_updated_at || 0) < 3600,
      });
      setPrices([toPrice("bitcoin", "BTC"), toPrice("ethereum", "ETH"), toPrice("binancecoin", "BNB")]);
    } catch {
      // keep last data
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const shortAddress = user?.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : "";

  return (
    <header className="h-16 border-b border-[#2A2A2A] bg-[#111111] flex items-center justify-between px-6">
      {/* Live Price Ticker */}
      <div className="flex items-center gap-4">
        {prices.length > 0 ? (
          prices.map((p) => (
            <div key={p.symbol} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                p.symbol === "BTC" ? "bg-[#F7931A]/10" : p.symbol === "ETH" ? "bg-[#627EEA]/10" : "bg-[#F0B90B]/10"
              }`}>
                <span className={`text-[10px] font-bold ${
                  p.symbol === "BTC" ? "text-[#F7931A]" : p.symbol === "ETH" ? "text-[#627EEA]" : "text-[#F0B90B]"
                }`}>{p.symbol.charAt(0)}</span>
              </div>
              <div className="hidden md:block">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-white">{p.symbol}</span>
                  <span className="text-xs font-mono text-white">${p.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex items-center gap-0.5">
                  {p.change24h >= 0 ? (
                    <TrendingUp className="w-2.5 h-2.5 text-[#00C853]" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5 text-[#FF3D57]" />
                  )}
                  <span className={`text-[10px] font-medium ${p.change24h >= 0 ? "text-[#00C853]" : "text-[#FF3D57]"}`}>
                    {p.change24h >= 0 ? "+" : ""}{p.change24h.toFixed(2)}%
                  </span>
                  {!p.fresh && <span className="text-[10px] text-[#FF3D57] ml-1">STALE</span>}
                </div>
              </div>
            </div>
          ))
        ) : (
          <span className="text-xs text-[#666]">Loading prices…</span>
        )}
        <Badge className="bg-[#00C853]/10 text-[#00C853] border-[#00C853]/20 text-[10px] hidden lg:flex gap-1">
          <Circle className="w-1.5 h-1.5 fill-[#00C853] text-[#00C853]" /> Oracle Live
        </Badge>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-[#999] hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-[#2A2A2A]">
          <div className="w-8 h-8 rounded-full bg-[#F0B90B]/10 flex items-center justify-center">
            <span className="text-sm font-bold text-[#F0B90B]">
              {user?.username?.[0]?.toUpperCase() || "A"}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-white">
              {user?.username || "Admin"}
            </p>
            <p className="text-xs text-[#666] font-mono">{shortAddress}</p>
          </div>
          <Badge className="bg-[#F0B90B]/10 text-[#F0B90B] border-[#F0B90B]/20 text-xs">
            <Circle className="w-2 h-2 fill-[#00C853] text-[#00C853] mr-1" />
            Admin
          </Badge>
        </div>
      </div>
    </header>
  );
}
