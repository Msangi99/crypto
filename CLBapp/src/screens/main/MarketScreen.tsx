import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TextInput, TouchableOpacity, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { userAPI } from '../../services/api';
import { useLivePrices } from '../../hooks/useLivePrices';

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
  const [activeFilter, setActiveFilter] = useState('All');

  const load = useCallback(async () => {
    try {
      const res = await userAPI.market();
      setData(res.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { load(); }, []);

  const baseCoins = data?.market?.coins ?? [];
  const livePrices = useLivePrices(baseCoins.map((c: any) => c.symbol));
  const allCoins = baseCoins.map((c: any) => {
    const live = livePrices[c.symbol];
    return live ? { ...c, price: live.price, change24h: live.change24h } : c;
  });
  const targets = data?.market?.targets ?? {};

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const gainers = [...allCoins].sort((a: any, b: any) => (b.change24h ?? 0) - (a.change24h ?? 0)).slice(0, 3);
  const losers = [...allCoins].sort((a: any, b: any) => (a.change24h ?? 0) - (b.change24h ?? 0)).slice(0, 3);

  const filteredCoins = (() => {
    let result = [...allCoins];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c: any) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
    }
    if (activeFilter === 'Gainers') result.sort((a: any, b: any) => (b.change24h ?? 0) - (a.change24h ?? 0));
    else if (activeFilter === 'Losers') result.sort((a: any, b: any) => (a.change24h ?? 0) - (b.change24h ?? 0));
    else if (activeFilter === 'Market Cap') result.sort((a: any, b: any) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    return result;
  })();

  const filters = ['All', 'Gainers', 'Losers', 'Market Cap'];

  return (
    <View style={styles.container}>
      {/* Dark Gradient Header */}
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
        <View style={styles.header}>
          <Text style={styles.title}>Markets</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Market Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Ionicons name="trending-up" size={14} color="#00D6A1" />
            <Text style={styles.summaryValue}>{gainers[0]?.symbol ?? '—'}</Text>
            <Text style={[styles.summaryChange, { color: '#00D6A1' }]}>+{((gainers[0]?.change24h ?? 0)).toFixed(2)}%</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="trending-down" size={14} color="#FF4757" />
            <Text style={styles.summaryValue}>{losers[0]?.symbol ?? '—'}</Text>
            <Text style={[styles.summaryChange, { color: '#FF4757' }]}>{((losers[0]?.change24h ?? 0)).toFixed(2)}%</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Ionicons name="pricetag-outline" size={14} color={Colors.primary} />
            <Text style={styles.summaryValue}>{allCoins.length}</Text>
            <Text style={styles.summaryChange}>Tracked</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
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
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setActiveFilter(f)}
            style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
          >
            <Text style={[styles.filterTabText, activeFilter === f && styles.filterTabTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Top Gainers Section */}
        {gainers.length > 0 && !searchQuery && activeFilter === 'All' && (
          <View style={styles.trendingSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🔥 Top Gainers</Text>
            </View>
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
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>⚡ Liquidation Targets</Text>
          </View>
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
              <View key={asset} style={styles.targetCard}>
                <View style={[styles.targetIconWrap, { backgroundColor: color + '22' }]}>
                  <Text style={[styles.targetIconChar, { color }]}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.targetAssetName}>{asset}</Text>
                  <Text style={styles.targetCurrentPrice}>{formatPrice(currentPrice)}</Text>
                </View>
                <View style={styles.targetPhases}>
                  <View style={styles.targetPhaseRow}>
                    <View style={[styles.phaseDot, { backgroundColor: '#00D6A1' }]} />
                    <Text style={[styles.phaseLabel, { color: '#00D6A1' }]}>P1</Text>
                    <Text style={styles.phaseValue}>${(t.phase1 ?? 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.targetPhaseRow}>
                    <View style={[styles.phaseDot, { backgroundColor: Colors.primary }]} />
                    <Text style={[styles.phaseLabel, { color: Colors.primary }]}>P2</Text>
                    <Text style={[styles.phaseValue, { color: Colors.primary }]}>${(t.phase2 ?? 0).toLocaleString()}</Text>
                  </View>
                </View>
              </View>
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
    <View style={styles.trendingChip}>
      <View style={[styles.chipIcon, { backgroundColor: (coin.color || Colors.primary) + '22' }]}>
        <Text style={[styles.chipIconText, { color: coin.color || Colors.primary }]}>
          {coin.icon || COIN_ICONS[coin.symbol] || coin.symbol[0]}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.chipSymbol}>{coin.symbol}</Text>
        <Text style={styles.chipName}>{coin.name}</Text>
      </View>
      <View style={[styles.chipChangeBadge, { backgroundColor: isUp ? 'rgba(0,214,161,0.12)' : 'rgba(255,71,87,0.12)' }]}>
        <Ionicons name={isUp ? 'caret-up' : 'caret-down'} size={10} color={isUp ? '#00D6A1' : '#FF4757'} />
        <Text style={[styles.chipChange, { color: isUp ? '#00D6A1' : '#FF4757' }]}>
          {isUp ? '+' : ''}{change.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

function CoinRow({ coin, rank }: { coin: any; rank: number }) {
  const change = coin.change24h ?? 0;
  const isUp = change >= 0;

  return (
    <View style={styles.coinRow}>
      <Text style={styles.rankText}>{rank}</Text>

      <View style={[styles.coinIconWrap, { backgroundColor: (coin.color || Colors.primary) + '22' }]}>
        <Text style={[styles.coinIconChar, { color: coin.color || Colors.primary }]}>
          {coin.icon || COIN_ICONS[coin.symbol] || coin.symbol[0]}
        </Text>
      </View>

      <View style={styles.coinInfo}>
        <Text style={styles.coinSymbol}>{coin.symbol}</Text>
        <Text style={styles.coinNameText}>{coin.name}</Text>
        {coin.marketCap ? <Text style={styles.coinMcap}>{formatMarketCap(coin.marketCap)}</Text> : null}
      </View>

      <View style={styles.sparklineWrap}>
        <Sparkline change24h={change} />
      </View>

      <View style={styles.coinPriceWrap}>
        <Text style={styles.coinPriceText}>{formatPrice(coin.price ?? 0)}</Text>
        <View style={[styles.changePill, { backgroundColor: isUp ? 'rgba(0,214,161,0.12)' : 'rgba(255,71,87,0.12)' }]}>
          <Ionicons name={isUp ? 'caret-up' : 'caret-down'} size={10} color={isUp ? '#00D6A1' : '#FF4757'} />
          <Text style={[styles.changePillText, { color: isUp ? '#00D6A1' : '#FF4757' }]}>
            {Math.abs(change).toFixed(2)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header Gradient
  headerGradient: { paddingBottom: Spacing.md },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  refreshBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center',
  },

  // Summary Row
  summaryRow: {
    flexDirection: 'row', marginHorizontal: Spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  summaryChange: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Search
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: { flex: 1, fontSize: 14, color: Colors.textPrimary },

  // Filter Tabs
  filterRow: {
    flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  filterTabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTabText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  filterTabTextActive: { color: '#000' },

  // Section
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },

  // Trending
  trendingSection: { marginBottom: Spacing.lg },
  trendingScroll: { paddingHorizontal: Spacing.lg },
  trendingChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, marginRight: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, minWidth: 180,
  },
  chipIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chipIconText: { fontSize: 16, fontWeight: '800' },
  chipSymbol: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  chipName: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  chipChangeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
  },
  chipChange: { fontSize: 12, fontWeight: '700' },

  // List Header
  listHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  listHeaderText: { fontSize: 11, color: Colors.textMuted, fontWeight: '700', flex: 1, textTransform: 'uppercase' },
  listHeaderRight: { fontSize: 11, color: Colors.textMuted, fontWeight: '700', textAlign: 'right', width: 120, textTransform: 'uppercase' },

  // Coin Row
  coinRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  rankText: { width: 20, fontSize: 12, color: Colors.textMuted, fontWeight: '700', textAlign: 'center' },
  coinIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  coinIconChar: { fontSize: 16, fontWeight: '800' },
  coinInfo: { flex: 1, gap: 1 },
  coinSymbol: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  coinNameText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  coinMcap: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  sparklineWrap: { marginHorizontal: 4 },
  coinPriceWrap: { width: 120, alignItems: 'flex-end', gap: 4 },
  coinPriceText: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  changePill: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
  },
  changePillText: { fontSize: 11, fontWeight: '700' },

  // Target Section
  targetSection: { paddingHorizontal: Spacing.lg, marginTop: Spacing.lg, gap: Spacing.md },
  infoBanner: {
    flexDirection: 'row', gap: 8, backgroundColor: 'rgba(240,185,11,0.08)',
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.15)',
    borderRadius: Radius.md, padding: Spacing.md, alignItems: 'flex-start',
  },
  infoBannerText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  targetCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  targetIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  targetIconChar: { fontSize: 20, fontWeight: '800' },
  targetAssetName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  targetCurrentPrice: { fontSize: 12, color: Colors.textMuted, marginTop: 2, fontWeight: '600' },
  targetPhases: { alignItems: 'flex-end', gap: 6 },
  targetPhaseRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phaseDot: { width: 6, height: 6, borderRadius: 3 },
  phaseLabel: { fontSize: 12, fontWeight: '700' },
  phaseValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },
});
