import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, TextInput,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../services/api';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout, setAuth } = useAuthStore();
  const [notifications, setNotifications] = useState(true);
  const [biometrics, setBiometrics] = useState(user?.biometricEnabled || false);
  const [editModal, setEditModal] = useState(false);
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [secretKeyModal, setSecretKeyModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [secretKeyLoading, setSecretKeyLoading] = useState(false);

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

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const res = await authAPI.updateProfile({ username: editUsername, email: editEmail });
      const { token } = useAuthStore.getState();
      await setAuth(token!, { ...user!, username: editUsername, email: editEmail });
      Alert.alert('Success', 'Profile updated');
      setEditModal(false);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    setEditUsername(user?.username || '');
    setEditEmail(user?.email || '');
    setEditModal(true);
  };

  const handleViewSecretKey = () => {
    setPinInput('');
    setSecretKey('');
    setSecretKeyModal(true);
  };

  const handleRevealSecretKey = async () => {
    if (!pinInput || pinInput.length !== 6) {
      Alert.alert('Invalid PIN', 'Enter your 6-digit PIN');
      return;
    }
    setSecretKeyLoading(true);
    try {
      const res = await authAPI.viewSecretKey(pinInput);
      setSecretKey(res.data.secretKey);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to retrieve secret key');
    } finally {
      setSecretKeyLoading(false);
    }
  };

  const handleCopySecretKey = async () => {
    if (secretKey) {
      await Clipboard.setStringAsync(secretKey);
      Alert.alert('Copied', 'Secret key copied to clipboard. Store it safely!');
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      // Check if biometric is available
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!hasHardware || !isEnrolled) {
        Alert.alert('Biometric Not Available', 'Your device does not support biometric authentication or no biometric is enrolled.');
        return;
      }
      
      // Require authentication to enable
      try {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Enable Biometric Unlock',
          fallbackLabel: 'Use PIN',
          cancelLabel: 'Cancel',
        });
        
        if (result.success) {
          const { token } = useAuthStore.getState();
          await setAuth(token!, { ...user!, biometricEnabled: true });
          setBiometrics(true);
          Alert.alert('Success', 'Biometric unlock enabled');
        }
      } catch (error) {
        // User cancelled or authentication failed
        console.log('Biometric auth failed:', error);
      }
    } else {
      // Disable without authentication
      const { token } = useAuthStore.getState();
      await setAuth(token!, { ...user!, biometricEnabled: false });
      setBiometrics(false);
    }
  };

  const handleGenerateSecretKey = async () => {
    Alert.alert(
      'Generate Secret Key',
      'This will create a new recovery phrase for your account. Save it securely — it will NOT be shown again!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: async () => {
            setSecretKeyLoading(true);
            try {
              const res = await authAPI.generateSecretKey();
              setSecretKey(res.data.secretKey);
              Alert.alert('Secret Key Generated', 'SAVE THIS KEY NOW! It will not be shown again.');
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to generate');
            } finally {
              setSecretKeyLoading(false);
            }
          },
        },
      ]
    );
  };

  const shortAddr = user?.walletAddress
    ? `${user.walletAddress.slice(0, 10)}...${user.walletAddress.slice(-6)}`
    : '';

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Dark Gradient Header */}
        <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
          <View style={styles.heroTopRow}>
            <View />
            <TouchableOpacity onPress={handleEditProfile} style={styles.editProfileBtn}>
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
              <Text style={styles.editProfileText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarOuter}>
              <Text style={styles.avatarText}>{(user?.username ?? user?.walletAddress ?? 'U')[0].toUpperCase()}</Text>
            </View>
            <View style={styles.avatarBadge}>
              <Ionicons name="checkmark" size={12} color="#000" />
            </View>
          </View>

          <Text style={styles.username}>{user?.username ?? 'CLB User'}</Text>
          <Text style={styles.memberSince}>Member since {new Date(user?.createdAt || Date.now()).getFullYear()}</Text>

          {/* Wallet Address Pill */}
          <TouchableOpacity onPress={copyAddress} style={styles.walletPill} activeOpacity={0.8}>
            <Ionicons name="wallet-outline" size={14} color={Colors.primary} />
            <Text style={styles.walletPillText}>{shortAddr}</Text>
            <View style={styles.walletPillCopy}>
              <Ionicons name="copy-outline" size={11} color="#000" />
            </View>
          </TouchableOpacity>

          {/* Quick Stats */}
          <View style={styles.quickStatsRow}>
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>{user?.referralCode ?? '——'}</Text>
              <Text style={styles.quickStatLabel}>Referral Code</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={[styles.quickStatValue, { color: Colors.primary }]}>L1-5</Text>
              <Text style={styles.quickStatLabel}>Commission</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStatItem}>
              <Text style={styles.quickStatValue}>v1.0</Text>
              <Text style={styles.quickStatLabel}>Version</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Referral Gold Card */}
          <TouchableOpacity activeOpacity={0.9} style={styles.referralOuter} onPress={() => navigation.navigate('Referrals')}>
            <LinearGradient colors={Colors.gradientGold} style={styles.referralCard}>
              <View style={styles.referralIconBg}>
                <Ionicons name="gift" size={20} color={Colors.gold} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.referralLabel}>Referral Code</Text>
                <Text style={styles.referralCode}>{user?.referralCode ?? '——'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(0,0,0,0.4)" />
            </LinearGradient>
          </TouchableOpacity>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.settingsList}>
            <SettingRow
              icon="notifications-outline"
              iconColor={Colors.primary}
              label="Push Notifications"
              right={<Switch value={notifications} onValueChange={setNotifications} thumbColor={Colors.primary} trackColor={{ true: Colors.primaryLight, false: Colors.border }} />}
            />
            <View style={styles.settingDivider} />
            <SettingRow
              icon="finger-print-outline"
              iconColor={Colors.primary}
              label="Biometric Unlock"
              right={<Switch value={biometrics} onValueChange={handleBiometricToggle} thumbColor={Colors.primary} trackColor={{ true: Colors.primaryLight, false: Colors.border }} />}
            />
          </View>
        </View>

        {/* Security */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <View style={styles.settingsList}>
            <TouchableOpacity onPress={handleViewSecretKey}>
              <SettingRow icon="key-outline" iconColor="#00D6A1" label="View Secret Key" right={<Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />} />
            </TouchableOpacity>
            <View style={styles.settingDivider} />
            <TouchableOpacity onPress={handleGenerateSecretKey}>
              <SettingRow icon="refresh-outline" iconColor="#00D6A1" label="Generate Secret Key" right={<Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tools</Text>
          <View style={styles.settingsList}>
            <TouchableOpacity onPress={() => navigation.navigate('Calculator')}>
              <SettingRow icon="calculator-outline" iconColor={Colors.gold} label="Profit Calculator" right={<Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />} />
            </TouchableOpacity>
            <View style={styles.settingDivider} />
            <TouchableOpacity onPress={() => navigation.navigate('Receipts')}>
              <SettingRow icon="ribbon-outline" iconColor={Colors.gold} label="Receipt Tokens" right={<Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />} />
            </TouchableOpacity>
            <View style={styles.settingDivider} />
            <TouchableOpacity onPress={() => navigation.navigate('Activity')}>
              <SettingRow icon="time-outline" iconColor={Colors.gold} label="Transaction History" right={<Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />} />
            </TouchableOpacity>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.settingsList}>
            {[
              { icon: 'globe-outline', iconColor: Colors.textSecondary, label: 'Website', value: 'cryptoloanboost.com' },
              { icon: 'document-text-outline', iconColor: Colors.textSecondary, label: 'Terms of Service', value: '' },
              { icon: 'shield-outline', iconColor: Colors.textSecondary, label: 'Privacy Policy', value: '' },
              { icon: 'information-circle-outline', iconColor: Colors.textSecondary, label: 'Version', value: '1.0.0' },
            ].map((item, i, arr) => (
              <View key={item.label}>
                <SettingRow
                  icon={item.icon as any}
                  iconColor={item.iconColor}
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
          </View>
        </View>

        {/* Danger zone */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#FF4757" />
          <Text style={styles.logoutText}>Disconnect Wallet</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Profile</Text>
                <TouchableOpacity onPress={() => setEditModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Username</Text>
                  <TextInput
                    style={styles.input}
                    value={editUsername}
                    onChangeText={setEditUsername}
                    placeholder="Enter username"
                    placeholderTextColor={Colors.textMuted}
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder="Enter email"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.modalFooter}>
                <TouchableOpacity onPress={() => setEditModal(false)} style={styles.modalCancelBtn}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveProfile} style={styles.modalSaveBtn} disabled={loading}>
                  <Text style={styles.modalSaveText}>{loading ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Secret Key Modal */}
      <Modal visible={secretKeyModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Secret Key</Text>
                <TouchableOpacity onPress={() => setSecretKeyModal(false)}>
                  <Ionicons name="close" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {!secretKey ? (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Enter your PIN to reveal</Text>
                      <TextInput
                        style={styles.input}
                        value={pinInput}
                        onChangeText={setPinInput}
                        placeholder="6-digit PIN"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="number-pad"
                        maxLength={6}
                        secureTextEntry
                      />
                    </View>
                    <TouchableOpacity onPress={handleRevealSecretKey} style={styles.modalSaveBtn} disabled={secretKeyLoading}>
                      <Text style={styles.modalSaveText}>{secretKeyLoading ? 'Verifying...' : 'Reveal Secret Key'}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.secretKeyCard}>
                      <View style={styles.secretKeyWarning}>
                        <Ionicons name="warning-outline" size={16} color={Colors.primary} />
                        <Text style={styles.secretKeyWarningText}>
                          Never share this key. Store it safely offline.
                        </Text>
                      </View>
                      <Text style={styles.secretKeyText}>{secretKey}</Text>
                    </View>
                    <TouchableOpacity onPress={handleCopySecretKey} style={styles.modalSaveBtn}>
                      <Ionicons name="copy-outline" size={18} color="#000" />
                      <Text style={styles.modalSaveText}>Copy to Clipboard</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function SettingRow({ icon, iconColor, label, right }: { icon: string; iconColor?: string; label: string; right: React.ReactNode }) {
  return (
    <View style={styles.settingRow}>
      <View style={[styles.settingIconBg, iconColor ? { backgroundColor: iconColor + '18' } : {}]}>
        <Ionicons name={icon as any} size={18} color={iconColor || Colors.textSecondary} />
      </View>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={{ marginLeft: 'auto' }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header Gradient
  headerGradient: {
    paddingBottom: Spacing.md, alignItems: 'center', paddingHorizontal: Spacing.lg,
  },
  heroTopRow: {
    width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 56, paddingBottom: Spacing.md,
  },
  editProfileBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(240,185,11,0.1)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
  },
  editProfileText: { fontSize: 13, fontWeight: '700', color: Colors.primary },

  // Avatar
  avatarWrapper: { marginBottom: Spacing.md, position: 'relative' },
  avatarOuter: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(240,185,11,0.15)', borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0B0E1A',
  },
  avatarText: { fontSize: 32, fontWeight: '900', color: Colors.primary },
  username: { fontSize: 24, fontWeight: '900', color: Colors.textPrimary, marginBottom: 2 },
  memberSince: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, marginBottom: Spacing.md },

  // Wallet Pill
  walletPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(240,185,11,0.1)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
    borderRadius: 99, paddingHorizontal: 14, paddingVertical: 8,
  },
  walletPillText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, fontFamily: 'monospace' },
  walletPillCopy: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  // Quick Stats
  quickStatsRow: {
    flexDirection: 'row', marginTop: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: Radius.lg,
    padding: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    width: '100%',
  },
  quickStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  quickStatValue: { fontSize: 14, fontWeight: '800', color: Colors.textPrimary },
  quickStatLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  quickStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.08)' },

  // Content
  content: { padding: Spacing.lg, gap: Spacing.lg },

  // Referral Card
  referralOuter: { borderRadius: Radius.xl, overflow: 'hidden' },
  referralCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg },
  referralIconBg: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  referralLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(0,0,0,0.5)' },
  referralCode: { fontSize: 18, fontWeight: '900', color: '#000' },

  // Section
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, paddingHorizontal: 4 },

  // Settings List
  settingsList: {
    backgroundColor: Colors.bgCard, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md,
  },
  settingIconBg: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  settingDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: Spacing.md },
  settingLabel: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, flex: 1 },
  settingValue: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },

  // Logout
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(255,71,87,0.08)', borderWidth: 1, borderColor: 'rgba(255,71,87,0.2)',
    borderRadius: Radius.lg, padding: Spacing.md,
  },
  logoutText: { fontSize: 15, fontWeight: '800', color: '#FF4757' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xl, gap: Spacing.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  modalBody: { gap: Spacing.md },
  inputGroup: { gap: Spacing.xs },
  inputLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, fontSize: 15, color: Colors.textPrimary,
  },
  modalFooter: { flexDirection: 'row', gap: Spacing.md },
  modalCancelBtn: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary },
  modalSaveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: Spacing.md, borderRadius: Radius.md, backgroundColor: Colors.primary,
  },
  modalSaveText: { fontSize: 15, fontWeight: '800', color: '#000' },
  secretKeyCard: {
    backgroundColor: 'rgba(240,185,11,0.08)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
    borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md,
  },
  secretKeyWarning: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secretKeyWarningText: { flex: 1, fontSize: 12, fontWeight: '700', color: Colors.primary },
  secretKeyText: { fontSize: 15, color: Colors.textPrimary, fontFamily: 'monospace', lineHeight: 24, flexWrap: 'wrap' },
});
