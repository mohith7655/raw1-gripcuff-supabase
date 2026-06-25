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
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Rss, Users, ChevronRight, MessageCircle } from 'lucide-react-native';
import { AppTheme } from '../core/theme/app_theme';
import { SocialActivationModal } from '../components/SocialActivationModal';
import { ChatHub } from '../components/social/ChatHub';
import { SocialActivity } from '../components/social/SocialActivity';
import { supabase } from '../core/config/supabase';
import { useAuth } from '../providers/AuthContext';
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

// ── "Social" action cards ─────────────────────────────────────────────────────
// Two side-by-side static cards above the activity feed. expo-linear-gradient
// paints the fills; no motion or glow effects.
const { width: SCREEN_W } = Dimensions.get('window');
const SECTION_PAD = 16;
const CARD_GAP = 12;
const CARD_H = 168;

// ~155° diagonal expressed as expo-linear-gradient start/end points.
const GRAD_START = { x: 0.29, y: 0.05 };
const GRAD_END = { x: 0.71, y: 0.95 };

// Left card — "Challenge Lobby". Static orange gradient, avatars + VS badge.
function ChallengeCard({ onPress, avatarUri }: { onPress?: () => void; avatarUri?: string | null }) {
  return (
    <View style={[styles.cardShadow, styles.cardShadowOrange]}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <LinearGradient colors={['#F25912', '#C7400A', '#8F2D05']} start={GRAD_START} end={GRAD_END} style={StyleSheet.absoluteFill} />

        <View style={styles.avatarRow}>
          <View style={styles.avatarBubble}>
            {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} /> : null}
          </View>
          <View style={styles.badge}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <View style={styles.avatarBubble} />
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

// Right card — "Workout with Friend". Static indigo gradient, avatars + 🤝 badge.
function FriendCard({ onPress, avatarUri }: { onPress?: () => void; avatarUri?: string | null }) {
  return (
    <View style={[styles.cardShadow, styles.cardShadowIndigo]}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
        <LinearGradient colors={['#5A5C8E', '#3D3F66', '#2A2B47']} start={GRAD_START} end={GRAD_END} style={StyleSheet.absoluteFill} />

        <View style={styles.avatarRow}>
          <View style={styles.avatarBubble}>
            {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} /> : null}
          </View>
          <View style={styles.badge}>
            <Text style={styles.handEmoji}>🤝</Text>
          </View>
          <View style={styles.avatarBubble} />
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

// Smooth collapse for the top toggle on Android (no-op on web).
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SocialTab = 'feed' | 'chat';

export function FeedScreen() {
  const navigation = useNavigation<any>();
  const tabBar = useTabBarVisibility();
  const { supabaseUserId, user } = useAuth();
  const [activeTab, setActiveTab] = useState<SocialTab>('feed');

  // ── Feed/Chat toggle behaviour (mirrors the Library Exercises/Workouts effect) ──
  // The TOP toggle collapses away once you scroll down past the threshold and
  // re-appears at the top; the FLOATING toggle docks above the nav bar once
  // scrolling pauses while scrolled down (and hides while actively scrolling).
  const [floatToggleVisible, setFloatToggleVisible] = useState(false);
  const [topToggleShown, setTopToggleShown] = useState(true);
  const topShownRef = useRef(true);
  const floatScrollY = useRef(0);
  const floatPauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetToggles = useCallback(() => {
    if (floatPauseTimer.current) clearTimeout(floatPauseTimer.current);
    setFloatToggleVisible(false);
    topShownRef.current = true;
    setTopToggleShown(true);
    floatScrollY.current = 0;
  }, []);

  // Reveal the bottom bar + reset toggles when switching sub-tabs / regaining focus.
  useEffect(() => { tabBar?.show(); resetToggles(); }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { tabBar?.show(); }, [tabBar]));

  const onFloatScroll = useCallback((e: any) => {
    const y = e?.nativeEvent?.contentOffset?.y ?? 0;
    floatScrollY.current = y;

    // Collapse the top toggle once scrolled down; restore it near the top.
    const showTop = y <= 120;
    if (topShownRef.current !== showTop) {
      topShownRef.current = showTop;
      LayoutAnimation.configureNext(LayoutAnimation.create(180, 'easeInEaseOut', 'opacity'));
      setTopToggleShown(showTop);
    }

    // Floating toggle: hidden while scrolling, docks after a pause when scrolled.
    setFloatToggleVisible(false);
    if (floatPauseTimer.current) clearTimeout(floatPauseTimer.current);
    floatPauseTimer.current = setTimeout(() => {
      if (floatScrollY.current > 120) setFloatToggleVisible(true);
    }, 350);
  }, []);
  useEffect(() => () => { if (floatPauseTimer.current) clearTimeout(floatPauseTimer.current); }, []);
  const handleScroll = useCallback((e: any) => { onFloatScroll(e); tabBar?.onScroll?.(e); }, [onFloatScroll, tabBar]);
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

      {/* Unified activity feed (friend requests, challenges, workouts, messages)
          — replaces the old "Your Friends" list. Customizable via its gear. */}
      <SocialActivity />
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
        <View style={{ width: 34 }} />
        <Text style={styles.headerTitle}>Social</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Segmented control — collapses away once scrolled (floating one takes over) */}
      {topToggleShown && (
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
      )}

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
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      ) : (
        <ChatHub onScroll={handleScroll} />
      )}

      {/* Floating Feed/Chat toggle — docks centered above the nav bar once the
          user scrolls down and scrolling pauses (same effect as the Library). */}
      {floatToggleVisible && (
        <View style={styles.floatToggleWrap} pointerEvents="box-none">
          <View style={styles.floatToggle}>
            {SEGMENTS.map(({ key, label, Icon, badge }) => {
              const active = activeTab === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.floatSeg, active && styles.floatSegActive]}
                  onPress={() => setActiveTab(key)}
                  activeOpacity={0.85}
                >
                  <Icon size={14} color={active ? '#fff' : TEXT_SECONDARY} />
                  <Text style={[styles.floatSegText, active && styles.floatSegTextActive]}>{label}</Text>
                  {badge > 0 && (
                    <View style={styles.segBadge}>
                      <Text style={styles.segBadgeText}>{badge > 9 ? '9+' : badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
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

  // Floating Feed/Chat toggle (docks above the nav bar on scroll-pause)
  floatToggleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 96,
    alignItems: 'center',
    zIndex: 90,
  },
  floatToggle: {
    flexDirection: 'row',
    backgroundColor: '#EEEEF2',
    borderRadius: 100,
    padding: 2,
    borderWidth: 1,
    borderColor: '#D8D8E4',
    shadowColor: '#211832',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 6,
  },
  floatSeg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: 'transparent',
  },
  floatSegActive: { backgroundColor: '#211832' },
  floatSegText: { color: '#7A7C90', fontSize: 12, fontWeight: '600' },
  floatSegTextActive: { color: '#fff' },

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
