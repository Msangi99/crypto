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
      // Dev login: creates user if new, returns JWT directly (no signature needed)
      // TODO: Replace with proper wallet signing (SIWE/WalletConnect) for production
      const res = await authAPI.devLogin(addr);
      const { token, user } = res.data;
      await setAuth(token, user);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || err.message || 'Connection failed.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#0D0D0D', '#0D0D0D']} style={styles.container}>
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

          {/* Hint card */}
          <View style={styles.hintCard}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.hintText}>
              Use your Trust Wallet / MetaMask BSC address. New wallets are registered automatically.
            </Text>
          </View>

          {/* Wallet Address Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Wallet Address (BEP-20)</Text>
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
                returnKeyType="go"
                onSubmitEditing={handleConnect}
              />
            </View>
          </View>

          <Button
            label="Connect / Get Started"
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
    backgroundColor: 'rgba(240,185,11,0.15)',
  },
  logoImage: { width: 90, height: 90 },
  title: { fontSize: FontSize.xxl, fontWeight: '900', color: Colors.textPrimary, letterSpacing: 0.5 },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  hintCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(240,185,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.2)',
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'flex-start',
  },
  hintText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 18 },
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
});
