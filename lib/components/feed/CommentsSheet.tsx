import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { X, Send, MoreHorizontal, Pencil, Trash2 } from 'lucide-react-native';
import { FeedService, Comment, Post } from '../../services/feed.service';
import { useAuth } from '../../providers/AuthContext';
import { ActionSheet } from './ActionSheet';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ORANGE = '#FF6B00';
const BG = '#0F1923';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';
const RED = '#FF4444';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface CommentItemProps {
  comment: Comment;
  currentUserId: string | null;
  onEdit: (comment: Comment) => void;
  onDelete: (commentId: string) => void;
}

function CommentItem({ comment, currentUserId, onEdit, onDelete }: CommentItemProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const name = comment.profiles?.full_name ?? 'User';
  const avatar = comment.profiles?.avatar_url;
  const isOwner = !!currentUserId && comment.user_id === currentUserId;

  const handleEditStart = () => {
    setEditText(comment.content);
    setEditMode(true);
    setMenuVisible(false);
  };

  const handleEditSave = async () => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === comment.content || saving) return;
    setSaving(true);
    try {
      await FeedService.updateComment(comment.id, trimmed);
      onEdit({ ...comment, content: trimmed });
      setEditMode(false);
    } catch { /* leave edit mode open */ }
    finally { setSaving(false); }
  };

  const handleEditCancel = () => {
    setEditMode(false);
    setEditText('');
  };

  const menuOptions = [
    {
      label: 'Edit',
      icon: <Pencil size={18} color={ORANGE} />,
      onPress: handleEditStart,
    },
    {
      label: 'Delete',
      icon: <Trash2 size={18} color={RED} />,
      destructive: true,
      onPress: () => onDelete(comment.id),
    },
    {
      label: 'Cancel',
      cancel: true,
      onPress: () => {},
    },
  ];

  return (
    <>
      <View style={styles.commentRow}>
        <View style={styles.commentAvatar}>
          {avatar
            ? <Image source={{ uri: avatar }} style={styles.commentAvatarImg} />
            : <Text style={styles.commentAvatarInitial}>{name.charAt(0).toUpperCase()}</Text>
          }
        </View>
        <View style={styles.commentBubble}>
          <View style={styles.commentHeader}>
            <Text style={styles.commentName}>{name}</Text>
            <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
            {isOwner && (
              <TouchableOpacity
                style={styles.commentMenuBtn}
                onPress={() => setMenuVisible(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MoreHorizontal size={14} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            )}
          </View>

          {editMode ? (
            <View>
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
                maxLength={500}
                placeholderTextColor={TEXT_SECONDARY}
              />
              <View style={styles.editActions}>
                <TouchableOpacity onPress={handleEditCancel} style={styles.editCancelBtn} activeOpacity={0.7}>
                  <Text style={styles.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleEditSave}
                  disabled={!editText.trim() || saving}
                  style={[styles.editSaveBtn, (!editText.trim() || saving) && { opacity: 0.4 }]}
                  activeOpacity={0.8}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.editSaveText}>Save</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text style={styles.commentText}>{comment.content}</Text>
          )}
        </View>
      </View>

      <ActionSheet
        visible={menuVisible}
        options={menuOptions}
        onClose={() => setMenuVisible(false)}
      />
    </>
  );
}

interface CommentsSheetProps {
  post: Post | null;
  visible: boolean;
  onClose: () => void;
  onCommentAdded: (postId: string) => void;
  onCommentDeleted?: (postId: string) => void;
}

export function CommentsSheet({
  post,
  visible,
  onClose,
  onCommentAdded,
  onCommentDeleted,
}: CommentsSheetProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [text, setText] = useState('');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const inputRef = useRef<TextInput>(null);
  const { supabaseUserId } = useAuth();

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();
      if (post) {
        setLoading(true);
        FeedService.fetchComments(post.id)
          .then(data => setComments(data))
          .catch(() => {})
          .finally(() => setLoading(false));
      }
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: false,
      }).start();
      setComments([]);
      setText('');
    }
  }, [visible, post]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: false,
    }).start(() => onClose());
  }, [onClose, slideAnim]);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !post || submitting) return;
    const content = text.trim();
    setText('');
    setSubmitting(true);
    try {
      const comment = await FeedService.addComment(post.id, content);
      setComments(prev => [...prev, comment]);
      onCommentAdded(post.id);
    } catch {
      setText(content);
    } finally {
      setSubmitting(false);
    }
  }, [text, post, submitting, onCommentAdded]);

  const handleEditComment = useCallback((updated: Comment) => {
    setComments(prev => prev.map(c => c.id === updated.id ? updated : c));
  }, []);

  const handleDeleteComment = useCallback(async (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    if (post) onCommentDeleted?.(post.id);
    try {
      await FeedService.deleteComment(commentId);
    } catch {
      // already removed optimistically; could re-add but low stakes
    }
  }, [post, onCommentDeleted]);

  if (!visible && !post) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Title bar */}
        <View style={styles.titleBar}>
          <Text style={styles.title}>Comments</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>

        {/* Comments list */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={ORANGE} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <CommentItem
                  comment={item}
                  currentUserId={supabaseUserId}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                />
              )}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.empty}>No comments yet. Be the first!</Text>
                </View>
              }
            />
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Add a comment..."
              placeholderTextColor={TEXT_SECONDARY}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={500}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!text.trim() || submitting) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!text.trim() || submitting}
              activeOpacity={0.8}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Send size={18} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const SHEET_HEIGHT = SCREEN_HEIGHT * 0.7;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  titleBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  closeBtn: { position: 'absolute', right: 16, padding: 4 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  empty: { color: TEXT_SECONDARY, fontSize: 14 },
  listContent: { paddingVertical: 8, flexGrow: 1 },

  commentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
    alignItems: 'flex-start',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a3a4a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  commentAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  commentAvatarInitial: { color: '#fff', fontSize: 13, fontWeight: '700' },
  commentBubble: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 10,
    padding: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  commentName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  commentTime: { color: TEXT_SECONDARY, fontSize: 11 },
  commentMenuBtn: { marginLeft: 'auto' as any },
  commentText: { color: '#E2E8F0', fontSize: 13, lineHeight: 18 },

  editInput: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,107,0,0.4)',
    paddingVertical: 4,
    marginBottom: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  editCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  editCancelText: { color: TEXT_SECONDARY, fontSize: 12, fontWeight: '600' },
  editSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: ORANGE,
    minWidth: 52,
    alignItems: 'center',
  },
  editSaveText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    gap: 10,
    backgroundColor: CARD_BG,
  },
  input: {
    flex: 1,
    backgroundColor: BG,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#fff',
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
});
