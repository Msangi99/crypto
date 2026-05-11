import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { userAPI } from '../../services/api';

function fmt(n: number) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function WithdrawReferralScreen({ navigation }: any) {
  const [earnings, setEarnings] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await userAPI.referralEarnings();
      setEarnings(res.data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const earningsData = earnings?.earnings ?? {};
  const totalEarned: number = earningsData.totalBonusReceived ?? 0;
  const recentBonuses: any[] = earningsData.recentBonuses ?? [];
  const referralList: any[] = earningsData.referralList ?? [];

  const handleWithdraw = () => {
    Alert.alert(
      'Withdraw Referral Earnings',
      `You have ${fmt(totalEarned)} USDT in referral earnings.\n\nWithdrawal requests are processed within 24–48 hours to your registered wallet.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Withdrawal',
          onPress: () =>
            Alert.alert('Request Submitted', 'Your withdrawal request has been submitted. You will be notified once processed.'),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Withdraw Referral</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Balance Card */}
        <LinearGradient
          colors={['rgba(0,214,161,0.18)', 'rgba(0,214,161,0.04)']}
          style={styles.balanceCard}
        >
          <View style={styles.balanceIconWrap}>
            <Ionicons name="arrow-up-circle" size={32} color="#00D6A1" />
          </View>
          <Text style={styles.balanceLabel}>Referral Earnings</Text>
          <Text style={styles.balanceValue}>{fmt(totalEarned)} USDT</Text>
          <Text style={styles.balanceSub}>Total earned from referral commissions</Text>

          <TouchableOpacity
            style={[styles.withdrawBtn, totalEarned <= 0 && styles.withdrawBtnDisabled]}
            onPress={handleWithdraw}
            disabled={totalEarned <= 0}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up-circle-outline" size={18} color={totalEarned > 0 ? '#000' : Colors.textMuted} />
            <Text style={[styles.withdrawBtnText, totalEarned <= 0 && styles.withdrawBtnTextDisabled]}>
              Request Withdrawal
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{earningsData.directReferrals ?? 0}</Text>
            <Text style={styles.statLabel}>Direct Referrals</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="git-network-outline" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{earningsData.totalNetwork ?? referralList.length}</Text>
            <Text style={styles.statLabel}>Total Network</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{recentBonuses.length}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
        </View>

        {/* History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earning History</Text>

          {!earnings ? (
            /* Loading skeletons */
            [0, 1, 2].map((i) => (
              <View key={i} style={styles.skeletonRow}>
                <View style={styles.skeletonIcon} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={[styles.skeletonLine, { width: '60%' }]} />
                  <View style={[styles.skeletonLine, { width: '40%' }]} />
                </View>
                <View style={[styles.skeletonLine, { width: 70 }]} />
              </View>
            ))
          ) : recentBonuses.length === 0 && referralList.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No earnings yet</Text>
              <Text style={styles.emptyHint}>
                Share your referral code to start earning commissions when your referrals deposit.
              </Text>
            </View>
          ) : (
            <>
              {/* Recent bonus transactions */}
              {recentBonuses.map((bonus: any, i: number) => (
                <View key={`bonus-${i}`} style={styles.historyRow}>
                  <View style={styles.historyIconWrap}>
                    <Ionicons name="gift-outline" size={18} color="#00D6A1" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle}>Referral Bonus</Text>
                    <Text style={styles.historyDate}>
                      {new Date(bonus.createdAt).toLocaleDateString('en-US', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </Text>
                  </View>
                  <Text style={styles.historyAmount}>+{fmt(bonus.amount)} USDT</Text>
                </View>
              ))}

              {/* Per-referral rewards */}
              {referralList.map((ref: any, i: number) => (
                <View key={`ref-${i}`} style={styles.historyRow}>
                  <View style={[styles.historyIconWrap, { backgroundColor: 'rgba(240,185,11,0.12)' }]}>
                    <Text style={styles.avatarText}>
                      {(ref.username ?? ref.wallet ?? '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyTitle}>{ref.username || 'Anonymous'}</Text>
                    <Text style={styles.historyDate}>
                      {ref.wallet
                        ? `${ref.wallet.slice(0, 8)}...${ref.wallet.slice(-4)}`
                        : 'Referral'}
                    </Text>
                  </View>
                  {ref.reward > 0 && (
                    <Text style={styles.historyAmount}>+{fmt(ref.reward)} USDT</Text>
                  )}
                </View>
              ))}
            </>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
  },
  backBtn: { padding: 6 },
  refreshBtn: { padding: 6 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },

  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },

  // Balance card
  balanceCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,214,161,0.2)',
  },
  balanceIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(0,214,161,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  balanceLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  balanceValue: { fontSize: 36, fontWeight: '900', color: '#00D6A1', letterSpacing: -1 },
  balanceSub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' },

  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    backgroundColor: '#00D6A1',
    paddingVertical: 13,
    paddingHorizontal: 32,
    borderRadius: Radius.lg,
  },
  withdrawBtnDisabled: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  withdrawBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  withdrawBtnTextDisabled: { color: Colors.textMuted },

  // Stats
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Section
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },

  // History rows
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(0,214,161,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTitle: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
  historyDate: { fontSize: 11, color: Colors.textMuted, marginTop: 2 },
  historyAmount: { fontSize: 13, fontWeight: '800', color: '#00D6A1' },
  avatarText: { fontSize: 14, fontWeight: '800', color: Colors.primary },

  // Empty
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: Spacing.xl,
  },
  emptyText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  emptyHint: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    lineHeight: 18,
  },

  // Skeletons
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
  },
  skeletonIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.bgElevated },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: Colors.bgElevated },
});
