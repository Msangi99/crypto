import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import { userAPI } from '../../services/api';

export default function PositionDetailScreen({ route, navigation }: any) {
  const { poolId } = route.params;
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    userAPI.position(poolId).then((r) => setData(r.data)).catch(console.error);
  }, [poolId]);

  if (!data) {
    return (
      <LinearGradient colors={['#0D0D0D', '#0D0D0D']} style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </LinearGradient>
    );
  }

  const pnl = data.unrealizedPnl ?? 0;
  const isUp = pnl >= 0;

  return (
    <LinearGradient colors={['#0D0D0D', '#0D0D0D']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{data.poolName ?? `Pool ${poolId}`}</Text>
        <Badge label={data.status ?? 'ACTIVE'} variant={data.status === 'ACTIVE' ? 'success' : 'warning'} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, gap: Spacing.lg }}>
        {/* Main P&L */}
        <LinearGradient colors={['#222222', '#1A1A1A']} style={styles.pnlCard}>
          <View style={styles.pnlGlow} />
          <Text style={styles.pnlLabel}>Unrealized P&L</Text>
          <Text style={[styles.pnlValue, { color: isUp ? Colors.success : Colors.error }]}>
            {isUp ? '+' : ''}${pnl.toFixed(4)}
          </Text>
          <View style={styles.pnlRow}>
            <Ionicons name={isUp ? 'trending-up' : 'trending-down'} size={16} color={isUp ? Colors.success : Colors.error} />
            <Text style={[styles.pnlPct, { color: isUp ? Colors.success : Colors.error }]}>
              {data.pnlPercent ?? '0.00'}%
            </Text>
            <Text style={styles.pnlSub}>vs. entry price</Text>
          </View>
        </LinearGradient>

        {/* Position Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Position Details</Text>
          <LinearGradient colors={Colors.gradientCard} style={styles.detailsGrid}>
            {[
              { label: 'Asset', value: data.asset ?? 'BNB' },
              { label: 'Deposit (USD)', value: `$${(data.depositUsd ?? 0).toLocaleString()}` },
              { label: 'Leverage', value: `${data.leverage ?? 1}x` },
              { label: 'Loan Value', value: `$${(data.loanUsd ?? 0).toLocaleString()}`, accent: true },
              { label: 'Crypto Amount', value: `${(data.cryptoAmount ?? 0).toFixed(6)} ${data.asset ?? ''}` },
              { label: 'Entry Price', value: `$${(data.entryPrice ?? 0).toLocaleString()}` },
              { label: 'Current Price', value: `$${(data.currentPrice ?? 0).toLocaleString()}` },
              { label: 'Current Value', value: `$${(data.currentValue ?? 0).toLocaleString()}` },
            ].map((item, i) => (
              <View key={i} style={[styles.detailItem, i % 2 === 0 && styles.detailItemLeft]}>
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={[styles.detailValue, item.accent && { color: Colors.gold }]}>{item.value}</Text>
              </View>
            ))}
          </LinearGradient>
        </View>

        {/* Liquidation Targets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profit Targets</Text>
          {[
            { phase: 'Phase 1', data: data.liquidationTargets?.phase1, color: Colors.success },
            { phase: 'Phase 2', data: data.liquidationTargets?.phase2, color: Colors.gold },
          ].map((p) => (
            <LinearGradient key={p.phase} colors={Colors.gradientCard} style={styles.phaseCard}>
              <View style={[styles.phaseIndicator, { backgroundColor: p.color }]} />
              <View style={{ flex: 1, gap: 10 }}>
                <View style={styles.phaseHeader}>
                  <Text style={[styles.phaseName, { color: p.color }]}>{p.phase}</Text>
                  <Text style={styles.phaseTarget}>Target: ${(p.data?.price ?? 0).toLocaleString()}</Text>
                </View>
                <View style={styles.phaseMetrics}>
                  <PhaseMetric label="Gross Profit" value={`$${(p.data?.grossProfit ?? 0).toFixed(2)}`} color={p.color} />
                  <PhaseMetric label="Platform Fee (15%)" value={`-$${(p.data?.platformFee ?? 0).toFixed(2)}`} color={Colors.error} />
                  <PhaseMetric label="Your Profit (85%)" value={`$${(p.data?.userProfit ?? 0).toFixed(2)}`} color={Colors.success} />
                </View>
              </View>
            </LinearGradient>
          ))}
        </View>

        {/* Receipt Token */}
        {data.receiptToken && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Receipt Token</Text>
            <LinearGradient colors={Colors.gradientCard} style={styles.receiptCard}>
              <Ionicons name="ribbon-outline" size={28} color={Colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.receiptTokenId}>#{data.receiptToken.tokenId}</Text>
                <Text style={styles.receiptMinted}>
                  Minted {data.receiptToken.mintedAt ? new Date(data.receiptToken.mintedAt).toLocaleDateString() : ''}
                </Text>
              </View>
              <Badge label="Soulbound" variant="gold" />
            </LinearGradient>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </LinearGradient>
  );
}

function PhaseMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ fontSize: FontSize.xs, color: Colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textSecondary, fontSize: FontSize.md },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.lg,
  },
  backBtn: { marginRight: Spacing.sm },
  title: { flex: 1, fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  pnlCard: {
    borderRadius: Radius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', gap: Spacing.sm, overflow: 'hidden',
  },
  pnlGlow: {
    position: 'absolute', top: -20, width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(240,185,11,0.07)',
  },
  pnlLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  pnlValue: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
  pnlRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pnlPct: { fontSize: FontSize.md, fontWeight: '700' },
  pnlSub: { fontSize: FontSize.xs, color: Colors.textMuted },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary },
  detailsGrid: {
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
    flexDirection: 'row', flexWrap: 'wrap',
  },
  detailItem: {
    width: '50%', padding: Spacing.md,
    borderRightWidth: 1, borderRightColor: Colors.border,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 4,
  },
  detailItemLeft: { borderRightWidth: 0 },
  detailLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  detailValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  phaseCard: {
    flexDirection: 'row', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.md, overflow: 'hidden',
  },
  phaseIndicator: { width: 4, borderRadius: 2, minHeight: 80 },
  phaseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  phaseName: { fontSize: FontSize.md, fontWeight: '800' },
  phaseTarget: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  phaseMetrics: { gap: 8 },
  receiptCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)', padding: Spacing.md,
  },
  receiptTokenId: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  receiptMinted: { fontSize: FontSize.xs, color: Colors.textMuted },
});
