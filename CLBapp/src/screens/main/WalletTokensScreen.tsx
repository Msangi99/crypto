import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Image, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadow } from '../../constants/theme';
import { tokensAPI, miningUserAPI, type MiningSubscriptionDto } from '../../services/api';
import { computeMiningProgressLive, type MiningPeriodUnit } from '../../utils/miningProgress';
import { useAuthStore } from '../../store/authStore';
import { useOnChainWallet, type OnChainAsset } from '../../hooks/useOnChainWallet';

type SyncStatus = {
  walletAddress: string;
  portfolioValueUsd: number;
  onChainCLBBalance: number;
  onChainCLBValueUsd: number;
  gapUsd: number;
  mintableClb: number;
  inSync: boolean;
  minSyncGapUsd: number;
  clbPriceUsd: number;
  chainConfigured: boolean;
};

type AppTokenRow = {
  token: string;
  balance: number;
  locked: number;
  available: number;
  miningAccrued?: number;
  totalBalance?: number;
  totalAvailable?: number;
  priceUsd: number;
  valueUsd: number;
  valueUsdTotal?: number;
};

const CLB_FAMILY_ORDER = ['CLB', 'CLBs', 'CLBg'] as const;

const CLB_LOGO = require('../../../assets/clb-token.png');

const ASSET_META: Record<string, { color: string; icon: string }> = {
  BNB:  { color: '#F0B90B', icon: 'cube' },
  USDT: { color: '#26A17B', icon: 'cash' },
  BUSD: { color: '#F0B90B', icon: 'cash' },
  USDC: { color: '#2775CA', icon: 'cash' },
  CLBg: { color: '#F0B90B', icon: 'diamond' },
  CLBs: { color: '#C0C0C0', icon: 'flash' },
  CLB:  { color: '#3B82F6', icon: 'cube' },
};

function formatBalance(value: number): string {
  if (value === 0) return '0';
  if (value < 0.0001) return '<0.0001';
  if (value < 1) return value.toFixed(4);
  if (value < 1000) return value.toFixed(4);
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortAddress(addr?: string | null): string {
  if (!addr || addr.length < 10) return addr ?? '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletTokensScreen({ navigation }: any) {
  const { user, isAuthenticated } = useAuthStore();
  const walletAddress = user?.walletAddress ?? null;

  const {
    assets,
    isLoading: isLoadingChain,
    isRefetching,
    refetch,
  } = useOnChainWallet(walletAddress);

  const [history, setHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [miningSub, setMiningSub] = useState<MiningSubscriptionDto | null>(null);
  const [miningTick, setMiningTick] = useState(0);
  const [appTokenRows, setAppTokenRows] = useState<AppTokenRow[] | null>(null);
  const [claimingMining, setClaimingMining] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setHistory([]);
      return;
    }
    try {
      const res = await tokensAPI.history(1, 10);
      setHistory(res.data?.transfers ?? []);
    } catch {
      // Silent — wallet view should still work without history.
    }
  }, [isAuthenticated]);

  const loadSyncStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setSyncStatus(null);
      return;
    }
    try {
      const res = await tokensAPI.syncStatus();
      setSyncStatus(res.data?.sync ?? null);
    } catch {
      setSyncStatus(null);
    }
  }, [isAuthenticated]);

  const loadMiningSub = useCallback(async () => {
    if (!isAuthenticated) {
      setMiningSub(null);
      return;
    }
    try {
      const res = await miningUserAPI.subscription();
      setMiningSub(res.data?.subscription ?? null);
    } catch {
      setMiningSub(null);
    }
  }, [isAuthenticated]);

  const loadAppBalances = useCallback(async () => {
    if (!isAuthenticated) {
      setAppTokenRows(null);
      return;
    }
    try {
      const res = await tokensAPI.balances();
      const list: AppTokenRow[] = (res.data?.balances ?? []) as AppTokenRow[];
      setAppTokenRows(list);
    } catch {
      setAppTokenRows(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadHistory();
    loadSyncStatus();
    loadMiningSub();
    loadAppBalances();
  }, [loadHistory, loadSyncStatus, loadMiningSub, loadAppBalances]);

  useEffect(() => {
    if (!miningSub) return;
    const t = setInterval(() => setMiningTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [miningSub?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetch(), loadHistory(), loadSyncStatus(), loadMiningSub(), loadAppBalances()]);
    setRefreshing(false);
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await tokensAPI.syncPortfolio();
      const data = res.data ?? {};
      if (data.alreadyInSync) {
        Alert.alert(
          'Already in sync',
          'Your on-chain CLB balance already matches your portfolio value.',
        );
      } else {
        const minted = Number(data.minted ?? 0);
        const txHash = data.txHash as string | undefined;
        const explorerUrl = data.explorerUrl as string | undefined;
        Alert.alert(
          'Synced to wallet',
          `Minted ${minted.toFixed(2)} CLB to your wallet. Open Trust Wallet to view.`,
          [
            ...(explorerUrl
              ? [{
                  text: 'View on BscScan',
                  onPress: () => Linking.openURL(explorerUrl),
                }]
              : []),
            { text: 'OK', style: 'default' as const },
          ],
        );
        // Re-read on-chain balances + sync status so the UI updates.
        await Promise.all([refetch(), loadSyncStatus(), loadAppBalances()]);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        'Sync failed.';
      Alert.alert('Sync failed', msg);
    } finally {
      setIsSyncing(false);
    }
  };

  // Order: native first, then non-zero balances by USD value desc, then empty.
  const sortedAssets = [...assets].sort((a, b) => {
    if (a.isNative && !b.isNative) return -1;
    if (!a.isNative && b.isNative) return 1;
    const aHas = a.balance > 0 ? 1 : 0;
    const bHas = b.balance > 0 ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    return b.valueUsd - a.valueUsd;
  });

  const renderAsset = ({ item }: { item: OnChainAsset }) => {
    const meta = ASSET_META[item.symbol] || { color: Colors.primary, icon: 'cube' };
    const isClb = item.tier === 'CLB';
    const change = item.change24h;
    return (
      <View style={styles.assetCard}>
        <View style={styles.assetRow}>
          <View style={[styles.assetIconBg, { backgroundColor: meta.color + '18' }]}>
            {isClb ? (
              <Image source={CLB_LOGO} style={styles.assetLogo} resizeMode="contain" />
            ) : (
              <Ionicons name={meta.icon as any} size={20} color={meta.color} />
            )}
          </View>
          <View style={styles.assetInfo}>
            <View style={styles.assetTitleRow}>
              <Text style={styles.assetSymbol}>{item.symbol}</Text>
              <View style={styles.assetTierBadge}>
                <Text style={styles.assetTierText}>{item.tier}</Text>
              </View>
            </View>
            <Text style={styles.assetName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.assetPriceLine}>
              {item.priceUsd > 0 ? `${formatUsd(item.priceUsd)} per ${item.symbol}` : 'Price unavailable'}
              {typeof change === 'number' && Math.abs(change) > 0.001 ? (
                <Text style={[styles.assetChange, change >= 0 ? styles.changeUp : styles.changeDown]}>
                  {`  ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
                </Text>
              ) : null}
            </Text>
          </View>
          <View style={styles.assetValues}>
            <Text style={styles.assetBalance}>{formatBalance(item.balance)}</Text>
            <Text style={styles.assetUsd}>{formatUsd(item.valueUsd)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderHistoryItem = ({ item }: { item: any }) => {
    const isOut = item.direction === 'OUT';
    return (
      <View style={styles.historyItem}>
        <View style={[styles.historyIcon, { backgroundColor: isOut ? 'rgba(255,71,87,0.1)' : 'rgba(0,210,106,0.1)' }]}>
          <Ionicons name={isOut ? 'arrow-up' : 'arrow-down'} size={16} color={isOut ? '#FF4757' : '#00D26A'} />
        </View>
        <View style={styles.historyInfo}>
          <Text style={styles.historyType}>{String(item.type).replace('_', ' ')}</Text>
          <Text style={styles.historyCounterparty}>{item.counterparty}</Text>
        </View>
        <View style={styles.historyAmountCol}>
          <Text style={[styles.historyAmount, { color: isOut ? '#FF4757' : '#00D26A' }]}>
            {isOut ? '-' : '+'}{Number(item.amount).toFixed(2)}
          </Text>
          <Text style={styles.historyToken}>{item.token}</Text>
        </View>
      </View>
    );
  };

  const miningLive = useMemo(() => {
    if (!miningSub) return null;
    return computeMiningProgressLive(
      miningSub.package.tokensPerPeriod,
      miningSub.package.periodUnit as MiningPeriodUnit,
      miningSub.package.periodLength,
      miningSub.startedAt,
    );
  }, [miningSub, miningTick]);

  const appTokenBySymbol = useMemo(() => {
    const m: Record<string, AppTokenRow> = {};
    (appTokenRows ?? []).forEach((r) => { m[r.token] = r; });
    return m;
  }, [appTokenRows]);

  const appTokenTotalUsd = useMemo(
    () =>
      CLB_FAMILY_ORDER.reduce((s, t) => {
        const r = appTokenBySymbol[t];
        const v = r?.valueUsdTotal ?? r?.valueUsd ?? 0;
        return s + v;
      }, 0),
    [appTokenBySymbol],
  );

  const handleClaimMining = async () => {
    if (claimingMining) return;
    setClaimingMining(true);
    try {
      const res = await miningUserAPI.claim();
      const claimed = res.data?.claimed ?? 0;
      const tok = res.data?.token ?? 'CLB';
      Alert.alert(
        'Claimed',
        `${claimed.toFixed(6)} ${tok} moved to your in-app balance. You can transfer after claiming.`,
      );
      await Promise.all([loadAppBalances(), loadMiningSub()]);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Claim failed';
      Alert.alert('Claim', String(msg));
    } finally {
      setClaimingMining(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={sortedAssets}
        keyExtractor={(item) => item.symbol}
        renderItem={renderAsset}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isRefetching}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Wallet</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.backBtn} disabled={isRefetching}>
                <Ionicons
                  name="refresh"
                  size={22}
                  color={isRefetching ? Colors.textMuted : Colors.textPrimary}
                />
              </TouchableOpacity>
            </LinearGradient>

            {/* Pool portfolio + in-app CLB family USD */}
            <View style={styles.portfolioCard}>
              <View style={styles.portfolioHero}>
                <View style={styles.totalLabelRow}>
                  <Ionicons name="pie-chart" size={14} color={Colors.primary} />
                  <Text style={styles.totalLabel}>Pool portfolio value</Text>
                </View>
                <Text style={styles.portfolioHeroValue}>
                  {isAuthenticated && syncStatus
                    ? formatUsd(syncStatus.portfolioValueUsd)
                    : '—'}
                </Text>
                <Text style={styles.portfolioHeroHint}>
                  {isAuthenticated
                    ? 'USD value of your active pool positions (leveraged)'
                    : 'Sign in to see your pool portfolio'}
                </Text>
              </View>
              <View style={styles.portfolioDivider} />
              <Text style={styles.appTokenSectionLabel}>CLB token value (in app)</Text>
              <Text style={styles.appTokenHint}>
                Includes mined tokens (off-chain accrual) until you claim — then they live in your ledger balance for transfer.
              </Text>
              {isAuthenticated && appTokenRows
                ? CLB_FAMILY_ORDER.map((sym) => {
                  const row = appTokenBySymbol[sym];
                  const totalBal = row?.totalBalance ?? row?.balance ?? 0;
                  const val = row?.valueUsdTotal ?? row?.valueUsd ?? 0;
                  const ledgerBal = row?.balance ?? 0;
                  const miningExtra = row?.miningAccrued ?? 0;
                  const meta = ASSET_META[sym] || { color: Colors.primary, icon: 'cube' };
                  return (
                    <View key={sym} style={styles.appTokenRow}>
                      <View style={styles.appTokenLeft}>
                        <View style={[styles.appTokenDot, { backgroundColor: meta.color + '44' }]} />
                        <View>
                          <Text style={styles.appTokenSymbol}>{sym}</Text>
                          <Text style={styles.appTokenBal}>
                            {formatBalance(totalBal)} {sym}
                            {miningExtra > 0 ? (
                              <Text style={styles.appTokenLedgerNote}>
                                {' '}· ledger {formatBalance(ledgerBal)}
                              </Text>
                            ) : null}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.appTokenUsd}>{formatUsd(val)}</Text>
                    </View>
                  );
                })
                : (
                  <Text style={styles.appTokenPlaceholder}>
                    {isAuthenticated ? 'Loading balances…' : 'Sign in to see CLB, CLBs & CLBg'}
                  </Text>
                )}
              {isAuthenticated && appTokenRows ? (
                <View style={styles.appTokenFooter}>
                  <Text style={styles.appTokenFooterLabel}>Total CLB family (app)</Text>
                  <Text style={styles.appTokenFooterUsd}>{formatUsd(appTokenTotalUsd)}</Text>
                </View>
              ) : null}
            </View>

            {isAuthenticated && miningSub && miningLive ? (
              <View style={styles.miningCard}>
                <View style={styles.miningHeader}>
                  <View style={styles.miningIconBg}>
                    <Ionicons name="hardware-chip-outline" size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.miningTitle}>Mining in progress</Text>
                    <Text style={styles.miningSub} numberOfLines={1}>{miningSub.package.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => navigation.navigate('MiningClb')} hitSlop={8}>
                    <Text style={styles.miningLink}>Manage</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.miningAccrued}>
                  {formatBalance(miningLive.accruedTokens)} {miningSub.tokenSymbol} accrued (off-chain)
                </Text>
                <View style={styles.miningTrack}>
                  <View style={[styles.miningFill, { width: `${Math.min(100, miningLive.periodProgressPct)}%` }]} />
                </View>
                <TouchableOpacity
                  style={styles.claimMiningBtn}
                  onPress={handleClaimMining}
                  disabled={claimingMining || (miningLive?.accruedTokens ?? 0) <= 0}
                  activeOpacity={0.85}
                >
                  {claimingMining ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.claimMiningText}>Claim to in-app balance</Text>
                  )}
                </TouchableOpacity>
                <View style={styles.miningPayoutRow}>
                  <Ionicons name="navigate-outline" size={12} color={Colors.textMuted} />
                  <Text style={styles.miningPayout}>Payout {shortAddress(miningSub.payoutAddress)}</Text>
                </View>
              </View>
            ) : null}

            {/* Portfolio sync card — keeps Trust Wallet CLB balance equal to
                the user's CLB DApp portfolio value via on-chain mints. */}
            {isAuthenticated && syncStatus ? (
              <View style={styles.syncCard}>
                <View style={styles.syncHeaderRow}>
                  <View style={styles.syncIconBg}>
                    <Ionicons name="sync-circle" size={20} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.syncTitle}>Portfolio in Wallet</Text>
                    <Text style={styles.syncSubtitle}>
                      Mint your CLB portfolio to Trust Wallet
                    </Text>
                  </View>
                  {syncStatus.inSync ? (
                    <View style={styles.syncBadgeOk}>
                      <Ionicons name="checkmark-circle" size={12} color="#00D26A" />
                      <Text style={styles.syncBadgeOkText}>In sync</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.syncRow}>
                  <View style={styles.syncCol}>
                    <Text style={styles.syncColLabel}>App portfolio</Text>
                    <Text style={styles.syncColValue}>
                      {formatUsd(syncStatus.portfolioValueUsd)}
                    </Text>
                  </View>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={Colors.textMuted}
                    style={{ marginHorizontal: 8 }}
                  />
                  <View style={styles.syncCol}>
                    <Text style={styles.syncColLabel}>On-chain CLB</Text>
                    <Text style={styles.syncColValue}>
                      {formatUsd(syncStatus.onChainCLBValueUsd)}
                    </Text>
                  </View>
                </View>

                {!syncStatus.chainConfigured ? (
                  <View style={styles.syncNote}>
                    <Ionicons name="information-circle-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.syncNoteText}>
                      On-chain minting not configured on the server yet.
                    </Text>
                  </View>
                ) : syncStatus.inSync ? (
                  <View style={styles.syncNote}>
                    <Ionicons name="checkmark-circle-outline" size={12} color="#00D26A" />
                    <Text style={styles.syncNoteText}>
                      Your wallet already shows your full portfolio value.
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={handleSync}
                    disabled={isSyncing}
                    activeOpacity={0.85}
                    style={styles.syncBtnWrap}
                  >
                    <LinearGradient
                      colors={Colors.gradientPrimary}
                      style={styles.syncBtn}
                    >
                      {isSyncing ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload" size={16} color="#000" />
                          <Text style={styles.syncBtnText}>
                            Sync {syncStatus.mintableClb.toFixed(2)} CLB to Wallet
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('LoanRequest')}
              >
                <LinearGradient colors={Colors.gradientPrimary} style={styles.actionGradient}>
                  <Ionicons name="cash" size={20} color="#000" />
                  <Text style={styles.actionText}>Get Loan</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('TransferTokens')}
              >
                <View style={styles.actionOutline}>
                  <Ionicons name="send" size={20} color={Colors.primary} />
                  <Text style={styles.actionOutlineText}>Transfer</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('Withdraw')}
              >
                <View style={styles.actionOutline}>
                  <Ionicons name="download" size={20} color={Colors.primary} />
                  <Text style={styles.actionOutlineText}>Withdraw</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Assets</Text>
              <Text style={styles.sectionSub}>On-chain · BSC</Text>
            </View>
          </>
        }
        ListFooterComponent={
          history.length > 0 ? (
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {history.map((item) => (
                <View key={item.id}>{renderHistoryItem({ item })}</View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoadingChain ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No assets to show</Text>
              <Text style={styles.emptySubtext}>Pull down to refresh</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  listContent: { paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg,
  },
  backBtn: { padding: 4, width: 32, alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },

  portfolioCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.22)',
    ...Shadow.card,
  },
  portfolioHero: { alignItems: 'center' },
  portfolioHeroValue: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.primary,
    marginTop: 6,
    letterSpacing: -0.5,
  },
  portfolioHeroHint: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 16,
    paddingHorizontal: Spacing.sm,
  },
  portfolioDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  appTokenSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  appTokenHint: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  appTokenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  appTokenLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appTokenDot: { width: 8, height: 8, borderRadius: 4 },
  appTokenSymbol: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  appTokenBal: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },
  appTokenLedgerNote: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary },
  appTokenUsd: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  appTokenPlaceholder: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    paddingVertical: Spacing.sm,
  },
  appTokenFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  appTokenFooterLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  appTokenFooterUsd: { fontSize: 15, fontWeight: '900', color: Colors.primary },

  totalLabelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  totalLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },

  miningCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.25)',
  },
  miningHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  miningIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(240,185,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miningTitle: { fontSize: 11, fontWeight: '800', color: '#00D26A', letterSpacing: 0.4 },
  miningSub: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginTop: 2 },
  miningLink: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  miningAccrued: { fontSize: 18, fontWeight: '900', color: Colors.primary, marginTop: Spacing.sm },
  miningTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  miningFill: { height: '100%', borderRadius: 3, backgroundColor: '#00D26A' },
  miningPayoutRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  miningPayout: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  claimMiningBtn: {
    marginTop: Spacing.sm,
    alignSelf: 'stretch',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  claimMiningText: { fontSize: 13, fontWeight: '800', color: '#000' },

  // Portfolio sync card
  syncCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.2)',
    gap: Spacing.md,
  },
  syncHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  syncIconBg: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: 'rgba(240,185,11,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  syncTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  syncSubtitle: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  syncBadgeOk: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
    backgroundColor: 'rgba(0,210,106,0.1)',
  },
  syncBadgeOkText: { fontSize: 10, fontWeight: '800', color: '#00D26A' },
  syncRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: Radius.md,
  },
  syncCol: { flex: 1, gap: 2 },
  syncColLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase' },
  syncColValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  syncNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    paddingHorizontal: 4,
  },
  syncNoteText: { flex: 1, fontSize: 11, fontWeight: '600', color: Colors.textMuted, lineHeight: 16 },
  syncBtnWrap: { borderRadius: Radius.lg, overflow: 'hidden' },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12,
  },
  syncBtnText: { fontSize: 13, fontWeight: '800', color: '#000' },

  actions: {
    flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg,
  },
  actionBtn: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  actionGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 6, borderRadius: Radius.lg,
  },
  actionText: { fontSize: 14, fontWeight: '800', color: '#000' },
  actionOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 6, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: 'rgba(240,185,11,0.3)',
    backgroundColor: 'rgba(240,185,11,0.04)',
  },
  actionOutlineText: { fontSize: 14, fontWeight: '800', color: Colors.primary },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: Colors.textPrimary,
  },
  sectionSub: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },

  assetCard: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  assetIconBg: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  assetLogo: { width: 32, height: 32, borderRadius: 8 },
  assetInfo: { flex: 1, gap: 2 },
  assetTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assetSymbol: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  assetTierBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  assetTierText: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.4 },
  assetName: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  assetPriceLine: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  assetChange: { fontSize: 11, fontWeight: '800' },
  changeUp: { color: '#00D26A' },
  changeDown: { color: '#FF4757' },
  assetValues: { alignItems: 'flex-end' },
  assetBalance: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  assetUsd: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },

  historySection: { marginTop: Spacing.lg },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  historyIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  historyInfo: { flex: 1 },
  historyType: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize' },
  historyCounterparty: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  historyAmountCol: { alignItems: 'flex-end' },
  historyAmount: { fontSize: 14, fontWeight: '800' },
  historyToken: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  emptySubtext: { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
});
