import { useState, useCallback, useRef, useEffect } from 'react';
import { FeedService, Post } from '../services/feed.service';

export function useFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof FeedService.subscribeToFeed> | null>(null);

  const load = useCallback(async (page: number, isRefresh = false) => {
    try {
      const fetched = await FeedService.fetchFeedPosts(page);
      if (fetched.length < 10) setHasMore(false);
      else setHasMore(true);

      setPosts(prev => (page === 0 ? fetched : [...prev, ...fetched]));
      pageRef.current = page;
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load feed');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(0);

    channelRef.current = FeedService.subscribeToFeed((newPost) => {
      setPosts(prev => {
        if (prev.find(p => p.id === newPost.id)) return prev;
        return [newPost, ...prev];
      });
    });

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    load(0, true);
  }, [load]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    load(pageRef.current + 1);
  }, [loadingMore, hasMore, load]);

  const toggleLike = useCallback((postId: string) => {
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const liked = !p.user_has_liked;
        return {
          ...p,
          user_has_liked: liked,
          likes_count: liked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1),
        };
      })
    );

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    if (post.user_has_liked) {
      FeedService.unlikePost(postId).catch(() => {
        setPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? { ...p, user_has_liked: true, likes_count: p.likes_count + 1 }
              : p
          )
        );
      });
    } else {
      FeedService.likePost(postId).catch(() => {
        setPosts(prev =>
          prev.map(p =>
            p.id === postId
              ? { ...p, user_has_liked: false, likes_count: Math.max(0, p.likes_count - 1) }
              : p
          )
        );
      });
    }
  }, [posts]);

  const prependPost = useCallback((post: Post) => {
    setPosts(prev => [post, ...prev]);
  }, []);

  const deletePostFromFeed = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    // Capture snapshot for rollback, then remove optimistically
    let snapshot: Post | undefined;
    setPosts(prev => {
      snapshot = prev.find(p => p.id === postId);
      return prev.filter(p => p.id !== postId);
    });
    try {
      await FeedService.deletePost(postId);
    } catch {
      // Restore the post if the API call fails
      if (snapshot) {
        setPosts(prev => {
          // Insert back at the position it was (front if unknown)
          if (prev.find(p => p.id === snapshot!.id)) return prev;
          return [snapshot!, ...prev];
        });
      }
    }
  }, []);

  const updatePostInFeed = useCallback((updatedPost: Post) => {
    setPosts(prev => prev.map(p => p.id === updatedPost.id ? updatedPost : p));
  }, []);

  const incrementComments = useCallback((postId: string) => {
    setPosts(prev =>
      prev.map(p =>
        p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p
      )
    );
  }, []);

  const decrementComments = useCallback((postId: string) => {
    setPosts(prev =>
      prev.map(p =>
        p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p
      )
    );
  }, []);

  return {
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
    deletePostFromFeed,
    deletePost,
    updatePostInFeed,
  };
}
