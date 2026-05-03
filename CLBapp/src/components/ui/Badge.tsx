import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Radius, FontSize } from '../../constants/theme';

type Variant = 'success' | 'error' | 'warning' | 'primary' | 'gold';

interface Props {
  label: string;
  variant?: Variant;
}

const variantMap: Record<Variant, { bg: string; color: string }> = {
  success: { bg: Colors.successBg, color: Colors.success },
  error: { bg: Colors.errorBg, color: Colors.error },
  warning: { bg: Colors.warningBg, color: Colors.warning },
  primary: { bg: 'rgba(26,86,255,0.15)', color: Colors.primary },
  gold: { bg: 'rgba(245,166,35,0.15)', color: Colors.gold },
};

export default function Badge({ label, variant = 'primary' }: Props) {
  const v = variantMap[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }]}>
      <Text style={[styles.text, { color: v.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
