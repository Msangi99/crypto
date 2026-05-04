import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius, Shadow } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const LOGO = require('../../../assets/logo.png');

export default function WelcomeScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0B0E1A', '#1A1F35', '#0B0E1A']} style={styles.gradient}>
        {/* Top decorative elements */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        {/* Logo & Brand */}
        <View style={styles.topSection}>
          <View style={styles.logoContainer}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <View style={styles.logoGlow} />
          </View>
          <Text style={styles.brandName}>CLB Wallet</Text>
          <Text style={styles.tagline}>Secure. Simple. Smart.</Text>
        </View>

        {/* Feature pills */}
        <View style={styles.features}>
          {[
            { icon: 'shield-checkmark', label: 'Non-Custodial' },
            { icon: 'wallet', label: 'Multi-Asset' },
            { icon: 'trending-up', label: 'DeFi Pools' },
          ].map((f) => (
            <View key={f.label} style={styles.featurePill}>
              <Ionicons name={f.icon as any} size={14} color={Colors.primary} />
              <Text style={styles.featureText}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Bottom CTA */}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => navigation.navigate('CreateWallet')}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={Colors.gradientPrimary}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.createBtnGradient}
            >
              <Ionicons name="add-circle" size={22} color="#000" />
              <Text style={styles.createBtnText}>Create New Wallet</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.importBtn}
            onPress={() => navigation.navigate('ImportWallet')}
            activeOpacity={0.85}
          >
            <Ionicons name="download-outline" size={20} color={Colors.primary} />
            <Text style={styles.importBtnText}>I Already Have a Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.connectBtn}
            onPress={() => navigation.navigate('ConnectWallet')}
            activeOpacity={0.85}
          >
            <Ionicons name="link-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.connectBtnText}>Connect with Address</Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0E1A' },
  gradient: { flex: 1, justifyContent: 'space-between', alignItems: 'center' },

  decorCircle1: {
    position: 'absolute', top: -80, right: -60,
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(240,185,11,0.06)',
  },
  decorCircle2: {
    position: 'absolute', bottom: 120, left: -80,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(59,130,246,0.04)',
  },

  topSection: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  logoContainer: { position: 'relative', marginBottom: 20 },
  logo: { width: 90, height: 90, borderRadius: 22 },
  logoGlow: {
    position: 'absolute', top: -10, left: -10, right: -10, bottom: -10,
    borderRadius: 32, backgroundColor: 'rgba(240,185,11,0.08)',
  },
  brandName: {
    fontSize: 32, fontWeight: '900', color: Colors.textPrimary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16, fontWeight: '600', color: Colors.textMuted,
    marginTop: 8, letterSpacing: 2,
  },

  features: {
    flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg,
    marginBottom: 40,
  },
  featurePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99,
    backgroundColor: 'rgba(240,185,11,0.08)',
    borderWidth: 1, borderColor: 'rgba(240,185,11,0.15)',
  },
  featureText: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary },

  bottomSection: {
    width: '100%', paddingHorizontal: Spacing.xl,
    paddingBottom: 50, gap: 14,
  },
  createBtn: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.glow },
  createBtnGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, gap: 10, borderRadius: Radius.lg,
  },
  createBtnText: { fontSize: 17, fontWeight: '900', color: '#000' },

  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, gap: 10, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: 'rgba(240,185,11,0.3)',
    backgroundColor: 'rgba(240,185,11,0.06)',
  },
  importBtnText: { fontSize: 15, fontWeight: '800', color: Colors.primary },

  connectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8,
  },
  connectBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },

  disclaimer: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    textAlign: 'center', marginTop: 8, lineHeight: 16,
  },
});
