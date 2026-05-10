import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import { loansAPI, creditWalletAPI } from '../../services/api';
import { useLivePrices } from '../../hooks/useLivePrices';

const COIN_ICONS: Record<string, string> = {
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
  DAI: 'cash',
};

function CoinIcon({ symbol }: { symbol: string }) {
  const iconName = (COIN_ICONS[symbol?.toUpperCase()] || 'cube-outline') as any;
  return (
    <View style={styles.coinIconBg}>
      <Ionicons name={iconName} size={20} color={Colors.primary} />
    </View>
  );
}

export default function PortfolioScreen({ navigation }: any) {
  const [loans, setLoans] = useState<any[]>([]);
  const [creditBalances, setCreditBalances] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const load = useCallback(async () => {
    try {
      const [ln, cr] = await Promise.all([
        loansAPI.list().catch(() => ({ data: { loans: [] } })),
        creditWalletAPI.balances().catch(() => null),
      ]);
      setLoans(ln.data?.loans || []);
      if (cr?.data?.balances) setCreditBalances(cr.data.balances);
    } catch (e) { console.error(e); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Split active vs history
  const activeLoans = loans.filter((l: any) => ['ACTIVE', 'PENDING'].includes((l.status || '').toUpperCase()));
  const historyLoans = loans.filter((l: any) => ['LIQUIDATED', 'SETTLED'].includes((l.status || '').toUpperCase()));

  // Live prices for all assets
  const livePrices = useLivePrices(['BTC', 'ETH', 'BNB']);

  // Enrich active loans with live values
  const liveActiveLoans = activeLoans.map((l: any) => {
    const symbol = (l.collateralChain || 'BNB').toUpperCase();
    const amount = Number(l.collateralAmount || 0);
    const entryPrice = Number(l.collateralPriceUsd || 0);
    const originalValueUsd = Number(l.collateralValueUsd || 0);
    const entryFeeUsd = Number(l.entryFeeUsd || 0);
    const livePrice = livePrices[symbol]?.price;
    const liveValueUsd = livePrice && amount > 0 ? amount * livePrice : originalValueUsd;
    const pnlUsd = liveValueUsd - originalValueUsd;
    const pnlPct = originalValueUsd > 0 ? (pnlUsd / originalValueUsd) * 100 : 0;
    const liquidationPrice = Number(l.liquidationPriceUsd || 0);
    const targetPrice = Number(l.targetPriceUsd || 0);
    return { ...l, symbol, amount, entryPrice, originalValueUsd, entryFeeUsd, liveValueUsd, pnlUsd, pnlPct, livePrice, liquidationPrice, targetPrice };
  });

  // Totals
  const totalEntryFees = liveActiveLoans.reduce((s: number, l: any) => s + l.entryFeeUsd, 0);
  const totalLiveValue = liveActiveLoans.reduce((s: number, l: any) => s + l.liveValueUsd, 0);
  const totalOriginalValue = liveActiveLoans.reduce((s: number, l: any) => s + l.originalValueUsd, 0);
  const totalPnlUsd = totalLiveValue - totalOriginalValue;
  const totalPnlPct = totalOriginalValue > 0 ? (totalPnlUsd / totalOriginalValue) * 100 : 0;
  const isProfit = totalPnlUsd >= 0;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
          <TouchableOpacity style={styles.chartBtn} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Total Live Value */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>Total Position Value (Live)</Text>
          <Text style={styles.heroValue}>
            ${totalLiveValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={styles.pnlRow}>
            <View style={[styles.pnlBadge, isProfit ? styles.pnlBadgeProfit : styles.pnlBadgeLoss]}>
              <Ionicons name={isProfit ? 'trending-up' : 'trending-down'} size={14} color={isProfit ? '#00D6A1' : '#FF4757'} />
              <Text style={[styles.pnlText, isProfit ? styles.pnlTextProfit : styles.pnlTextLoss]}>
                {isProfit ? '+' : ''}{totalPnlPct.toFixed(2)}%
              </Text>
            </View>
            <Text style={styles.pnlUsd}>
              {isProfit ? '+' : ''}${totalPnlUsd.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>${totalEntryFees.toLocaleString()}</Text>
            <Text style={styles.quickStatLabel}>Entry Fees</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>${totalOriginalValue.toLocaleString()}</Text>
            <Text style={styles.quickStatLabel}>Position Value</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{liveActiveLoans.length}</Text>
            <Text style={styles.quickStatLabel}>Active</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('LoanHub')}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Open Position</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('DepositReceive')}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Referrals')}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="people-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Referrals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('MiningClb')}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="hardware-chip-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Mine CLB</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'active' && styles.tabBtnActive]}
            onPress={() => setTab('active')}
          >
            <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
              Active ({liveActiveLoans.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
            onPress={() => setTab('history')}
          >
            <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
              History ({historyLoans.length})
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md, paddingBottom: 100 }}
      >
        {tab === 'active' ? (
          liveActiveLoans.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Active Positions</Text>
              <Text style={styles.emptyText}>Go to "Use Your Loan" → "Enter Leveraged Pool" to open a BTC/ETH/BNB position</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('LoanHub')}>
                <Text style={styles.emptyBtnText}>Open Position</Text>
              </TouchableOpacity>
            </View>
          ) : (
            liveActiveLoans.map((l: any) => (
              <View key={l.id} style={styles.posCard}>
                <View style={styles.posHeader}>
                  <CoinIcon symbol={l.symbol} />
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.posName}>{l.symbol} Position</Text>
                      <View style={styles.leverageBadge}>
                        <Text style={styles.leverageBadgeText}>{l.leverage ?? 10}x</Text>
                      </View>
                    </View>
                    <View style={styles.posSubRow}>
                      <Text style={styles.posTier}>{l.amount.toFixed(6)} {l.symbol}</Text>
                      <View style={styles.posDot} />
                      <Badge label={l.status} variant={l.status === 'ACTIVE' ? 'success' : 'warning'} />
                    </View>
                  </View>
                  <View style={styles.posValueBox}>
                    <Text style={styles.posValueAmount}>
                      ${l.liveValueUsd.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                    </Text>
                    <Text style={[styles.posValuePnl, l.pnlUsd >= 0 ? styles.posValueProfit : styles.posValueLoss]}>
                      {l.pnlUsd >= 0 ? '+' : ''}${l.pnlUsd.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.posMetrics}>
                  <View style={styles.posMetric}>
                    <Text style={styles.posMetricLabel}>Entry Fee</Text>
                    <Text style={styles.posMetricValue}>${l.entryFeeUsd.toLocaleString()}</Text>
                  </View>
                  <View style={styles.posMetric}>
                    <Text style={styles.posMetricLabel}>Entry Price</Text>
                    <Text style={[styles.posMetricValue, { color: Colors.primary }]}>
                      ${l.entryPrice.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.posMetric}>
                    <Text style={styles.posMetricLabel}>Liq. Price</Text>
                    <Text style={[styles.posMetricValue, { color: '#FF4757' }]}>
                      ${l.liquidationPrice.toLocaleString()}
                    </Text>
                  </View>
                </View>

                {/* Price progress bar toward target */}
                {l.targetPrice > 0 && l.livePrice > 0 && (
                  <View style={styles.progressSection}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={styles.posMetricLabel}>Progress to Phase 1 Target</Text>
                      <Text style={[styles.posMetricLabel, { color: Colors.primary }]}>
                        ${l.targetPrice.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.progressBar}>
                      <View style={[
                        styles.progressFill,
                        { width: `${Math.min((l.livePrice / l.targetPrice) * 100, 100)}%` as any }
                      ]} />
                    </View>
                    <Text style={[styles.posMetricLabel, { textAlign: 'right', marginTop: 2 }]}>
                      {((l.livePrice / l.targetPrice) * 100).toFixed(1)}%
                    </Text>
                  </View>
                )}
              </View>
            ))
          )
        ) : (
          historyLoans.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No History Yet</Text>
              <Text style={styles.emptyText}>Settled and liquidated positions will appear here</Text>
            </View>
          ) : (
            historyLoans.map((l: any) => {
              const sym = (l.collateralChain || 'BNB').toUpperCase();
              const isSettled = (l.status || '').toUpperCase() === 'SETTLED';
              return (
                <View key={l.id} style={[styles.posCard, { opacity: 0.75 }]}>
                  <View style={styles.posHeader}>
                    <CoinIcon symbol={sym} />
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={styles.posName}>{sym} Position</Text>
                      <View style={styles.posSubRow}>
                        <Text style={styles.posTier}>{Number(l.collateralAmount || 0).toFixed(6)} {sym}</Text>
                        <View style={styles.posDot} />
                        <Badge label={l.status} variant={isSettled ? 'success' : 'error'} />
                      </View>
                    </View>
                    <View style={styles.posValueBox}>
                      <Text style={styles.posValueAmount}>
                        ${Number(l.collateralValueUsd || 0).toLocaleString()}
                      </Text>
                      <Text style={[styles.posValuePnl, isSettled ? styles.posValueProfit : styles.posValueLoss]}>
                        {isSettled ? 'Settled' : 'Liquidated'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.posMetrics}>
                    <View style={styles.posMetric}>
                      <Text style={styles.posMetricLabel}>Entry Fee</Text>
                      <Text style={styles.posMetricValue}>${Number(l.entryFeeUsd || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.posMetric}>
                      <Text style={styles.posMetricLabel}>Entry Price</Text>
                      <Text style={styles.posMetricValue}>${Number(l.collateralPriceUsd || 0).toLocaleString()}</Text>
                    </View>
                    <View style={styles.posMetric}>
                      <Text style={styles.posMetricLabel}>Profit/Loss</Text>
                      <Text style={[styles.posMetricValue, isSettled ? { color: '#00D6A1' } : { color: '#FF4757' }]}>
                        {isSettled ? `+$${Number(l.profitUsd || 0).toFixed(2)}` : `-$${Math.abs(Number(l.profitUsd || 0)).toFixed(2)}`}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header Gradient
  headerGradient: {
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  chartBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },

  // Hero Section
  heroSection: {
    marginHorizontal: Spacing.lg, alignItems: 'center', gap: 8, paddingVertical: Spacing.lg,
  },
  heroLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  heroValue: { fontSize: 40, fontWeight: '900', color: Colors.textPrimary, letterSpacing: -1 },

  // P&L Row
  pnlRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  pnlBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
  },
  pnlBadgeProfit: { backgroundColor: 'rgba(0,214,161,0.12)' },
  pnlBadgeLoss: { backgroundColor: 'rgba(255,71,87,0.12)' },
  pnlText: { fontSize: 13, fontWeight: '800' },
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
  quickAction: { alignItems: 'center', gap: 6 },
  quickActionIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(240,185,11,0.1)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  quickActionText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },

  // Coin Icon
  coinIconBg: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(240,185,11,0.1)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sectionBadge: {
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3,
  },
  sectionCount: { fontSize: 12, fontWeight: '800', color: Colors.primary },

  // Position Card
  posCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  posHeader: { flexDirection: 'row', alignItems: 'center' },
  posName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  posSubRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3,
  },
  posTier: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  posDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
  posValueBox: { alignItems: 'flex-end', gap: 2 },
  posValueAmount: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  posValuePnl: { fontSize: 12, fontWeight: '700' },
  posValueProfit: { color: '#00D6A1' },
  posValueLoss: { color: '#FF4757' },
  posMetrics: {
    flexDirection: 'row', paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.lg,
  },
  posMetric: { flex: 1, gap: 2 },
  posMetricLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  posMetricValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },

  // Tabs
  tabs: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', padding: 4,
  },
  tabBtn: {
    flex: 1, paddingVertical: 8, borderRadius: Radius.md, alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  tabTextActive: { color: '#000' },

  // Leverage Badge
  leverageBadge: {
    backgroundColor: 'rgba(0,214,161,0.15)', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: 'rgba(0,214,161,0.3)',
  },
  leverageBadgeText: { fontSize: 11, fontWeight: '800', color: '#00D6A1' },

  // Progress Bar
  progressSection: {
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  progressBar: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 99, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: Colors.primary, borderRadius: 99,
  },

  // Empty
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 60 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  emptyBtn: {
    marginTop: Spacing.sm, backgroundColor: Colors.primary,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.xl, paddingVertical: 12,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
});
