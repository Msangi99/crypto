import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { creditWalletAPI } from '../../services/api';

type Step = 'pick' | 'receive';

export default function DepositReceiveScreen({ navigation }: any) {
  const [step, setStep] = useState<Step>('pick');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [depositHistory, setDepositHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [txHash, setTxHash] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setConfigError(null);
    try {
      const res = await creditWalletAPI.config();
      if (res.data?.success && res.data?.config) {
        setConfig(res.data.config);
      } else {
        setConfig(null);
        setConfigError(
          (res.data as any)?.error ||
            'Could not load deposit configuration. Check that the API has USDT_BEP20 in .env or admin settings.'
        );
      }
    } catch (e: any) {
      setConfig(null);
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        'Network error loading deposit config. Check NEXT_PUBLIC_API_URL / API server.';
      setConfigError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const loadDepositHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await creditWalletAPI.depositHistory();
      if (res.data?.success) {
        setDepositHistory(res.data.deposits || []);
      }
    } catch (e) {
      console.error('Failed to load deposit history', e);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (step === 'receive') {
      loadDepositHistory();
    }
  }, [step, loadDepositHistory]);

  const treasury = config?.treasuryAddress as string | null | undefined;
  const qrUri = treasury
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(treasury)}`
    : null;

  const copyTreasury = async () => {
    if (!treasury) return;
    await Clipboard.setStringAsync(treasury);
    Alert.alert('Copied', 'Treasury address copied to clipboard');
  };

  const onConfirmTx = async () => {
    const h = txHash.trim();
    if (!h.startsWith('0x') || h.length < 66) {
      Alert.alert('Invalid hash', 'Paste the full BSC transaction hash (0x…).');
      return;
    }
    setSubmitting(true);
    try {
      const res = await creditWalletAPI.confirmDeposit(h);
      if (res.data?.success) {
        Alert.alert(
          'Credited',
          `USDT received. Your Deposit wallet (USDT) is now $${Number(res.data.newDepositCreditUsd ?? 0).toFixed(2)}.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }
      Alert.alert('Could not confirm', res.data?.error || 'Unknown error');
    } catch (e: any) {
      Alert.alert('Could not confirm', e?.response?.data?.error || e?.message || 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.header}>
        <TouchableOpacity onPress={() => (step === 'receive' ? setStep('pick') : navigation.goBack())} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Deposit</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {step === 'pick' && (
          <>
            <Text style={styles.lead}>Choose network and asset (Receive)</Text>
            {configError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color="#FF4757" />
                <Text style={styles.errorBannerText}>{configError}</Text>
              </View>
            ) : null}
            {!configError && config && !config.treasuryConfigured ? (
              <View style={styles.warnBanner}>
                <Ionicons name="information-circle" size={20} color={Colors.primary} />
                <Text style={styles.warnBannerText}>
                  Not configured: the BEP-20 treasury address is empty. Admin: Dashboard → Settings → save &quot;Treasury
                  wallet&quot; so the app can show QR + address.
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.assetCard, (!config?.treasuryConfigured || configError) && styles.assetCardDisabled]}
              activeOpacity={0.85}
              disabled
            >
              <View style={styles.assetIcon}>
                <Ionicons name="logo-usd" size={22} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.assetName}>USDT (BEP-20)</Text>
                <Text style={styles.assetSub}>{config?.networkLabel ?? 'BSC'} · {config?.assetStandard ?? 'BEP-20'}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
            </TouchableOpacity>

            <Text style={styles.amountLabel}>Amount to deposit (USDT)</Text>
            <View style={styles.amountInputWrap}>
              <Text style={styles.amountCurrency}>$</Text>
              <TextInput
                value={depositAmount}
                onChangeText={(t) => setDepositAmount(t.replace(/[^0-9.]/g, ''))}
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                style={styles.amountInput}
                keyboardType="decimal-pad"
                autoCorrect={false}
              />
              <Text style={styles.amountUnit}>USDT</Text>
            </View>
            {config?.minDeposit != null && (
              <Text style={styles.amountHint}>
                Minimum deposit: ${Number(config.minDeposit).toFixed(2)} USDT
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.continueBtn,
                (!depositAmount || Number(depositAmount) <= 0 || !config?.treasuryConfigured || configError) && styles.continueBtnDisabled,
              ]}
              onPress={() => {
                if (configError) {
                  Alert.alert(
                    'Deposit unavailable',
                    `${configError}\n\nAdmin: set the treasury in admin settings.`,
                  );
                  return;
                }
                if (!config?.treasuryConfigured) {
                  Alert.alert(
                    'Not configured',
                    'The USDT receive address (BEP-20 treasury) is not set yet.\n\n' +
                      'Admin: open the CLB Admin Dashboard → Settings → "USDT deposit receive" section → enter the BSC wallet address → Save.',
                  );
                  return;
                }
                const amt = Number(depositAmount);
                if (!amt || amt <= 0) {
                  Alert.alert('Enter amount', 'Please enter a valid deposit amount.');
                  return;
                }
                if (config?.minDeposit != null && amt < Number(config.minDeposit)) {
                  Alert.alert('Below minimum', `Minimum deposit is $${Number(config.minDeposit).toFixed(2)} USDT.`);
                  return;
                }
                setStep('receive');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#000" />
            </TouchableOpacity>

            <Text style={styles.hint}>
              Send only USDT on BSC to the address shown on the next screen. Other assets may be lost.
            </Text>
          </>
        )}

        {step === 'receive' && treasury && (
          <>
            <View style={styles.depositAmountBanner}>
              <Text style={styles.depositAmountBannerLabel}>Amount to deposit</Text>
              <Text style={styles.depositAmountBannerValue}>${Number(depositAmount).toFixed(2)} USDT</Text>
            </View>

            <Text style={styles.sectionLabel}>Your receive address</Text>
            <View style={styles.qrWrap}>
              {qrUri ? (
                <Image source={{ uri: qrUri }} style={styles.qr} resizeMode="contain" />
              ) : null}
            </View>
            <View style={styles.addrBox}>
              <Text style={styles.addrText} selectable>
                {treasury}
              </Text>
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={copyTreasury}>
              <Ionicons name="copy-outline" size={18} color="#000" />
              <Text style={styles.copyBtnText}>Copy address</Text>
            </TouchableOpacity>

            <View style={styles.metaRow}>
              <Text style={styles.metaMuted}>Contract</Text>
              <Text style={styles.metaVal} numberOfLines={1}>
                {config?.usdtContractAddress ?? '—'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaMuted}>Confirmations required</Text>
              <Text style={styles.metaVal}>{config?.minConfirmations ?? '—'}</Text>
            </View>

            <Text style={styles.sectionLabel}>After payment</Text>
            <Text style={styles.instructions}>
              1. Send USDT (BEP-20) from the same wallet linked to this CLB account — exchange “internal” sends often
              won’t match your linked address.{'\n'}
              2. Wait for enough block confirmations (see above).{'\n'}
              3. The server can auto-credit deposits when treasury monitoring runs (e.g. scheduled job). If nothing
              updates, use “Confirm transaction” below after the tx is successful on BscScan.
            </Text>

            <View style={styles.autoDetectBadge}>
              <Ionicons name="flash" size={16} color="#00C853" />
              <Text style={styles.autoDetectText}>Server auto-credit when monitoring runs</Text>
            </View>

            <Text style={styles.sectionLabel}>Confirm with hash</Text>
            <Text style={styles.instructions}>
              After the transfer is confirmed on BSC, paste the transaction hash here. The app checks that USDT moved
              from your linked wallet to the treasury address on the same network as the API.
            </Text>
            <TextInput
              value={txHash}
              onChangeText={setTxHash}
              placeholder="0x... transaction hash"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.confirmBtn, submitting && { opacity: 0.7 }]}
              onPress={onConfirmTx}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.confirmBtnText}>Confirm transaction</Text>
              )}
            </TouchableOpacity>

            {depositHistory.length > 0 && (
              <View style={styles.historySection}>
                <Text style={styles.historyTitle}>Recent deposits</Text>
                {loadingHistory ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  depositHistory.slice(0, 5).map((dep) => (
                    <View key={dep.id} style={styles.historyItem}>
                      <View>
                        <Text style={styles.historyAmount}>${dep.amount.toFixed(2)} USDT</Text>
                        <Text style={styles.historyDate}>
                          {new Date(dep.createdAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.historyStatus}>
                        <Text style={[
                          styles.historyStatusText,
                          dep.status === 'CONFIRMED' && styles.statusConfirmed,
                        ]}>
                          {dep.status}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backBtn: { padding: 8 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  scroll: { padding: Spacing.lg, paddingBottom: 48 },
  lead: { fontSize: 15, color: Colors.textSecondary, marginBottom: Spacing.md },
  assetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  assetIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(240,185,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assetName: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },
  assetSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  hint: { fontSize: 12, color: Colors.textMuted, marginTop: Spacing.md, lineHeight: 18 },
  amountLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  amountCurrency: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textMuted,
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingVertical: 14,
  },
  amountUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textMuted,
    marginLeft: 8,
  },
  amountHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 6,
  },
  continueBtn: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: Radius.md,
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  depositAmountBanner: {
    backgroundColor: 'rgba(240,185,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.35)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  depositAmountBannerLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  depositAmountBannerValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255,71,87,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,71,87,0.35)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: '#FF8A94', lineHeight: 19 },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(240,185,11,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.35)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  warnBannerText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  assetCardDisabled: { opacity: 0.65 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  qrWrap: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignSelf: 'center',
  },
  qr: { width: 220, height: 220 },
  addrBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.md,
  },
  addrText: { fontSize: 13, color: Colors.textPrimary, fontWeight: '600' },
  copyBtn: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.md,
  },
  copyBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  metaMuted: { fontSize: 12, color: Colors.textMuted },
  metaVal: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600', flex: 1, textAlign: 'right' },
  instructions: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  input: {
    marginTop: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  confirmBtn: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#000' },
  historySection: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  historyDate: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  historyStatus: {},
  historyStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statusConfirmed: {
    color: '#00C853',
  },
  autoDetectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,200,83,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0,200,83,0.35)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  autoDetectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#00C853',
  },
});
