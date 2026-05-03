import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
  Platform, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Button from '../../components/ui/Button';
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

  // Check biometric availability and attempt authentication on mount
  useEffect(() => {
    const checkBiometric = async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (hasHardware && isEnrolled && user?.biometricEnabled) {
        setBiometricAvailable(true);
        try {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock CLB App',
            fallbackLabel: 'Use PIN',
            cancelLabel: 'Cancel',
          });
          if (result.success) {
            onVerified();
          } else {
            setShowPinPad(true);
          }
        } catch (error) {
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

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  const handleVerify = async () => {
    if (pin.length !== 6) {
      Alert.alert('Error', 'Please enter your 6-digit PIN');
      return;
    }

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
  React.useEffect(() => {
    if (pin.length === 6 && !loading) {
      handleVerify();
    }
  }, [pin]);

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!showPinPad ? (
            <View style={styles.loadingContainer}>
              <Ionicons name="finger-print" size={48} color={Colors.primary} />
              <Text style={styles.loadingText}>Authenticating...</Text>
            </View>
          ) : (
            <>
              {/* Header */}
              <View style={styles.header}>
                <LinearGradient colors={Colors.gradientPrimary} style={styles.iconContainer}>
                  <Ionicons name="lock-open" size={32} color="#fff" />
                </LinearGradient>
                <Text style={styles.title}>Enter PIN</Text>
                <Text style={styles.subtitle}>Enter your PIN to unlock the app</Text>
                {attempts > 0 && (
                  <Text style={styles.attempts}>
                    {attempts} of 3 attempts used
                  </Text>
                )}
              </View>

              {/* PIN Dots */}
              <View style={styles.dotsContainer}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={[styles.dot, pin[i] && styles.dotFilled]}>
                    {pin[i] && <View style={styles.dotInner} />}
                  </View>
                ))}
              </View>

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

              <Button label="Unlock" onPress={handleVerify} loading={loading} fullWidth style={styles.btn} />
            </>
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
  loadingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md,
  },
  loadingText: { fontSize: FontSize.md, color: Colors.textSecondary },
  header: { alignItems: 'center', gap: Spacing.md },
  iconContainer: {
    width: 72, height: 72, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  attempts: { fontSize: FontSize.xs, color: Colors.error, marginTop: Spacing.xs },
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
