import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { tokensAPI } from '../../services/api';

const TOKENS = [
  { symbol: 'CLBg', name: 'CLB Gold', color: '#F0B90B', icon: 'diamond' },
  { symbol: 'CLBs', name: 'CLB Silver', color: '#C0C0C0', icon: 'flash' },
  { symbol: 'CLB', name: 'CLB Token', color: '#3B82F6', icon: 'cube' },
];

export default function TransferTokensScreen({ navigation }: any) {
  const [selectedToken, setSelectedToken] = useState(TOKENS[0]);
  const [amount, setAmount] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [note, setNote] = useState('');
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await tokensAPI.balances();
        setBalances(res.data.balances || []);
      } catch {}
    };
    fetch();
  }, []);

  const balance = balances.find((b) => b.token === selectedToken.symbol);
  const available = balance ? balance.available : 0;
  const numAmount = parseFloat(amount || '0');

  const handleTransfer = async () => {
    if (!amount || numAmount <= 0) {
      Alert.alert('Error', 'Enter a valid amount');
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
              });
              Alert.alert(
                'Transfer Sent!',
                `${res.data.transfer.netAmount.toFixed(2)} ${selectedToken.symbol} sent successfully.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
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
              return (
                <TouchableOpacity
                  key={t.symbol}
                  style={[styles.tokenChip, selectedToken.symbol === t.symbol && { borderColor: t.color, backgroundColor: t.color + '12' }]}
                  onPress={() => setSelectedToken(t)}
                >
                  <Ionicons name={t.icon as any} size={18} color={selectedToken.symbol === t.symbol ? t.color : Colors.textMuted} />
                  <Text style={[styles.tokenChipText, selectedToken.symbol === t.symbol && { color: t.color }]}>{t.symbol}</Text>
                  <Text style={styles.tokenChipBal}>{(bal?.available || 0).toFixed(1)}</Text>
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
            <TouchableOpacity onPress={() => setAmount(available.toFixed(2))}>
              <Text style={styles.maxBtn}>MAX</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.balanceHint}>Available: {available.toFixed(2)} {selectedToken.symbol}</Text>

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
  tokenChipText: { fontSize: 12, fontWeight: '800', color: Colors.textMuted },
  tokenChipBal: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },

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
