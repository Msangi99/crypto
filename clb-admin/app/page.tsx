"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Shield, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  type LandingPoolRow,
  formatMinStakeAmount,
} from "@/lib/publicPools";
import {
  type LandingPublicBundle,
  buildTickerSegments,
  fetchLandingPublicBundle,
  formatCompactNumber,
  formatTvlBnb,
  trustPillsFromHealth,
} from "@/lib/landingPublicData";
import "./clb-landing.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-landing",
  weight: ["400", "500", "600", "700", "800"],
});

const APP_URL = "https://app.cryptoloanboost.com";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const HOME_APK_DOWNLOAD_URL = `${API_BASE}/api/public/mobile-app/download`;

function downloadApp(mobileApp: LandingPublicBundle["mobileApp"] | undefined) {
  if (!mobileApp?.downloadUrl) {
    const useWeb = window.confirm(
      "Android app is not published yet.\n\nOpen the CLB web app in your browser instead?",
    );
    if (useWeb) openWebApp();
    return;
  }
  window.open(mobileApp.downloadUrl, "_blank", "noopener,noreferrer");
}

function openWebApp() {
  window.open(APP_URL, "_blank", "noopener,noreferrer");
}

const hasPublishedApk = (mobileApp: LandingPublicBundle["mobileApp"] | undefined) =>
  Boolean(mobileApp?.downloadUrl);

function apkDownloadUrl(mobileApp: LandingPublicBundle["mobileApp"] | undefined): string {
  return mobileApp?.downloadUrl ?? HOME_APK_DOWNLOAD_URL;
}

const STATIC_TRUST_PILLS: [string, string][] = [
  ["#F3BA2F", "BNB Smart Chain"],
  ["#00C896", "Non-Custodial"],
  ["#1A6BFF", "BEP-20 Standard"],
  ["#F0A500", "Soulbound Receipts"],
  ["#6270CE", "Smart Contract Logic"],
  ["#FF4F8B", "PIN + Biometrics"],
  ["#00C896", "MetaMask / Trust Wallet"],
  ["#F3BA2F", "Low Gas Fees"],
];

/** Shown only if the API is unreachable — not live DB data. */
const DEMO_LANDING_POOLS: LandingPoolRow[] = [
  {
    id: "demo-0",
    name: "Starter Pool",
    minDeposit: 0.1,
    tokenSymbol: "BNB",
    multLabel: "1.5x",
    progressPercent: 30,
    indicatorColor: "#F0A500",
    leverageRatio: null,
    apy: 0,
    heldAsset: null,
    phase1Target: null,
    phase2Target: null,
  },
  {
    id: "demo-1",
    name: "Growth Pool",
    minDeposit: 0.5,
    tokenSymbol: "BNB",
    multLabel: "2x",
    progressPercent: 40,
    indicatorColor: "#1A6BFF",
    leverageRatio: null,
    apy: 0,
    heldAsset: null,
    phase1Target: null,
    phase2Target: null,
  },
  {
    id: "demo-2",
    name: "Pro Pool",
    minDeposit: 1,
    tokenSymbol: "BNB",
    multLabel: "3x",
    progressPercent: 60,
    indicatorColor: "#00C896",
    leverageRatio: null,
    apy: 0,
    heldAsset: null,
    phase1Target: null,
    phase2Target: null,
  },
  {
    id: "demo-3",
    name: "Elite Pool",
    minDeposit: 5,
    tokenSymbol: "BNB",
    multLabel: "4x",
    progressPercent: 80,
    indicatorColor: "#6270CE",
    leverageRatio: null,
    apy: 0,
    heldAsset: null,
    phase1Target: null,
    phase2Target: null,
  },
  {
    id: "demo-4",
    name: "Apex Pool",
    minDeposit: 10,
    tokenSymbol: "BNB",
    multLabel: "5x",
    progressPercent: 100,
    indicatorColor: "#FF4F8B",
    leverageRatio: null,
    apy: 0,
    heldAsset: null,
    phase1Target: null,
    phase2Target: null,
  },
];

function PoolNameDisplay({ name }: { name: string }) {
  const base = name.replace(" Pool", "");
  return (
    <>
      {base} <span>Pool</span>
    </>
  );
}

function TickerRow({ bundle }: { bundle: LandingPublicBundle | null }) {
  const segments = useMemo(() => buildTickerSegments(bundle), [bundle]);
  const items = useMemo(() => {
    const nodes: ReactNode[] = [];
    segments.forEach((s, i) => {
      const tailClass =
        s.tail == null || s.tail === "" ? "" : s.tailUp === false ? "dn" : "up";
      nodes.push(
        <span key={s.key} className="ticker-item">
          <strong>{s.title}</strong> {s.mid}{" "}
          {s.tail ? <span className={tailClass}>{s.tail}</span> : null}
        </span>,
      );
      if (i < segments.length - 1) {
        nodes.push(
          <span key={`${s.key}-sep`} className="ticker-sep">
            ·
          </span>,
        );
      }
    });
    return nodes;
  }, [segments]);
  return (
    <div className="ticker-inner" id="ticker">
      {items}
      {items}
    </div>
  );
}

function CryptoLanding() {
  const navRef = useRef<HTMLElement>(null);
  const [activeTier, setActiveTier] = useState(0);
  const [pools, setPools] = useState<LandingPoolRow[]>([]);
  const [poolsStatus, setPoolsStatus] = useState<"loading" | "live" | "empty" | "demo">("loading");
  const [bundle, setBundle] = useState<LandingPublicBundle | null>(null);
  const [apkModal, setApkModal] = useState<LandingPublicBundle["mobileApp"]>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = await fetchLandingPublicBundle();
      if (cancelled) return;
      setBundle(b);
      const apiReachable =
        b.poolStats != null || b.geoPrices != null || b.health != null || b.referralStats != null;
      if (b.pools.length > 0) {
        setPools(b.pools);
        setPoolsStatus("live");
      } else if (apiReachable) {
        setPools([]);
        setPoolsStatus("empty");
      } else {
        setPools(DEMO_LANDING_POOLS);
        setPoolsStatus("demo");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const m = bundle?.mobileApp;
    if (!m || typeof window === "undefined") return;
    const key = `clb_landing_apk_dismiss_${m.version}`;
    if (localStorage.getItem(key)) return;
    const t = window.setTimeout(() => setApkModal(m), 2200);
    return () => window.clearTimeout(t);
  }, [bundle?.mobileApp]);

  const dismissApkModal = useCallback(() => {
    if (apkModal && typeof window !== "undefined") {
      localStorage.setItem(`clb_landing_apk_dismiss_${apkModal.version}`, "1");
    }
    setApkModal(null);
  }, [apkModal]);

  const tier =
    pools.length > 0 ? pools[Math.min(activeTier, Math.max(0, pools.length - 1))] : null;
  const barWidth = tier?.progressPercent ?? 30;

  const poolTiersHeroCount = useMemo(() => {
    if (poolsStatus === "loading") return "10";
    if (poolsStatus === "empty") return "0";
    return String(pools.length);
  }, [poolsStatus, pools.length]);

  const maxLeverageHero = useMemo(() => {
    if (poolsStatus !== "live" || pools.length === 0) return 5;
    const fromDb = pools.map((p) => p.leverageRatio ?? 0).filter((n) => n > 0);
    if (fromDb.length === 0) return 5;
    return Math.max(...fromDb);
  }, [pools, poolsStatus]);

  const tvlHero = useMemo(
    () => formatTvlBnb(bundle?.poolStats?.totalValueLocked),
    [bundle?.poolStats?.totalValueLocked],
  );

  const poolBadgeLabel = useMemo(() => {
    const chain = bundle?.health?.blockchain;
    if (chain === "connected") return "● BSC Live";
    if (chain) return `● ${chain}`;
    return "● BSC";
  }, [bundle?.health?.blockchain]);

  const ecosystemLine = useMemo(() => {
    const ps = bundle?.poolStats;
    const mc = bundle?.miningPackagesCount;
    const parts: string[] = [];
    if (ps && ps.totalMembers > 0) parts.push(`${ps.totalMembers.toLocaleString()} pool members`);
    if (ps && ps.totalPools > 0) parts.push(`${ps.totalPools} pools in catalog`);
    if (mc != null && mc > 0) parts.push(`${mc} active mining packages`);
    if (bundle?.referralStats && bundle.referralStats.totalReferrals > 0) {
      parts.push(`${bundle.referralStats.totalReferrals.toLocaleString()} referrals`);
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }, [bundle]);

  useEffect(() => {
    if (pools.length === 0) return;
    setActiveTier((i) => Math.min(i, pools.length - 1));
  }, [pools.length]);

  useEffect(() => {
    document.title = "Crypto Loan Boost — Leveraged DeFi on BSC";
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      navRef.current?.classList.toggle("scrolled", window.scrollY > 30);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = document.querySelectorAll<HTMLElement>(".clb-landing-page .reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.12 },
    );
    el.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const scrollToHow = useCallback(() => {
    document.getElementById("how")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className={`clb-landing-page ${plusJakarta.variable}`}>

      {apkModal ? (
        <div className="clb-apk-modal-root" role="dialog" aria-modal="true" aria-labelledby="clb-apk-modal-title">
          <button type="button" className="clb-apk-modal-backdrop" aria-label="Close" onClick={dismissApkModal} />
          <div className="clb-apk-modal-panel">
            <h2 id="clb-apk-modal-title" className="clb-apk-modal-title">
              Get the CLB app
            </h2>
            <p className="clb-apk-modal-version">Android · v{apkModal.version}</p>
            {apkModal.releaseNotes ? (
              <p className="clb-apk-modal-notes">{apkModal.releaseNotes}</p>
            ) : null}
            <p className="clb-apk-modal-meta">
              {(apkModal.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB · {apkModal.originalFileName}
            </p>
            <div className="clb-apk-modal-actions">
              <a className="clb-apk-modal-download" href={apkDownloadUrl(apkModal)}>
                Download APK
              </a>
              <button type="button" className="clb-apk-modal-later" onClick={dismissApkModal}>
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav ref={navRef} id="nav">
        <a href="#top" className="nav-logo">
          <img src="/clb-icon.png" alt="" className="nav-logo-img" width={38} height={38} />
          Crypto<span>Loan</span>Boost
        </a>
        <ul className="nav-links">
          <li>
            <a href="#pools">Pools</a>
          </li>
          <li>
            <a href="#how">How it works</a>
          </li>
          <li>
            <a href="#referrals">Referrals</a>
          </li>
          <li>
            <a href="#security">Security</a>
          </li>
        </ul>
        <div className="nav-actions">
          <button
            type="button"
            className="btn-signup"
            onClick={() => downloadApp(bundle?.mobileApp)}
          >
            Download App
          </button>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-grid">
          <div className="hero-content">
            <div className="hero-badge">Live on BNB Smart Chain</div>

            <h1 className="hero-h1">
              Leveraged DeFi,
              <br />
              <em>amplified</em> returns.
            </h1>

            <p className="hero-sub">
              Stake BNB, unlock CLB loans, and let protocol-driven auto-liquidation work for you. Built on BSC.
              Non-custodial. Transparent.
            </p>

            <div className="hero-ctas">
              <button
                type="button"
                className="btn-primary"
                onClick={() => downloadApp(bundle?.mobileApp)}
              >
                Download App
              </button>
              <button type="button" className="btn-secondary hero-web-app" onClick={openWebApp}>
                Open Web App
              </button>
            </div>

            <button type="button" className="hero-how-link" onClick={scrollToHow}>
              <span className="play-icon" aria-hidden>
                ▶
              </span>
              How it works?
            </button>

            {bundle?.mobileApp ? (
              <p className="hero-apk-hint reveal">
                <a href={bundle.mobileApp.downloadUrl} className="hero-apk-link">
                  Android: download APK v{bundle.mobileApp.version}
                </a>
              </p>
            ) : null}

            <div className="hero-stats">
              <div className="stat">
                <div className="stat-num" id="tvl-counter">
                  {poolsStatus === "loading" ? "…" : tvlHero}
                </div>
                <div className="stat-label">TVL (BNB)</div>
              </div>
              <div className="stat">
                <div className="stat-num">
                  <span>{maxLeverageHero}</span>x
                </div>
                <div className="stat-label">Max Leverage</div>
              </div>
              <div className="stat">
                <div className="stat-num">
                  BEP<span>-20</span>
                </div>
                <div className="stat-label">CLB Token</div>
              </div>
              <div className="stat">
                <div className="stat-num">
                  <span>{poolTiersHeroCount}</span>+
                </div>
                <div className="stat-label">Pool Tiers</div>
              </div>
            </div>
          </div>

          <div className="hero-visual" aria-hidden>
            <div className="hero-scene">
              <div className="hero-pedestal" />
              <div className="hero-orbit-wrap">
                <div className="hero-orbit" />
                <div className="hero-orbit" />
                <div className="hero-orbit" />
                <div className="hero-cube-wrap">
                  <div className="hero-glass-cube">
                    <div className="hero-cube-coin">CLB</div>
                  </div>
                </div>
              </div>
              <div className="hero-float hf-yellow" />
              <div className="hero-float hf-blue" />
              <div className="hero-float hf-purple" />
              <div className="hero-float hf-eth">ETH</div>
              <div className="hero-float hf-bnb">BNB</div>
              <div className="hero-float hf-card" />
              <div className="hero-float hf-globe" />
            </div>
          </div>
        </div>
      </section>

      <div className="ticker-wrap">
        <TickerRow bundle={bundle} />
      </div>

      <section className="section" id="how">
        <div className="section-eyebrow reveal">Protocol Mechanics</div>
        <h2 className="section-title reveal">
          How <em>CLB</em> works for you
        </h2>
        <div className="steps-grid">
          <div className="step-card reveal">
            <span className="step-number">01</span>
            <div className="step-icon gold">🔐</div>
            <div className="step-title">Deposit & Lock</div>
            <p className="step-desc">
              Stake BNB into a pool tier of your choice. Your deposit is locked on-chain and mints a soulbound
              BEP-20 receipt — your proof of position on BSC.
            </p>
          </div>
          <div className="step-card reveal" style={{ transitionDelay: "0.1s" }}>
            <span className="step-number">02</span>
            <div className="step-icon blue">⚡</div>
            <div className="step-title">Leveraged CLB Loan</div>
            <p className="step-desc">
              Your tier determines leverage. CLB loans scale with commitment — higher pools unlock higher
              multipliers against your principal in CLB terms.
            </p>
          </div>
          <div className="step-card reveal" style={{ transitionDelay: "0.2s" }}>
            <span className="step-number">03</span>
            <div className="step-icon teal">🎯</div>
            <div className="step-title">Auto-Liquidation</div>
            <p className="step-desc">
              When BTC or ETH hit protocol price targets, positions liquidate in phases. A significant share of
              profits is designed to return directly to depositors.
            </p>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="features-inner">
          <div className="section-eyebrow features-eyebrow reveal">Why CryptoLoanBoost</div>
          <h2 className="features-title reveal">
            Built for the <em>serious</em> DeFi participant
          </h2>
          {ecosystemLine ? (
            <p
              className="reveal"
              style={{
                marginTop: 16,
                fontSize: 14,
                fontWeight: 400,
                color: "var(--muted)",
                maxWidth: 720,
                lineHeight: 1.65,
              }}
            >
              {ecosystemLine}
            </p>
          ) : null}
          <div className="feat-grid">
            {[
              { icon: "🔗", title: "BEP-20 Native", desc: "All positions and receipts are on-chain BEP-20 tokens — your wallet, your keys, your assets." },
              { icon: "📲", title: "Mobile-First App", desc: "Full pool management, PIN/biometrics security, and fund movements from the CLB mobile app." },
              { icon: "⚙️", title: "Protocol-Driven", desc: "Auto-liquidation is rule-based — no manual intervention, no admin override, just smart contract logic." },
              { icon: "🌐", title: "Multi-Level Referrals", desc: "Earn from your network across multiple levels. CLB's referral program rewards growth." },
              { icon: "💎", title: "CLB Token Rewards", desc: "CLB token is used for fees, rewards, and loan mechanics across the entire ecosystem." },
              { icon: "👁️", title: "Portfolio Mirror", desc: "Web dashboard gives you a read-only view of balances, mining, and referrals — all in one place." },
              { icon: "🔒", title: "Soulbound Receipts", desc: "Position receipts are non-transferable on-chain tokens — your position can't be accidentally sent." },
              { icon: "🚀", title: "Low BSC Fees", desc: "BSC gas is a fraction of Ethereum mainnet — keep more of your profits, spend less on transactions." },
            ].map((f) => (
              <div key={f.title} className="feat-cell reveal">
                <div className="feat-icon">{f.icon}</div>
                <div className="feat-title">{f.title}</div>
                <p className="feat-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pool-section" id="pools">
        <div className="section-eyebrow reveal">Staking Pools</div>
        <h2 className="section-title reveal">
          Choose your <em>tier</em>
        </h2>
        <div className="pool-layout">
          <div className="pool-card reveal">
            <div className="pool-card-header">
              <div className="pool-card-title">Active Pools</div>
              <span className="pool-badge">{poolBadgeLabel}</span>
            </div>
            <div className="pool-tiers" id="pool-tiers">
              {poolsStatus === "loading" && (
                <div className="pool-tier" style={{ cursor: "default", background: "var(--surface2)" }}>
                  <span className="pool-tier-name" style={{ flex: 1 }}>
                    Loading pools from database…
                  </span>
                </div>
              )}
              {poolsStatus === "empty" && (
                <div className="pool-tier" style={{ cursor: "default", background: "var(--surface2)" }}>
                  <span className="pool-tier-name" style={{ flex: 1 }}>
                    No active pools yet. Create pools in the admin dashboard.
                  </span>
                </div>
              )}
              {poolsStatus === "demo" && (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--muted)",
                    marginBottom: 12,
                    lineHeight: 1.5,
                  }}
                >
                  Live API unreachable — showing example tiers. Set <code>NEXT_PUBLIC_API_URL</code> to your backend.
                </p>
              )}
              {(poolsStatus === "live" || poolsStatus === "demo") &&
                pools.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`pool-tier${i === activeTier ? " active" : ""}`}
                    onClick={() => setActiveTier(i)}
                  >
                    <div className="pool-tier-dot" style={{ background: p.indicatorColor }} />
                    <span className="pool-tier-name">{p.name.replace(/\s+pool\s*$/i, "").trim() || p.name}</span>
                    <span className="pool-tier-bnb">
                      {formatMinStakeAmount(p.minDeposit)} {p.tokenSymbol}
                    </span>
                    <span className="pool-tier-mult">{p.multLabel}</span>
                  </button>
                ))}
            </div>
          </div>

          <div className="pool-info reveal">
            {tier ? (
              <>
                <div className="pool-info-card">
                  <div className="pool-info-label">Selected Pool</div>
                  <div className="pool-info-val">
                    <PoolNameDisplay name={tier.name} />
                  </div>
                  <div className="pool-info-sub">
                    Min stake:{" "}
                    <strong>
                      {formatMinStakeAmount(tier.minDeposit)} {tier.tokenSymbol}
                    </strong>
                  </div>
                </div>
                <div className="pool-info-card">
                  <div className="pool-info-label">
                    {tier.leverageRatio != null && tier.leverageRatio > 0 ? "Leverage Multiplier" : tier.apy > 0 ? "APY" : "Multiplier / APY"}
                  </div>
                  <div className="pool-info-val">
                    <span>{tier.multLabel}</span>
                  </div>
                  <div className="pool-info-sub">
                    {tier.leverageRatio != null && tier.leverageRatio > 0
                      ? "CLB loan scales with tier commitment"
                      : tier.apy > 0
                        ? "Annual yield for this pool tier"
                        : "Configure leverage or APY on this pool in admin"}
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
                <div className="pool-info-card pool-info-row">
                  <div>
                    <div className="pool-info-label">Auto-Liquidation</div>
                    <div className="pool-liquidation-title">Protocol-Driven</div>
                    <div className="pool-info-sub">
                      {tier.phase1Target != null || tier.phase2Target != null ? (
                        <>
                          {tier.heldAsset ? `${tier.heldAsset} targets: ` : "Price targets: "}
                          {tier.phase1Target != null ? (
                            <>
                              P1 ${tier.phase1Target.toLocaleString("en-US")}
                              {tier.phase2Target != null ? ` · P2 $${tier.phase2Target.toLocaleString("en-US")}` : ""}
                            </>
                          ) : tier.phase2Target != null ? (
                            <>P2 ${tier.phase2Target.toLocaleString("en-US")}</>
                          ) : (
                            "Triggers on BTC/ETH price targets"
                          )}
                        </>
                      ) : (
                        "Triggers on BTC/ETH price targets (configure phases on the pool in admin)"
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: "12px 22px", fontSize: "14px" }}
                    onClick={() => downloadApp(bundle?.mobileApp)}
                  >
                    Download App
                  </button>
                </div>
              </>
            ) : (
              <div className="pool-info-card">
                <div className="pool-info-label">Pools</div>
                <div className="pool-info-sub" style={{ marginTop: 8 }}>
                  {poolsStatus === "loading"
                    ? "Loading pool details…"
                    : "When active pools exist, details for the selected tier appear here."}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="referral-section" id="referrals">
        <div className="referral-inner">
          <div>
            <div className="section-eyebrow reveal">Multi-Level Referrals</div>
            <h2 className="section-title reveal referral-title-dark">
              Earn from your <em>network</em>
            </h2>
            <p className="reveal ref-intro">
              Every person you refer — and every person they refer — contributes to your passive CLB earnings. The
              deeper the tree, the more you earn.
            </p>
            {bundle?.referralStats ? (
              <p className="reveal ref-intro" style={{ marginTop: 12 }}>
                Live network:{" "}
                <strong>{bundle.referralStats.totalReferrals.toLocaleString()}</strong> referrals recorded ·{" "}
                <strong>{formatCompactNumber(bundle.referralStats.totalRewardsDistributed)}</strong> total rewards
                distributed.
              </p>
            ) : null}
            <div className="ref-levels reveal">
              <div className="ref-level">
                <div className="ref-level-num">L1</div>
                <div>
                  <div className="ref-level-name">Direct Referrals</div>
                  <div className="ref-level-note">People you invite directly</div>
                </div>
                <div className="ref-level-pct">10%</div>
              </div>
              <div className="ref-level">
                <div className="ref-level-num">L2</div>
                <div>
                  <div className="ref-level-name">Second Level</div>
                  <div className="ref-level-note">Referrals of your referrals</div>
                </div>
                <div className="ref-level-pct">5%</div>
              </div>
              <div className="ref-level">
                <div className="ref-level-num">L3</div>
                <div>
                  <div className="ref-level-name">Third Level</div>
                  <div className="ref-level-note">Deep network rewards</div>
                </div>
                <div className="ref-level-pct">2%</div>
              </div>
            </div>
          </div>

          <div className="ref-network reveal" style={{ position: "relative", height: 320 }}>
            <div className="ref-node rn-you" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
              You
            </div>
            <div className="ref-node rn-l1" style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", animationDelay: "0s" }}>
              L1
            </div>
            <div className="ref-node rn-l1" style={{ position: "absolute", top: "50%", left: "15%", transform: "translateY(-50%)", animationDelay: "-0.7s" }}>
              L1
            </div>
            <div className="ref-node rn-l1" style={{ position: "absolute", top: "50%", right: "15%", transform: "translateY(-50%)", animationDelay: "-1.4s" }}>
              L1
            </div>
            <div className="ref-node rn-l1" style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", animationDelay: "-2.1s" }}>
              L1
            </div>
            <div className="ref-node rn-l2" style={{ position: "absolute", top: 5, left: "15%", animationDelay: "-0.4s" }}>
              L2
            </div>
            <div className="ref-node rn-l2" style={{ position: "absolute", top: 5, right: "15%", animationDelay: "-1.1s" }}>
              L2
            </div>
            <div className="ref-node rn-l2" style={{ position: "absolute", bottom: 5, left: "20%", animationDelay: "-1.8s" }}>
              L2
            </div>
            <div className="ref-node rn-l2" style={{ position: "absolute", bottom: 5, right: "20%", animationDelay: "-0.9s" }}>
              L2
            </div>
            <div className="ref-node rn-l3" style={{ position: "absolute", top: 50, left: "2%", animationDelay: "-0.6s" }}>
              L3
            </div>
            <div className="ref-node rn-l3" style={{ position: "absolute", top: 50, right: "2%", animationDelay: "-1.3s" }}>
              L3
            </div>
            <div className="ref-node rn-l3" style={{ position: "absolute", bottom: 50, left: "2%", animationDelay: "-2.0s" }}>
              L3
            </div>
            <div className="ref-node rn-l3" style={{ position: "absolute", bottom: 50, right: "2%", animationDelay: "-0.3s" }}>
              L3
            </div>

            <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.15 }} viewBox="0 0 400 320">
              <line x1="200" y1="160" x2="200" y2="30" stroke="#F0A500" strokeWidth="1.5" strokeDasharray="4,4" />
              <line x1="200" y1="160" x2="60" y2="160" stroke="#F0A500" strokeWidth="1.5" strokeDasharray="4,4" />
              <line x1="200" y1="160" x2="340" y2="160" stroke="#F0A500" strokeWidth="1.5" strokeDasharray="4,4" />
              <line x1="200" y1="160" x2="200" y2="290" stroke="#F0A500" strokeWidth="1.5" strokeDasharray="4,4" />
            </svg>
          </div>
        </div>
      </section>

      <section className="trust-section" id="security">
        <div className="section-eyebrow reveal">Trust & Security</div>
        <h2 className="section-title reveal">
          Built on <em>solid</em> foundations
        </h2>
        <p className="reveal trust-intro">
          CryptoLoanBoost runs entirely on BNB Smart Chain. Every position, every loan, and every liquidation event
          is recorded on-chain and verifiable by anyone.
        </p>
        <div className="trust-pills reveal">
          {[...trustPillsFromHealth(bundle), ...STATIC_TRUST_PILLS].map(([color, label], idx) => (
            <div key={`${label}-${idx}`} className="trust-pill">
              <div className="trust-pill-dot" style={{ background: color }} />
              {label}
            </div>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <h2 className="cta-title reveal">
          Ready to boost your
          <br />
          <em>crypto portfolio?</em>
        </h2>
        <p className="cta-sub reveal">
          Connect your BSC wallet and start exploring pools, loans, and referral rewards today.
        </p>
        <div className="cta-buttons reveal">
          <button
            type="button"
            className="btn-gold"
            onClick={() => downloadApp(bundle?.mobileApp)}
          >
            Download App
          </button>
          <button type="button" className="btn-secondary" onClick={openWebApp}>
            Open Web App ↗
          </button>
        </div>
      </section>

      <footer>
        <div className="footer-inner">
          <div className="footer-logo">
            <img src="/clb-icon.png" alt="" width={28} height={28} />
            Crypto<span>Loan</span>Boost
          </div>
          <ul className="footer-links">
            <li>
              <a href={APP_URL}>App</a>
            </li>
            <li>
              <a href="#how">How it works</a>
            </li>
            <li>
              <a href="#pools">Pools</a>
            </li>
            <li>
              <a href="#security">Security</a>
            </li>
          </ul>
          <ul className="footer-social">
            <li>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                Twitter
              </a>
            </li>
            <li>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer">
                Facebook
              </a>
            </li>
            <li>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            </li>
            <li>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            </li>
          </ul>
          <div className="footer-copy">© CryptoLoanBoost 2026 · BSC · BEP-20</div>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user && user.role === "ADMIN") {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F6] px-4">
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFDC00]/20">
          <Shield className="h-8 w-8 text-[#0A0A0A]" />
        </div>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0A0A0A] border-t-transparent" />
      </div>
    );
  }

  if (user && user.role === "ADMIN") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F6]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0A0A0A]" />
      </div>
    );
  }

  return <CryptoLanding />;
}
