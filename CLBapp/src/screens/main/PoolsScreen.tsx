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
  LTC: ' diamond',
  USDT: 'cash',
  USDC: 'cash',
  DAI: 'cash',
};

function CoinIcon({ symbol }: { symbol: string }) {
  const iconName = (COIN_ICONS[symbol?.toUpperCase()] || 'cube-outline') as any;
  return (
    <View style={styles.coinIconBg}>
      <Ionicons name={iconName} size={22} color={Colors.primary} />
    </View>
  );
}

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
            activeOpacity={0.85}
          >
            <View style={styles.featuredOuter}>
              <LinearGradient colors={Colors.gradientGold} style={styles.featuredCard}>
                <View style={styles.featuredHeader}>
                  <View style={styles.featuredBadge}>
                    <Ionicons name="flame" size={12} color="#000" />
                    <Text style={styles.featuredBadgeText}>Best APY</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.5)" />
                </View>

                <View style={styles.featuredContent}>
                  <CoinIcon symbol={pools[0].tokenSymbol} />
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
            </View>
          </TouchableOpacity>
        )}

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All Pools</Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionCount}>{pools.length}</Text>
          </View>
        </View>

        {pools.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="water-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Pools Available</Text>
            <Text style={styles.emptyText}>Check back later for new liquidity pools</Text>
          </View>
        ) : (
          pools.map((pool: any) => (
            <TouchableOpacity
              key={pool.id}
              onPress={() => navigation.navigate('PoolDetail', { poolId: pool.id })}
              activeOpacity={0.85}
            >
              <View style={styles.poolCard}>
                <View style={styles.poolHeader}>
                  <CoinIcon symbol={pool.tokenSymbol} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <Text style={styles.poolName}>{pool.name}</Text>
                    <View style={styles.poolTokenRow}>
                      <Text style={styles.poolToken}>{pool.tokenSymbol}</Text>
                      <View style={styles.poolDot} />
                      <Badge
                        label={pool.status || 'Active'}
                        variant={pool.status === 'ACTIVE' ? 'success' : 'warning'}
                      />
                    </View>
                  </View>
                  <View style={styles.poolApyBox}>
                    <Text style={styles.poolApyValue}>{pool.apy}%</Text>
                    <Text style={styles.poolApyLabel}>APY</Text>
                  </View>
                </View>

                <View style={styles.poolMetrics}>
                  <Metric label="Min Deposit" value={`$${pool.minDeposit}`} />
                  <Metric label="TVL" value={`$${Number(pool.totalStaked).toLocaleString()}`} />
                  <Metric label="Members" value={`${pool._count?.members || pool.memberCount || 0}`} />
                </View>

                <View style={styles.poolFooter}>
                  <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
                  <Text style={styles.poolMemberText}>{pool._count?.members || pool.memberCount || 0} members</Text>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </View>
              </View>
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

  // Coin Icon
  coinIconBg: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(240,185,11,0.1)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Featured Card
  featuredOuter: {
    borderRadius: Radius.xl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  featuredCard: {
    borderRadius: Radius.xl, padding: Spacing.lg,
    gap: Spacing.md,
  },
  featuredHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  featuredBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.12)', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99,
  },
  featuredBadgeText: { fontSize: 11, fontWeight: '800', color: '#000' },
  featuredContent: {
    flexDirection: 'row', alignItems: 'center',
  },
  featuredTitle: { fontSize: 18, fontWeight: '800', color: '#000' },
  featuredSubtitle: { fontSize: 13, color: 'rgba(0,0,0,0.6)', fontWeight: '600' },
  featuredApy: { alignItems: 'flex-end', gap: 2 },
  featuredApyValue: { fontSize: 26, fontWeight: '900', color: '#000' },
  featuredApyLabel: { fontSize: 11, color: 'rgba(0,0,0,0.5)', fontWeight: '700' },
  featuredStats: {
    flexDirection: 'row', paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)',
  },

  // Section
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

  // Pool Card
  poolCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.md, gap: Spacing.md,
  },
  poolHeader: {
    flexDirection: 'row', alignItems: 'center',
  },
  poolName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  poolTokenRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3,
  },
  poolToken: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  poolDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
  poolApyBox: {
    alignItems: 'flex-end', gap: 2,
  },
  poolApyValue: {
    fontSize: 22, fontWeight: '900',
    color: Colors.primary,
  },
  poolApyLabel: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  poolMetrics: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg,
  },
  poolFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  poolMemberText: { fontSize: 12, color: Colors.textSecondary, flex: 1 },

  // Empty
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 80 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
