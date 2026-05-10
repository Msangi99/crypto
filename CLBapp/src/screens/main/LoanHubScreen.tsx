import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { creditWalletAPI, loansAPI, priceAPI } from '../../services/api';

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

  useEffect(() => {
    const u = navigation.addListener('focus', load);
    load();
    return u;
  }, [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const [showLeverageModal, setShowLeverageModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [entryAmount, setEntryAmount] = useState('');
  const [prices, setPrices] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    priceAPI.current().then(r => setPrices(r.data?.prices || r.data));
  }, []);

  const openLoanFor = (symbol: string) => {
    navigation.navigate('LoanRequest', { preferredAsset: symbol });
  };

  const openLeverageFor = (symbol: string) => {
    setSelectedAsset(symbol);
    setShowLeverageModal(true);
  };

  const getLeverage = (amount: number) => {
    const tiers: Record<number, number> = {
      100: 10, 200: 15, 300: 20, 400: 25, 500: 30,
      600: 35, 700: 40, 800: 45, 900: 50, 1000: 60,
    };
    const sorted = Object.keys(tiers).map(Number).sort((a, b) => b - a);
    for (const tier of sorted) {
      if (amount >= tier) return tiers[tier];
    }
    return 10;
  };

  const handleLeverageSubmit = async () => {
    const amount = parseFloat(entryAmount);
    if (!amount || amount < 100) {
      Alert.alert('Minimum $100', 'Entry fee must be at least $100');
      return;
    }
    if (amount > loanUsd) {
      Alert.alert('Insufficient Credit', `You only have $${loanUsd.toFixed(2)} loan credit`);
      return;
    }
    if (!selectedAsset) return;

    setSubmitting(true);
    try {
      const res = await loansAPI.enterPoolCredit({
        asset: selectedAsset as 'BTC' | 'ETH' | 'BNB',
        entryFeeUsd: amount,
      });
      Alert.alert(
        'Position Opened!',
        `${res.data.loan.leverage}x ${selectedAsset} position worth $${res.data.loan.positionValueUsd.toLocaleString()}`,
        [{ text: 'View My Loans', onPress: () => navigation.navigate('MyLoans') }]
      );
      setShowLeverageModal(false);
      setEntryAmount('');
      load(); // refresh balance
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to open position');
    } finally {
      setSubmitting(false);
    }
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
          After you claim a pool, your loan credit appears here. Use it to enter leveraged positions (BTC, ETH, BNB) or get a collateral-backed loan.
        </Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Loan Credit Available</Text>
          <Text style={styles.balanceValue}>
            ${loanUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <Text style={styles.balanceHint}>Use this credit for leveraged positions below</Text>
        </View>

        <Text style={styles.sectionTitle}>Enter Leveraged Pool (Use Credit)</Text>
        <Text style={styles.sectionSub}>Pay entry fee from loan credit → Get leveraged crypto position</Text>
        {ASSETS.map((a) => (
          <TouchableOpacity
            key={`lev-${a.symbol}`}
            style={[styles.assetRow, styles.leverageRow]}
            onPress={() => openLeverageFor(a.symbol)}
            activeOpacity={0.85}
          >
            <View style={[styles.assetIcon, { backgroundColor: a.color + '22' }]}>
              <Ionicons name={a.icon as any} size={26} color={a.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.assetName}>{a.name}</Text>
              <Text style={styles.assetSub}>Use credit for {a.symbol} position</Text>
            </View>
            <View style={styles.leverageBadge}>
              <Text style={styles.leverageText}>10x-60x</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>Or: Collateral Loan (Deposit Crypto)</Text>
        <Text style={styles.sectionSub}>Deposit your own BTC/ETH/BNB → Get CLB tokens</Text>

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
              Add USDT deposit, then open a pool from Liquidity Pools and tap Claim to receive loan credit. Then use that credit to enter leveraged positions above.
            </Text>
            <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate('Main', { screen: 'Pools' })}>
              <Text style={styles.linkBtnText}>Go to pools</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Leverage Entry Modal */}
        <Modal visible={showLeverageModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Enter {selectedAsset} Position</Text>
                <TouchableOpacity onPress={() => setShowLeverageModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalLabel}>Entry Fee (from loan credit)</Text>
              <TextInput
                style={styles.input}
                placeholder="Min $100"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
                value={entryAmount}
                onChangeText={setEntryAmount}
              />

              {(() => {
                const amt = parseFloat(entryAmount) || 0;
                if (amt < 100 || !selectedAsset) return null;
                const lev = getLeverage(amt);
                const posValue = amt * lev;
                const price = prices?.[selectedAsset.toLowerCase()]?.usd || 0;
                const cryptoAmt = price > 0 ? posValue / price : 0;
                return (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewText}>Leverage: <Text style={styles.previewValue}>{lev}x</Text></Text>
                    <Text style={styles.previewText}>Position Value: <Text style={styles.previewValue}>${posValue.toLocaleString()}</Text></Text>
                    <Text style={styles.previewText}>{selectedAsset} Amount: <Text style={styles.previewValue}>{cryptoAmt.toFixed(6)}</Text></Text>
                    <Text style={styles.previewHint}>Platform holds this {selectedAsset} until target price</Text>
                  </View>
                );
              })()}

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleLeverageSubmit}
                disabled={submitting}
              >
                <Text style={styles.submitBtnText}>
                  {submitting ? 'Opening...' : 'Open Position'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(240,185,11,0.1)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.3)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  sectionSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
    marginTop: -Spacing.sm,
  },
  leverageRow: {
    borderColor: Colors.primary + '40',
  },
  leverageBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  leverageText: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.textPrimary,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  previewBox: {
    backgroundColor: 'rgba(0,210,106,0.1)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,210,106,0.3)',
  },
  previewText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  previewValue: {
    color: Colors.success,
    fontWeight: '700',
  },
  previewHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    fontStyle: 'italic',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
});
