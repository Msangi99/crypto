import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadow } from '../../constants/theme';
import { loansAPI, priceAPI } from '../../services/api';

const CHAINS = [
  { symbol: 'BTC', name: 'Bitcoin', icon: 'logo-bitcoin', color: '#F7931A' },
  { symbol: 'ETH', name: 'Ethereum', icon: 'logo-ethereum', color: '#627EEA' },
  { symbol: 'BNB', name: 'BNB', icon: 'cube', color: '#F0B90B' },
  { symbol: 'SOL', name: 'Solana', icon: 'flash', color: '#9945FF' },
];

const TOKEN_META: Record<string, { name: string; color: string }> = {
  CLBg: { name: 'CLB Gold', color: '#F0B90B' },
  CLBs: { name: 'CLB Silver', color: '#C0C0C0' },
  CLB: { name: 'CLB', color: '#3B82F6' },
};

function chainForSymbol(sym?: string) {
  if (!sym) return CHAINS[0];
  const u = sym.toUpperCase();
  return CHAINS.find((c) => c.symbol === u) || CHAINS[0];
}

export default function LoanRequestScreen({ navigation, route }: any) {
  const preferred = route?.params?.preferredAsset as string | undefined;
  const [selectedChain, setSelectedChain] = useState(() => chainForSymbol(preferred));
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState(0);
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const p = route?.params?.preferredAsset as string | undefined;
      if (p) setSelectedChain(chainForSymbol(p));
    }, [route?.params?.preferredAsset])
  );

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [priceRes, tierRes] = await Promise.all([
        priceAPI.current(),
        loansAPI.tiers(),
      ]);
      const prices = priceRes.data?.prices || priceRes.data;
      if (prices && typeof prices === 'object') {
        const p = prices[selectedChain.symbol.toLowerCase()] || prices[selectedChain.symbol] || 0;
        setPrice(typeof p === 'object' ? p.usd || p.price || 0 : p);
      }
      setTiers(tierRes.data?.tiers || []);
    } catch (err) {
      console.log('Price fetch error:', err);
    }
  };

  useEffect(() => { fetchData(); }, [selectedChain]);

  const collateralValue = parseFloat(amount || '0') * price;
  const tier = collateralValue >= 5000 ? 'CLBg' : collateralValue >= 1000 ? 'CLBs' : 'CLB';
  const tierInfo = tiers.find((t) => t.token === tier);
  const ltv = tierInfo?.ltv || (tier === 'CLBg' ? 60 : tier === 'CLBs' ? 50 : 40);
  const loanAmount = (collateralValue * ltv) / 100;
  const meta = TOKEN_META[tier];

  const handleRequest = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (collateralValue < 100) {
      Alert.alert('Minimum Required', 'Minimum collateral value is $100');
      return;
    }

    setLoading(true);
    try {
      const res = await loansAPI.request({
        collateralChain: selectedChain.symbol,
        collateralAmount: parseFloat(amount),
        collateralPriceUsd: price,
      });

      Alert.alert(
        'Loan Created!',
        `You will receive ${res.data.loan.loanAmount.toFixed(2)} ${res.data.loan.loanToken} tokens after deposit is confirmed.`,
        [{ text: 'View Loans', onPress: () => navigation.replace('MyLoans') },
         { text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to create loan');
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
            <Text style={styles.headerTitle}>Get a Loan</Text>
            <View style={{ width: 32 }} />
          </LinearGradient>

          {/* Chain Selection */}
          <Text style={styles.label}>Select Collateral</Text>
          <View style={styles.chainsRow}>
            {CHAINS.map((c) => (
              <TouchableOpacity
                key={c.symbol}
                style={[styles.chainChip, selectedChain.symbol === c.symbol && { borderColor: c.color, backgroundColor: c.color + '12' }]}
                onPress={() => setSelectedChain(c)}
              >
                <Ionicons name={c.icon as any} size={18} color={selectedChain.symbol === c.symbol ? c.color : Colors.textMuted} />
                <Text style={[styles.chainText, selectedChain.symbol === c.symbol && { color: c.color }]}>
                  {c.symbol}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount Input */}
          <Text style={styles.label}>Amount ({selectedChain.symbol})</Text>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
            <View style={styles.inputRight}>
              <Text style={styles.inputCurrency}>{selectedChain.symbol}</Text>
              {price > 0 && (
                <Text style={styles.inputUsd}>≈ ${collateralValue.toFixed(2)}</Text>
              )}
            </View>
          </View>

          {price > 0 && (
            <Text style={styles.priceHint}>
              1 {selectedChain.symbol} = ${price.toLocaleString()}
            </Text>
          )}

          {/* Loan Preview */}
          {collateralValue >= 100 && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Loan Preview</Text>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Token Tier</Text>
                <View style={[styles.tierBadge, { backgroundColor: meta.color + '18' }]}>
                  <Text style={[styles.tierText, { color: meta.color }]}>{meta.name}</Text>
                </View>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Collateral Value</Text>
                <Text style={styles.previewValue}>${collateralValue.toFixed(2)}</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>LTV Ratio</Text>
                <Text style={styles.previewValue}>{ltv}%</Text>
              </View>

              <View style={styles.previewRow}>
                <Text style={styles.previewLabel}>Interest Rate</Text>
                <Text style={styles.previewValue}>{tierInfo?.interestRate || 0}% APR</Text>
              </View>

              <View style={[styles.previewRow, styles.previewHighlight]}>
                <Text style={styles.previewLabel}>You Receive</Text>
                <Text style={styles.previewBig}>
                  {loanAmount.toFixed(2)} {tier}
                </Text>
              </View>
            </View>
          )}

          {/* Tier Info */}
          <View style={styles.tiersCard}>
            <Text style={styles.tiersTitle}>Token Tiers</Text>
            {[
              { token: 'CLBg', min: '$5,000+', ltv: '60%', rate: '5%', color: '#F0B90B' },
              { token: 'CLBs', min: '$1,000+', ltv: '50%', rate: '8%', color: '#C0C0C0' },
              { token: 'CLB', min: '$100+', ltv: '40%', rate: '12%', color: '#3B82F6' },
            ].map((t) => (
              <View key={t.token} style={styles.tierRow}>
                <View style={[styles.tierDot, { backgroundColor: t.color }]} />
                <Text style={styles.tierName}>{t.token}</Text>
                <Text style={styles.tierDetail}>Min {t.min}</Text>
                <Text style={styles.tierDetail}>LTV {t.ltv}</Text>
                <Text style={styles.tierDetail}>{t.rate} APR</Text>
              </View>
            ))}
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleRequest}
            disabled={loading || collateralValue < 100}
            activeOpacity={0.85}
            style={{ marginTop: Spacing.lg }}
          >
            <LinearGradient
              colors={collateralValue >= 100 ? Colors.gradientPrimary : ['#333', '#222']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.submitBtn}
            >
              <Text style={[styles.submitText, collateralValue < 100 && { color: Colors.textMuted }]}>
                {loading ? 'Creating...' : 'Request Loan'}
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

  chainsRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg,
  },
  chainChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard, borderWidth: 1.5, borderColor: Colors.border,
  },
  chainText: { fontSize: 13, fontWeight: '800', color: Colors.textMuted },

  inputCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, padding: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  amountInput: {
    flex: 1, fontSize: 24, fontWeight: '800', color: Colors.textPrimary,
  },
  inputRight: { alignItems: 'flex-end' },
  inputCurrency: { fontSize: 14, fontWeight: '800', color: Colors.textMuted },
  inputUsd: { fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },

  priceHint: {
    fontSize: 12, fontWeight: '600', color: Colors.textMuted,
    paddingHorizontal: Spacing.lg, marginTop: 4,
  },

  previewCard: {
    margin: Spacing.lg, padding: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },
  previewTitle: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.md },
  previewRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  previewLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  previewValue: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  previewHighlight: {
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  previewBig: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99 },
  tierText: { fontSize: 12, fontWeight: '800' },

  tiersCard: {
    marginHorizontal: Spacing.lg, padding: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  tiersTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm },
  tierRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
  },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  tierName: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, width: 42 },
  tierDetail: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, flex: 1 },

  submitBtn: {
    marginHorizontal: Spacing.lg, paddingVertical: 18,
    borderRadius: Radius.lg, alignItems: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '900', color: '#000' },
});
