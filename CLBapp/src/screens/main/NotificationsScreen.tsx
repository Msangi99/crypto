import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl,
  TouchableOpacity, FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, Radius } from '../../constants/theme';
import { notificationsAPI } from '../../services/api';

const TYPE_ICON: Record<string, any> = {
  INFO: 'information-circle', DEPOSIT: 'arrow-down-circle', WITHDRAWAL: 'arrow-up-circle',
  REWARD: 'star', REFERRAL: 'gift', SECURITY: 'shield-checkmark', POOL: 'water',
};
const TYPE_COLOR: Record<string, string> = {
  INFO: Colors.primary, DEPOSIT: '#00D6A1', WITHDRAWAL: '#FF4757',
  REWARD: '#F0B90B', REFERRAL: '#F0B90B', SECURITY: '#00D6A1', POOL: Colors.primary,
};

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (pageNum = 1, append = false) => {
    try {
      const res = await notificationsAPI.list(pageNum, 20);
      const data = res.data;
      setUnreadCount(data.unreadCount ?? 0);
      setNotifications(prev => append ? [...prev, ...data.notifications] : data.notifications);
      setHasMore(data.pagination?.page < data.pagination?.totalPages);
      setPage(pageNum);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(1, false); };

  const markRead = async (id: string) => {
    try {
      await notificationsAPI.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (e) { console.error(e); }
  };

  const loadMore = () => { if (hasMore && !loading) load(page + 1, true); };

  const formatTime = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const renderItem = ({ item }: { item: any }) => {
    const icon = TYPE_ICON[item.type] || 'notifications';
    const color = TYPE_COLOR[item.type] || Colors.primary;
    return (
      <TouchableOpacity
        style={[styles.notifItem, !item.isRead && styles.notifItemUnread]}
        onPress={() => !item.isRead && markRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.notifIconBg, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, !item.isRead && styles.notifTitleUnread]}>{item.title}</Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
          <Text style={styles.notifTime}>{formatTime(item.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A1F35', '#0B0E1A']} style={styles.headerGradient}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>Loading...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Notifications</Text>
          <Text style={styles.emptyText}>You're all caught up! Check back later.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  headerGradient: { paddingBottom: Spacing.md },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: Spacing.md,
  },
  backBtn: { padding: 4, marginRight: Spacing.md },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: Colors.textPrimary },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: 'rgba(240,185,11,0.12)' },
  markAllText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 100 },
  notifItem: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  notifItemUnread: { borderColor: 'rgba(240,185,11,0.2)', backgroundColor: 'rgba(240,185,11,0.04)' },
  notifIconBg: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1, gap: 4 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  notifTitleUnread: { color: Colors.textPrimary, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  notifBody: { fontSize: 13, fontWeight: '500', color: Colors.textMuted, lineHeight: 18 },
  notifTime: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: Spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
});
