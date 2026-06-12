import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Rss, Users, ChevronRight, Zap, CalendarPlus, MessageCircle } from 'lucide-react-native';
import { AppTheme } from '../core/theme/app_theme';
import { ChallengeLobbyModal } from '../components/ChallengeLobbyModal';
import { FriendsHub } from '../components/social/FriendsHub';
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

type SocialTab = 'feed' | 'friends' | 'chat';

export function FeedScreen() {
  const navigation = useNavigation<any>();
  const tabBar = useTabBarVisibility();
  const { supabaseUserId, user } = useAuth();
  const { incomingRequests } = useFriend();
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
        onPress={() => setChallengeLobbyVisible(true)}
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
        onPress={() => navigation.navigate('WorkoutWithFriendFlow')}
        activeOpacity={0.85}
      >
        <View style={styles.inviteIcon}>
          <CalendarPlus color={ORANGE} size={18} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.challengeTitle}>Invite a Friend to Workout</Text>
          <Text style={styles.challengeSub}>Pick a workout & schedule it together</Text>
        </View>
        <ChevronRight color={ORANGE} size={18} />
      </TouchableOpacity>
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
    { key: 'friends', label: 'Friends', Icon: Users, badge: incomingRequests.length },
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
      ) : activeTab === 'friends' ? (
        <FriendsHub />
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
