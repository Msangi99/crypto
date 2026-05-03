import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuthStore();
  const [notifications, setNotifications] = useState(true);
  const [biometrics, setBiometrics] = useState(false);

  const handleLogout = () => {
    Alert.alert('Disconnect Wallet', 'Are you sure you want to disconnect?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: logout },
    ]);
  };

  const copyAddress = async () => {
    await Clipboard.setStringAsync(user?.walletAddress ?? '');
    Alert.alert('Copied', 'Wallet address copied');
  };

  const shortAddr = user?.walletAddress
    ? `${user.walletAddress.slice(0, 10)}...${user.walletAddress.slice(-6)}`
    : '';

  return (
    <LinearGradient colors={['#0D0D0D', '#0D0D0D']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: Spacing.lg }}>
        {/* Avatar & wallet */}
        <LinearGradient colors={['#222222', '#1A1A1A']} style={styles.profileCard}>
          <View style={styles.avatar}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.avatarGrad}>
              <Text style={styles.avatarText}>{(user?.walletAddress ?? 'W')[2].toUpperCase()}</Text>
            </LinearGradient>
          </View>
          <Text style={styles.username}>{user?.username ?? 'CLB User'}</Text>
          <TouchableOpacity onPress={copyAddress} style={styles.addrRow}>
            <Text style={styles.addrText}>{shortAddr}</Text>
            <Ionicons name="copy-outline" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={styles.refRow}>
            <Ionicons name="gift-outline" size={14} color={Colors.gold} />
            <Text style={styles.refCode}>{user?.referralCode ?? '——'}</Text>
          </View>
        </LinearGradient>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <LinearGradient colors={Colors.gradientCard} style={styles.settingsList}>
            <SettingRow
              icon="notifications-outline"
              label="Push Notifications"
              right={<Switch value={notifications} onValueChange={setNotifications} thumbColor={Colors.primary} trackColor={{ true: Colors.primaryLight, false: Colors.border }} />}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="finger-print-outline"
              label="Biometric Unlock"
              right={<Switch value={biometrics} onValueChange={setBiometrics} thumbColor={Colors.primary} trackColor={{ true: Colors.primaryLight, false: Colors.border }} />}
            />
          </LinearGradient>
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tools</Text>
          <LinearGradient colors={Colors.gradientCard} style={styles.settingsList}>
            <TouchableOpacity onPress={() => navigation.navigate('Calculator')}>
              <SettingRow icon="calculator-outline" label="Profit Calculator" right={<Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />} />
            </TouchableOpacity>
            <View style={styles.settingDivider} />
            <TouchableOpacity onPress={() => navigation.navigate('Receipts')}>
              <SettingRow icon="ribbon-outline" label="Receipt Tokens" right={<Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />} />
            </TouchableOpacity>
            <View style={styles.settingDivider} />
            <TouchableOpacity onPress={() => navigation.navigate('Activity')}>
              <SettingRow icon="time-outline" label="Transaction History" right={<Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />} />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <LinearGradient colors={Colors.gradientCard} style={styles.settingsList}>
            {[
              { icon: 'globe-outline', label: 'Website', value: 'cryptoloanboost.com' },
              { icon: 'document-text-outline', label: 'Terms of Service', value: '' },
              { icon: 'shield-outline', label: 'Privacy Policy', value: '' },
              { icon: 'information-circle-outline', label: 'Version', value: '1.0.0' },
            ].map((item, i, arr) => (
              <View key={item.label}>
                <SettingRow
                  icon={item.icon as any}
                  label={item.label}
                  right={
                    item.value
                      ? <Text style={styles.settingValue}>{item.value}</Text>
                      : <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                  }
                />
                {i < arr.length - 1 && <View style={styles.settingDivider} />}
              </View>
            ))}
          </LinearGradient>
        </View>

        {/* Danger zone */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Disconnect Wallet</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
    </LinearGradient>
  );
}

function SettingRow({ icon, label, right }: { icon: string; label: string; right: React.ReactNode }) {
  return (
    <View style={styles.settingRow}>
      <Ionicons name={icon as any} size={20} color={Colors.textSecondary} />
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={{ marginLeft: 'auto' }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.lg },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.textPrimary },
  profileCard: {
    borderRadius: Radius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', gap: Spacing.sm,
  },
  avatar: { marginBottom: Spacing.sm },
  avatarGrad: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  username: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addrText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: 'monospace' },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  refCode: { fontSize: FontSize.md, fontWeight: '700', color: Colors.gold, letterSpacing: 2 },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textSecondary, paddingHorizontal: 4 },
  settingsList: { borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.md,
  },
  settingDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
  settingLabel: { fontSize: FontSize.md, color: Colors.textPrimary, flex: 1 },
  settingValue: { fontSize: FontSize.sm, color: Colors.textSecondary },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.errorBg, borderWidth: 1, borderColor: Colors.error + '40',
    borderRadius: Radius.lg, padding: Spacing.md,
  },
  logoutText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.error },
});
