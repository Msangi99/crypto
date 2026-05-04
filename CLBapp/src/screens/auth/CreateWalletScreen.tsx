import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../constants/theme';
import { authAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const { width } = Dimensions.get('window');

type Step = 'generating' | 'backup' | 'confirm';

export default function CreateWalletScreen({ navigation }: any) {
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<Step>('generating');
  const [seedPhrase, setSeedPhrase] = useState<string[]>([]);
  const [walletAddress, setWalletAddress] = useState('');
  const [token, setToken] = useState('');
  const [userData, setUserData] = useState<any>(null);

  // Confirm step state
  const [confirmWords, setConfirmWords] = useState<(string | null)[]>([]);
  const [confirmIndices, setConfirmIndices] = useState<number[]>([]);
  const [shuffledWords, setShuffledWords] = useState<string[]>([]);
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    createWallet();
  }, []);

  const createWallet = async () => {
    try {
      const res = await authAPI.createWallet();
      const { seedPhrase: phrase, walletAddress: addr, token: t, user } = res.data;
      const words = phrase.split(' ');
      setSeedPhrase(words);
      setWalletAddress(addr);
      setToken(t);
      setUserData(user);

      // Small delay for UX feel
      setTimeout(() => setStep('backup'), 1500);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to create wallet');
      navigation.goBack();
    }
  };

  const setupConfirmStep = () => {
    // Pick 4 random indices user must confirm
    const indices: number[] = [];
    while (indices.length < 4) {
      const idx = Math.floor(Math.random() * 12);
      if (!indices.includes(idx)) indices.push(idx);
    }
    indices.sort((a, b) => a - b);
    setConfirmIndices(indices);
    setConfirmWords([null, null, null, null]);

    // Shuffle all 12 words for the word bank
    const shuffled = [...seedPhrase].sort(() => Math.random() - 0.5);
    setShuffledWords(shuffled);
    setSelectedCount(0);
    setStep('confirm');
  };

  const handleWordSelect = (word: string) => {
    if (selectedCount >= 4) return;

    const newConfirm = [...confirmWords];
    newConfirm[selectedCount] = word;
    setConfirmWords(newConfirm);
    setSelectedCount(selectedCount + 1);
  };

  const handleWordRemove = (index: number) => {
    const newConfirm = [...confirmWords];
    // Remove this and shift remaining left
    for (let i = index; i < 3; i++) {
      newConfirm[i] = newConfirm[i + 1];
    }
    newConfirm[3] = null;
    setConfirmWords(newConfirm);
    setSelectedCount(Math.max(0, selectedCount - 1));
  };

  const verifyAndProceed = async () => {
    // Check if selected words match the correct words at those indices
    for (let i = 0; i < confirmIndices.length; i++) {
      if (confirmWords[i] !== seedPhrase[confirmIndices[i]]) {
        Alert.alert('Incorrect', 'The words you selected don\'t match. Please try again.');
        setConfirmWords([null, null, null, null]);
        setSelectedCount(0);
        return;
      }
    }

    // Success — authenticate user
    await setAuth(token, { ...userData, pinSetup: false });
    // Navigation to PinSetup is handled by RootNavigator
  };

  // ─── Generating Step ──────────────────────────
  if (step === 'generating') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0B0E1A', '#1A1F35']} style={styles.centeredGradient}>
          <View style={styles.generatingContainer}>
            <View style={styles.generatingIcon}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
            <Text style={styles.generatingTitle}>Creating Your Wallet</Text>
            <Text style={styles.generatingSubtitle}>Generating secure keys...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // ─── Backup Step ──────────────────────────────
  if (step === 'backup') {
    const shortAddr = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0B0E1A', '#1A1F35', '#0B0E1A']} style={styles.gradient}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Recovery Phrase</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* Warning */}
            <View style={styles.warningCard}>
              <Ionicons name="warning" size={20} color="#FF4757" />
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>Write this down!</Text>
                <Text style={styles.warningText}>
                  This is the ONLY way to recover your wallet. Never share it with anyone. Store it safely offline.
                </Text>
              </View>
            </View>

            {/* Wallet Address */}
            <View style={styles.addressCard}>
              <Text style={styles.addressLabel}>Your Wallet Address</Text>
              <Text style={styles.addressValue}>{shortAddr}</Text>
            </View>

            {/* Seed Phrase Grid */}
            <View style={styles.seedGrid}>
              {seedPhrase.map((word, i) => (
                <View key={i} style={styles.seedWord}>
                  <Text style={styles.seedIndex}>{i + 1}</Text>
                  <Text style={styles.seedText}>{word}</Text>
                </View>
              ))}
            </View>

            {/* Continue */}
            <TouchableOpacity onPress={setupConfirmStep} activeOpacity={0.85}>
              <LinearGradient
                colors={Colors.gradientPrimary}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.continueBtn}
              >
                <Text style={styles.continueBtnText}>I've Written It Down</Text>
                <Ionicons name="arrow-forward" size={18} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </LinearGradient>
      </View>
    );
  }

  // ─── Confirm Step ─────────────────────────────
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0B0E1A', '#1A1F35', '#0B0E1A']} style={styles.gradient}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setStep('backup')} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Verify Phrase</Text>
            <View style={{ width: 32 }} />
          </View>

          <Text style={styles.confirmSubtitle}>
            Select the correct word for each position to verify you've saved your recovery phrase.
          </Text>

          {/* Slots to fill */}
          <View style={styles.confirmSlots}>
            {confirmIndices.map((wordIdx, slotIdx) => (
              <TouchableOpacity
                key={slotIdx}
                style={[
                  styles.confirmSlot,
                  confirmWords[slotIdx] && styles.confirmSlotFilled,
                  confirmWords[slotIdx] === seedPhrase[wordIdx] && styles.confirmSlotCorrect,
                ]}
                onPress={() => confirmWords[slotIdx] && handleWordRemove(slotIdx)}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmSlotIndex}>#{wordIdx + 1}</Text>
                <Text style={styles.confirmSlotWord}>
                  {confirmWords[slotIdx] || '___'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Word Bank */}
          <Text style={styles.wordBankLabel}>Tap to select:</Text>
          <View style={styles.wordBank}>
            {shuffledWords.map((word, i) => {
              const isSelected = confirmWords.includes(word);
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.wordBankItem, isSelected && styles.wordBankItemUsed]}
                  onPress={() => !isSelected && handleWordSelect(word)}
                  activeOpacity={isSelected ? 1 : 0.7}
                  disabled={isSelected}
                >
                  <Text style={[styles.wordBankText, isSelected && styles.wordBankTextUsed]}>
                    {word}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Confirm Button */}
          {selectedCount === 4 && (
            <TouchableOpacity onPress={verifyAndProceed} activeOpacity={0.85} style={{ marginTop: Spacing.lg }}>
              <LinearGradient
                colors={Colors.gradientPrimary}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.continueBtn}
              >
                <Text style={styles.continueBtnText}>Verify & Continue</Text>
                <Ionicons name="checkmark-circle" size={18} color="#000" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E1A' },
  gradient: { flex: 1 },
  centeredGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 60 },

  // Generating
  generatingContainer: { alignItems: 'center', gap: 20 },
  generatingIcon: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(240,185,11,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  generatingTitle: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary },
  generatingSubtitle: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: Spacing.lg,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },

  // Warning
  warningCard: {
    flexDirection: 'row', gap: 12, padding: Spacing.md,
    backgroundColor: 'rgba(255,71,87,0.08)', borderRadius: Radius.lg,
    borderWidth: 1, borderColor: 'rgba(255,71,87,0.2)', marginBottom: Spacing.lg,
  },
  warningTitle: { fontSize: 14, fontWeight: '800', color: '#FF4757' },
  warningText: { fontSize: 12, fontWeight: '500', color: Colors.textMuted, marginTop: 2, lineHeight: 18 },

  // Address
  addressCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing.md, backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg,
  },
  addressLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  addressValue: { fontSize: 14, fontWeight: '800', color: Colors.primary },

  // Seed Grid
  seedGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.xl,
  },
  seedWord: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    width: (width - Spacing.lg * 2 - 20) / 3,
    paddingVertical: 12, paddingHorizontal: 10,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  seedIndex: { fontSize: 11, fontWeight: '800', color: Colors.textMuted, minWidth: 16 },
  seedText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },

  // Continue button
  continueBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, gap: 10, borderRadius: Radius.lg,
  },
  continueBtnText: { fontSize: 16, fontWeight: '900', color: '#000' },

  // Confirm
  confirmSubtitle: {
    fontSize: 14, fontWeight: '500', color: Colors.textMuted,
    textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg,
  },
  confirmSlots: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
    justifyContent: 'center', marginBottom: Spacing.xl,
  },
  confirmSlot: {
    width: (width - Spacing.lg * 2 - 20) / 2,
    paddingVertical: 16, paddingHorizontal: 14,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', gap: 4,
  },
  confirmSlotFilled: { borderStyle: 'solid', borderColor: Colors.primary, backgroundColor: 'rgba(240,185,11,0.06)' },
  confirmSlotCorrect: { borderColor: Colors.primary },
  confirmSlotIndex: { fontSize: 12, fontWeight: '800', color: Colors.textMuted },
  confirmSlotWord: { fontSize: 16, fontWeight: '800', color: Colors.textPrimary },

  // Word Bank
  wordBankLabel: { fontSize: 13, fontWeight: '700', color: Colors.textMuted, marginBottom: Spacing.md },
  wordBank: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  wordBankItem: {
    paddingVertical: 10, paddingHorizontal: 16,
    backgroundColor: Colors.bgCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  wordBankItemUsed: { opacity: 0.3, backgroundColor: Colors.bgElevated },
  wordBankText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  wordBankTextUsed: { color: Colors.textMuted },
});
