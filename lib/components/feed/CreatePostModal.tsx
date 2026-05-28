import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { ArrowLeft, Link, AlertCircle, Image as ImageIcon, X } from 'lucide-react-native';
import Cropper from 'react-easy-crop';
import { useCreatePost } from '../../hooks/useCreatePost';
import { FeedService, Post } from '../../services/feed.service';
import { getCroppedImg, PixelCrop } from '../../utils/cropImage';
import { MentionTextInput } from './MentionTextInput';

const { width: SW, height: SH } = Dimensions.get('window');
const ORANGE = '#FF6B00';
const BG = '#0F1923';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';

// ─── Filter definitions ─────────────────────────────────────────────────────
const FILTERS = [
  { name: 'Normal',    css: '' },
  { name: 'Clarendon', css: 'brightness(1.1) contrast(1.2) saturate(1.35)' },
  { name: 'Gingham',   css: 'brightness(1.05) hue-rotate(350deg) saturate(0.9)' },
  { name: 'Moon',      css: 'grayscale(1) brightness(1.1) contrast(1.1)' },
  { name: 'Lark',      css: 'brightness(1.1) contrast(0.9) saturate(1.1)' },
  { name: 'Reyes',     css: 'sepia(0.4) brightness(1.1) contrast(0.85) saturate(0.75)' },
  { name: 'Juno',      css: 'saturate(1.4) contrast(1.1)' },
  { name: 'Slumber',   css: 'saturate(0.6) brightness(1.05)' },
  { name: 'Crema',     css: 'sepia(0.3) contrast(1.1) saturate(0.9) brightness(1.05)' },
  { name: 'Ludwig',    css: 'brightness(1.05) contrast(1.1) saturate(1.2)' },
  { name: 'Aden',      css: 'hue-rotate(20deg) saturate(0.85) brightness(1.15) contrast(0.9)' },
  { name: 'Perpetua',  css: 'brightness(1.05) contrast(1.1) saturate(1.1)' },
];

// ─── Aspect ratio options ────────────────────────────────────────────────────
type AspectLabel = 'Original' | '1:1' | '4:5' | '16:9' | '9:16';
const ASPECTS: { label: AspectLabel; value: number | null }[] = [
  { label: 'Original', value: null },
  { label: '1:1',      value: 1 },
  { label: '4:5',      value: 4 / 5 },
  { label: '16:9',     value: 16 / 9 },
  { label: '9:16',     value: 9 / 16 },
];

type Step = 1 | 2 | 3;

interface CropState {
  crop: { x: number; y: number };
  zoom: number;
  aspect: AspectLabel;
  pixelCrop: PixelCrop | null;
  filter: string;
  croppedPreviewUri: string | null;
}

const DEFAULT_CROP: CropState = {
  crop: { x: 0, y: 0 },
  zoom: 1,
  aspect: '1:1',
  pixelCrop: null,
  filter: '',
  croppedPreviewUri: null,
};

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: (post: Post) => void;
}

export function CreatePostModal({ visible, onClose, onPostCreated }: CreatePostModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [cropState, setCropState] = useState<CropState>(DEFAULT_CROP);
  const [processingCrop, setProcessingCrop] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const croppedBlobRef = useRef<Blob | null>(null);

  const handleSuccess = useCallback((post: Post) => {
    FeedService.saveMentions(post.id, mentionedUserIds).catch(() => {});
    onPostCreated(post);
    onClose();
  }, [onPostCreated, onClose, mentionedUserIds]);

  const {
    mediaFiles,
    linkUrl,
    linkError,
    caption,
    setCaption,
    uploading,
    progress,
    error,
    canPost,
    pickMedia,
    removeMedia,
    validateLink,
    submit,
    submitWithBlob,
    reset,
  } = useCreatePost(handleSuccess);

  const handlePost = useCallback(() => {
    if (croppedBlobRef.current) {
      submitWithBlob(croppedBlobRef.current);
    } else {
      submit();
    }
  }, [croppedBlobRef, submit, submitWithBlob]);

  const handleClose = useCallback(() => {
    if (uploading || processingCrop) return;
    setStep(1);
    setCropState(DEFAULT_CROP);
    setMentionedUserIds([]);
    croppedBlobRef.current = null;
    reset();
    onClose();
  }, [uploading, processingCrop, reset, onClose]);

  const handleBack = useCallback(() => {
    if (step === 2) { setStep(1); setCropState(DEFAULT_CROP); croppedBlobRef.current = null; }
    if (step === 3) setStep(2);
  }, [step]);

  // After media pick in Step 1, if there's an image, advance to Step 2
  const handlePickMedia = useCallback(async () => {
    const before = mediaFiles.length;
    await pickMedia();
    // pickMedia is async but updates state; we detect new image in effect via mediaFiles change
    // We use a short defer to read updated mediaFiles via the useEffect below
  }, [pickMedia, mediaFiles.length]);

  // Detect image selected → move to step 2
  React.useEffect(() => {
    if (step === 1 && mediaFiles.length > 0 && mediaFiles[0].type === 'image') {
      setCropState(DEFAULT_CROP);
      setStep(2);
    }
  }, [mediaFiles, step]);

  // ── Step 2: advance to Step 3 after cropping ──────────────────────────────
  const handleNextFromEdit = useCallback(async () => {
    const imageFile = mediaFiles[0];
    if (!imageFile || imageFile.type !== 'image') { setStep(3); return; }

    setProcessingCrop(true);
    try {
      const pixelCrop = cropState.pixelCrop ?? { x: 0, y: 0, width: 800, height: 800 };
      const blob = await getCroppedImg(imageFile.uri, pixelCrop, 0, cropState.filter);
      croppedBlobRef.current = blob;
      const previewUri = URL.createObjectURL(blob);
      setCropState(prev => ({ ...prev, croppedPreviewUri: previewUri }));
      setStep(3);
    } catch {
      setStep(3);
    } finally {
      setProcessingCrop(false);
    }
  }, [mediaFiles, cropState]);

  const aspectValue = ASPECTS.find(a => a.label === cropState.aspect)?.value ?? 1;

  // ── Rendering ─────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <View style={styles.container}>

        {/* ── STEP 1: Select ─────────────────────────────────────────────── */}
        {step === 1 && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleClose} style={styles.headerBtn} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>New Post</Text>
              <View style={styles.headerBtn} />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              <TouchableOpacity style={styles.mediaPickerBtn} onPress={handlePickMedia} activeOpacity={0.8}>
                <ImageIcon size={20} color={ORANGE} />
                <Text style={styles.mediaPickerText}>
                  {mediaFiles.length === 0
                    ? 'Add photos or video'
                    : `${mediaFiles.length} file${mediaFiles.length > 1 ? 's' : ''} selected`}
                </Text>
              </TouchableOpacity>

              {mediaFiles.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previews}>
                  {mediaFiles.map((file, i) => (
                    <View key={i} style={styles.previewItem}>
                      <Image source={{ uri: file.uri }} style={styles.previewImg} resizeMode="cover" />
                      <TouchableOpacity style={styles.previewRemove} onPress={() => removeMedia(i)}>
                        <X size={12} color="#fff" />
                      </TouchableOpacity>
                      {file.type === 'video' && (
                        <View style={styles.videoTag}><Text style={styles.videoTagText}>VID</Text></View>
                      )}
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={styles.hints}>
                <Text style={styles.hintText}>Images: JPG, PNG, WebP — max 10MB each, up to 4</Text>
                <Text style={styles.hintText}>Video: MP4, MOV — max 100MB, 1 per post</Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {/* ── STEP 2: Crop & Filters ──────────────────────────────────────── */}
        {step === 2 && (
          <View style={{ flex: 1 }}>
            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} style={styles.headerBtn} activeOpacity={0.7}>
                <ArrowLeft size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Edit</Text>
              <TouchableOpacity
                onPress={handleNextFromEdit}
                style={styles.headerBtn}
                activeOpacity={0.8}
                disabled={processingCrop}
              >
                {processingCrop
                  ? <ActivityIndicator size="small" color={ORANGE} />
                  : <Text style={styles.nextText}>Next →</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Crop canvas — top half */}
            <View style={styles.cropArea}>
              {mediaFiles[0] && (
                <Cropper
                  image={mediaFiles[0].uri}
                  crop={cropState.crop}
                  zoom={cropState.zoom}
                  aspect={aspectValue ?? undefined}
                  onCropChange={(crop) => setCropState(prev => ({ ...prev, crop }))}
                  onZoomChange={(zoom) => setCropState(prev => ({ ...prev, zoom }))}
                  onCropComplete={(_, pixelCrop) =>
                    setCropState(prev => ({ ...prev, pixelCrop }))
                  }
                  style={{
                    containerStyle: { backgroundColor: '#0a0f18' },
                    mediaStyle: cropState.filter ? { filter: cropState.filter } : {},
                  }}
                  showGrid={false}
                />
              )}
            </View>

            {/* Aspect ratio pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.aspectRow}
              contentContainerStyle={styles.aspectContent}
            >
              {ASPECTS.map(({ label }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.aspectPill, cropState.aspect === label && styles.aspectPillActive]}
                  onPress={() => setCropState(prev => ({ ...prev, aspect: label }))}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.aspectPillText, cropState.aspect === label && styles.aspectPillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Filters strip */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterRow}
              contentContainerStyle={styles.filterContent}
            >
              {FILTERS.map(({ name, css }) => (
                <TouchableOpacity
                  key={name}
                  style={styles.filterItem}
                  onPress={() => setCropState(prev => ({ ...prev, filter: css }))}
                  activeOpacity={0.8}
                >
                  <View style={[
                    styles.filterThumb,
                    cropState.filter === css && styles.filterThumbActive,
                  ]}>
                    {/* On web, <img> with inline style is needed for CSS filter */}
                    {mediaFiles[0] && (
                      <img
                        src={mediaFiles[0].uri}
                        alt={name}
                        style={{
                          width: 72,
                          height: 72,
                          objectFit: 'cover',
                          filter: css || 'none',
                          display: 'block',
                          borderRadius: 6,
                        }}
                      />
                    )}
                  </View>
                  <Text style={[styles.filterLabel, cropState.filter === css && styles.filterLabelActive]}>
                    {name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── STEP 3: Caption & Post ──────────────────────────────────────── */}
        {step === 3 && (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {uploading && (
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} />
              </View>
            )}

            <View style={styles.header}>
              <TouchableOpacity onPress={handleBack} disabled={uploading} style={styles.headerBtn} activeOpacity={0.7}>
                <ArrowLeft size={22} color={uploading ? TEXT_SECONDARY : '#fff'} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>New Post</Text>
              <TouchableOpacity
                onPress={handlePost}
                disabled={!canPost}
                style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
                activeOpacity={0.8}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.postBtnText}>Post</Text>
                }
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              {/* Preview + caption row */}
              <View style={styles.captionRow}>
                {(cropState.croppedPreviewUri ?? mediaFiles[0]?.uri) && (
                  <Image
                    source={{ uri: (cropState.croppedPreviewUri ?? mediaFiles[0]?.uri)! }}
                    style={[
                      styles.captionThumb,
                      !cropState.croppedPreviewUri && cropState.filter
                        ? {}
                        : undefined,
                    ]}
                    resizeMode="cover"
                  />
                )}
                <MentionTextInput
                  value={caption}
                  onChange={setCaption}
                  onMentionsChange={setMentionedUserIds}
                  placeholder="Share with the community..."
                  maxLength={500}
                  autoFocus
                  style={{ flex: 1 }}
                  inputStyle={styles.captionInput}
                />
              </View>
              <Text style={styles.charCount}>{caption.length}/500</Text>

              {/* Link */}
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

              <View style={styles.hints}>
                <Text style={styles.hintText}>Images: JPG, PNG, WebP — max 10MB each, up to 4</Text>
                <Text style={styles.hintText}>Video: MP4, MOV — max 100MB, 1 per post</Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const CROP_AREA_HEIGHT = SH * 0.42;
const FILTER_ROW_HEIGHT = 120;
const PREVIEW_SIZE = 90;

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
  cancelText: { color: TEXT_SECONDARY, fontSize: 15 },
  nextText: { color: ORANGE, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  postBtn: {
    backgroundColor: ORANGE,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 7,
    minWidth: 60,
    alignItems: 'center',
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  progressBar: { height: 3, backgroundColor: 'rgba(255,107,0,0.2)' },
  progressFill: { height: 3, backgroundColor: ORANGE },

  // ── Step 2 ──
  cropArea: {
    height: CROP_AREA_HEIGHT,
    width: SW,
    backgroundColor: '#0a0f18',
    position: 'relative',
  },
  aspectRow: {
    maxHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  aspectContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  aspectPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  aspectPillActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  aspectPillText: { color: TEXT_SECONDARY, fontSize: 13, fontWeight: '600' },
  aspectPillTextActive: { color: '#fff' },

  filterRow: { maxHeight: FILTER_ROW_HEIGHT },
  filterContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  filterItem: { alignItems: 'center', gap: 5 },
  filterThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterThumbActive: { borderColor: ORANGE },
  filterLabel: { color: TEXT_SECONDARY, fontSize: 10, fontWeight: '600' },
  filterLabelActive: { color: ORANGE },

  // ── Step 3 ──
  captionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  captionThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    flexShrink: 0,
    backgroundColor: '#0d1825',
  },
  captionInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  charCount: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 16,
  },

  // ── Shared ──
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 16 },

  mediaPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.25)',
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  mediaPickerText: { color: ORANGE, fontSize: 14, fontWeight: '600' },

  previews: { marginBottom: 16 },
  previewItem: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
    backgroundColor: '#0d1825',
  },
  previewImg: { width: PREVIEW_SIZE, height: PREVIEW_SIZE },
  previewRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTag: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  videoTagText: { color: '#fff', fontSize: 10, fontWeight: '700' },

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

  hints: { gap: 4, marginTop: 8 },
  hintText: { color: TEXT_SECONDARY, fontSize: 11 },
});
