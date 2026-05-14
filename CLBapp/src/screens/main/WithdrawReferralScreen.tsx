import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { userAPI, withdrawalsAPI } from '../../services/api';

function fmt(n: number) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const USDT_FEE = 1;

function isValidBep20Address(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

export default function WithdrawReferralScreen({ navigation }: any) {
  const [earnings, setEarnings] = useState<any>(null);
  const [tree, setTree] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [historyTab, setHistoryTab] = useState<'earnings' | 'withdrawals'>('earnings');

  // Withdraw modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [toAddress, setToAddress] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [eRes, tRes, wRes] = await Promise.all([
        userAPI.referralEarnings(),
        userAPI.referralTree(),
        withdrawalsAPI.list(1, 50),
      ]);
      setEarnings(eRes.data);
      setTree(tRes.data);
      setWithdrawals(wRes.data?.withdrawals ?? []);
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
  const availableToWithdraw: number = earningsData.availableWithdrawalUsd ?? totalEarned;
  const recentBonuses: any[] = earningsData.recentBonuses ?? [];
  const referralList: any[] = earningsData.referralList ?? [];

  const numAmount = parseFloat(withdrawAmount || '0');
  const netAmount = Math.max(0, numAmount - USDT_FEE);

  const openWithdrawModal = () => {
    setToAddress('');
    setWithdrawAmount(availableToWithdraw > 0 ? availableToWithdraw.toFixed(2) : '');
    setModalVisible(true);
  };

  const handleSubmitWithdraw = async () => {
    const address = toAddress.trim();

    if (!address) {
      Alert.alert('Missing Address', 'Please enter your USDT BEP20 receiving address.');
      return;
    }
    if (!isValidBep20Address(address)) {
      Alert.alert('Invalid Address', 'Enter a valid BNB Smart Chain (BEP20) wallet address starting with 0x.');
      return;
    }
    if (!withdrawAmount || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Enter a valid withdrawal amount.');
      return;
    }
    if (numAmount <= USDT_FEE) {
      Alert.alert('Amount Too Low', `Amount must be greater than the ${USDT_FEE} USDT network fee.`);
      return;
    }
    if (numAmount > availableToWithdraw) {
      Alert.alert('Insufficient Balance', `Your available referral earnings: ${fmt(availableToWithdraw)} USDT`);
      return;
    }

    setSubmitting(true);
    try {
      await withdrawalsAPI.request({
        token: 'USDT',
        amount: numAmount,
        toAddress: address,
      });
      setModalVisible(false);
      load();
    } catch (err: any) {
      Alert.alert('Withdrawal Failed', err?.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
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
          <Text style={styles.balanceValue}>{fmt(availableToWithdraw)} USDT</Text>
          <Text style={styles.balanceSub}>Available to withdraw now</Text>

          <TouchableOpacity
            style={[styles.withdrawBtn, totalEarned <= 0 && styles.withdrawBtnDisabled]}
            onPress={openWithdrawModal}
            disabled={availableToWithdraw <= 0}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up-circle-outline" size={18} color={availableToWithdraw > 0 ? '#000' : Colors.textMuted} />
            <Text style={[styles.withdrawBtnText, availableToWithdraw <= 0 && styles.withdrawBtnTextDisabled]}>
              Request Withdrawal
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="people-outline" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{tree?.totalNetwork ?? 0}</Text>
            <Text style={styles.statLabel}>All Referrals</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="git-network-outline" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{fmt(earningsData.totalBonusReceived ?? 0)}</Text>
            <Text style={styles.statLabel}>Total Commission</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="receipt-outline" size={16} color={Colors.primary} />
            <Text style={styles.statValue}>{recentBonuses.length}</Text>
            <Text style={styles.statLabel}>Transactions</Text>
          </View>
        </View>

        {/* History Tabs */}
        <View style={styles.section}>
          <View style={styles.historyTabRow}>
            <TouchableOpacity
              onPress={() => setHistoryTab('earnings')}
              style={[styles.historyTab, historyTab === 'earnings' && styles.historyTabActive]}
            >
              <Text style={[styles.historyTabText, historyTab === 'earnings' && styles.historyTabTextActive]}>
                Earning History
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setHistoryTab('withdrawals')}
              style={[styles.historyTab, historyTab === 'withdrawals' && styles.historyTabActive]}
            >
              <Text style={[styles.historyTabText, historyTab === 'withdrawals' && styles.historyTabTextActive]}>
                Withdrawal History
              </Text>
            </TouchableOpacity>
          </View>

          {historyTab === 'earnings' ? (
            /* ── Earning History ── */
            !earnings ? (
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
            )
          ) : (
            /* ── Withdrawal History ── */
            !earnings ? (
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
            ) : withdrawals.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="arrow-up-circle-outline" size={36} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No withdrawals yet</Text>
                <Text style={styles.emptyHint}>
                  Your withdrawal requests will appear here once you make one.
                </Text>
              </View>
            ) : (
              withdrawals.map((w: any, i: number) => {
                const statusColor = w.status === 'COMPLETED' ? '#00D6A1'
                  : w.status === 'PENDING' ? Colors.warning
                  : w.status === 'REJECTED' ? Colors.error
                  : Colors.textMuted;
                const statusIcon = w.status === 'COMPLETED' ? 'checkmark-circle'
                  : w.status === 'PENDING' ? 'time-outline'
                  : w.status === 'REJECTED' ? 'close-circle'
                  : 'ellipse-outline';
                return (
                  <View key={`wd-${i}`} style={styles.historyRow}>
                    <View style={[styles.historyIconWrap, { backgroundColor: `${statusColor}18` }]}>
                      <Ionicons name={statusIcon as any} size={18} color={statusColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyTitle}>Withdrawal</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={styles.historyDate}>
                          {new Date(w.createdAt).toLocaleDateString('en-US', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </Text>
                        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                          <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                            {w.status}
                          </Text>
                        </View>
                      </View>
                      {w.toAddress && (
                        <Text style={styles.historyDate}>
                          To: {w.toAddress.slice(0, 8)}...{w.toAddress.slice(-4)}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.historyAmount, { color: Colors.error }]}>
                      -{fmt(w.amount)} USDT
                    </Text>
                  </View>
                );
              })
            )
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── USDT BEP20 Withdrawal Modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !submitting && setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="wallet-outline" size={22} color="#00D6A1" />
              </View>
              <Text style={styles.modalTitle}>Withdraw USDT</Text>
              <Text style={styles.modalSubtitle}>BEP20 (BNB Smart Chain)</Text>
            </View>

            {/* Available balance */}
            <View style={styles.modalBalanceRow}>
              <Text style={styles.modalBalanceLabel}>Available</Text>
              <Text style={styles.modalBalanceValue}>{fmt(availableToWithdraw)} USDT</Text>
            </View>

            {/* Address input */}
            <Text style={styles.modalInputLabel}>Receiving Address</Text>
            <View style={styles.modalInputWrap}>
              <Ionicons name="link-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.modalInput}
                placeholder="0x... (BEP20 address)"
                placeholderTextColor={Colors.textMuted}
                value={toAddress}
                onChangeText={setToAddress}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />
            </View>
            <Text style={styles.modalInputHint}>
              <Ionicons name="alert-circle-outline" size={11} color={Colors.warning} />
              {' '}Only send to a BEP20 (BSC) address. Sending to wrong network will lose funds.
            </Text>

            {/* Amount input */}
            <Text style={styles.modalInputLabel}>Amount (USDT)</Text>
            <View style={styles.modalInputWrap}>
              <Text style={styles.modalCurrencyTag}>$</Text>
              <TextInput
                style={[styles.modalInput, { fontSize: 20, fontWeight: '800' }]}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                editable={!submitting}
              />
              <TouchableOpacity
                style={styles.maxBtn}
                onPress={() => setWithdrawAmount(availableToWithdraw.toFixed(2))}
                disabled={submitting}
              >
                <Text style={styles.maxBtnText}>MAX</Text>
              </TouchableOpacity>
            </View>

            {/* Fee summary */}
            {numAmount > 0 && (
              <View style={styles.modalFeeCard}>
                <View style={styles.modalFeeRow}>
                  <Text style={styles.modalFeeLabel}>Gross Amount</Text>
                  <Text style={styles.modalFeeValue}>{numAmount.toFixed(2)} USDT</Text>
                </View>
                <View style={styles.modalFeeRow}>
                  <Text style={styles.modalFeeLabel}>Network Fee</Text>
                  <Text style={[styles.modalFeeValue, { color: Colors.error }]}>-{USDT_FEE} USDT</Text>
                </View>
                <View style={[styles.modalFeeRow, styles.modalFeeHighlight]}>
                  <Text style={styles.modalFeeLabel}>You Receive</Text>
                  <Text style={styles.modalFeeNet}>{netAmount.toFixed(2)} USDT</Text>
                </View>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setModalVisible(false)}
                disabled={submitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, (submitting || numAmount <= 0) && { opacity: 0.5 }]}
                onPress={handleSubmitWithdraw}
                disabled={submitting || numAmount <= 0}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="arrow-up-circle" size={18} color="#000" />
                    <Text style={styles.modalSubmitText}>Submit Request</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // History Tabs
  historyTabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.bgCard,
    borderRadius: 99,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  historyTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 99,
  },
  historyTabActive: {
    backgroundColor: '#00D6A1',
  },
  historyTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  historyTabTextActive: {
    color: '#000',
  },

  // Status badge
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

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

  // ── Withdraw Modal ──
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  modalSheet: {
    backgroundColor: '#0F0F0F',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.lg,
    borderTopWidth: 1,
    borderColor: 'rgba(0,214,161,0.15)',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: Spacing.md,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(0,214,161,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00D6A1',
    marginTop: 2,
  },
  modalBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,214,161,0.08)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,214,161,0.15)',
  },
  modalBalanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  modalBalanceValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#00D6A1',
  },
  modalInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginLeft: 4,
  },
  modalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 6,
  },
  modalInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  modalInputHint: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.warning,
    marginTop: 4,
    marginBottom: Spacing.md,
    marginLeft: 4,
  },
  modalCurrencyTag: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textMuted,
    marginRight: 6,
  },
  maxBtn: {
    backgroundColor: 'rgba(0,214,161,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  maxBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00D6A1',
  },
  modalFeeCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  modalFeeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  modalFeeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalFeeHighlight: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalFeeNet: {
    fontSize: 17,
    fontWeight: '900',
    color: '#00D6A1',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.lg,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  modalSubmitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: Radius.lg,
    backgroundColor: '#00D6A1',
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
});
