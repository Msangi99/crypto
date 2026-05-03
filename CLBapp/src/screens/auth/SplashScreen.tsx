import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, FontSize, Spacing } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const LOGO = require('../../../assets/logo.png');

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const logoScale = useRef(new Animated.Value(0.2)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(0.6)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const ring1Opacity = useRef(new Animated.Value(0)).current;
  const ring1Scale = useRef(new Animated.Value(0.5)).current;
  const ring2Opacity = useRef(new Animated.Value(0)).current;
  const ring2Scale = useRef(new Animated.Value(0.5)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textY = useRef(new Animated.Value(20)).current;
  const loadingWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // Phase 1: Logo bursts in
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.8, duration: 600, useNativeDriver: true }),
        Animated.spring(glowScale, { toValue: 1.1, friction: 5, tension: 40, useNativeDriver: true }),
      ]),
      // Phase 2: Rings pulse outward
      Animated.parallel([
        Animated.timing(ring1Opacity, { toValue: 0.5, duration: 300, useNativeDriver: true }),
        Animated.timing(ring1Scale, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(ring2Opacity, { toValue: 0.25, duration: 400, useNativeDriver: true }),
        Animated.timing(ring2Scale, { toValue: 1.7, duration: 900, useNativeDriver: true }),
      ]),
      // Phase 3: Text slides up
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(textY, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]),
      // Phase 4: Loading bar fills
      Animated.timing(loadingWidth, { toValue: 1, duration: 700, useNativeDriver: false }),
    ]).start(() => {
      setTimeout(onFinish, 300);
    });
  }, []);

  const loadingBarWidth = loadingWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient colors={['#0D0D0D', '#111111', '#1A1A1A']} style={styles.container}>
      {/* Background radial effect */}
      <View style={styles.bgGlow} />

      <View style={styles.center}>
        {/* Glow rings behind logo */}
        <View style={styles.ringsContainer}>
          <Animated.View style={[
            styles.ring,
            styles.ring2,
            { opacity: ring2Opacity, transform: [{ scale: ring2Scale }] },
          ]} />
          <Animated.View style={[
            styles.ring,
            styles.ring1,
            { opacity: ring1Opacity, transform: [{ scale: ring1Scale }] },
          ]} />
          <Animated.View style={[
            styles.glowBlob,
            { opacity: glowOpacity, transform: [{ scale: glowScale }] },
          ]} />

          {/* Logo image */}
          <Animated.View style={[
            styles.logoWrapper,
            { transform: [{ scale: logoScale }], opacity: logoOpacity },
          ]}>
            <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
          </Animated.View>
        </View>

        {/* App name & tagline */}
        <Animated.View style={[
          styles.textBlock,
          { opacity: textOpacity, transform: [{ translateY: textY }] },
        ]}>
          <Text style={styles.appName}>CryptoLoanBoost</Text>
          <Text style={styles.tagline}>Leverage. Earn. Dominate.</Text>

          {/* Decorative divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDot} />
            <View style={styles.dividerLine} />
          </View>

          {/* Feature pills */}
          <View style={styles.pillsRow}>
            {['Up to 60x', '5-Level Refs', 'BSC Chain'].map((p) => (
              <View key={p} style={styles.pill}>
                <Text style={styles.pillText}>{p}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </View>

      {/* Bottom loading bar */}
      <View style={styles.bottomSection}>
        <View style={styles.loadingTrack}>
          <Animated.View style={[styles.loadingBar, { width: loadingBarWidth }]} />
        </View>
        <Text style={styles.version}>v1.0.0 · Powered by BSC</Text>
      </View>
    </LinearGradient>
  );
}

const LOGO_SIZE = width * 0.42;
const RING_BASE = LOGO_SIZE + 30;

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 60 },
  bgGlow: {
    position: 'absolute',
    top: height * 0.15,
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    backgroundColor: 'rgba(240,185,11,0.04)',
    alignSelf: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },

  ringsContainer: {
    width: RING_BASE + 120,
    height: RING_BASE + 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1.5,
  },
  ring1: {
    width: RING_BASE + 40,
    height: RING_BASE + 40,
    borderColor: 'rgba(240,185,11,0.4)',
  },
  ring2: {
    width: RING_BASE + 90,
    height: RING_BASE + 90,
    borderColor: 'rgba(240,185,11,0.15)',
  },
  glowBlob: {
    position: 'absolute',
    width: LOGO_SIZE + 40,
    height: LOGO_SIZE + 40,
    borderRadius: (LOGO_SIZE + 40) / 2,
    backgroundColor: 'rgba(240,185,11,0.18)',
  },
  logoWrapper: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE * 0.22,
    overflow: 'hidden',
    shadowColor: '#F0B90B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 20,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },

  textBlock: { alignItems: 'center', gap: Spacing.sm },
  appName: {
    fontSize: FontSize.xxl + 4,
    fontWeight: '900',
    color: Colors.textPrimary,
    letterSpacing: 0.8,
  },
  tagline: {
    fontSize: FontSize.md,
    color: Colors.gold,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: Spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border, maxWidth: 60 },
  dividerDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: Colors.gold },

  pillsRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(240,185,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(240,185,11,0.25)',
  },
  pillText: { fontSize: FontSize.xs, color: Colors.gold, fontWeight: '700' },

  bottomSection: { alignItems: 'center', gap: Spacing.sm, width: '100%', paddingHorizontal: Spacing.xl },
  loadingTrack: {
    width: '70%',
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 99,
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: Colors.gold,
  },
  version: { fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 0.5 },
});
