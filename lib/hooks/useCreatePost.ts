import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { FeedService, Post } from '../services/feed.service';

export interface SelectedMedia {
  uri: string;
  type: 'image' | 'video';
  mimeType: string;
  name: string;
}

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

function getMimeType(uri: string, type: 'image' | 'video'): string {
  const ext = uri.split('.').pop()?.toLowerCase() ?? '';
  const imageMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  const videoMap: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime' };
  return type === 'image' ? (imageMap[ext] ?? 'image/jpeg') : (videoMap[ext] ?? 'video/mp4');
}

export function useCreatePost(onSuccess: (post: Post) => void) {
  const [mediaFiles, setMediaFiles] = useState<SelectedMedia[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pickMedia = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Media library permission is required');
      return;
    }

    const hasVideo = mediaFiles.some(f => f.type === 'video');
    if (hasVideo) {
      setError('Cannot add more files when a video is selected');
      return;
    }

    const isImages = mediaFiles.length > 0 && mediaFiles[0].type === 'image';
    const remaining = isImages ? MAX_IMAGES - mediaFiles.length : MAX_IMAGES;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaFiles.length === 0
        ? ImagePicker.MediaTypeOptions.All
        : ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
      videoMaxDuration: 300,
    });

    if (result.canceled) return;

    const newFiles: SelectedMedia[] = [];
    for (const asset of result.assets) {
      const isVideo = asset.type === 'video';
      const fileSize = asset.fileSize ?? 0;

      if (isVideo) {
        if (mediaFiles.length > 0) {
          setError('Cannot mix videos with images. Remove existing selections first.');
          return;
        }
        if (fileSize > MAX_VIDEO_BYTES) {
          setError('Video must be under 100MB');
          return;
        }
        const mimeType = getMimeType(asset.uri, 'video');
        const ext = asset.uri.split('.').pop() ?? 'mp4';
        newFiles.push({ uri: asset.uri, type: 'video', mimeType, name: `video_${Date.now()}.${ext}` });
        setMediaFiles(newFiles);
        return;
      } else {
        if (mediaFiles.some(f => f.type === 'video')) {
          setError('Cannot add images when a video is selected');
          return;
        }
        if (fileSize > MAX_IMAGE_BYTES) {
          setError(`Image "${asset.fileName ?? 'file'}" exceeds 10MB`);
          return;
        }
        const mimeType = getMimeType(asset.uri, 'image');
        const ext = asset.uri.split('.').pop() ?? 'jpg';
        newFiles.push({ uri: asset.uri, type: 'image', mimeType, name: `image_${Date.now()}_${newFiles.length}.${ext}` });
      }
    }

    setMediaFiles(prev => {
      const combined = [...prev, ...newFiles];
      return combined.slice(0, MAX_IMAGES);
    });
  }, [mediaFiles]);

  const removeMedia = useCallback((index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

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

  const canPost = (caption.trim().length > 0 || mediaFiles.length > 0 || (linkUrl.trim().length > 0 && !linkError)) && !uploading;

  const _doSubmit = useCallback(async (overrideFirstBlob?: Blob) => {
    if (!canPost) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const normalizedLink = linkUrl.trim()
        ? linkUrl.startsWith('http') ? linkUrl.trim() : `https://${linkUrl.trim()}`
        : '';

      let filesToUpload = mediaFiles;
      let blobUrl: string | null = null;

      if (overrideFirstBlob && mediaFiles.length > 0 && mediaFiles[0].type === 'image') {
        blobUrl = URL.createObjectURL(overrideFirstBlob);
        filesToUpload = [
          { ...mediaFiles[0], uri: blobUrl, mimeType: 'image/jpeg', name: `cropped_${Date.now()}.jpg` },
          ...mediaFiles.slice(1),
        ];
      }

      const post = await FeedService.createPost({
        caption: caption.trim(),
        mediaFiles: filesToUpload,
        linkUrl: normalizedLink,
        onProgress: setProgress,
      });

      if (blobUrl) URL.revokeObjectURL(blobUrl);

      onSuccess(post);
      setCaption('');
      setMediaFiles([]);
      setLinkUrl('');
      setLinkError(null);
      setProgress(0);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create post');
    } finally {
      setUploading(false);
    }
  }, [canPost, caption, mediaFiles, linkUrl, linkError, onSuccess]);

  const submit = useCallback(() => _doSubmit(), [_doSubmit]);
  const submitWithBlob = useCallback((blob: Blob) => _doSubmit(blob), [_doSubmit]);

  const reset = useCallback(() => {
    setCaption('');
    setMediaFiles([]);
    setLinkUrl('');
    setLinkError(null);
    setProgress(0);
    setError(null);
    setUploading(false);
  }, []);

  return {
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
  };
}
