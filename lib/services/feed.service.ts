import { supabase } from '../core/config/supabase';

async function getAuthenticatedClient() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (!refreshed.session) throw new Error('Not authenticated');
  }
  return supabase;
}


export interface PostMedia {
  id: string;
  post_id: string;
  media_type: 'image' | 'video';
  storage_path: string;
  media_url: string;
  display_order: number;
}

export interface Post {
  id: string;
  user_id: string;
  caption: string | null;
  link_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  profiles: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  post_media: PostMedia[];
  user_has_liked?: boolean;
  post_type?: 'post' | 'tweet' | string;
  updated_at?: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface CreatePostParams {
  caption: string;
  mediaFiles: Array<{ uri: string; type: 'image' | 'video'; mimeType: string; name: string }>;
  linkUrl: string;
  onProgress?: (progress: number) => void;
}

const PAGE_SIZE = 10;

export class FeedService {
  static async fetchFeedPosts(page: number): Promise<Post[]> {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    const { data, error } = await supabase
      .from('posts')
      .select(`
        id, user_id, caption, link_url, post_type, likes_count, comments_count, created_at,
        profiles:user_id (id, full_name, avatar_url),
        post_media (id, post_id, media_type, storage_path, media_url, display_order)
      `)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (!data) return [];

    if (!userId) return data as unknown as Post[];

    const postIds = data.map((p: any) => p.id);
    const { data: likes } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', userId)
      .in('post_id', postIds);

    const likedSet = new Set((likes || []).map((l: any) => l.post_id));
    return (data as unknown as Post[]).map(p => ({
      ...p,
      user_has_liked: likedSet.has(p.id),
    }));
  }

  static async createPost({ caption, mediaFiles, linkUrl, onProgress }: CreatePostParams): Promise<Post> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: post, error: postError } = await supabase
      .from('posts')
      .insert({ user_id: user.id, caption: caption || null, link_url: linkUrl || null })
      .select()
      .single();

    if (postError || !post) throw postError ?? new Error('Failed to create post');

    const total = mediaFiles.length;
    let uploaded = 0;

    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i];
      const uri = file.uri;
      const ext = file.name.split('.').pop() ?? (file.type === 'image' ? 'jpg' : 'mp4');
      const storagePath = `${user.id}/${post.id}/${i}_${Date.now()}.${ext}`;
      const bucket = file.type === 'image' ? 'post-images' : 'post-videos';

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, blob, { contentType: file.mimeType, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);

      const { error: mediaError } = await supabase
        .from('post_media')
        .insert({
          post_id: post.id,
          media_type: file.type,
          storage_path: storagePath,
          media_url: urlData.publicUrl,
          display_order: i,
        });

      if (mediaError) throw mediaError;

      uploaded++;
      onProgress?.(uploaded / total);
    }

    const { data: fullPost, error: fetchError } = await supabase
      .from('posts')
      .select(`
        id, user_id, caption, link_url, post_type, likes_count, comments_count, created_at,
        profiles:user_id (id, full_name, avatar_url),
        post_media (id, post_id, media_type, storage_path, media_url, display_order)
      `)
      .eq('id', post.id)
      .single();

    if (fetchError || !fullPost) throw fetchError ?? new Error('Failed to fetch created post');
    return { ...(fullPost as unknown as Post), user_has_liked: false };
  }

  static async likePost(postId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
    await supabase.rpc('increment_post_likes', { post_id: postId });
  }

  static async unlikePost(postId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id);

    await supabase.rpc('decrement_post_likes', { post_id: postId });
  }

  static async fetchComments(postId: string): Promise<Comment[]> {
    const { data, error } = await supabase
      .from('post_comments')
      .select(`
        id, post_id, user_id, content, created_at,
        profiles:user_id (full_name, avatar_url)
      `)
      .eq('post_id', postId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as Comment[];
  }

  static async addComment(postId: string, content: string): Promise<Comment> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, user_id: user.id, content })
      .select(`
        id, post_id, user_id, content, created_at,
        profiles:user_id (full_name, avatar_url)
      `)
      .single();

    if (error || !data) throw error ?? new Error('Failed to add comment');

    await supabase.rpc('increment_post_comments', { post_id: postId });
    return data as unknown as Comment;
  }

  static async deletePost(postId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data } = await supabase.auth.refreshSession();
      if (!data.session) throw new Error('Not authenticated');
    }

    // Fetch media rows before deleting so we can clean up storage
    const { data: mediaRows } = await supabase
      .from('post_media')
      .select('storage_path, media_type')
      .eq('post_id', postId);

    if (mediaRows && mediaRows.length > 0) {
      const imagePaths = mediaRows
        .filter(m => m.media_type === 'image')
        .map(m => m.storage_path);
      const videoPaths = mediaRows
        .filter(m => m.media_type === 'video')
        .map(m => m.storage_path);
      if (imagePaths.length > 0) await supabase.storage.from('post-images').remove(imagePaths);
      if (videoPaths.length > 0) await supabase.storage.from('post-videos').remove(videoPaths);
    }

    // Hard delete — cascades to post_media, post_likes, post_comments via FK
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId);
    if (error) throw error;
  }

  static async updatePostCaption(postId: string, caption: string, linkUrl?: string): Promise<Post> {
    const client = await getAuthenticatedClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const updates: Record<string, any> = {
      caption,
      updated_at: new Date().toISOString(),
    };
    if (linkUrl !== undefined) updates.link_url = linkUrl || null;

    const { error } = await client
      .from('posts')
      .update(updates)
      .eq('id', postId)
      .eq('user_id', user.id);
    if (error) throw error;

    const { data, error: fetchErr } = await supabase
      .from('posts')
      .select(`
        id, user_id, caption, link_url, post_type, likes_count, comments_count, created_at, updated_at,
        profiles:user_id (id, full_name, avatar_url),
        post_media (id, post_id, media_type, storage_path, media_url, display_order)
      `)
      .eq('id', postId)
      .single();
    if (fetchErr || !data) throw fetchErr ?? new Error('Failed to fetch updated post');
    return data as unknown as Post;
  }

  static async updateComment(commentId: string, content: string): Promise<void> {
    const client = await getAuthenticatedClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await client
      .from('post_comments')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('user_id', user.id);
    if (error) throw error;
  }

  static async deleteComment(commentId: string): Promise<void> {
    const client = await getAuthenticatedClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await client
      .from('post_comments')
      .update({ is_deleted: true })
      .eq('id', commentId)
      .eq('user_id', user.id);
    if (error) throw error;
  }

  static async saveMentions(postId: string, mentionedUserIds: string[]): Promise<void> {
    if (!mentionedUserIds.length) return;
    const rows = mentionedUserIds.map(uid => ({ post_id: postId, mentioned_user_id: uid }));
    await supabase.from('post_mentions').insert(rows);
  }

  static subscribeToFeed(callback: (post: Post) => void) {
    return supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
        try {
          const { data } = await supabase
            .from('posts')
            .select(`
              id, user_id, caption, link_url, likes_count, comments_count, created_at,
              profiles:user_id (id, full_name, avatar_url),
              post_media (id, post_id, media_type, storage_path, media_url, display_order)
            `)
            .eq('id', payload.new.id)
            .single();
          if (data) callback({ ...(data as unknown as Post), user_has_liked: false });
        } catch { /* ignore */ }
      })
      .subscribe();
  }
}
