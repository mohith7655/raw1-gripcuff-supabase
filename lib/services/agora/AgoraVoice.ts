/**
 * Shared interface for Agora functionality.
 * Expo picks AgoraVoice.native.ts on iOS/Android and AgoraVoice.web.ts on web.
 */

export interface AgoraVoiceService {
    /**
     * Voice-only join (no token, no video). Used by legacy callers.
     */
    joinChannel: (
        sessionId: string,
        onSpeakerActive: (isLocal: boolean, isRemote: boolean) => void,
    ) => Promise<void>;

    /**
     * Video + voice join with a pre-fetched token.
     * Token may be '' for App-ID-only projects.
     * onRemoteUidJoined / onRemoteUidLeft are called as remote participants
     * enter and leave — used by VideoPlayerScreen to drive RtcSurfaceView on native.
     * On web the UID callbacks are no-ops; remote video is rendered via DOM injection.
     */
    joinChannelWithToken: (
        token: string,
        channelName: string,
        uid: number,
        onSpeakerActive: (isLocal: boolean, isRemote: boolean) => void,
        onRemoteUidJoined: (uid: number) => void,
        onRemoteUidLeft: (uid: number) => void,
    ) => Promise<void>;

    leaveChannel: () => Promise<void>;
    toggleMute: (muted: boolean) => Promise<void>;
}

// No-op fallback — real implementations live in .native.ts and .web.ts.
export const AgoraVoice: AgoraVoiceService = {
    joinChannel: async () => {},
    joinChannelWithToken: async () => {},
    leaveChannel: async () => {},
    toggleMute: async () => {},
};
