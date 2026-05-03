import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Modal, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { poolsAPI, userAPI } from '../../services/api';

const COIN_ICONS: Record<string, any> = {
  BTC: require('../../../assets/coins/btc.png'),
  ETH: require('../../../assets/coins/eth.png'),
  BNB: require('../../../assets/coins/bnb.png'),
  SOL: require('../../../assets/coins/sol.png'),
  ADA: require('../../../assets/coins/ada.png'),
  DOGE: require('../../../assets/coins/doge.png'),
  DOT: require('../../../assets/coins/dot.png'),
  MATIC: require('../../../assets/coins/matic.png'),
  AVAX: require('../../../assets/coins/avax.png'),
  LINK: require('../../../assets/coins/link.png'),
  UNI: require('../../../assets/coins/uni.png'),
  XRP: require('../../../assets/coins/xrp.png'),
  LTC: require('../../../assets/coins/ltc.png'),
};

export default function PoolDetailScreen({ route, navigation }: any) {
  const { poolId } = route.params;
  const [pool, setPool] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await poolsAPI.detail(poolId);
      setPool(res.data?.pool);
    } catch (e) {
      console.error('Failed to load pool:', e);
      Alert.alert('Error', 'Failed to load pool details');
    }
  }, [poolId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!amount || amount < (pool?.minDeposit || 0)) {
      Alert.alert('Invalid Amount', `Minimum deposit is $${pool?.minDeposit}`);
      return;
    }

    setLoading(true);
    try {
      // TODO: Implement actual deposit with transaction hash
      Alert.alert('Deposit', 'Deposit feature coming soon - requires on-chain transaction');
      setShowDepositModal(false);
      setDepositAmount('');
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

    setLoading(true);
    try {
      // TODO: Implement actual loan
      Alert.alert('Loan', 'Loan feature coming soon');
      setShowLoanModal(false);
      setLoanAmount('');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.error || 'Loan failed');
    } finally {
      setLoading(false);
    }
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
              <Image
                source={COIN_ICONS[pool.tokenSymbol] || COIN_ICONS.BNB}
                style={styles.coinIcon}
                resizeMode="contain"
              />
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
            <Stat label="Members" value={`${pool.memberCount || 0}`} />
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
            { tier: 1, deposit: '0-100', leverage: '2x' },
            { tier: 2, deposit: '100-500', leverage: '5x' },
            { tier: 3, deposit: '500-1000', leverage: '10x' },
            { tier: 4, deposit: '1000-5000', leverage: '20x' },
            { tier: 5, deposit: '5000+', leverage: '60x' },
          ].map((t) => (
            <LinearGradient key={t.tier} colors={Colors.gradientCard} style={styles.tierCard}>
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>Tier {t.tier}</Text>
              </View>
              <View style={styles.tierContent}>
                <Text style={styles.tierDeposit}>Deposit: ${t.deposit}</Text>
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

      {/* Deposit Modal */}
      <Modal
        visible={showDepositModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDepositModal(false)}
      >
        <View style={styles.modalOverlay}>
          <LinearGradient colors={[Colors.bgCard, Colors.bgCard]} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Deposit to Pool</Text>
              <TouchableOpacity onPress={() => setShowDepositModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Your Balance</Text>
                <Text style={styles.balanceValue}>$0.00</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Deposit Amount (USD)</Text>
                <TextInput
                  style={styles.input}
                  value={depositAmount}
                  onChangeText={setDepositAmount}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.infoText}>
                  Minimum deposit: ${pool.minDeposit}
                </Text>
              </View>
            </View>

            <Button
              label="Confirm Deposit"
              onPress={handleDeposit}
              loading={loading}
              fullWidth
            />
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
  coinIcon: { width: 36, height: 36 },
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
});
