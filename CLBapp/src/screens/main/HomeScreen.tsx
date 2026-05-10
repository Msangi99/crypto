import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Dimensions, Image, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { CreditWalletCopy } from '../../constants/creditWalletCopy';
import Badge from '../../components/ui/Badge';
import { userAPI, notificationsAPI, creditWalletAPI, loansAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useLivePrices } from '../../hooks/useLivePrices';

const { width } = Dimensions.get('window');
const LOGO = require('../../../assets/logo.png');

const SWAP_COIN_ICONS: Record<string, string> = {
  BTC: 'logo-bitcoin',
  ETH: 'diamond-outline',
  BNB: 'cube',
  SOL: 'flash',
  ADA: 'card',
  DOGE: 'paw',
  DOT: 'ellipse',
  MATIC: 'layers',
  AVAX: 'snow',
  LINK: 'link',
  UNI: 'infinite',
  XRP: 'water',
  LTC: 'diamond',
  USDT: 'cash',
  USDC: 'cash',
};

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<any>(null);
  const [market, setMarket] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [creditBalances, setCreditBalances] = useState<{
    depositCreditUsd: number;
    claimedPoolCreditUsd: number;
    swapHoldingsUsd: number;
  } | null>(null);
  const [balanceTab, setBalanceTab] = useState<'deposit' | 'loan' | 'swap'>('swap');
  const [loans, setLoans] = useState<any[]>([]);
  const [currency, setCurrency] = useState<'USD' | 'BTC' | 'ETH' | 'BNB'>('USD');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, m, p, n, cr, ln] = await Promise.all([
        userAPI.dashboard(),
        userAPI.market(),
        userAPI.portfolio(),
        notificationsAPI.unreadCount().catch(() => ({ data: { unreadCount: 0 } })),
        creditWalletAPI.balances().catch(() => null),
        loansAPI.list().catch(() => ({ data: { loans: [] } })),
      ]);
      setDashboard(d.data);
      setMarket(m.data);
      setPortfolio(p.data);
      setUnreadCount(n.data.unreadCount ?? 0);
      if (cr?.data?.balances) setCreditBalances(cr.data.balances);
      else setCreditBalances(null);
      setLoans(ln.data?.loans || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Re-fetch every time screen is focused (e.g. after creating a new leveraged position)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // ── Live prices via Binance WebSocket ────────────────────────────────
  const baseCoins: any[] = market?.market?.coins ?? [];
  const positions: any[] = portfolio?.positions ?? [];
  const positionAssets = positions
    .map((p: any) => p.asset?.toUpperCase?.() ?? p.asset)
    .filter((s: any) => typeof s === 'string' && s.length > 0);
  // Always include BTC/ETH/BNB so currency conversion always has rates available
  const liveSymbols = Array.from(new Set([...baseCoins.slice(0, 8).map((c: any) => c.symbol), ...positionAssets, 'BTC', 'ETH', 'BNB']));
  const livePrices = useLivePrices(liveSymbols);

  const liveCoins = baseCoins.map((c: any) => {
    const live = livePrices[c.symbol];
    return live
      ? { ...c, price: live.price, change24h: live.change24h, _live: true }
      : c;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shortAddress = user?.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : '';

  const stats = dashboard?.dashboard?.stats ?? {};
  const livePositions = positions.map((pos: any) => {
    const symbol = (pos.asset ?? 'BNB').toUpperCase();
    const amountBought = Number(pos.cryptoAllocation?.amount ?? 0);
    const livePrice = livePrices[symbol]?.price;
    const currentValue = livePrice && amountBought > 0
      ? amountBought * livePrice
      : Number(pos.currentValueUsd ?? 0);
    return { ...pos, symbol, amountBought, currentValue };
  });
  const liveTotalValue = livePositions.reduce((sum: number, pos: any) => sum + (pos.currentValue || 0), 0);
  const totalValue = livePositions.length > 0 ? liveTotalValue : Number(stats.portfolioValueUsd ?? 0);
  const totalInvested = stats.totalDepositedUsd ?? 0;
  const pnl = totalValue - totalInvested;
  const pnlPct = totalInvested > 0 ? ((pnl / totalInvested) * 100).toFixed(2) : '0.00';

  /** Leveraged loan holdings — valueUsd updates live with market price */
  const leveragedHoldings = useMemo(() => {
    const validLoans = loans.filter((l: any) => {
      const status = (l.status || '').toUpperCase();
      const chain = (l.collateralChain || '').toUpperCase();
      const isActive = status === 'ACTIVE' || status === 'PENDING';
      const isValidChain = ['BTC', 'ETH', 'BNB'].includes(chain);
      const hasAmount = Number(l.collateralAmount) > 0;
      return isActive && isValidChain && hasAmount;
    });
    return validLoans.map((l: any) => {
      const symbol = (l.collateralChain || '').toUpperCase();
      const amount = Number(l.collateralAmount || 0);
      const entryPrice = Number(l.collateralPriceUsd || 0);
      const originalValueUsd = Number(l.collateralValueUsd || 0);
      const entryFeeUsd = Number(l.entryFeeUsd || 0);
      // Use live price to compute current position value, fallback to DB value
      const livePrice = livePrices[symbol]?.price;
      const valueUsd = livePrice && amount > 0 ? amount * livePrice : originalValueUsd;
      // Calculate leverage from original entry data
      const notionalValue = amount * entryPrice;
      const leverage = notionalValue > 0 ? Math.round(originalValueUsd / notionalValue) : 10;
      return {
        symbol,
        amount,
        valueUsd,           // live-updated current value
        originalValueUsd,   // original entry value (from DB)
        entryPrice,
        entryFeeUsd,
        leverage: leverage > 1 ? leverage : 10,
        isLeveraged: true,
      };
    });
  }, [loans, livePrices]);

  // "Held Crypto" shows ONLY active leveraged loan positions (not portfolio positions)
  const swappedHoldings = useMemo(() => {
    return leveragedHoldings;
  }, [leveragedHoldings]);

  const swappedFromPositionsUsd = useMemo(
    () => swappedHoldings.reduce((s, r) => s + r.valueUsd, 0),
    [swappedHoldings]
  );
  // Swapped tab shows leveraged positions (from loans) ONLY - no old swapHoldingsUsd fallback
  const swappedTabUsd = swappedFromPositionsUsd;

  const tabAmount =
    balanceTab === 'deposit'
      ? creditBalances?.depositCreditUsd ?? 0
      : balanceTab === 'loan'
        ? creditBalances?.claimedPoolCreditUsd ?? 0
        : swappedTabUsd;
  const tabLabel =
    balanceTab === 'deposit'
      ? CreditWalletCopy.depositTabFull
      : balanceTab === 'loan'
        ? CreditWalletCopy.loanTabFull
        : CreditWalletCopy.swapTabFull;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Dark Gradient Header */}
        <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
          {/* Top Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image source={LOGO} style={styles.headerLogo} resizeMode="contain" />
              <View>
                <Text style={styles.greeting}>Good {getGreeting()}</Text>
                <View style={styles.addressRow}>
                  <View style={styles.addressDot} />
                  <Text style={styles.address}>{shortAddress}</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate('Notifications')}>
              <Ionicons name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={22} color={unreadCount > 0 ? Colors.primary : Colors.textSecondary} />
              {unreadCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Portfolio Balance — tabbed credit buckets + total */}
          <View style={styles.balanceSection}>
            <View style={styles.balanceTabs}>
              {(
                [
                  { key: 'swap' as const, short: CreditWalletCopy.swapTabShort, full: CreditWalletCopy.swapTabFull },
                  { key: 'loan' as const, short: CreditWalletCopy.loanTabShort, full: CreditWalletCopy.loanTabFull },
                  { key: 'deposit' as const, short: CreditWalletCopy.depositTabShort, full: CreditWalletCopy.depositTabFull },
                ]
              ).map((t) => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.balanceTab, balanceTab === t.key && styles.balanceTabActive]}
                  onPress={() => setBalanceTab(t.key)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.balanceTabText, balanceTab === t.key && styles.balanceTabTextActive]} numberOfLines={1}>
                    {t.short}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.balanceTop}>
              <Text style={styles.balanceLabel}>{tabLabel}</Text>
              <View style={styles.balanceControls}>
                <TouchableOpacity onPress={() => setShowCurrencyPicker(!showCurrencyPicker)} style={styles.currencyBtn}>
                  <Text style={styles.currencyText}>{currency}</Text>
                  <Ionicons name="chevron-down" size={14} color={Colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)}>
                  <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.balanceValue}>
              {balanceVisible
                ? (() => {
                    const amount = tabAmount;
                    if (currency === 'USD') return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    const rate = livePrices[currency]?.price; // Use uppercase key e.g. 'BTC'
                    if (!rate || rate === 0) return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (loading...)`;
                    const converted = amount / rate;
                    const decimals = currency === 'BTC' ? 8 : currency === 'ETH' ? 6 : 4;
                    return `${converted.toFixed(decimals)} ${currency}`;
                  })()
                : '••••••'}
            </Text>
            {showCurrencyPicker && (
              <View style={styles.currencyPicker}>
                {['USD', 'BTC', 'ETH', 'BNB'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.currencyOption, currency === c && styles.currencyOptionActive]}
                    onPress={() => { setCurrency(c as any); setShowCurrencyPicker(false); }}
                  >
                    <Text style={[styles.currencyOptionText, currency === c && styles.currencyOptionTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {balanceVisible && balanceTab === 'deposit' ? (
              <Text style={styles.balanceBucketHint}>{CreditWalletCopy.depositHint}</Text>
            ) : balanceVisible && balanceTab === 'loan' ? (
              <Text style={styles.balanceBucketHint}>{CreditWalletCopy.loanHint}</Text>
            ) : null}
            <Text style={styles.balancePortfolioFoot}>
              {balanceVisible
                ? `Portfolio total $${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : ' '}
            </Text>
            <View style={styles.pnlRow}>
              <View style={[styles.pnlBadge, pnl >= 0 ? styles.pnlBadgeProfit : styles.pnlBadgeLoss]}>
                <Ionicons name={pnl >= 0 ? 'trending-up' : 'trending-down'} size={14} color={pnl >= 0 ? '#00D6A1' : '#FF4757'} />
                <Text style={[styles.pnlBadgeText, pnl >= 0 && styles.pnlTextProfit, pnl < 0 && styles.pnlTextLoss]}>
                  {pnl >= 0 ? '+' : ''}{pnlPct}%
                </Text>
              </View>
              <Text style={styles.pnlUsd}>{pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</Text>
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.quickStatsRow}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>${totalInvested.toLocaleString()}</Text>
              <Text style={styles.quickStatLabel}>Invested</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{stats.activePools ?? 0}</Text>
              <Text style={styles.quickStatLabel}>Active Pools</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={[styles.quickStatValue, { color: Colors.primary }]}>${(stats.referralEarnings ?? 0).toFixed(2)}</Text>
              <Text style={styles.quickStatLabel}>Referral Earn</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickActionsScroll}
            contentContainerStyle={styles.quickActionsContent}
          >
            {[
              { icon: 'wallet-outline', label: 'CLB Tokens', screen: 'WalletTokens' },
              { icon: 'hardware-chip-outline', label: 'Mine CLB', screen: 'MiningClb' },
              { icon: 'swap-horizontal', label: 'Use your loan', screen: 'LoanHub' },
              { icon: 'add-circle-outline', label: 'USDT deposit', screen: 'DepositReceive' },
              { icon: 'people-outline', label: 'Referrals', screen: 'Referrals' },
            ].map((a) => (
              <TouchableOpacity key={a.label} style={styles.qaItem} onPress={() => navigation.navigate(a.screen)}>
                <View style={styles.qaIcon}>
                  <Ionicons name={a.icon as any} size={22} color={Colors.primary} />
                </View>
                <Text style={styles.qaLabel} numberOfLines={2}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </LinearGradient>

        {/* Live Market */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.liveTitleWrap}>
              <Text style={styles.sectionTitle}>Live Market</Text>
              <LiveDot />
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Market')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.marketScroll}>
            {liveCoins.length
              ? liveCoins.slice(0, 8).map((coin: any) => (
                  <MarketChip key={coin.symbol} coin={coin} />
                ))
              : ['BTC', 'ETH', 'BNB'].map((c) => <MarketChipSkeleton key={c} label={c} />)}
          </ScrollView>
        </View>

        {/* Swapped crypto (aggregated per coin from leveraged / pool positions) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.sectionTitle}>Held Crypto</Text>
              <View style={styles.liveBadgeSmall}>
                <View style={styles.liveDotSmall} />
                <Text style={styles.liveTextSmall}>LIVE</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Portfolio')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.swappedSub}>
            Platform-held crypto from leveraged positions. Updates in real-time with market prices.
          </Text>
          {swappedHoldings.length > 0 ? (
            swappedHoldings.map((row) => (
              <LiveCryptoCard 
                key={row.symbol} 
                row={row} 
                livePrice={livePrices[row.symbol]?.price}
              />
            ))
          ) : loans.filter((l: any) => (l.status || '').toUpperCase() === 'PENDING').length > 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={32} color={Colors.primary} />
              <Text style={styles.emptyText}>Loan pending confirmation</Text>
              <Text style={styles.emptyHint}>You have a loan waiting for deposit confirmation. Complete the deposit to see your held crypto.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('MyLoans')}>
                <Text style={styles.emptyBtnText}>View My Loans</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="cube-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No held crypto yet</Text>
              <Text style={styles.emptyHint}>Go to "Use Your Loan" and select "Enter Leveraged Pool" to open a BTC/ETH/BNB position.</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('LoanHub')}>
                <Text style={styles.emptyBtnText}>Open Position</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom spacing for scroll */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

function MarketChip({ coin }: { coin: any }) {
  const change = coin.change24h ?? 0;
  const isUp = change >= 0;
  const price = coin.price ?? 0;

  // Flash price color when it changes
  const prevPriceRef = useRef<number>(price);
  const flash = useRef(new Animated.Value(0)).current;
  const [flashDir, setFlashDir] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const prev = prevPriceRef.current;
    if (prev !== 0 && price !== prev) {
      setFlashDir(price > prev ? 'up' : 'down');
      flash.setValue(1);
      Animated.timing(flash, {
        toValue: 0,
        duration: 900,
        useNativeDriver: false,
      }).start(() => setFlashDir(null));
    }
    prevPriceRef.current = price;
  }, [price]);

  const flashColor = flash.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.textPrimary, flashDir === 'up' ? '#00D6A1' : '#FF4757'],
  });

  const formattedPrice = price >= 1000
    ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : price >= 1 ? `$${price.toFixed(2)}` : `$${price.toFixed(4)}`;

  return (
    <View style={styles.marketChip}>
      <View style={styles.mcTopRow}>
        <View style={[styles.mcIcon, { backgroundColor: (coin.color || Colors.primary) + '22' }]}>
          <Text style={[styles.mcIconText, { color: coin.color || Colors.primary }]}>
            {coin.icon || coin.symbol?.[0] || '?'}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.mcCoin}>{coin.symbol}</Text>
          <Text style={styles.mcName}>{coin.name}</Text>
        </View>
      </View>
      <Animated.Text style={[styles.mcPrice, { color: flashColor }]}>
        {formattedPrice}
      </Animated.Text>
      <View style={[styles.mcChangeBadge, { backgroundColor: isUp ? 'rgba(0,214,161,0.12)' : 'rgba(255,71,87,0.12)' }]}>
        <Ionicons name={isUp ? 'caret-up' : 'caret-down'} size={10} color={isUp ? '#00D6A1' : '#FF4757'} />
        <Text style={[styles.mcChange, { color: isUp ? '#00D6A1' : '#FF4757' }]}>
          {Math.abs(change).toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

function LiveDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  return (
    <View style={styles.liveBadge}>
      <Animated.View style={[styles.liveDot, { opacity, transform: [{ scale }] }]} />
      <Text style={styles.liveText}>LIVE</Text>
    </View>
  );
}

function MarketChipSkeleton({ label }: { label: string }) {
  return (
    <View style={[styles.marketChip, { backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border }]}>
      <Text style={styles.mcCoin}>{label}</Text>
      <View style={styles.skeleton} />
      <View style={[styles.skeleton, { width: 50 }]} />
    </View>
  );
}

function LiveCryptoCard({ row, livePrice }: { row: { symbol: string; amount: number; valueUsd: number; originalValueUsd?: number; entryPrice?: number; entryFeeUsd?: number; leverage?: number; isLeveraged?: boolean }; livePrice?: number }) {
  const icon = (SWAP_COIN_ICONS[row.symbol] || 'cube-outline') as any;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const prevPriceRef = useRef(livePrice);

  // Flash animation when price changes
  useEffect(() => {
    if (livePrice && prevPriceRef.current && livePrice !== prevPriceRef.current) {
      const isUp = livePrice > prevPriceRef.current;
      setFlashColor(isUp ? '#00D6A1' : '#FF3D57');
      
      Animated.sequence([
        Animated.timing(flashAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(flashAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: false,
        }),
      ]).start(() => setFlashColor(null));
    }
    prevPriceRef.current = livePrice;
  }, [livePrice]);

  const flashOpacity = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  const currentValue = row.valueUsd; // already live-computed in parent
  const originalValue = row.originalValueUsd ?? row.valueUsd;
  const pnlUsd = currentValue - originalValue;
  const pnlPct = originalValue > 0 ? (pnlUsd / originalValue) * 100 : 0;
  const isProfit = pnlPct >= 0;

  return (
    <View style={styles.cryptoCard}>
      {/* Flash overlay for price changes */}
      {flashColor && (
        <Animated.View
          style={[
            styles.flashOverlay,
            { backgroundColor: flashColor, opacity: flashOpacity },
          ]}
        />
      )}
      
      {/* Gradient background */}
      <LinearGradient
        colors={row.isLeveraged ? ['rgba(0,214,161,0.08)', 'rgba(0,214,161,0.02)'] : ['rgba(240,185,11,0.08)', 'rgba(240,185,11,0.02)']}
        style={styles.cryptoCardGradient}
      />
      
      <View style={styles.cryptoCardContent}>
        {/* Left: Icon + Symbol */}
        <View style={styles.cryptoCardLeft}>
          <View style={[styles.cryptoIconBg, { backgroundColor: row.isLeveraged ? 'rgba(0,214,161,0.2)' : 'rgba(240,185,11,0.2)' }]}>
            <Ionicons name={icon} size={28} color={row.isLeveraged ? '#00D6A1' : Colors.primary} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.cryptoSymbol}>{row.symbol}</Text>
              {row.isLeveraged && row.leverage && (
                <View style={styles.leverageBadgeLarge}>
                  <Text style={styles.leverageBadgeTextLarge}>{row.leverage}x</Text>
                </View>
              )}
            </View>
            <Text style={styles.cryptoAmount}>
              {row.amount >= 0.0001 ? row.amount.toFixed(6) : row.amount.toFixed(8)} {row.symbol}
            </Text>
          </View>
        </View>

        {/* Center: Price Info */}
        <View style={styles.cryptoCardCenter}>
          {livePrice ? (
            <View style={styles.livePriceContainer}>
              <View style={styles.liveIndicator}>
                <View style={styles.livePulse} />
                <Text style={styles.livePriceText}>${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <View style={[styles.pnlBadge, { backgroundColor: isProfit ? 'rgba(0,214,161,0.15)' : 'rgba(255,61,87,0.15)' }]}>
                <Ionicons name={isProfit ? 'trending-up' : 'trending-down'} size={12} color={isProfit ? '#00D6A1' : '#FF3D57'} />
                <Text style={[styles.pnlText, { color: isProfit ? '#00D6A1' : '#FF3D57' }]}>
                  {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                </Text>
              </View>
              {pnlUsd !== 0 && (
                <Text style={{ fontSize: 10, color: isProfit ? '#00D6A1' : '#FF3D57', textAlign: 'center' }}>
                  {isProfit ? '+' : ''}${Math.abs(pnlUsd).toFixed(2)}
                </Text>
              )}
            </View>
          ) : (
            <Text style={styles.entryPriceText}>@${row.entryPrice?.toLocaleString()}</Text>
          )}
        </View>

        {/* Right: Value */}
        <View style={styles.cryptoCardRight}>
          <Text style={styles.cryptoValue}>
            ${currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          {row.isLeveraged && (
            <View style={styles.platformHeldBadge}>
              <Ionicons name="shield-checkmark" size={10} color="#00D6A1" />
              <Text style={styles.platformHeldText}>Platform Held</Text>
            </View>
          )}
          {row.entryFeeUsd && (
            <Text style={styles.entryFeeSmall}>Entry: ${row.entryFeeUsd.toLocaleString()}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header Gradient
  headerGradient: {
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { width: 36, height: 36, borderRadius: 8 },
  greeting: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  addressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#00D6A1' },
  address: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  notifBtn: { position: 'relative', padding: 8 },
  notifBadge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FF4757', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notifBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },

  // Balance Section
  balanceSection: {
    marginHorizontal: Spacing.lg, alignItems: 'center', gap: 8, paddingVertical: Spacing.md,
  },
  balanceTabs: {
    flexDirection: 'row',
    width: '100%',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  balanceTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  balanceTabActive: {
    backgroundColor: 'rgba(240,185,11,0.18)',
    borderColor: 'rgba(240,185,11,0.45)',
  },
  balanceTabText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  balanceTabTextActive: { color: Colors.primary },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  balanceLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  balanceValue: { fontSize: 40, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 },
  balanceBucketHint: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 6,
    paddingHorizontal: Spacing.md,
    opacity: 0.95,
  },
  balancePortfolioFoot: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    alignSelf: 'center',
    marginTop: -4,
    marginBottom: 4,
  },

  // P&L
  pnlRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pnlBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
  },
  pnlBadgeProfit: { backgroundColor: 'rgba(0,214,161,0.12)' },
  pnlBadgeLoss: { backgroundColor: 'rgba(255,71,87,0.12)' },
  pnlBadgeText: { fontSize: 13, fontWeight: '800' },
  pnlTextProfit: { color: '#00D6A1' },
  pnlTextLoss: { color: '#FF4757' },
  pnlUsd: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },

  // Quick Stats
  quickStatsRow: {
    flexDirection: 'row', marginHorizontal: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  quickStatItem: { flex: 1, alignItems: 'center' },
  quickStatValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  quickStatLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },
  quickStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Quick Actions
  quickActionsScroll: { marginTop: Spacing.md },
  quickActionsContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: 14,
    paddingRight: Spacing.xl,
  },
  qaItem: { alignItems: 'center', gap: 6, width: 76 },
  qaIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(240,185,11,0.1)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  qaLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  // Section
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  swappedSub: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    marginBottom: Spacing.md,
  },
  seeAll: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  liveTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
    backgroundColor: 'rgba(255,71,87,0.12)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 99, backgroundColor: '#FF4757' },
  liveText: { fontSize: 10, fontWeight: '900', color: '#FF4757', letterSpacing: 0.5 },

  // Market chips
  marketScroll: { marginHorizontal: -Spacing.lg, paddingHorizontal: Spacing.lg },
  marketChip: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.md, marginRight: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, minWidth: 140, gap: 8,
  },
  mcTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mcIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  mcIconText: { fontSize: 12, fontWeight: '800' },
  mcCoin: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, textTransform: 'uppercase' },
  mcName: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  mcPrice: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  mcChangeBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, alignSelf: 'flex-start' },
  mcChange: { fontSize: 11, fontWeight: '700' },

  // Activity
  actRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  actIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actType: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize' },
  actTime: { fontSize: 12, color: Colors.textMuted },
  actAmount: { fontSize: 13, fontWeight: '700' },
  emptyState: { alignItems: 'center', gap: 8, padding: Spacing.xl },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  emptyHint: { fontSize: 12, color: Colors.textMuted, opacity: 0.85, textAlign: 'center', marginTop: 4, paddingHorizontal: Spacing.md },

  // Referral promo
  referralCard: {
    borderRadius: Radius.xl, padding: Spacing.lg,
  },
  referralContent: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
  },
  referralIconBg: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  referralTitle: { fontSize: 16, fontWeight: '800', color: '#000' },
  referralSub: { fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.6)', marginTop: 2 },
  referralBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  referralBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },

  // Skeletons
  skeleton: { height: 14, width: 80, borderRadius: 6, backgroundColor: Colors.bgElevated },

  // Currency selector
  balanceControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  currencyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  currencyPicker: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  currencyOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currencyOptionActive: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
  },
  currencyOptionText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  currencyOptionTextActive: { color: Colors.primary },

  // Leveraged holdings styling
  leveragedRow: {
    borderLeftWidth: 3,
    borderLeftColor: '#00D6A1',
    backgroundColor: 'rgba(0,214,161,0.05)',
  },
  leverageBadge: {
    backgroundColor: '#00D6A1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  leverageBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
  },
  holdingTag: {
    fontSize: 10,
    color: '#00D6A1',
    marginTop: 2,
    fontWeight: '600',
  },
  entryFeeTag: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  liveBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,214,161,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D6A1',
  },
  liveTextSmall: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00D6A1',
  },
  emptyBtn: {
    marginTop: Spacing.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  emptyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
  },

  // New Amazing Crypto Card Styles
  cryptoCard: {
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  flashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  cryptoCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cryptoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    position: 'relative',
    zIndex: 2,
  },
  cryptoCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cryptoIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cryptoSymbol: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  leverageBadgeLarge: {
    backgroundColor: '#00D6A1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  leverageBadgeTextLarge: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  cryptoAmount: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  cryptoCardCenter: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  livePriceContainer: {
    alignItems: 'center',
    gap: 6,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,214,161,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  livePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D6A1',
  },
  livePriceText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00D6A1',
  },
  pnlText: {
    fontSize: 11,
    fontWeight: '700',
  },
  entryPriceText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  cryptoCardRight: {
    alignItems: 'flex-end',
  },
  cryptoValue: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  platformHeldBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: 'rgba(0,214,161,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  platformHeldText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00D6A1',
  },
  entryFeeSmall: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
