import { Platform } from 'react-native';
import { Audio } from 'expo-audio';
import {
    createAgoraRtcEngine,
    IRtcEngine,
    ChannelProfileType,
    ClientRoleType
} from 'react-native-agora';
import { AGORA_APP_ID } from '../../core/config/api_keys';
import { AgoraVoiceService } from './AgoraVoice';

let engine: IRtcEngine | null = null;

export const AgoraVoice: AgoraVoiceService = {
    joinChannel: async (sessionId: string, onSpeakerActive: (isLocal: boolean, isRemote: boolean) => void) => {
        if (Platform.OS === 'web') return;
        try {
            await Audio.requestPermissionsAsync();

            engine = createAgoraRtcEngine();
            engine.initialize({ appId: AGORA_APP_ID });

            engine.enableAudio();
            engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
            engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

            engine.registerEventHandler({
                onAudioVolumeIndication: (connection, speakers, totalVolume) => {
                    let remoteSpeaking = false;
                    let localSpeaking = false;
                    for (const speaker of speakers) {
                        if (speaker.uid === 0 && (speaker.volume ?? 0) > 5) localSpeaking = true;
                        if (speaker.uid !== 0 && (speaker.volume ?? 0) > 5) remoteSpeaking = true;
                    }
                    onSpeakerActive(localSpeaking, remoteSpeaking);
                }
            });

            engine.enableAudioVolumeIndication(200, 3, true);
            engine.joinChannel('', sessionId, 0, {});
        } catch (e) {
            console.warn("Agora Native initialization failed", e);
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
    }
};
