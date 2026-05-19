import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Bell, X, CircleUserRound, UserPlus } from 'lucide-react-native';
import { Video as VideoIcon } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { useFriend } from '../providers/FriendContext';
import { ChatService, getChatId } from '../services/chat.service';
import { ChatConversation } from '../models/Chat';
import { db } from '../core/config/firebase';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { SCREEN_PADDING } from '../constants/theme';

export function NotificationBell({ color = AppTheme.primaryColor, size = 24, containerStyle }: { color?: string; size?: number; containerStyle?: any }) {
  const navigation = useNavigation<any>();
  const { user: authUser } = useAuth();
  const { pendingInvites } = useWorkoutSession();
  const { incomingRequests, friends, acceptRequest, declineRequest } = useFriend();

  const [modalVisible, setModalVisible] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [requestProfiles, setRequestProfiles] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!authUser?.uid) return;
    const unsub = ChatService.subscribeToConversations(authUser.uid, (convos: ChatConversation[]) => {
      const total = convos.reduce((sum, c) => sum + (c.unreadCount?.[authUser.uid] ?? 0), 0);
      setUnreadChatCount(total);
      setChatConversations(convos);
    });
    return unsub;
  }, [authUser?.uid]);

  useEffect(() => {
    const uids = incomingRequests.map((r) => r.fromUid);
    if (uids.length === 0) { setRequestProfiles({}); return; }
    Promise.all(
      [...new Set(uids)].map(async (uid) => {
        try {
          const { doc: fsDoc, getDoc } = await import('firebase/firestore');
          const snap = await getDoc(fsDoc(db, 'users', uid));
          if (snap.exists()) return { ...(snap.data()), uid };
        } catch { /* ignore */ }
        return null;
      })
    ).then((results) => {
      const map: Record<string, any> = {};
      results.forEach((u) => { if (u) map[u.uid] = u; });
      setRequestProfiles(map);
    });
  }, [incomingRequests]);

  const totalBadge = pendingInvites.length + incomingRequests.length + unreadChatCount;

  return (
    <>
      <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.8} style={[styles.bellBtn, containerStyle]}>
        <Bell color={color} size={size} />
        {totalBadge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{totalBadge > 99 ? '99+' : totalBadge}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X color={AppTheme.textGrey} size={24} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Chat Inbox */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.dot, { backgroundColor: '#4FC3F7' }]} />
                  <Text style={styles.sectionTitle}>Chat Inbox</Text>
                  {unreadChatCount > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: '#4FC3F7', marginLeft: 8 }]}>
                      <Text style={styles.countBadgeText}>{unreadChatCount}</Text>
                    </View>
                  )}
                </View>
                {friends.length === 0 ? (
                  <Text style={styles.emptyText}>No friends yet. Add friends to start chatting.</Text>
                ) : (
                  [...friends]
                    .sort((a: any, b: any) => {
                      const aConvo = chatConversations.find((c) => c.id === getChatId(authUser!.uid, a.uid));
                      const bConvo = chatConversations.find((c) => c.id === getChatId(authUser!.uid, b.uid));
                      return (bConvo?.lastMessageAt?.toMillis() ?? 0) - (aConvo?.lastMessageAt?.toMillis() ?? 0);
                    })
                    .slice(0, 2)
                    .map((friend: any) => {
                      const chatId = getChatId(authUser!.uid, friend.uid);
                      const convo = chatConversations.find((c) => c.id === chatId);
                      const unread = convo?.unreadCount?.[authUser!.uid] ?? 0;
                      return (
                        <TouchableOpacity
                          key={friend.uid}
                          style={styles.row}
                          activeOpacity={0.7}
                          onPress={() => {
                            setModalVisible(false);
                            navigation.navigate('ChatRoom', {
                              friendUid: friend.uid,
                              friendName: friend.fullName || friend.username,
                              friendAvatar: friend.profileImageUrl,
                            });
                          }}
                        >
                          {friend.profileImageUrl ? (
                            <Image source={{ uri: friend.profileImageUrl }} style={styles.avatar} />
                          ) : (
                            <View style={[styles.avatar, { backgroundColor: 'rgba(79,195,247,0.12)', justifyContent: 'center', alignItems: 'center' }]}>
                              <CircleUserRound color="#4FC3F7" size={18} />
                            </View>
                          )}
                          <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.rowName} numberOfLines={1}>{friend.fullName || friend.username}</Text>
                            <Text style={styles.rowSub} numberOfLines={1}>{convo?.lastMessage || 'Say hi!'}</Text>
                          </View>
                          {unread > 0 && (
                            <View style={[styles.countBadge, { backgroundColor: '#4FC3F7' }]}>
                              <Text style={styles.countBadgeText}>{unread}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })
                )}
                <TouchableOpacity
                  style={styles.viewAll}
                  onPress={() => { setModalVisible(false); navigation.navigate('FriendsScreen'); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.viewAllText, { color: '#4FC3F7' }]}>View all messages &gt;</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Workout Invites */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.dot, { backgroundColor: '#FF6B00' }]} />
                  <Text style={styles.sectionTitle}>Workout Invites</Text>
                  {pendingInvites.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: '#FF6B00', marginLeft: 8 }]}>
                      <Text style={styles.countBadgeText}>{pendingInvites.length}</Text>
                    </View>
                  )}
                </View>
                {pendingInvites.length === 0 ? (
                  <Text style={styles.emptyText}>No pending invites.</Text>
                ) : (
                  pendingInvites.slice(0, 2).map((invite: any) => (
                    <TouchableOpacity
                      key={invite.id}
                      style={styles.row}
                      activeOpacity={0.7}
                      onPress={() => { setModalVisible(false); navigation.navigate('UpcomingSessionsScreen'); }}
                    >
                      {invite.hostAvatarUrl ? (
                        <Image source={{ uri: invite.hostAvatarUrl }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, { backgroundColor: 'rgba(255,107,0,0.12)', justifyContent: 'center', alignItems: 'center' }]}>
                          <VideoIcon color="#FF6B00" size={18} />
                        </View>
                      )}
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.rowName} numberOfLines={1}>{invite.hostName || 'Friend'}</Text>
                        <Text style={styles.rowSub} numberOfLines={1}>{invite.videoTitle || 'Workout invite'}</Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: '#FF6B00' }]}>
                        <Text style={styles.countBadgeText}>View</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
                <TouchableOpacity
                  style={styles.viewAll}
                  onPress={() => { setModalVisible(false); navigation.navigate('UpcomingSessionsScreen'); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.viewAllText, { color: '#FF6B00' }]}>View all invites &gt;</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: {
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: AppTheme.primaryColor,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: AppTheme.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SCREEN_PADDING,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  modalTitle: {
    fontSize: FontSizes.h3,
    fontWeight: FontWeights.bold as any,
    color: AppTheme.textWhite,
  },
  closeBtn: {
    padding: 4,
  },
  section: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  sectionTitle: {
    color: AppTheme.textWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  rowName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: '#607a94',
    fontSize: 13,
    paddingVertical: 8,
  },
  viewAll: {
    paddingVertical: 12,
    alignItems: 'flex-end',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  countBadge: {
    backgroundColor: AppTheme.primaryColor,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginRight: 4,
  },
  countBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  actionBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
