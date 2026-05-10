import React, { useState, useCallback, useLayoutEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
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
  ETH: 'cube-outline',
  BNB: 'cube',
  BTCB: 'logo-bitcoin',
  USDT: 'cash',
};

function CoinIcon({ symbol }: { symbol: string }) {
  const iconName = (COIN_ICONS[symbol?.toUpperCase()] || 'cube-outline') as any;
  return (
    <View style={styles.coinIconBg}>
      <Ionicons name={iconName} size={22} color={Colors.primary} />
    </View>
  );
}

function samePoolId(a: unknown, b: unknown) {
  return String(a) === String(b);
}

export default function PoolDetailScreen({ route, navigation }: any) {
  const { poolId } = route.params;
  const insets = useSafeAreaInsets();
  const [pool, setPool] = useState<any>(null);
  const [depositCredit, setDepositCredit] = useState(0);
  /** User's Loan credit (claimedPoolCreditUsd) — shown for context; claim fee uses deposit only. */
  const [userLoanCreditUsd, setUserLoanCreditUsd] = useState(0);
  const [canClaim, setCanClaim] = useState(false);
  const [packageMisconfigured, setPackageMisconfigured] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const id = String(poolId);
      const [poolRes, balRes, elRes] = await Promise.all([
        poolsAPI.detail(id),
        creditWalletAPI.balances().catch(() => null),
        creditWalletAPI.poolEligibility().catch(() => null),
      ]);
      const poolData = poolRes.data?.pool;
      setPool(poolData);
      const depBal = Number(balRes?.data?.balances?.depositCreditUsd ?? 0);
      const loanBal = Number(balRes?.data?.balances?.claimedPoolCreditUsd ?? 0);
      setDepositCredit(depBal);
      setUserLoanCreditUsd(loanBal);
      const row = elRes?.data?.pools?.find((p: any) => samePoolId(p.poolId, poolId));
      const feeUsd = claimFeeFromPool(poolData);
      const loanN = loanCreditFromPool(poolData);
      const loanOk = loanN != null && loanN > 0;
      const supportsPool = supportsAppCreditPool(poolData);
      const pkgBad =
        supportsPool && (row ? Boolean(row.packageMisconfigured) : !loanOk);
      setPackageMisconfigured(pkgBad);
      const apiSaysClaim = Boolean(row?.canClaimWithCredit);
      const localClaim =
        supportsPool &&
        (poolData?.status || 'ACTIVE') === 'ACTIVE' &&
        loanOk &&
        !pkgBad &&
        depBal + 1e-9 >= feeUsd;
      setCanClaim(apiSaysClaim || localClaim);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to load pool');
    }
  }, [poolId]);

  useLayoutEffect(() => {
    setPool(null);
  }, [poolId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onPullRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  if (!pool) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading pool…</Text>
      </View>
    );
  }

  const supports = supportsAppCreditPool(pool);
  const claimFee = claimFeeFromPool(pool);
  const loanCredit = loanCreditFromPool(pool);
  const members = pool._count?.members ?? pool.memberCount ?? 0;
  const depositForClaimFee = depositCredit;
  const needMoreFunds = supports && depositForClaimFee + 1e-9 < claimFee;
  const claimReady = supports && !packageMisconfigured && canClaim && !needMoreFunds;

  const goDeposit = () => {
    navigation.navigate('DepositReceive');
  };

  const handleClaim = () => {
    if (!canClaim || packageMisconfigured) {
      if (packageMisconfigured) {
        Alert.alert('Unavailable', 'This package is not fully configured. Try another pool or contact support.');
      }
      return;
    }
    const fee = claimFee;
    const loan = loanCredit ?? 0;
    Alert.alert(
      'Claim this package?',
      `Spend $${fee} from your Deposit wallet only (loan credit is not used for this fee). You receive $${loan.toLocaleString()} Loan credit after. Then open “Use your loan” on Home.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim',
          onPress: async () => {
            setClaiming(true);
            try {
              await poolsAPI.claimCredit(String(poolId));
              Alert.alert('Success', 'Loan credit added to your account.');
              await load();
            } catch (e: any) {
              Alert.alert('Claim failed', e?.response?.data?.error || e?.message || 'Error');
            } finally {
              setClaiming(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}
      >
        <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Pool details</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <CoinIcon symbol={pool.tokenSymbol} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.poolName}>{pool.name}</Text>
                <View style={styles.tokenRow}>
                  <Text style={styles.tokenSym}>{pool.tokenSymbol}</Text>
                  <View style={styles.dot} />
                  <Badge
                    label={pool.status || 'ACTIVE'}
                    variant={pool.status === 'ACTIVE' ? 'success' : 'warning'}
                  />
                </View>
              </View>
            </View>

            {supports && loanCredit != null && loanCredit > 0 ? (
              <View style={styles.loanHero}>
                <Text style={styles.loanHeroLabel}>Loan you get after claim</Text>
                <Text style={styles.loanHeroValue}>
                  ${loanCredit.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Text>
                <Text style={styles.loanHeroSub}>
                  Claim fee ${claimFee}: taken from your Deposit wallet only (loan credit is not used for the fee).
                </Text>
              </View>
            ) : (
              <View style={styles.loanHeroMuted}>
                <Text style={styles.loanHeroLabel}>Minimum / entry</Text>
                <Text style={styles.loanHeroValue}>${claimFee}</Text>
                {!supports && (
                  <Text style={styles.loanHeroSub}>
                    In-app claim is off — admin must enable “claim from Deposit wallet” for this pool. Your deposit
                    balance is separate; it does not turn on claim by itself.
                  </Text>
                )}
              </View>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statCell}>
                <Ionicons name="people-outline" size={16} color={Colors.primary} />
                <Text style={styles.statVal}>{members}</Text>
                <Text style={styles.statLab}>Members</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statCell}>
                <Ionicons name="layers-outline" size={16} color={Colors.primary} />
                <Text style={styles.statVal}>${Number(pool.totalStaked || 0).toLocaleString()}</Text>
                <Text style={styles.statLab}>TVL</Text>
              </View>
              {supports ? (
                <>
                  <View style={styles.statDivider} />
                  <View style={styles.statCell}>
                    <Ionicons name="wallet-outline" size={16} color={Colors.primary} />
                    <Text style={styles.statVal}>${depositForClaimFee.toFixed(0)}</Text>
                    <Text style={styles.statLab}>{CreditWalletCopy.poolDetailDepositStat}</Text>
                  </View>
                </>
              ) : null}
            </View>
            {supports && (depositCredit > 0 || userLoanCreditUsd > 0) ? (
              <Text style={styles.feeBreakdown}>
                Deposit ${depositCredit.toFixed(2)} · Loan credit ${userLoanCreditUsd.toFixed(2)} · Fee ${claimFee}
              </Text>
            ) : null}
          </View>
        </LinearGradient>

        {supports ? (
          <View style={styles.statusStrip}>
            <View style={styles.statusStripIconWrap}>
              <Ionicons
                name={packageMisconfigured ? 'alert-circle' : claimReady ? 'checkmark-circle' : 'wallet'}
                size={22}
                color={packageMisconfigured ? Colors.error : claimReady ? '#22c55e' : Colors.primary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.statusStripTitle}>Your account on this pack</Text>
              <Text style={styles.statusStripBody}>
                {packageMisconfigured
                  ? 'This pack is missing loan credit in admin settings — claim is blocked.'
                  : claimReady
                    ? `Ready to claim — deposit $${depositForClaimFee.toFixed(2)} (fee $${claimFee}).`
                    : needMoreFunds
                      ? `Deposit wallet $${depositForClaimFee.toFixed(2)} — unahitaji angalau $${claimFee} kwa ada (Deposit pekee).`
                      : canClaim
                        ? 'You can claim from this screen (see button below).'
                        : `Deposit $${depositForClaimFee.toFixed(2)} — sync eligibility; pull down to refresh.`}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.body}>
          {supports ? (
            <>
              <Text style={styles.sectionTitle}>How it works</Text>
              <View style={styles.stepCard}>
                <View style={styles.stepRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
                  <Text style={styles.stepText}>
                    {`Have at least $${claimFee} in your Deposit wallet (loan credit does not pay this fee). You can deposit USDT (BEP-20) to top up.`}
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
                  <Text style={styles.stepText}>
                    Tap Claim. The full fee comes from your Deposit wallet. New Loan credit from this pack is added on
                    the Loan tab on Home.
                  </Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
                  <Text style={styles.stepText}>
                    On Home, open “Use your loan” to choose BTC, ETH, or BNB for your position.
                  </Text>
                </View>
              </View>

              {pool.description ? (
                <View style={styles.noteCard}>
                  <Ionicons name="information-circle-outline" size={18} color={Colors.textMuted} />
                  <Text style={styles.noteText}>{pool.description}</Text>
                </View>
              ) : null}

              <View style={styles.warningCard}>
                <Ionicons name="warning-outline" size={18} color={Colors.primary} />
                <Text style={styles.warningText}>
                  Leverage and crypto exposure involve risk. Only use funds you can afford to lose.
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>
                This pool is not set up for in-app claim in the admin dashboard (supportsAppCredit). Until that is
                turned on, the app cannot charge the claim fee or credit Loan credit — even if your Deposit wallet
                would cover the fee.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {supports ? (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            },
          ]}
        >
          {needMoreFunds ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={goDeposit} activeOpacity={0.9}>
              <Ionicons name="add-circle-outline" size={22} color="#000" />
              <Text style={styles.btnPrimaryText}>Add deposit</Text>
              <Text style={styles.btnSub}>
                Need ${claimFee} deposit (have ${depositForClaimFee.toFixed(2)}) · USDT increases Deposit wallet
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnPrimary, (!canClaim || packageMisconfigured || claiming) && styles.btnDisabled]}
              onPress={handleClaim}
              disabled={!canClaim || packageMisconfigured || claiming}
              activeOpacity={0.9}
            >
              {claiming ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#000" />
                  <Text style={styles.btnPrimaryText}>Claim</Text>
                  <Text style={styles.btnSub}>
                    {packageMisconfigured
                      ? 'Package misconfigured'
                      : canClaim
                        ? `Fee $${claimFee} → Loan $${loanCredit?.toLocaleString() ?? '—'}`
                        : `Need $${claimFee} deposit (have $${depositForClaimFee.toFixed(2)})`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: Spacing.md, color: Colors.textSecondary, fontSize: FontSize.sm },

  headerGradient: { paddingBottom: Spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },

  hero: { marginHorizontal: Spacing.lg, gap: Spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  coinIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(240,185,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeBreakdown: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: -4,
  },
  poolName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tokenSym: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.textMuted },

  loanHero: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: 'rgba(240,185,11,0.12)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.25)',
  },
  loanHeroMuted: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  loanHeroLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  loanHeroValue: { fontSize: 40, fontWeight: '900', color: Colors.primary, marginTop: 6 },
  loanHeroSub: { fontSize: 13, color: Colors.textSecondary, marginTop: 6, textAlign: 'center', paddingHorizontal: Spacing.md },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4 },
  statVal: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  statLab: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  statDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.08)' },

  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },

  stepCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  stepRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(240,185,11,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  stepText: { flex: 1, fontSize: 14, color: Colors.textSecondary, lineHeight: 21 },

  noteCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.bgCard,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noteText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },

  warningCard: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(240,185,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.2)',
    marginBottom: Spacing.xl,
  },
  warningText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },

  statusStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusStripIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusStripTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statusStripBody: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 20,
  },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    elevation: 12,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { fontSize: 17, fontWeight: '900', color: '#000' },
  btnSub: { fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.65)', textAlign: 'center', paddingHorizontal: Spacing.md },
});
