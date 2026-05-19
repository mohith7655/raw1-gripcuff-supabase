/**
 * AgoraVideoHelper.ts — native noop
 *
 * On iOS/Android, react-native-agora handles video natively.
 * This file exists so SyncedVideoPlayerScreen can import without
 * a Platform check. Metro picks AgoraVideoHelper.web.ts on web.
 */

export const getLocalVideoTrack = (): any => null;
export const getLocalAudioTrack = (): any => null;
export const getAgoraClient = (): any => null;
export const getLocalVolumeLevel = (): number => 0;

export const getAgoraDebugInfo = () => ({
    agoraState: 'native' as const,
    tokenStatus: 'n/a' as const,
    cameraStatus: 'n/a' as const,
    lastError: null as string | null,
    uid: 'native',
    remoteVideoActive: false,
});
