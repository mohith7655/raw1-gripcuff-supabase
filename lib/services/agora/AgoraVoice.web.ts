import type {
    IAgoraRTCClient,
    IMicrophoneAudioTrack,
    ICameraVideoTrack,
} from 'agora-rtc-sdk-ng';
import { Platform } from 'react-native';

// Web only APIs MUST be conditionally required, even in .web.ts files
let AgoraRTC: any;
if (Platform.OS === 'web') {
    const agoraModule = require('agora-rtc-sdk-ng');
    AgoraRTC = agoraModule.default || agoraModule;
}
import { AGORA_APP_ID } from '../../core/config/api_keys';
import { AgoraVoiceService } from './AgoraVoice';

/* ─── Module-level state ─── */
let client: IAgoraRTCClient | null = null;
let localAudioTrack: IMicrophoneAudioTrack | null = null;
let localVideoTrack: ICameraVideoTrack | null = null;

type AgoraState = 'idle' | 'connecting' | 'connected' | 'error';
let _agoraState: AgoraState = 'idle';
let _tokenStatus: 'idle' | 'fetching' | 'ok' | 'failed' = 'idle';
let _cameraStatus: 'idle' | 'on' | 'off' | 'denied' = 'idle';
let _lastError: string | null = null;
let _remoteVideoActive = false; // true once a remote participant publishes video
let _localVolumeLevel = 0;      // 0-100, updated every 200ms after join
let _localVolumeInterval: any = null;

/* ── Public getters (consumed by AgoraVideoHelper.web.ts → screen) ── */
export const getLocalVideoTrack = (): ICameraVideoTrack | null => localVideoTrack;
export const getLocalAudioTrack = (): IMicrophoneAudioTrack | null => localAudioTrack;
export const getAgoraClient = (): IAgoraRTCClient | null => client;
export const getLocalVolumeLevel = (): number => _localVolumeLevel;

export const getAgoraDebugInfo = () => ({
    agoraState: _agoraState,
    tokenStatus: _tokenStatus,
    cameraStatus: _cameraStatus,
    lastError: _lastError,
    uid: client?.uid?.toString() ?? 'none',
    remoteVideoActive: _remoteVideoActive,
});

/* ─── Token ─── */
const fetchToken = async (channelName: string): Promise<string> => {
    _tokenStatus = 'fetching';
    console.log('[AgoraVoice] Fetching token for channel:', channelName);

    const res = await fetch('/.netlify/functions/agora-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName, uid: 0 }),
    });

    const responseText = await res.text();

    if (!res.ok) {
        _tokenStatus = 'failed';
        throw new Error(`Token fetch failed (${res.status}): ${responseText.substring(0, 300)}`);
    }

    // Guard against the dev server returning the SPA index.html with a 200 status
    let data: { token: string };
    try {
        data = JSON.parse(responseText);
    } catch {
        _tokenStatus = 'failed';
        console.error('[AgoraVoice] Token endpoint returned non-JSON. First 300 chars:', responseText.substring(0, 300));
        throw new Error(
            `Token endpoint returned HTML/non-JSON (${res.status}). ` +
            `Make sure the Netlify dev server is running: "netlify dev" instead of "expo start --web".`
        );
    }

    const { token } = data;
    _tokenStatus = 'ok';
    console.log('[AgoraVoice] ✓ Token fetched — length:', token.length);
    return token;
};

/* ─── Service ─── */
export const AgoraVoice: AgoraVoiceService = {
    joinChannel: async (
        sessionId: string,
        onSpeakerActive: (isLocal: boolean, isRemote: boolean) => void,
    ) => {
        _agoraState = 'connecting';
        _lastError = null;
        _remoteVideoActive = false;

        try {
            /* ── Step 1: getUserMedia — browser permission gate ── */
            console.log('[AgoraVoice] Step 1 — Requesting camera + mic via getUserMedia...');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                // Release immediately — Agora re-acquires its own streams
                stream.getTracks().forEach(t => t.stop());
                console.log('[AgoraVoice] ✓ Browser permissions granted');
            } catch (permErr: any) {
                _cameraStatus = 'denied';
                _agoraState = 'error';
                _lastError = permErr.message;
                console.error('[AgoraVoice] ✗ Permission denied:', permErr.name, permErr.message);
                throw new Error(
                    permErr.name === 'NotFoundError'
                        ? 'No camera or microphone found on this device.'
                        : 'Camera and microphone access was denied. Click the camera icon in your address bar to allow access, then refresh.',
                );
            }

            /* ── Step 2: Token ── */
            console.log('[AgoraVoice] Step 2 — Fetching Agora token...');
            const token = await fetchToken(sessionId);

            /* ── Step 3: Create client and register events ── */
            console.log('[AgoraVoice] Step 3 — Creating Agora RTC client...');
            AgoraRTC.setLogLevel(4); // silent
            const _client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' }) as IAgoraRTCClient;
            client = _client;

            _client.on('user-published', async (user, mediaType) => {
                console.log('[AgoraVoice] Remote user published:', user.uid, mediaType);
                await _client.subscribe(user, mediaType);

                if (mediaType === 'audio') {
                    user.audioTrack?.play();
                    console.log('[AgoraVoice] ✓ Remote audio playing');
                }

                if (mediaType === 'video' && user.videoTrack) {
                    _remoteVideoActive = true;
                    // Play remote video into the #remote-video div in the DOM
                    user.videoTrack.play('remote-video');
                    console.log('[AgoraVoice] ✓ Remote video playing → #remote-video (UID:', user.uid, ')');
                }
            });

            _client.on('user-unpublished', (user, mediaType) => {
                console.log('[AgoraVoice] Remote user unpublished:', user.uid, mediaType);
                if (mediaType === 'video') {
                    _remoteVideoActive = false;
                    console.log('[AgoraVoice] Remote video stopped');
                }
            });

            _client.on('user-left', (user) => {
                console.log('[AgoraVoice] Remote user left:', user.uid);
                _remoteVideoActive = false;
            });

            /* ── Step 4: Join ── */
            console.log('[AgoraVoice] Step 4 — Joining channel:', sessionId);
            await _client.join(AGORA_APP_ID, sessionId, token, null);
            console.log('[AgoraVoice] ✓ Joined. Local UID:', _client.uid);

            /* ── Step 5: Create tracks ── */
            console.log('[AgoraVoice] Step 5 — Creating microphone + camera tracks...');
            const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
            localAudioTrack = audioTrack;
            localVideoTrack = videoTrack;
            
            // Play local video directly into DOM element
            setTimeout(() => {
                const el = document.getElementById('local-video');
                if (el) {
                    videoTrack.play('local-video');
                    console.log('[AgoraVoice] ✓ Local camera playing in #local-video');
                } else {
                    console.warn('[AgoraVoice] #local-video not found in DOM yet.');
                }
            }, 100);

            _cameraStatus = 'on';
            console.log('[AgoraVoice] ✓ Tracks created — audio:', !!audioTrack, '| video:', !!videoTrack);

            /* ── Local volume polling (for display meter + speaker detection) ── */
            _localVolumeInterval = setInterval(() => {
                if (!localAudioTrack) return;
                const level = Math.round(localAudioTrack.getVolumeLevel() * 100);
                _localVolumeLevel = level;
                console.log('[MyVolume]', level);
                if (level > 25) {
                    console.log('[ActiveSpeaker] ME is speaking — UID:', _client.uid);
                }
            }, 200);

            /* ── Step 6: Publish ── */
            console.log('[AgoraVoice] Step 6 — Publishing tracks...');
            await _client.publish([audioTrack, videoTrack]);
            console.log('[AgoraVoice] ✓ Tracks published. Camera is LIVE.');

            _agoraState = 'connected';

            /* ── Volume indicator (remote + local via Agora event) ── */
            _client.enableAudioVolumeIndicator();
            _client.on('volume-indicator', (volumes) => {
                console.log('[Volume]', volumes.map(v => ({ uid: v.uid, level: v.level })));
                let localSpeaking = false;
                let remoteSpeaking = false;
                volumes.forEach((v) => {
                    if (v.level > 5) {
                        if (v.uid === _client.uid) localSpeaking = true;
                        else remoteSpeaking = true;
                    }
                });
                onSpeakerActive(localSpeaking, remoteSpeaking);
            });

        } catch (err: any) {
            _agoraState = 'error';
            _lastError = err?.message ?? 'Unknown error';
            console.error('[AgoraVoice] ✗ joinChannel failed:', err);
            throw err; // re-throw so the screen can show it
        }
    },

    leaveChannel: async () => {
        console.log('[AgoraVoice] Leaving channel...');
        if (_localVolumeInterval) { clearInterval(_localVolumeInterval); _localVolumeInterval = null; }
        _localVolumeLevel = 0;
        if (localVideoTrack) { localVideoTrack.stop(); localVideoTrack.close(); localVideoTrack = null; }
        if (localAudioTrack) { localAudioTrack.stop(); localAudioTrack.close(); localAudioTrack = null; }
        if (client) { client.removeAllListeners(); await client.leave().catch(() => {}); client = null; }
        _agoraState = 'idle';
        _cameraStatus = 'idle';
        _tokenStatus = 'idle';
        _remoteVideoActive = false;
        _lastError = null;
        console.log('[AgoraVoice] ✓ Left channel, all tracks released.');
    },

    toggleMute: async (muted: boolean) => {
        if (localAudioTrack) {
            await localAudioTrack.setMuted(muted);
            console.log('[AgoraVoice] Mic muted:', muted);
        }
    },
};
