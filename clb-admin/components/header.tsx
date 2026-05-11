"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Circle, TrendingUp, TrendingDown } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";

interface PriceData {
  symbol: string;
  price: number;
  change24h: number;
  lastUpdated: number;
  fresh: boolean;
}

const COIN_COLORS: Record<string, { text: string; bg: string }> = {
  BTC: { text: "text-[#F7931A]", bg: "bg-[#F7931A]/10" },
  ETH: { text: "text-[#627EEA]", bg: "bg-[#627EEA]/10" },
  BNB: { text: "text-[#F0B90B]", bg: "bg-[#F0B90B]/10" },
};

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
    ? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`
    : "";

  return (
    <header className="border-b border-[#2A2A2A] bg-[#111111]">
      {/* ── Main row: always visible ── */}
      <div className="flex items-center justify-between px-4 sm:px-6 h-14">

        {/* Left: scrollable price ticker (md+) / coin icons only (sm) */}
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none flex-1 pr-4">
          {prices.length > 0 ? (
            <>
              {prices.map((p) => {
                const c = COIN_COLORS[p.symbol];
                const up = p.change24h >= 0;
                return (
                  <div
                    key={p.symbol}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#1A1A1A] transition-colors shrink-0 cursor-default"
                  >
                    {/* Coin icon */}
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${c.bg}`}>
                      <span className={`text-[9px] font-bold leading-none ${c.text}`}>
                        {p.symbol.charAt(0)}
                      </span>
                    </div>

                    {/* Symbol + price — shown from sm */}
                    <div className="hidden sm:flex flex-col leading-none">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-semibold text-white">{p.symbol}</span>
                        <span className="text-[11px] font-mono text-[#ccc]">
                          ${p.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      {/* Change % — shown from md */}
                      <div className="hidden md:flex items-center gap-0.5 mt-0.5">
                        {up
                          ? <TrendingUp className="w-2.5 h-2.5 text-[#00C853]" />
                          : <TrendingDown className="w-2.5 h-2.5 text-[#FF3D57]" />
                        }
                        <span className={`text-[10px] font-medium ${up ? "text-[#00C853]" : "text-[#FF3D57]"}`}>
                          {up ? "+" : ""}{p.change24h.toFixed(2)}%
                        </span>
                        {!p.fresh && (
                          <span className="text-[9px] text-[#FF3D57] ml-0.5">STALE</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Divider + Oracle badge — lg+ */}
              <div className="hidden lg:flex items-center gap-2 pl-2 ml-1 border-l border-[#2A2A2A] shrink-0">
                <Badge className="bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/20 text-[10px] gap-1 py-0.5">
                  <Circle className="w-1.5 h-1.5 fill-[#00C853]" /> Oracle Live
                </Badge>
              </div>
            </>
          ) : (
            <span className="text-xs text-[#555] px-1">Loading prices…</span>
          )}
        </div>

        {/* Right: bell + user */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Bell */}
          <button className="p-2 text-[#666] hover:text-white transition-colors rounded-lg hover:bg-[#1A1A1A]">
            <Bell className="w-4.5 h-4.5" />
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-[#2A2A2A]" />

          {/* Avatar + name */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#F0B90B]/10 border border-[#F0B90B]/20 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-[#F0B90B] leading-none">
                {user?.username?.[0]?.toUpperCase() || "A"}
              </span>
            </div>

            {/* Name + address — sm+ */}
            <div className="hidden sm:block leading-none">
              <p className="text-xs font-semibold text-white">{user?.username || "Admin"}</p>
              {shortAddress && (
                <p className="text-[10px] text-[#555] font-mono mt-0.5">{shortAddress}</p>
              )}
            </div>

            {/* Role badge — md+ */}
            <Badge className="hidden md:flex bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 text-[10px] gap-1 py-0.5">
              <Circle className="w-1.5 h-1.5 fill-[#00C853]" /> Admin
            </Badge>
          </div>
        </div>
      </div>

      {/* ── Mobile price strip (xs only, below main row) ── */}
      <div className="sm:hidden border-t border-[#1A1A1A] overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-0 px-3 py-2 w-max">
          {prices.map((p) => {
            const c = COIN_COLORS[p.symbol];
            const up = p.change24h >= 0;
            return (
              <div key={p.symbol} className="flex items-center gap-1.5 pr-4">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${c.bg}`}>
                  <span className={`text-[8px] font-bold ${c.text}`}>{p.symbol.charAt(0)}</span>
                </div>
                <span className="text-[11px] font-semibold text-white">{p.symbol}</span>
                <span className="text-[11px] font-mono text-[#aaa]">
                  ${p.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className={`text-[10px] font-medium ${up ? "text-[#00C853]" : "text-[#FF3D57]"}`}>
                  {up ? "+" : ""}{p.change24h.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
