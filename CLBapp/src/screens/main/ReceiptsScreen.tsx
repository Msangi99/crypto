import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import { userAPI } from '../../services/api';

export default function ReceiptsScreen() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await userAPI.receipts();
      setReceipts(res.data?.receipts ?? res.data ?? []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <LinearGradient colors={['#0D0D0D', '#0D0D0D']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Receipt Tokens</Text>
        <Text style={styles.subtitle}>{receipts.length} soulbound tokens</Text>
      </View>

      <FlatList
        data={receipts}
        keyExtractor={(item) => item.tokenId?.toString() ?? item.id}
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: Spacing.md }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="ribbon-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Receipts Yet</Text>
            <Text style={styles.emptyText}>Receipt tokens are issued when you join a pool</Text>
          </View>
        }
        renderItem={({ item }) => (
          <LinearGradient colors={['#1D1A10', '#1A1A1A']} style={styles.card}>
            <View style={styles.cardTop}>
              <LinearGradient colors={Colors.gradientGold} style={styles.tokenIconBg}>
                <Text style={styles.tokenIconText}>#{item.tokenId ?? '?'}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.tokenTitle}>Receipt Token #{item.tokenId ?? item.id}</Text>
                <Text style={styles.tokenPool}>{item.poolName ?? `Pool ${item.poolId}`}</Text>
              </View>
              <Badge label="Soulbound" variant="gold" />
            </View>

            <View style={styles.cardDetails}>
              {[
                { label: 'Deposited', value: `$${(item.depositAmount ?? 0).toLocaleString()}` },
                { label: 'Asset', value: item.asset ?? 'BNB' },
                { label: 'Minted', value: item.mintedAt ? new Date(item.mintedAt).toLocaleDateString() : '—' },
                { label: 'Contract', value: item.contractAddress ? `${item.contractAddress.slice(0, 8)}...` : '—' },
              ].map((d) => (
                <View key={d.label} style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{d.label}</Text>
                  <Text style={styles.detailValue}>{d.value}</Text>
                </View>
              ))}
            </View>

            <View style={styles.nonTransfer}>
              <Ionicons name="lock-closed-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.nonTransferText}>Non-transferable · BEP-20 on BSC</Text>
            </View>
          </LinearGradient>
        )}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.lg, gap: 4 },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted },
  card: {
    borderRadius: Radius.xl, borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.2)', padding: Spacing.md, gap: Spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  tokenIconBg: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  tokenIconText: { fontSize: FontSize.sm, fontWeight: '900', color: '#fff' },
  tokenTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  tokenPool: { fontSize: FontSize.xs, color: Colors.textSecondary },
  cardDetails: {
    backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: Spacing.sm, gap: 2,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  detailValue: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  nonTransfer: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingTop: Spacing.xs,
  },
  nonTransferText: { fontSize: 10, color: Colors.textMuted },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 80 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
