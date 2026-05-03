import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import { userAPI } from '../../services/api';

const COIN_ICONS: Record<string, string> = {
  BTC: 'logo-bitcoin',
  ETH: 'logo-ethereum',
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
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await userAPI.portfolio();
      setData(res.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const positions = data?.positions ?? [];
  const summary = data?.summary ?? {};
  const totalInvestedUsd = summary.totalInvestedUsd ?? 0;
  const totalCurrentValueUsd = summary.totalCurrentValueUsd ?? 0;
  const totalUnrealizedPnlUsd = summary.totalUnrealizedPnlUsd ?? 0;
  const totalProjectedProfitUsd = summary.totalProjectedProfitUsd ?? 0;

  const pnlPercent = totalInvestedUsd > 0
    ? ((totalUnrealizedPnlUsd / totalInvestedUsd) * 100).toFixed(2)
    : '0.00';
  const isProfit = totalUnrealizedPnlUsd >= 0;

  return (
    <View style={styles.container}>
      {/* Dark Gradient Header */}
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
        <View style={styles.header}>
          <Text style={styles.title}>Portfolio</Text>
          <TouchableOpacity style={styles.chartBtn}>
            <Ionicons name="stats-chart-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Total Value */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>Total Portfolio Value</Text>
          <Text style={styles.heroValue}>${totalCurrentValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          <View style={styles.pnlRow}>
            <View style={[styles.pnlBadge, isProfit ? styles.pnlBadgeProfit : styles.pnlBadgeLoss]}>
              <Ionicons name={isProfit ? 'trending-up' : 'trending-down'} size={14} color={isProfit ? '#00D6A1' : '#FF4757'} />
              <Text style={[styles.pnlText, isProfit && styles.pnlTextProfit, !isProfit && styles.pnlTextLoss]}>
                {isProfit ? '+' : ''}{pnlPercent}%
              </Text>
            </View>
            <Text style={styles.pnlUsd}>
              {isProfit ? '+' : ''}${totalUnrealizedPnlUsd.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStatsRow}>
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>${totalInvestedUsd.toLocaleString()}</Text>
            <Text style={styles.quickStatLabel}>Invested</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>${totalProjectedProfitUsd.toLocaleString()}</Text>
            <Text style={styles.quickStatLabel}>Projected</Text>
          </View>
          <View style={styles.quickStatDivider} />
          <View style={styles.quickStatItem}>
            <Text style={styles.quickStatValue}>{positions.length}</Text>
            <Text style={styles.quickStatLabel}>Positions</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Pools')}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="add-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Deposit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction} onPress={() => navigation.navigate('Pools')}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="swap-horizontal-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Borrow</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="gift-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>Rewards</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickAction}>
            <View style={styles.quickActionIcon}>
              <Ionicons name="document-text-outline" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>History</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md, paddingBottom: 100 }}
      >
        {/* Positions Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Positions</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionCount}>{positions.length}</Text>
          </View>
        </View>

        {/* Positions list */}
        {positions.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Positions Yet</Text>
            <Text style={styles.emptyText}>Join a pool to start earning leveraged returns</Text>
          </View>
        ) : (
          positions.map((pos: any) => (
            <TouchableOpacity key={pos.poolId} onPress={() => navigation.navigate('PositionDetail', { poolId: pos.poolId })} activeOpacity={0.8}>
              <View style={styles.posCard}>
                <View style={styles.posHeader}>
                  <CoinIcon symbol={pos.asset ?? 'BNB'} />
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={styles.posName}>{pos.poolName ?? `Pool ${pos.poolId}`}</Text>
                    <View style={styles.posSubRow}>
                      <Text style={styles.posTier}>{pos.leverage ?? 1}x Leverage</Text>
                      <View style={styles.posDot} />
                      <Badge
                        label={pos.poolStatus ?? 'Active'}
                        variant={pos.poolStatus === 'ACTIVE' ? 'success' : pos.poolStatus === 'PAUSED' ? 'warning' : 'error'}
                      />
                    </View>
                  </View>
                  <View style={styles.posValueBox}>
                    <Text style={styles.posValueAmount}>${(pos.currentValueUsd ?? 0).toLocaleString()}</Text>
                    <Text style={[styles.posValuePnl, (pos.unrealizedPnlUsd ?? 0) >= 0 ? styles.posValueProfit : styles.posValueLoss]}>
                      {(pos.unrealizedPnlUsd ?? 0) >= 0 ? '+' : ''}${(pos.unrealizedPnlUsd ?? 0).toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.posMetrics}>
                  <View style={styles.posMetric}>
                    <Text style={styles.posMetricLabel}>Deposited</Text>
                    <Text style={styles.posMetricValue}>${(pos.depositUsd ?? 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.posMetric}>
                    <Text style={styles.posMetricLabel}>Loan</Text>
                    <Text style={[styles.posMetricValue, { color: Colors.primary }]}>${(pos.loanUsd ?? 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.posMetric}>
                    <Text style={styles.posMetricLabel}>Liq. Target</Text>
                    <Text style={styles.posMetricValue}>${(pos.liquidationTargets?.phase1 ?? 0).toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
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

  // Empty
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 60 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
