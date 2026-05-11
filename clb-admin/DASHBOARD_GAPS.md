# CLB Admin Dashboard - Major Gaps (vs PDF Presentation)

## 1. 🔗 Smart Contract Architecture (MISSING)
PDF: PoolManager, LoanVault, LiquidationBot, ReferralEngine, FeeDistributor modules are all expected
**Status:** No page to manage or monitor contract modules
**Impact:** Admin cannot see each contract status beyond a single address view
**Recommended:** Add a "Contract Modules" card/page showing:
- PoolManager.sol status (pool creation, fee collection)
- LoanVault.sol (locked crypto, loan-to-value ratios)
- LiquidationBot.sol (Chainlink feed monitoring, auto-sell triggers)
- ReferralEngine.sol (5-level tree tracking, commission distribution)
- FeeDistributor.sol (85/15 split execution status)

## 2. 📡 Chainlink Oracle Integration (MISSING)
PDF: Chainlink Price Feeds for BTC/USD and ETH/USD on BSC
**Status:** Dashboard does not show live Chainlink prices
**Impact:** Admin cannot see real-time BTC ($76,130) and ETH ($2,268) prices
**Recommended:**
- Real-time price ticker in the dashboard header
- Oracle freshness validator: `require(updatedAt > block.timestamp - 3600)`
- BTC/USD and ETH/USD price charts
- Oracle status: Active / Stale / Disconnected

## 3. 🛡️ Security & Audit Management (MISSING)
PDF: Full audit by CertiK/PeckShield/Hacken, multi-sig via Gnosis Safe
**Status:** No section for audit status or security overview
**Impact:** Admin cannot track:
- Contract audit status (In Progress / Passed / Failed)
- Multi-sig Gnosis Safe configuration (3-of-5 required)
- Emergency pause capability
- Penetration test results
**Recommended:** Add a "Security" page with:
- Audit report upload/link
- Multi-sig admin key tracker
- Emergency pause button (with confirmation flow)
- Vulnerability status dashboard

## 4. 🎯 5-Level Referral Visualization (PARTIAL)
PDF: L1: 20%, L2: 8%, L3: 5%, L4: 3%, L5: 1% of pool fee
**Status:** Referrals page has only a leaderboard (1 level)
**Impact:** Admin cannot see the network tree structure
**Recommended:**
- Replace leaderboard with **Referral Tree visualization** (D3.js/Sigma.js)
- Commission breakdown per level
- Network depth analysis
- MLM-style downline viewer

## 5. 💰 Profit Calculator Tool (MISSING)
PDF: `User Net Profit = (ETH Amount × Liquidation Price × Liquidation %) − Pool Fee`
**Status:** No calculator to preview profits
**Impact:** Admin cannot demo or calculate expected returns
**Recommended:** Add a profit calculator for admin:
- Input: Pool tier ($100-$1000), Asset (BTC/ETH), Phase target
- Auto-calculate: 85% user profit, 15% platform fee
- Phase 1 vs Phase 2 comparison

## 6. 🔄 PancakeSwap Integration (MISSING)
PDF: PancakeSwap Router for BTC/ETH swaps
**Status:** No liquidity management or DEX integration
**Impact:** Admin cannot monitor:
- Swap routes and slippage
- PancakeSwap pair liquidity
- Token allowances and approvals
**Recommended:** Add "Liquidity" section:
- PancakeSwap pair data
- Swap history and routing info
- Token approval management

## 7. 📱 Wallet Integration Admin (MISSING)
PDF: MetaMask + Trust Wallet setup guides, network addition
**Status:** Settings page has only quick links - no wallet management
**Impact:** Admin cannot manage:
- Supported wallets list
- Network configs (BSC Mainnet 56, Testnet 97)
- WalletConnect session management
- EIP-1193 provider status
**Recommended:** Add a "Wallet Config" page:
- BSC network details to share with users
- Wallet tutorial CMS (editable guides)
- Supported chain tracker

## 8. 📊 TVL & Price Mock Data -> Real Data
**Status:** Charts use `Math.random()` (mock data)
**Impact:** Analytics have no real value
**Recommended:** Connect to:
- On-chain TVL (via ethers.js + contract calls)
- Chainlink price feeds
- Backend transaction aggregation

## 9. 🏊 Pool Lifecycle Management (MISSING)
PDF: Pool tiers $100, $250, $500, $1000 for BTC and ETH = 8 pools
**Status:** Packages page has "Seed Default Tiers" but no lifecycle management
**Impact:** Admin cannot:
- Edit existing packages
- Deactivate/activate specific tiers
- Set liquidation targets for each pool
- View pool maturity (days to Phase 1/Phase 2)
**Recommended:** Enhance Packages page:
- Edit dialog and save to backend
- Lifecycle timeline per pool
- Auto-liquidation trigger management

## 10. 🎫 BEP-20 Pool Receipt Tokens (MISSING)
PDF: BEP-20 Token Standard for pool receipts (NFT-like proof of investment)
**Status:** No tracking for receipt tokens
**Impact:** Admin cannot track:
- Tokens minted per pool
- Token holders list
- Token contract management
**Recommended:** Add "Receipts" section:
- Token contract details
- Mint/Burn history
- Holder distribution

## 11. 🚀 Roadmap Tracker (MISSING)
PDF: Phase 1 (Foundation), Phase 2 (Security), Phase 3 (Frontend), Phase 4 (Mainnet)
**Status:** No project status tracker
**Recommended:** Add a "Roadmap" page:
- Progress bars per phase
- Milestone checklist
- ETA tracking
- Phase 4: BSC Mainnet launch readiness

## 12. 📈 Referral Bonus % Error (WRONG)
**Current:** Settings page says "5% of deposits"
**PDF:** 5-Level system = L1:20%, L2:8%, L3:5%, L4:3%, L5:1% **of Pool Fee** (not deposits)
**Impact:** Settings page has incorrect information
**Fix:** Update Settings page with 5-level percentages

## 13. 🔐 Admin User API Endpoints (MISSING)
**Status:** Users page has CRUD UI but backend `/api/admin/users/*` endpoints are missing
**Impact:** User management does not work (update/delete) until endpoints are built
**Fix:** Add backend routes for admin user CRUD

## 14. 🎯 Investment Positions (PARTIAL)
**Status:** Investments page only has mock data
**Impact:** Admin cannot see real user investments
**Fix:** Add `PoolMember` model in Prisma + API endpoints

## 15. 📦 Payment Types (NEEDS BACKEND)
**Status:** Payments page has mock data and types: DEPOSIT, WITHDRAWAL, REWARD, REFERRAL_BONUS, FEE
**Impact:** Backend transaction model does not appear to support all these types
**Fix:** Update Prisma Transaction model with these types + enum

---

## Priority Fix Order:
1. **Fix referral %** (quick text fix)
2. **Add admin users CRUD API** (backend)
3. **Add Contract Modules monitor** (frontend + ethers.js)
4. **Add Chainlink price feed** (frontend + ethers.js)
5. **Replace mock data** with real on-chain data
6. **Add 5-level referral tree** visualization
7. **Add Security/Audit page**
8. **Add Profit Calculator**
