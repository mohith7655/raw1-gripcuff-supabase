import { Platform } from 'react-native';

export type CastPlatform = 'chromecast' | 'airplay';

export type CastPlayerState = 'IDLE' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'LOADING';

export interface CastVideoMedia {
  type: 'video';
  url: string;
  title?: string;
  thumbnailUrl?: string;
  /** 'video/mp4' | 'application/x-mpegURL' for HLS */
  contentType?: string;
  /** Resume position in seconds */
  startTime?: number;
}

export interface CastAgoraMedia {
  type: 'agora';
  channelName: string;
  token: string;
  appId: string;
  uid: number;
  /**
   * Full URL of the hosted Cast Receiver page that loads the Agora Web SDK.
   * e.g. https://raw1.us/cast-receiver/index.html
   */
  receiverUrl: string;
}

export type CastMedia = CastVideoMedia | CastAgoraMedia;

export interface CastMediaStatus {
  positionSeconds: number;
  durationSeconds: number;
  playerState: CastPlayerState;
}

export interface CastState {
  isAvailable: boolean;
  isConnected: boolean;
  isCasting: boolean;
  deviceName: string | null;
  platform: CastPlatform | null;
  mediaStatus: CastMediaStatus | null;
  error: string | null;
}

export const CAST_INITIAL_STATE: CastState = {
  isAvailable: false,
  isConnected: false,
  isCasting: false,
  deviceName: null,
  platform: null,
  mediaStatus: null,
  error: null,
};

/** Custom Cast message namespace for Agora channel credentials */
export const AGORA_CAST_NAMESPACE = 'urn:x-cast:com.raw1.agora';

/**
 * Default Google Cast receiver — supports plain HTTP/HLS video URLs.
 * Use this for Firebase VOD casting.
 */
export const DEFAULT_CAST_APP_ID = 'CC1AD845';

/**
 * Custom Cast receiver App ID registered at https://cast.google.com/publish.
 * Required for Agora live-call casting (loads your cast-receiver/index.html).
 * Set EXPO_PUBLIC_CAST_APP_ID in .env to override; falls back to default
 * receiver which only supports VOD (Agora messages will be silently ignored
 * by the default receiver until you register a custom one).
 */
export const CUSTOM_CAST_APP_ID: string =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_CAST_APP_ID) ||
  DEFAULT_CAST_APP_ID;

/** URL where cast-receiver/index.html is hosted (Firebase Hosting recommended) */
export const CAST_RECEIVER_URL: string =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_CAST_RECEIVER_URL) ||
  'https://raw1.us/cast-receiver/';
