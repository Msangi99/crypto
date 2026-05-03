import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { userAPI } from '../../services/api';

// Icons will come from backend now, but keep as fallback
const COIN_ICONS: Record<string, string> = {
  BTC: '₿', ETH: 'Ξ', BNB: 'B', SOL: '◎', ADA: '₳', DOGE: 'Ð',
  DOT: '●', MATIC: '⬡', AVAX: '▲', LINK: '🔗', UNI: '🦄', XRP: '✕', LTC: 'Ł',
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

  const coins = data?.coins ?? [];

  return (
    <LinearGradient colors={[Colors.bg, Colors.bg]} style={styles.container}>
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

        {coins.map((coin: any) => (
          <CoinCard key={coin.symbol} coin={coin} />
        ))}

        {/* Liquidation Targets */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liquidation Targets</Text>
          {data?.targets && Object.entries(data.targets).map(([asset, targets]: any) => {
            const coin = coins.find((c: any) => c.symbol === asset);
            const icon = coin?.icon || COIN_ICONS[asset] || asset[0];
            const color = coin?.color || Colors.gold;
            return (
              <LinearGradient key={asset} colors={Colors.gradientCard} style={styles.targetCard}>
                <View style={[styles.targetIcon, { backgroundColor: color + '22' }]}>
                  <Text style={[styles.targetIconText, { color }]}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.targetAsset}>{asset} Targets</Text>
                  <Text style={styles.targetDesc}>Phase 1 · Phase 2</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={styles.targetPhase}>
                    <Text style={styles.targetPhaseLabel}>P1</Text>
                    <Text style={styles.targetPhaseValue}>${targets.phase1.toLocaleString()}</Text>
                  </View>
                  <View style={styles.targetPhase}>
                    <Text style={[styles.targetPhaseLabel, { color: Colors.gold }]}>P2</Text>
                    <Text style={[styles.targetPhaseValue, { color: Colors.gold }]}>${targets.phase2.toLocaleString()}</Text>
                  </View>
                </View>
              </LinearGradient>
            );
          })}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function CoinCard({ coin }: { coin: any }) {
  const change = coin.change24h ?? 0;
  const isUp = change >= 0;
  const grad = [coin.color || Colors.primary, coin.colorDark || Colors.primaryDark] as [string, string];

  return (
    <LinearGradient colors={Colors.gradientCard} style={styles.coinCard}>
      <LinearGradient colors={grad} style={styles.coinIcon}>
        <Text style={styles.coinIconText}>{coin.icon || COIN_ICONS[coin.symbol] || coin.symbol[0]}</Text>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={styles.coinName}>{coin.symbol}</Text>
        <Text style={styles.coinFullName}>{coin.name}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        <Text style={styles.coinPrice}>${Number(coin.price ?? 0).toLocaleString()}</Text>
        <View style={[styles.changeBadge, { backgroundColor: isUp ? Colors.successBg : Colors.errorBg }]}>
          <Ionicons name={isUp ? 'trending-up' : 'trending-down'} size={12} color={isUp ? Colors.success : Colors.error} />
          <Text style={[styles.changeText, { color: isUp ? Colors.success : Colors.error }]}>
            {isUp ? '+' : ''}{change.toFixed(2)}%
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
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
