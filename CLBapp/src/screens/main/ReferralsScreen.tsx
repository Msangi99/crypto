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
const LEVEL_RATES = ['20%', '8%', '5%', '3%', '1%'];

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Referrals</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: Spacing.lg, paddingBottom: 100 }}
      >
        {/* Referral Code Card */}
        <LinearGradient colors={Colors.gradientGold} style={styles.codeCard}>
          <View style={styles.codeGlow} />
          <View style={styles.codeHeader}>
            <Ionicons name="gift-outline" size={24} color="#fff" />
            <Text style={styles.codeHeaderTitle}>Invite & Earn</Text>
          </View>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <Text style={styles.codeValue}>{user?.referralCode ?? '——'}</Text>
          <Text style={styles.codeLink} numberOfLines={1}>{referralLink}</Text>
          <View style={styles.codeActions}>
            <TouchableOpacity onPress={copyCode} style={styles.codeBtn}>
              <Ionicons name="copy-outline" size={18} color="#000" />
              <Text style={styles.codeBtnText}>Copy Code</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={shareLink} style={[styles.codeBtn, styles.codeBtnOutline]}>
              <Ionicons name="share-social-outline" size={18} color="#fff" />
              <Text style={[styles.codeBtnText, { color: '#fff' }]}>Share Link</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Stats Overview */}
        <View style={styles.statsRow}>
          <LinearGradient colors={Colors.gradientCard} style={styles.statCard}>
            <Ionicons name="people-outline" size={20} color={Colors.primary} />
            <Text style={styles.statLabel}>Direct Referrals</Text>
            <Text style={styles.statValue}>{earnings?.earnings?.directReferrals ?? 0}</Text>
          </LinearGradient>
          <LinearGradient colors={Colors.gradientCard} style={styles.statCard}>
            <Ionicons name="wallet-outline" size={20} color={Colors.gold} />
            <Text style={styles.statLabel}>Total Earnings</Text>
            <Text style={[styles.statValue, { color: Colors.gold }]}>
              {(earnings?.earnings?.totalBonusReceived ?? 0).toFixed(4)} BNB
            </Text>
          </LinearGradient>
        </View>

        {/* Tabs */}
        <View style={styles.tabRow}>
          {(['earnings', 'tree'] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'earnings' ? 'Earnings' : 'Network Tree'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
    <View style={{ gap: Spacing.sm }}>
      {/* Total Earnings Card */}
      <LinearGradient colors={Colors.gradientCard} style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Referral Earnings</Text>
        <Text style={styles.totalValue}>{(earningsData.totalBonusReceived ?? 0).toFixed(4)} BNB</Text>
        <View style={styles.totalStats}>
          <View style={styles.totalStatItem}>
            <Text style={styles.totalStatLabel}>Direct Referrals</Text>
            <Text style={styles.totalStatValue}>{earningsData.directReferrals ?? 0}</Text>
          </View>
          <View style={styles.totalStatDivider} />
          <View style={styles.totalStatItem}>
            <Text style={styles.totalStatLabel}>Network Size</Text>
            <Text style={styles.totalStatValue}>{referralList.length}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Commission Rates */}
      <View style={styles.ratesCard}>
        <Text style={styles.ratesTitle}>Commission Rates</Text>
        <View style={styles.ratesGrid}>
          {rates.map((rate: any, i: number) => (
            <View key={i} style={styles.rateCard}>
              <View style={[styles.rateDot, { backgroundColor: LEVEL_COLORS[i] }]} />
              <Text style={[styles.rateLevel, { color: LEVEL_COLORS[i] }]}>L{i + 1}</Text>
              <Text style={styles.rateValue}>{rate.rate}</Text>
              <Text style={styles.rateDesc}>{rate.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Recent Bonuses */}
      {recentBonuses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Bonuses</Text>
          {recentBonuses.slice(0, 5).map((bonus: any, i: number) => (
            <View key={i} style={styles.bonusRow}>
              <View style={[styles.bonusIcon, { backgroundColor: Colors.gold + '22' }]}>
                <Ionicons name="gift-outline" size={16} color={Colors.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bonusType}>Referral Bonus</Text>
                <Text style={styles.bonusDate}>{new Date(bonus.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={[styles.bonusAmount, { color: Colors.gold }]}>
                +{bonus.amount.toFixed(4)} BNB
              </Text>
            </View>
          ))}
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
    <View style={{ gap: Spacing.md }}>
      {/* Network Summary */}
      <LinearGradient colors={Colors.gradientCard} style={styles.networkSummary}>
        <View style={styles.networkStat}>
          <Text style={styles.networkStatLabel}>Total Network</Text>
          <Text style={styles.networkStatValue}>{totalNetwork} members</Text>
        </View>
        <View style={styles.networkDivider} />
        <View style={styles.networkStat}>
          <Text style={styles.networkStatLabel}>Total Earnings</Text>
          <Text style={[styles.networkStatValue, { color: Colors.gold }]}>{totalEarnings.toFixed(4)} BNB</Text>
        </View>
      </LinearGradient>

      {/* Level Cards */}
      {levels.map((lv: any, i: number) => (
        <View key={i} style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={[styles.levelDot, { backgroundColor: LEVEL_COLORS[i] }]} />
            <Text style={styles.levelTitle}>Level {lv.level}</Text>
            <Text style={styles.levelRate}>{lv.commissionRate}</Text>
          </View>
          <View style={styles.levelStats}>
            <View style={styles.levelStatItem}>
              <Text style={styles.levelStatLabel}>Members</Text>
              <Text style={styles.levelStatValue}>{lv.totalMembers}</Text>
            </View>
            <View style={styles.levelStatItem}>
              <Text style={styles.levelStatLabel}>Earnings</Text>
              <Text style={[styles.levelStatValue, { color: LEVEL_COLORS[i] }]}>{lv.totalEarnings.toFixed(4)}</Text>
            </View>
          </View>
          {lv.members?.length > 0 && (
            <View style={styles.membersList}>
              {lv.members.slice(0, 3).map((u: any, j: number) => (
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
                  <Text style={styles.memberJoined}>{new Date(u.joinedAt).toLocaleDateString()}</Text>
                </View>
              ))}
              {lv.members.length > 3 && (
                <Text style={styles.membersMore}>+{lv.members.length - 3} more</Text>
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
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 0.5 },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  codeCard: {
    borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.3)',
    gap: Spacing.sm, overflow: 'hidden',
  },
  codeGlow: {
    position: 'absolute', top: -40, right: -40,
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(240,185,11,0.15)',
  },
  codeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  codeHeaderTitle: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  codeLabel: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1 },
  codeValue: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: 6, textAlign: 'center', marginVertical: 4 },
  codeLink: { fontSize: FontSize.xs, color: 'rgba(255,255,255,0.6)', textAlign: 'center' },
  codeActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  codeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: Radius.full, paddingVertical: 12,
  },
  codeBtnOutline: {
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#fff',
  },
  codeBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: '#000' },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: {
    flex: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: 8,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  statValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.textPrimary },
  ratesCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  ratesTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  ratesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  ratesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rateItem: { alignItems: 'center', gap: 4 },
  rateCard: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.bg,
    borderRadius: Radius.md, padding: Spacing.sm, gap: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  rateDot: { width: 8, height: 8, borderRadius: 4 },
  rateLevel: { fontSize: FontSize.xs, fontWeight: '700' },
  rateValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  rateDesc: { fontSize: 9, color: Colors.textMuted, marginTop: 2 },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.full, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.full },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: '#fff' },
  totalCard: { borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.gold },
  totalStats: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border + '40' },
  totalStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  totalStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  totalStatValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  totalStatDivider: { width: 1, height: 24, backgroundColor: Colors.border },
  levelRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  levelIndicator: { width: 4, height: 36, borderRadius: 2 },
  levelName: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  levelCount: { fontSize: FontSize.xs, color: Colors.textSecondary },
  levelEarning: { fontSize: FontSize.md, fontWeight: '700' },
  treeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  treeLevelDot: { width: 10, height: 10, borderRadius: 5 },
  treeLevelTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  treeLevelCount: { fontSize: FontSize.xs, color: Colors.textSecondary },
  treeUserRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  treeAvatar: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  treeAvatarText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  treeUserAddr: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary },
  treeUserJoined: { fontSize: FontSize.xs, color: Colors.textMuted },
  treeMore: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 4, textAlign: 'center' },
  skeleton: { borderRadius: Radius.md, backgroundColor: Colors.bgCard, width: '100%' },
  // Bonus rows
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  bonusRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border + '40',
  },
  bonusIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bonusType: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  bonusDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  bonusAmount: { fontSize: FontSize.md, fontWeight: '700' },
  // Network Tree
  networkSummary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  networkStat: { flex: 1, alignItems: 'center', gap: 4 },
  networkStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  networkStatValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  networkDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  levelCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  levelRate: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  levelStats: { flexDirection: 'row', gap: Spacing.md, paddingTop: 4 },
  levelStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  levelStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  levelStatValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  membersList: { gap: Spacing.xs, marginTop: Spacing.sm },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.border + '40',
  },
  memberAvatar: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.bgElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  memberName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  memberAddr: { fontSize: FontSize.xs, color: Colors.textMuted },
  memberJoined: { fontSize: FontSize.xs, color: Colors.textMuted },
  membersMore: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 4, textAlign: 'center' },
});
