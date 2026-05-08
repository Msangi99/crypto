import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Dimensions, Image, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import { userAPI, notificationsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useLivePrices } from '../../hooks/useLivePrices';

const { width } = Dimensions.get('window');
const LOGO = require('../../../assets/logo.png');

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<any>(null);
  const [market, setMarket] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const [d, m, p, n] = await Promise.all([
        userAPI.dashboard(),
        userAPI.market(),
        userAPI.portfolio(),
        notificationsAPI.unreadCount().catch(() => ({ data: { unreadCount: 0 } })),
      ]);
      setDashboard(d.data);
      setMarket(m.data);
      setPortfolio(p.data);
      setUnreadCount(n.data.unreadCount ?? 0);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // ── Live prices via Binance WebSocket ────────────────────────────────
  const baseCoins: any[] = market?.market?.coins ?? [];
  const positions: any[] = portfolio?.positions ?? [];
  const positionAssets = positions
    .map((p: any) => p.asset?.toUpperCase?.() ?? p.asset)
    .filter((s: any) => typeof s === 'string' && s.length > 0);
  const liveSymbols = Array.from(new Set([...baseCoins.slice(0, 8).map((c: any) => c.symbol), ...positionAssets]));
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

          {/* Portfolio Balance */}
          <View style={styles.balanceSection}>
            <View style={styles.balanceTop}>
              <Text style={styles.balanceLabel}>Total Portfolio Value</Text>
              <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)}>
                <Ionicons name={balanceVisible ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceValue}>
              {balanceVisible ? `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '••••••'}
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
          <View style={styles.quickActions}>
            {[
              { icon: 'wallet-outline', label: 'CLB Tokens', screen: 'WalletTokens' },
              { icon: 'cash-outline', label: 'Get Loan', screen: 'LoanRequest' },
              { icon: 'add-circle-outline', label: 'Deposit', screen: 'Pools' },
              { icon: 'people-outline', label: 'Referrals', screen: 'Referrals' },
            ].map((a) => (
              <TouchableOpacity key={a.label} style={styles.qaItem} onPress={() => navigation.navigate(a.screen)}>
                <View style={styles.qaIcon}>
                  <Ionicons name={a.icon as any} size={22} color={Colors.primary} />
                </View>
                <Text style={styles.qaLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
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

        {/* My Pool Holdings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Pools</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Portfolio')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {livePositions.length > 0 ? livePositions.slice(0, 4).map((pos: any, i: number) => (
            <PoolHoldingRow key={pos.poolId ?? i} item={pos} />
          )) : (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No pools joined yet</Text>
            </View>
          )}
        </View>

        {/* Referral Promo */}
        <View style={[styles.section, { marginBottom: 100 }]}>
          <LinearGradient colors={Colors.gradientGold} style={styles.referralCard}>
            <View style={styles.referralContent}>
              <View style={styles.referralIconBg}>
                <Ionicons name="gift-outline" size={24} color="#000" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.referralTitle}>Refer & Earn</Text>
                <Text style={styles.referralSub}>Up to 20% on Level 1 — 5 levels deep</Text>
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('Referrals')} style={styles.referralBtn}>
                <Text style={styles.referralBtnText}>Share</Text>
                <Ionicons name="arrow-forward" size={14} color="#000" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
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

function PoolHoldingRow({ item }: { item: any }) {
  return (
    <View style={styles.actRow}>
      <View style={[styles.actIconBg, { backgroundColor: 'rgba(240,185,11,0.12)' }]}>
        <Ionicons name="pie-chart-outline" size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actType}>{item.symbol ?? 'COIN'}</Text>
        <Text style={styles.actTime}>
          Bought: {(item.amountBought ?? 0).toFixed(6)} {item.symbol ?? ''}
        </Text>
      </View>
      <Text style={[styles.actAmount, { color: Colors.textPrimary }]}>
        ${(item.currentValue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </Text>
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
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  balanceLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  balanceValue: { fontSize: 40, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 },

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
  quickActions: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginHorizontal: Spacing.lg, marginTop: Spacing.md, paddingVertical: Spacing.md,
  },
  qaItem: { alignItems: 'center', gap: 6 },
  qaIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: 'rgba(240,185,11,0.1)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  qaLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  // Section
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
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
  emptyText: { fontSize: 13, color: Colors.textMuted },

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
});
