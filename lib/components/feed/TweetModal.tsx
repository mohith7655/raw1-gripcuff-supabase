import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useUser } from '../../providers/UserContext';
import { FeedService, Post } from '../../services/feed.service';
import { MentionTextInput } from './MentionTextInput';

const { height: SH } = Dimensions.get('window');
const ORANGE = '#FF6B00';
const BG = '#0F1923';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';
const MAX_CHARS = 280;

interface TweetModalProps {
  visible: boolean;
  onClose: () => void;
  onTweetCreated: (post: Post) => void;
}

export function TweetModal({ visible, onClose, onTweetCreated }: TweetModalProps) {
  const { profile } = useUser();
  const [text, setText] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(SH)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SH,
        duration: 250,
        useNativeDriver: false,
      }).start();
      setText('');
      setMentionedUserIds([]);
      setError(null);
    }
  }, [visible, slideAnim]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    Animated.timing(slideAnim, {
      toValue: SH,
      duration: 250,
      useNativeDriver: false,
    }).start(() => onClose());
  }, [submitting, slideAnim, onClose]);

  const handlePost = useCallback(async () => {
    const content = text.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const post = await FeedService.createPost({
        caption: content,
        mediaFiles: [],
        linkUrl: '',
      });
      await FeedService.saveMentions(post.id, mentionedUserIds);
      const tweetPost: Post = { ...post, post_type: 'tweet' };
      onTweetCreated(tweetPost);
      handleClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to post');
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, onTweetCreated, handleClose]);

  const remaining = MAX_CHARS - text.length;
  const canPost = text.trim().length > 0 && !submitting;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} disabled={submitting} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={TEXT_SECONDARY} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Tweet</Text>
            <TouchableOpacity
              onPress={handlePost}
              disabled={!canPost}
              style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
              activeOpacity={0.8}
            >
              {submitting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.postBtnText}>Post</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Body */}
          <View style={styles.body}>
            {/* Avatar */}
            <View style={styles.avatarCol}>
              <View style={styles.avatar}>
                {profile?.profileImageUrl
                  ? <Image source={{ uri: profile.profileImageUrl }} style={styles.avatarImg} />
                  : <Text style={styles.avatarInitial}>
                      {(profile?.fullName ?? 'U').charAt(0).toUpperCase()}
                    </Text>
                }
              </View>
            </View>

            {/* Textarea with @mention */}
            <MentionTextInput
              value={text}
              onChange={setText}
              onMentionsChange={setMentionedUserIds}
              placeholder="What's on your mind?"
              maxLength={MAX_CHARS}
              autoFocus
              style={{ flex: 1 }}
              inputStyle={styles.input}
            />
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Text style={[styles.counter, remaining < 20 && styles.counterWarning]}>
              {remaining}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const SHEET_HEIGHT = SH * 0.5;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  closeBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  postBtn: {
    backgroundColor: ORANGE,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: 'center',
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  body: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  avatarCol: { paddingTop: 2 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2a3a4a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: { width: 40, height: 40, borderRadius: 20 },
  avatarInitial: { color: '#fff', fontSize: 16, fontWeight: '700' },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    lineHeight: 24,
    paddingTop: 0,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  errorText: { color: '#ef4444', fontSize: 12, flex: 1 },
  counter: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  counterWarning: { color: '#f59e0b' },
});
