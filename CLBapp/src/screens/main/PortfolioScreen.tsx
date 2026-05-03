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

  return (
    <LinearGradient colors={['#0D0D0D', '#0D0D0D']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Portfolio</Text>
        <Badge label={`${positions.length} Positions`} variant="primary" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0 }}
      >
        {/* Summary */}
        <LinearGradient colors={Colors.gradientCard} style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <SummaryItem label="Total Value" value={`$${totalCurrentValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
            <View style={styles.summaryDivider} />
            <SummaryItem
              label="Unrealized P&L"
              value={`${totalUnrealizedPnlUsd >= 0 ? '+' : ''}$${totalUnrealizedPnlUsd.toFixed(2)}`}
              positive={totalUnrealizedPnlUsd >= 0}
              negative={totalUnrealizedPnlUsd < 0}
            />
            <View style={styles.summaryDivider} />
            <SummaryItem label="Invested" value={`$${totalInvestedUsd.toLocaleString()}`} />
          </View>
        </LinearGradient>

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
              <LinearGradient colors={Colors.gradientCard} style={styles.posCard}>
                <View style={styles.posHeader}>
                  <View style={styles.posCoinBadge}>
                    <Text style={styles.posCoinText}>{pos.asset ?? 'BNB'}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={styles.posName}>{pos.poolName ?? `Pool ${pos.poolId}`}</Text>
                    <Text style={styles.posTier}>Tier ${pos.depositUsd ?? 0} · {pos.leverage ?? 1}x Leverage</Text>
                  </View>
                  <Badge
                    label={pos.poolStatus ?? 'ACTIVE'}
                    variant={pos.poolStatus === 'ACTIVE' ? 'success' : pos.poolStatus === 'PAUSED' ? 'warning' : 'error'}
                  />
                </View>

                <View style={styles.posMetrics}>
                  <Metric label="Deposited" value={`$${(pos.depositUsd ?? 0).toLocaleString()}`} />
                  <Metric label="Loan Value" value={`$${(pos.loanUsd ?? 0).toLocaleString()}`} accent />
                  <Metric label="Current Value" value={`$${(pos.currentValueUsd ?? 0).toLocaleString()}`} />
                  <Metric
                    label="Unrealized P&L"
                    value={`${(pos.unrealizedPnlUsd ?? 0) >= 0 ? '+' : ''}$${(pos.unrealizedPnlUsd ?? 0).toFixed(2)}`}
                    positive={(pos.unrealizedPnlUsd ?? 0) >= 0}
                    negative={(pos.unrealizedPnlUsd ?? 0) < 0}
                  />
                </View>

                <View style={styles.posLiqRow}>
                  <Ionicons name="flag-outline" size={14} color={Colors.gold} />
                  <Text style={styles.posLiqText}>
                    Phase 1 target: ${(pos.liquidationTargets?.phase1 ?? 0).toLocaleString()}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </LinearGradient>
  );
}

function SummaryItem({ label, value, positive, negative }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{label}</Text>
      <Text style={{
        fontSize: FontSize.md, fontWeight: '700',
        color: positive ? Colors.success : negative ? Colors.error : Colors.textPrimary,
      }}>{value}</Text>
    </View>
  );
}

function Metric({ label, value, positive, negative, accent }: any) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{label}</Text>
      <Text style={{
        fontSize: FontSize.sm, fontWeight: '600',
        color: positive ? Colors.success : negative ? Colors.error : accent ? Colors.gold : Colors.textPrimary,
      }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  summaryCard: {
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryDivider: { width: 1, height: 40, backgroundColor: Colors.border },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 60 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  posCard: {
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md, gap: Spacing.md,
  },
  posHeader: { flexDirection: 'row', alignItems: 'center' },
  posCoinBadge: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(240,185,11,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  posCoinText: { fontSize: FontSize.xs, fontWeight: '800', color: Colors.primary },
  posName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  posTier: { fontSize: FontSize.xs, color: Colors.textSecondary },
  posMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  posLiqRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(240,185,11,0.08)', borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
  },
  posLiqText: { flex: 1, fontSize: FontSize.xs, color: Colors.gold },
});
