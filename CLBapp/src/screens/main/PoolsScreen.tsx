import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import { poolsAPI, creditWalletAPI } from '../../services/api';

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

function loanUsd(pool: any): number {
  const v = pool.creditCreditedUsd;
  if (v != null && Number(v) > 0) return Number(v);
  return 0;
}

function claimFeeUsd(pool: any): number {
  return Number(pool.creditMinUsd ?? pool.minDeposit ?? 0);
}

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
  const [eligibility, setEligibility] = useState<
    Record<string, { canClaimWithCredit: boolean; creditMinUsd: number; creditCreditedUsd: number | null }>
  >({});
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPools = useMemo(() => {
    let result = [...pools];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p: any) =>
        p.name?.toLowerCase().includes(q) || p.tokenSymbol?.toLowerCase().includes(q)
      );
    }
    if (activeFilter === 'Popular') {
      result.sort((a: any, b: any) => (b._count?.members || b.memberCount || 0) - (a._count?.members || a.memberCount || 0));
    } else if (activeFilter === 'Loan') {
      result.sort((a: any, b: any) => {
        const la = eligibility[a.id]?.creditCreditedUsd ?? loanUsd(a);
        const lb = eligibility[b.id]?.creditCreditedUsd ?? loanUsd(b);
        return Number(lb) - Number(la);
      });
    }
    return result;
  }, [pools, searchQuery, activeFilter, eligibility]);

  const totalTvl = useMemo(() => pools.reduce((sum: number, p: any) => sum + (Number(p.totalStaked) || 0), 0), [pools]);

  const load = useCallback(async () => {
    try {
      const [res, elRes] = await Promise.all([
        poolsAPI.list(),
        creditWalletAPI.poolEligibility().catch(() => ({ data: { pools: [] as any[] } })),
      ]);
      setPools(res.data?.data ?? []);
      const map: Record<string, { canClaimWithCredit: boolean; creditMinUsd: number; creditCreditedUsd: number | null }> = {};
      for (const row of elRes.data?.pools ?? []) {
        map[row.poolId] = {
          canClaimWithCredit: Boolean(row.canClaimWithCredit),
          creditMinUsd: Number(row.creditMinUsd ?? 0),
          creditCreditedUsd: row.creditCreditedUsd != null ? Number(row.creditCreditedUsd) : null,
        };
      }
      setEligibility(map);
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

  const filters = ['All', 'Popular', 'Loan'];

  return (
    <View style={styles.container}>
      {/* Header with Gradient */}
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Liquidity Pools</Text>
            <Text style={styles.subtitle}>Pay a claim fee from deposit balance · get loan credit · then swap</Text>
          </View>
          <TouchableOpacity style={styles.filterBtn}>
            <Ionicons name="options-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Summary Stats */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{pools.length}</Text>
            <Text style={styles.summaryLabel}>Pools</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>${totalTvl.toLocaleString()}</Text>
            <Text style={styles.summaryLabel}>Total TVL</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{pools.filter((p: any) => p.supportsAppCredit).length}</Text>
            <Text style={styles.summaryLabel}>Claim packs</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search pools..."
            placeholderTextColor={Colors.textMuted}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setActiveFilter(f)}
            style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: Spacing.lg, paddingBottom: 100 }}
      >
        {/* Featured Pool */}
        {pools.length > 0 && !searchQuery && activeFilter === 'All' && (
          <TouchableOpacity
            onPress={() => navigation.navigate('PoolDetail', { poolId: pools[0].id })}
            activeOpacity={0.85}
          >
            <View style={styles.featuredOuter}>
              <LinearGradient colors={Colors.gradientGold} style={styles.featuredCard}>
                <View style={styles.featuredHeader}>
                  <View style={styles.featuredBadge}>
                    <Ionicons name="flash" size={12} color="#000" />
                    <Text style={styles.featuredBadgeText}>Featured</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.5)" />
                </View>

                <View style={styles.featuredContent}>
                  <CoinIcon symbol={pools[0].tokenSymbol} />
                  <View style={{ flex: 1, marginLeft: Spacing.md }}>
                    <Text style={styles.featuredTitle}>{pools[0].name}</Text>
                    <Text style={styles.featuredSubtitle}>{pools[0].tokenSymbol} Pool</Text>
                  </View>
                  <View style={styles.featuredLoanBox}>
                    <Text style={styles.featuredFeeLab}>Fee</Text>
                    <Text style={styles.featuredFeeVal}>${claimFeeUsd(pools[0])}</Text>
                  </View>
                </View>

                <View style={styles.featuredStats}>
                  <Stat label="Loan" value={loanUsd(pools[0]) > 0 ? `$${loanUsd(pools[0]).toLocaleString()}` : '—'} />
                  <Stat label="TVL" value={`$${Number(pools[0].totalStaked).toLocaleString()}`} />
                  <Stat label="Members" value={`${pools[0]._count?.members || pools[0].memberCount || 0}`} />
                </View>
              </LinearGradient>
            </View>
          </TouchableOpacity>
        )}

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {activeFilter === 'All' ? 'All pools' : activeFilter === 'Popular' ? 'Most popular' : 'Highest loan'}
          </Text>
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionCount}>{filteredPools.length}</Text>
          </View>
        </View>

        {filteredPools.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="water-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Pools Available</Text>
            <Text style={styles.emptyText}>Check back later for new liquidity pools</Text>
          </View>
        ) : (
          filteredPools.map((pool: any) => {
            const el = eligibility[pool.id];
            const fee = el?.creditMinUsd ?? claimFeeUsd(pool);
            const loan = el?.creditCreditedUsd ?? (pool.creditCreditedUsd != null ? Number(pool.creditCreditedUsd) : null);
            const loanStr = loan != null && loan > 0 ? `$${loan.toLocaleString()}` : '—';
            return (
              <TouchableOpacity
                key={pool.id}
                style={styles.poolCard}
                onPress={() => navigation.navigate('PoolDetail', { poolId: pool.id })}
                activeOpacity={0.85}
              >
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
                </View>

                <View style={styles.poolFeeLoanRow}>
                  <View style={styles.poolFeeLoanCell}>
                    <Text style={styles.poolFeeLoanLabel}>Claim fee</Text>
                    <Text style={styles.poolFeeLoanValue}>${fee}</Text>
                  </View>
                  <View style={styles.poolFeeLoanMid} />
                  <View style={styles.poolFeeLoanCell}>
                    <Text style={styles.poolFeeLoanLabel}>Loan</Text>
                    <Text style={[styles.poolFeeLoanValue, styles.poolLoanAccent]}>{loanStr}</Text>
                  </View>
                </View>

                <View style={styles.poolFooter}>
                  <View style={styles.poolFooterLeft}>
                    <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.poolMemberText}>{pool._count?.members || pool.memberCount || 0} members</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header Gradient
  headerGradient: {
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  filterBtn: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Summary Stats
  summaryRow: {
    flexDirection: 'row', marginHorizontal: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: {
    flex: 1, fontSize: 14, color: Colors.textPrimary,
  },

  // Filter Tabs
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  filterTabActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#000',
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
  featuredLoanBox: { alignItems: 'flex-end' },
  featuredFeeLab: { fontSize: 10, fontWeight: '800', color: 'rgba(0,0,0,0.5)', textTransform: 'uppercase' },
  featuredFeeVal: { fontSize: 22, fontWeight: '900', color: '#000' },
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
  poolFeeLoanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  poolFeeLoanCell: { flex: 1, alignItems: 'center' },
  poolFeeLoanMid: { width: 1, height: 36, backgroundColor: Colors.border },
  poolFeeLoanLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginBottom: 4 },
  poolFeeLoanValue: { fontSize: 17, fontWeight: '900', color: Colors.textPrimary },
  poolLoanAccent: { color: Colors.primary },
  poolFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  poolFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  poolMemberText: { fontSize: 12, color: Colors.textSecondary, flexShrink: 1 },

  // Empty
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 80 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
