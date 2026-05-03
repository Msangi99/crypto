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
    <LinearGradient colors={['#050811', '#0B0E1A']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Referrals</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: Spacing.lg }}
      >
        {/* Referral Code Card */}
        <LinearGradient colors={['#1A2035', '#131829']} style={styles.codeCard}>
          <View style={styles.codeGlow} />
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <Text style={styles.codeValue}>{user?.referralCode ?? '——'}</Text>
          <Text style={styles.codeLink} numberOfLines={1}>{referralLink}</Text>
          <View style={styles.codeActions}>
            <TouchableOpacity onPress={copyCode} style={styles.codeBtn}>
              <Ionicons name="copy-outline" size={16} color={Colors.primary} />
              <Text style={styles.codeBtnText}>Copy Code</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={shareLink} style={[styles.codeBtn, styles.codeBtnGold]}>
              <Ionicons name="share-social-outline" size={16} color={Colors.gold} />
              <Text style={[styles.codeBtnText, { color: Colors.gold }]}>Share Link</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Commission rates */}
        <View style={styles.ratesCard}>
          <Text style={styles.ratesTitle}>Commission Structure</Text>
          <View style={styles.ratesRow}>
            {LEVEL_RATES.map((rate, i) => (
              <View key={i} style={styles.rateItem}>
                <View style={[styles.rateDot, { backgroundColor: LEVEL_COLORS[i] }]} />
                <Text style={[styles.rateLevel, { color: LEVEL_COLORS[i] }]}>L{i + 1}</Text>
                <Text style={styles.rateValue}>{rate}</Text>
              </View>
            ))}
          </View>
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
    </LinearGradient>
  );
}

function EarningsView({ earnings }: { earnings: any }) {
  if (!earnings) return <SkeletonBlock />;
  const levels = earnings.levels ?? [];
  return (
    <View style={{ gap: Spacing.sm }}>
      <LinearGradient colors={Colors.gradientCard} style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Referral Earnings</Text>
        <Text style={styles.totalValue}>${(earnings.totalEarnings ?? 0).toFixed(4)} BNB</Text>
      </LinearGradient>
      {levels.map((lv: any, i: number) => (
        <LinearGradient key={i} colors={Colors.gradientCard} style={styles.levelRow}>
          <View style={[styles.levelIndicator, { backgroundColor: LEVEL_COLORS[i] }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.levelName}>Level {lv.level}</Text>
            <Text style={styles.levelCount}>{lv.referralCount ?? 0} referrals · {LEVEL_RATES[i]} commission</Text>
          </View>
          <Text style={[styles.levelEarning, { color: LEVEL_COLORS[i] }]}>
            ${(lv.earnings ?? 0).toFixed(4)}
          </Text>
        </LinearGradient>
      ))}
    </View>
  );
}

function TreeView({ tree }: { tree: any }) {
  if (!tree) return <SkeletonBlock />;
  const levels = tree.levels ?? [];
  return (
    <View style={{ gap: Spacing.md }}>
      {levels.map((lv: any, i: number) => (
        <View key={i}>
          <View style={styles.treeHeader}>
            <View style={[styles.treeLevelDot, { backgroundColor: LEVEL_COLORS[i] }]} />
            <Text style={styles.treeLevelTitle}>Level {lv.level}</Text>
            <Text style={styles.treeLevelCount}>{lv.users?.length ?? 0} members</Text>
          </View>
          {(lv.users ?? []).slice(0, 3).map((u: any, j: number) => (
            <View key={j} style={styles.treeUserRow}>
              <View style={styles.treeAvatar}>
                <Text style={styles.treeAvatarText}>{(u.username ?? u.walletAddress ?? '?')[0].toUpperCase()}</Text>
              </View>
              <Text style={styles.treeUserAddr}>
                {u.walletAddress ? `${u.walletAddress.slice(0, 8)}...${u.walletAddress.slice(-4)}` : u.username}
              </Text>
              <Text style={styles.treeUserJoined}>{u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : ''}</Text>
            </View>
          ))}
          {(lv.users?.length ?? 0) > 3 && (
            <Text style={styles.treeMore}>+{lv.users.length - 3} more</Text>
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
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.lg },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  codeCard: {
    borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)',
    gap: Spacing.sm, overflow: 'hidden',
  },
  codeGlow: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(245,166,35,0.06)',
  },
  codeLabel: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  codeValue: { fontSize: 28, fontWeight: '900', color: Colors.gold, letterSpacing: 4 },
  codeLink: { fontSize: FontSize.xs, color: Colors.textSecondary },
  codeActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  codeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(26,86,255,0.12)', borderWidth: 1, borderColor: 'rgba(26,86,255,0.25)',
    borderRadius: Radius.full, paddingVertical: 10,
  },
  codeBtnGold: { backgroundColor: 'rgba(245,166,35,0.12)', borderColor: 'rgba(245,166,35,0.25)' },
  codeBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  ratesCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, gap: Spacing.sm,
  },
  ratesTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  ratesRow: { flexDirection: 'row', justifyContent: 'space-between' },
  rateItem: { alignItems: 'center', gap: 4 },
  rateDot: { width: 8, height: 8, borderRadius: 4 },
  rateLevel: { fontSize: FontSize.xs, fontWeight: '700' },
  rateValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.full, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.full },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: '#fff' },
  totalCard: { borderRadius: Radius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  totalLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  totalValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.gold },
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
});
