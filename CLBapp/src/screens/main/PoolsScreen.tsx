import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import { poolsAPI } from '../../services/api';

export default function PoolsScreen({ navigation }: any) {
  const [pools, setPools] = useState<any>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await poolsAPI.list();
      setPools(res.data?.data ?? []);
    } catch (e) {
      console.error('Failed to load pools:', e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Liquidity Pools</Text>
          <Text style={styles.subtitle}>Earn up to 60x leverage on your deposits</Text>
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Ionicons name="options-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: Spacing.lg, paddingBottom: 100 }}
      >
        {/* Featured Pool */}
        {pools.length > 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('PoolDetail', { poolId: pools[0].id })}
            activeOpacity={0.8}
          >
            <LinearGradient colors={Colors.gradientGold} style={styles.featuredCard}>
              <View style={styles.featuredBadge}>
                <Ionicons name="flame" size={14} color="#000" />
                <Text style={styles.featuredBadgeText}>Featured</Text>
              </View>
              <View style={styles.featuredContent}>
                <View style={styles.featuredIcon}>
                  <Ionicons name="wallet-outline" size={28} color="#000" />
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.md }}>
                  <Text style={styles.featuredTitle}>{pools[0].name}</Text>
                  <Text style={styles.featuredSubtitle}>{pools[0].tokenSymbol} Pool</Text>
                </View>
                <View style={styles.featuredApy}>
                  <Text style={styles.featuredApyValue}>{pools[0].apy}%</Text>
                  <Text style={styles.featuredApyLabel}>APY</Text>
                </View>
              </View>
              <View style={styles.featuredStats}>
                <Stat label="Min Deposit" value={`$${pools[0].minDeposit}`} />
                <Stat label="Total Staked" value={`$${Number(pools[0].totalStaked).toLocaleString()}`} />
                <Stat label="Members" value={`${pools[0]._count?.members || pools[0].memberCount || 0}`} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* All Pools */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Pools</Text>
          <Text style={styles.sectionCount}>{pools.length} Available</Text>
        </View>

        {pools.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="water-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Pools Available</Text>
            <Text style={styles.emptyText}>Check back later for new liquidity pools</Text>
          </View>
        ) : (
          pools.map((pool: any, index: number) => (
            <TouchableOpacity
              key={pool.id}
              onPress={() => navigation.navigate('PoolDetail', { poolId: pool.id })}
              activeOpacity={0.8}
            >
              <LinearGradient colors={Colors.gradientCard} style={styles.poolCard}>
                <View style={styles.poolHeader}>
                  <View style={styles.poolIcon}>
                    <Ionicons name="wallet-outline" size={24} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                    <Text style={styles.poolName}>{pool.name}</Text>
                    <Text style={styles.poolToken}>{pool.tokenSymbol}</Text>
                  </View>
                  <Badge
                    label={pool.status || 'ACTIVE'}
                    variant={pool.status === 'ACTIVE' ? 'success' : 'warning'}
                  />
                </View>

                <View style={styles.poolMetrics}>
                  <Metric label="APY" value={`${pool.apy}%`} accent />
                  <Metric label="Min Deposit" value={`$${pool.minDeposit}`} />
                  <Metric label="TVL" value={`$${Number(pool.totalStaked).toLocaleString()}`} />
                </View>

                <View style={styles.poolFooter}>
                  <View style={styles.poolMember}>
                    <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.poolMemberText}>{pool._count?.members || pool.memberCount || 0} members</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: FontSize.xs, color: 'rgba(0,0,0,0.6)' }}>{label}</Text>
      <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: '#000' }}>{value}</Text>
    </View>
  );
}

function Metric({ label, value, accent }: any) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{label}</Text>
      <Text style={{
        fontSize: FontSize.sm, fontWeight: '700',
        color: accent ? Colors.primary : Colors.textPrimary,
      }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  filterBtn: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Featured Card
  featuredCard: {
    borderRadius: Radius.xl, padding: Spacing.lg,
    marginBottom: Spacing.lg, gap: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  featuredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.15)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99, alignSelf: 'flex-start',
  },
  featuredBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: '#000' },
  featuredContent: {
    flexDirection: 'row', alignItems: 'center',
  },
  featuredIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  coinIcon: { width: 36, height: 36 },
  featuredTitle: { fontSize: FontSize.lg, fontWeight: '800', color: '#000' },
  featuredSubtitle: { fontSize: FontSize.sm, color: 'rgba(0,0,0,0.6)', fontWeight: '500' },
  featuredApy: {
    alignItems: 'flex-end', gap: 2,
  },
  featuredApyValue: { fontSize: FontSize.xl, fontWeight: '900', color: '#000' },
  featuredApyLabel: { fontSize: FontSize.xs, color: 'rgba(0,0,0,0.6)', fontWeight: '600' },
  featuredStats: {
    flexDirection: 'row', paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)',
  },

  // Section
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  sectionCount: { fontSize: FontSize.sm, color: Colors.textSecondary },

  // Pool Card
  poolCard: {
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md, gap: Spacing.md,
  },
  poolHeader: {
    flexDirection: 'row', alignItems: 'center',
  },
  poolIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
  poolName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  poolToken: { fontSize: FontSize.xs, color: Colors.textSecondary },
  poolMetrics: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md,
  },
  poolFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  poolMember: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  poolMemberText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Empty
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 80 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
