import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TextInput, TouchableOpacity, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { userAPI } from '../../services/api';

const COIN_ICONS: Record<string, string> = {
  BTC: '₿', ETH: 'Ξ', BNB: 'B', SOL: '◎', ADA: '₳', DOGE: 'Ð',
  DOT: '●', MATIC: '⬡', AVAX: '▲', LINK: '🔗', UNI: '🦄', XRP: '✕', LTC: 'Ł',
};

// Sparkline SVG-like component using View bars
function Sparkline({ change24h, width = 60, height = 24 }: { change24h: number; width?: number; height?: number }) {
  const isUp = change24h >= 0;
  const color = isUp ? Colors.success : Colors.error;
  // Generate pseudo-random bars based on change
  const bars = 8;
  const barWidth = (width - (bars - 1) * 2) / bars;
  const baseHeight = height * 0.3;
  const amplitude = height * 0.35;

  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
      {Array.from({ length: bars }).map((_, i) => {
        // Create a trend pattern: rising if up, falling if down
        const progress = i / (bars - 1);
        const trend = isUp ? progress : 1 - progress;
        const noise = Math.sin(i * 1.7 + change24h) * 0.3;
        const barH = baseHeight + amplitude * (trend + noise * 0.5);
        return (
          <View
            key={i}
            style={{
              width: barWidth,
              height: Math.max(4, Math.min(barH, height)),
              backgroundColor: color,
              borderRadius: 1.5,
              opacity: 0.4 + progress * 0.6,
            }}
          />
        );
      })}
    </View>
  );
}

function formatMarketCap(val: number): string {
  if (val >= 1e12) return `$${(val / 1e12).toFixed(1)}T`;
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${val.toLocaleString()}`;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

export default function MarketScreen() {
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'watchlist'>('all');

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

  const allCoins = data?.market?.coins ?? [];
  const targets = data?.market?.targets ?? {};

  const filteredCoins = allCoins.filter((c: any) =>
    c.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Top gainers
  const gainers = [...allCoins].sort((a: any, b: any) => (b.change24h ?? 0) - (a.change24h ?? 0)).slice(0, 3);
  // Top losers
  const losers = [...allCoins].sort((a: any, b: any) => (a.change24h ?? 0) - (b.change24h ?? 0)).slice(0, 3);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Markets</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search coins..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Market Overview Cards */}
        <View style={styles.overviewRow}>
          <LinearGradient colors={Colors.gradientCard} style={styles.overviewCard}>
            <Ionicons name="trending-up" size={16} color={Colors.success} />
            <Text style={styles.overviewLabel}>Top Gainer</Text>
            <Text style={styles.overviewValue}>{gainers[0]?.symbol ?? '—'}</Text>
            <Text style={[styles.overviewChange, { color: Colors.success }]}>
              +{((gainers[0]?.change24h ?? 0)).toFixed(2)}%
            </Text>
          </LinearGradient>
          <LinearGradient colors={Colors.gradientCard} style={styles.overviewCard}>
            <Ionicons name="trending-down" size={16} color={Colors.error} />
            <Text style={styles.overviewLabel}>Top Loser</Text>
            <Text style={styles.overviewValue}>{losers[0]?.symbol ?? '—'}</Text>
            <Text style={[styles.overviewChange, { color: Colors.error }]}>
              {((losers[0]?.change24h ?? 0)).toFixed(2)}%
            </Text>
          </LinearGradient>
          <LinearGradient colors={Colors.gradientCard} style={styles.overviewCard}>
            <Ionicons name="pricetag-outline" size={16} color={Colors.primary} />
            <Text style={styles.overviewLabel}>Coins</Text>
            <Text style={styles.overviewValue}>{allCoins.length}</Text>
            <Text style={styles.overviewChange}>Tracked</Text>
          </LinearGradient>
        </View>

        {/* Top Gainers Section */}
        {gainers.length > 0 && !searchQuery && (
          <View style={styles.trendingSection}>
            <Text style={styles.trendingTitle}>🔥 Top Gainers</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendingScroll}>
              {gainers.map((coin: any) => (
                <TrendingChip key={coin.symbol} coin={coin} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Coin List Header */}
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>Coin</Text>
          <Text style={styles.listHeaderRight}>Price / 24h</Text>
        </View>

        {/* Coin List */}
        {filteredCoins.map((coin: any, index: number) => (
          <CoinRow key={coin.symbol} coin={coin} rank={index + 1} />
        ))}

        {/* Liquidation Targets */}
        <View style={styles.targetSection}>
          <Text style={styles.targetSectionTitle}>⚡ CLB Liquidation Targets</Text>
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
            <Text style={styles.infoBannerText}>
              BTC & ETH are target assets. BNB is the deposit currency. Targets trigger phased liquidation.
            </Text>
          </View>
          {Object.entries(targets).map(([asset, t]: any) => {
            const coin = allCoins.find((c: any) => c.symbol === asset);
            const icon = coin?.icon || COIN_ICONS[asset] || asset[0];
            const color = coin?.color || Colors.gold;
            const currentPrice = coin?.price ?? 0;
            return (
              <LinearGradient key={asset} colors={Colors.gradientCard} style={styles.targetCard}>
                <View style={[styles.targetIconWrap, { backgroundColor: color + '22' }]}>
                  <Text style={[styles.targetIconChar, { color }]}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.targetAssetName}>{asset}</Text>
                  <Text style={styles.targetCurrentPrice}>{formatPrice(currentPrice)}</Text>
                </View>
                <View style={styles.targetPhases}>
                  <View style={styles.targetPhaseRow}>
                    <View style={[styles.phaseDot, { backgroundColor: Colors.success }]} />
                    <Text style={styles.phaseLabel}>P1</Text>
                    <Text style={styles.phaseValue}>${(t.phase1 ?? 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.targetPhaseRow}>
                    <View style={[styles.phaseDot, { backgroundColor: Colors.gold }]} />
                    <Text style={[styles.phaseLabel, { color: Colors.gold }]}>P2</Text>
                    <Text style={[styles.phaseValue, { color: Colors.gold }]}>${(t.phase2 ?? 0).toLocaleString()}</Text>
                  </View>
                </View>
              </LinearGradient>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function TrendingChip({ coin }: { coin: any }) {
  const change = coin.change24h ?? 0;
  const isUp = change >= 0;
  return (
    <LinearGradient colors={Colors.gradientCard} style={styles.trendingChip}>
      <View style={[styles.chipIcon, { backgroundColor: (coin.color || Colors.primary) + '22' }]}>
        <Text style={[styles.chipIconText, { color: coin.color || Colors.primary }]}>
          {coin.icon || COIN_ICONS[coin.symbol] || coin.symbol[0]}
        </Text>
      </View>
      <Text style={styles.chipSymbol}>{coin.symbol}</Text>
      <Text style={[styles.chipChange, { color: isUp ? Colors.success : Colors.error }]}>
        {isUp ? '+' : ''}{change.toFixed(2)}%
      </Text>
    </LinearGradient>
  );
}

function CoinRow({ coin, rank }: { coin: any; rank: number }) {
  const change = coin.change24h ?? 0;
  const isUp = change >= 0;
  const changeColor = isUp ? Colors.success : Colors.error;

  return (
    <View style={styles.coinRow}>
      {/* Rank */}
      <Text style={styles.rankText}>{rank}</Text>

      {/* Icon */}
      <View style={[styles.coinIconWrap, { backgroundColor: (coin.color || Colors.primary) + '22' }]}>
        <Text style={[styles.coinIconChar, { color: coin.color || Colors.primary }]}>
          {coin.icon || COIN_ICONS[coin.symbol] || coin.symbol[0]}
        </Text>
      </View>

      {/* Name + Symbol + Market Cap */}
      <View style={styles.coinInfo}>
        <Text style={styles.coinSymbol}>{coin.symbol}</Text>
        <Text style={styles.coinNameText}>{coin.name}</Text>
        {coin.marketCap ? <Text style={styles.coinMcap}>{formatMarketCap(coin.marketCap)}</Text> : null}
      </View>

      {/* Sparkline */}
      <View style={styles.sparklineWrap}>
        <Sparkline change24h={change} />
      </View>

      {/* Price + Change */}
      <View style={styles.coinPriceWrap}>
        <Text style={styles.coinPriceText}>{formatPrice(coin.price ?? 0)}</Text>
        <View style={[styles.changePill, { backgroundColor: isUp ? Colors.successBg : Colors.errorBg }]}>
          <Ionicons name={isUp ? 'caret-up' : 'caret-down'} size={10} color={changeColor} />
          <Text style={[styles.changePillText, { color: changeColor }]}>
            {Math.abs(change).toFixed(2)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 0.5 },
  headerRight: { flexDirection: 'row', gap: Spacing.sm },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // Search
  searchContainer: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md, height: 44,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: FontSize.md, height: 44 },

  // Overview Cards
  overviewRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  overviewCard: {
    flex: 1, borderRadius: Radius.lg, padding: Spacing.md, gap: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  overviewLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', textTransform: 'uppercase' },
  overviewValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.textPrimary },
  overviewChange: { fontSize: FontSize.xs, fontWeight: '700' },

  // Trending
  trendingSection: { marginBottom: Spacing.lg },
  trendingTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  trendingScroll: { paddingHorizontal: Spacing.lg },
  trendingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: Radius.lg, padding: Spacing.md, marginRight: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, minWidth: 140,
  },
  chipIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chipIconText: { fontSize: FontSize.md, fontWeight: '800' },
  chipSymbol: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
  chipChange: { fontSize: FontSize.xs, fontWeight: '700' },

  // List Header
  listHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  listHeaderText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', flex: 1 },
  listHeaderRight: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', textAlign: 'right', width: 120 },

  // Coin Row (Binance/Trust Wallet style)
  coinRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border + '40',
  },
  rankText: { width: 20, fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600', textAlign: 'center' },
  coinIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  coinIconChar: { fontSize: FontSize.md, fontWeight: '800' },
  coinInfo: { flex: 1, gap: 1 },
  coinSymbol: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  coinNameText: { fontSize: FontSize.xs, color: Colors.textMuted },
  coinMcap: { fontSize: 9, color: Colors.textMuted, marginTop: 1 },
  sparklineWrap: { marginHorizontal: 4 },
  coinPriceWrap: { width: 110, alignItems: 'flex-end', gap: 4 },
  coinPriceText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  changePill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full,
  },
  changePillText: { fontSize: 10, fontWeight: '700' },

  // Target Section
  targetSection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, gap: Spacing.md },
  targetSectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.textPrimary },
  infoBanner: {
    flexDirection: 'row', gap: 8, backgroundColor: 'rgba(240,185,11,0.08)',
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.15)',
    borderRadius: Radius.md, padding: Spacing.md, alignItems: 'flex-start',
  },
  infoBannerText: { flex: 1, fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  targetCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  targetIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  targetIconChar: { fontSize: FontSize.xl, fontWeight: '800' },
  targetAssetName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textPrimary },
  targetCurrentPrice: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  targetPhases: { alignItems: 'flex-end', gap: 6 },
  targetPhaseRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phaseDot: { width: 6, height: 6, borderRadius: 3 },
  phaseLabel: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '700' },
  phaseValue: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textPrimary },
});
