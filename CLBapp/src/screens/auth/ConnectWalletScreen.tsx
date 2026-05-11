import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Image, Clipboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAppKit } from '@reown/appkit-react-native';
import { useAccount } from 'wagmi';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Button from '../../components/ui/Button';
import { authAPI, referralsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const LOGO = require('../../../assets/logo.png');

export default function ConnectWalletScreen() {
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [importPinInput, setImportPinInput] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const { open: openAppKit } = useAppKit();
  const { address: connectedAddress, isConnected } = useAccount();
  const lastFilledAddress = useRef<string | null>(null);

  // When the user connects a wallet through AppKit / WalletConnect, push that
  // address into the input so the existing "Connect & Get Started" flow can
  // sign the user in.
  useEffect(() => {
    if (isConnected && connectedAddress && lastFilledAddress.current !== connectedAddress) {
      lastFilledAddress.current = connectedAddress;
      setWalletAddress(connectedAddress);
    }
  }, [isConnected, connectedAddress]);

  const handleConnect = async () => {
    const addr = walletAddress.trim().toLowerCase();
    if (!addr.startsWith('0x') || addr.length !== 42) {
      Alert.alert('Invalid Address', 'Please enter a valid BEP-20 wallet address (0x...)');
      return;
    }
    setLoading(true);
    try {
      // Dev login: creates user if new, returns JWT directly (no signature needed)
      // TODO: Replace with proper wallet signing (SIWE/WalletConnect) for production
      const res = await authAPI.devLogin(addr);
      const { token, user } = res.data;
      // Use pinSetup from backend if provided; new users default to false
      await setAuth(token, { ...user, pinSetup: user.pinSetup ?? false });

      const referralCode = referralCodeInput.trim().toUpperCase();
      if (referralCode) {
        try {
          await referralsAPI.apply(referralCode);
          Alert.alert('Referral Applied', 'Your referral code has been linked to this account.');
          setReferralCodeInput('');
        } catch (applyErr: any) {
          const applyMsg =
            applyErr?.response?.data?.error ||
            applyErr?.response?.data?.message ||
            'Could not apply referral code.';
          Alert.alert('Referral Not Applied', applyMsg);
        }
      }
    } catch (err: any) {
      if (err?.response?.status === 403 && err?.response?.data?.code === 'WALLET_ALREADY_REGISTERED') {
        Alert.alert(
          'Wallet already in use',
          err?.response?.data?.error ||
            'This address is registered. Use “I already have a wallet” and sign in with your 12-word phrase and PIN.'
        );
      } else {
        const msg =
          err?.response?.data?.error || err?.response?.data?.message || err.message || 'Connection failed.';
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const key = secretKeyInput.trim();
    if (!key || key.split(/\s+/).length < 12) {
      Alert.alert('Invalid Key', 'Please enter your full 12-word recovery phrase');
      return;
    }
    if (importPinInput.length > 0 && importPinInput.length < 6) {
      Alert.alert('PIN', 'Enter all 6 digits or leave PIN empty if you never set one.');
      return;
    }
    const pin = importPinInput.length === 6 ? importPinInput : undefined;
    setImportLoading(true);
    try {
      const res = await authAPI.importAccount(key, pin);
      const { token, user } = res.data;
      // Imported accounts may already have PIN set up on another device
      await setAuth(token, { ...user, pinSetup: user.pinSetup ?? false });
      if (!user.pinSetup) {
        Alert.alert('Account Restored', 'Your account has been imported. Please set up a PIN for this device.');
      }
    } catch (err: any) {
      if (err?.response?.data?.code === 'PIN_REQUIRED') {
        Alert.alert('PIN required', 'Enter the 6-digit PIN you set at registration.');
      } else {
        const msg = err?.response?.data?.error || err?.response?.data?.message || err.message || 'Import failed.';
        Alert.alert('Import Failed', msg);
      }
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Dark Gradient Header */}
          <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
            <View style={styles.logoRow}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.title}>CryptoLoanBoost</Text>

            {/* Feature Pills */}
            <View style={styles.pillsRow}>
              {['BSC Chain', '60x Leverage', '5-Level Refs'].map((p) => (
                <View key={p} style={styles.pill}>
                  <Text style={styles.pillText}>{p}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          <View style={styles.content}>
            {/* WalletConnect / AppKit */}
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
                  {isConnected ? 'Wallet Connected' : 'Connect Wallet'}
                </Text>
                <Text style={styles.walletConnectSubtitle} numberOfLines={1}>
                  {isConnected && connectedAddress
                    ? `${connectedAddress.slice(0, 6)}…${connectedAddress.slice(-4)}`
                    : 'WalletConnect, MetaMask, Trust Wallet & 600+'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            {/* Wallet Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Wallet Address (BEP-20)</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputIconBg}>
                  <Ionicons name="wallet-outline" size={18} color={Colors.primary} />
                </View>
                <TextInput
                  value={walletAddress}
                  onChangeText={setWalletAddress}
                  placeholder="0x..."
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  onSubmitEditing={handleConnect}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Referral Code (Optional)</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputIconBg}>
                  <Ionicons name="gift-outline" size={18} color={Colors.primary} />
                </View>
                <TextInput
                  value={referralCodeInput}
                  onChangeText={setReferralCodeInput}
                  placeholder="Enter code from inviter"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            </View>

            <Button
              label="Connect & Get Started"
              onPress={handleConnect}
              loading={loading}
              fullWidth
              style={styles.btn}
            />

            {/* Import Account */}
            <TouchableOpacity
              style={styles.importToggle}
              onPress={() => setShowImport(!showImport)}
            >
              <View style={styles.importToggleIcon}>
                <Ionicons name="key-outline" size={16} color={Colors.primary} />
              </View>
              <Text style={styles.importToggleText}>
                {showImport ? 'Hide Import Account' : 'Import from Secret Key'}
              </Text>
              <Ionicons
                name={showImport ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={Colors.textMuted}
              />
            </TouchableOpacity>

            {showImport && (
              <View style={styles.importSection}>
                <View style={styles.warnBanner}>
                  <Ionicons name="warning-outline" size={16} color="#FF4757" />
                  <Text style={styles.warnText}>
                    Enter your 12-word recovery phrase to restore your account. You'll set up a new PIN.
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Secret Key (12 words)</Text>
                  <TextInput
                    value={secretKeyInput}
                    onChangeText={setSecretKeyInput}
                    placeholder="word1 word2 word3 ... word12"
                    placeholderTextColor={Colors.textMuted}
                    style={[styles.input, styles.secretInput]}
                    autoCapitalize="none"
                    autoCorrect={false}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>PIN (6 digits, if you set one)</Text>
                  <TextInput
                    value={importPinInput}
                    onChangeText={(t) => setImportPinInput(t.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.input}
                    keyboardType="number-pad"
                    maxLength={6}
                    secureTextEntry
                  />
                </View>

                <Button
                  label="Import Account"
                  onPress={handleImport}
                  loading={importLoading}
                  fullWidth
                  variant="outline"
                />
              </View>
            )}

            {/* Features Grid */}
            <View style={styles.featuresGrid}>
              {[
                { icon: 'shield-checkmark-outline', color: '#00D6A1', label: 'Non-Custodial' },
                { icon: 'trending-up-outline', color: Colors.primary, label: '60x Leverage' },
                { icon: 'people-outline', color: Colors.gold, label: '5-Level Refs' },
                { icon: 'lock-closed-outline', color: '#00D6A1', label: 'Encrypted' },
              ].map((f) => (
                <View key={f.label} style={styles.featureItem}>
                  <View style={[styles.featureIconBg, { backgroundColor: f.color + '18' }]}>
                    <Ionicons name={f.icon as any} size={18} color={f.color} />
                  </View>
                  <Text style={styles.featureLabel}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { gap: 0 },

  // Header Gradient
  headerGradient: {
    alignItems: 'center', paddingHorizontal: Spacing.lg,
    paddingTop: 60, paddingBottom: Spacing.xl, gap: Spacing.md,
  },
  logoRow: { marginBottom: Spacing.sm },
  logo: { width: 72, height: 72, borderRadius: 18 },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 0.5 },

  // Pills
  pillsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  pill: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99,
    backgroundColor: 'rgba(240,185,11,0.1)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.25)',
  },
  pillText: { fontSize: 11, fontWeight: '700', color: Colors.gold },

  // Content
  content: { padding: Spacing.lg, gap: Spacing.lg },

  // Input
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, overflow: 'hidden',
  },
  inputIconBg: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(240,185,11,0.08)',
  },
  input: { flex: 1, paddingVertical: 14, color: Colors.textPrimary, fontSize: 14, paddingRight: Spacing.md },
  btn: { marginTop: Spacing.xs },

  // Features Grid
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  featureItem: {
    width: '47%', flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  featureIconBg: {
    width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  featureLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },

  // Import Account
  importToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  importToggleIcon: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: 'rgba(240,185,11,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  importToggleText: { fontSize: 13, fontWeight: '700', color: Colors.primary, flex: 1 },
  importSection: { gap: Spacing.md },

  // Warn Banner
  warnBanner: {
    flexDirection: 'row', gap: 8,
    backgroundColor: 'rgba(255,71,87,0.08)', borderWidth: 1, borderColor: 'rgba(255,71,87,0.15)',
    borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'flex-start',
  },
  warnText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.textSecondary, lineHeight: 18 },

  // Secret Input
  secretInput: {
    minHeight: 80, textAlignVertical: 'top',
    fontFamily: 'monospace', fontSize: 13,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.lg, padding: Spacing.md,
  },

  // WalletConnect button
  walletConnectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.35)',
    borderRadius: Radius.lg, padding: Spacing.md,
  },
  walletConnectBtnConnected: {
    borderColor: 'rgba(0,214,161,0.45)',
    backgroundColor: 'rgba(0,214,161,0.06)',
  },
  walletConnectIconBg: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: 'rgba(240,185,11,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  walletConnectTextWrap: { flex: 1, gap: 2 },
  walletConnectTitle: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  walletConnectSubtitle: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
});
