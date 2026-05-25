/**
 * AgoraVideoHelper.ts — native implementation
 *
 * On iOS/Android, react-native-agora renders video via RtcSurfaceView using
 * integer UIDs. This module exposes the UID objects that VideoPlayerScreen
 * passes to RtcSurfaceView canvas props.
 *
 * Metro picks AgoraVideoHelper.web.ts on web (real Agora Web SDK tracks).
 * This file is used on iOS and Android.
 */

export type NativeVideoTrack = { uid: number };

/** Local preview — RtcSurfaceView with uid 0 renders the device camera. */
export const getLocalVideoTrack = (): NativeVideoTrack => ({ uid: 0 });

/** Remote participant — RtcSurfaceView with this uid renders their stream. */
export const getRemoteVideoTrack = (uid: number): NativeVideoTrack => ({ uid });

// Stubs to satisfy shared import sites that use the web-SDK shape.
// These are never called on native — the engine manages audio internally.
export const getLocalAudioTrack = (): null => null;
export const getAgoraClient = (): null => null;
export const getLocalVolumeLevel = (): number => 0;

export const getAgoraDebugInfo = () => ({
    agoraState: 'native' as const,
    tokenStatus: 'n/a' as const,
    cameraStatus: 'n/a' as const,
    lastError: null as string | null,
    uid: 'native',
    remoteVideoActive: false,
});
