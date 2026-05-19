/**
 * Native implementation of useCast (iOS + Android).
 *
 * Uses react-native-google-cast v4.9.1 APIs:
 *  - useCastSession()          → CastSession | null  (has .client, .addChannel)
 *  - useCastDevice()           → Device | null       (has .friendlyName)
 *  - useMediaStatus()          → MediaStatus | null  (playerState, streamDuration)
 *  - useStreamPosition(1000)   → number | null       (position in seconds)
 *  - useCastState()            → CastState enum | null
 *
 * Key API corrections vs. first draft:
 *  - session.device?.friendlyName    WRONG → use useCastDevice()
 *  - session.sendMessage(ns, msg)    WRONG → session.addChannel(ns) → channel.sendMessage(msg)
 *  - session.endSession(true)        WRONG → CastContext.sessionManager.endCurrentSession(true)
 *  - GoogleCast.configure(...)       WRONG → not available in v4.9.1 (handled by Expo plugin)
 *  - GoogleCast.showCastPicker()     WRONG → CastContext.showCastDialog()
 */
import { useCallback, useEffect } from 'react';
import {
  CastContext,
  CastState as CastStateEnum,
  MediaPlayerState,
  MediaStreamType,
  useCastDevice,
  useCastSession,
  useCastState,
  useMediaStatus,
  useStreamPosition,
} from 'react-native-google-cast';
import { CastManager } from '../services/cast/castManager';
import {
  AGORA_CAST_NAMESPACE,
  CastAgoraMedia,
  CastVideoMedia,
} from '../services/cast/types';

export function useCast() {
  const session = useCastSession();
  const device = useCastDevice();
  const mediaStatus = useMediaStatus();
  const position = useStreamPosition(1000);
  const castState = useCastState();

  const isConnected = session != null;
  const isAvailable =
    castState != null && castState !== CastStateEnum.NO_DEVICES_AVAILABLE;
  const deviceName: string | null = device?.friendlyName ?? null;

  const playerState = mediaStatus?.playerState ?? null;
  const isPlaying =
    playerState === MediaPlayerState.PLAYING ||
    playerState === MediaPlayerState.BUFFERING;
  const durationSeconds: number = mediaStatus?.mediaInfo?.streamDuration ?? 0;
  const positionSeconds: number = position ?? 0;

  // Keep CastManager singleton in sync so non-hook code can read state
  useEffect(() => {
    CastManager._setState({
      isAvailable,
      isConnected,
      isCasting: isConnected,
      deviceName,
      platform: isConnected ? 'chromecast' : null,
      error: null,
      mediaStatus: isConnected
        ? {
            positionSeconds,
            durationSeconds,
            playerState: (playerState as string | null) as any,
          }
        : null,
    });
  }, [isAvailable, isConnected, deviceName, positionSeconds, durationSeconds, playerState]);

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Cast a Firebase Storage (or any HTTP/HLS) URL to the connected Chromecast.
   * Call showPicker() first if no session is open.
   */
  const castVideo = useCallback(
    async (media: CastVideoMedia) => {
      const client = session?.client;
      if (!client) {
        console.warn('[useCast] castVideo: no session — open picker first');
        return;
      }
      try {
        await client.loadMedia({
          mediaInfo: {
            contentUrl: media.url,
            contentType: media.contentType ?? 'video/mp4',
            streamType: MediaStreamType.BUFFERED,
            ...(media.title || media.thumbnailUrl
              ? {
                  metadata: {
                    type: 'movie' as const,
                    ...(media.title ? { title: media.title } : {}),
                    ...(media.thumbnailUrl
                      ? {
                          images: [
                            { url: media.thumbnailUrl, width: 480, height: 270 },
                          ],
                        }
                      : {}),
                  },
                }
              : {}),
          },
          startTime: media.startTime ?? 0,
          autoplay: true,
        });
      } catch (err: any) {
        console.error('[useCast] castVideo failed:', err);
        CastManager._setState({ error: err?.message ?? 'Failed to cast video' });
      }
    },
    [session],
  );

  /**
   * Cast an active Agora call to Chromecast.
   *
   * Flow:
   *  1. Open a custom channel on the Cast session (urn:x-cast:com.raw1.agora).
   *  2. Send JOIN_CHANNEL message with Agora credentials.
   *  3. cast-receiver/index.html receives it, loads Agora Web SDK, and joins
   *     the channel as an audience viewer — rendering the remote video fullscreen.
   *
   * Fallback: if addChannel fails (e.g. default receiver ignores custom
   * namespaces), we load the receiver URL with credentials as query params.
   * This only works when EXPO_PUBLIC_CAST_APP_ID points to a registered
   * custom receiver.
   */
  const castAgora = useCallback(
    async (media: CastAgoraMedia) => {
      if (!session) {
        console.warn('[useCast] castAgora: no session — open picker first');
        return;
      }
      try {
        const channel = await session.addChannel(AGORA_CAST_NAMESPACE);
        await channel.sendMessage({
          type: 'JOIN_CHANNEL',
          channelName: media.channelName,
          token: media.token,
          appId: media.appId,
          uid: media.uid,
        });
      } catch (msgErr) {
        console.warn('[useCast] addChannel/sendMessage failed, trying URL fallback:', msgErr);
        const client = session?.client;
        if (client) {
          const params = new URLSearchParams({
            channel: media.channelName,
            token: media.token,
            appId: media.appId,
            uid: String(media.uid),
          });
          try {
            await client.loadMedia({
              mediaInfo: {
                contentUrl: `${media.receiverUrl}?${params.toString()}`,
                contentType: 'text/html',
              },
            });
          } catch (fallbackErr) {
            console.error('[useCast] castAgora fallback failed:', fallbackErr);
            CastManager._setState({
              error:
                'Agora cast failed — register a Custom Cast App ID (see cast-receiver/deploy.sh)',
            });
          }
        }
      }
    },
    [session],
  );

  const play = useCallback(async () => {
    try { await session?.client.play(); } catch {}
  }, [session]);

  const pause = useCallback(async () => {
    try { await session?.client.pause(); } catch {}
  }, [session]);

  const seekTo = useCallback(async (seconds: number) => {
    try { await session?.client.seek({ position: Math.max(0, seconds) }); } catch {}
  }, [session]);

  const seekRelative = useCallback(
    async (deltaSec: number) => {
      try {
        await session?.client.seek({
          position: Math.max(0, positionSeconds + deltaSec),
        });
      } catch {}
    },
    [session, positionSeconds],
  );

  const setVolume = useCallback(async (level: number) => {
    try { await session?.client.setStreamVolume(Math.max(0, Math.min(1, level))); } catch {}
  }, [session]);

  const endSession = useCallback(async () => {
    try {
      // v4.9.1: CastContext.sessionManager.endCurrentSession(stopCasting)
      await CastContext.sessionManager.endCurrentSession(true);
    } catch (err) {
      console.warn('[useCast] endCurrentSession failed:', err);
    }
  }, []);

  const showPicker = useCallback(() => {
    CastManager.showPicker();
  }, []);

  return {
    isAvailable,
    isConnected,
    isCasting: isConnected,
    deviceName,
    positionSeconds,
    durationSeconds,
    isPlaying,
    castVideo,
    castAgora,
    play,
    pause,
    seekTo,
    seekRelative,
    setVolume,
    endSession,
    showPicker,
  };
}
