/**
 * Web stub for useCast.
 *
 * React Native Metro bundler resolves platform-specific files in this order:
 *   1. useCast.native.ts  → used on iOS + Android
 *   2. useCast.ts         → used on web (this file)
 *
 * react-native-google-cast is a native-only library and is never loaded in
 * the web bundle. This stub returns no-op values so that web builds compile
 * cleanly and components that reference useCast() just see
 * isAvailable=false / isConnected=false.
 */
import { useCallback } from 'react';
import type { CastVideoMedia, CastAgoraMedia } from '../services/cast/types';

const noop = async () => {};

export function useCast() {
  return {
    isAvailable: false,
    isConnected: false,
    isCasting: false,
    deviceName: null as string | null,
    positionSeconds: 0,
    durationSeconds: 0,
    isPlaying: false,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    castVideo: useCallback((_: CastVideoMedia) => noop(), []),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    castAgora: useCallback((_: CastAgoraMedia) => noop(), []),
    play: useCallback(noop, []),
    pause: useCallback(noop, []),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    seekTo: useCallback((_: number) => noop(), []),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    seekRelative: useCallback((_: number) => noop(), []),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    setVolume: useCallback((_: number) => noop(), []),
    endSession: useCallback(noop, []),
    showPicker: useCallback(() => {}, []),
  };
}
