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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: Spacing.lg, paddingBottom: 100 }}>
        {/* Profile Card */}
        <LinearGradient colors={Colors.gradientCard} style={styles.profileCard}>
          <View style={styles.avatarSection}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.avatarGrad}>
              <Text style={styles.avatarText}>{(user?.username ?? user?.walletAddress ?? 'U')[0].toUpperCase()}</Text>
            </LinearGradient>
            <TouchableOpacity onPress={handleEditProfile} style={styles.editAvatarBtn}>
              <Ionicons name="camera-outline" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.username}>{user?.username ?? 'CLB User'}</Text>
          <Text style={styles.memberSince}>Member since {new Date(user?.createdAt || Date.now()).getFullYear()}</Text>
          
          <View style={styles.walletCard}>
            <View style={styles.walletRow}>
              <Ionicons name="wallet-outline" size={16} color={Colors.primary} />
              <Text style={styles.walletLabel}>Wallet Address</Text>
            </View>
            <TouchableOpacity onPress={copyAddress} style={styles.addrRow}>
              <Text style={styles.addrText}>{shortAddr}</Text>
              <Ionicons name="copy-outline" size={14} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.referralCard}>
            <View style={styles.refHeader}>
              <Ionicons name="gift-outline" size={16} color={Colors.gold} />
              <Text style={styles.refLabel}>Referral Code</Text>
            </View>
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
              right={<Switch value={biometrics} onValueChange={handleBiometricToggle} thumbColor={Colors.primary} trackColor={{ true: Colors.primaryLight, false: Colors.border }} />}
            />
          </LinearGradient>
        </View>

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <LinearGradient colors={Colors.gradientCard} style={styles.settingsList}>
            <TouchableOpacity onPress={handleViewSecretKey}>
              <SettingRow icon="key-outline" label="View Secret Key" right={<Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />} />
            </TouchableOpacity>
            <View style={styles.settingDivider} />
            <TouchableOpacity onPress={handleGenerateSecretKey}>
              <SettingRow icon="create-outline" label="Generate Secret Key" right={<Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />} />
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Tools */}
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
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '900', color: Colors.textPrimary },
  settingsBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  profileCard: {
    borderRadius: Radius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', gap: Spacing.md,
  },
  avatarSection: { position: 'relative', marginBottom: Spacing.sm },
  avatarGrad: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '900', color: '#fff' },
  editAvatarBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
  },
  username: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  memberSince: { fontSize: FontSize.sm, color: Colors.textMuted },
  walletCard: {
    width: '100%', backgroundColor: Colors.bg, borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.sm,
  },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  walletLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addrText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontFamily: 'monospace' },
  referralCard: {
    width: '100%', backgroundColor: 'rgba(240,185,11,0.08)', borderRadius: Radius.lg,
    padding: Spacing.md, gap: Spacing.xs, borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
  },
  refHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '600' },
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
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.xl, gap: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.textPrimary },
  modalBody: { gap: Spacing.md },
  inputGroup: { gap: Spacing.xs },
  inputLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radius.md, padding: Spacing.md, fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  modalFooter: {
    flexDirection: 'row', gap: Spacing.md,
  },
  modalCancelBtn: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textSecondary },
  modalSaveBtn: {
    flex: 1, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  modalSaveText: { fontSize: FontSize.md, fontWeight: '700', color: '#000' },
  // Secret Key Modal
  secretKeyCard: {
    backgroundColor: 'rgba(240,185,11,0.08)', borderWidth: 1, borderColor: 'rgba(240,185,11,0.2)',
    borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md,
  },
  secretKeyWarning: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  secretKeyWarningText: {
    flex: 1, fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600',
  },
  secretKeyText: {
    fontSize: FontSize.md, color: Colors.textPrimary, fontFamily: 'monospace',
    lineHeight: 24, flexWrap: 'wrap',
  },
});
