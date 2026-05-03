import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Dimensions, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import GradientCard from '../../components/ui/GradientCard';
import StatCard from '../../components/ui/StatCard';
import Badge from '../../components/ui/Badge';
import { userAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');
const LOGO = require('../../../assets/logo.png');

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<any>(null);
  const [market, setMarket] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);

  const load = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([userAPI.dashboard(), userAPI.market()]);
      setDashboard(d.data);
      setMarket(m.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shortAddress = user?.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : '';

  const stats = dashboard?.dashboard?.stats ?? {};
  const totalValue = stats.portfolioValueUsd ?? 0;
  const totalInvested = stats.totalDepositedUsd ?? 0;
  const pnl = stats.unrealizedPnlUsd ?? 0;
  const pnlPct = totalInvested > 0 ? ((pnl / totalInvested) * 100).toFixed(2) : '0.00';

  return (
    <LinearGradient colors={[Colors.bg, Colors.bg]} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Top Header */}
        <LinearGradient colors={[Colors.bg, 'transparent']} style={styles.header}>
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
          <TouchableOpacity style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} />
            <View style={styles.notifBadge} />
          </TouchableOpacity>
        </LinearGradient>

        {/* Portfolio Balance Card */}
        <View style={styles.balanceSection}>
          <LinearGradient
            colors={Colors.gradientCard}
            style={styles.balanceCard}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          >
            {/* Glow effect */}
            <View style={styles.balanceGlow} />
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
              <Ionicons
                name={pnl >= 0 ? 'trending-up' : 'trending-down'}
                size={16}
                color={pnl >= 0 ? Colors.success : Colors.error}
              />
              <Text style={[styles.pnlText, { color: pnl >= 0 ? Colors.success : Colors.error }]}>
                {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} ({pnlPct}%)
              </Text>
              <Text style={styles.pnlLabel}>All Time P&L</Text>
            </View>

            <View style={styles.balanceGrid}>
              <View style={styles.balanceGridItem}>
                <Text style={styles.bgiLabel}>Invested</Text>
                <Text style={styles.bgiValue}>${totalInvested.toLocaleString()}</Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceGridItem}>
                <Text style={styles.bgiLabel}>Active Pools</Text>
                <Text style={styles.bgiValue}>{stats.activePools ?? 0}</Text>
              </View>
              <View style={styles.balanceDivider} />
              <View style={styles.balanceGridItem}>
                <Text style={styles.bgiLabel}>Referral Earnings</Text>
                <Text style={[styles.bgiValue, { color: Colors.gold }]}>
                  ${(stats.referralEarnings ?? 0).toFixed(2)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <View style={styles.quickActions}>
            {[
              { icon: 'add-circle-outline', label: 'Deposit', screen: 'Portfolio' },
              { icon: 'swap-horizontal-outline', label: 'Portfolio', screen: 'Portfolio' },
              { icon: 'people-outline', label: 'Referrals', screen: 'Referrals' },
              { icon: 'calculator-outline', label: 'Calculator', screen: 'Calculator' },
            ].map((a) => (
              <TouchableOpacity key={a.label} style={styles.qaItem} onPress={() => navigation.navigate(a.screen)}>
                <LinearGradient colors={Colors.gradientCard} style={styles.qaIcon}>
                  <Ionicons name={a.icon as any} size={22} color={Colors.primary} />
                </LinearGradient>
                <Text style={styles.qaLabel}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Live Market */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Market</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Market')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.marketScroll}>
            {market?.market?.coins?.length
              ? market.market.coins.slice(0, 6).map((coin: any) => (
                  <MarketChip key={coin.symbol} coin={coin} />
                ))
              : ['BTC', 'ETH', 'BNB'].map((c) => <MarketChipSkeleton key={c} label={c} />)}
          </ScrollView>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Activity')}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {dashboard?.dashboard?.recentActivity?.slice(0, 4).map((act: any, i: number) => (
            <ActivityRow key={i} item={act} />
          )) ?? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No activity yet</Text>
            </View>
          )}
        </View>

        {/* Referral Promo */}
        <View style={[styles.section, { marginBottom: 100 }]}>
          <LinearGradient colors={Colors.gradientCard} style={styles.referralCard}>
            <LinearGradient colors={Colors.gradientGold} style={styles.referralIconBg}>
              <Ionicons name="gift-outline" size={24} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.referralTitle}>Refer & Earn</Text>
              <Text style={styles.referralSub}>Up to 20% on Level 1 — 5 levels deep</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Referrals')} style={styles.referralBtn}>
              <Text style={styles.referralBtnText}>Share</Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.gold} />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function MarketChip({ coin }: { coin: any }) {
  const change = coin.change24h ?? 0;
  const isUp = change >= 0;
  const changeColor = isUp ? Colors.success : Colors.error;
  return (
    <LinearGradient colors={Colors.gradientCard} style={styles.marketChip}>
      <View style={styles.mcTopRow}>
        <View style={[styles.mcIcon, { backgroundColor: (coin.color || Colors.primary) + '22' }]}>
          <Text style={[styles.mcIconText, { color: coin.color || Colors.primary }]}>
            {coin.icon || coin.symbol?.[0] || '?'}
          </Text>
        </View>
        <Text style={styles.mcCoin}>{coin.symbol}</Text>
      </View>
      <Text style={styles.mcPrice}>
        {coin.price >= 1000
          ? `$${coin.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : coin.price >= 1 ? `$${coin.price.toFixed(2)}` : `$${coin.price.toFixed(4)}`}
      </Text>
      <View style={[styles.mcChangeBadge, { backgroundColor: isUp ? Colors.successBg : Colors.errorBg }]}>
        <Ionicons name={isUp ? 'caret-up' : 'caret-down'} size={10} color={changeColor} />
        <Text style={[styles.mcChange, { color: changeColor }]}>
          {Math.abs(change).toFixed(2)}%
        </Text>
      </View>
    </LinearGradient>
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

function ActivityRow({ item }: { item: any }) {
  const iconMap: Record<string, any> = {
    deposit: 'arrow-down-circle-outline',
    withdrawal: 'arrow-up-circle-outline',
    referral: 'gift-outline',
    reward: 'star-outline',
  };
  const colorMap: Record<string, string> = {
    deposit: Colors.success,
    withdrawal: Colors.error,
    referral: Colors.gold,
    reward: Colors.primary,
  };
  const type = item.type?.toLowerCase() ?? 'deposit';
  return (
    <View style={styles.actRow}>
      <View style={[styles.actIconBg, { backgroundColor: colorMap[type] + '18' }]}>
        <Ionicons name={iconMap[type] ?? 'swap-horizontal-outline'} size={20} color={colorMap[type] ?? Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actType}>{item.type ?? 'Transaction'}</Text>
        <Text style={styles.actTime}>{item.time ?? item.createdAt ?? ''}</Text>
      </View>
      <Text style={[styles.actAmount, { color: colorMap[type] ?? Colors.textPrimary }]}>
        {item.amount > 0 ? '+' : ''}{item.amount?.toFixed(4)} {item.token ?? 'BNB'}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  greeting: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  addressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  address: { fontSize: FontSize.sm, color: Colors.textSecondary },
  notifBtn: { position: 'relative', padding: 8 },
  notifBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error,
  },

  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogo: { width: 36, height: 36, borderRadius: 8 },

  // Balance card
  balanceSection: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  balanceCard: {
    borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  balanceGlow: {
    position: 'absolute', top: -40, right: -40,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: 'rgba(240,185,11,0.08)',
  },
  balanceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  balanceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  balanceValue: { fontSize: 36, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },
  pnlRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: Spacing.lg },
  pnlText: { fontSize: FontSize.sm, fontWeight: '600' },
  pnlLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  balanceGrid: {
    flexDirection: 'row', borderTopWidth: 1, borderTopColor: Colors.border,
    paddingTop: Spacing.md, gap: 0,
  },
  balanceGridItem: { flex: 1, alignItems: 'center', gap: 4 },
  balanceDivider: { width: 1, backgroundColor: Colors.border },
  bgiLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  bgiValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },

  // Quick Actions
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between' },
  qaItem: { alignItems: 'center', gap: 8, flex: 1 },
  qaIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  qaLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500' },

  // Section header
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  seeAll: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },

  // Market chips
  marketScroll: { marginHorizontal: -Spacing.lg, paddingHorizontal: Spacing.lg },
  marketChip: {
    borderRadius: Radius.md, padding: Spacing.md, marginRight: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, minWidth: 130, gap: 6,
  },
  mcTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mcIcon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  mcIconText: { fontSize: 11, fontWeight: '800' },
  mcCoin: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  mcPrice: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  mcChangeBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full, alignSelf: 'flex-start' },
  mcChange: { fontSize: 10, fontWeight: '700' },

  // Activity
  actRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  actIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actType: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, textTransform: 'capitalize' },
  actTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  actAmount: { fontSize: FontSize.sm, fontWeight: '700' },
  emptyState: { alignItems: 'center', gap: 8, padding: Spacing.xl },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted },

  // Referral promo
  referralCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },
  referralIconBg: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  referralTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  referralSub: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  referralBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  referralBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.gold },

  // Skeletons
  skeleton: { height: 14, width: 80, borderRadius: 6, backgroundColor: Colors.bgElevated },
});
