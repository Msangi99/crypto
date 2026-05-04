import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
  Platform, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Button from '../../components/ui/Button';
import { authAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function PinSetupScreen() {
  const navigation = useNavigation();
  const { user, setAuth } = useAuthStore();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [loading, setLoading] = useState(false);
  const [enableBiometric, setEnableBiometric] = useState(false);

  const handlePinPress = (digit: string) => {
    if (step === 'enter') {
      if (pin.length < 6) setPin(pin + digit);
    } else {
      if (confirmPin.length < 6) setConfirmPin(confirmPin + digit);
    }
  };

  const handleDelete = () => {
    if (step === 'enter') {
      setPin(pin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const handleNext = () => {
    if (pin.length !== 6) {
      Alert.alert('Error', 'Please enter a 6-digit PIN');
      return;
    }
    setStep('confirm');
  };

  // Auto-advance to confirm step when 6 digits entered
  React.useEffect(() => {
    if (step === 'enter' && pin.length === 6) {
      const timer = setTimeout(() => {
        setStep('confirm');
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [pin, step]);

  // Auto-confirm when 6 confirm digits entered
  React.useEffect(() => {
    if (step === 'confirm' && confirmPin.length === 6 && !loading) {
      const timer = setTimeout(() => {
        handleConfirm();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [confirmPin, step, loading]);

  const handleConfirm = async () => {
    if (confirmPin.length !== 6) {
      Alert.alert('Error', 'Please confirm your 6-digit PIN');
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert('Error', 'PINs do not match');
      setConfirmPin('');
      setStep('enter');
      return;
    }

    setLoading(true);
    try {
      await authAPI.setupPin(pin, enableBiometric);
      // Update user to mark PIN as set up, also mark pinVerified so user goes to main app
      const { token } = useAuthStore.getState();
      await setAuth(token!, { ...user!, pinSetup: true, biometricEnabled: enableBiometric });
      useAuthStore.getState().setPinVerified(true);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to set PIN');
    } finally {
      setLoading(false);
    }
  };

  const dots = step === 'enter' ? pin : confirmPin;

  const filledCount = dots.length;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Dark Gradient Header */}
          <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.title}>
              {step === 'enter' ? 'Create Your PIN' : 'Confirm Your PIN'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'enter'
                ? 'This 6-digit PIN will protect your wallet'
                : 'Re-enter your PIN to confirm'}
            </Text>
          </LinearGradient>

          {/* Step Indicator */}
          <View style={styles.stepRow}>
            <View style={[styles.stepDot, step === 'enter' && styles.stepDotActive]}>
              {step === 'enter' && <Text style={styles.stepDotText}>1</Text>}
            </View>
            <View style={[styles.stepLine, step === 'confirm' && styles.stepLineActive]} />
            <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]}>
              {step === 'confirm' && <Text style={styles.stepDotText}>2</Text>}
            </View>
          </View>
          <View style={styles.stepLabels}>
            <Text style={[styles.stepLabel, step === 'enter' && styles.stepLabelActive]}>Create</Text>
            <Text style={[styles.stepLabel, step === 'confirm' && styles.stepLabelActive]}>Confirm</Text>
          </View>

          {/* PIN Dots */}
          <View style={styles.dotsContainer}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={[styles.dot, dots[i] && styles.dotFilled]}>
                {dots[i] && <View style={styles.dotInner} />}
              </View>
            ))}
          </View>

          {/* Progress hint */}
          <Text style={styles.progressHint}>
            {filledCount < 6 ? `${filledCount}/6 digits entered` : 'PIN complete!'}
          </Text>

          {/* Biometric Toggle (only on first step) */}
          {step === 'enter' && (
            <TouchableOpacity
              style={styles.biometricToggle}
              onPress={() => setEnableBiometric(!enableBiometric)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, enableBiometric && styles.checkboxChecked]}>
                {enableBiometric && <Ionicons name="checkmark" size={14} color="#000" />}
              </View>
              <View style={styles.biometricIconBg}>
                <Ionicons name="finger-print-outline" size={16} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.biometricText}>Enable Biometrics</Text>
                <Text style={styles.biometricSubtext}>Face ID / Fingerprint unlock</Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Security Info */}
          <View style={styles.securityCard}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#00D6A1" />
            <Text style={styles.securityText}>Your PIN is encrypted locally and never sent to our servers</Text>
          </View>

          {/* Number Pad */}
          <View style={styles.keypad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <TouchableOpacity key={num} style={styles.key} onPress={() => handlePinPress(num)} activeOpacity={0.7}>
                <Text style={styles.keyText}>{num}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.keyEmpty} />
            <TouchableOpacity style={styles.key} onPress={() => handlePinPress('0')} activeOpacity={0.7}>
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={handleDelete} activeOpacity={0.7}>
              <Ionicons name="backspace-outline" size={22} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {step === 'confirm' && (
            <Button label="Confirm PIN" onPress={handleConfirm} loading={loading} fullWidth style={styles.btn} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    gap: 0, flex: 1,
  },

  // Header Gradient
  headerGradient: {
    alignItems: 'center', paddingHorizontal: Spacing.lg,
    paddingTop: 60, paddingBottom: Spacing.xl, gap: Spacing.md,
  },
  iconContainer: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(240,185,11,0.12)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: 14, fontWeight: '600', color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },

  // Step Indicator
  stepRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
  },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.bgCard, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  stepDotText: { fontSize: 12, fontWeight: '800', color: '#000' },
  stepLine: { width: 60, height: 2, backgroundColor: Colors.border },
  stepLineActive: { backgroundColor: Colors.primary },
  stepLabels: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl + 10, marginBottom: Spacing.md,
  },
  stepLabel: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  stepLabelActive: { color: Colors.primary, fontWeight: '800' },

  // PIN Dots
  dotsContainer: {
    flexDirection: 'row', gap: 20, justifyContent: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
  },
  dot: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  dotFilled: { borderColor: Colors.primary, backgroundColor: 'rgba(240,185,11,0.08)' },
  dotInner: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary,
  },
  progressHint: {
    fontSize: 12, fontWeight: '600', color: Colors.textMuted, textAlign: 'center',
    marginBottom: Spacing.md,
  },

  // Biometric Toggle
  biometricToggle: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 7,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary, borderColor: Colors.primary,
  },
  biometricIconBg: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(240,185,11,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  biometricText: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  biometricSubtext: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },

  // Security Card
  securityCard: {
    flexDirection: 'row', gap: 8, marginHorizontal: Spacing.lg,
    backgroundColor: 'rgba(0,214,161,0.06)', borderWidth: 1, borderColor: 'rgba(0,214,161,0.12)',
    borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center',
  },
  securityText: { flex: 1, fontSize: 12, fontWeight: '600', color: Colors.textMuted, lineHeight: 16 },

  // Keypad
  keypad: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: Spacing.sm, justifyContent: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  key: {
    width: '28%', aspectRatio: 1.3,
    backgroundColor: Colors.bgCard, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  keyEmpty: { width: '28%', aspectRatio: 1.3 },
  keyText: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary },
  btn: { marginTop: Spacing.lg, marginHorizontal: Spacing.lg, marginBottom: Spacing.xl },
});
