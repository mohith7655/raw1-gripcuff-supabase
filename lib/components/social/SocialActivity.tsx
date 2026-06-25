/**
 * SocialActivity — the unified activity feed shown on the Social → Feed tab
 * (replaces the old "Your Friends" list). It merges, time-sorts, and renders
 * everything social in one place:
 *
 *   • Friend requests   (accept / decline inline)
 *   • Challenge history  (head-to-head sessions)
 *   • Workouts with friends (invites + completed co-workouts)
 *   • Messages           (recent conversations / unread)
 *
 * A gear icon opens a "Customize" sheet where the user toggles which of these
 * categories appear. The choice is persisted per-user (localStorage), so the
 * feed always reflects exactly what that athlete wants to see.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Switch,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Settings,
  UserPlus,
  Swords,
  Dumbbell,
  MessageCircle,
  Check,
  X,
  Bell,
  ChevronRight,
} from 'lucide-react-native';
import { useAuth } from '../../providers/AuthContext';
import { useFriend } from '../../providers/FriendContext';
import { useWorkoutSession } from '../../providers/WorkoutSessionContext';
import { supabase } from '../../core/config/supabase';
import { ChatService } from '../../services/chat.service';
import { ChatConversation } from '../../models/Chat';
import { ChallengeSessionService, PreviousChallenge } from '../../services/challengeSession.service';

const TEXT = '#211832';
const MUTED = '#7A7C90';
const CARD = '#F8F8FC';
const BORDER = 'rgba(33,24,50,0.06)';
const ORANGE = '#F25912';
const INDIGO = '#4C4E78';
const GREEN = '#16a34a';

// Per-category accent colors — each activity type gets its own hue so the feed
// is scannable at a glance (orange = requests, rose = challenges, green =
// workouts, blue = messages).
const C_REQUESTS = '#F25912';   // orange
const C_CHALLENGES = '#E11D48'; // rose / head-to-head
const C_WORKOUTS = '#16a34a';   // green
const C_MESSAGES = '#2563EB';   // blue

// ── Categories ────────────────────────────────────────────────────────────────
export type ActivityCategory = 'requests' | 'challenges' | 'workouts' | 'messages';

const CATEGORIES: {
  key: ActivityCategory;
  label: string;
  hint: string;
  Icon: any;
  color: string;
}[] = [
  { key: 'requests',   label: 'Friend requests', hint: 'People who want to connect', Icon: UserPlus,      color: C_REQUESTS },
  { key: 'challenges', label: 'Challenges',       hint: 'Head-to-head history',        Icon: Swords,        color: C_CHALLENGES },
  { key: 'workouts',   label: 'Workouts',         hint: 'Co-workout invites & history',Icon: Dumbbell,      color: C_WORKOUTS },
  { key: 'messages',   label: 'Messages',         hint: 'Recent conversations',        Icon: MessageCircle, color: C_MESSAGES },
];

const DEFAULT_PREFS: Record<ActivityCategory, boolean> = {
  requests: true,
  challenges: true,
  workouts: true,
  messages: true,
};

// ── Filter tabs (below the header) ──────────────────────────────────────────
// 'all' shows everything enabled in prefs; each other key narrows to a single
// category. Labels are user-facing ("Chats" ↔ messages category).
type FilterKey = 'all' | ActivityCategory;
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',        label: 'All' },
  { key: 'messages',   label: 'Chats' },
  { key: 'workouts',   label: 'Workouts' },
  { key: 'challenges', label: 'Challenges' },
  { key: 'requests',   label: 'Requests' },
];

// ── Unified item shape ──────────────────────────────────────────────────────
interface ActivityItem {
  id: string;
  category: ActivityCategory;
  uid: string | null;
  name: string;
  avatar: string | null;
  title: string;
  subtitle: string;
  timestamp: number;        // ms — for sorting
  unread?: boolean;
  // request-only
  requestId?: string;
  fromUid?: string;
}

const ICON_FOR: Record<ActivityCategory, any> = {
  requests: UserPlus,
  challenges: Swords,
  workouts: Dumbbell,
  messages: MessageCircle,
};
const COLOR_FOR: Record<ActivityCategory, string> = {
  requests: C_REQUESTS,
  challenges: C_CHALLENGES,
  workouts: C_WORKOUTS,
  messages: C_MESSAGES,
};

function timeAgo(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 0) {
    // future (e.g. an upcoming session)
    const fwd = -diff;
    const h = Math.round(fwd / 3.6e6);
    if (fwd < 3.6e6) return `in ${Math.max(1, Math.round(fwd / 6e4))}m`;
    if (h < 24) return `in ${h}h`;
    return `in ${Math.round(h / 24)}d`;
  }
  const m = Math.floor(diff / 6e4);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

// ── Per-user prefs persistence (localStorage; web-safe) ─────────────────────
function loadPrefs(uid: string | null): Record<ActivityCategory, boolean> {
  if (!uid || typeof localStorage === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(`social_activity_prefs_${uid}`);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}
function savePrefs(uid: string | null, prefs: Record<ActivityCategory, boolean>) {
  if (!uid || typeof localStorage === 'undefined') return;
  try { localStorage.setItem(`social_activity_prefs_${uid}`, JSON.stringify(prefs)); } catch {}
}

export function SocialActivity() {
  const navigation = useNavigation<any>();
  const { supabaseUserId, user } = useAuth();
  const { friends, incomingRequests, acceptRequest, declineRequest } = useFriend();
  const { completedSessions, pendingInvites, upcomingSessions } = useWorkoutSession();

  const [prefs, setPrefs] = useState<Record<ActivityCategory, boolean>>(() => DEFAULT_PREFS);
  const [customizing, setCustomizing] = useState(false);
  // Quick filter tabs below the header — narrows the list to one category.
  const [filter, setFilter] = useState<FilterKey>('all');

  const [challenges, setChallenges] = useState<PreviousChallenge[]>([]);
  const [reqProfiles, setReqProfiles] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [busyReq, setBusyReq] = useState<string | null>(null);

  // Load prefs once we know the user.
  useEffect(() => { setPrefs(loadPrefs(supabaseUserId)); }, [supabaseUserId]);

  // Challenge history.
  useEffect(() => {
    if (!supabaseUserId) { setChallenges([]); return; }
    let alive = true;
    setLoadingChallenges(true);
    ChallengeSessionService.loadPreviousForUser(supabaseUserId)
      .then((rows) => { if (alive) setChallenges(rows); })
      .catch(() => { if (alive) setChallenges([]); })
      .finally(() => { if (alive) setLoadingChallenges(false); });
    return () => { alive = false; };
  }, [supabaseUserId]);

  // Resolve sender profiles for incoming friend requests (requests carry only uids).
  useEffect(() => {
    const uids = Array.from(new Set(incomingRequests.map((r) => r.fromUid))).filter(Boolean);
    if (uids.length === 0) { setReqProfiles({}); return; }
    let alive = true;
    supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', uids)
      .then(({ data }) => {
        if (!alive) return;
        const map: Record<string, { name: string; avatar: string | null }> = {};
        (data ?? []).forEach((p: any) => {
          map[p.id] = { name: p.full_name ?? p.username ?? 'Athlete', avatar: p.avatar_url ?? null };
        });
        setReqProfiles(map);
      });
    return () => { alive = false; };
  }, [incomingRequests]);

  // Conversations — built from the messages table for the user's friends, so the
  // actual chats (last message + unread) are viewable and openable right here.
  useEffect(() => {
    const me = user?.uid;
    if (!me) { setConversations([]); return; }
    let alive = true;
    const load = () => {
      ChatService.loadConversations(me, friends.map((f) => f.uid))
        .then((c) => { if (alive) setConversations(c); })
        .catch(() => { if (alive) setConversations([]); });
    };
    load();
    return () => { alive = false; };
  }, [user?.uid, friends]);

  const togglePref = useCallback((key: ActivityCategory) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      savePrefs(supabaseUserId, next);
      return next;
    });
  }, [supabaseUserId]);

  // ── Assemble the unified, time-sorted feed ──
  const items = useMemo<ActivityItem[]>(() => {
    const out: ActivityItem[] = [];
    const me = supabaseUserId;

    // Friend requests
    if (prefs.requests) {
      incomingRequests.forEach((r) => {
        const prof = reqProfiles[r.fromUid];
        out.push({
          id: `req_${r.id}`,
          category: 'requests',
          uid: r.fromUid,
          name: prof?.name ?? 'Athlete',
          avatar: prof?.avatar ?? null,
          title: prof?.name ?? 'New friend request',
          subtitle: 'Sent you a friend request',
          timestamp: r.createdAt instanceof Date ? r.createdAt.getTime() : new Date(r.createdAt as any).getTime(),
          requestId: r.id,
          fromUid: r.fromUid,
        });
      });
    }

    // Challenges
    if (prefs.challenges) {
      challenges.forEach((c) => {
        const won = c.feedback?.winnerId && me ? c.feedback.winnerId === me : null;
        const result = c.status === 'completed'
          ? (won === true ? 'Won' : won === false ? 'Lost' : 'Played')
          : 'In progress';
        out.push({
          id: `chl_${c.id}`,
          category: 'challenges',
          uid: c.opponentUid,
          name: c.opponentName,
          avatar: c.opponentAvatar,
          title: `Challenge vs ${c.opponentName}`,
          subtitle: `${c.exerciseName} · ${result}`,
          timestamp: new Date(c.createdAt).getTime(),
        });
      });
    }

    // Workouts with friends (invites + upcoming + completed). Skip solo sessions.
    if (prefs.workouts) {
      const seen = new Set<string>();
      const pushSession = (s: typeof completedSessions[number], pending: boolean) => {
        if (s.sessionType === 'self' || seen.has(s.id)) return;
        seen.add(s.id);
        const iAmHost = s.hostUid === me;
        const name = iAmHost ? s.guestName : s.hostName;
        const avatar = (iAmHost ? s.guestAvatarUrl : s.hostAvatarUrl) ?? null;
        const uid = iAmHost ? s.guestUid : s.hostUid;
        const when = s.scheduledAt instanceof Date ? s.scheduledAt : new Date(s.scheduledAt as any);
        const sub = pending
          ? (iAmHost ? 'Invite sent' : 'Invited you')
          : `${s.videoTitle} · ${s.status}`;
        out.push({
          id: `wks_${s.id}`,
          category: 'workouts',
          uid,
          name: name || 'Friend',
          avatar,
          title: `Workout with ${name || 'Friend'}`,
          subtitle: sub,
          timestamp: when.getTime(),
          unread: pending && !iAmHost,
        });
      };
      pendingInvites.forEach((s) => pushSession(s, true));
      upcomingSessions.forEach((s) => pushSession(s, false));
      completedSessions.forEach((s) => pushSession(s, false));
    }

    // Messages
    if (prefs.messages && me) {
      conversations.forEach((c) => {
        const otherUid = c.participants.find((p) => p !== me);
        if (!otherUid) return;
        const friend = friends.find((f) => f.uid === otherUid);
        const at = c.lastMessageAt ? new Date(c.lastMessageAt as any).getTime() : 0;
        out.push({
          id: `msg_${c.id}`,
          category: 'messages',
          uid: otherUid,
          name: friend?.fullName || friend?.username || 'Athlete',
          avatar: friend?.profileImageUrl ?? null,
          title: friend?.fullName || friend?.username || 'Message',
          subtitle: c.lastMessage || 'Say hi 👋',
          timestamp: at,
          unread: (c.unreadCount?.[me] ?? 0) > 0,
        });
      });
    }

    return out.sort((a, b) => b.timestamp - a.timestamp).slice(0, 40);
  }, [prefs, incomingRequests, reqProfiles, challenges, pendingInvites, upcomingSessions, completedSessions, conversations, friends, supabaseUserId]);

  const anyCategoryOn = CATEGORIES.some((c) => prefs[c.key]);

  // Apply the active filter tab on top of the prefs-filtered feed.
  const visibleItems = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.category === filter)),
    [items, filter],
  );

  // ── Item interactions ──
  const handlePress = useCallback((item: ActivityItem) => {
    switch (item.category) {
      case 'requests':
        if (item.uid) navigation.navigate('SocialProfileScreen', { uid: item.uid });
        break;
      case 'challenges':
        if (item.uid) navigation.navigate('SocialProfileScreen', { uid: item.uid });
        break;
      case 'workouts':
        navigation.navigate('UpcomingSessionsScreen');
        break;
      case 'messages':
        navigation.navigate('ChatRoom', {
          friendUid: item.uid,
          friendName: item.name,
          friendAvatar: item.avatar,
        });
        break;
    }
  }, [navigation]);

  const handleAccept = useCallback(async (item: ActivityItem) => {
    if (!item.requestId || !item.fromUid || !supabaseUserId) return;
    setBusyReq(item.requestId);
    try { await acceptRequest(item.requestId, item.fromUid, supabaseUserId); }
    catch {}
    finally { setBusyReq(null); }
  }, [acceptRequest, supabaseUserId]);

  const handleDecline = useCallback(async (item: ActivityItem) => {
    if (!item.requestId) return;
    setBusyReq(item.requestId);
    try { await declineRequest(item.requestId); }
    catch {}
    finally { setBusyReq(null); }
  }, [declineRequest]);

  // ── Render ──
  return (
    <View style={s.wrap}>
      <View style={s.headRow}>
        <Text style={s.headTitle}>Activity</Text>
        <TouchableOpacity
          style={s.gearBtn}
          onPress={() => setCustomizing(true)}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <Settings size={18} color={MUTED} />
        </TouchableOpacity>
      </View>

      {/* Filter tabs — narrow the feed to one category */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabs}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.tab, active && s.tabActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.8}
            >
              <Text style={[s.tabText, active && s.tabTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!anyCategoryOn ? (
        <TouchableOpacity style={s.emptyCard} onPress={() => setCustomizing(true)} activeOpacity={0.85}>
          <Settings size={24} color={MUTED} />
          <Text style={s.emptyTitle}>All categories hidden</Text>
          <Text style={s.emptySub}>Tap to choose what shows in your activity.</Text>
        </TouchableOpacity>
      ) : visibleItems.length === 0 ? (
        <View style={s.emptyCard}>
          {loadingChallenges ? (
            <ActivityIndicator color={ORANGE} />
          ) : (
            <>
              <Bell size={24} color={MUTED} />
              <Text style={s.emptyTitle}>
                {filter === 'all' ? 'Nothing here yet' : 'Nothing in this filter'}
              </Text>
              <Text style={s.emptySub}>
                {filter === 'all'
                  ? 'Challenges, invites and requests will show up here.'
                  : 'Try the “All” tab to see your other activity.'}
              </Text>
            </>
          )}
        </View>
      ) : (
        <View style={s.list}>
          {visibleItems.map((item) => {
            const Tag = ICON_FOR[item.category];
            const tagColor = COLOR_FOR[item.category];
            const isRequest = item.category === 'requests';
            const busy = busyReq === item.requestId;
            return (
              <TouchableOpacity
                key={item.id}
                style={s.row}
                activeOpacity={0.85}
                onPress={() => handlePress(item)}
              >
                <View style={s.avatarWrap}>
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={s.avatar} />
                  ) : (
                    <View style={[s.avatar, s.avatarFallback]}>
                      <Text style={s.avatarLetter}>{item.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={[s.tag, { backgroundColor: tagColor }]}>
                    <Tag size={10} color="#fff" />
                  </View>
                </View>

                <View style={s.info}>
                  <View style={s.topLine}>
                    <Text style={s.name} numberOfLines={1}>{item.title}</Text>
                    {!!item.timestamp && <Text style={s.time}>{timeAgo(item.timestamp)}</Text>}
                  </View>
                  <Text style={[s.sub, item.unread && s.subUnread]} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                </View>

                {isRequest ? (
                  <View style={s.reqActions}>
                    {busy ? (
                      <ActivityIndicator color={ORANGE} size="small" />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[s.reqBtn, s.declineBtn]}
                          onPress={() => handleDecline(item)}
                          hitSlop={6}
                          activeOpacity={0.8}
                        >
                          <X size={16} color={MUTED} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.reqBtn, s.acceptBtn]}
                          onPress={() => handleAccept(item)}
                          hitSlop={6}
                          activeOpacity={0.8}
                        >
                          <Check size={16} color="#fff" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : (
                  <ChevronRight size={18} color={MUTED} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Customize sheet */}
      <Modal
        visible={customizing}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomizing(false)}
      >
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setCustomizing(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Customize activity</Text>
            <Text style={s.sheetSub}>Choose what shows in your feed.</Text>

            {CATEGORIES.map((c) => (
              <View key={c.key} style={s.prefRow}>
                <View style={[s.prefIcon, { backgroundColor: `${c.color}1A` }]}>
                  <c.Icon size={18} color={c.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.prefLabel}>{c.label}</Text>
                  <Text style={s.prefHint}>{c.hint}</Text>
                </View>
                <Switch
                  value={prefs[c.key]}
                  onValueChange={() => togglePref(c.key)}
                  trackColor={{ false: '#D8D8E4', true: ORANGE }}
                  thumbColor="#fff"
                />
              </View>
            ))}

            <TouchableOpacity style={s.doneBtn} onPress={() => setCustomizing(false)} activeOpacity={0.85}>
              <Text style={s.doneText}>Done</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 18 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  headTitle: { color: TEXT, fontSize: 16, fontWeight: '800' },
  gearBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },

  // Filter tabs
  tabsScroll: { marginBottom: 12, flexGrow: 0 },
  tabs: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  tab: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 100,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  tabActive: { backgroundColor: TEXT, borderColor: TEXT },
  tabText: { color: MUTED, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#fff' },

  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  avatarWrap: { width: 44, height: 44 },
  avatar: { width: 44, height: 44, borderRadius: 12 },
  avatarFallback: { backgroundColor: '#E2E2EC', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: INDIGO, fontSize: 18, fontWeight: '800' },
  tag: {
    position: 'absolute',
    right: -3, bottom: -3,
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: CARD,
  },

  info: { flex: 1, minWidth: 0 },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { color: TEXT, fontSize: 14, fontWeight: '700', flex: 1 },
  time: { color: MUTED, fontSize: 11, fontWeight: '500' },
  sub: { color: MUTED, fontSize: 12, marginTop: 2 },
  subUnread: { color: TEXT, fontWeight: '600' },

  reqActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  acceptBtn: { backgroundColor: GREEN },
  declineBtn: { backgroundColor: '#EEEEF2', borderWidth: 1, borderColor: BORDER },

  emptyCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 26,
    paddingHorizontal: 24,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyTitle: { color: TEXT, fontSize: 15, fontWeight: '800' },
  emptySub: { color: MUTED, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },

  // Customize sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D8D8E4', marginBottom: 14 },
  sheetTitle: { color: TEXT, fontSize: 18, fontWeight: '800' },
  sheetSub: { color: MUTED, fontSize: 13, marginTop: 2, marginBottom: 12 },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  prefIcon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  prefLabel: { color: TEXT, fontSize: 14, fontWeight: '700' },
  prefHint: { color: MUTED, fontSize: 12, marginTop: 1 },
  doneBtn: {
    marginTop: 18,
    backgroundColor: ORANGE,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  doneText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
