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

const PW_MIN = 8;

/** Step 1 — only for “Create new wallet”. Restore & connect use other screens. */
export default function RegisterEmailReferralScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const handleContinue = () => {
    const e = email.trim().toLowerCase();
    if (!e || !e.includes('@')) {
      Alert.alert('Email required', 'Please enter a valid email address.');
      return;
    }
    if (password.length < PW_MIN) {
      Alert.alert('Password', `Use at least ${PW_MIN} characters for your account password.`);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password', 'Password and confirmation do not match.');
      return;
    }
    navigation.navigate('RegisterConnectWallet', {
      email: e,
      referralCode: referralCode.trim().toUpperCase(),
      accountPassword: password,
    });
  };

  const emailValid = email.trim().includes('@') && email.trim().length > 3;
  const passwordOk =
    password.length >= PW_MIN && confirmPassword.length >= PW_MIN && password === confirmPassword;
  const canContinue = emailValid && passwordOk;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>
          New to CLB only. Enter your email, a strong account password, and optional referral code. Next you will paste
          your BEP-20 address (Trust / MetaMask / Binance) and your 12-word recovery phrase.
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
            <Text style={styles.label}>Account password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={`At least ${PW_MIN} characters`}
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showPw}
              />
              <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.primary} style={styles.inputIcon} />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Same as above"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showPw2}
              />
              <TouchableOpacity onPress={() => setShowPw2(!showPw2)} style={styles.eyeBtn}>
                <Ionicons name={showPw2 ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>
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

          <Button label="Continue" onPress={handleContinue} disabled={!canContinue} fullWidth />
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
  eyeBtn: { paddingHorizontal: 10, paddingVertical: 8 },
});
