import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { ArrowLeft, Link, AlertCircle } from 'lucide-react-native';
import { FeedService, Post } from '../../services/feed.service';
import { MentionTextInput } from './MentionTextInput';

const { width: SW } = Dimensions.get('window');
const ORANGE = '#FF6B00';
const BG = '#0F1923';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';

interface EditPostModalProps {
  visible: boolean;
  post: Post | null;
  onClose: () => void;
  onSaved: (updatedPost: Post) => void;
}

export function EditPostModal({ visible, post, onClose, onSaved }: EditPostModalProps) {
  const [caption, setCaption] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && post) {
      setCaption(post.caption ?? '');
      setLinkUrl(post.link_url ?? '');
      setLinkError(null);
      setError(null);
    }
  }, [visible, post]);

  const handleClose = useCallback(() => {
    if (saving) return;
    onClose();
  }, [saving, onClose]);

  const validateLink = useCallback((url: string) => {
    setLinkUrl(url);
    if (!url) { setLinkError(null); return; }
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      setLinkError(null);
    } catch {
      setLinkError('Please enter a valid URL');
    }
  }, []);

  const originalCaption = post?.caption ?? '';
  const originalLink = post?.link_url ?? '';
  const hasChanged =
    caption.trim() !== originalCaption.trim() ||
    linkUrl.trim() !== originalLink.trim();
  const canSave = hasChanged && !linkError && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave || !post) return;
    setSaving(true);
    setError(null);
    try {
      const normalizedLink = linkUrl.trim()
        ? linkUrl.startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`
        : '';
      const updated = await FeedService.updatePostCaption(post.id, caption.trim(), normalizedLink);
      await FeedService.saveMentions(post.id, mentionedUserIds).catch(() => {});
      onSaved(updated);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [canSave, post, caption, linkUrl, mentionedUserIds, onSaved, onClose]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} disabled={saving} style={styles.headerBtn} activeOpacity={0.7}>
              <ArrowLeft size={22} color={saving ? TEXT_SECONDARY : '#fff'} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Post</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              activeOpacity={0.8}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.saveBtnText}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <MentionTextInput
              value={caption}
              onChange={setCaption}
              onMentionsChange={setMentionedUserIds}
              placeholder="Share with the community..."
              maxLength={500}
              autoFocus
              style={styles.captionWrapper}
              inputStyle={styles.captionInput}
            />
            <Text style={styles.charCount}>{caption.length}/500</Text>

            <View style={styles.section}>
              <View style={[styles.linkRow, linkError ? styles.linkRowError : null]}>
                <Link size={18} color={linkError ? '#ef4444' : TEXT_SECONDARY} />
                <TextInput
                  style={styles.linkInput}
                  placeholder="Add a link..."
                  placeholderTextColor={TEXT_SECONDARY}
                  value={linkUrl}
                  onChangeText={validateLink}
                  onBlur={() => validateLink(linkUrl)}
                  keyboardType="url"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {linkError && (
                <View style={styles.errorRow}>
                  <AlertCircle size={12} color="#ef4444" />
                  <Text style={styles.errorText}>{linkError}</Text>
                </View>
              )}
            </View>

            {error && (
              <View style={styles.errorBanner}>
                <AlertCircle size={14} color="#ef4444" />
                <Text style={styles.errorBannerText}>{error}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerBtn: { minWidth: 60 },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  saveBtn: {
    backgroundColor: ORANGE,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  captionWrapper: { minHeight: 120 },
  captionInput: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  charCount: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  section: { marginBottom: 16 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  linkRowError: { borderColor: '#ef4444' },
  linkInput: { flex: 1, color: '#fff', fontSize: 14 },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  errorText: { color: '#ef4444', fontSize: 12 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  errorBannerText: { color: '#ef4444', fontSize: 13, flex: 1 },
});
