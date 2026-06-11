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
import { MoveReminderService, MoveReminder, formatMoveTime12h } from '../services/moveReminder.service';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { SCREEN_PADDING } from '../constants/theme';
import { TierAvatar } from './profile/TierAvatar';

export function NotificationBell({ color = AppTheme.primaryColor, size = 24, containerStyle }: { color?: string; size?: number; containerStyle?: any }) {
  const navigation = useNavigation<any>();
  const { user: authUser } = useAuth();
  const { pendingInvites } = useWorkoutSession();
  const { incomingRequests, friends, acceptRequest, declineRequest } = useFriend();

  const [modalVisible, setModalVisible] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [moveReminder, setMoveReminder] = useState<MoveReminder | null>(null);
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
    setRequestProfiles({});
  }, [incomingRequests]);

  useEffect(() => {
    if (!modalVisible || !authUser?.uid) return;
    MoveReminderService.loadDefault(authUser.uid)
      .then(setMoveReminder)
      .catch(() => {});
  }, [modalVisible, authUser?.uid]);

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
                          <TierAvatar
                            uri={friend.profileImageUrl}
                            size={36}
                            uid={friend.uid}
                            name={friend.fullName || friend.username}
                            disableProfileLink
                          />
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
                  <View style={[styles.dot, { backgroundColor: '#F25912' }]} />
                  <Text style={styles.sectionTitle}>Workout Invites</Text>
                  {pendingInvites.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: '#F25912', marginLeft: 8 }]}>
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
                      <TierAvatar
                        uri={invite.hostAvatarUrl}
                        size={36}
                        uid={invite.hostUid}
                        name={invite.hostName}
                        disableProfileLink
                      />
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.rowName} numberOfLines={1}>{invite.hostName || 'Friend'}</Text>
                        <Text style={styles.rowSub} numberOfLines={1}>{invite.videoTitle || 'Workout invite'}</Text>
                      </View>
                      <View style={[styles.countBadge, { backgroundColor: '#F25912' }]}>
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
                  <Text style={[styles.viewAllText, { color: '#F25912' }]}>View all invites &gt;</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              {/* Move Reminders */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={[styles.dot, { backgroundColor: '#4ade80' }]} />
                  <Text style={styles.sectionTitle}>Move Reminders</Text>
                  {moveReminder?.enabled && moveReminder.generatedTimes.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: '#4ade80', marginLeft: 8 }]}>
                      <Text style={styles.countBadgeText}>{moveReminder.generatedTimes.length}</Text>
                    </View>
                  )}
                </View>

                {!moveReminder || moveReminder.generatedTimes.length === 0 ? (
                  <Text style={styles.emptyText}>No reminders set up yet.</Text>
                ) : (
                  <>
                    <Text style={[styles.emptyText, { marginBottom: 8 }]}>
                      {moveReminder.enabled ? `Active · ${moveReminder.generatedTimes.length} reminders scheduled` : `Paused · ${moveReminder.generatedTimes.length} reminders`}
                    </Text>
                    <View style={styles.moveTimesRow}>
                      {moveReminder.generatedTimes.map((t, i) => {
                        const isLast = i === moveReminder.generatedTimes.length - 1;
                        return (
                          <View key={t} style={[styles.moveTimePill, !moveReminder.enabled && styles.moveTimePillPaused, isLast && styles.moveTimePillStop]}>
                            <Text style={[styles.moveTimePillText, !moveReminder.enabled && styles.moveTimePillTextPaused, isLast && styles.moveTimePillTextStop]}>
                              {formatMoveTime12h(t)}
                            </Text>
                            {isLast && <Text style={styles.moveStopBadge}>STOP</Text>}
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
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
    color: '#211832',
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
    borderTopColor: 'rgba(33,24,50,0.1)',
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
    borderRadius: 8,
  },
  rowName: {
    color: '#211832',
    fontSize: 14,
    fontWeight: '600',
  },
  rowSub: {
    color: '#7A7C90',
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: '#7A7C90',
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
    color: '#211832',
    fontSize: 11,
    fontWeight: 'bold',
  },
  moveTimesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingBottom: 4,
  },
  moveTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(74,222,128,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  moveTimePillPaused: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(33,24,50,0.08)',
  },
  moveTimePillStop: {
    backgroundColor: 'rgba(242,89,18,0.08)',
    borderColor: 'rgba(242,89,18,0.3)',
  },
  moveTimePillText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '600',
  },
  moveTimePillTextPaused: {
    color: 'rgba(150,180,210,0.5)',
  },
  moveTimePillTextStop: {
    color: '#F25912',
  },
  moveStopBadge: {
    color: '#F25912',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(242,89,18,0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  actionBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#211832',
    fontSize: 12,
    fontWeight: '700',
  },
});
