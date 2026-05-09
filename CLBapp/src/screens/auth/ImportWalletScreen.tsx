import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { authAPI, referralsAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function ImportWalletScreen({ navigation, route }: any) {
  const { setAuth } = useAuthStore();
  const [seedInput, setSeedInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);

  const wordCount = seedInput.trim().split(/\s+/).filter(Boolean).length;
  const isValid = wordCount >= 12;

  const handleImport = async () => {
    const phrase = seedInput.trim().toLowerCase();
    if (!phrase || phrase.split(/\s+/).length < 12) {
      Alert.alert('Invalid Phrase', 'Please enter your 12-word recovery phrase.');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.importAccount(phrase);
      const { token, user } = res.data;
      await setAuth(token, { ...user, pinSetup: user.pinSetup ?? false });

      const regEmail = route.params?.registrationEmail as string | undefined;
      const refCode = route.params?.referralCode as string | undefined;
      if (regEmail?.trim()) {
        try {
          await authAPI.updateProfile({ email: regEmail.trim().toLowerCase() });
        } catch {
          /* non-fatal */
        }
      }
      if (refCode?.trim()) {
        try {
          await referralsAPI.apply(refCode.trim().toUpperCase());
        } catch {
          /* non-fatal */
        }
      }

      if (!user.pinSetup) {
        Alert.alert('Welcome Back', 'Account restored. Please set up a PIN for this device.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Import failed.';
      Alert.alert('Import Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0B0E1A', '#1A1F35', '#0B0E1A']} style={styles.gradient}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Import Wallet</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* Icon */}
            <View style={styles.iconContainer}>
              <View style={styles.iconBg}>
                <Ionicons name="key" size={32} color={Colors.primary} />
              </View>
            </View>

            <Text style={styles.title}>Enter Recovery Phrase</Text>
            <Text style={styles.subtitle}>
              Enter your 12-word recovery phrase to restore your wallet. Words should be separated by spaces.
            </Text>

            {/* Input */}
            <View style={styles.inputCard}>
              <View style={styles.inputHeader}>
                <Text style={styles.inputLabel}>Recovery Phrase</Text>
                <TouchableOpacity onPress={() => setShowPhrase(!showPhrase)}>
                  <Ionicons
                    name={showPhrase ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="abandon ability able about above absent absorb abstract absurd abuse access accident"
                placeholderTextColor={Colors.textMuted + '60'}
                value={seedInput}
                onChangeText={setSeedInput}
                multiline
                numberOfLines={4}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showPhrase}
                textAlignVertical="top"
              />
              <View style={styles.inputFooter}>
                <Text style={[styles.wordCount, isValid && styles.wordCountValid]}>
                  {wordCount}/12 words
                </Text>
                {isValid && (
                  <Ionicons name="checkmark-circle" size={18} color="#00D6A1" />
                )}
              </View>
            </View>

            {/* Security note */}
            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
              <Text style={styles.securityText}>
                Your phrase is encrypted and stored securely on your device. We never send it to any server in plain text.
              </Text>
            </View>

            {/* Import button */}
            <TouchableOpacity
              onPress={handleImport}
              disabled={!isValid || loading}
              activeOpacity={0.85}
              style={{ marginTop: Spacing.lg }}
            >
              <LinearGradient
                colors={isValid ? Colors.gradientPrimary : ['#333', '#222']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.importBtn}
              >
                {loading ? (
                  <Text style={styles.importBtnText}>Restoring...</Text>
                ) : (
                  <>
                    <Ionicons name="download" size={18} color={isValid ? '#000' : Colors.textMuted} />
                    <Text style={[styles.importBtnText, !isValid && { color: Colors.textMuted }]}>
                      Restore Wallet
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E1A' },
  gradient: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 60 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: Spacing.md,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },

  iconContainer: { alignItems: 'center', marginVertical: Spacing.lg },
  iconBg: {
    width: 70, height: 70, borderRadius: 22,
    backgroundColor: 'rgba(240,185,11,0.1)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },

  title: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: 14, fontWeight: '500', color: Colors.textMuted,
    textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: Spacing.xl,
  },

  inputCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  inputHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  inputLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  textInput: {
    fontSize: 16, fontWeight: '600', color: Colors.textPrimary,
    minHeight: 100, padding: 0, lineHeight: 24,
  },
  inputFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  wordCount: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  wordCountValid: { color: '#00D6A1' },

  securityNote: {
    flexDirection: 'row', gap: 10, padding: Spacing.md, marginTop: Spacing.lg,
    backgroundColor: 'rgba(240,185,11,0.05)', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.1)',
  },
  securityText: { flex: 1, fontSize: 12, fontWeight: '500', color: Colors.textMuted, lineHeight: 18 },

  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, gap: 10, borderRadius: Radius.lg,
  },
  importBtnText: { fontSize: 16, fontWeight: '900', color: '#000' },
});
