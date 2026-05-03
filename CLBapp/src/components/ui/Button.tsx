import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, FontSize, Spacing } from '../../constants/theme';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'gold' | 'outline' | 'ghost';
  style?: ViewStyle;
  fullWidth?: boolean;
}

export default function Button({ label, onPress, loading, disabled, variant = 'primary', style, fullWidth }: Props) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  if (variant === 'primary' || variant === 'gold') {
    const gradColors = variant === 'gold' ? Colors.gradientGold : Colors.gradientPrimary;
    return (
      <TouchableOpacity onPress={handlePress} disabled={disabled || loading} style={[fullWidth && { width: '100%' }, style]} activeOpacity={0.8}>
        <LinearGradient colors={gradColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.base, (disabled || loading) && styles.disabled]}>
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.textPrimary}>{label}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'outline') {
    return (
      <TouchableOpacity onPress={handlePress} disabled={disabled || loading} style={[styles.base, styles.outline, fullWidth && { width: '100%' }, style]} activeOpacity={0.7}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="small" />
        ) : (
          <Text style={styles.textOutline}>{label}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} disabled={disabled || loading} style={[styles.ghost, fullWidth && { width: '100%' }, style]} activeOpacity={0.7}>
      <Text style={styles.textGhost}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  disabled: { opacity: 0.5 },
  outline: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  ghost: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  textPrimary: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textOutline: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  textGhost: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
});
