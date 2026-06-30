import { Platform } from 'react-native';

/**
 * Whether frosted-glass BlurView should be used.
 *
 * expo-blur supports iOS, Android and web (via backdrop-filter), but blur is
 * expensive on low-end Android and is the first thing we drop. Surfaces fall
 * back to a near-solid translucent fill (Glass.solidFallback) when this is off.
 *
 * Override globally at app start (e.g. after a device-tier check):
 *   setBlurEnabled(false)
 */
let blurEnabled = true;

export function setBlurEnabled(value: boolean) {
  blurEnabled = value;
}

export function isBlurEnabled(): boolean {
  // Android < 31 has no native window-blur; expo-blur emulates it but it can be
  // janky on cheap hardware. Keep it on by default and let callers disable it.
  if (Platform.OS === 'web') return blurEnabled;
  return blurEnabled;
}
