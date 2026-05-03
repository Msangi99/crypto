import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, Alert, Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Button from '../../components/ui/Button';
import { authAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const LOGO = require('../../../assets/logo.png');

export default function ConnectWalletScreen() {
  const [walletAddress, setWalletAddress] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [mode, setMode] = useState<'connect' | 'register'>('connect');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const handleConnect = async () => {
    const addr = walletAddress.trim().toLowerCase();
    if (!addr.startsWith('0x') || addr.length !== 42) {
      Alert.alert('Invalid Address', 'Please enter a valid BEP-20 wallet address (0x...)');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        // User is explicitly registering
        const res = await authAPI.register(addr, referralCode.trim() || undefined);
        const { token, user } = res.data;
        await setAuth(token, user);
      } else {
        // Try login first
        try {
          const res = await authAPI.login(addr, 'demo-sig');
          const { token, user } = res.data;
          await setAuth(token, user);
        } catch (loginErr: any) {
          const loginMsg = loginErr?.response?.data?.message ?? '';
          const isNewUser =
            loginErr?.response?.status === 404 ||
            loginMsg.toLowerCase().includes('not found') ||
            loginMsg.toLowerCase().includes('register') ||
            loginMsg.toLowerCase().includes('does not exist');

          if (isNewUser) {
            // Auto-register new wallet seamlessly
            try {
              const res = await authAPI.register(addr, referralCode.trim() || undefined);
              const { token, user } = res.data;
              await setAuth(token, user);
            } catch (regErr: any) {
              const regMsg = regErr?.response?.data?.message || 'Registration failed.';
              if (regMsg.toLowerCase().includes('referral') || regMsg.toLowerCase().includes('code')) {
                // Referral code required or invalid — show register tab
                setMode('register');
                Alert.alert(
                  'Enter Referral Code',
                  'A valid referral code is required to register. Please enter one below.',
                );
              } else {
                Alert.alert('Registration Failed', regMsg);
              }
            }
          } else {
            Alert.alert('Connection Failed', loginMsg || 'Could not connect. Please try again.');
          }
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Something went wrong. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#050811', '#0B0E1A']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoGlow} />
              <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text style={styles.title}>CryptoLoanBoost</Text>
            <Text style={styles.subtitle}>
              Enter your BSC wallet address to access your CLB dashboard
            </Text>
          </View>

          {/* Trust Wallet hint */}
          <View style={styles.hintCard}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.hintText}>
              Use your Trust Wallet / MetaMask BSC address. No private key required.
            </Text>
          </View>

          {/* Mode tabs */}
          <View style={styles.tabRow}>
            {(['connect', 'register'] as const).map((m) => (
              <TouchableOpacity key={m} onPress={() => setMode(m)} style={[styles.tab, mode === m && styles.tabActive]}>
                <Text style={[styles.tabText, mode === m && styles.tabTextActive]}>
                  {m === 'connect' ? '🔗 Connect' : '✨ Register'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.modeHint}>
            {mode === 'connect'
              ? 'New wallet? No worries — we\'ll register you automatically.'
              : 'Creating a new account. Referral code is optional.'}
          </Text>

          {/* Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Wallet Address</Text>
            <View style={styles.inputRow}>
              <Ionicons name="wallet-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                value={walletAddress}
                onChangeText={setWalletAddress}
                placeholder="0x..."
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>
          </View>

          {mode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Referral Code (optional)</Text>
              <View style={styles.inputRow}>
                <Ionicons name="gift-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  value={referralCode}
                  onChangeText={setReferralCode}
                  placeholder="Enter referral code"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                  autoCapitalize="characters"
                  returnKeyType="done"
                />
              </View>
            </View>
          )}

          <Button
            label={mode === 'connect' ? 'Connect / Get Started' : 'Create Account'}
            onPress={handleConnect}
            loading={loading}
            fullWidth
            style={styles.btn}
          />

          {/* Features */}
          <View style={styles.featuresGrid}>
            {[
              { icon: 'shield-checkmark-outline', label: 'Non-Custodial' },
              { icon: 'trending-up-outline', label: 'Up to 60x Leverage' },
              { icon: 'people-outline', label: '5-Level Referrals' },
              { icon: 'lock-closed-outline', label: 'Secure & Encrypted' },
            ].map((f) => (
              <View key={f.label} style={styles.featureItem}>
                <Ionicons name={f.icon as any} size={22} color={Colors.primary} />
                <Text style={styles.featureLabel}>{f.label}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingTop: 60, gap: Spacing.lg },
  header: { alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  logoContainer: {
    width: 100, height: 100,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  logoGlow: {
    position: 'absolute',
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(245,166,35,0.15)',
  },
  logoImage: { width: 90, height: 90 },
  title: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 0.5 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  hintCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(26,86,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(26,86,255,0.2)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'flex-start',
  },
  hintText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.bgCard, borderRadius: Radius.full, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: Radius.full },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: '#fff' },
  inputGroup: { gap: 8 },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 14, color: Colors.textPrimary, fontSize: FontSize.md },
  btn: { marginTop: Spacing.sm },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  featureItem: {
    width: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  featureLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  modeHint: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'center', marginTop: -Spacing.sm },
});
