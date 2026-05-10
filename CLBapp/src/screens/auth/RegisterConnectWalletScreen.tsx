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
        'Generate haipatikani',
        'Umeingiza anwari ya BEP-20 tayari. Maneno 12 lazima yatoke Trust / MetaMask / Binance kwa account ile ile. Ikiwa unataka wallet mpya ya simu pekee, futa anwari kwenye uwanja juu kisha Generate itaonekana tena.',
        [{ text: 'Sawa' }]
      );
      return;
    }
    const mnemonic = generateMnemonic(english);
    setPhrase(mnemonic);
    setBackupConfirmed(false);
    Alert.alert(
      'Maneno 12 ya CLB',
      'Andika maneno haya kwenye mahali salama. Kisha bonyeza “Use address from this phrase” ili anwari iendane na maneno. Baadaye utakaporudisha akaunti ndani ya CLB, utatumia maneno haya haya kwenye “Nina wallet tayari” — sio anwari pekee bila maneno.',
      [{ text: 'Nimeelewa' }]
    );
  };

  const applyDerivedAddress = () => {
    if (!derivedFromPhrase) return;
    setWalletAddress(derivedFromPhrase);
  };

  const handleSubmit = async () => {
    if (!backupConfirmed) {
      Alert.alert('Thibitisho', 'Tafadhali weka tiki ya uthibitisho kabla ya kuendelea.');
      return;
    }

    const pasted = walletAddress.trim().toLowerCase();

    if (hasValidBep20Field) {
      if (!accountPassword || accountPassword.length < 8) {
        Alert.alert(
          'Nenosiri la akaunti',
          'Rudi hatua ya kwanza ya usajili ujaze nenosiri la akaunti — linahitajika kurejesha akaunti hii pamoja na anwari na PIN.'
        );
        return;
      }
    } else {
      if (wordCount < 12) {
        Alert.alert(
          'Recovery phrase',
          'Bandika maneno 12 au tumia Generate phrase ukiwa anwari bado tupu.'
        );
        return;
      }
      let addr: string;
      try {
        addr = mnemonicToAccount(phrase.trim()).address.toLowerCase();
      } catch {
        Alert.alert('Recovery phrase', 'Maneno si halali. Angalia spelling na mpangilio.');
        return;
      }
      if (pasted !== addr) {
        Alert.alert(
          'Phrase na anwari',
          'Maneno lazima yalingane na anwari uliyoandika. Tumia “Use address from this phrase” au rekebisha.'
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
            <Text style={styles.title}>Unganisha pochi na CLB</Text>
            <Text style={styles.subtitle}>
              Anwari halali: weka tiki na endelea PIN — hatuhitaji kuandika maneno 12 hapa; kurejesha utatumia anwari
              + nenosiri la akaunti + PIN. Anwari tupu: andika maneno 12 au Generate kisha endelea.
            </Text>
          </LinearGradient>

          <View style={styles.content}>
            <View style={styles.emailPill}>
              <Ionicons name="mail-outline" size={14} color={Colors.primary} />
              <Text style={styles.emailPillText}>{email}</Text>
            </View>

            <View style={styles.truthCard}>
              <Text style={styles.truthTitle}>Ukweli mfupi (usome)</Text>
              <Text style={styles.truthLine}>
                1) <Text style={styles.truthEm}>Anwari</Text> unayoandika hapa = pochi unayounganisha na CLB (tunakagua
                ikiwa tayari inatumika).
              </Text>
              <Text style={styles.truthLine}>
                2) Ukiwa tayari ume<Text style={styles.truthEm}>bandika BEP-20</Text>: skrini hii haionyeshi kisanduku cha
                maneno 12 — utathibitisha na kwenda PIN. Kurejesha: <Text style={styles.truthEm}>anwari + nenosiri la
                  akaunti + PIN
                </Text>{' '}
                (“Nina wallet tayari”).
              </Text>
              <Text style={styles.truthLine}>
                3) Uki<Text style={styles.truthEm}>acha anwari tupu</Text>: utaona maneno 12 na Generate — wallet mpya
                ya simu; kurejesha utatumia maneno hayo + PIN.
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
                    'Anwari hii bado haijatumika. Thibitisha chini na endelea PIN — hatuhitaji maneno 12 hapa.'}
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
                  Umeunganisha anwari yako. Chini thibitisha tiki kisha <Text style={styles.truthEm}>Endelea PIN</Text>
                  . Hatuna kisanduku cha maneno 12 hapa — kurejesha: anwari + nenosiri la akaunti (hatua ya email) +
                  PIN.
                </Text>
              </View>
            ) : (
              <View style={styles.phraseCard}>
                <View style={styles.phraseHeader}>
                  <Text style={styles.label}>Maneno 12 ya kurejesha CLB</Text>
                  <TouchableOpacity onPress={() => setShowPhrase(!showPhrase)}>
                    <Ionicons
                      name={showPhrase ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.phraseHint}>
                  Bandika maneno kutoka wallet yako, au acha anwari tupu na ubonyeze Generate, kisha “Use address from
                  this phrase”.
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
                      Anwari na maneno vinalingana — hivi ndivyo utakavyovitumia kurejesha akaunti ya CLB.
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
                  ? 'Naelewa nitarejesha akaunti kwa anwari hii + nenosiri la akaunti (hatua ya email) + PIN ya CLB — bila kuandika maneno 12 kwenye skrini hii.'
                  : 'Nimeandika / nimehifadhi maneno 12 na naelewa nitayatumia ndani ya CLB kurejesha (“Nina wallet tayari”), pamoja na anwari inayoendana.'}
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
              Tayari una akaunti? “Nina wallet tayari”: anwari + nenosiri la akaunti + PIN (au maneno 12 ukiwa
              ulijisajili kwa njia ya phrase). “Connect with address” kwa simu nyingine.
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
