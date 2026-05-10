import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { creditWalletAPI } from '../../services/api';

const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', icon: 'logo-bitcoin' as const, color: '#F7931A' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'logo-ethereum' as const, color: '#627EEA' },
  { symbol: 'BNB', name: 'BNB', icon: 'cube' as const, color: '#F0B90B' },
];

export default function LoanHubScreen({ navigation }: any) {
  const [loanUsd, setLoanUsd] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await creditWalletAPI.balances();
      const b = res.data?.balances;
      setLoanUsd(Number(b?.claimedPoolCreditUsd ?? 0));
    } catch {
      setLoanUsd(0);
    }
  }, []);

  React.useEffect(() => {
    const u = navigation.addListener('focus', load);
    load();
    return u;
  }, [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openLoanFor = (symbol: string) => {
    navigation.navigate('LoanRequest', { preferredAsset: symbol });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Use your loan</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lead}>
          After you claim a pool, your loan credit appears here. Choose an asset to route your position (BTC, ETH, or BNB).
        </Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Loan balance</Text>
          <Text style={styles.balanceValue}>
            ${loanUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.balanceHint}>From pool packages you claimed with deposit credit.</Text>
        </View>

        <Text style={styles.sectionTitle}>Hold / use loan against</Text>
        {ASSETS.map((a) => (
          <TouchableOpacity
            key={a.symbol}
            style={styles.assetRow}
            onPress={() => openLoanFor(a.symbol)}
            activeOpacity={0.85}
          >
            <View style={[styles.assetIcon, { backgroundColor: a.color + '22' }]}>
              <Ionicons name={a.icon as any} size={26} color={a.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.assetName}>{a.name}</Text>
              <Text style={styles.assetSub}>Open loan flow with {a.symbol}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}

        {loanUsd <= 0 && (
          <View style={styles.emptyBox}>
            <Ionicons name="wallet-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No loan credit yet</Text>
            <Text style={styles.emptyText}>
              Add USDT deposit, then open a pool from Liquidity Pools and tap Claim to receive loan balance.
            </Text>
            <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Main', { screen: 'Pools' })}>
              <Text style={styles.linkBtnText}>Go to pools</Text>
            </TouchableOpacity>
          </View>
        )}
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
    paddingTop: 56,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  scroll: { padding: Spacing.lg, paddingBottom: 48 },
  lead: { fontSize: 14, color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.lg },
  balanceCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  balanceLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  balanceValue: { fontSize: 36, fontWeight: '900', color: Colors.primary, marginTop: 8 },
  balanceHint: { fontSize: 12, color: Colors.textMuted, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  assetIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  assetSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  emptyBox: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: { fontSize: FontSize.md, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  linkBtn: { marginTop: Spacing.md, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: Colors.primary, borderRadius: Radius.md },
  linkBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
});
