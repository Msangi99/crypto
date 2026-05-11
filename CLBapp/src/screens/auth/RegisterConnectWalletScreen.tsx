import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppKit } from '@reown/appkit-react-native';
import { useAccount } from 'wagmi';
import { generateMnemonic, mnemonicToAccount, english } from 'viem/accounts';
import { Colors, Spacing, Radius } from '../../constants/theme';
import Button from '../../components/ui/Button';
import { authAPI, referralsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const LOGO = require('../../../assets/logo.png');

function isValidBep20Address(input: string): boolean {
  const norm = input.trim().toLowerCase();
  return norm.length === 42 && /^0x[0-9a-f]{40}$/i.test(norm);
}

export default function RegisterConnectWalletScreen({ navigation, route }: any) {
  const email: string = route.params?.email ?? '';
  const referralCode: string = route.params?.referralCode ?? '';
  const accountPassword: string = route.params?.accountPassword ?? '';

  const [walletAddress, setWalletAddress] = useState('');
  const [phrase, setPhrase] = useState('');
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);
  /** Server check on the BEP-20 you paste (Trust / MetaMask / Binance) — before phrase step */
  const [addressAvail, setAddressAvail] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid_fmt' | 'error'
  >('idle');

  const { setAuth } = useAuthStore();
  const { open: openAppKit } = useAppKit();
  const { address: connectedAddress, isConnected } = useAccount();
  const wordCount = phrase.trim().split(/\s+/).filter(Boolean).length;

  const derivedFromPhrase = useMemo(() => {
    if (wordCount < 12 || !phrase.trim()) return null;
    try {
      return mnemonicToAccount(phrase.trim()).address.toLowerCase();
    } catch {
      return null;
    }
  }, [phrase, wordCount]);

  /** Complete valid BEP-20 in the field (pasted or after generate). Used for copy / mismatch messaging. */
  const hasValidBep20Field = useMemo(() => isValidBep20Address(walletAddress), [walletAddress]);

  /** Address-only path: no 12-word UI; restore later with address + account password + PIN. */
  useEffect(() => {
    if (hasValidBep20Field) {
      setPhrase('');
      setBackupConfirmed(false);
    }
  }, [hasValidBep20Field]);

  /** WalletConnect only fills the address field when it is empty — never overwrites your pasted BEP-20. */
  useEffect(() => {
    if (!isConnected || !connectedAddress) return;
    if (walletAddress.trim() !== '') return;
    setWalletAddress(connectedAddress);
  }, [isConnected, connectedAddress, walletAddress]);

  useEffect(() => {
    const raw = walletAddress.trim();
    const norm = raw.toLowerCase();
    if (!raw) {
      setAddressAvail('idle');
      return;
    }
    if (norm.length < 42) {
      setAddressAvail('idle');
      return;
    }
    if (norm.length !== 42 || !/^0x[0-9a-f]{40}$/i.test(norm)) {
      setAddressAvail('invalid_fmt');
      return;
    }
    setAddressAvail('checking');
    const t = setTimeout(async () => {
      try {
        const { data } = await authAPI.checkWalletAvailable(norm);
        setAddressAvail(data.available ? 'available' : 'taken');
      } catch {
        setAddressAvail('error');
      }
    }, 550);
    return () => clearTimeout(t);
  }, [walletAddress]);

  const handleGeneratePhrase = () => {
    if (isValidBep20Address(walletAddress)) {
      Alert.alert(
        'Generate unavailable',
        'You already entered a BEP-20 address. The 12-word phrase must come from Trust / MetaMask / Binance for the same account. If you want a new app-only wallet, clear the address field above and Generate will appear again.',
        [{ text: 'OK' }]
      );
      return;
    }
    const mnemonic = generateMnemonic(english);
    setPhrase(mnemonic);
    setBackupConfirmed(false);
    Alert.alert(
      'CLB 12-word phrase',
      'Write these words down somewhere safe. Then tap "Use address from this phrase" so the address matches the phrase. Later, when restoring in CLB, use these same words from "I already have a wallet" - not just the address without the phrase.',
      [{ text: 'I understand' }]
    );
  };

  const applyDerivedAddress = () => {
    if (!derivedFromPhrase) return;
    setWalletAddress(derivedFromPhrase);
  };

  const handleSubmit = async () => {
    if (!backupConfirmed) {
      Alert.alert('Confirmation', 'Please check the confirmation box before continuing.');
      return;
    }

    const pasted = walletAddress.trim().toLowerCase();

    if (hasValidBep20Field) {
      if (!accountPassword || accountPassword.length < 8) {
        Alert.alert(
          'Account password',
          'Go back to step one of registration and enter your account password - it is required to restore this account together with the address and PIN.'
        );
        return;
      }
    } else {
      if (wordCount < 12) {
        Alert.alert(
          'Recovery phrase',
          'Paste the 12 words, or use Generate phrase while the address field is still empty.'
        );
        return;
      }
      let addr: string;
      try {
        addr = mnemonicToAccount(phrase.trim()).address.toLowerCase();
      } catch {
        Alert.alert('Recovery phrase', 'The words are not valid. Check spelling and order.');
        return;
      }
      if (pasted !== addr) {
        Alert.alert(
          'Phrase and address',
          'The phrase must match the address you entered. Use "Use address from this phrase" or correct one of them.'
        );
        return;
      }
    }

    if (addressAvail === 'taken') {
      Alert.alert(
        'Address already in use',
        'Another CLB account already uses this address. Use a different wallet or sign in with “I already have a wallet”.'
      );
      return;
    }

    setLoading(true);
    try {
      const check = await authAPI.checkWalletAvailable(pasted);
      if (!check.data.available) {
        Alert.alert(
          'Address already in use',
          'This BEP-20 address is already registered. Choose another address or use “I already have a wallet”.'
        );
        setAddressAvail('taken');
        return;
      }

      const res = await authAPI.devLogin(pasted, {
        email: email || undefined,
        ...(hasValidBep20Field
          ? { accountPassword }
          : { recoveryPhrase: phrase.trim(), ...(accountPassword ? { accountPassword } : {}) }),
      });
      const { token, user } = res.data;
      await setAuth(token, {
        ...user,
        pinSetup: user.pinSetup ?? false,
        email: user.email ?? email,
      });

      if (referralCode) {
        try {
          await referralsAPI.apply(referralCode);
        } catch (applyErr: any) {
          const applyMsg =
            applyErr?.response?.data?.error ||
            applyErr?.response?.data?.message ||
            'Referral could not be applied.';
          Alert.alert('Referral', applyMsg);
        }
      }
    } catch (err: any) {
      if (err?.response?.status === 403 && err?.response?.data?.code === 'WALLET_ALREADY_REGISTERED') {
        Alert.alert(
          'Wallet already registered',
          err?.response?.data?.error ||
            'Use “I already have a wallet” and sign in with your recovery phrase and PIN.'
        );
      } else {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err.message ||
          'Could not complete registration.';
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Connect wallet to CLB</Text>
            <Text style={styles.subtitle}>
              Valid address: confirm and continue to PIN - no need to type 12 words here; to restore you will use
              address + account password + PIN. Empty address: enter 12 words or Generate, then continue.
            </Text>
          </LinearGradient>

          <View style={styles.content}>
            <View style={styles.emailPill}>
              <Ionicons name="mail-outline" size={14} color={Colors.primary} />
              <Text style={styles.emailPillText}>{email}</Text>
            </View>

            <View style={styles.truthCard}>
              <Text style={styles.truthTitle}>Quick facts (read)</Text>
              <Text style={styles.truthLine}>
                1) The <Text style={styles.truthEm}>address</Text> you enter here = the wallet you connect to CLB (we
                check whether it is already in use).
              </Text>
              <Text style={styles.truthLine}>
                2) If you already <Text style={styles.truthEm}>pasted a BEP-20 address</Text>: this screen does not show
                the 12-word box - you confirm and go to PIN. Restore with: <Text style={styles.truthEm}>address + account
                  password + PIN
                </Text>{' '}
                ("I already have a wallet").
              </Text>
              <Text style={styles.truthLine}>
                3) If you <Text style={styles.truthEm}>leave address empty</Text>: you will see 12 words and Generate - a
                new app wallet; restore later with those words + PIN.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.walletConnectBtn, isConnected && styles.walletConnectBtnConnected]}
              onPress={() => openAppKit()}
              activeOpacity={0.85}
            >
              <View style={styles.walletConnectIconBg}>
                <Ionicons
                  name={isConnected ? 'checkmark-circle' : 'wallet'}
                  size={20}
                  color={isConnected ? '#00D6A1' : Colors.primary}
                />
              </View>
              <View style={styles.walletConnectTextWrap}>
                <Text style={styles.walletConnectTitle}>
                  {isConnected ? 'Wallet connected' : 'Connect wallet'}
                </Text>
                <Text style={styles.walletConnectSubtitle} numberOfLines={1}>
                  {isConnected && connectedAddress
                    ? `${connectedAddress.slice(0, 8)}…${connectedAddress.slice(-4)}`
                    : 'WalletConnect · Trust · MetaMask'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            <Text style={styles.wcHint}>
              Connect wallet only fills the address field when it is empty — it never replaces a pasted BEP-20.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>BEP-20 address</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputIconBg}>
                  <Ionicons name="wallet-outline" size={18} color={Colors.primary} />
                </View>
                <TextInput
                  value={walletAddress}
                  onChangeText={setWalletAddress}
                  placeholder="Paste BEP-20 (Trust / MetaMask / Binance)"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {walletAddress.trim().length > 0 && addressAvail !== 'idle' && (
              <View
                style={[
                  styles.availBanner,
                  addressAvail === 'available' && styles.availOk,
                  addressAvail === 'taken' && styles.availBad,
                  (addressAvail === 'checking' || addressAvail === 'error' || addressAvail === 'invalid_fmt') &&
                    styles.availNeutral,
                ]}
              >
                {addressAvail === 'checking' && (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
                )}
                <Text style={styles.availText}>
                  {addressAvail === 'checking' && 'Checking if this address is already registered…'}
                  {addressAvail === 'available' &&
                    'This address is not used yet. Confirm below and continue to PIN - no 12-word phrase needed here.'}
                  {addressAvail === 'taken' && 'This address is already in use. Use another BEP-20 wallet or sign in with “I already have a wallet”.'}
                  {addressAvail === 'invalid_fmt' && 'Enter a valid BEP-20 address: 0x plus 40 hexadecimal characters.'}
                  {addressAvail === 'error' && 'Could not check online. You can still try Continue — we verify again on submit.'}
                </Text>
              </View>
            )}

            {hasValidBep20Field ? (
              <View style={styles.addressOnlyCard}>
                <Ionicons name="checkmark-done-circle" size={22} color="#00D6A1" />
                <Text style={styles.addressOnlyText}>
                  You have connected your address. Confirm the checkbox below, then <Text style={styles.truthEm}>Continue
                  to PIN</Text>. There is no 12-word box on this screen - restore with: address + account password (email
                  step) + PIN.
                </Text>
              </View>
            ) : (
              <View style={styles.phraseCard}>
                <View style={styles.phraseHeader}>
                  <Text style={styles.label}>CLB 12-word recovery phrase</Text>
                  <TouchableOpacity onPress={() => setShowPhrase(!showPhrase)}>
                    <Ionicons
                      name={showPhrase ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.phraseHint}>
                  Paste words from your wallet, or leave the address empty and tap Generate, then "Use address from this
                  phrase".
                </Text>
                <TextInput
                  value={phrase}
                  onChangeText={(t) => {
                    setPhrase(t);
                    setBackupConfirmed(false);
                  }}
                  placeholder="word1 word2 … word12"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.phraseInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  multiline
                  secureTextEntry={!showPhrase}
                  textAlignVertical="top"
                />
                <View style={styles.phraseFooter}>
                  <Text style={[styles.wordCount, wordCount >= 12 && styles.wordCountOk]}>
                    {wordCount}/12+ words
                  </Text>
                  <TouchableOpacity style={styles.genBtn} onPress={handleGeneratePhrase}>
                    <Ionicons name="refresh-outline" size={16} color="#000" />
                    <Text style={styles.genBtnText}>Generate phrase on device</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!hasValidBep20Field && wordCount >= 12 && !derivedFromPhrase && (
              <View style={[styles.availBanner, styles.availBad]}>
                <Text style={styles.availText}>
                  These 12+ words are not a valid recovery phrase. Check spelling and word order.
                </Text>
              </View>
            )}

            {!hasValidBep20Field && derivedFromPhrase && (
              <View style={styles.derivedRow}>
                {walletAddress.trim().toLowerCase() === derivedFromPhrase ? (
                  <View style={styles.derivedMatchRow}>
                    <Ionicons name="checkmark-circle" size={16} color="#00D6A1" />
                    <Text style={styles.derivedMatch}>
                      Address and phrase match - this is how you will restore your CLB account.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.derivedMismatch}>
                      This phrase controls{' '}
                      <Text style={styles.derivedMono}>
                        {derivedFromPhrase.slice(0, 8)}…{derivedFromPhrase.slice(-6)}
                      </Text>
                      . Tap below to put that address in the BEP-20 field, or paste a phrase that matches the address
                      you want.
                    </Text>
                    <TouchableOpacity style={styles.applyDerivedBtn} onPress={applyDerivedAddress} activeOpacity={0.85}>
                      <Ionicons name="copy-outline" size={16} color={Colors.primary} />
                      <Text style={styles.applyDerivedText}>Use address from this phrase</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            )}

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setBackupConfirmed(!backupConfirmed)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={backupConfirmed ? 'checkbox' : 'square-outline'}
                size={22}
                color={backupConfirmed ? Colors.primary : Colors.textMuted}
              />
              <Text style={styles.checkText}>
                {hasValidBep20Field
                  ? 'I understand I will restore this account with this address + account password (email step) + CLB PIN - without entering 12 words on this screen.'
                  : 'I have written/saved the 12 words and understand I will use them in CLB restore ("I already have a wallet"), together with the matching address.'}
              </Text>
            </TouchableOpacity>

            <Button
              label="Continue to PIN"
              onPress={handleSubmit}
              loading={loading}
              disabled={
                loading ||
                addressAvail === 'taken' ||
                addressAvail === 'invalid_fmt' ||
                addressAvail === 'checking' ||
                !backupConfirmed ||
                (addressAvail !== 'available' && addressAvail !== 'error') ||
                (hasValidBep20Field
                  ? false
                  : !derivedFromPhrase ||
                    wordCount < 12 ||
                    walletAddress.trim().toLowerCase() !== derivedFromPhrase)
              }
              fullWidth
            />

            <Text style={styles.footerNote}>
              Already have an account? "I already have a wallet": address + account password + PIN (or 12 words if you
              registered using phrase mode). Use "Connect with address" on another phone.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { paddingBottom: 40 },
  headerGradient: {
    paddingTop: 52,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  backBtn: { position: 'absolute', left: Spacing.md, top: 48, zIndex: 2 },
  logo: { width: 56, height: 56, borderRadius: 14, marginBottom: Spacing.sm },
  title: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, marginBottom: 8 },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  content: { padding: Spacing.lg, gap: Spacing.md },
  truthCard: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.28)',
    gap: 8,
  },
  truthTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  truthLine: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    lineHeight: 18,
  },
  truthEm: { fontWeight: '900', color: Colors.primary },
  wcHint: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: -4,
  },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(240,185,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.2)',
  },
  emailPillText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },
  walletConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.35)',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  walletConnectBtnConnected: {
    borderColor: 'rgba(0,214,161,0.45)',
    backgroundColor: 'rgba(0,214,161,0.06)',
  },
  walletConnectIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(240,185,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletConnectTextWrap: { flex: 1, gap: 2 },
  walletConnectTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  walletConnectSubtitle: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  inputIconBg: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(240,185,11,0.08)',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 14,
    paddingRight: Spacing.md,
  },
  addressOnlyCard: {
    flexDirection: 'row',
    gap: 12,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    backgroundColor: 'rgba(0,214,161,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,214,161,0.28)',
    alignItems: 'flex-start',
  },
  addressOnlyText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  phraseCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 8,
  },
  phraseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  phraseHint: { fontSize: 11, color: Colors.textMuted, lineHeight: 16 },
  phraseInput: {
    minHeight: 96,
    fontSize: 13,
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  phraseFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordCount: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  wordCountOk: { color: '#00D6A1' },
  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  genBtnText: { fontSize: 12, fontWeight: '800', color: '#000' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkText: { flex: 1, fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
  footerNote: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 4,
  },
  derivedRow: {
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    gap: Spacing.sm,
  },
  derivedMatchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  derivedMatch: { fontSize: 12, fontWeight: '700', color: '#00D6A1', flex: 1 },
  derivedMismatch: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, lineHeight: 18 },
  derivedMono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: Colors.textPrimary },
  applyDerivedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.45)',
    backgroundColor: 'rgba(240,185,11,0.08)',
  },
  applyDerivedText: { fontSize: 13, fontWeight: '800', color: Colors.primary },
  clearPhraseBtn: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  clearPhraseText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  availBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  availOk: {
    backgroundColor: 'rgba(0,214,161,0.08)',
    borderColor: 'rgba(0,214,161,0.35)',
  },
  availBad: {
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderColor: 'rgba(239,68,68,0.35)',
  },
  availNeutral: {
    backgroundColor: Colors.bgCard,
    borderColor: Colors.border,
  },
  availText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    lineHeight: 17,
  },
});
