/**
 * AgoraVideoHelper.web.ts — web bridge
 *
 * Re-exports the video track getter and debug info from AgoraVoice.web.ts.
 * Metro auto-selects this file on web; AgoraVideoHelper.ts is used on native.
 */

export { getLocalVideoTrack, getAgoraDebugInfo, getAgoraClient, getLocalAudioTrack, getLocalVolumeLevel } from './AgoraVoice.web';
