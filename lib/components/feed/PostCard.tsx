import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Heart, MessageCircle, Share2, Play, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react-native';
import { Post } from '../../services/feed.service';
import { parseMentions } from '../../utils/parseMentions';
import { useAuth } from '../../providers/AuthContext';
import { ActionSheet } from './ActionSheet';
import { ConfirmDialog } from './ConfirmDialog';
import { EditTweetModal } from './EditTweetModal';
import { EditPostModal } from './EditPostModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const ORANGE = '#FF6B00';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface MediaGridProps {
  media: Post['post_media'];
}

function MediaGrid({ media }: MediaGridProps) {
  if (!media || media.length === 0) return null;

  const sorted = [...media].sort((a, b) => a.display_order - b.display_order);

  if (sorted.length === 1) {
    const item = sorted[0];
    if (item.media_type === 'video') {
      return (
        <View style={styles.mediaFull}>
          <Image source={{ uri: item.media_url }} style={styles.mediaFull} resizeMode="cover" />
          <View style={styles.playOverlay}>
            <Play size={40} color="#fff" fill="#fff" />
          </View>
        </View>
      );
    }
    return <Image source={{ uri: item.media_url }} style={styles.mediaFull} resizeMode="cover" />;
  }

  if (sorted.length === 2) {
    return (
      <View style={styles.mediaRow}>
        {sorted.map((item, i) => (
          <View key={item.id} style={[styles.mediaHalf, i === 0 && { marginRight: 2 }]}>
            <Image source={{ uri: item.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
        ))}
      </View>
    );
  }

  // 3-4 items: mosaic
  const [first, ...rest] = sorted;
  const restHeight = rest.length === 2 ? CARD_WIDTH * 0.5 : CARD_WIDTH * 0.33;
  return (
    <View style={styles.mediaMosaic}>
      <View style={styles.mosaicLeft}>
        <Image source={{ uri: first.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      </View>
      <View style={styles.mosaicRight}>
        {rest.map((item, i) => (
          <View
            key={item.id}
            style={[
              styles.mosaicSmall,
              { height: restHeight },
              i < rest.length - 1 && { marginBottom: 2 },
            ]}
          >
            <Image source={{ uri: item.media_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </View>
        ))}
      </View>
    </View>
  );
}

interface LinkPreviewProps {
  url: string;
}

function LinkPreview({ url }: LinkPreviewProps) {
  let domain = '';
  try {
    domain = new URL(url).hostname.replace('www.', '');
  } catch { domain = url; }

  return (
    <View style={styles.linkCard}>
      <View style={styles.linkIcon}>
        <Share2 size={16} color={ORANGE} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkDomain} numberOfLines={1}>{domain}</Text>
        <Text style={styles.linkUrl} numberOfLines={1}>{url}</Text>
      </View>
    </View>
  );
}

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onComment: (post: Post) => void;
  onDelete?: (postId: string) => void;
  onUpdate?: (post: Post) => void;
}

interface CaptionTextProps {
  text: string;
  style?: any;
  numberOfLines?: number;
  onNavigate?: (username: string) => void;
}

function CaptionText({ text, style, numberOfLines, onNavigate }: CaptionTextProps) {
  const segments = parseMentions(text);
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((seg, i) =>
        seg.type === 'mention' ? (
          <Text
            key={i}
            style={styles.mention}
            onPress={() => onNavigate?.(seg.value.slice(1))}
          >
            {seg.value}
          </Text>
        ) : (
          <Text key={i}>{seg.value}</Text>
        )
      )}
    </Text>
  );
}

function ActionRow({ post, onLike, onComment }: Pick<PostCardProps, 'post' | 'onLike' | 'onComment'>) {
  const handleLike = useCallback(() => onLike(post.id), [post.id, onLike]);
  const handleComment = useCallback(() => onComment(post), [post, onComment]);
  return (
    <View style={styles.actions}>
      <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
        <Heart
          size={20}
          color={post.user_has_liked ? ORANGE : TEXT_SECONDARY}
          fill={post.user_has_liked ? ORANGE : 'transparent'}
        />
        <Text style={[styles.actionCount, post.user_has_liked && styles.actionCountActive]}>
          {post.likes_count > 0 ? post.likes_count : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionBtn} onPress={handleComment} activeOpacity={0.7}>
        <MessageCircle size={20} color={TEXT_SECONDARY} />
        <Text style={styles.actionCount}>
          {post.comments_count > 0 ? post.comments_count : ''}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
        <Share2 size={20} color={TEXT_SECONDARY} />
      </TouchableOpacity>
    </View>
  );
}

function isEdited(post: Post): boolean {
  if (!post.updated_at) return false;
  const created = new Date(post.created_at).getTime();
  const updated = new Date(post.updated_at).getTime();
  return updated - created > 30_000;
}

export function PostCard({ post, onLike, onComment, onDelete, onUpdate }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [editTweetVisible, setEditTweetVisible] = useState(false);
  const [editPostVisible, setEditPostVisible] = useState(false);


  const { supabaseUserId } = useAuth();
  const isOwner = !!supabaseUserId && post.user_id === supabaseUserId;

  const displayName = post.profiles?.full_name ?? 'User';
  const avatar = post.profiles?.avatar_url;
  const caption = post.caption ?? '';
  const isLong = caption.length > 120;
  const isTweet = post.post_type === 'tweet';
  const edited = isEdited(post);

  const handleDeleteConfirm = useCallback(() => {
    setConfirmVisible(false);
    // onDelete is useFeed.deletePost — handles optimistic removal + API call + rollback
    onDelete?.(post.id);
  }, [post.id, onDelete]);

  const menuOptions = isTweet
    ? [
        {
          label: 'Edit tweet',
          icon: <Pencil size={18} color="#FF6B00" />,
          onPress: () => setEditTweetVisible(true),
        },
        {
          label: 'Delete tweet',
          icon: <Trash2 size={18} color="#FF4444" />,
          destructive: true,
          onPress: () => setConfirmVisible(true),
        },
        {
          label: 'Cancel',
          icon: <X size={18} color="#94A3B8" />,
          cancel: true,
          onPress: () => {},
        },
      ]
    : [
        {
          label: 'Edit caption',
          icon: <Pencil size={18} color="#FF6B00" />,
          onPress: () => setEditPostVisible(true),
        },
        {
          label: 'Delete post',
          icon: <Trash2 size={18} color="#FF4444" />,
          destructive: true,
          onPress: () => setConfirmVisible(true),
        },
        {
          label: 'Cancel',
          icon: <X size={18} color="#94A3B8" />,
          cancel: true,
          onPress: () => {},
        },
      ];

  const modals = (
    <>
      <ActionSheet visible={menuVisible} options={menuOptions} onClose={() => setMenuVisible(false)} />
      <ConfirmDialog
        visible={confirmVisible}
        title={isTweet ? 'Delete tweet?' : 'Delete post?'}
        body="This can't be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmVisible(false)}
      />
      <EditTweetModal
        visible={editTweetVisible}
        post={post}
        onClose={() => setEditTweetVisible(false)}
        onSaved={(updated) => { setEditTweetVisible(false); onUpdate?.(updated); }}
      />
      <EditPostModal
        visible={editPostVisible}
        post={post}
        onClose={() => setEditPostVisible(false)}
        onSaved={(updated) => { onUpdate?.(updated); }}
      />
    </>
  );

  // ── Tweet layout ────────────────────────────────────────────────────────────
  if (isTweet) {
    return (
      <View style={[styles.card, styles.tweetCard]}>
        <View style={styles.tweetRow}>
          <View style={styles.tweetAvatarCol}>
            <View style={styles.avatarSm}>
              {avatar
                ? <Image source={{ uri: avatar }} style={styles.avatarSmImg} />
                : <Text style={styles.avatarSmInitial}>{displayName.charAt(0).toUpperCase()}</Text>
              }
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.tweetMeta}>
              <Text style={styles.displayName}>{displayName}</Text>
              <Text style={styles.tweetDot}>·</Text>
              <Text style={styles.timestamp}>{timeAgo(post.created_at)}</Text>
              {edited && <Text style={styles.editedLabel}>· Edited</Text>}
              {isOwner && (
                <TouchableOpacity
                  style={styles.menuBtn}
                  onPress={() => setMenuVisible(true)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MoreHorizontal size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
            {caption.length > 0 && (
              <View style={styles.tweetCaptionWrap}>
                <CaptionText
                  text={caption}
                  style={styles.tweetCaption}
                  numberOfLines={expanded ? undefined : 5}
                />
                {isLong && !expanded && (
                  <TouchableOpacity onPress={() => setExpanded(true)} activeOpacity={0.7}>
                    <Text style={styles.more}>Show more</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            <ActionRow post={post} onLike={onLike} onComment={onComment} />
          </View>
        </View>
        {modals}
      </View>
    );
  }

  // ── Standard post layout ────────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          {avatar
            ? <Image source={{ uri: avatar }} style={styles.avatarImg} />
            : <Text style={styles.avatarInitial}>{displayName.charAt(0).toUpperCase()}</Text>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.displayName}>{displayName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.timestamp}>{timeAgo(post.created_at)}</Text>
            {edited && <Text style={styles.editedLabel}>· Edited</Text>}
          </View>
        </View>
        {isOwner && (
          <TouchableOpacity
            style={styles.menuBtn}
            onPress={() => setMenuVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreHorizontal size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Caption */}
      {caption.length > 0 && (
        <View style={styles.captionWrap}>
          <CaptionText
            text={caption}
            style={styles.caption}
            numberOfLines={expanded ? undefined : 3}
          />
          {isLong && !expanded && (
            <TouchableOpacity onPress={() => setExpanded(true)} activeOpacity={0.7}>
              <Text style={styles.more}>...more</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Media */}
      {post.post_media && post.post_media.length > 0 && (
        <View style={styles.mediaWrap}>
          <MediaGrid media={post.post_media} />
        </View>
      )}

      {/* Link preview */}
      {post.link_url && <LinkPreview url={post.link_url} />}

      <ActionRow post={post} onLike={onLike} onComment={onComment} />
      {modals}
    </View>
  );
}

const mediaFullHeight = CARD_WIDTH * 0.75;
const mosaicHeight = CARD_WIDTH * 0.55;

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2a3a4a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 38, height: 38, borderRadius: 19 },
  avatarInitial: { color: '#fff', fontSize: 16, fontWeight: '700' },
  displayName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  timestamp: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 1 },

  captionWrap: { paddingHorizontal: 12, paddingBottom: 10 },
  caption: { color: '#E2E8F0', fontSize: 14, lineHeight: 20 },
  more: { color: ORANGE, fontSize: 14, fontWeight: '600', marginTop: 2 },

  mediaWrap: { width: '100%' },
  mediaFull: {
    width: CARD_WIDTH,
    height: mediaFullHeight,
    backgroundColor: '#0d1825',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  mediaRow: {
    flexDirection: 'row',
    height: CARD_WIDTH * 0.6,
  },
  mediaHalf: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0d1825',
  },
  mediaMosaic: {
    flexDirection: 'row',
    height: mosaicHeight,
  },
  mosaicLeft: {
    flex: 1,
    marginRight: 2,
    overflow: 'hidden',
    backgroundColor: '#0d1825',
  },
  mosaicRight: {
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  },
  mosaicSmall: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#0d1825',
  },

  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#0F1923',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.2)',
  },
  linkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,107,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkDomain: { color: ORANGE, fontSize: 12, fontWeight: '700' },
  linkUrl: { color: TEXT_SECONDARY, fontSize: 11, marginTop: 2 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionCount: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 16,
  },
  actionCountActive: { color: ORANGE },
  mention: { color: ORANGE, fontWeight: '500' },
  menuBtn: { padding: 4, marginLeft: 4 },
  editedLabel: { color: '#94A3B8', fontSize: 11 },

  // Tweet layout
  tweetCard: {
    paddingVertical: 4,
  },
  tweetRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
  },
  tweetAvatarCol: { paddingTop: 2, flexShrink: 0 },
  avatarSm: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2a3a4a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarSmImg: { width: 34, height: 34, borderRadius: 17 },
  avatarSmInitial: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tweetMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  tweetDot: { color: TEXT_SECONDARY, fontSize: 14 },
  tweetCaptionWrap: { marginBottom: 8 },
  tweetCaption: { color: '#E2E8F0', fontSize: 15, lineHeight: 22 },
});
