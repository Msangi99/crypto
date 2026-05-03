import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch, TextInput,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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

  const shortAddr = user?.walletAddress
    ? `${user.walletAddress.slice(0, 10)}...${user.walletAddress.slice(-6)}`
    : '';

  return (
    <LinearGradient colors={[Colors.bg, Colors.bg]} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.lg, paddingTop: 0, gap: Spacing.lg }}>
        {/* Avatar & wallet */}
        <LinearGradient colors={Colors.gradientCard} style={styles.profileCard}>
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
          <TouchableOpacity onPress={handleEditProfile} style={styles.editBtn}>
            <Ionicons name="create-outline" size={16} color={Colors.primary} />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
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
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(240,185,11,0.1)', borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.primary,
  },
  editBtnText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
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
});
