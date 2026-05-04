import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { loansAPI } from '../../services/api';

const CLB_LOGO = require('../../../assets/clb-token.png');

const STATUS_META: Record<string, { color: string; icon: string; label: string }> = {
  PENDING:    { color: '#F0B90B', icon: 'time', label: 'Pending' },
  ACTIVE:     { color: '#00D26A', icon: 'checkmark-circle', label: 'Active' },
  SETTLED:    { color: '#3B82F6', icon: 'flag', label: 'Settled' },
  LIQUIDATED: { color: '#FF4757', icon: 'alert-circle', label: 'Liquidated' },
  CANCELLED:  { color: '#6B6B6B', icon: 'close-circle', label: 'Cancelled' },
  REPAID:     { color: '#A855F7', icon: 'checkmark-done', label: 'Repaid' },
};

const TOKEN_COLORS: Record<string, string> = {
  CLBg: '#F0B90B',
  CLBs: '#C0C0C0',
  CLB: '#3B82F6',
};

export default function MyLoansScreen({ navigation }: any) {
  const [loans, setLoans] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLoans = useCallback(async () => {
    try {
      const res = await loansAPI.list();
      setLoans(res.data.loans || []);
    } catch (err) {
      console.log('Loans fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLoans();
    setRefreshing(false);
  };

  const renderLoan = ({ item }: { item: any }) => {
    const status = STATUS_META[item.status] || STATUS_META.PENDING;
    const tokenColor = TOKEN_COLORS[item.loanToken] || '#3B82F6';

    return (
      <TouchableOpacity style={styles.loanCard} activeOpacity={0.8}>
        <View style={styles.loanHeader}>
          <View style={styles.loanTokenBadge}>
            <Image source={CLB_LOGO} style={styles.loanTokenLogo} resizeMode="contain" />
            <Text style={[styles.loanTokenText, { color: tokenColor }]}>{item.loanToken}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.color + '15' }]}>
            <Ionicons name={status.icon as any} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.loanAmountRow}>
          <Text style={styles.loanAmount}>{item.loanAmount.toFixed(2)}</Text>
          <Text style={styles.loanAmountLabel}>{item.loanToken} tokens</Text>
        </View>

        <View style={styles.loanDetails}>
          <View style={styles.loanDetailItem}>
            <Text style={styles.detailLabel}>Collateral</Text>
            <Text style={styles.detailValue}>{item.collateralAmount} {item.collateralChain}</Text>
          </View>
          <View style={styles.loanDetailItem}>
            <Text style={styles.detailLabel}>Value</Text>
            <Text style={styles.detailValue}>${item.collateralValueUsd.toFixed(0)}</Text>
          </View>
          <View style={styles.loanDetailItem}>
            <Text style={styles.detailLabel}>Target</Text>
            <Text style={styles.detailValue}>${item.targetPriceUsd.toFixed(0)}</Text>
          </View>
          <View style={styles.loanDetailItem}>
            <Text style={styles.detailLabel}>LTV</Text>
            <Text style={styles.detailValue}>{item.ltvPercent}%</Text>
          </View>
        </View>

        <Text style={styles.loanDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={loans}
        keyExtractor={(item) => item.id}
        renderItem={renderLoan}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>My Loans</Text>
              <TouchableOpacity onPress={() => navigation.navigate('LoanRequest')}>
                <Ionicons name="add-circle" size={28} color={Colors.primary} />
              </TouchableOpacity>
            </LinearGradient>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{loans.filter((l) => l.status === 'ACTIVE').length}</Text>
                <Text style={styles.statLabel}>Active</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  {loans.filter((l) => l.status === 'ACTIVE').reduce((s: number, l: any) => s + l.loanAmount, 0).toFixed(0)}
                </Text>
                <Text style={styles.statLabel}>Total Tokens</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>
                  ${loans.filter((l) => l.status === 'ACTIVE').reduce((s: number, l: any) => s + l.collateralValueUsd, 0).toFixed(0)}
                </Text>
                <Text style={styles.statLabel}>Collateral</Text>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="cash-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No loans yet</Text>
              <Text style={styles.emptySubtext}>Deposit crypto to get CLB tokens</Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('LoanRequest')}
              >
                <Text style={styles.emptyBtnText}>Get Your First Loan</Text>
              </TouchableOpacity>
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

  statsRow: {
    flexDirection: 'row', gap: 10, padding: Spacing.lg,
  },
  statCard: {
    flex: 1, alignItems: 'center', padding: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { fontSize: 18, fontWeight: '900', color: Colors.primary },
  statLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },

  loanCard: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    padding: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
  },
  loanHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  loanTokenBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  loanTokenLogo: { width: 20, height: 20, borderRadius: 5 },
  loanTokenText: { fontSize: 14, fontWeight: '800' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  loanAmountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: Spacing.sm },
  loanAmount: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary },
  loanAmountLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },

  loanDetails: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  loanDetailItem: { alignItems: 'center' },
  detailLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  detailValue: { fontSize: 12, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },

  loanDate: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted, marginTop: Spacing.sm,
  },

  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary },
  emptySubtext: { fontSize: 13, fontWeight: '500', color: Colors.textMuted },
  emptyBtn: {
    marginTop: Spacing.md, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: 'rgba(240,185,11,0.1)', borderRadius: 99,
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
