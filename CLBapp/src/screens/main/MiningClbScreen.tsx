import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import {
  miningPackagesAPI,
  miningUserAPI,
  type MiningPackageDto,
  type MiningSubscriptionDto,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { computeMiningProgressLive, type MiningPeriodUnit } from '../../utils/miningProgress';

const STEPS = [
  {
    icon: 'water-outline' as const,
    title: 'Join pools',
    body: 'Deposit into leveraged pools. Your share grows as positions move with the market.',
  },
  {
    icon: 'trending-up-outline' as const,
    title: 'Build portfolio value',
    body: 'Your in-app portfolio is valued in USD from your active pool positions.',
  },
  {
    icon: 'hardware-chip-outline' as const,
    title: 'Mint CLB on-chain',
    body: 'Open your CLB wallet and sync — CLB is minted to your BSC wallet to match that value.',
  },
];

function periodLabel(length: number, unit: MiningPackageDto['periodUnit']): string {
  const plural = length !== 1;
  if (unit === 'MINUTE') return `${length} minute${plural ? 's' : ''}`;
  if (unit === 'HOUR') return `${length} hour${plural ? 's' : ''}`;
  return `${length} day${plural ? 's' : ''}`;
}

function formatTokenAmount(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n - Math.round(n)) < 1e-12) return String(Math.round(n));
  return n.toFixed(8).replace(/\.?0+$/, '');
}

function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function MiningClbScreen({ navigation }: { navigation: any }) {
  const { isAuthenticated, user } = useAuthStore();
  const [packages, setPackages] = useState<MiningPackageDto[]>([]);
  const [subscription, setSubscription] = useState<MiningSubscriptionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [pickPackage, setPickPackage] = useState<MiningPackageDto | null>(null);
  const [payoutInput, setPayoutInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [pkgRes, subRes] = await Promise.all([
        miningPackagesAPI.list(),
        isAuthenticated ? miningUserAPI.subscription().catch(() => ({ data: { subscription: null } })) : Promise.resolve({ data: { subscription: null } }),
      ]);
      setPackages(pkgRes.data?.packages ?? []);
      setSubscription(subRes.data?.subscription ?? null);
      setLoadError(null);
    } catch {
      setLoadError('Could not load mining packages.');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!subscription) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [subscription?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const openSubscribe = (p: MiningPackageDto) => {
    if (!isAuthenticated) {
      Alert.alert('Sign in required', 'Log in to activate a mining machine.');
      return;
    }
    setPickPackage(p);
    setPayoutInput(user?.walletAddress?.trim() ?? '');
    setModalOpen(true);
  };

  const confirmSubscribe = async () => {
    if (!pickPackage) return;
    const addr = payoutInput.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
      Alert.alert('Invalid address', 'Enter a valid BSC address (0x + 40 hex characters).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await miningUserAPI.subscribe({ packageId: pickPackage.id, payoutAddress: addr });
      setSubscription(res.data?.subscription ?? null);
      setModalOpen(false);
      setPickPackage(null);
      const msg = res.data?.upgraded ? 'Your mining machine was upgraded.' : 'Mining machine is now active.';
      Alert.alert('Success', msg);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Activation failed.';
      Alert.alert('Could not activate', String(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const liveMining = useMemo(() => {
    if (!subscription) return null;
    return computeMiningProgressLive(
      subscription.package.tokensPerPeriod,
      subscription.package.periodUnit as MiningPeriodUnit,
      subscription.package.periodLength,
      subscription.startedAt,
    );
  }, [subscription, tick]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIcon} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mine CLB</Text>
        <View style={styles.headerIcon} />
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {subscription && liveMining ? (
          <View style={styles.activeHero}>
            <View style={styles.activeHeroTop}>
              <View style={styles.pulseDot} />
              <Text style={styles.activeHeroLabel}>Mining in progress</Text>
            </View>
            <Text style={styles.activeMachineName}>{subscription.package.name}</Text>
            <Text style={styles.activeRate}>
              {formatTokenAmount(subscription.package.tokensPerPeriod)} {subscription.tokenSymbol} /{' '}
              {periodLabel(subscription.package.periodLength, subscription.package.periodUnit)}
            </Text>
            <Text style={styles.accruedLabel}>Accrued (off-chain)</Text>
            <Text style={styles.accruedValue}>
              {formatTokenAmount(liveMining.accruedTokens)} {subscription.tokenSymbol}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${liveMining.periodProgressPct}%` }]} />
            </View>
            <Text style={styles.progressHint}>
              Current cycle: {liveMining.periodProgressPct.toFixed(1)}% — next payout slice at 100%
            </Text>
            <View style={styles.payoutRow}>
              <Ionicons name="navigate-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.payoutText}>Payout {shortAddr(subscription.payoutAddress)}</Text>
            </View>
            <TouchableOpacity
              style={styles.changeMachineBtn}
              onPress={() => {
                setPickPackage(null);
                setModalOpen(true);
              }}
            >
              <Text style={styles.changeMachineText}>Change / upgrade machine</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="flash-outline" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.heroTitle}>Mining machines</Text>
            <Text style={styles.heroSub}>
              Pick a package and a payout address. Accrued tokens build over time by your machine rate (shown here and
              on the CLB Tokens screen). Upgrading resets the cycle timer for the new machine.
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>{subscription ? 'Other machines' : 'Mining machines'}</Text>
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color="#FF4757" />
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity onPress={() => { setLoading(true); loadAll(); }}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : packages.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="hardware-chip-outline" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No packages yet</Text>
            <Text style={styles.emptySub}>Check back soon — new mining tiers may be added from the admin panel.</Text>
          </View>
        ) : (
          packages.map((p) => {
            const isCurrent = subscription?.packageId === p.id;
            return (
              <View key={p.id} style={[styles.pkgCard, isCurrent && styles.pkgCardActive]}>
                <View style={styles.pkgHeader}>
                  <View style={styles.pkgIconBg}>
                    <Ionicons name="hardware-chip-outline" size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.pkgTitleRow}>
                      <Text style={styles.pkgName}>{p.name}</Text>
                      {isCurrent ? (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>Active</Text>
                        </View>
                      ) : null}
                    </View>
                    <View style={styles.pkgBadgeRow}>
                      <View style={styles.tokenBadge}>
                        <Text style={styles.tokenBadgeText}>{p.tokenSymbol}</Text>
                      </View>
                      {p.isFree ? (
                        <View style={styles.freeBadge}>
                          <Text style={styles.freeBadgeText}>Free</Text>
                        </View>
                      ) : (
                        <Text style={styles.priceText}>${Number(p.priceUsd ?? 0).toFixed(2)}</Text>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.rateRow}>
                  <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.rateText}>
                    {formatTokenAmount(p.tokensPerPeriod)} {p.tokenSymbol} / {periodLabel(p.periodLength, p.periodUnit)}
                  </Text>
                </View>
                {p.description ? <Text style={styles.pkgDesc}>{p.description}</Text> : null}
                <TouchableOpacity
                  style={[styles.useBtn, isCurrent && styles.useBtnMuted]}
                  onPress={() => openSubscribe(p)}
                  disabled={isCurrent}
                >
                  <Text style={[styles.useBtnText, isCurrent && styles.useBtnTextMuted]}>
                    {isCurrent ? 'Current machine' : 'Use this machine'}
                  </Text>
                  {!isCurrent ? <Ionicons name="arrow-forward" size={16} color="#000" /> : null}
                </TouchableOpacity>
              </View>
            );
          })
        )}

        <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>How sync works</Text>
        {STEPS.map((s, i) => (
          <View key={s.title} style={styles.stepCard}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{i + 1}</Text>
            </View>
            <View style={styles.stepBody}>
              <View style={styles.stepTitleRow}>
                <Ionicons name={s.icon} size={18} color={Colors.primary} />
                <Text style={styles.stepTitle}>{s.title}</Text>
              </View>
              <Text style={styles.stepDesc}>{s.body}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('WalletTokens')}
        >
          <LinearGradient colors={Colors.gradientGold} style={styles.primaryGradient}>
            <Ionicons name="wallet-outline" size={20} color="#000" />
            <Text style={styles.primaryText}>Open CLB wallet & sync</Text>
            <Ionicons name="arrow-forward" size={18} color="#000" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate('Main', { screen: 'Pools' })}
        >
          <Text style={styles.secondaryText}>Browse pools</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pickPackage ? pickPackage.name : 'Change / upgrade machine'}
            </Text>
            <Text style={styles.modalSub}>
              {pickPackage
                ? 'Enter the BSC address that should receive accrued mining payouts (off-chain display for now).'
                : 'Choose a package below after closing this sheet, or tap “Use this machine” on a card.'}
            </Text>
            {pickPackage ? (
              <>
                <Text style={styles.inputLabel}>Payout address (BSC)</Text>
                <TextInput
                  style={styles.input}
                  value={payoutInput}
                  onChangeText={setPayoutInput}
                  placeholder="0x…"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.modalPrimary}
                  onPress={confirmSubscribe}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.modalPrimaryText}>Confirm & activate</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.modalHint}>Close and tap “Use this machine” on any package.</Text>
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => { setModalOpen(false); setPickPackage(null); }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  hero: { marginBottom: Spacing.md },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(240,185,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 },
  heroSub: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, lineHeight: 21 },
  activeHero: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.35)',
  },
  activeHeroTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00D26A',
  },
  activeHeroLabel: { fontSize: 12, fontWeight: '800', color: '#00D26A', letterSpacing: 0.5 },
  activeMachineName: { fontSize: 20, fontWeight: '900', color: Colors.textPrimary },
  activeRate: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginTop: 4 },
  accruedLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginTop: Spacing.md },
  accruedValue: { fontSize: 28, fontWeight: '900', color: Colors.primary, marginTop: 2 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#00D26A',
  },
  progressHint: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  payoutRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md },
  payoutText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  changeMachineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  changeMachineText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  loaderWrap: { paddingVertical: Spacing.lg, alignItems: 'center' },
  errorCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
    alignItems: 'center',
  },
  errorText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center' },
  retryText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  emptyCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  emptySub: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 19 },
  pkgCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pkgCardActive: { borderColor: 'rgba(0,210,106,0.35)' },
  pkgHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  pkgIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(240,185,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pkgTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pkgName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0,210,106,0.15)',
  },
  currentBadgeText: { fontSize: 10, fontWeight: '800', color: '#00D26A' },
  pkgBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  tokenBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(59,130,246,0.15)',
  },
  tokenBadgeText: { fontSize: 11, fontWeight: '800', color: '#3B82F6' },
  freeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,210,106,0.12)',
  },
  freeBadgeText: { fontSize: 11, fontWeight: '800', color: '#00D26A' },
  priceText: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  rateText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, flex: 1 },
  pkgDesc: { fontSize: 12, color: Colors.textMuted, marginTop: Spacing.sm, lineHeight: 17 },
  useBtn: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: Radius.md,
  },
  useBtnMuted: { backgroundColor: 'rgba(255,255,255,0.08)' },
  useBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
  useBtnTextMuted: { color: Colors.textMuted },
  stepCard: {
    flexDirection: 'row',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(240,185,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  stepBody: { flex: 1 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  stepTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  stepDesc: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, lineHeight: 19 },
  primaryBtn: { marginTop: Spacing.lg, borderRadius: Radius.lg, overflow: 'hidden' },
  primaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: Spacing.lg,
  },
  primaryText: { fontSize: 16, fontWeight: '800', color: '#000' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  secondaryText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: 32,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  modalSub: { fontSize: 13, color: Colors.textMuted, marginTop: 8, lineHeight: 19 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginTop: Spacing.md },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: Colors.bg,
  },
  modalPrimary: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  modalPrimaryText: { fontSize: 16, fontWeight: '800', color: '#000' },
  modalCancel: { marginTop: Spacing.md, alignItems: 'center', padding: Spacing.sm },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: Colors.textMuted },
  modalHint: { fontSize: 13, color: Colors.textMuted, marginTop: Spacing.md },
});
