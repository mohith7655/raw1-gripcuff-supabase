import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Rss, Users, ChevronRight, Zap, CalendarPlus, MessageCircle, Flame, UserPlus, Clock } from 'lucide-react-native';
import { TierAvatar } from '../components/profile/TierAvatar';
import { SocialProfileService } from '../services/socialProfile.service';
import { AppTheme } from '../core/theme/app_theme';
import { ChallengeLobbyModal } from '../components/ChallengeLobbyModal';
import { SocialIntroModal } from '../components/SocialIntroModal';
import { FeatureInfoModal } from '../components/FeatureInfoModal';
import { ChatHub } from '../components/social/ChatHub';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';
import { useFriend } from '../providers/FriendContext';
import { useTabBarVisibility } from '../providers/TabBarVisibilityContext';
import { ChatService } from '../services/chat.service';
import { ChatConversation } from '../models/Chat';
import { useFeed } from '../hooks/useFeed';
import { PostCard } from '../components/feed/PostCard';
import { CreatePostModal } from '../components/feed/CreatePostModal';
import { CommentsSheet } from '../components/feed/CommentsSheet';
import { SpeedDial, SpeedDialAction } from '../components/feed/SpeedDial';
import { TweetModal } from '../components/feed/TweetModal';
import { VideoModal } from '../components/feed/VideoModal';
import { Post } from '../services/feed.service';
import type { Club } from './ClubsScreen';

const ORANGE = '#4C4E78';
const TEXT_SECONDARY = '#7A7C90';

// Social intro explainer persistence keys
const SOCIAL_INTRO_SKIP = 'social_intro_skip_forever';
const SOCIAL_INTRO_REMIND = 'social_intro_remind_at';

type SocialTab = 'feed' | 'chat';

export function FeedScreen() {
  const navigation = useNavigation<any>();
  const tabBar = useTabBarVisibility();
  const { supabaseUserId, user } = useAuth();
  const { friends, incomingRequests, outgoingRequests, sendRequest } = useFriend();
  const [activeTab, setActiveTab] = useState<SocialTab>('feed');

  // Reveal the bottom bar when switching social sub-tabs (friends/chat don't drive
  // scroll) and whenever the tab regains focus (e.g. returning from a pushed screen).
  useEffect(() => { tabBar?.show(); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { tabBar?.show(); }, [tabBar]));
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [createVisible, setCreateVisible] = useState(false);
  const [tweetVisible, setTweetVisible] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [challengeLobbyVisible, setChallengeLobbyVisible] = useState(false);
  // Which feature explainer popup is open (shown when its card is tapped).
  const [featureInfo, setFeatureInfo] = useState<'challenge' | 'workout' | null>(null);

  // ── Social intro explainer (Challenge Lobby + Workout with a Friend) ──
  // Shown every time the screen is focused, unless the user chose "Never show
  // again" (permanent) or is still inside a "remind in 7 days" window.
  const [introVisible, setIntroVisible] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        if (await AsyncStorage.getItem(SOCIAL_INTRO_SKIP) === '1') return;
        const remindAt = await AsyncStorage.getItem(SOCIAL_INTRO_REMIND);
        if (remindAt && Date.now() < Number(remindAt)) return;
        setIntroVisible(true);
      } catch { /* ignore storage errors */ }
    })();
  }, []));

  // "Skip for now" — just close; it shows again on the next visit.
  const handleIntroSkipOnce = useCallback(() => {
    setIntroVisible(false);
  }, []);

  // "Never show again" — permanent.
  const handleIntroSkipForever = useCallback(async () => {
    setIntroVisible(false);
    try { await AsyncStorage.setItem(SOCIAL_INTRO_SKIP, '1'); } catch {}
  }, []);

  // "Remind me in 7 days" — suppress for a week.
  const handleIntroRemindLater = useCallback(async () => {
    setIntroVisible(false);
    const remindAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    try { await AsyncStorage.setItem(SOCIAL_INTRO_REMIND, String(remindAt)); } catch {}
  }, []);

  // ── People You May Know (friend suggestions) ──
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [sentUids, setSentUids] = useState<Set<string>>(new Set());
  const [addBusyUid, setAddBusyUid] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseUserId) return;
    const exclude = [
      ...friends.map(f => f.uid),
      ...incomingRequests.map(r => r.fromUid),
      ...outgoingRequests.map(r => r.toUid),
    ];
    SocialProfileService.getSuggestions(supabaseUserId, exclude, 12)
      .then(rows => setSuggestions(rows))
      .catch(() => {});
  }, [supabaseUserId, friends, incomingRequests, outgoingRequests]);

  const handleAddSuggestion = useCallback(async (uid: string) => {
    setAddBusyUid(uid);
    try {
      await sendRequest(uid);
      setSentUids(p => new Set(p).add(uid));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not send request.');
    } finally {
      setAddBusyUid(null);
    }
  }, [sendRequest]);

  // Unread chat total — powers the Chat segment badge.
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = ChatService.subscribeToConversations(user.uid, (convos: ChatConversation[]) => {
      setUnreadTotal(convos.reduce((sum, c) => sum + (c.unreadCount?.[user.uid] ?? 0), 0));
    });
    return unsub;
  }, [user?.uid]);

  const handleSpeedDial = useCallback((action: SpeedDialAction) => {
    if (action === 'post')  setCreateVisible(true);
    if (action === 'tweet') setTweetVisible(true);
    if (action === 'video') setVideoVisible(true);
  }, []);

  const {
    posts,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    error,
    refresh,
    loadMore,
    toggleLike,
    prependPost,
    incrementComments,
    decrementComments,
    deletePost,
    updatePostInFeed,
  } = useFeed();

  const fetchMyClubs = useCallback(async () => {
    if (!supabaseUserId) return;
    try {
      const { data: memberRows } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', supabaseUserId);
      const ids = (memberRows ?? []).map((r: any) => r.club_id);
      if (ids.length === 0) { setMyClubs([]); return; }
      const { data } = await supabase
        .from('clubs')
        .select('*')
        .in('id', ids)
        .order('member_count', { ascending: false });
      setMyClubs((data ?? []) as Club[]);
    } catch { /* silent */ }
  }, [supabaseUserId]);

  useEffect(() => { fetchMyClubs(); }, [fetchMyClubs]);

  const handlePostCreated = useCallback((post: Post) => {
    prependPost(post);
  }, [prependPost]);

  const handleOpenComments = useCallback((post: Post) => {
    setCommentPost(post);
  }, []);

  const handleCloseComments = useCallback(() => {
    setCommentPost(null);
  }, []);

  const handleCommentAdded = useCallback((postId: string) => {
    incrementComments(postId);
  }, [incrementComments]);

  const handleCommentDeleted = useCallback((postId: string) => {
    decrementComments(postId);
  }, [decrementComments]);

  const handleRefresh = useCallback(() => {
    refresh();
    fetchMyClubs();
  }, [refresh, fetchMyClubs]);

  const renderPost = useCallback(({ item }: { item: Post }) => (
    <PostCard
      post={item}
      onLike={toggleLike}
      onComment={handleOpenComments}
      onDelete={deletePost}
      onUpdate={updatePostInFeed}
    />
  ), [toggleLike, handleOpenComments, deletePost, updatePostInFeed]);

  const keyExtractor = useCallback((item: Post) => item.id, []);

  // ── Challenge Lobby entry + Daily Feed section header ──
  const ListHeader = (
    <View>
      <TouchableOpacity
        style={styles.challengeCard}
        onPress={() => setFeatureInfo('challenge')}
        activeOpacity={0.85}
      >
        <View style={styles.challengeIcon}>
          <Zap color={ORANGE} size={18} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.challengeTitle}>Enter Challenge Lobby</Text>
          <Text style={styles.challengeSub}>Compete live with anyone in the lobby</Text>
        </View>
        <ChevronRight color={ORANGE} size={18} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.inviteCard}
        onPress={() => setFeatureInfo('workout')}
        activeOpacity={0.85}
      >
        <View style={styles.inviteIcon}>
          <CalendarPlus color={ORANGE} size={18} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.challengeTitle}>Workout with Friend</Text>
          <Text style={styles.challengeSub}>Pick a workout & schedule it together</Text>
        </View>
        <ChevronRight color={ORANGE} size={18} />
      </TouchableOpacity>

      {/* Your Friends — full list, shown right after the action cards */}
      <View style={styles.friendsSection}>
        <Text style={styles.friendsSectionTitle}>
          Your Friends
          {friends.length > 0 ? <Text style={styles.friendsCount}>  ·  {friends.length}</Text> : null}
        </Text>
        {friends.length === 0 ? (
          <View style={styles.friendsEmpty}>
            <Text style={styles.friendsEmptyText}>No friends yet — add some to work out together.</Text>
          </View>
        ) : (
          friends.map(f => (
            <View key={f.uid} style={styles.friendRow}>
              <TouchableOpacity
                style={styles.friendRowLeft}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('SocialProfileScreen', { uid: f.uid })}
              >
                <TierAvatar uri={f.profileImageUrl} size={44} uid={f.uid} name={f.fullName} radius={11} disableProfileLink />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.friendName} numberOfLines={1}>@{f.username}</Text>
                  <View style={styles.friendMetaRow}>
                    <Text style={styles.friendSub} numberOfLines={1}>{f.fullName || f.username}</Text>
                    {(f.currentStreak ?? 0) > 0 && (
                      <View style={styles.friendStreak}>
                        <Flame size={11} color={ORANGE} />
                        <Text style={styles.friendStreakText}>{f.currentStreak}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.friendMsgBtn}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('ChatRoom', {
                  friendUid: f.uid,
                  friendName: f.fullName || f.username,
                  friendAvatar: f.profileImageUrl,
                })}
              >
                <MessageCircle size={18} color={ORANGE} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* People You May Know — suggestions */}
      {suggestions.length > 0 && (
        <View style={styles.suggSection}>
          <Text style={styles.friendsSectionTitle}>People You May Know</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggScroll}>
            {suggestions.map(sug => {
              const sent = sentUids.has(sug.uid);
              const busy = addBusyUid === sug.uid;
              return (
                <View key={sug.uid} style={styles.suggCard}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('SocialProfileScreen', { uid: sug.uid })}
                    style={{ alignItems: 'center' }}
                  >
                    <TierAvatar uri={sug.avatarUrl} size={60} uid={sug.uid} name={sug.fullName} radius={16} disableProfileLink />
                    <Text style={styles.suggName} numberOfLines={1}>@{sug.username}</Text>
                    <Text style={styles.suggSub} numberOfLines={1}>{sug.fullName}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.suggBtn, sent && styles.suggBtnSent]}
                    onPress={() => !sent && handleAddSuggestion(sug.uid)}
                    disabled={sent || busy}
                    activeOpacity={0.85}
                  >
                    {busy ? <ActivityIndicator color="#fff" size="small" />
                      : sent ? <><Clock size={12} color={ORANGE} /><Text style={[styles.suggBtnText, { color: ORANGE }]}>Sent</Text></>
                      : <><UserPlus size={13} color="#fff" /><Text style={styles.suggBtnText}>Add</Text></>}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );

  // ── Empty / loading / error state for the feed ──
  const ListEmpty = () => {
    if (loading) {
      return (
        <View style={styles.feedStatus}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.feedStatus}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Rss size={32} color={ORANGE} />
        <Text style={styles.emptyTitle}>No posts yet</Text>
        <Text style={styles.emptySub}>Your daily activity feed will appear here.</Text>
      </View>
    );
  };

  // ── Clubs section (stacked below the feed) ──
  const ClubsSection = () => (
    <View style={styles.clubsSection}>
      <View style={styles.sectionHeadRow}>
        <View style={styles.sectionHead}>
          <Users size={18} color={ORANGE} />
          <Text style={styles.sectionTitle}>Clubs</Text>
        </View>
        <TouchableOpacity
          style={styles.seeAllBtn}
          onPress={() => navigation.navigate('ClubsScreen')}
          activeOpacity={0.7}
        >
          <Text style={styles.seeAll}>See all</Text>
          <ChevronRight size={16} color={ORANGE} />
        </TouchableOpacity>
      </View>

      {myClubs.length === 0 ? (
        <TouchableOpacity
          style={styles.clubsEmptyCard}
          onPress={() => navigation.navigate('ClubsScreen')}
          activeOpacity={0.85}
        >
          <Users size={26} color={ORANGE} />
          <Text style={styles.emptyTitle}>Join a Club</Text>
          <Text style={styles.emptySub}>Find communities and train together.</Text>
        </TouchableOpacity>
      ) : (
        myClubs.map(club => (
          <TouchableOpacity
            key={club.id}
            style={styles.clubCard}
            onPress={() => navigation.navigate('ClubDetailScreen', { club })}
            activeOpacity={0.85}
          >
            {club.avatar_url ? (
              <Image source={{ uri: club.avatar_url }} style={styles.clubAvatar} />
            ) : (
              <View style={[styles.clubAvatar, styles.clubAvatarFallback]}>
                <Text style={styles.clubAvatarLetter}>{club.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.clubName} numberOfLines={1}>{club.name}</Text>
              <Text style={styles.clubMeta} numberOfLines={1}>
                {club.category} · {club.member_count} member{club.member_count !== 1 ? 's' : ''}
              </Text>
            </View>
            <ChevronRight size={18} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  const ListFooter = (
    <>
      {loadingMore && (
        <View style={styles.footerLoader}>
          <ActivityIndicator color={ORANGE} />
        </View>
      )}
    </>
  );

  const SEGMENTS: { key: SocialTab; label: string; Icon: any; badge: number }[] = [
    { key: 'feed', label: 'Feed', Icon: Rss, badge: 0 },
    { key: 'chat', label: 'Chat', Icon: MessageCircle, badge: unreadTotal },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#211832" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Social</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Segmented control: Feed · Friends · Chat */}
      <View style={styles.segmentRow}>
        {SEGMENTS.map(({ key, label, Icon, badge }) => {
          const active = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setActiveTab(key)}
              activeOpacity={0.85}
            >
              <Icon size={15} color={active ? '#fff' : TEXT_SECONDARY} />
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
              {badge > 0 && (
                <View style={styles.segBadge}>
                  <Text style={styles.segBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Active view ── */}
      {activeTab === 'feed' ? (
        <FlatList
          data={[] as Post[]}
          keyExtractor={keyExtractor}
          renderItem={renderPost}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={ORANGE} />}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={tabBar?.onScroll}
          scrollEventThrottle={16}
        />
      ) : (
        <ChatHub />
      )}

      {/* Modals */}
      <CreatePostModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onPostCreated={handlePostCreated}
      />
      <TweetModal
        visible={tweetVisible}
        onClose={() => setTweetVisible(false)}
        onTweetCreated={handlePostCreated}
      />
      <VideoModal
        visible={videoVisible}
        onClose={() => setVideoVisible(false)}
      />
      <CommentsSheet
        post={commentPost}
        visible={commentPost !== null}
        onClose={handleCloseComments}
        onCommentAdded={handleCommentAdded}
        onCommentDeleted={handleCommentDeleted}
      />
      <ChallengeLobbyModal
        visible={challengeLobbyVisible}
        exerciseName="Squats"
        workoutDurationSecs={60}
        onClose={() => setChallengeLobbyVisible(false)}
        onChallengeStarted={(params) => {
          setChallengeLobbyVisible(false);
          navigation.navigate('ChallengeVideoRoom', params);
        }}
      />

      <SocialIntroModal
        visible={introVisible}
        onSkipOnce={handleIntroSkipOnce}
        onRemindLater={handleIntroRemindLater}
        onSkipForever={handleIntroSkipForever}
      />

      {/* Per-feature explainers — shown when a card is tapped */}
      <FeatureInfoModal
        visible={featureInfo === 'challenge'}
        Icon={Zap}
        title="Challenge Lobby"
        body="Go head-to-head with anyone in the lobby, live."
        bullets={[
          'Get matched instantly with someone ready to train',
          'You both do the same workout at the same time',
          'Reps and time go head-to-head — winner takes the bragging rights',
        ]}
        ctaLabel="Enter Lobby"
        onClose={() => setFeatureInfo(null)}
        onContinue={() => { setFeatureInfo(null); setChallengeLobbyVisible(true); }}
      />

      <FeatureInfoModal
        visible={featureInfo === 'workout'}
        Icon={CalendarPlus}
        title="Workout with Friends"
        body="Pick a workout and schedule it together."
        bullets={[
          'Choose a friend and a workout to do together',
          'Set a time — you both get a reminder',
          'Train side-by-side over video and stay accountable',
        ]}
        ctaLabel="Get Started"
        onClose={() => setFeatureInfo(null)}
        onContinue={() => { setFeatureInfo(null); navigation.navigate('WorkoutWithFriendFlow'); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: AppTheme.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(33,24,50,0.07)',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#211832', fontSize: 18, fontWeight: '800' },

  // Segmented control — matches the Library Exercises/Workouts capsule toggle
  segmentRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: '#EEEEF2',
    borderRadius: 100,
    padding: 2,
    borderWidth: 1,
    borderColor: '#D8D8E4',
    marginTop: 12,
    marginBottom: 8,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  segmentActive: {
    backgroundColor: '#211832',
  },
  segmentText: { color: '#7A7C90', fontSize: 12, fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
  segBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  listContent: { paddingTop: 8, paddingBottom: 120 },

  // Section headers
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: '#211832', fontSize: 18, fontWeight: '800' },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 4 },
  seeAll: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },

  dailyHead: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },

  // Challenge Lobby entry card (moved here from Home)
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8F8FC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.1)',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  challengeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(76,78,120,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76,78,120,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  challengeTitle: { color: '#211832', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  challengeSub: { color: '#7A7C90', fontSize: 12, fontWeight: '500' },

  // Invite a Friend to Workout entry card
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8F8FC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.1)',
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  inviteIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(76,78,120,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(76,78,120,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Your Friends list (shown on the Feed after the action cards)
  friendsSection: { marginHorizontal: 16, marginTop: 18, gap: 10 },
  friendsSectionTitle: { color: '#211832', fontSize: 16, fontWeight: '800' },
  friendsCount: { color: '#7A7C90', fontSize: 14, fontWeight: '700' },
  friendsEmpty: { paddingVertical: 16, alignItems: 'center' },
  friendsEmptyText: { color: '#7A7C90', fontSize: 13 },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8FC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.06)',
  },
  friendRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  friendName: { color: '#211832', fontSize: 14, fontWeight: '700' },
  friendMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  friendSub: { color: '#7A7C90', fontSize: 12 },
  friendStreak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  friendStreakText: { color: ORANGE, fontSize: 11, fontWeight: '700' },
  friendMsgBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(76,78,120,0.1)',
    borderWidth: 1, borderColor: 'rgba(76,78,120,0.2)',
  },

  // People You May Know
  suggSection: { marginHorizontal: 16, marginTop: 18, gap: 10 },
  suggScroll: { gap: 12, paddingVertical: 2, paddingRight: 16 },
  suggCard: {
    width: 130, alignItems: 'center', gap: 4,
    backgroundColor: '#F8F8FC', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: 'rgba(33,24,50,0.06)',
  },
  suggName: { color: '#211832', fontSize: 13, fontWeight: '700', marginTop: 8, maxWidth: 110, textAlign: 'center' },
  suggSub: { color: '#7A7C90', fontSize: 11, maxWidth: 110, textAlign: 'center' },
  suggBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: '#211832', borderRadius: 18, paddingVertical: 7, paddingHorizontal: 16,
    marginTop: 8, alignSelf: 'stretch',
  },
  suggBtnSent: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(33,24,50,0.2)' },
  suggBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  feedStatus: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyState: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 40,
    paddingVertical: 32,
  },
  emptyTitle: { color: '#211832', fontSize: 16, fontWeight: '800' },
  emptySub: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },

  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  footerLoader: { paddingVertical: 20, alignItems: 'center' },

  // Clubs section
  clubsSection: {
    marginTop: 12,
    paddingTop: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(33,24,50,0.07)',
    gap: 10,
  },
  clubsEmptyCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
    backgroundColor: '#F8F8FC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.05)',
  },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8F8FC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.05)',
  },
  clubAvatar: { width: 48, height: 48, borderRadius: 11 },
  clubAvatarFallback: { backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  clubAvatarLetter: { color: '#211832', fontSize: 18, fontWeight: '800' },
  clubName: { color: '#211832', fontSize: 14, fontWeight: '700' },
  clubMeta: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
});
