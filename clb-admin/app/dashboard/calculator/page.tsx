"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Calculator, DollarSign, TrendingUp, Percent, Target,
  Bitcoin, ArrowRight, Zap, Info, Save, RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const poolTiers = [
  { label: "Starter", price: 100 },
  { label: "Silver", price: 250 },
  { label: "Gold", price: 500 },
  { label: "Platinum", price: 1000 },
];

const assets = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    color: "#F7931A",
    defaultPrice: 76130,
    phase1Target: 150000,
    phase2Target: 200000,
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    color: "#627EEA",
    defaultPrice: 2268,
    phase1Target: 15000,
    phase2Target: 20000,
  },
  {
    symbol: "BNB",
    name: "BNB",
    color: "#F0B90B",
    defaultPrice: 650,
    phase1Target: 2500,
    phase2Target: 5000,
  },
];

const LEVERAGE = 60;
const USER_PROFIT_SHARE = 0.85;
const PLATFORM_FEE_SHARE = 0.15;

const COINGECKO_IDS: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin" };
const SAVED_PRICES_KEY = "calc_saved_entry_prices";
const SAVED_TARGETS_KEY = "calc_saved_phase_targets";

function loadSaved<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

export default function CalculatorPage() {
  const [selectedTier, setSelectedTier] = useState(100);
  const [selectedAsset, setSelectedAsset] = useState("BTC");
  const [customEntryPrice, setCustomEntryPrice] = useState("");
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [savedPrices, setSavedPrices] = useState<Record<string, number>>({});
  const [savedTargets, setSavedTargets] = useState<Record<string, { p1: number; p2: number }>>({});
  const [saveFlash, setSaveFlash] = useState(false);
  const [usingLive, setUsingLive] = useState(true);
  const [phase1Input, setPhase1Input] = useState("");
  const [phase2Input, setPhase2Input] = useState("");
  const [targetSaveFlash, setTargetSaveFlash] = useState<1 | 2 | null>(null);

  useEffect(() => {
    setSavedPrices(loadSaved(SAVED_PRICES_KEY, {}));
    setSavedTargets(loadSaved(SAVED_TARGETS_KEY, {}));
  }, []);

  const asset = assets.find((a) => a.symbol === selectedAsset)!;

  const fetchLivePrice = useCallback(async () => {
    try {
      const id = COINGECKO_IDS[selectedAsset] || "bitcoin";
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
      const data = await res.json();
      const price = data[id]?.usd || null;
      setLivePrice(price);
      if (usingLive && price) setCustomEntryPrice(String(price));
    } catch {
      // keep default
    }
  }, [selectedAsset, usingLive]);

  useEffect(() => {
    fetchLivePrice();
    const interval = setInterval(fetchLivePrice, 30000);
    return () => clearInterval(interval);
  }, [fetchLivePrice]);

  useEffect(() => {
    const saved = savedPrices[selectedAsset];
    if (saved) {
      setCustomEntryPrice(String(saved));
      setUsingLive(false);
    } else if (livePrice) {
      setCustomEntryPrice(String(livePrice));
      setUsingLive(true);
    } else {
      setCustomEntryPrice(String(asset.defaultPrice));
      setUsingLive(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAsset]);

  const handleSavePrice = () => {
    const price = parseFloat(customEntryPrice);
    if (!price || price <= 0) return;
    const updated = { ...savedPrices, [selectedAsset]: price };
    setSavedPrices(updated);
    localStorage.setItem(SAVED_PRICES_KEY, JSON.stringify(updated));
    setUsingLive(false);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const handleResetToLive = () => {
    const updated = { ...savedPrices };
    delete updated[selectedAsset];
    setSavedPrices(updated);
    localStorage.setItem(SAVED_PRICES_KEY, JSON.stringify(updated));
    setUsingLive(true);
    setCustomEntryPrice(String(livePrice || asset.defaultPrice));
  };

  useEffect(() => {
    const saved = savedTargets[selectedAsset];
    setPhase1Input(String(saved?.p1 || asset.phase1Target));
    setPhase2Input(String(saved?.p2 || asset.phase2Target));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAsset]);

  const handleSaveTarget = (phase: 1 | 2) => {
    const val = parseFloat(phase === 1 ? phase1Input : phase2Input);
    if (!val || val <= 0) return;
    const prev = savedTargets[selectedAsset] || { p1: asset.phase1Target, p2: asset.phase2Target };
    const updated = { ...savedTargets, [selectedAsset]: phase === 1 ? { ...prev, p1: val } : { ...prev, p2: val } };
    setSavedTargets(updated);
    localStorage.setItem(SAVED_TARGETS_KEY, JSON.stringify(updated));
    setTargetSaveFlash(phase);
    setTimeout(() => setTargetSaveFlash(null), 1500);
  };

  const handleResetTarget = (phase: 1 | 2) => {
    const prev = savedTargets[selectedAsset];
    if (!prev) return;
    const defaults = { p1: asset.phase1Target, p2: asset.phase2Target };
    const updated = { ...savedTargets, [selectedAsset]: phase === 1 ? { ...prev, p1: defaults.p1 } : { ...prev, p2: defaults.p2 } };
    if (updated[selectedAsset].p1 === defaults.p1 && updated[selectedAsset].p2 === defaults.p2) {
      delete updated[selectedAsset];
    }
    setSavedTargets(updated);
    localStorage.setItem(SAVED_TARGETS_KEY, JSON.stringify(updated));
    if (phase === 1) setPhase1Input(String(defaults.p1));
    else setPhase2Input(String(defaults.p2));
  };

  const entryPrice = customEntryPrice ? parseFloat(customEntryPrice) || asset.defaultPrice : asset.defaultPrice;
  const phase1Target = parseFloat(phase1Input) || asset.phase1Target;
  const phase2Target = parseFloat(phase2Input) || asset.phase2Target;

  const results = useMemo(() => {
    const poolInvestment = selectedTier;
    const leveragedPosition = poolInvestment * LEVERAGE;
    const cryptoAmount = leveragedPosition / entryPrice;

    const phase1LiqPercent = 0.40;
    const phase1Value = cryptoAmount * phase1Target * phase1LiqPercent;
    const phase1GrossProfit = phase1Value - (poolInvestment * phase1LiqPercent);
    const phase1UserProfit = phase1GrossProfit * USER_PROFIT_SHARE;
    const phase1PlatformFee = phase1GrossProfit * PLATFORM_FEE_SHARE;
    const phase1ROI = ((phase1UserProfit) / poolInvestment) * 100;

    const phase2RemainingPercent = 1 - phase1LiqPercent;
    const phase2Value = cryptoAmount * phase2Target * phase2RemainingPercent;
    const phase2GrossProfit = phase2Value - (poolInvestment * phase2RemainingPercent);
    const phase2UserProfit = phase2GrossProfit * USER_PROFIT_SHARE;
    const phase2PlatformFee = phase2GrossProfit * PLATFORM_FEE_SHARE;
    const phase2ROI = ((phase2UserProfit) / poolInvestment) * 100;

    const totalUserProfit = phase1UserProfit + phase2UserProfit;
    const totalPlatformFee = phase1PlatformFee + phase2PlatformFee;
    const totalROI = ((totalUserProfit) / poolInvestment) * 100;

    return {
      poolInvestment,
      leveragedPosition,
      cryptoAmount,
      entryPrice,
      phase1: { value: phase1Value, grossProfit: phase1GrossProfit, userProfit: phase1UserProfit, platformFee: phase1PlatformFee, roi: phase1ROI, target: phase1Target, liqPercent: phase1LiqPercent },
      phase2: { value: phase2Value, grossProfit: phase2GrossProfit, userProfit: phase2UserProfit, platformFee: phase2PlatformFee, roi: phase2ROI, target: phase2Target, liqPercent: phase2RemainingPercent },
      totalUserProfit,
      totalPlatformFee,
      totalROI,
    };
  }, [selectedTier, entryPrice, phase1Target, phase2Target]);

  const fmt = (n: number) => n < 1 ? n.toFixed(6) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Profit Calculator</h2>
        <p className="text-sm text-[#888] mt-1">Calculate expected returns per pool tier with {LEVERAGE}x leverage and {USER_PROFIT_SHARE * 100}/{PLATFORM_FEE_SHARE * 100} profit split</p>
      </div>

      {/* Input Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pool Tier */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#F0B90B]" /> Pool Tier
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {poolTiers.map((tier) => (
                <button
                  key={tier.price}
                  onClick={() => setSelectedTier(tier.price)}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    selectedTier === tier.price
                      ? "border-[#F0B90B] bg-[#F0B90B]/10 text-[#F0B90B]"
                      : "border-[#2A2A2A] bg-[#0D0D0D] text-[#999] hover:border-[#3A3A3A]"
                  }`}
                >
                  <p className="text-lg font-bold">${tier.price}</p>
                  <p className="text-xs opacity-70">{tier.label}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Asset Selection */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Bitcoin className="w-4 h-4 text-[#F0B90B]" /> Asset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {assets.map((a) => (
                <button
                  key={a.symbol}
                  onClick={() => setSelectedAsset(a.symbol)}
                  className={`p-3 rounded-lg border text-center transition-all ${
                    selectedAsset === a.symbol
                      ? `border-[${a.color}] bg-[${a.color}]/10`
                      : "border-[#2A2A2A] bg-[#0D0D0D] text-[#999] hover:border-[#3A3A3A]"
                  }`}
                  style={selectedAsset === a.symbol ? { borderColor: a.color, backgroundColor: `${a.color}15` } : {}}
                >
                  <p className="text-lg font-bold" style={{ color: selectedAsset === a.symbol ? a.color : undefined }}>{a.symbol}</p>
                  <p className="text-xs opacity-70">{a.name}</p>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-[#888]">
                  Entry Price (USD) —{" "}
                  <span className={usingLive ? "text-[#00C853]" : "text-[#F0B90B]"}>
                    {usingLive ? "live" : "saved"}
                  </span>
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={handleSavePrice}
                    title="Save this price"
                    className={`p-1 rounded transition-all ${saveFlash ? "bg-[#00C853]/20 text-[#00C853]" : "text-[#888] hover:text-[#F0B90B] hover:bg-[#F0B90B]/10"}`}
                  >
                    <Save className="w-3.5 h-3.5" />
                  </button>
                  {savedPrices[selectedAsset] && (
                    <button
                      onClick={handleResetToLive}
                      title="Reset to live price"
                      className="p-1 rounded text-[#888] hover:text-[#00C853] hover:bg-[#00C853]/10 transition-all"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="number"
                value={customEntryPrice}
                onChange={(e) => { setCustomEntryPrice(e.target.value); setUsingLive(false); }}
                className="w-full h-9 rounded-md border border-[#2A2A2A] bg-[#0D0D0D] px-3 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-[#F0B90B]"
              />
              {livePrice && (
                <p className="text-[10px] text-[#00C853] flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse" />
                  Live: ${livePrice.toLocaleString()}
                  {!usingLive && (
                    <button onClick={handleResetToLive} className="ml-1 underline hover:text-white transition-colors">
                      use live
                    </button>
                  )}
                </p>
              )}
              {saveFlash && <p className="text-[10px] text-[#00C853]">Price saved!</p>}
            </div>
          </CardContent>
        </Card>

        {/* Position Summary */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A]">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#F0B90B]" /> Position
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Pool Investment", value: `$${results.poolInvestment}` },
              { label: "Leverage", value: `${LEVERAGE}x` },
              { label: "Leveraged Position", value: `$${fmt(results.leveragedPosition)}` },
              { label: `${selectedAsset} Amount`, value: `${results.cryptoAmount.toFixed(6)} ${selectedAsset}` },
              { label: "Entry Price", value: `$${fmt(results.entryPrice)}` },
              { label: "Profit Split", value: `${USER_PROFIT_SHARE * 100}% User / ${PLATFORM_FEE_SHARE * 100}% Platform` },
            ].map((item) => (
              <div key={item.label} className="flex justify-between p-2 rounded bg-[#0D0D0D]">
                <span className="text-xs text-[#999]">{item.label}</span>
                <span className="text-xs text-white font-mono">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Phase Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Phase 1 */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A] border-l-4 border-l-[#F0B90B]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-[#F0B90B]" />
                Phase 1 — Partial Liquidation
              </CardTitle>
              <Badge className="bg-[#F0B90B]/10 text-[#F0B90B]">{(results.phase1.liqPercent * 100).toFixed(0)}% of position</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-3 rounded-lg bg-[#0D0D0D] text-center mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-[#888]">Target Price</p>
                <div className="flex gap-1">
                  <button onClick={() => handleSaveTarget(1)} title="Save target" className={`p-1 rounded transition-all ${targetSaveFlash === 1 ? "bg-[#00C853]/20 text-[#00C853]" : "text-[#888] hover:text-[#F0B90B] hover:bg-[#F0B90B]/10"}`}>
                    <Save className="w-3 h-3" />
                  </button>
                  {savedTargets[selectedAsset]?.p1 && savedTargets[selectedAsset].p1 !== asset.phase1Target && (
                    <button onClick={() => handleResetTarget(1)} title="Reset to default" className="p-1 rounded text-[#888] hover:text-[#F0B90B] hover:bg-[#F0B90B]/10 transition-all">
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl font-bold text-[#F0B90B]">$</span>
                <input
                  type="number"
                  value={phase1Input}
                  onChange={(e) => setPhase1Input(e.target.value)}
                  className="w-32 text-center text-2xl font-bold text-[#F0B90B] bg-transparent border-b border-[#F0B90B]/30 focus:border-[#F0B90B] outline-none font-mono"
                />
              </div>
              <p className="text-xs text-[#666] mt-1">{((results.phase1.target / results.entryPrice - 1) * 100).toFixed(0)}% price increase needed</p>
              {savedTargets[selectedAsset]?.p1 && savedTargets[selectedAsset].p1 !== asset.phase1Target && (
                <p className="text-[10px] text-[#F0B90B] mt-0.5">Custom (default: ${asset.phase1Target.toLocaleString()})</p>
              )}
              {targetSaveFlash === 1 && <p className="text-[10px] text-[#00C853]">Target saved!</p>}
            </div>
            {[
              { label: "Liquidation Value", value: `$${fmt(results.phase1.value)}`, color: "text-white" },
              { label: "Gross Profit", value: `$${fmt(results.phase1.grossProfit)}`, color: "text-white" },
              { label: "User Profit (85%)", value: `$${fmt(results.phase1.userProfit)}`, color: "text-[#00C853]" },
              { label: "Platform Fee (15%)", value: `$${fmt(results.phase1.platformFee)}`, color: "text-[#F0B90B]" },
              { label: "Phase 1 ROI", value: `${fmt(results.phase1.roi)}%`, color: "text-[#00C853]" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between p-2.5 rounded bg-[#0D0D0D]">
                <span className="text-xs text-[#999]">{item.label}</span>
                <span className={`text-xs font-semibold font-mono ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Phase 2 */}
        <Card className="bg-[#1A1A1A] border-[#2A2A2A] border-l-4 border-l-[#3B82F6]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-[#3B82F6]" />
                Phase 2 — Full Liquidation
              </CardTitle>
              <Badge className="bg-[#3B82F6]/10 text-[#3B82F6]">{(results.phase2.liqPercent * 100).toFixed(0)}% remaining</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-3 rounded-lg bg-[#0D0D0D] text-center mb-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-[#888]">Target Price</p>
                <div className="flex gap-1">
                  <button onClick={() => handleSaveTarget(2)} title="Save target" className={`p-1 rounded transition-all ${targetSaveFlash === 2 ? "bg-[#00C853]/20 text-[#00C853]" : "text-[#888] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10"}`}>
                    <Save className="w-3 h-3" />
                  </button>
                  {savedTargets[selectedAsset]?.p2 && savedTargets[selectedAsset].p2 !== asset.phase2Target && (
                    <button onClick={() => handleResetTarget(2)} title="Reset to default" className="p-1 rounded text-[#888] hover:text-[#3B82F6] hover:bg-[#3B82F6]/10 transition-all">
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl font-bold text-[#3B82F6]">$</span>
                <input
                  type="number"
                  value={phase2Input}
                  onChange={(e) => setPhase2Input(e.target.value)}
                  className="w-32 text-center text-2xl font-bold text-[#3B82F6] bg-transparent border-b border-[#3B82F6]/30 focus:border-[#3B82F6] outline-none font-mono"
                />
              </div>
              <p className="text-xs text-[#666] mt-1">{((results.phase2.target / results.entryPrice - 1) * 100).toFixed(0)}% price increase needed</p>
              {savedTargets[selectedAsset]?.p2 && savedTargets[selectedAsset].p2 !== asset.phase2Target && (
                <p className="text-[10px] text-[#3B82F6] mt-0.5">Custom (default: ${asset.phase2Target.toLocaleString()})</p>
              )}
              {targetSaveFlash === 2 && <p className="text-[10px] text-[#00C853]">Target saved!</p>}
            </div>
            {[
              { label: "Liquidation Value", value: `$${fmt(results.phase2.value)}`, color: "text-white" },
              { label: "Gross Profit", value: `$${fmt(results.phase2.grossProfit)}`, color: "text-white" },
              { label: "User Profit (85%)", value: `$${fmt(results.phase2.userProfit)}`, color: "text-[#00C853]" },
              { label: "Platform Fee (15%)", value: `$${fmt(results.phase2.platformFee)}`, color: "text-[#3B82F6]" },
              { label: "Phase 2 ROI", value: `${fmt(results.phase2.roi)}%`, color: "text-[#00C853]" },
            ].map((item) => (
              <div key={item.label} className="flex justify-between p-2.5 rounded bg-[#0D0D0D]">
                <span className="text-xs text-[#999]">{item.label}</span>
                <span className={`text-xs font-semibold font-mono ${item.color}`}>{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Total Summary */}
      <Card className="bg-[#1A1A1A] border-[#2A2A2A] border-t-4 border-t-[#00C853]">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-[#888] mb-1">Investment</p>
              <p className="text-xl font-bold text-white">${results.poolInvestment}</p>
            </div>
            <div>
              <p className="text-xs text-[#888] mb-1">Total User Profit</p>
              <p className="text-xl font-bold text-[#00C853]">${fmt(results.totalUserProfit)}</p>
            </div>
            <div>
              <p className="text-xs text-[#888] mb-1">Platform Revenue</p>
              <p className="text-xl font-bold text-[#F0B90B]">${fmt(results.totalPlatformFee)}</p>
            </div>
            <div>
              <p className="text-xs text-[#888] mb-1">Total ROI</p>
              <p className="text-xl font-bold text-[#00C853]">{fmt(results.totalROI)}%</p>
            </div>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-[#00C853]/5 border border-[#00C853]/20 flex items-center gap-2">
            <Info className="w-4 h-4 text-[#00C853] shrink-0" />
            <p className="text-xs text-[#00C853]">
              Formula: User Net Profit = (Crypto Amount × Liquidation Price × Liquidation %) × 85% − Pool Investment.
              All calculations assume both phases hit their targets. Actual returns depend on market conditions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
