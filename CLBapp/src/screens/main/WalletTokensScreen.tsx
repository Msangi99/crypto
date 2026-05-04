import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Alert, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, Shadow } from '../../constants/theme';
import { tokensAPI } from '../../services/api';

const { width } = Dimensions.get('window');

const TOKEN_META: Record<string, { name: string; color: string; icon: string; tier: string }> = {
  CLBg: { name: 'CLB Gold', color: '#F0B90B', icon: 'diamond', tier: 'Gold' },
  CLBs: { name: 'CLB Silver', color: '#C0C0C0', icon: 'flash', tier: 'Silver' },
  CLB:  { name: 'CLB Token', color: '#3B82F6', icon: 'cube', tier: 'Standard' },
};

export default function WalletTokensScreen({ navigation }: any) {
  const [balances, setBalances] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [history, setHistory] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [balRes, histRes] = await Promise.all([
        tokensAPI.balances(),
        tokensAPI.history(1, 10),
      ]);
      setBalances(balRes.data.balances || []);
      setTotalValue(balRes.data.totalValueUsd || 0);
      setHistory(histRes.data.transfers || []);
    } catch (err) {
      console.log('Token fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const renderTokenCard = ({ item }: { item: any }) => {
    const meta = TOKEN_META[item.token] || TOKEN_META.CLB;
    return (
      <TouchableOpacity style={styles.tokenCard} activeOpacity={0.8}>
        <View style={styles.tokenRow}>
          <View style={[styles.tokenIconBg, { backgroundColor: meta.color + '18' }]}>
            <Ionicons name={meta.icon as any} size={22} color={meta.color} />
          </View>
          <View style={styles.tokenInfo}>
            <Text style={styles.tokenName}>{meta.name}</Text>
            <Text style={styles.tokenTier}>{meta.tier} Tier</Text>
          </View>
          <View style={styles.tokenValues}>
            <Text style={styles.tokenBalance}>{item.balance.toFixed(2)}</Text>
            <Text style={styles.tokenUsd}>${item.valueUsd.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.tokenDetails}>
          <View style={styles.tokenDetailItem}>
            <Text style={styles.detailLabel}>Available</Text>
            <Text style={styles.detailValue}>{item.available.toFixed(2)}</Text>
          </View>
          <View style={styles.tokenDetailItem}>
            <Text style={styles.detailLabel}>Locked</Text>
            <Text style={styles.detailValue}>{item.locked.toFixed(2)}</Text>
          </View>
          <View style={styles.tokenDetailItem}>
            <Text style={styles.detailLabel}>Price</Text>
            <Text style={styles.detailValue}>${item.priceUsd.toFixed(2)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderHistoryItem = ({ item }: { item: any }) => {
    const isOut = item.direction === 'OUT';
    return (
      <View style={styles.historyItem}>
        <View style={[styles.historyIcon, { backgroundColor: isOut ? 'rgba(255,71,87,0.1)' : 'rgba(0,210,106,0.1)' }]}>
          <Ionicons name={isOut ? 'arrow-up' : 'arrow-down'} size={16} color={isOut ? '#FF4757' : '#00D26A'} />
        </View>
        <View style={styles.historyInfo}>
          <Text style={styles.historyType}>{item.type.replace('_', ' ')}</Text>
          <Text style={styles.historyCounterparty}>{item.counterparty}</Text>
        </View>
        <View style={styles.historyAmountCol}>
          <Text style={[styles.historyAmount, { color: isOut ? '#FF4757' : '#00D26A' }]}>
            {isOut ? '-' : '+'}{item.amount.toFixed(2)}
          </Text>
          <Text style={styles.historyToken}>{item.token}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={balances}
        keyExtractor={(item) => item.token}
        renderItem={renderTokenCard}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Header */}
            <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>CLB Tokens</Text>
              <View style={{ width: 32 }} />
            </LinearGradient>

            {/* Total Value */}
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total CLB Value</Text>
              <Text style={styles.totalValue}>${totalValue.toFixed(2)}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('LoanRequest')}
              >
                <LinearGradient colors={Colors.gradientPrimary} style={styles.actionGradient}>
                  <Ionicons name="cash" size={20} color="#000" />
                  <Text style={styles.actionText}>Get Loan</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('TransferTokens')}
              >
                <View style={styles.actionOutline}>
                  <Ionicons name="send" size={20} color={Colors.primary} />
                  <Text style={styles.actionOutlineText}>Transfer</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => navigation.navigate('Withdraw')}
              >
                <View style={styles.actionOutline}>
                  <Ionicons name="download" size={20} color={Colors.primary} />
                  <Text style={styles.actionOutlineText}>Withdraw</Text>
                </View>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Your Tokens</Text>
          </>
        }
        ListFooterComponent={
          history.length > 0 ? (
            <View style={styles.historySection}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              {history.map((item) => (
                <View key={item.id}>{renderHistoryItem({ item })}</View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="wallet-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No CLB tokens yet</Text>
              <Text style={styles.emptySubtext}>Get a loan to receive CLB tokens</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  listContent: { paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },

  totalCard: {
    margin: Spacing.lg, padding: Spacing.xl, borderRadius: Radius.xl,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', ...Shadow.card,
  },
  totalLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  totalValue: { fontSize: 36, fontWeight: '900', color: Colors.primary, marginTop: 4 },

  actions: {
    flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg,
  },
  actionBtn: { flex: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  actionGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 6, borderRadius: Radius.lg,
  },
  actionText: { fontSize: 14, fontWeight: '800', color: '#000' },
  actionOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 6, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: 'rgba(240,185,11,0.3)',
    backgroundColor: 'rgba(240,185,11,0.04)',
  },
  actionOutlineText: { fontSize: 14, fontWeight: '800', color: Colors.primary },

  sectionTitle: {
    fontSize: 16, fontWeight: '800', color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg, marginBottom: Spacing.md,
  },

  tokenCard: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    padding: Spacing.md, borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
  },
  tokenRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tokenIconBg: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  tokenInfo: { flex: 1 },
  tokenName: { fontSize: 15, fontWeight: '800', color: Colors.textPrimary },
  tokenTier: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  tokenValues: { alignItems: 'flex-end' },
  tokenBalance: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  tokenUsd: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },

  tokenDetails: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  tokenDetailItem: { alignItems: 'center' },
  detailLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  detailValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },

  historySection: { marginTop: Spacing.lg },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  historyIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  historyInfo: { flex: 1 },
  historyType: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary, textTransform: 'capitalize' },
  historyCounterparty: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  historyAmountCol: { alignItems: 'flex-end' },
  historyAmount: { fontSize: 14, fontWeight: '800' },
  historyToken: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  emptySubtext: { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
});
