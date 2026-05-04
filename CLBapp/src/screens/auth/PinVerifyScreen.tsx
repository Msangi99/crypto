import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { authAPI } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

interface PinVerifyScreenProps {
  onVerified: () => void;
}

export default function PinVerifyScreen({ onVerified }: PinVerifyScreenProps) {
  const { user } = useAuthStore();
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [showPinPad, setShowPinPad] = useState(false);

  useEffect(() => {
    const checkBiometric = async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled && user?.biometricEnabled) {
        setBiometricAvailable(true);
        try {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock CLB Wallet',
            fallbackLabel: 'Use PIN',
            cancelLabel: 'Cancel',
          });
          if (result.success) {
            onVerified();
          } else {
            setShowPinPad(true);
          }
        } catch {
          setShowPinPad(true);
        }
      } else {
        setShowPinPad(true);
      }
    };
    checkBiometric();
  }, [user?.biometricEnabled, onVerified]);

  const handlePinPress = (digit: string) => {
    if (pin.length < 6) setPin(pin + digit);
  };

  const handleDelete = () => setPin(pin.slice(0, -1));

  const handleVerify = async () => {
    if (pin.length !== 6) return;

    setLoading(true);
    try {
      await authAPI.verifyPin(pin);
      onVerified();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Invalid PIN';
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin('');
      if (newAttempts >= 3) {
        Alert.alert('Too Many Attempts', 'Please try again later');
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-verify when 6 digits entered
  useEffect(() => {
    if (pin.length === 6 && !loading) {
      const timer = setTimeout(() => handleVerify(), 300);
      return () => clearTimeout(timer);
    }
  }, [pin]);

  const triggerBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock CLB Wallet',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) onVerified();
    } catch {}
  };

  // Biometric waiting screen
  if (!showPinPad) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.biometricScreen}>
          <View style={styles.biometricIconBg}>
            <Ionicons name="finger-print" size={48} color={Colors.primary} />
          </View>
          <Text style={styles.biometricTitle}>Welcome Back</Text>
          <Text style={styles.biometricSubtitle}>Use biometrics to unlock</Text>
          <TouchableOpacity style={styles.usePinBtn} onPress={() => setShowPinPad(true)}>
            <Ionicons name="keypad-outline" size={16} color={Colors.primary} />
            <Text style={styles.usePinText}>Use PIN instead</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  }

  // PIN entry screen
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex1}
      >
        <View style={styles.flex1}>
          {/* Header */}
          <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={28} color={Colors.primary} />
            </View>
            <Text style={styles.title}>Unlock Wallet</Text>
            <Text style={styles.subtitle}>Enter your 6-digit PIN</Text>
            {attempts > 0 && (
              <View style={styles.attemptsBadge}>
                <Ionicons name="warning-outline" size={12} color="#FF4757" />
                <Text style={styles.attemptsText}>{attempts} of 3 attempts</Text>
              </View>
            )}
          </LinearGradient>

          {/* PIN Dots */}
          <View style={styles.dotsSection}>
            <View style={styles.dotsContainer}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View key={i} style={[styles.dot, pin[i] && styles.dotFilled]}>
                  {pin[i] && <View style={styles.dotInner} />}
                </View>
              ))}
            </View>
            <Text style={styles.progressHint}>
              {pin.length < 6 ? `${pin.length}/6` : 'Verifying...'}
            </Text>
          </View>

          {/* Number Pad */}
          <View style={styles.keypadSection}>
            <View style={styles.keypadRow}>
              {['1', '2', '3'].map((num) => (
                <TouchableOpacity key={num} style={styles.key} onPress={() => handlePinPress(num)} activeOpacity={0.7}>
                  <Text style={styles.keyText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.keypadRow}>
              {['4', '5', '6'].map((num) => (
                <TouchableOpacity key={num} style={styles.key} onPress={() => handlePinPress(num)} activeOpacity={0.7}>
                  <Text style={styles.keyText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.keypadRow}>
              {['7', '8', '9'].map((num) => (
                <TouchableOpacity key={num} style={styles.key} onPress={() => handlePinPress(num)} activeOpacity={0.7}>
                  <Text style={styles.keyText}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.keypadRow}>
              {biometricAvailable ? (
                <TouchableOpacity style={styles.key} onPress={triggerBiometric} activeOpacity={0.7}>
                  <Ionicons name="finger-print" size={26} color={Colors.primary} />
                </TouchableOpacity>
              ) : (
                <View style={styles.keyPlaceholder} />
              )}
              <TouchableOpacity style={styles.key} onPress={() => handlePinPress('0')} activeOpacity={0.7}>
                <Text style={styles.keyText}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.key} onPress={handleDelete} activeOpacity={0.7}>
                <Ionicons name="backspace-outline" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  flex1: { flex: 1 },

  // Biometric Screen
  biometricScreen: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, gap: Spacing.md,
  },
  biometricIconBg: {
    width: 96, height: 96, borderRadius: 32,
    backgroundColor: 'rgba(240,185,11,0.1)', borderWidth: 1.5, borderColor: 'rgba(240,185,11,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  biometricTitle: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  biometricSubtitle: { fontSize: 15, fontWeight: '600', color: Colors.textMuted },
  usePinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: Spacing.xl, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 99, backgroundColor: 'rgba(240,185,11,0.08)',
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.15)',
  },
  usePinText: { fontSize: 14, fontWeight: '700', color: Colors.primary },

  // Header
  headerGradient: {
    alignItems: 'center', paddingHorizontal: Spacing.lg,
    paddingTop: 60, paddingBottom: Spacing.xl, gap: Spacing.sm,
  },
  iconContainer: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: 'rgba(240,185,11,0.1)', borderWidth: 1.5, borderColor: 'rgba(240,185,11,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: 14, fontWeight: '600', color: Colors.textMuted },

  // Attempts
  attemptsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,71,87,0.08)', borderWidth: 1, borderColor: 'rgba(255,71,87,0.15)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99,
  },
  attemptsText: { fontSize: 12, fontWeight: '700', color: '#FF4757' },

  // Dots
  dotsSection: { alignItems: 'center', paddingVertical: Spacing.xl },
  dotsContainer: { flexDirection: 'row', gap: 18, justifyContent: 'center' },
  dot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  dotFilled: { borderColor: Colors.primary, backgroundColor: 'rgba(240,185,11,0.1)' },
  dotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  progressHint: {
    fontSize: 12, fontWeight: '600', color: Colors.textMuted, marginTop: Spacing.md,
  },

  // Keypad
  keypadSection: {
    paddingHorizontal: Spacing.xl, paddingBottom: 50,
    justifyContent: 'flex-end',
  },
  keypadRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  key: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  keyPlaceholder: { width: 76, height: 76 },
  keyText: { fontSize: 28, fontWeight: '500', color: Colors.textPrimary },
});
