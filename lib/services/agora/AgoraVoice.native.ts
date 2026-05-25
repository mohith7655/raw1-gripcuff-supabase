import { Platform } from 'react-native';
import { Audio } from 'expo-audio';
import {
    createAgoraRtcEngine,
    IRtcEngine,
    ChannelProfileType,
    ClientRoleType,
} from 'react-native-agora';
import { AGORA_APP_ID } from '../../core/config/api_keys';
import { AgoraVoiceService } from './AgoraVoice';

let engine: IRtcEngine | null = null;

/* ── Shared engine init ─────────────────────────────────────────────────────
 * Both joinChannel and joinChannelWithToken call this to create and configure
 * the engine. The only difference is whether video is enabled.
 */
async function _initEngine(withVideo: boolean): Promise<void> {
    await Audio.requestPermissionsAsync();

    engine = createAgoraRtcEngine();
    engine.initialize({ appId: AGORA_APP_ID });

    engine.enableAudio();
    if (withVideo) {
        engine.enableVideo();
    }
    engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
    engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);
    engine.enableAudioVolumeIndication(200, 3, true);
}

export const AgoraVoice: AgoraVoiceService = {

    // ── Voice-only join (legacy path — no token, no video) ────────────────
    joinChannel: async (
        sessionId: string,
        onSpeakerActive: (isLocal: boolean, isRemote: boolean) => void,
    ) => {
        if (Platform.OS === 'web') return;
        try {
            await _initEngine(false);

            engine!.registerEventHandler({
                onAudioVolumeIndication: (_connection, speakers) => {
                    let remoteSpeaking = false;
                    let localSpeaking = false;
                    for (const speaker of speakers) {
                        if (speaker.uid === 0 && (speaker.volume ?? 0) > 5) localSpeaking = true;
                        if (speaker.uid !== 0 && (speaker.volume ?? 0) > 5) remoteSpeaking = true;
                    }
                    onSpeakerActive(localSpeaking, remoteSpeaking);
                },
            });

            engine!.joinChannel('', sessionId, 0, {});
        } catch (e) {
            console.warn('[AgoraVoice] joinChannel failed:', e);
        }
    },

    // ── Video + voice join (co-workout path — uses token, enables camera) ─
    joinChannelWithToken: async (
        token: string,
        channelName: string,
        uid: number,
        onSpeakerActive: (isLocal: boolean, isRemote: boolean) => void,
        onRemoteUidJoined: (uid: number) => void,
        onRemoteUidLeft: (uid: number) => void,
    ) => {
        if (Platform.OS === 'web') return;
        try {
            await _initEngine(true);

            engine!.registerEventHandler({
                onAudioVolumeIndication: (_connection, speakers) => {
                    let remoteSpeaking = false;
                    let localSpeaking = false;
                    for (const speaker of speakers) {
                        if (speaker.uid === 0 && (speaker.volume ?? 0) > 5) localSpeaking = true;
                        if (speaker.uid !== 0 && (speaker.volume ?? 0) > 5) remoteSpeaking = true;
                    }
                    onSpeakerActive(localSpeaking, remoteSpeaking);
                },
                onUserJoined: (_connection, remoteUid) => {
                    console.log('[AgoraVoice] remote user joined:', remoteUid);
                    onRemoteUidJoined(remoteUid);
                },
                onUserOffline: (_connection, remoteUid) => {
                    console.log('[AgoraVoice] remote user left:', remoteUid);
                    onRemoteUidLeft(remoteUid);
                },
            });

            // startPreview renders local camera before join completes
            engine!.startPreview();
            engine!.joinChannel(token, channelName, uid, {});

            console.log('[AgoraVoice] joinChannelWithToken — channel:', channelName, 'uid:', uid);
        } catch (e) {
            console.warn('[AgoraVoice] joinChannelWithToken failed:', e);
        }
    },

    leaveChannel: async () => {
        if (engine) {
            engine.leaveChannel();
            engine.release();
            engine = null;
        }
    },

    toggleMute: async (muted: boolean) => {
        if (engine) {
            engine.muteLocalAudioStream(muted);
        }
    },
};
