import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { poolsAPI, userAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

// Pool deposit address (BSC) — replace with actual pool smart contract or treasury
const POOL_DEPOSIT_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18';

// Leverage tiers from PDF
const TIER_LEVERAGE: Record<number, number> = {
  100: 10, 200: 15, 300: 20, 400: 25, 500: 30,
  600: 35, 700: 40, 800: 45, 900: 50, 1000: 60,
};

function getLeverage(depositUsd: number): number {
  const tiers = Object.keys(TIER_LEVERAGE).map(Number).sort((a, b) => b - a);
  for (const tier of tiers) {
    if (depositUsd >= tier) return TIER_LEVERAGE[tier];
  }
  return 1;
}

export default function PoolDetailScreen({ route, navigation }: any) {
  const { poolId } = route.params;
  const { user } = useAuthStore();
  const [pool, setPool] = useState<any>(null);
  const [bnbPrice, setBnbPrice] = useState(0);
  const [depositAmount, setDepositAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [depositStep, setDepositStep] = useState(1); // 1=amount, 2=transfer, 3=confirm
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [poolRes, marketRes] = await Promise.all([
        poolsAPI.detail(poolId),
        userAPI.market(),
      ]);
      setPool(poolRes.data?.pool);
      const bnb = marketRes.data?.market?.coins?.find((c: any) => c.symbol === 'BNB');
      setBnbPrice(bnb?.price || 0);
    } catch (e) {
      console.error('Failed to load pool:', e);
      Alert.alert('Error', 'Failed to load pool details');
    }
  }, [poolId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount < (pool?.minDeposit || 0)) {
      Alert.alert('Invalid Amount', `Minimum deposit is $${pool?.minDeposit}`);
      return;
    }
    // Move to step 2: show transfer instructions
    setDepositStep(2);
  };

  const copyAddress = () => {
    Clipboard.setString(POOL_DEPOSIT_ADDRESS);
    Alert.alert('Copied', 'Deposit address copied to clipboard');
  };

  const openTrustWallet = () => {
    // Build BSC transfer deep link for Trust Wallet / MetaMask
    const bnbAmount = bnbPrice > 0 ? (parseFloat(depositAmount) / bnbPrice).toFixed(6) : '0';
    const deepLink = `https://link.trustwallet.com/send?coin=20000714&address=${POOL_DEPOSIT_ADDRESS}&amount=${bnbAmount}`;
    Alert.alert(
      'Open Trust Wallet',
      `Send exactly ${bnbAmount} BNB (~$${depositAmount}) to the deposit address.\n\n1. Copy the deposit address\n2. Open Trust Wallet\n3. Send BNB to the address\n4. Come back and paste your tx hash`,
      [
        { text: 'Copy Address First', onPress: copyAddress },
        { text: 'I\'ve Sent BNB', onPress: () => setDepositStep(3) },
      ]
    );
  };

  const confirmDeposit = async () => {
    if (!txHash || !txHash.startsWith('0x') || txHash.length < 10) {
      Alert.alert('Invalid Tx Hash', 'Please paste the transaction hash from your Trust Wallet after sending BNB');
      return;
    }

    setLoading(true);
    try {
      const amount = parseFloat(depositAmount);
      const res = await poolsAPI.deposit(poolId, amount, txHash);
      Alert.alert('Success', 'Deposit recorded! Your loan will be calculated automatically based on your leverage tier.');
      setShowDepositModal(false);
      setDepositAmount('');
      setTxHash('');
      setDepositStep(1);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLoan = async () => {
    const amount = parseFloat(loanAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid loan amount');
      return;
    }

    const depositUsd = amount; // amount they want to deposit as collateral
    const leverage = getLeverage(depositUsd);
    const loanUsd = depositUsd * leverage;
    const asset = pool?.tokenSymbol === 'BTC' || pool?.tokenSymbol === 'BTCB' ? 'BTC' : 'ETH';

    Alert.alert(
      'Loan Summary',
      `Deposit: $${depositUsd}\nLeverage: ${leverage}x\nLoan Amount: $${loanUsd}\nAsset: ${asset}\n\nLoans are automatically activated when you deposit. Make a deposit first to receive your leveraged loan.`,
      [{ text: 'OK', onPress: () => setShowLoanModal(false) }]
    );
  };

  if (!pool) {
    return (
      <LinearGradient colors={[Colors.bg, Colors.bg]} style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading pool...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={[Colors.bg, Colors.bg]} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Pool Details</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Pool Info Card */}
        <LinearGradient colors={Colors.gradientCard} style={styles.poolCard}>
          <View style={styles.poolHeader}>
            <View style={styles.poolIcon}>
              <Ionicons name="wallet-outline" size={28} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: Spacing.md }}>
              <Text style={styles.poolName}>{pool.name}</Text>
              <Text style={styles.poolToken}>{pool.tokenSymbol} Pool</Text>
            </View>
            <Badge
              label={pool.status || 'ACTIVE'}
              variant={pool.status === 'ACTIVE' ? 'success' : 'warning'}
            />
          </View>

          <View style={styles.poolStats}>
            <Stat label="APY" value={`${pool.apy}%`} accent />
            <Stat label="TVL" value={`$${Number(pool.totalStaked).toLocaleString()}`} />
            <Stat label="Members" value={`${pool._count?.members || pool.memberCount || 0}`} />
          </View>

          <View style={styles.poolMeta}>
            <Meta label="Min Deposit" value={`$${pool.minDeposit}`} />
            {pool.maxDeposit && <Meta label="Max Deposit" value={`$${pool.maxDeposit}`} />}
            {pool.endDate && <Meta label="End Date" value={new Date(pool.endDate).toLocaleDateString()} />}
          </View>
        </LinearGradient>

        {/* Leverage Tiers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leverage Tiers</Text>
          <Text style={styles.sectionSubtitle}>Higher deposits unlock higher leverage</Text>
          
          {[
            { tier: 1, deposit: '$100', leverage: '10x' },
            { tier: 2, deposit: '$200', leverage: '15x' },
            { tier: 3, deposit: '$300', leverage: '20x' },
            { tier: 4, deposit: '$500', leverage: '30x' },
            { tier: 5, deposit: '$700', leverage: '40x' },
            { tier: 6, deposit: '$1,000', leverage: '60x' },
          ].map((t) => (
            <LinearGradient key={t.tier} colors={Colors.gradientCard} style={styles.tierCard}>
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>Tier {t.tier}</Text>
              </View>
              <View style={styles.tierContent}>
                <Text style={styles.tierDeposit}>Deposit: {t.deposit}</Text>
                <Text style={styles.tierLeverage}>{t.leverage} Leverage</Text>
              </View>
            </LinearGradient>
          ))}
        </View>

        {/* Risk Warning */}
        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={20} color={Colors.gold} />
          <Text style={styles.warningText}>
            Trading with leverage involves significant risk. You may lose more than your initial deposit.
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <LinearGradient colors={[Colors.bgCard, Colors.bgCard]} style={styles.actionBar}>
        <Button
          label="Deposit"
          onPress={() => setShowDepositModal(true)}
          style={{ flex: 1, marginRight: Spacing.sm }}
        />
        <Button
          label="Borrow"
          onPress={() => setShowLoanModal(true)}
          variant="outline"
          style={{ flex: 1, marginLeft: Spacing.sm }}
        />
      </LinearGradient>

      {/* Deposit Modal — 3-step flow */}
      <Modal
        visible={showDepositModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowDepositModal(false); setDepositStep(1); setTxHash(''); }}
      >
        <View style={styles.modalOverlay}>
          <LinearGradient colors={[Colors.bgCard, Colors.bgCard]} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Deposit · Step {depositStep}/3
              </Text>
              <TouchableOpacity onPress={() => { setShowDepositModal(false); setDepositStep(1); setTxHash(''); }}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Step 1: Enter amount */}
            {depositStep === 1 && (
              <View style={styles.modalBody}>
                <View style={styles.stepBadge}>
                  <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
                  <Text style={styles.stepBadgeText}>Enter Deposit Amount</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount (USD)</Text>
                  <TextInput
                    style={styles.input}
                    value={depositAmount}
                    onChangeText={setDepositAmount}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>

                {parseFloat(depositAmount) > 0 && bnbPrice > 0 && (
                  <View style={styles.conversionRow}>
                    <Text style={styles.conversionText}>
                      ≈ {(parseFloat(depositAmount) / bnbPrice).toFixed(6)} BNB
                    </Text>
                    <Text style={styles.conversionText}>
                      → {getLeverage(parseFloat(depositAmount))}x leverage
                    </Text>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
                  <Text style={styles.infoText}>
                    Minimum: ${pool?.minDeposit || 100} · Tiers: $100–$1,000
                  </Text>
                </View>

                <Button label="Continue" onPress={handleDeposit} fullWidth />
              </View>
            )}

            {/* Step 2: Transfer BNB from Trust Wallet */}
            {depositStep === 2 && (
              <View style={styles.modalBody}>
                <View style={styles.stepBadge}>
                  <Ionicons name="send-outline" size={20} color={Colors.primary} />
                  <Text style={styles.stepBadgeText}>Send BNB from Trust Wallet</Text>
                </View>

                <View style={styles.transferCard}>
                  <Text style={styles.transferLabel}>Send exactly</Text>
                  <Text style={styles.transferAmount}>
                    {bnbPrice > 0 ? (parseFloat(depositAmount) / bnbPrice).toFixed(6) : '—'} BNB
                  </Text>
                  <Text style={styles.transferUsd}>≈ ${depositAmount} USD</Text>
                </View>

                <View style={styles.addressCard}>
                  <Text style={styles.addressLabel}>To this BSC address</Text>
                  <View style={styles.addressRow}>
                    <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
                      {POOL_DEPOSIT_ADDRESS}
                    </Text>
                    <TouchableOpacity onPress={copyAddress} style={styles.copyBtn}>
                      <Ionicons name="copy-outline" size={18} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.stepsList}>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
                    <Text style={styles.stepItemText}>Copy the deposit address above</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
                    <Text style={styles.stepItemText}>Open Trust Wallet / MetaMask</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
                    <Text style={styles.stepItemText}>Send BNB (BSC) to the address</Text>
                  </View>
                  <View style={styles.stepItem}>
                    <View style={styles.stepNum}><Text style={styles.stepNumText}>4</Text></View>
                    <Text style={styles.stepItemText}>Copy the tx hash & come back</Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <Button
                    label="Copy Address"
                    onPress={copyAddress}
                    variant="outline"
                    style={{ flex: 1, marginRight: Spacing.sm }}
                  />
                  <Button
                    label="I've Sent BNB →"
                    onPress={() => setDepositStep(3)}
                    style={{ flex: 1, marginLeft: Spacing.sm }}
                  />
                </View>
              </View>
            )}

            {/* Step 3: Paste tx hash to confirm */}
            {depositStep === 3 && (
              <View style={styles.modalBody}>
                <View style={styles.stepBadge}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={Colors.success} />
                  <Text style={styles.stepBadgeText}>Confirm Your Deposit</Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Transaction Hash</Text>
                  <TextInput
                    style={[styles.input, styles.txInput]}
                    value={txHash}
                    onChangeText={setTxHash}
                    placeholder="0x... paste your tx hash here"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={Colors.primary} />
                  <Text style={styles.infoText}>
                    Paste the transaction hash from Trust Wallet after sending BNB. Your deposit will be verified on-chain.
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <Button
                    label="Back"
                    onPress={() => setDepositStep(2)}
                    variant="outline"
                    style={{ flex: 1, marginRight: Spacing.sm }}
                  />
                  <Button
                    label="Confirm Deposit"
                    onPress={confirmDeposit}
                    loading={loading}
                    style={{ flex: 1, marginLeft: Spacing.sm }}
                  />
                </View>
              </View>
            )}
          </LinearGradient>
        </View>
      </Modal>

      {/* Loan Modal */}
      <Modal
        visible={showLoanModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLoanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <LinearGradient colors={[Colors.bgCard, Colors.bgCard]} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Borrow Loan</Text>
              <TouchableOpacity onPress={() => setShowLoanModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Loan Amount (USD)</Text>
                <TextInput
                  style={styles.input}
                  value={loanAmount}
                  onChangeText={setLoanAmount}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.infoText}>
                  Loan amount based on your deposited collateral
                </Text>
              </View>
            </View>

            <Button
              label="Confirm Loan"
              onPress={handleLoan}
              loading={loading}
              fullWidth
            />
          </LinearGradient>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function Stat({ label, value, accent }: any) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{label}</Text>
      <Text style={{
        fontSize: FontSize.md, fontWeight: '700',
        color: accent ? Colors.primary : Colors.textPrimary,
      }}>{value}</Text>
    </View>
  );
}

function Meta({ label, value }: any) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.lg,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },

  // Pool Card
  poolCard: {
    marginHorizontal: Spacing.lg, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg, gap: Spacing.md,
  },
  poolHeader: {
    flexDirection: 'row', alignItems: 'center',
  },
  poolIcon: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center',
  },
  poolName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  poolToken: { fontSize: FontSize.sm, color: Colors.textSecondary },
  poolStats: {
    flexDirection: 'row', paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  poolMeta: {
    gap: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  metaLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  metaValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary },

  // Section
  section: {
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  sectionSubtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },

  // Tier Card
  tierCard: {
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  tierBadge: {
    backgroundColor: 'rgba(240,185,11,0.15)', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, alignSelf: 'flex-start', marginBottom: Spacing.sm,
  },
  tierBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  tierContent: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  tierDeposit: { fontSize: FontSize.sm, color: Colors.textSecondary },
  tierLeverage: { fontSize: FontSize.md, fontWeight: '700', color: Colors.primary },

  // Warning
  warningCard: {
    flexDirection: 'row', gap: Spacing.sm, marginHorizontal: Spacing.lg,
    backgroundColor: 'rgba(240,185,11,0.08)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.lg,
  },
  warningText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },

  // Action Bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xl, gap: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  modalBody: { gap: Spacing.md },
  balanceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  balanceLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  balanceValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  inputGroup: { gap: Spacing.xs },
  inputLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
  },
  infoText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary },

  // Deposit step styles
  stepBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(240,185,11,0.12)', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.md, marginBottom: Spacing.md,
  },
  stepBadgeText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  conversionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: Spacing.md,
  },
  conversionText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  transferCard: {
    alignItems: 'center', backgroundColor: 'rgba(240,185,11,0.08)',
    borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },
  transferLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 4 },
  transferAmount: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  transferUsd: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  addressCard: {
    backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  addressLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 6 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressText: { flex: 1, fontSize: FontSize.sm, color: Colors.textPrimary, fontWeight: '600' },
  copyBtn: { padding: 8 },
  stepsList: { gap: 10, marginBottom: Spacing.lg },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  stepItemText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  modalActions: { flexDirection: 'row', marginTop: Spacing.sm },
  txInput: { fontFamily: 'monospace' },
});
