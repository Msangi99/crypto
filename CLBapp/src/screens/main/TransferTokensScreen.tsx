import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert,
  ScrollView, KeyboardAvoidingView, Platform, Image, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { tokensAPI } from '../../services/api';

const CLB_LOGO = require('../../../assets/clb-token.png');

function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseFloat(String(v ?? '').replace(',', ''));
  return Number.isFinite(n) ? n : 0;
}

/** Readable balance on token chips (.toFixed(1) hides small mined amounts). */
function formatSelectableBalance(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0';
  if (n < 0.0001) return n.toExponential(1);
  if (n < 1) return n.toFixed(6).replace(/\.?0+$/, '');
  if (n < 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function amountStringForInput(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '';
  return n.toFixed(8).replace(/\.?0+$/, '');
}

const TOKENS = [
  { symbol: 'CLB', name: 'CLB Token', color: '#3B82F6', icon: 'cube' },
  { symbol: 'CLBg', name: 'CLB Gold', color: '#F0B90B', icon: 'diamond' },
  { symbol: 'CLBs', name: 'CLB Silver', color: '#C0C0C0', icon: 'flash' },
  { symbol: 'GLM', name: 'Golem', color: '#0F9D58', icon: 'logo-codepen' },
];

export default function TransferTokensScreen({ navigation }: any) {
  const [selectedToken, setSelectedToken] = useState(TOKENS[0]);
  const [amount, setAmount] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [note, setNote] = useState('');
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadBalances = useCallback(async () => {
    try {
      const res = await tokensAPI.balances();
      const list = res.data?.balances ?? res.data?.data?.balances;
      setBalances(Array.isArray(list) ? list : []);
    } catch {
      setBalances([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBalances();
    }, [loadBalances]),
  );

  const balance = balances.find((b) => b.token === selectedToken.symbol);
  /** Ledger only — backend transfer uses DB; claim mining on Wallet first to move accrual here. */
  const available = balance
    ? toNum(balance.available ?? toNum(balance.balance) - toNum(balance.locked))
    : 0;
  const locked = balance ? toNum(balance.locked) : 0;
  const grossLedger = balance ? toNum(balance.balance) : 0;
  const totalWithMining = balance
    ? toNum(balance.totalBalance != null ? balance.totalBalance : balance.balance)
    : 0;
  const numAmount = parseFloat(amount || '0');

  const handleTransfer = async () => {
    if (!amount || numAmount <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
      return;
    }
    if (numAmount > available) {
              Alert.alert('Insufficient Balance', `Available: ${formatSelectableBalance(available)} ${selectedToken.symbol}`);
      return;
    }
    if (!toAddress || toAddress.length < 10) {
      Alert.alert('Error', 'Enter a valid wallet address');
      return;
    }

    Alert.alert(
      'Confirm Transfer',
      `Send ${numAmount.toFixed(2)} ${selectedToken.symbol} to ${toAddress.slice(0, 8)}...${toAddress.slice(-4)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            setLoading(true);
            try {
              const res = await tokensAPI.transfer({
                toAddress,
                token: selectedToken.symbol,
                amount: numAmount,
                note: note || undefined,
                delivery: 'ON_CHAIN',
              });
              const explorerUrl = res.data?.transfer?.explorerUrl;
              Alert.alert(
                'Transfer Sent',
                `${formatSelectableBalance(toNum(res.data?.transfer?.netAmount))} ${selectedToken.symbol} sent directly on BNB Smart Chain.`,
                [
                  ...(explorerUrl
                    ? [{ text: 'View on BscScan', onPress: () => Linking.openURL(explorerUrl) }]
                    : []),
                  { text: 'OK', onPress: () => { loadBalances(); navigation.goBack(); } },
                ],
              );
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Transfer failed');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Header */}
          <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Send Tokens</Text>
            <View style={{ width: 32 }} />
          </LinearGradient>

          {/* Token Selection */}
          <Text style={styles.label}>Select Token</Text>
          <View style={styles.tokensRow}>
            {TOKENS.map((t) => {
              const bal = balances.find((b) => b.token === t.symbol);
              const chipBal = bal
                ? toNum(bal.totalBalance != null ? bal.totalBalance : bal.balance)
                : 0;
              return (
                <TouchableOpacity
                  key={t.symbol}
                  style={[styles.tokenChip, selectedToken.symbol === t.symbol && { borderColor: t.color, backgroundColor: t.color + '12' }]}
                  onPress={() => setSelectedToken(t)}
                >
                  <Image source={CLB_LOGO} style={styles.chipLogo} resizeMode="contain" />
                  <Text style={[styles.tokenChipText, selectedToken.symbol === t.symbol && { color: t.color }]}>{t.symbol}</Text>
                  <Text
                    style={[
                      styles.tokenChipBal,
                      selectedToken.symbol === t.symbol && { color: Colors.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {formatSelectableBalance(chipBal)}
                  </Text>
                  {bal && toNum(bal.locked) > 0 ? (
                    <Text style={styles.tokenChipLocked} numberOfLines={1}>
                      {formatSelectableBalance(toNum(bal.locked))} locked
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Recipient */}
          <Text style={styles.label}>Recipient Address</Text>
          <View style={styles.inputCard}>
            <Ionicons name="person" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.textInput}
              placeholder="0x... or CLB wallet address"
              placeholderTextColor={Colors.textMuted + '80'}
              value={toAddress}
              onChangeText={setToAddress}
              autoCapitalize="none"
            />
          </View>
          <Text style={styles.balanceHint}>
            Use the recipient's BNB Smart Chain address. CLB is sent as a BEP-20 token, not as BNB.
          </Text>

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
            <TouchableOpacity onPress={() => setAmount(amountStringForInput(available))}>
              <Text style={styles.maxBtn}>MAX</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceHint}>
            Sendable (ledger): {formatSelectableBalance(available)} {selectedToken.symbol}
            {locked > 0 ? ` · ${formatSelectableBalance(locked)} locked` : ''}
            {totalWithMining > grossLedger
              ? ` · total ${formatSelectableBalance(totalWithMining)} (claim mined on Wallet to send)`
              : ''}
          </Text>

          {/* Note */}
          <Text style={styles.label}>Note (optional)</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.textInput}
              placeholder="What's this for?"
              placeholderTextColor={Colors.textMuted + '80'}
              value={note}
              onChangeText={setNote}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleTransfer}
            disabled={loading || numAmount <= 0}
            activeOpacity={0.85}
            style={{ marginTop: Spacing.xl }}
          >
            <LinearGradient
              colors={numAmount > 0 ? Colors.gradientPrimary : ['#333', '#222']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.submitBtn}
            >
              <Ionicons name="send" size={18} color={numAmount > 0 ? '#000' : Colors.textMuted} />
              <Text style={[styles.submitText, numAmount <= 0 && { color: Colors.textMuted }]}>
                {loading ? 'Sending...' : 'Send'}
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
  tokenChipBal: { fontSize: 11, fontWeight: '800', color: Colors.textPrimary, maxWidth: '100%' },
  tokenChipLocked: { fontSize: 9, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },

  inputCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: Spacing.lg, padding: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  textInput: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
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

  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: Spacing.lg, paddingVertical: 18, gap: 8,
    borderRadius: Radius.lg,
  },
  submitText: { fontSize: 16, fontWeight: '900', color: '#000' },
});
