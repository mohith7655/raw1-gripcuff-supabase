import React from 'react';
import { Platform, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Tv2 } from 'lucide-react-native';
import { useCast } from '../../hooks/useCast';

interface CastButtonProps {
  /** Icon tint color */
  tintColor?: string;
  /** Icon size in px */
  size?: number;
  /** Extra padding around the touchable */
  hitSlop?: number;
}

/**
 * Renders the native Google Cast button on Android/iOS, which:
 *  - Is hidden when no cast devices are discovered
 *  - Shows a picker when tapped (to connect/disconnect)
 *  - Animates between idle / connecting / active states automatically
 *
 * On web the component renders nothing (casting is unsupported).
 *
 * Drop this into any header or player UI — it self-manages visibility.
 */
export function CastButton({ tintColor = '#fff', size = 24, hitSlop = 8 }: CastButtonProps) {
  const { isAvailable, showPicker } = useCast();

  // Web: no cast support
  if (Platform.OS === 'web') return null;

  // Try to render the native button from react-native-google-cast.
  // Fall back to a lucide icon + manual picker call if the native button
  // is unavailable (e.g. development build before native rebuild).
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CastButton: NativeCastButton } = require('react-native-google-cast');
    return (
      <View style={styles.container}>
        <NativeCastButton
          style={{ width: size + 8, height: size + 8 }}
          tintColor={tintColor}
        />
      </View>
    );
  } catch {
    // Fallback — native module not linked yet
    if (!isAvailable) return null;
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={showPicker}
        hitSlop={{ top: hitSlop, bottom: hitSlop, left: hitSlop, right: hitSlop }}
        activeOpacity={0.7}
      >
        <Tv2 color={tintColor} size={size} />
      </TouchableOpacity>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
