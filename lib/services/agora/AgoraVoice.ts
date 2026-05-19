/**
 * This is the shared interface for Agora Voice functionality.
 * The actual implementations are in AgoraVoice.native.ts and AgoraVoice.web.ts
 * Expo automatically picks the right file based on the platform.
 */

export interface AgoraVoiceService {
    joinChannel: (sessionId: string, onSpeakerActive: (isLocal: boolean, isRemote: boolean) => void) => Promise<void>;
    leaveChannel: () => Promise<void>;
    toggleMute: (muted: boolean) => Promise<void>;
}

export const AgoraVoice: AgoraVoiceService = {
    joinChannel: async () => { },
    leaveChannel: async () => { },
    toggleMute: async () => { },
};
