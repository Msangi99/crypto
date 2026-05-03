import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView,
  Platform, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import Button from '../../components/ui/Button';
import { authAPI } from '../../services/api';

interface PinVerifyScreenProps {
  onVerified: () => void;
}

export default function PinVerifyScreen({ onVerified }: PinVerifyScreenProps) {
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [loading, setLoading] = useState(false);

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
    <LinearGradient colors={['#0D0D0D', '#0D0D0D']} style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-open" size={48} color={Colors.primary} />
            </View>
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
              <View key={i} style={[styles.dot, pin[i] && styles.dotFilled]} />
            ))}
          </View>

          {/* Number Pad */}
          <View style={styles.keypad}>
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
              <TouchableOpacity key={num} style={styles.key} onPress={() => handlePinPress(num)}>
                <Text style={styles.keyText}>{num}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.key} />
            <TouchableOpacity style={styles.key} onPress={() => handlePinPress('0')}>
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.key} onPress={handleDelete}>
              <Ionicons name="backspace-outline" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <Button label="Unlock" onPress={handleVerify} loading={loading} fullWidth style={styles.btn} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: Spacing.lg,
    paddingTop: 80,
    gap: Spacing.xl,
    flex: 1,
  },
  header: { alignItems: 'center', gap: Spacing.sm },
  iconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(240,185,11,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center' },
  attempts: { fontSize: FontSize.xs, color: Colors.error, marginTop: Spacing.xs },
  dotsContainer: {
    flexDirection: 'row', gap: Spacing.md, justifyContent: 'center',
  },
  dot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.border,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
  },
  keypad: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: Spacing.md, justifyContent: 'center',
  },
  key: {
    width: '28%', aspectRatio: 1.4,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  keyText: {
    fontSize: FontSize.xxl, fontWeight: '700', color: Colors.textPrimary,
  },
  btn: { marginTop: Spacing.lg },
});
