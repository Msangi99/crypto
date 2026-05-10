import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { CreditWalletCopy } from '../../constants/creditWalletCopy';
import Badge from '../../components/ui/Badge';
import { poolsAPI, creditWalletAPI } from '../../services/api';
import {
  claimFeeFromPool,
  loanCreditFromPool,
  supportsAppCreditPool,
} from '../../utils/poolPackageDisplay';

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
  LTC: 'disc-outline',
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
  const insets = useSafeAreaInsets();
  const [pools, setPools] = useState<any>([]);
  const [depositBalance, setDepositBalance] = useState(0);
  const [loanCreditBalance, setLoanCreditBalance] = useState(0);
  const [eligibility, setEligibility] = useState<
    Record<
      string,
      {
        canClaimWithCredit: boolean;
        creditMinUsd: number;
        creditCreditedUsd: number | null;
        packageMisconfigured?: boolean;
        poolStatus?: string;
      }
    >
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
        const la = eligibility[a.id]?.creditCreditedUsd ?? loanCreditFromPool(a) ?? 0;
        const lb = eligibility[b.id]?.creditCreditedUsd ?? loanCreditFromPool(b) ?? 0;
        return Number(lb) - Number(la);
      });
    }
    return result;
  }, [pools, searchQuery, activeFilter, eligibility]);

  const totalTvl = useMemo(() => pools.reduce((sum: number, p: any) => sum + (Number(p.totalStaked) || 0), 0), [pools]);

  const spendableForClaimFee = depositBalance + loanCreditBalance;

  const load = useCallback(async () => {
    try {
      const [res, elRes, balRes] = await Promise.all([
        poolsAPI.list(),
        creditWalletAPI.poolEligibility().catch(() => ({ data: { pools: [] as any[] } })),
        creditWalletAPI.balances().catch(() => ({
          data: { balances: { depositCreditUsd: 0, claimedPoolCreditUsd: 0 } },
        })),
      ]);
      setPools(res.data?.data ?? []);
      setDepositBalance(Number(balRes.data?.balances?.depositCreditUsd ?? 0));
      setLoanCreditBalance(Number(balRes.data?.balances?.claimedPoolCreditUsd ?? 0));
      const map: Record<
        string,
        {
          canClaimWithCredit: boolean;
          creditMinUsd: number;
          creditCreditedUsd: number | null;
          packageMisconfigured?: boolean;
          poolStatus?: string;
        }
      > = {};
      for (const row of elRes.data?.pools ?? []) {
        map[String(row.poolId)] = {
          canClaimWithCredit: Boolean(row.canClaimWithCredit),
          creditMinUsd: Number(row.creditMinUsd ?? 0),
          creditCreditedUsd: row.creditCreditedUsd != null ? Number(row.creditCreditedUsd) : null,
          packageMisconfigured: Boolean(row.packageMisconfigured),
          poolStatus: row.poolStatus != null ? String(row.poolStatus) : undefined,
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
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={{ flex: 1, marginRight: Spacing.sm }}>
            <Text style={styles.title}>Liquidity Pools</Text>
            <Text style={styles.subtitle}>{CreditWalletCopy.poolsSubtitle}</Text>
            <Text style={styles.depositBanner}>
              {CreditWalletCopy.poolsDepositLine}:{' '}
              <Text style={styles.depositBannerStrong}>${depositBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
              <Text style={styles.depositBannerNote}> · si Loan credit</Text>
            </Text>
            <Text style={styles.loanBannerLine}>
              Loan credit:{' '}
              <Text style={styles.depositBannerStrong}>${loanCreditBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
              <Text style={styles.depositBannerNote}>
                {' '}
                · Jumla kwa ada ya Claim: ${spendableForClaimFee.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
            </Text>
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
            <Text style={styles.summaryValue}>{pools.filter((p: any) => supportsAppCreditPool(p)).length}</Text>
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
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: 100 + insets.bottom,
          gap: Spacing.md,
        }}
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
                    <Text style={styles.featuredFeeVal}>${claimFeeFromPool(pools[0])}</Text>
                  </View>
                </View>

                <View style={styles.featuredStats}>
                  <Stat
                    label="Loan"
                    value={
                      loanCreditFromPool(pools[0]) != null
                        ? `$${loanCreditFromPool(pools[0])!.toLocaleString()}`
                        : '—'
                    }
                  />
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
            const el = eligibility[String(pool.id)];
            const fee = claimFeeFromPool(pool);
            const loan = loanCreditFromPool(pool);
            const loanStr = loan != null ? `$${loan.toLocaleString()}` : '—';
            const supportsCredit = supportsAppCreditPool(pool);
            const poolActive = (pool.status || 'ACTIVE') === 'ACTIVE';
            const pkgOkFromPool = loan != null;
            const misconfigured = el ? Boolean(el.packageMisconfigured) : supportsCredit && !pkgOkFromPool;
            const canClaimNow =
              supportsCredit &&
              !misconfigured &&
              poolActive &&
              (el != null ? Boolean(el.canClaimWithCredit) : spendableForClaimFee + 1e-9 >= fee && pkgOkFromPool);

            const showClaimTrail = supportsCredit && !misconfigured && poolActive;
            const needMore = showClaimTrail && spendableForClaimFee + 1e-9 < fee;

            return (
              <TouchableOpacity
                key={pool.id}
                style={styles.poolCard}
                onPress={() => navigation.navigate('PoolDetail', { poolId: pool.id })}
                activeOpacity={0.85}
              >
                <View style={styles.poolHeader}>
                  <CoinIcon symbol={pool.tokenSymbol} />
                  <View style={styles.poolTitleBlock}>
                    <Text style={styles.poolName} numberOfLines={2}>
                      {pool.name}
                    </Text>
                    <View style={styles.poolTokenRow}>
                      <Text style={styles.poolToken}>{pool.tokenSymbol}</Text>
                      <View style={styles.poolDot} />
                      <Badge
                        label={pool.status || 'Active'}
                        variant={pool.status === 'ACTIVE' ? 'success' : 'warning'}
                      />
                    </View>
                  </View>
                  <View style={styles.poolTrailing}>
                    {supportsCredit && misconfigured ? (
                      <View style={styles.claimWarnPill}>
                        <Ionicons name="alert-circle" size={16} color={Colors.error} />
                      </View>
                    ) : supportsCredit && !poolActive ? (
                      <View style={styles.claimMutedPill}>
                        <Ionicons name="pause-circle-outline" size={16} color={Colors.textMuted} />
                        <Text style={styles.claimMutedText}>Paused</Text>
                      </View>
                    ) : canClaimNow ? (
                      <View style={styles.claimReadyPill} accessibilityRole="text" accessibilityLabel="Ready to claim">
                        <Ionicons name="gift" size={15} color="#000" />
                        <Text style={styles.claimReadyText}>Claim</Text>
                      </View>
                    ) : showClaimTrail ? (
                      <View style={styles.claimOutlinePill}>
                        <Ionicons name="gift-outline" size={15} color={Colors.primary} />
                        <Text style={styles.claimOutlineText}>Claim</Text>
                      </View>
                    ) : null}
                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} style={styles.poolChevron} />
                  </View>
                </View>

                {supportsCredit ? (
                  <View style={styles.poolClaimHint}>
                    <Ionicons
                      name={
                        misconfigured
                          ? 'warning-outline'
                          : canClaimNow
                            ? 'checkmark-circle'
                            : !poolActive
                              ? 'pause-outline'
                              : 'wallet-outline'
                      }
                      size={16}
                      color={
                        misconfigured ? Colors.error : canClaimNow ? Colors.primary : Colors.textMuted
                      }
                    />
                    <Text style={styles.poolClaimHintText} numberOfLines={3}>
                      {misconfigured
                        ? 'Package haijakamilika admin (loan credit haijaset).'
                        : !poolActive
                          ? 'Pool si hai — subiri iwe ACTIVE kisha claim.'
                          : canClaimNow
                            ? 'Fungua screen kudhibitisha — ada itatolewa kwenye Deposit wallet (USDT).'
                            : needMore
                              ? `Una jumla $${spendableForClaimFee.toFixed(2)} (Deposit + Loan) — unahitaji angalau $${fee} kwa ada.`
                              : `In-app claim · ada $${fee} · loan ${loanStr}.`}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.poolFeeLoanRow}>
                  <View style={styles.poolFeeLoanCell}>
                    <Text style={styles.poolFeeLoanLabel}>{supportsCredit ? 'Claim fee' : 'Fee (if claim on)'}</Text>
                    <Text style={styles.poolFeeLoanValue}>${fee}</Text>
                  </View>
                  <View style={styles.poolFeeLoanMid} />
                  <View style={styles.poolFeeLoanCell}>
                    <Text style={styles.poolFeeLoanLabel}>{supportsCredit ? 'Loan' : 'Loan (if claim on)'}</Text>
                    <Text style={[styles.poolFeeLoanValue, styles.poolLoanAccent]}>{loanStr}</Text>
                  </View>
                </View>

                {!supportsCredit ? (
                  <View style={styles.poolClaimDisabledBanner}>
                    <Ionicons name="lock-closed-outline" size={15} color={Colors.textMuted} />
                    <Text style={styles.poolClaimDisabledText}>
                      In-app claim imezimwa kwa mfuko huu (tazama “Claim packs” = 0 juu). Admin awashie “claim from
                      Deposit wallet” kwenye dashboard — hata ukiwa na salio, Claim haitafanya kazi mpaka hilo
                      liwashwe.
                    </Text>
                  </View>
                ) : null}

                <View style={styles.poolFooter}>
                  <View style={styles.poolFooterLeft}>
                    <Ionicons name="people-outline" size={13} color={Colors.textMuted} />
                    <Text style={styles.poolMemberText}>{pool._count?.members || pool.memberCount || 0} members</Text>
                  </View>
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
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  depositBanner: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginTop: 8 },
  loanBannerLine: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 4 },
  depositBannerStrong: { color: Colors.primary, fontWeight: '800' },
  depositBannerNote: { color: Colors.textMuted, fontWeight: '600', fontSize: 11 },
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
    gap: Spacing.sm,
  },
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  poolTitleBlock: { flex: 1, marginLeft: Spacing.md, minWidth: 0, paddingRight: Spacing.sm },
  poolTrailing: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  poolChevron: { marginLeft: 0 },
  claimReadyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
  },
  claimReadyText: { fontSize: 12, fontWeight: '800', color: '#000' },
  claimOutlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(240,185,11,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(240,185,11,0.08)',
  },
  claimOutlineText: { fontSize: 11, fontWeight: '800', color: Colors.primary },
  claimMutedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  claimMutedText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  claimWarnPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(255,71,87,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.35)',
  },
  poolClaimHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  poolClaimHintText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    lineHeight: 17,
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
  poolClaimDisabledBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  poolClaimDisabledText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    lineHeight: 16,
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
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  poolFooterLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  poolMemberText: { fontSize: 12, color: Colors.textSecondary, flexShrink: 1 },

  // Empty
  empty: { alignItems: 'center', gap: Spacing.sm, paddingVertical: 80 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  emptyText: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
});
