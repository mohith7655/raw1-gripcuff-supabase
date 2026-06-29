/**
 * NotificationCenter — the notification sections that used to live behind the
 * Home-screen bell, now embedded directly in the Social tab.
 *
 * Self-contained: it loads its own data (chat inbox, workout invites, club
 * invites, club chat, challenges, move reminders) from the same services the
 * Home modal used, so it can be dropped into the Social feed header with no
 * props. Unlike the old version there is no modal wrapper — it renders inline.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Bell, CircleUserRound, Video as VideoIcon, Swords } from 'lucide-react-native';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { useFriend } from '../providers/FriendContext';
import { ChatService, getChatId } from '../services/chat.service';
import { ChatConversation } from '../models/Chat';
import { MoveReminderService, MoveReminder, AlarmConfig } from '../services/moveReminder.service';
import { ChallengeSessionService, PreviousChallenge } from '../services/challengeSession.service';
import { reminderWatcherService } from '../services/reminderWatcher.service';
import { supabase } from '../core/config/supabase';
import { TierAvatar } from './profile/TierAvatar';
import { AlarmPillSheet } from './AlarmPillSheet';
import { AlarmListRow } from './AlarmListRow';

const TEXT = '#211832';
const MUTED = '#7A7C90';

function formatChallengeDate(iso: string): string {
  const then = new Date(iso);
  if (isNaN(then.getTime())) return '';
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.floor((now.getTime() - then.getTime()) / dayMs);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NotificationCenter({ embedded = false }: { embedded?: boolean }) {
  const navigation = useNavigation<any>();
  const { supabaseUserId, user: authUser } = useAuth();
  const { profile } = useUser();
  const { pendingInvites } = useWorkoutSession();
  const { friends } = useFriend();

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [chatConversations, setChatConversations] = useState<ChatConversation[]>([]);
  const [myClubs, setMyClubs] = useState<Array<{ id: string; name: string; avatar_url: string | null }>>([]);
  const [pendingClubInvites, setPendingClubInvites] = useState<Array<{ club_id: string; clubs: { name: string; avatar_url: string | null } | null }>>([]);
  const [moveReminder, setMoveReminder] = useState<MoveReminder | null>(null);
  const [challengeHistory, setChallengeHistory] = useState<PreviousChallenge[]>([]);
  const [alarmSheetVisible, setAlarmSheetVisible] = useState(false);
  const [selectedAlarm, setSelectedAlarm] = useState<AlarmConfig | null>(null);

  // Chat inbox — live unread + last-message data.
  useEffect(() => {
    if (!authUser?.uid) return;
    const unsub = ChatService.subscribeToConversations(authUser.uid, (convos: ChatConversation[]) => {
      const total = convos.reduce((sum, c) => sum + (c.unreadCount?.[authUser.uid] ?? 0), 0);
      setUnreadChatCount(total);
      setChatConversations(convos);
    });
    return unsub;
  }, [authUser?.uid]);

  // Clubs the user belongs to + pending club invites.
  useEffect(() => {
    if (!supabaseUserId) return;
    supabase
      .from('club_members')
      .select('club_id, role, clubs:club_id (id, name, avatar_url)')
      .eq('user_id', supabaseUserId)
      .then(({ data }) => {
        if (!data) return;
        setMyClubs(
          data
            .filter((r: any) => r.clubs)
            .map((r: any) => ({ id: r.clubs.id, name: r.clubs.name, avatar_url: r.clubs.avatar_url }))
        );
      });
    supabase
      .from('club_members')
      .select('club_id, clubs:club_id (name, avatar_url)')
      .eq('user_id', supabaseUserId)
      .eq('role', 'invited')
      .then(({ data }) => setPendingClubInvites((data ?? []) as any));
  }, [supabaseUserId]);

  // Move reminders + challenge history — refresh whenever the Social tab focuses.
  const loadReminderAndChallenges = useCallback(() => {
    if (!supabaseUserId) return;
    MoveReminderService.loadDefault(supabaseUserId).then(setMoveReminder).catch(() => {});
    ChallengeSessionService.loadPreviousForUser(supabaseUserId).then(setChallengeHistory).catch(() => {});
  }, [supabaseUserId]);

  useFocusEffect(useCallback(() => { loadReminderAndChallenges(); }, [loadReminderAndChallenges]));

  const saveAlarmConfigsFromPanel = async (configs: AlarmConfig[]) => {
    if (!supabaseUserId || !moveReminder) return;
    try {
      const saved = await MoveReminderService.save(supabaseUserId, {
        ...moveReminder,
        alarmConfigs: configs,
        generatedTimes: configs.map((c) => c.time),
      });
      setMoveReminder(saved);
      reminderWatcherService.invalidateMoveCache();
    } catch {}
  };

  const alarmConfigs: AlarmConfig[] = moveReminder
    ? (moveReminder.alarmConfigs?.length
        ? moveReminder.alarmConfigs
        : moveReminder.generatedTimes.map((t) => ({ time: t, enabled: true })))
    : [];

  return (
    <View style={embedded ? s.wrapEmbedded : s.wrap}>
      {!embedded && (
        <View style={s.titleRow}>
          <Bell color="#4C4E78" size={18} />
          <Text style={s.title}>Notifications</Text>
        </View>
      )}

      {/* ── Chat Inbox ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={[s.dot, { backgroundColor: '#4FC3F7' }]} />
          <Text style={s.sectionTitle}>Chat Inbox</Text>
          {unreadChatCount > 0 && (
            <View style={[s.countBadge, { backgroundColor: '#4FC3F7', marginLeft: 8 }]}>
              <Text style={s.countBadgeText}>{unreadChatCount}</Text>
            </View>
          )}
        </View>
        {friends.length === 0 ? (
          <Text style={s.emptyText}>No friends yet. Add friends to start chatting.</Text>
        ) : (
          [...friends]
            .sort((a: any, b: any) => {
              const aConvo = chatConversations.find((c) => c.id === getChatId(authUser!.uid, a.uid));
              const bConvo = chatConversations.find((c) => c.id === getChatId(authUser!.uid, b.uid));
              const ms = (x: any) => (x instanceof Date ? x.getTime() : x?.toMillis?.() ?? 0);
              return ms(bConvo?.lastMessageAt) - ms(aConvo?.lastMessageAt);
            })
            .slice(0, 2)
            .map((friend: any) => {
              const chatId = getChatId(authUser!.uid, friend.uid);
              const convo = chatConversations.find((c) => c.id === chatId);
              const unread = convo?.unreadCount?.[authUser!.uid] ?? 0;
              return (
                <TouchableOpacity
                  key={friend.uid}
                  style={s.row}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('ChatRoom', {
                    friendUid: friend.uid,
                    friendName: friend.fullName || friend.username,
                    friendAvatar: friend.profileImageUrl,
                  })}
                >
                  <TierAvatar
                    uri={friend.profileImageUrl}
                    size={36}
                    uid={friend.uid}
                    name={friend.fullName || friend.username}
                    disableProfileLink
                    fallback={
                      <View style={[s.iconFallback, { backgroundColor: 'rgba(79,195,247,0.12)' }]}>
                        <CircleUserRound color="#4FC3F7" size={18} />
                      </View>
                    }
                  />
                  <View style={s.rowText}>
                    <Text style={s.rowName} numberOfLines={1}>{friend.fullName || friend.username}</Text>
                    <Text style={s.rowSub} numberOfLines={1}>{convo?.lastMessage || 'Say hi!'}</Text>
                  </View>
                  {unread > 0 && (
                    <View style={[s.countBadge, { backgroundColor: '#4FC3F7' }]}>
                      <Text style={s.countBadgeText}>{unread}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
        )}
        <TouchableOpacity style={s.viewAll} onPress={() => navigation.navigate('FriendsScreen')} activeOpacity={0.7}>
          <Text style={[s.viewAllText, { color: '#4FC3F7' }]}>View all messages &gt;</Text>
        </TouchableOpacity>
      </View>

      <View style={s.divider} />

      {/* ── Workout Invites ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={[s.dot, { backgroundColor: '#F25912' }]} />
          <Text style={s.sectionTitle}>Workout Invites</Text>
          {pendingInvites.length > 0 && (
            <View style={[s.countBadge, { backgroundColor: '#F25912', marginLeft: 8 }]}>
              <Text style={s.countBadgeText}>{pendingInvites.length}</Text>
            </View>
          )}
        </View>
        {pendingInvites.length === 0 ? (
          <Text style={s.emptyText}>No pending invites.</Text>
        ) : (
          pendingInvites.slice(0, 2).map((invite: any) => (
            <TouchableOpacity
              key={invite.id}
              style={s.row}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('UpcomingSessionsScreen')}
            >
              <TierAvatar
                uri={invite.hostAvatarUrl}
                size={36}
                uid={invite.hostUid}
                name={invite.hostName}
                disableProfileLink
                fallback={
                  <View style={[s.iconFallback, { backgroundColor: 'rgba(242,89,18,0.12)' }]}>
                    <VideoIcon color="#F25912" size={18} />
                  </View>
                }
              />
              <View style={s.rowText}>
                <Text style={s.rowName} numberOfLines={1}>{invite.hostName || 'Friend'}</Text>
                <Text style={s.rowSub} numberOfLines={1}>{invite.videoTitle || 'Workout invite'}</Text>
              </View>
              <View style={[s.countBadge, { backgroundColor: '#F25912' }]}>
                <Text style={s.countBadgeText}>View</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <TouchableOpacity style={s.viewAll} onPress={() => navigation.navigate('UpcomingSessionsScreen')} activeOpacity={0.7}>
          <Text style={[s.viewAllText, { color: '#F25912' }]}>View all invites &gt;</Text>
        </TouchableOpacity>
      </View>

      <View style={s.divider} />

      {/* ── Club Invites ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={[s.dot, { backgroundColor: '#a78bfa' }]} />
          <Text style={s.sectionTitle}>Club Invites</Text>
          {pendingClubInvites.length > 0 && (
            <View style={[s.countBadge, { backgroundColor: '#a78bfa', marginLeft: 8 }]}>
              <Text style={s.countBadgeText}>{pendingClubInvites.length}</Text>
            </View>
          )}
        </View>
        {pendingClubInvites.length === 0 ? (
          <Text style={s.emptyText}>No pending club invites.</Text>
        ) : (
          pendingClubInvites.slice(0, 3).map((invite: any) => {
            const club = invite.clubs;
            if (!club) return null;
            return (
              <TouchableOpacity
                key={invite.club_id}
                style={s.row}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ClubsScreen')}
              >
                <View style={[s.clubIcon, { backgroundColor: '#a78bfa33' }]}>
                  {club.avatar_url
                    ? <Image source={{ uri: club.avatar_url }} style={s.clubIconImg} />
                    : <Text style={{ color: '#a78bfa', fontWeight: '800', fontSize: 16 }}>{club.name?.charAt(0)?.toUpperCase()}</Text>}
                </View>
                <View style={s.rowText}>
                  <Text style={s.rowName} numberOfLines={1}>{club.name}</Text>
                  <Text style={s.rowSub}>You've been invited to join</Text>
                </View>
                <View style={[s.countBadge, { backgroundColor: '#a78bfa' }]}>
                  <Text style={s.countBadgeText}>View</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={s.divider} />

      {/* ── Club Chat ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={[s.dot, { backgroundColor: '#34d399' }]} />
          <Text style={s.sectionTitle}>Club Chat</Text>
        </View>
        {myClubs.length === 0 ? (
          <Text style={s.emptyText}>Join a club to start chatting.</Text>
        ) : (
          myClubs.slice(0, 3).map((club) => (
            <TouchableOpacity
              key={club.id}
              style={s.row}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ClubChatScreen', { clubId: club.id, clubName: club.name })}
            >
              <View style={[s.clubIcon, { backgroundColor: '#34d39933' }]}>
                {club.avatar_url
                  ? <Image source={{ uri: club.avatar_url }} style={s.clubIconImg} />
                  : <Text style={{ color: '#34d399', fontWeight: '800', fontSize: 16 }}>{club.name?.charAt(0)?.toUpperCase()}</Text>}
              </View>
              <View style={s.rowText}>
                <Text style={s.rowName} numberOfLines={1}>{club.name}</Text>
                <Text style={s.rowSub}>Tap to open club chat</Text>
              </View>
              <View style={[s.countBadge, { backgroundColor: '#34d399' }]}>
                <Text style={s.countBadgeText}>Chat</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <TouchableOpacity style={s.viewAll} onPress={() => navigation.navigate('ClubsScreen')} activeOpacity={0.7}>
          <Text style={[s.viewAllText, { color: '#34d399' }]}>View all clubs &gt;</Text>
        </TouchableOpacity>
      </View>

      <View style={s.divider} />

      {/* ── Challenges ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={[s.dot, { backgroundColor: '#F25912' }]} />
          <Text style={s.sectionTitle}>Challenges</Text>
          {challengeHistory.length > 0 && (
            <View style={[s.countBadge, { backgroundColor: '#F25912', marginLeft: 8 }]}>
              <Text style={s.countBadgeText}>{challengeHistory.length}</Text>
            </View>
          )}
        </View>
        {challengeHistory.length === 0 ? (
          <Text style={s.emptyText}>No challenges yet. Challenge a friend to get started.</Text>
        ) : (
          challengeHistory.slice(0, 4).map((c) => (
            <TouchableOpacity
              key={c.id}
              style={s.row}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('UpcomingSessionsScreen')}
            >
              <TierAvatar
                uri={c.opponentAvatar}
                size={36}
                uid={c.opponentUid}
                name={c.opponentName}
                disableProfileLink
                fallback={
                  <View style={[s.iconFallback, { backgroundColor: 'rgba(242,89,18,0.12)' }]}>
                    <Swords color="#F25912" size={18} />
                  </View>
                }
              />
              <View style={s.rowText}>
                <Text style={s.rowName} numberOfLines={1}>{(profile?.fullName || 'You')} vs {c.opponentName}</Text>
                <Text style={s.rowSub} numberOfLines={1}>
                  {c.exerciseName} · {Math.max(1, Math.round(c.durationSeconds / 60))} min · {formatChallengeDate(c.createdAt)}
                </Text>
              </View>
              <View style={[s.countBadge, { backgroundColor: '#F25912' }]}>
                <Text style={s.countBadgeText}>{c.status === 'completed' ? 'Done' : 'Played'}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
        <TouchableOpacity style={s.viewAll} onPress={() => navigation.navigate('UpcomingSessionsScreen')} activeOpacity={0.7}>
          <Text style={[s.viewAllText, { color: '#F25912' }]}>View all challenges &gt;</Text>
        </TouchableOpacity>
      </View>

      <View style={s.divider} />

      {/* ── Move Reminders ── */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <View style={[s.dot, { backgroundColor: '#F25912' }]} />
          <Text style={s.sectionTitle}>Move Reminders</Text>
          {moveReminder?.enabled && alarmConfigs.length > 0 && (
            <View style={[s.countBadge, { backgroundColor: '#F25912', marginLeft: 8 }]}>
              <Text style={s.countBadgeText}>{alarmConfigs.length}</Text>
            </View>
          )}
        </View>
        {alarmConfigs.length === 0 ? (
          <Text style={s.emptyText}>No reminders set up yet.</Text>
        ) : (
          <>
            <Text style={[s.emptyText, { marginBottom: 10 }]}>
              {moveReminder?.enabled
                ? `Active · ${alarmConfigs.length} reminders scheduled`
                : `Paused · ${alarmConfigs.length} reminders`}
            </Text>
            {alarmConfigs.map((cfg, i, arr) => (
              <AlarmListRow
                key={cfg.time}
                alarm={cfg}
                isLast={i === arr.length - 1}
                compact
                onPress={() => { setSelectedAlarm(cfg); setAlarmSheetVisible(true); }}
                onToggle={(val: boolean) => {
                  const next = arr.map((c) => (c.time === cfg.time ? { ...c, enabled: val } : c));
                  saveAlarmConfigsFromPanel(next);
                }}
              />
            ))}
          </>
        )}
      </View>

      {/* Alarm detail sheet — opened from a reminder row */}
      <AlarmPillSheet
        visible={alarmSheetVisible}
        alarm={selectedAlarm}
        reminderId={moveReminder?.id ?? 'default'}
        onClose={() => setAlarmSheetVisible(false)}
        onUpdate={(updated: AlarmConfig) => {
          const next = alarmConfigs.map((c) => (c.time === selectedAlarm?.time ? updated : c));
          saveAlarmConfigsFromPanel(next);
        }}
        onDelete={() => {
          const next = alarmConfigs.filter((c) => c.time !== selectedAlarm?.time);
          saveAlarmConfigsFromPanel(next);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#F8F8FC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.06)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  // Embedded inside the Social "Notifications" tab — no outer card/margins.
  wrapEmbedded: { paddingBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { color: TEXT, fontSize: 16, fontWeight: '800' },
  section: { paddingTop: 14, paddingBottom: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  sectionTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  rowText: { flex: 1, marginLeft: 10, minWidth: 0 },
  rowName: { color: TEXT, fontSize: 14, fontWeight: '600' },
  rowSub: { color: MUTED, fontSize: 12, marginTop: 2 },
  iconFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  clubIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  clubIconImg: { width: 36, height: 36, borderRadius: 8 },
  emptyText: { color: MUTED, fontSize: 13, paddingVertical: 6 },
  viewAll: { paddingVertical: 10, alignItems: 'flex-end' },
  viewAllText: { fontSize: 13, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(33,24,50,0.08)' },
  countBadge: {
    borderRadius: 10, minWidth: 20, height: 20,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 5, marginRight: 4,
  },
  countBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },
});
