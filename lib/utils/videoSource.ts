import { PREMADE_WORKOUT_VIDEO_URL } from '../constants/videoUrls';

/**
 * Resolves the best available playback URL from a video object.
 * Priority: firebaseUrl → videoUrl → url → fallback to premade workout video.
 * All resolved URLs must be Firebase Storage URLs for reliable streaming.
 */
export function resolveVideoUrl(video: any): string {
    const url =
        video?.firebaseUrl ||
        video?.videoUrl ||
        video?.url ||
        '';

    if (url) {
        console.log('[Video] Using Firebase source:', url);
    } else {
        console.warn('[Video] No URL found on video object — falling back to premade URL');
    }

    return url || PREMADE_WORKOUT_VIDEO_URL;
}
