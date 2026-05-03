import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, Clipboard, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { poolsAPI, userAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const COIN_ICONS: Record<string, string> = {
  BTC: 'logo-bitcoin',
  ETH: 'logo-ethereum',
  BNB: 'cube',
  SOL: 'flash',
  ADA: 'card',
  DOGE: 'paw',
  DOT: 'ellipse',
  MATIC: 'layers',
  AVAX: 'snow',
  LINK: 'link',
  UNI: 'infinite',
  XRP: 'water',
  LTC: 'diamond',
  USDT: 'cash',
  USDC: 'cash',
  DAI: 'cash',
};

function CoinIcon({ symbol }: { symbol: string }) {
  const iconName = (COIN_ICONS[symbol?.toUpperCase()] || 'cube-outline') as any;
  return (
    <View style={styles.coinIconBg}>
      <Ionicons name={iconName} size={22} color={Colors.primary} />
    </View>
  );
}

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
      <View style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading pool...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Dark Gradient Header with Hero */}
        <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Pool Details</Text>
            <TouchableOpacity style={styles.shareBtn}>
              <Ionicons name="share-outline" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Hero APY inside gradient */}
          <View style={styles.heroSection}>
            <View style={styles.heroCoinRow}>
              <CoinIcon symbol={pool.tokenSymbol} />
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.heroPoolName}>{pool.name}</Text>
                <View style={styles.heroTokenRow}>
                  <Text style={styles.heroToken}>{pool.tokenSymbol} Pool</Text>
                  <View style={styles.heroDot} />
                  <Badge
                    label={pool.status || 'Active'}
                    variant={pool.status === 'ACTIVE' ? 'success' : 'warning'}
                  />
                </View>
              </View>
            </View>

            <View style={styles.apyDisplay}>
              <Text style={styles.apyLabel}>Annual Percentage Yield</Text>
              <Text style={styles.apyValue}>{pool.apy}%</Text>
              <Text style={styles.apySub}>Earn up to {pool.apy}% APY on your deposits</Text>
            </View>

            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>${Number(pool.totalStaked).toLocaleString()}</Text>
                <Text style={styles.heroStatLabel}>TVL</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>{pool._count?.members || pool.memberCount || 0}</Text>
                <Text style={styles.heroStatLabel}>Members</Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatValue}>${pool.minDeposit}</Text>
                <Text style={styles.heroStatLabel}>Min Deposit</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Pool Details Grid */}
          <View style={styles.detailsGrid}>
            <View style={styles.detailCell}>
              <Ionicons name="wallet-outline" size={18} color={Colors.primary} />
              <Text style={styles.detailLabel}>Network</Text>
              <Text style={styles.detailValue}>BSC</Text>
            </View>
            <View style={styles.detailCell}>
              <Ionicons name="time-outline" size={18} color={Colors.primary} />
              <Text style={styles.detailLabel}>Lock Period</Text>
              <Text style={styles.detailValue}>Flexible</Text>
            </View>
            <View style={styles.detailCell}>
              <Ionicons name="trending-up-outline" size={18} color={Colors.primary} />
              <Text style={styles.detailLabel}>Max Leverage</Text>
              <Text style={styles.detailValue}>60x</Text>
            </View>
            <View style={styles.detailCell}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
              <Text style={styles.detailLabel}>Insurance</Text>
              <Text style={styles.detailValue}>Covered</Text>
            </View>
          </View>

          {/* Estimated Earnings Calculator */}
          <View style={styles.calculatorCard}>
            <View style={styles.calcHeader}>
              <Ionicons name="calculator-outline" size={20} color={Colors.primary} />
              <Text style={styles.calcTitle}>Estimated Earnings</Text>
            </View>
            <View style={styles.calcInputRow}>
              <TextInput
                style={styles.calcInput}
                value={depositAmount}
                onChangeText={setDepositAmount}
                placeholder="Enter deposit amount"
                placeholderTextColor={Colors.textMuted}
                keyboardType="decimal-pad"
              />
              <Text style={styles.calcCurrency}>USD</Text>
            </View>
            {parseFloat(depositAmount) > 0 && (
              <View style={styles.calcResult}>
                <View style={styles.calcResultRow}>
                  <Text style={styles.calcResultLabel}>Daily</Text>
                  <Text style={styles.calcResultValue}>${((parseFloat(depositAmount) * pool.apy) / 36500).toFixed(2)}</Text>
                </View>
                <View style={styles.calcResultRow}>
                  <Text style={styles.calcResultLabel}>Monthly</Text>
                  <Text style={styles.calcResultValue}>${((parseFloat(depositAmount) * pool.apy) / 1200).toFixed(2)}</Text>
                </View>
                <View style={styles.calcResultDivider} />
                <View style={styles.calcResultRow}>
                  <Text style={styles.calcResultLabelBold}>Yearly</Text>
                  <Text style={styles.calcResultValueBig}>${((parseFloat(depositAmount) * pool.apy) / 100).toFixed(2)}</Text>
                </View>
              </View>
            )}
          </View>

          {/* How It Works */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How It Works</Text>
            <View style={styles.howGrid}>
              <View style={styles.howCard}>
                <View style={styles.howIconBg}>
                  <Ionicons name="wallet-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.howTitle}>Deposit</Text>
                <Text style={styles.howDesc}>Send BNB to the pool address</Text>
              </View>
              <View style={styles.howCard}>
                <View style={styles.howIconBg}>
                  <Ionicons name="trending-up-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.howTitle}>Leverage</Text>
                <Text style={styles.howDesc}>Get up to 60x on your deposit</Text>
              </View>
              <View style={styles.howCard}>
                <View style={styles.howIconBg}>
                  <Ionicons name="diamond-outline" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.howTitle}>Earn</Text>
                <Text style={styles.howDesc}>Collect APY rewards daily</Text>
              </View>
            </View>
          </View>

          {/* Leverage Tiers - Horizontal Cards */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Leverage Tiers</Text>
              <Text style={styles.sectionSubtitle}>6 tiers</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tierScroll}>
              {[
                { tier: 1, deposit: 100, leverage: 10 },
                { tier: 2, deposit: 200, leverage: 15 },
                { tier: 3, deposit: 300, leverage: 20 },
                { tier: 4, deposit: 500, leverage: 30 },
                { tier: 5, deposit: 700, leverage: 40 },
                { tier: 6, deposit: 1000, leverage: 60 },
              ].map((t) => {
                const isActive = parseFloat(depositAmount) >= t.deposit;
                return (
                  <View key={t.tier} style={[styles.tierCard, isActive && styles.tierCardActive]}>
                    <Text style={[styles.tierCardLabel, isActive && styles.tierCardLabelActive]}>Tier {t.tier}</Text>
                    <Text style={[styles.tierCardLeverage, isActive && styles.tierCardLeverageActive]}>{t.leverage}x</Text>
                    <Text style={styles.tierCardDeposit}>${t.deposit}</Text>
                    {isActive && <View style={styles.tierCardCheck}><Ionicons name="checkmark-circle" size={16} color="#000" /></View>}
                  </View>
                );
              })}
            </ScrollView>
          </View>

          {/* Risk Warning */}
          <View style={styles.warningCard}>
            <Ionicons name="warning-outline" size={18} color={Colors.primary} />
            <Text style={styles.warningText}>
              Trading with leverage involves significant risk. You may lose more than your initial deposit.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Floating Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.actionBarInner}>
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
        </View>
      </View>

      {/* Deposit Modal — 3-step flow */}
      <Modal
        visible={showDepositModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowDepositModal(false); setDepositStep(1); setTxHash(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
          </View>
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
          <View style={styles.modalContent}>
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
          </View>
        </View>
      </Modal>
    </View>
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
  container: { flex: 1, backgroundColor: Colors.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary },

  // Header Gradient
  headerGradient: {
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  shareBtn: {
    width: 40, height: 40, borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },

  // Hero Section (inside gradient)
  heroSection: {
    marginHorizontal: Spacing.lg, gap: Spacing.lg,
  },
  heroCoinRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  heroPoolName: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  heroTokenRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3,
  },
  heroToken: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  heroDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },

  // APY Display
  apyDisplay: {
    alignItems: 'center', paddingVertical: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  apyLabel: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 4 },
  apyValue: { fontSize: 52, fontWeight: '900', color: Colors.primary, lineHeight: 56 },
  apySub: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, marginTop: 4 },

  // Hero Stats Row
  heroStatsRow: {
    flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  heroStatLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },
  heroStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Content
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg, paddingTop: Spacing.lg },

  // Details Grid
  detailsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
  },
  detailCell: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, padding: Spacing.md, gap: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  detailLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  detailValue: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },

  // Meta (for Meta component)
  metaRow: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  metaLabel: { fontSize: 13, color: Colors.textSecondary },
  metaValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },

  // Calculator Card
  calculatorCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
  },
  calcHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  calcTitle: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  calcInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  calcInput: {
    flex: 1, fontSize: 16, color: Colors.textPrimary,
  },
  calcCurrency: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  calcResult: {
    backgroundColor: 'rgba(240,185,11,0.08)', borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },
  calcResultRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  calcResultLabel: { fontSize: 13, color: Colors.textSecondary },
  calcResultLabelBold: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary },
  calcResultValue: { fontSize: 15, fontWeight: '800', color: Colors.primary },
  calcResultValueBig: { fontSize: 20, fontWeight: '900', color: Colors.primary },
  calcResultDivider: { height: 1, backgroundColor: 'rgba(240,185,11,0.2)' },

  // How It Works
  howGrid: {
    flexDirection: 'row', gap: Spacing.sm,
  },
  howCard: {
    flex: 1, backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  howIconBg: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(240,185,11,0.1)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },
  howTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  howDesc: { fontSize: 11, color: Colors.textMuted, textAlign: 'center' },

  // Coin Icon
  coinIconBg: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.1)', borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Section
  section: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  sectionSubtitle: { fontSize: 13, color: Colors.textSecondary },

  // Tier Horizontal Cards
  tierScroll: {
    gap: Spacing.sm, paddingRight: Spacing.lg,
  },
  tierCard: {
    width: 110, backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  tierCardActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  tierCardLabel: {
    fontSize: 11, fontWeight: '700', color: Colors.textMuted,
  },
  tierCardLabelActive: {
    color: 'rgba(0,0,0,0.6)',
  },
  tierCardLeverage: {
    fontSize: 24, fontWeight: '900', color: Colors.textSecondary,
  },
  tierCardLeverageActive: {
    color: '#000',
  },
  tierCardDeposit: {
    fontSize: 11, fontWeight: '600', color: Colors.textMuted,
  },
  tierCardCheck: {
    position: 'absolute', top: 6, right: 6,
  },

  // Warning
  warningCard: {
    flexDirection: 'row', gap: Spacing.sm,
    backgroundColor: 'rgba(240,185,11,0.08)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
    borderRadius: Radius.md, padding: Spacing.md,
  },
  warningText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },

  // Action Bar
  actionBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  actionBarInner: {
    flexDirection: 'row', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xl, gap: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalBody: { gap: Spacing.md },
  inputGroup: { gap: Spacing.xs },
  inputLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, fontSize: 16,
    color: Colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row', gap: 6, alignItems: 'center',
  },
  infoText: { flex: 1, fontSize: 12, color: Colors.textSecondary },

  // Deposit step styles
  stepBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(240,185,11,0.12)', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: Radius.md, marginBottom: Spacing.md,
  },
  stepBadgeText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  conversionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.md,
  },
  conversionText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  transferCard: {
    alignItems: 'center', backgroundColor: 'rgba(240,185,11,0.08)',
    borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },
  transferLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  transferAmount: { fontSize: 32, fontWeight: '900', color: Colors.primary },
  transferUsd: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addressCard: {
    backgroundColor: Colors.bg, borderRadius: Radius.md, padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  addressLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 6 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressText: { flex: 1, fontSize: 13, color: Colors.textPrimary, fontWeight: '700', fontFamily: 'monospace' },
  copyBtn: { padding: 8 },
  stepsList: { gap: 10, marginBottom: Spacing.lg },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  stepItemText: { fontSize: 13, color: Colors.textSecondary },
  modalActions: { flexDirection: 'row', marginTop: Spacing.sm },
  txInput: { fontFamily: 'monospace' },
});
