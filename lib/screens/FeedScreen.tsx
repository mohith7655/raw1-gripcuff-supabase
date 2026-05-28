import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Rss, Users } from 'lucide-react-native';
import { AppTheme } from '../core/theme/app_theme';
import { useFeed } from '../hooks/useFeed';
import { PostCard } from '../components/feed/PostCard';
import { CreatePostModal } from '../components/feed/CreatePostModal';
import { CommentsSheet } from '../components/feed/CommentsSheet';
import { SpeedDial, SpeedDialAction } from '../components/feed/SpeedDial';
import { TweetModal } from '../components/feed/TweetModal';
import { VideoModal } from '../components/feed/VideoModal';
import { Post } from '../services/feed.service';

type Tab = 'daily' | 'clubs';

const ORANGE = '#FF6B00';
const TEXT_SECONDARY = '#94A3B8';

export function FeedScreen() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<Tab>('daily');
  const [createVisible, setCreateVisible] = useState(false);
  const [tweetVisible, setTweetVisible] = useState(false);
  const [videoVisible, setVideoVisible] = useState(false);
  const [commentPost, setCommentPost] = useState<Post | null>(null);

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

  const renderFooter = useCallback(() => {
    if (!loadingMore) return <View style={{ height: 80 }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={ORANGE} />
      </View>
    );
  }, [loadingMore]);

  const DailyFeedContent = () => {
    if (loading) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refresh} activeOpacity={0.8}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (posts.length === 0) {
      return (
        <FlatList
          data={[]}
          renderItem={null}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Rss size={36} color={ORANGE} />
              <Text style={styles.emptyTitle}>Daily Feed</Text>
              <Text style={styles.emptySub}>Your daily activity feed will appear here.</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={ORANGE} />}
        />
      );
    }

    return (
      <FlatList
        data={posts}
        keyExtractor={keyExtractor}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={ORANGE} />}
        onEndReached={hasMore ? loadMore : undefined}
        onEndReachedThreshold={0.4}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  const ClubsContent = () => null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <ArrowLeft size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feed</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'daily' ? <DailyFeedContent /> : <ClubsContent />}
      </View>

      {/* Speed Dial FAB */}
      {activeTab === 'daily' && <SpeedDial onSelect={handleSpeedDial} />}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('daily')}
          activeOpacity={0.8}
        >
          <Rss size={22} color={activeTab === 'daily' ? ORANGE : TEXT_SECONDARY} />
          <Text style={[styles.navLabel, activeTab === 'daily' && styles.navLabelActive]}>
            Daily Feed
          </Text>
          {activeTab === 'daily' && <View style={styles.navIndicator} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('ClubsScreen')}
          activeOpacity={0.8}
        >
          <Users size={22} color={TEXT_SECONDARY} />
          <Text style={styles.navLabel}>Clubs</Text>
        </TouchableOpacity>
      </View>

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
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },

  content: { flex: 1 },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 40,
    paddingTop: 80,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  emptySub: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  listContent: { paddingTop: 12, paddingBottom: 100 },

  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0d1825',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 4,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    gap: 4,
    position: 'relative',
  },
  navLabel: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  navLabelActive: { color: ORANGE },
  navIndicator: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 2,
    backgroundColor: ORANGE,
    borderRadius: 2,
  },
});
