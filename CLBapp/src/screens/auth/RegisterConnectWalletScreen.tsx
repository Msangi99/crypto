import React, { useEffect, useRef, useState } from 'react';
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
import type { RegisterFlow } from './RegisterEmailReferralScreen';

const LOGO = require('../../../assets/logo.png');

export default function RegisterConnectWalletScreen({ navigation, route }: any) {
  const email: string = route.params?.email ?? '';
  const referralCode: string = route.params?.referralCode ?? '';
  const flow: RegisterFlow = route.params?.flow ?? 'create';

  const [walletAddress, setWalletAddress] = useState('');
  const [phrase, setPhrase] = useState('');
  const [backupConfirmed, setBackupConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);

  const { setAuth } = useAuthStore();
  const { open: openAppKit } = useAppKit();
  const { address: connectedAddress, isConnected } = useAccount();
  const lastFilled = useRef<string | null>(null);
  const wordCount = phrase.trim().split(/\s+/).filter(Boolean).length;

  /** If user already has a 12-word phrase, don't replace address with a different connected wallet (common 400 cause). */
  useEffect(() => {
    if (!isConnected || !connectedAddress) return;
    const connected = connectedAddress.toLowerCase();
    if (wordCount >= 12 && phrase.trim()) {
      try {
        const derived = mnemonicToAccount(phrase.trim()).address.toLowerCase();
        if (derived !== connected) return;
      } catch {
        return;
      }
    }
    if (lastFilled.current !== connectedAddress) {
      lastFilled.current = connectedAddress;
      setWalletAddress(connectedAddress);
    }
  }, [isConnected, connectedAddress, phrase, wordCount]);

  const handleGeneratePhrase = () => {
    const mnemonic = generateMnemonic(english);
    const acc = mnemonicToAccount(mnemonic);
    setPhrase(mnemonic);
    setWalletAddress(acc.address);
    setBackupConfirmed(false);
    Alert.alert(
      'Save your phrase',
      'Write these 12 words on paper and store them safely. Anyone with this phrase controls this wallet.',
      [{ text: 'OK' }]
    );
  };

  const handleSubmit = async () => {
    const p = phrase.trim().toLowerCase();
    if (flow === 'create') {
      if (wordCount < 12) {
        Alert.alert('Recovery phrase', 'Use “Generate phrase” or paste your 12 words from Trust Wallet / MetaMask.');
        return;
      }
      if (!backupConfirmed) {
        Alert.alert('Confirmation', 'Confirm that you have saved your recovery phrase.');
        return;
      }
    }

    const hasPhrase = p.split(/\s+/).filter(Boolean).length >= 12;
    let addr: string;
    let recoveryPhrase: string | undefined;

    if (hasPhrase) {
      try {
        addr = mnemonicToAccount(phrase.trim()).address.toLowerCase();
        recoveryPhrase = phrase.trim();
      } catch {
        Alert.alert('Recovery phrase', 'These words are not a valid BIP39 phrase. Check spelling and order.');
        return;
      }
    } else {
      addr = walletAddress.trim().toLowerCase();
      recoveryPhrase = undefined;
      if (!addr.startsWith('0x') || addr.length !== 42) {
        Alert.alert('Invalid address', 'Enter a valid BEP-20 address or connect your wallet.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await authAPI.devLogin(addr, {
        email: email || undefined,
        recoveryPhrase,
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
            <Text style={styles.title}>Link your wallet</Text>
            <Text style={styles.subtitle}>
              {flow === 'create'
                ? 'After you generate or paste your 12 words, we always use the address from that phrase. Connecting another wallet will not replace it unless it is the same address.'
                : 'Connect your external wallet or paste your BEP-20 address. Optional: add a phrase so you can restore this account later.'}
            </Text>
          </LinearGradient>

          <View style={styles.content}>
            <View style={styles.emailPill}>
              <Ionicons name="mail-outline" size={14} color={Colors.primary} />
              <Text style={styles.emailPillText}>{email}</Text>
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>BEP-20 address</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputIconBg}>
                  <Ionicons name="wallet-outline" size={18} color={Colors.primary} />
                </View>
                <TextInput
                  value={walletAddress}
                  onChangeText={setWalletAddress}
                  placeholder="0x…"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.phraseCard}>
              <View style={styles.phraseHeader}>
                <Text style={styles.label}>12-word recovery phrase</Text>
                <TouchableOpacity onPress={() => setShowPhrase(!showPhrase)}>
                  <Ionicons
                    name={showPhrase ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.phraseHint}>
                {flow === 'create'
                  ? 'Must match the address above. Tap generate for a new phrase on this phone, or paste from your existing wallet.'
                  : 'Optional: if you add a valid BIP39 phrase, it must match the address and will be used for “Import” recovery.'}
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
                {flow === 'create' && (
                  <TouchableOpacity style={styles.genBtn} onPress={handleGeneratePhrase}>
                    <Ionicons name="refresh-outline" size={16} color="#000" />
                    <Text style={styles.genBtnText}>Generate phrase on device</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {flow === 'create' && (
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
                  I have written down my recovery phrase and understand I need it to restore access.
                </Text>
              </TouchableOpacity>
            )}

            <Button label="Continue to PIN" onPress={handleSubmit} loading={loading} fullWidth />

            <Text style={styles.footerNote}>
              One wallet address = one CLB account. Use the same flow to sign in on a new phone with your phrase
              (Import) or this address.
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
});
