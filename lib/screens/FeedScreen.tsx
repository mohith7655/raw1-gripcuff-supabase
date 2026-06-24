import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Rss, Users, ChevronRight, MessageCircle, Flame } from 'lucide-react-native';
import Svg, { Defs, Stop, RadialGradient, Rect } from 'react-native-svg';
import { TierAvatar } from '../components/profile/TierAvatar';
import { AppTheme } from '../core/theme/app_theme';
import { SocialActivationModal } from '../components/SocialActivationModal';
import { ChatHub } from '../components/social/ChatHub';
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

// ── Gamified "Social" action cards ────────────────────────────────────────────
// Two side-by-side cards above the friends list. Animated with core Animated
// (reanimated isn't installed in this project); transforms/opacity run on the
// native driver. expo-linear-gradient paints the fills, react-native-svg the
// radial highlight behind the avatars.
const { width: SCREEN_W } = Dimensions.get('window');
const SECTION_PAD = 16;
const CARD_GAP = 12;
const CARD_W = (SCREEN_W - SECTION_PAD * 2 - CARD_GAP) / 2;
const CARD_H = 168;

// ~155° diagonal expressed as expo-linear-gradient start/end points.
const GRAD_START = { x: 0.29, y: 0.05 };
const GRAD_END = { x: 0.71, y: 0.95 };

// Looping-animation helper: returns a driver Value and wires up / tears down the
// loop produced by `builder`.
function useLoop(builder: (v: Animated.Value) => Animated.CompositeAnimation, deps: any[] = []) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = builder(v);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

// An ease-in-out value that swings 0→1→0 forever on the native driver.
const pingPong = (v: Animated.Value, dur: number) =>
  Animated.loop(
    Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]),
  );

// Soft radial highlight behind the avatar bubbles. `id` keeps the gradient def
// unique per card.
function GlowBehindAvatars({ id }: { id: string }) {
  return (
    <Svg width={CARD_W} height={120} style={styles.glow} pointerEvents="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="38%" r="55%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="0.3" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width={CARD_W} height="120" fill={`url(#${id})`} />
    </Svg>
  );
}

// A small twinkling dot.
function SparkDot({ top, left, size, delay }: { top: number; left: number; size: number; delay: number }) {
  const v = useLoop(
    (x) => Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(x, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ),
    [delay],
  );
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.9] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.25] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.spark, { top, left, width: size, height: size, borderRadius: size / 2, opacity, transform: [{ scale }] }]}
    />
  );
}

// Diagonal light bar sweeping across the card every ~3.2s.
function Shimmer() {
  const v = useLoop(
    (x) => Animated.loop(
      Animated.sequence([
        Animated.timing(x, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.delay(2100),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ),
    [],
  );
  const translateX = v.interpolate({ inputRange: [0, 1], outputRange: [-CARD_W * 0.7, CARD_W * 1.2] });
  return (
    <Animated.View pointerEvents="none" style={[styles.shimmer, { transform: [{ translateX }, { rotate: '20deg' }] }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const SPARKS = [
  { top: 16, left: 16, size: 5, delay: 0 },
  { top: 44, left: CARD_W - 26, size: 4, delay: 500 },
  { top: 70, left: 24, size: 3, delay: 1100 },
];

// Left card — "Challenge Lobby". Orange gradient, clashing avatars + pulsing VS.
function ChallengeCard({ onPress, avatarUri }: { onPress?: () => void; avatarUri?: string | null }) {
  const clash = useLoop((v) => pingPong(v, 1500), []);
  const pulse = useLoop((v) => pingPong(v, 1100), []);

  const leftClash = {
    transform: [
      { translateX: clash.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) },
      { rotate: clash.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '3deg'] }) },
    ],
  };
  const rightClash = {
    transform: [
      { translateX: clash.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) },
      { rotate: clash.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-3deg'] }) },
    ],
  };
  const badgePulse = { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] };

  return (
    <View style={[styles.cardShadow, styles.cardShadowOrange]}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <LinearGradient colors={['#F25912', '#C7400A', '#8F2D05']} start={GRAD_START} end={GRAD_END} style={StyleSheet.absoluteFill} />
        <GlowBehindAvatars id="glowOrange" />
        {SPARKS.map((s, i) => <SparkDot key={i} {...s} />)}
        <Shimmer />

        <View style={styles.avatarRow}>
          <Animated.View style={[styles.avatarBubble, leftClash]}>
            {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} /> : null}
          </Animated.View>
          <Animated.View style={[styles.badge, badgePulse]}>
            <Text style={styles.vsText}>VS</Text>
          </Animated.View>
          <Animated.View style={[styles.avatarBubble, rightClash]} />
        </View>

        <View style={styles.labelBlock}>
          <View style={styles.labelRow}>
            <Text style={styles.labelEmoji}>🔥</Text>
            <Text style={styles.cardTitle}>Challenge Lobby</Text>
          </View>
          <Text style={styles.cardSub}>Compete live with anyone</Text>
        </View>
      </Pressable>
    </View>
  );
}

// Right card — "Workout with Friend". Indigo gradient, bobbing avatars + 🤝 twinkle.
function FriendCard({ onPress, avatarUri }: { onPress?: () => void; avatarUri?: string | null }) {
  const bob = useLoop((v) => pingPong(v, 1600), []);
  const twinkle = useLoop((v) => pingPong(v, 900), []);

  const leftBob = { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] }) }] };
  const rightBob = { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [4, -4] }) }] };
  const badgeTwinkle = {
    opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
    transform: [{ scale: twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }) }],
  };

  return (
    <View style={[styles.cardShadow, styles.cardShadowIndigo]}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <LinearGradient colors={['#5A5C8E', '#3D3F66', '#2A2B47']} start={GRAD_START} end={GRAD_END} style={StyleSheet.absoluteFill} />
        <GlowBehindAvatars id="glowIndigo" />
        {SPARKS.map((s, i) => <SparkDot key={i} {...s} />)}
        <Shimmer />

        <View style={styles.avatarRow}>
          <Animated.View style={[styles.avatarBubble, leftBob]}>
            {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} /> : null}
          </Animated.View>
          <Animated.View style={[styles.badge, badgeTwinkle]}>
            <Text style={styles.handEmoji}>🤝</Text>
          </Animated.View>
          <Animated.View style={[styles.avatarBubble, rightBob]} />
        </View>

        <View style={styles.labelBlock}>
          <View style={styles.labelRow}>
            <Text style={styles.labelEmoji}>💪</Text>
            <Text style={styles.cardTitle}>Workout with Friend</Text>
          </View>
          <Text style={styles.cardSub}>Pick & schedule together</Text>
        </View>
      </Pressable>
    </View>
  );
}

type SocialTab = 'feed' | 'chat';

export function FeedScreen() {
  const navigation = useNavigation<any>();
  const tabBar = useTabBarVisibility();
  const { supabaseUserId, user } = useAuth();
  const { friends } = useFriend();
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

  // ── Social tab activation prompt ──
  // Shown on each visit UNTIL the user agrees to the rules. Once activated, the
  // agreement is persisted per-user and the prompt never shows again. Skipping
  // (without agreeing) still re-shows it on the next visit.
  const [activationVisible, setActivationVisible] = useState(false);
  const activationKey = supabaseUserId ? `social_activated_${supabaseUserId}` : null;
  const isActivated = useCallback(() => {
    if (!activationKey || typeof localStorage === 'undefined') return false;
    return !!localStorage.getItem(activationKey);
  }, [activationKey]);

  useFocusEffect(useCallback(() => {
    if (!isActivated()) setActivationVisible(true);
  }, [isActivated]));

  // Finished the flow and agreed to everything — remember it so the rules popup
  // never shows again for this user.
  const handleActivated = useCallback(() => {
    if (activationKey && typeof localStorage !== 'undefined') {
      try { localStorage.setItem(activationKey, '1'); } catch {}
    }
    setActivationVisible(false);
  }, [activationKey]);

  // Skipped / dismissed — shows again on the next visit.
  const handleActivationDismiss = useCallback(() => {
    setActivationVisible(false);
  }, []);

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
      {/* Gamified Social header — two side-by-side animated action cards */}
      <View style={styles.cardRow}>
        <ChallengeCard onPress={() => navigation.navigate('ChallengeLobbyScreen')} avatarUri={user?.profileImageUrl} />
        <FriendCard onPress={() => navigation.navigate('WorkoutWithFriendScreen')} avatarUri={user?.profileImageUrl} />
      </View>

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
        <TouchableOpacity
          onPress={() => (activeTab === 'chat' ? setActiveTab('feed') : navigation.goBack())}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
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
      <SocialActivationModal
        visible={activationVisible}
        onActivated={handleActivated}
        onDismiss={handleActivationDismiss}
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

  // ── Gamified Social action cards ──
  cardRow: {
    flexDirection: 'row',
    gap: CARD_GAP,
    marginHorizontal: SECTION_PAD,
    marginTop: 12,
  },
  cardShadow: {
    flex: 1,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    shadowOpacity: 0.35,
    elevation: 8,
  },
  cardShadowOrange: { shadowColor: '#F25912' },
  cardShadowIndigo: { shadowColor: '#4C4E78' },
  card: {
    height: CARD_H,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#2A2B47',
  },
  cardPressed: { opacity: 0.9 },

  glow: { position: 'absolute', top: 4, left: 0 },
  shimmer: { position: 'absolute', top: -24, left: 0, width: 56, height: CARD_H + 48 },
  spark: { position: 'absolute', backgroundColor: '#fff' },

  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
  },
  avatarBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: 17 },
  badge: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  vsText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    fontStyle: 'italic',
    textShadowColor: 'rgba(255,255,255,0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  handEmoji: { fontSize: 22 },
  labelBlock: { position: 'absolute', left: 12, bottom: 12, right: 12 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  labelEmoji: { fontSize: 14 },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  cardSub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '500', marginTop: 2 },

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
