import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Share, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { userAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const LEVEL_COLORS = [Colors.gold, Colors.primary, Colors.success, Colors.warning, Colors.textSecondary];
const LEVEL_RATES = ['20%', '7%', '4%', '3%', '1%'];

/** Referral credits are recorded in USD / USDT terms (not BNB). */
function formatReferralUsdt(n: number) {
  const v = Number(n) || 0;
  return `${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;
}

export default function ReferralsScreen() {
  const { user } = useAuthStore();
  const [tree, setTree] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'tree' | 'earnings'>('earnings');

  const load = useCallback(async () => {
    try {
      const [t, e] = await Promise.all([userAPI.referralTree(), userAPI.referralEarnings()]);
      setTree(t.data);
      setEarnings(e.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const referralLink = `https://cryptoloanboost.com/join?ref=${user?.referralCode ?? ''}`;

  const copyCode = async () => {
    await Clipboard.setStringAsync(user?.referralCode ?? '');
    Alert.alert('Copied!', 'Referral code copied to clipboard');
  };

  const shareLink = async () => {
    await Share.share({
      message: `Join CryptoLoanBoost and earn up to 60x leverage on your crypto! Use my referral code: ${user?.referralCode}\n${referralLink}`,
    });
  };

  return (
    <View style={styles.container}>
      {/* Dark Gradient Header */}
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
        <View style={styles.header}>
          <Text style={styles.title}>Referrals</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Referral Code Card inside gradient */}
        <View style={styles.codeSection}>
          <View style={styles.codeCard}>
            <View style={styles.codeHeader}>
              <Ionicons name="gift-outline" size={20} color={Colors.primary} />
              <Text style={styles.codeHeaderTitle}>Your Referral Code</Text>
            </View>
            <Text style={styles.codeValue}>{user?.referralCode ?? '——'}</Text>
            <Text style={styles.codeLink} numberOfLines={1}>{referralLink}</Text>
            <View style={styles.codeActions}>
              <TouchableOpacity onPress={copyCode} style={styles.codeBtnPrimary}>
                <Ionicons name="copy-outline" size={16} color="#000" />
                <Text style={styles.codeBtnPrimaryText}>Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={shareLink} style={styles.codeBtnOutline}>
                <Ionicons name="share-social-outline" size={16} color={Colors.primary} />
                <Text style={styles.codeBtnOutlineText}>Share Link</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{tree?.totalNetwork ?? 0}</Text>
            <Text style={styles.statLabel}>All Referrals</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="wallet-outline" size={16} color={Colors.primary} />
            <Text style={[styles.statValue, { color: Colors.primary }]}>{formatReferralUsdt(earnings?.earnings?.totalBonusReceived ?? 0)}</Text>
            <Text style={styles.statLabel}>Total Rewards</Text>
          </View>
        </View>

        {/* Commission Breakdown */}
        <View style={styles.commissionBreakdownRow}>
          <View style={styles.commissionBreakdownItem}>
            <Text style={styles.commissionBreakdownValue}>
              {formatReferralUsdt(earnings?.earnings?.commissionRates?.[0]?.earned ?? 0)}
            </Text>
            <Text style={styles.commissionBreakdownLabel}>Direct (L1)</Text>
          </View>
          <Text style={styles.commissionBreakdownPlus}>+</Text>
          <View style={styles.commissionBreakdownItem}>
            <Text style={styles.commissionBreakdownValue}>
              {formatReferralUsdt(
                (earnings?.earnings?.commissionRates ?? [])
                  .slice(1)
                  .reduce((sum: number, r: any) => sum + (r.earned ?? 0), 0)
              )}
            </Text>
            <Text style={styles.commissionBreakdownLabel}>Network (L2–L5)</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['earnings', 'tree'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'earnings' ? 'Rewards' : 'Network Tree'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: Spacing.lg, paddingBottom: 100 }}
      >
        {tab === 'earnings' ? (
          <EarningsView earnings={earnings} />
        ) : (
          <TreeView tree={tree} />
        )}
      </ScrollView>
    </View>
  );
}

function EarningsView({ earnings }: { earnings: any }) {
  if (!earnings) return <SkeletonBlock />;
  const earningsData = earnings.earnings ?? {};
  const rates = earningsData.commissionRates ?? [];
  const recentBonuses = earningsData.recentBonuses ?? [];
  const referralList = earningsData.referralList ?? [];

  return (
    <View style={{ gap: Spacing.lg }}>
      {/* Commission Structure - Horizontal Scroll */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Commission Structure</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.commissionScroll}>
          {rates.map((rate: any, i: number) => (
            <View key={i} style={[styles.commissionCard, { borderLeftColor: LEVEL_COLORS[i] }]}>
              <View style={[styles.commissionDot, { backgroundColor: LEVEL_COLORS[i] }]} />
              <Text style={[styles.commissionLevel, { color: LEVEL_COLORS[i] }]}>Level {i + 1}</Text>
              <Text style={styles.commissionRate}>{rate.rate}</Text>
              <Text style={styles.commissionDesc}>{rate.description}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Recent Bonuses */}
      {recentBonuses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Bonuses</Text>
          <View style={styles.cardList}>
            {recentBonuses.slice(0, 5).map((bonus: any, i: number) => (
              <View key={i} style={styles.bonusRow}>
                <View style={styles.bonusIcon}>
                  <Ionicons name="gift-outline" size={18} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bonusType}>Referral Bonus</Text>
                  <Text style={styles.bonusDate}>{new Date(bonus.createdAt).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.bonusAmount}>+{formatReferralUsdt(bonus.amount)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Referral List */}
      {referralList.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Referrals</Text>
          <View style={styles.cardList}>
            {referralList.slice(0, 5).map((ref: any, i: number) => (
              <View key={i} style={styles.referralRow}>
                <View style={styles.referralAvatar}>
                  <Text style={styles.referralAvatarText}>
                    {(ref.username ?? ref.wallet ?? '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.referralName}>{ref.username || 'Anonymous'}</Text>
                  <Text style={styles.referralAddr}>
                    {ref.wallet ? `${ref.wallet.slice(0, 8)}...${ref.wallet.slice(-4)}` : ''}
                  </Text>
                </View>
                <Text style={styles.referralReward}>+{formatReferralUsdt(ref.reward)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function TreeView({ tree }: { tree: any }) {
  if (!tree) return <SkeletonBlock />;
  const levels = tree.levels ?? [];
  const totalNetwork = tree.totalNetwork ?? 0;
  const totalEarnings = tree.totalEarnings ?? 0;

  return (
    <View style={{ gap: Spacing.lg }}>
      {/* Network Summary */}
      <View style={styles.networkSummary}>
        <View style={styles.networkStat}>
          <Ionicons name="people-outline" size={20} color={Colors.primary} />
          <Text style={styles.networkStatValue}>{totalNetwork}</Text>
          <Text style={styles.networkStatLabel}>Total Network</Text>
        </View>
        <View style={styles.networkDivider} />
        <View style={styles.networkStat}>
          <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
          <Text style={[styles.networkStatValue, { color: Colors.primary }]}>{formatReferralUsdt(totalEarnings)}</Text>
          <Text style={styles.networkStatLabel}>Total rewards</Text>
        </View>
      </View>

      {/* Level Cards */}
      {levels.map((lv: any, i: number) => (
        <View key={i} style={[styles.levelCard, { borderLeftColor: LEVEL_COLORS[i] }]}>
          <View style={styles.levelHeader}>
            <View style={[styles.levelDot, { backgroundColor: LEVEL_COLORS[i] }]} />
            <Text style={styles.levelTitle}>Level {lv.level}</Text>
            <View style={[styles.levelRateBadge, { backgroundColor: LEVEL_COLORS[i] + '18' }]}>
              <Text style={[styles.levelRateText, { color: LEVEL_COLORS[i] }]}>{lv.commissionRate}</Text>
            </View>
          </View>
          <View style={styles.levelStats}>
            <View style={styles.levelStatItem}>
              <Text style={styles.levelStatLabel}>Members</Text>
              <Text style={styles.levelStatValue}>{lv.totalMembers}</Text>
            </View>
            <View style={styles.levelStatDivider} />
            <View style={styles.levelStatItem}>
              <Text style={styles.levelStatLabel}>Rewards</Text>
              <Text style={[styles.levelStatValue, { color: LEVEL_COLORS[i] }]}>{formatReferralUsdt(lv.totalEarnings)}</Text>
            </View>
          </View>
          {lv.members?.length > 0 && (
            <View style={styles.membersList}>
              {lv.members.slice(0, 4).map((u: any, j: number) => (
                <View key={j} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>
                      {(u.username ?? u.walletAddress ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{u.username || 'Anonymous'}</Text>
                    <Text style={styles.memberAddr}>
                      {u.walletAddress ? `${u.walletAddress.slice(0, 8)}...${u.walletAddress.slice(-4)}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.memberRewardValue, { color: Colors.primary }]}>
                    {u.reward > 0 ? `+${formatReferralUsdt(u.reward)}` : '—'}
                  </Text>
                </View>
              ))}
              {lv.members.length > 4 && (
                <TouchableOpacity style={styles.membersMoreBtn}>
                  <Text style={styles.membersMoreText}>View all {lv.members.length} members</Text>
                  <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function SkeletonBlock() {
  return (
    <View style={{ gap: Spacing.sm }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.skeleton, { height: 60 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header Gradient
  headerGradient: { paddingBottom: Spacing.md },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },

  // Code Section
  codeSection: { marginHorizontal: Spacing.lg },
  codeCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.xl,
    padding: Spacing.lg, gap: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  codeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  codeHeaderTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  codeValue: { fontSize: 36, fontWeight: '900', color: Colors.primary, letterSpacing: 4, textAlign: 'center', marginVertical: 4 },
  codeLink: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },
  codeActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, width: '100%' },
  codeBtnPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: Colors.primary, borderRadius: 99, paddingVertical: 12,
  },
  codeBtnPrimaryText: { fontSize: 13, fontWeight: '800', color: '#000' },
  codeBtnOutline: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'transparent', borderRadius: 99, paddingVertical: 12,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  codeBtnOutlineText: { fontSize: 13, fontWeight: '800', color: Colors.primary },

  // Stats Row
  statsRow: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  commissionBreakdownRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: Spacing.lg, marginTop: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: Radius.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    gap: Spacing.sm,
  },
  commissionBreakdownItem: { flex: 1, alignItems: 'center', gap: 2 },
  commissionBreakdownValue: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  commissionBreakdownLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  commissionBreakdownPlus: { fontSize: 16, fontWeight: '800', color: Colors.textMuted },

  // Tabs
  tabRow: {
    flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: 99, padding: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 99 },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  tabTextActive: { color: '#000' },

  // Section
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },

  // Commission Cards
  commissionScroll: { gap: Spacing.sm, paddingRight: Spacing.lg },
  commissionCard: {
    width: 120, backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, gap: 6, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4,
  },
  commissionDot: { width: 10, height: 10, borderRadius: 5 },
  commissionLevel: { fontSize: 13, fontWeight: '800' },
  commissionRate: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  commissionDesc: { fontSize: 10, color: Colors.textMuted, textAlign: 'center' },

  // Card List
  cardList: { gap: 0 },

  // Bonus Row
  bonusRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  bonusIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(240,185,11,0.1)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },
  bonusType: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  bonusDate: { fontSize: 12, color: Colors.textMuted },
  bonusAmount: { fontSize: 14, fontWeight: '800', color: Colors.primary },

  // Referral Row
  referralRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  referralAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(240,185,11,0.1)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },
  referralAvatarText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  referralName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  referralAddr: { fontSize: 12, color: Colors.textMuted },
  referralReward: { fontSize: 14, fontWeight: '800', color: Colors.primary },

  // Network Tree
  networkSummary: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  networkStat: { flex: 1, alignItems: 'center', gap: 4 },
  networkStatValue: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  networkStatLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  networkDivider: { width: 1, backgroundColor: Colors.border },

  // Level Card
  levelCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.lg,
    gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4,
  },
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelDot: { width: 12, height: 12, borderRadius: 6 },
  levelTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, flex: 1 },
  levelRateBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 99,
  },
  levelRateText: { fontSize: 12, fontWeight: '800' },
  levelStats: { flexDirection: 'row', gap: Spacing.md, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  levelStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  levelStatDivider: { width: 1, height: 24, backgroundColor: Colors.border },
  levelStatLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  levelStatValue: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  membersList: { gap: Spacing.xs, marginTop: Spacing.sm },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  memberAvatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(240,185,11,0.1)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },
  memberAvatarText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  memberName: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  memberAddr: { fontSize: 11, color: Colors.textMuted },
  memberRewardValue: { fontSize: 13, fontWeight: '700' },
  membersMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingVertical: 8, marginTop: 4,
  },
  membersMoreText: { fontSize: 12, fontWeight: '700', color: Colors.primary },

  // Skeleton
  skeleton: { borderRadius: Radius.md, backgroundColor: Colors.bgCard, width: '100%' },
});
