import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { userAPI } from '../../services/api';

const TYPE_META: Record<string, { icon: string; color: string; label: string }> = {
  deposit: { icon: 'arrow-down-circle-outline', color: Colors.success, label: 'Deposit' },
  withdrawal: { icon: 'arrow-up-circle-outline', color: Colors.error, label: 'Withdrawal' },
  referral_bonus: { icon: 'gift-outline', color: Colors.gold, label: 'Referral Bonus' },
  referral: { icon: 'people-outline', color: Colors.gold, label: 'Referral' },
  reward: { icon: 'star-outline', color: Colors.primary, label: 'Reward' },
};

const FILTERS = ['All', 'Deposits', 'Withdrawals', 'Referrals'];

export default function ActivityScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = 1) => {
    try {
      const res = await userAPI.activity(30, p);
      const newItems = res.data?.activities ?? res.data ?? [];
      setItems(p === 1 ? newItems : (prev) => [...prev, ...newItems]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await load(1);
    setRefreshing(false);
  };

  const filtered = filter === 'All'
    ? items
    : items.filter((i) => i.type?.toLowerCase().includes(filter.toLowerCase().replace('s', '')));

  const renderItem = ({ item }: { item: any }) => {
    const type = item.type?.toLowerCase() ?? 'deposit';
    const meta = TYPE_META[type] ?? { icon: 'swap-horizontal-outline', color: Colors.primary, label: item.type };

    return (
      <View style={styles.row}>
        <View style={[styles.iconBg, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon as any} size={22} color={meta.color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.rowType}>{meta.label}</Text>
          {item.poolId && <Text style={styles.rowSub}>Pool {item.poolId}</Text>}
          {item.txHash && (
            <Text style={styles.rowHash} numberOfLines={1}>
              {item.txHash.slice(0, 12)}...{item.txHash.slice(-6)}
            </Text>
          )}
          <Text style={styles.rowTime}>{formatDate(item.createdAt ?? item.time)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={[styles.rowAmount, { color: meta.color }]}>
            {item.amount > 0 ? '+' : ''}{Number(item.amount ?? 0).toFixed(4)}
          </Text>
          <Text style={styles.rowToken}>{item.token ?? 'BNB'}</Text>
          {item.status && (
            <View style={[styles.statusBadge, {
              backgroundColor: item.status === 'CONFIRMED' || item.status === 'SUCCESS'
                ? Colors.successBg : Colors.warningBg,
            }]}>
              <Text style={[styles.statusText, {
                color: item.status === 'CONFIRMED' || item.status === 'SUCCESS'
                  ? Colors.success : Colors.warning,
              }]}>{item.status}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0D0D0D', '#0D0D0D']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.subtitle}>{items.length} transactions</Text>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterPill, filter === f && styles.filterPillActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, i) => item.id ?? `${i}`}
        renderItem={renderItem}
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: 0 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Ionicons name="time-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Activity</Text>
              <Text style={styles.emptyText}>Your transaction history will appear here</Text>
            </View>
          )
        }
      />
    </LinearGradient>
  );
}

function formatDate(d: string | undefined) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm, gap: 2 },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted },
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radius.full,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted },
  filterTextActive: { color: '#fff' },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  iconBg: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowType: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  rowSub: { fontSize: FontSize.xs, color: Colors.textSecondary },
  rowHash: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: 'monospace' },
  rowTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  rowAmount: { fontSize: FontSize.md, fontWeight: '700' },
  rowToken: { fontSize: FontSize.xs, color: Colors.textMuted },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full },
  statusText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  separator: { height: 1, backgroundColor: Colors.border },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 60 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
