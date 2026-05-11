import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert,
  ScrollView, KeyboardAvoidingView, Platform, Image, Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { withdrawalsAPI, tokensAPI } from '../../services/api';

const CLB_LOGO = require('../../../assets/clb-token.png');

const TOKENS = [
  { symbol: 'CLB', name: 'CLB Token', color: '#3B82F6', icon: 'cube' },
];

export default function WithdrawScreen({ navigation }: any) {
  const [selectedToken, setSelectedToken] = useState(TOKENS[0]);
  const [amount, setAmount] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [balances, setBalances] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [balRes, feeRes] = await Promise.all([
          tokensAPI.balances(),
          withdrawalsAPI.fees(),
        ]);
        setBalances(balRes.data.balances || []);
        setFees(feeRes.data.fees || []);
      } catch (err) {
        console.log('Fetch error:', err);
      }
    };
    fetchData();
  }, []);

  const balance = balances.find((b) => b.token === selectedToken.symbol);
  const available = balance ? balance.available : 0;
  const feeInfo = fees.find((f: any) => f.token === selectedToken.symbol);
  const fee = feeInfo?.fee || 0;
  const minAmount = feeInfo?.minAmount || 0;
  const numAmount = parseFloat(amount || '0');
  const netAmount = Math.max(0, numAmount - fee);

  const handleWithdraw = async () => {
    if (!amount || numAmount <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    if (numAmount < minAmount) {
      Alert.alert('Minimum', `Minimum withdrawal is ${minAmount} ${selectedToken.symbol}`);
      return;
    }
    if (numAmount <= fee) {
      Alert.alert('Amount too low', `Amount must be greater than the ${fee} ${selectedToken.symbol} fee`);
      return;
    }
    if (numAmount > available) {
      Alert.alert('Insufficient Balance', `Available: ${available.toFixed(2)} ${selectedToken.symbol}`);
      return;
    }
    if (!toAddress || toAddress.length < 10) {
      Alert.alert('Error', 'Enter a valid wallet address');
      return;
    }

    setLoading(true);
    try {
      const res = await withdrawalsAPI.request({
        token: selectedToken.symbol,
        amount: numAmount,
        toAddress,
      });
      const explorerUrl = res.data?.withdrawal?.explorerUrl;
      Alert.alert(
        'Withdrawal Sent',
        `${netAmount.toFixed(2)} ${selectedToken.symbol} was sent directly on BNB Smart Chain.`,
        [
          ...(explorerUrl
            ? [{ text: 'View on BscScan', onPress: () => Linking.openURL(explorerUrl) }]
            : []),
          { text: 'OK', onPress: () => navigation.goBack() },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Header */}
          <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Withdraw</Text>
            <View style={{ width: 32 }} />
          </LinearGradient>

          {/* Token Selection */}
          <Text style={styles.label}>Select Token</Text>
          <View style={styles.tokensRow}>
            {TOKENS.map((t) => {
              const bal = balances.find((b) => b.token === t.symbol);
              return (
                <TouchableOpacity
                  key={t.symbol}
                  style={[styles.tokenChip, selectedToken.symbol === t.symbol && { borderColor: t.color, backgroundColor: t.color + '12' }]}
                  onPress={() => setSelectedToken(t)}
                >
                  <Image source={CLB_LOGO} style={styles.chipLogo} resizeMode="contain" />
                  <Text style={[styles.tokenChipText, selectedToken.symbol === t.symbol && { color: t.color }]}>
                    {t.symbol}
                  </Text>
                  <Text style={styles.tokenChipBal}>{(bal?.available || 0).toFixed(1)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Amount */}
          <Text style={styles.label}>Amount</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <TouchableOpacity onPress={() => setAmount(Math.max(0, available).toFixed(2))}>
              <Text style={styles.maxBtn}>MAX</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceHint}>
            Available: {available.toFixed(2)} {selectedToken.symbol}
          </Text>

          {/* Address */}
          <Text style={styles.label}>Wallet Address</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.addressInput}
              placeholder="0x..."
              placeholderTextColor={Colors.textMuted}
              value={toAddress}
              onChangeText={setToAddress}
              autoCapitalize="none"
            />
          </View>
          <Text style={styles.addressHint}>
            <Ionicons name="information-circle-outline" size={12} color={Colors.textMuted} />
            {' '}Use a BNB Smart Chain address. CLB is a BEP-20 token; Trust Wallet may show the network as BNB.
          </Text>

          {/* Summary */}
          {numAmount > 0 && (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>{numAmount.toFixed(2)} {selectedToken.symbol}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Network Fee</Text>
                <Text style={styles.summaryValue}>-{fee} {selectedToken.symbol}</Text>
              </View>
              <View style={[styles.summaryRow, styles.summaryHighlight]}>
                <Text style={styles.summaryLabel}>You Receive</Text>
                <Text style={styles.summaryBig}>{netAmount.toFixed(2)} {selectedToken.symbol}</Text>
              </View>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            onPress={handleWithdraw}
            disabled={loading || numAmount <= 0}
            activeOpacity={0.85}
            style={{ marginTop: Spacing.lg }}
          >
            <LinearGradient
              colors={numAmount > 0 ? Colors.gradientPrimary : ['#333', '#222']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.submitBtn}
            >
              <Ionicons name="download" size={18} color={numAmount > 0 ? '#000' : Colors.textMuted} />
              <Text style={[styles.submitText, numAmount <= 0 && { color: Colors.textMuted }]}>
                {loading ? 'Processing...' : 'Withdraw'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },

  label: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },

  tokensRow: { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg },
  tokenChip: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard, borderWidth: 1.5, borderColor: Colors.border,
  },
  chipLogo: { width: 22, height: 22, borderRadius: 6 },
  tokenChipText: { fontSize: 12, fontWeight: '800', color: Colors.textMuted },
  tokenChipBal: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },

  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, padding: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  amountInput: { flex: 1, fontSize: 24, fontWeight: '800', color: Colors.textPrimary },
  maxBtn: {
    fontSize: 12, fontWeight: '800', color: Colors.primary,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(240,185,11,0.1)', borderRadius: 99,
  },
  balanceHint: {
    fontSize: 12, fontWeight: '600', color: Colors.textMuted,
    paddingHorizontal: Spacing.lg, marginTop: 4,
  },
  addressInput: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  addressHint: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    paddingHorizontal: Spacing.lg, marginTop: 4,
  },

  summaryCard: {
    margin: Spacing.lg, padding: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
  },
  summaryLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  summaryValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  summaryHighlight: {
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  summaryBig: { fontSize: 18, fontWeight: '900', color: Colors.primary },

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: Spacing.lg, paddingVertical: 18, gap: 8,
    borderRadius: Radius.lg,
  },
  submitText: { fontSize: 16, fontWeight: '900', color: '#000' },
});
