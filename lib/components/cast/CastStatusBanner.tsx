import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Tv2, X } from 'lucide-react-native';
import { useCast } from '../../hooks/useCast';

interface CastStatusBannerProps {
  /** Override device name shown in the banner */
  deviceName?: string;
  /** Called when user taps the X button; defaults to endSession() */
  onStopPress?: () => void;
  /** Pass true to show even when isCasting is false (e.g. AirPlay active) */
  forceVisible?: boolean;
}

/**
 * Pill-shaped banner shown on top of the player/call screen that reads
 * "Casting to [Device Name]". Tapping the X ends the cast session.
 *
 * Renders nothing on web or when no session is active.
 */
export function CastStatusBanner({
  deviceName: overrideName,
  onStopPress,
  forceVisible = false,
}: CastStatusBannerProps) {
  const { isCasting, deviceName: sessionDevice, endSession } = useCast();

  if (Platform.OS === 'web') return null;
  if (!isCasting && !forceVisible) return null;

  const label = overrideName ?? sessionDevice ?? 'TV';

  const handleStop = () => {
    if (onStopPress) {
      onStopPress();
    } else {
      endSession();
    }
  };

  return (
    <View style={styles.banner}>
      <Tv2 color="#4FC3F7" size={14} />
      <Text style={styles.text} numberOfLines={1}>
        Casting to {label}
      </Text>
      <TouchableOpacity
        onPress={handleStop}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <X color="rgba(255,255,255,0.55)" size={13} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: 'rgba(8,24,42,0.92)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.35)',
    // Ensure banner floats above other content when used absolutely
    elevation: 4,
    boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    maxWidth: 180,
  },
});
