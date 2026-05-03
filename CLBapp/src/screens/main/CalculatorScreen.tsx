import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Button from '../../components/ui/Button';
import { userAPI } from '../../services/api';

const ASSETS = ['BTC', 'ETH'];

export default function CalculatorScreen() {
  const [depositUsd, setDepositUsd] = useState('100');
  const [asset, setAsset] = useState('BTC');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    setLoading(true);
    try {
      const res = await userAPI.calculator(Number(depositUsd), asset);
      setResult(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={[Colors.bg, Colors.bg]} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profit Calculator</Text>
        <Text style={styles.subtitle}>Estimate your leverage & returns</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: Spacing.lg }}>

          {/* Asset selector */}
          <View style={styles.group}>
            <Text style={styles.label}>Target Asset</Text>
            <View style={styles.assetRow}>
              {ASSETS.map((a) => (
                <TouchableOpacity key={a} onPress={() => setAsset(a)} style={[styles.assetBtn, asset === a && styles.assetBtnActive]}>
                  <Text style={[styles.assetBtnText, asset === a && styles.assetBtnTextActive]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Deposit amount */}
          <View style={styles.group}>
            <Text style={styles.label}>Deposit Amount (USD)</Text>
            <View style={styles.inputRow}>
              <Text style={styles.inputPrefix}>$</Text>
              <TextInput
                value={depositUsd}
                onChangeText={setDepositUsd}
                keyboardType="numeric"
                style={styles.input}
                placeholderTextColor={Colors.textMuted}
                returnKeyType="done"
              />
              <Text style={styles.inputSuffix}>USDT</Text>
            </View>
            <Text style={styles.hintText}>Leverage auto-calculated: $100→10x, $200→15x ... $1000→60x</Text>
          </View>

          <Button label="Calculate Returns" onPress={calculate} loading={loading} fullWidth variant="primary" />

          {/* Result */}
          {result && <CalcResult result={result} asset={asset} />}

          <View style={{ height: 80 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function CalcResult({ result, asset }: { result: any; asset: string }) {
  const LIQUIDATION_LABELS: Record<string, { phase1: number; phase2: number }> = {
    BTC: { phase1: 150000, phase2: 200000 },
    ETH: { phase1: 15000, phase2: 20000 },
  };
  const targets = LIQUIDATION_LABELS[asset] ?? { phase1: 0, phase2: 0 };

  return (
    <View style={styles.resultSection}>
      <Text style={styles.resultTitle}>Projected Returns</Text>

      {/* Summary row */}
      <LinearGradient colors={Colors.gradientCard} style={styles.summaryRow}>
        <ResultStat label="Deposit" value={`$${result.depositUsd}`} />
        <ResultStat label="Leverage" value={`${result.leverage}x`} accent />
        <ResultStat label="Loan Value" value={`$${result.loanUsd?.toLocaleString()}`} gold />
      </LinearGradient>

      {/* Phase cards */}
      {['phase1', 'phase2'].map((ph, i) => {
        const p = result[ph];
        const isP2 = i === 1;
        return (
          <LinearGradient key={ph} colors={isP2 ? ['#1D1A10', '#1A1A1A'] : Colors.gradientCard} style={[styles.phaseResult, isP2 && { borderColor: 'rgba(240,185,11,0.3)' }]}>
            <View style={styles.phaseResultHeader}>
              <View style={[styles.phaseDot, { backgroundColor: isP2 ? Colors.gold : Colors.success }]} />
              <Text style={[styles.phaseResultTitle, { color: isP2 ? Colors.gold : Colors.success }]}>
                Phase {i + 1} — ${(targets as any)[`phase${i + 1}`].toLocaleString()}
              </Text>
            </View>
            <View style={styles.phaseResultGrid}>
              <PhaseResultRow label="Gross Value" value={`$${p?.grossValue?.toFixed(2) ?? '0.00'}`} />
              <PhaseResultRow label="Gross Profit" value={`$${p?.grossProfit?.toFixed(2) ?? '0.00'}`} positive />
              <PhaseResultRow label="Platform Fee (15%)" value={`-$${p?.platformFee?.toFixed(2) ?? '0.00'}`} negative />
              <View style={styles.phaseResultDivider} />
              <PhaseResultRow
                label="Your Profit (85%)"
                value={`$${p?.userProfit?.toFixed(2) ?? '0.00'}`}
                positive
                large
              />
            </View>
          </LinearGradient>
        );
      })}

      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color={Colors.textMuted} />
        <Text style={styles.disclaimerText}>
          Projections are based on target prices. Actual returns may vary. Not financial advice.
        </Text>
      </View>
    </View>
  );
}

function ResultStat({ label, value, accent, gold }: { label: string; value: string; accent?: boolean; gold?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{label}</Text>
      <Text style={{
        fontSize: FontSize.md, fontWeight: '700',
        color: gold ? Colors.gold : accent ? Colors.primary : Colors.textPrimary,
      }}>{value}</Text>
    </View>
  );
}

function PhaseResultRow({ label, value, positive, negative, large }: {
  label: string; value: string; positive?: boolean; negative?: boolean; large?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 }}>
      <Text style={{ fontSize: large ? FontSize.sm : FontSize.xs, color: large ? Colors.textSecondary : Colors.textMuted, fontWeight: large ? '600' : '400' }}>{label}</Text>
      <Text style={{
        fontSize: large ? FontSize.md : FontSize.sm,
        fontWeight: large ? '800' : '600',
        color: positive ? Colors.success : negative ? Colors.error : Colors.textPrimary,
      }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.lg, gap: 4 },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted },
  group: { gap: 10 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '600' },
  assetRow: { flexDirection: 'row', gap: Spacing.sm },
  assetBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.lg, alignItems: 'center',
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  assetBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(240,185,11,0.12)' },
  assetBtnText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textMuted },
  assetBtnTextActive: { color: Colors.primary },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, paddingHorizontal: Spacing.md,
  },
  inputPrefix: { fontSize: FontSize.lg, color: Colors.textMuted, marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: '700' },
  inputSuffix: { fontSize: FontSize.sm, color: Colors.textMuted, marginLeft: 8 },
  hintText: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 6 },
  tierGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tierBtn: {
    width: '18%', paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  tierBtnActive: { borderColor: Colors.gold, backgroundColor: 'rgba(240,185,11,0.1)' },
  tierBtnText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textMuted },
  tierBtnTextActive: { color: Colors.gold },
  resultSection: { gap: Spacing.md },
  resultTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  summaryRow: {
    flexDirection: 'row', borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: 0,
  },
  phaseResult: {
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  phaseResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phaseDot: { width: 10, height: 10, borderRadius: 5 },
  phaseResultTitle: { fontSize: FontSize.md, fontWeight: '700' },
  phaseResultGrid: { gap: 0 },
  phaseResultDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },
  disclaimer: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  disclaimerText: { flex: 1, fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 16 },
});
