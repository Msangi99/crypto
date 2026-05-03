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
      // Update user to mark PIN as set up
      const { token } = useAuthStore.getState();
      await setAuth(token!, { ...user!, pinSetup: true, biometricEnabled: enableBiometric });
      Alert.alert('Success', 'PIN set successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to set PIN');
    } finally {
      setLoading(false);
    }
  };

  const dots = step === 'enter' ? pin : confirmPin;

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={32} color="#fff" />
            </LinearGradient>
            <Text style={styles.title}>
              {step === 'enter' ? 'Create PIN' : 'Confirm PIN'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'enter'
                ? 'Create a 6-digit PIN to secure your account'
                : 'Enter your PIN again to confirm'}
            </Text>
          </View>

          {/* PIN Dots */}
          <View style={styles.dotsContainer}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={[styles.dot, dots[i] && styles.dotFilled]}>
                {dots[i] && <View style={styles.dotInner} />}
              </View>
            ))}
          </View>

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
              <Text style={styles.biometricText}>Enable Face ID / Fingerprint</Text>
            </TouchableOpacity>
          )}

          {/* Number Pad */}
          <View style={styles.keypad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <TouchableOpacity key={num} style={styles.key} onPress={() => handlePinPress(num)} activeOpacity={0.7}>
                <Text style={styles.keyText}>{num}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.key} />
            <TouchableOpacity style={styles.key} onPress={() => handlePinPress('0')} activeOpacity={0.7}>
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={handleDelete} activeOpacity={0.7}>
              <Ionicons name="backspace-outline" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {step === 'confirm' ? (
            <Button label="Confirm PIN" onPress={handleConfirm} loading={loading} fullWidth style={styles.btn} />
          ) : (
            <Button label="Next" onPress={handleNext} fullWidth style={styles.btn} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    padding: Spacing.lg,
    paddingTop: 100,
    gap: Spacing.xl,
    flex: 1,
  },
  header: { alignItems: 'center', gap: Spacing.md },
  iconContainer: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  dotsContainer: {
    flexDirection: 'row', gap: Spacing.lg, justifyContent: 'center',
  },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.bgElevated,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  dotFilled: {
    borderColor: Colors.primary,
  },
  dotInner: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  biometricToggle: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  biometricText: { fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '600' },
  keypad: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: Spacing.md, justifyContent: 'center',
  },
  key: {
    width: '28%', aspectRatio: 1.3,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  keyText: {
    fontSize: 28, fontWeight: '700', color: Colors.textPrimary,
  },
  btn: { marginTop: Spacing.lg },
});
