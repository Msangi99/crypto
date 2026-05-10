import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { authAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

function isValidBep20(input: string): boolean {
  const n = input.trim().toLowerCase();
  return n.length === 42 && /^0x[0-9a-f]{40}$/i.test(n);
}

type RecoverMethod = 'phrase' | 'password';

export default function ImportWalletScreen({ navigation }: any) {
  const { setAuth } = useAuthStore();
  const [walletAddress, setWalletAddress] = useState('');
  const [method, setMethod] = useState<RecoverMethod>('phrase');
  const [seedInput, setSeedInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPhrase, setShowPhrase] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [phraseOnly, setPhraseOnly] = useState(false);

  const wordCount = seedInput.trim().split(/\s+/).filter(Boolean).length;
  const addrOk = isValidBep20(walletAddress);
  const phraseOk = wordCount >= 12;
  const pwOk = passwordInput.trim().length >= 8;
  const pinOk = pinInput.length === 6 && /^\d+$/.test(pinInput);
  const pinToSend = pinOk ? pinInput : undefined;

  const handleRecover = async () => {
    if (phraseOnly) {
      await doImportPhrase();
      return;
    }
    if (!addrOk) {
      Alert.alert('Anwari', 'Ingiza anwari halali ya BEP-20 (0x + herufi 40).');
      return;
    }
    if (method === 'phrase' && !phraseOk) {
      Alert.alert('Maneno 12', 'Ingiza maneno yote 12 ya recovery.');
      return;
    }
    if (method === 'password' && !pwOk) {
      Alert.alert('Nenosiri', 'Ingiza nenosiri la akaunti uliolifanya wakati wa usajili (angalau herufi 8).');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.recoverAccount({
        walletAddress: walletAddress.trim(),
        method,
        ...(method === 'phrase' ? { phrase: seedInput.trim().toLowerCase() } : { accountPassword: passwordInput }),
        ...(pinToSend ? { pin: pinToSend } : {}),
      });
      const { token, user } = res.data;
      await setAuth(token, { ...user, pinSetup: user.pinSetup ?? false });
      if (!user.pinSetup) {
        Alert.alert('Karibu tena', 'Akaunti imerejeshwa. Weka PIN kwa kifaa hiki.');
      }
    } catch (err: any) {
      if (err?.response?.data?.code === 'PIN_REQUIRED') {
        Alert.alert('PIN inahitajika', err?.response?.data?.error || 'Ingiza tarakimu 6 za PIN za usajili.');
      } else if (err?.response?.data?.code === 'NO_ACCOUNT_PASSWORD') {
        Alert.alert('Nenosiri la akaunti', err?.response?.data?.error || 'Tumia njia ya maneno 12.');
        setMethod('phrase');
      } else {
        const msg = err?.response?.data?.error || err?.message || 'Imeshindikana.';
        Alert.alert('Restore', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const doImportPhrase = async () => {
    const phrase = seedInput.trim().toLowerCase();
    if (!phraseOk) {
      Alert.alert('Maneno 12', 'Ingiza maneno yote 12.');
      return;
    }
    if (pinInput.length > 0 && pinInput.length < 6) {
      Alert.alert('PIN', 'Weka tarakimu 6 zote, au acha tupu ikiwa hukumaliza PIN.');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.importAccount(phrase, pinToSend);
      const { token, user } = res.data;
      await setAuth(token, { ...user, pinSetup: user.pinSetup ?? false });
      if (!user.pinSetup) {
        Alert.alert('Karibu tena', 'Weka PIN kwa kifaa hiki.');
      }
    } catch (err: any) {
      if (err?.response?.data?.code === 'PIN_REQUIRED') {
        Alert.alert('PIN inahitajika', 'Ingiza PIN za usajili.');
      } else {
        Alert.alert('Restore', err?.response?.data?.error || err?.message || 'Imeshindikana.');
      }
    } finally {
      setLoading(false);
    }
  };

  const canRecover =
    phraseOnly ? phraseOk : addrOk && (method === 'phrase' ? phraseOk : pwOk);

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
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Rejesha akaunti</Text>
              <View style={{ width: 32 }} />
            </View>

            <Text style={styles.title}>Nina wallet tayari</Text>
            <Text style={styles.subtitle}>
              Chaguo kuu: anwari yako ya BEP-20, kisha <Text style={styles.bold}>maneno 12</Text> au{' '}
              <Text style={styles.bold}>nenosiri la akaunti</Text> (lile uliolifanya baada ya email), halafu PIN
              uliyoipanga CLB. Nenosiri na PIN zimhifadhiwa kwa usajili salama (hash).
            </Text>

            {!phraseOnly && (
              <>
                <View style={styles.inputCard}>
                  <Text style={styles.inputLabel}>Anwari ya BEP-20 (Trust / Meta / Binance)</Text>
                  <TextInput
                    style={styles.singleInput}
                    value={walletAddress}
                    onChangeText={setWalletAddress}
                    placeholder="0x…"
                    placeholderTextColor={Colors.textMuted + '80'}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, method === 'phrase' && styles.toggleBtnOn]}
                    onPress={() => setMethod('phrase')}
                  >
                    <Text style={[styles.toggleText, method === 'phrase' && styles.toggleTextOn]}>Maneno 12</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, method === 'password' && styles.toggleBtnOn]}
                    onPress={() => setMethod('password')}
                  >
                    <Text style={[styles.toggleText, method === 'password' && styles.toggleTextOn]}>
                      Nenosiri la akaunti
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {phraseOnly ? (
              <View style={styles.inputCard}>
                <View style={styles.inputHeader}>
                  <Text style={styles.inputLabel}>Recovery phrase (12+)</Text>
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
                  placeholder="word1 word2 … word12"
                  placeholderTextColor={Colors.textMuted + '60'}
                  value={seedInput}
                  onChangeText={setSeedInput}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showPhrase}
                  textAlignVertical="top"
                />
              </View>
            ) : method === 'phrase' ? (
              <View style={styles.inputCard}>
                <View style={styles.inputHeader}>
                  <Text style={styles.inputLabel}>Maneno 12 (yanalingana na anwari hapo juu)</Text>
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
                  placeholder="word1 word2 … word12"
                  placeholderTextColor={Colors.textMuted + '60'}
                  value={seedInput}
                  onChangeText={setSeedInput}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showPhrase}
                  textAlignVertical="top"
                />
                <View style={styles.inputFooter}>
                  <Text style={[styles.wordCount, phraseOk && styles.wordCountValid]}>{wordCount}/12+</Text>
                </View>
              </View>
            ) : (
              <View style={styles.inputCard}>
                <Text style={styles.inputLabel}>Nenosiri la akaunti (baada ya email, usajili)</Text>
                <View style={styles.pwRow}>
                  <TextInput
                    style={styles.pwInput}
                    value={passwordInput}
                    onChangeText={setPasswordInput}
                    placeholder="Angalau herufi 8"
                    placeholderTextColor={Colors.textMuted + '80'}
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeHit}>
                    <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={22} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>PIN ya CLB (tarakimu 6)</Text>
              <TextInput
                style={styles.pinInput}
                placeholder="••••••"
                placeholderTextColor={Colors.textMuted + '60'}
                value={pinInput}
                onChangeText={(t) => setPinInput(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                secureTextEntry
              />
              <Text style={styles.pinHint}>
                Ikiwa akaunti ina PIN, lazima uingize hapa. Ikiwa bado hukumaliza PIN wakati wa usajili, acha tupu
                (inaweza kushindwa — jaribu maneno 12).
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setPhraseOnly(!phraseOnly);
                setWalletAddress('');
                setPasswordInput('');
              }}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>
                {phraseOnly ? 'Rudi: anwari + maneno / nenosiri' : 'Nina maneno 12 pekee (bila anwari) — njia ya zamani'}
              </Text>
            </TouchableOpacity>

            <View style={styles.securityNote}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
              <Text style={styles.securityText}>
                Data inatumwa kwa HTTPS. PIN na nenosiri zimhifadhiwa kama hash kwenye server — si maandishi wazi.
              </Text>
            </View>

            <TouchableOpacity
              onPress={phraseOnly ? doImportPhrase : handleRecover}
              disabled={!canRecover || loading}
              activeOpacity={0.85}
              style={{ marginTop: Spacing.lg }}
            >
              <LinearGradient
                colors={canRecover ? Colors.gradientPrimary : ['#333', '#222']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.importBtn}
              >
                {loading ? (
                  <Text style={styles.importBtnText}>Inachakata…</Text>
                ) : (
                  <>
                    <Ionicons name="download" size={18} color={canRecover ? '#000' : Colors.textMuted} />
                    <Text style={[styles.importBtnText, !canRecover && { color: Colors.textMuted }]}>
                      Rejesha akaunti
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingBottom: Spacing.md,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },

  title: { fontSize: 22, fontWeight: '900', color: Colors.textPrimary, textAlign: 'center' },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
    marginBottom: Spacing.lg,
  },
  bold: { fontWeight: '800', color: Colors.textSecondary },

  inputCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  inputLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  singleInput: {
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  textInput: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    minHeight: 100,
    lineHeight: 22,
  },
  inputFooter: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  wordCount: { fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  wordCountValid: { color: '#00D6A1' },

  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
  },
  toggleBtnOn: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(240,185,11,0.12)',
  },
  toggleText: { fontSize: 13, fontWeight: '700', color: Colors.textMuted },
  toggleTextOn: { color: Colors.textPrimary },

  pwRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
  },
  pwInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  eyeHit: { padding: 8 },

  pinInput: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 8,
    color: Colors.textPrimary,
    paddingVertical: 12,
    textAlign: 'center',
  },
  pinHint: { fontSize: 11, color: Colors.textMuted, marginTop: 8, lineHeight: 16 },

  linkRow: { marginBottom: Spacing.md },
  linkText: { fontSize: 12, fontWeight: '700', color: Colors.primary, textAlign: 'center' },

  securityNote: {
    flexDirection: 'row',
    gap: 10,
    padding: Spacing.md,
    backgroundColor: 'rgba(240,185,11,0.05)',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.1)',
  },
  securityText: { flex: 1, fontSize: 12, fontWeight: '500', color: Colors.textMuted, lineHeight: 18 },

  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
    borderRadius: Radius.lg,
  },
  importBtnText: { fontSize: 16, fontWeight: '900', color: '#000' },
});
