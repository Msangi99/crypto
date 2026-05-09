import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import Button from '../../components/ui/Button';

const LOGO = require('../../../assets/logo.png');

/** Step 1 — only for “Create new wallet”. Restore & connect use other screens. */
export default function RegisterEmailReferralScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const handleContinue = () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) {
      Alert.alert('Email required', 'Please enter a valid email address.');
      return;
    }
    navigation.navigate('RegisterConnectWallet', {
      email: e,
      referralCode: referralCode.trim().toUpperCase(),
    });
  };

  const emailValid = email.trim().includes('@') && email.trim().length > 3;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>
          New to CLB only. Enter your email and optional referral code, then you will create your wallet
          phrase and link your address.
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Referral code (optional)</Text>
            <View style={styles.inputRow}>
              <Ionicons name="gift-outline" size={18} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                value={referralCode}
                onChangeText={setReferralCode}
                placeholder="Code from your inviter"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            </View>
          </View>

          <Button label="Continue" onPress={handleContinue} disabled={!emailValid} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  backBtn: { position: 'absolute', left: Spacing.lg, top: 52, zIndex: 2 },
  logo: { width: 64, height: 64, borderRadius: 16, marginBottom: Spacing.md },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: { padding: Spacing.lg, gap: Spacing.lg },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.sm,
  },
  inputIcon: { marginHorizontal: 8 },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: Colors.textPrimary,
    fontSize: 14,
  },
});
