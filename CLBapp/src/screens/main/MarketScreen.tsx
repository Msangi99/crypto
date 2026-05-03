import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { userAPI } from '../../services/api';

const COIN_ICONS: Record<string, string> = {
  bitcoin: '₿', ethereum: 'Ξ', bnb: 'B', binancecoin: 'B',
};

const COIN_COLORS: Record<string, string[]> = {
  bitcoin: ['#F7931A', '#E07B00'],
  ethereum: ['#627EEA', '#3C5FBF'],
  bnb: ['#F3BA2F', '#D4A020'],
  binancecoin: ['#F3BA2F', '#D4A020'],
};

export default function MarketScreen() {
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await userAPI.market();
      setData(res.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const prices = data?.prices ?? {};
  const coins = Object.entries(prices);

  return (
    <LinearGradient colors={['#0D0D0D', '#0D0D0D']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Market</Text>
        <Text style={styles.subtitle}>Prices update every minute</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: Spacing.md }}
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="pulse-outline" size={16} color={Colors.success} />
          <Text style={styles.infoBannerText}>
            CLB uses BTC &amp; ETH as liquidation target assets. BNB is the deposit currency.
          </Text>
        </View>

        {coins.map(([coin, cd]: any) => (
          <CoinCard key={coin} coin={coin} data={cd} />
        ))}

        {/* Liquidation Targets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liquidation Targets</Text>
          {[
            { asset: 'BTC', phase1: 150000, phase2: 200000, icon: '₿', color: '#F7931A' },
            { asset: 'ETH', phase1: 15000, phase2: 20000, icon: 'Ξ', color: '#627EEA' },
          ].map((t) => (
            <LinearGradient key={t.asset} colors={Colors.gradientCard} style={styles.targetCard}>
              <View style={[styles.targetIcon, { backgroundColor: t.color + '22' }]}>
                <Text style={[styles.targetIconText, { color: t.color }]}>{t.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.targetAsset}>{t.asset} Targets</Text>
                <Text style={styles.targetDesc}>Phase 1 · Phase 2</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <View style={styles.targetPhase}>
                  <Text style={styles.targetPhaseLabel}>P1</Text>
                  <Text style={styles.targetPhaseValue}>${t.phase1.toLocaleString()}</Text>
                </View>
                <View style={styles.targetPhase}>
                  <Text style={[styles.targetPhaseLabel, { color: Colors.gold }]}>P2</Text>
                  <Text style={[styles.targetPhaseValue, { color: Colors.gold }]}>${t.phase2.toLocaleString()}</Text>
                </View>
              </View>
            </LinearGradient>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function CoinCard({ coin, data }: { coin: string; data: any }) {
  const change = data.change24h ?? 0;
  const isUp = change >= 0;
  const grad = (COIN_COLORS[coin] ?? [Colors.primary, Colors.primaryDark]) as [string, string];

  return (
    <LinearGradient colors={Colors.gradientCard} style={styles.coinCard}>
      <LinearGradient colors={grad} style={styles.coinIcon}>
        <Text style={styles.coinIconText}>{COIN_ICONS[coin] ?? coin[0].toUpperCase()}</Text>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={styles.coinName}>{coin.toUpperCase()}</Text>
        <Text style={styles.coinFullName}>{data.name ?? coin}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={styles.coinPrice}>${Number(data.price ?? 0).toLocaleString()}</Text>
        <View style={[styles.changeBadge, { backgroundColor: isUp ? Colors.successBg : Colors.errorBg }]}>
          <Ionicons name={isUp ? 'trending-up' : 'trending-down'} size={12} color={isUp ? Colors.success : Colors.error} />
          <Text style={[styles.changeText, { color: isUp ? Colors.success : Colors.error }]}>
            {isUp ? '+' : ''}{change.toFixed(2)}%
          </Text>
        </View>
      </View>

      <View style={styles.coinStats}>
        <CoinStat label="24h High" value={`$${Number(data.high24h ?? 0).toLocaleString()}`} />
        <CoinStat label="24h Low" value={`$${Number(data.low24h ?? 0).toLocaleString()}`} />
        <CoinStat label="Market Cap" value={formatBig(data.marketCap ?? 0)} />
      </View>
    </LinearGradient>
  );
}

function CoinStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary }}>{value}</Text>
    </View>
  );
}

function formatBig(n: number) {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.lg, gap: 4 },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textMuted },
  infoBanner: {
    flexDirection: 'row', gap: 8, backgroundColor: Colors.successBg,
    borderRadius: Radius.md, padding: Spacing.md, alignItems: 'flex-start',
  },
  infoBannerText: { flex: 1, fontSize: FontSize.xs, color: Colors.success, lineHeight: 16 },
  coinCard: {
    borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, gap: Spacing.md,
    flexWrap: 'wrap',
  },
  coinIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  coinIconText: { fontSize: FontSize.xl, fontWeight: '800', color: '#fff' },
  coinName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  coinFullName: { fontSize: FontSize.xs, color: Colors.textMuted, textTransform: 'capitalize' },
  coinPrice: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  changeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full,
  },
  changeText: { fontSize: FontSize.xs, fontWeight: '700' },
  coinStats: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  targetCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  targetIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  targetIconText: { fontSize: FontSize.xl, fontWeight: '800' },
  targetAsset: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  targetDesc: { fontSize: FontSize.xs, color: Colors.textMuted },
  targetPhase: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  targetPhaseLabel: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '700' },
  targetPhaseValue: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
});
