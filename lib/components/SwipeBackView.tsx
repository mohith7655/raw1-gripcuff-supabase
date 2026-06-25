/**
 * SwipeBackView — drag-down-to-go-back wrapper for stacked screens.
 *
 * A clear downward drag that STARTS in the top (header / back-button) zone slides
 * the screen down and, past a threshold, navigates back — or Home when there's
 * nothing to go back to. Restricting the start to the top zone keeps inner
 * ScrollViews / sliders working everywhere else on the screen.
 *
 * Applied centrally via React Navigation's `layout` prop (see App.tsx) so every
 * screen with a back button gets the gesture without per-screen wiring.
 *
 * Uses a single PanResponder for all platforms — react-native-web routes mouse
 * and touch through the same responder system, so the one code path covers
 * native and the web/PWA build (no fragile DOM-node ref needed).
 */
import React, { useRef } from 'react';
import { Animated, Dimensions, PanResponder, Platform, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { height: SCREEN_H } = Dimensions.get('window');
// Drag must begin within this many px of the top (covers the safe-area + header).
const TOP_ZONE = 160;
// Release past this drag distance (or a fast flick) commits the back navigation.
const DISMISS_DISTANCE = 110;
// Web can't use the native animation driver for transforms.
const useNative = Platform.OS !== 'web';

export function SwipeBackView({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const dragY = useRef(new Animated.Value(0)).current;

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('HomeTabs');
  };
  const settle = () =>
    Animated.spring(dragY, { toValue: 0, bounciness: 2, useNativeDriver: useNative }).start();
  const commit = () =>
    Animated.timing(dragY, { toValue: SCREEN_H, duration: 220, useNativeDriver: useNative }).start(goBack);

  const pan = useRef(
    PanResponder.create({
      // Don't claim taps — only a downward drag that begins in the top zone.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (e, g) => {
        const startY = (e.nativeEvent.pageY ?? 0) - g.dy;
        return startY < TOP_ZONE && g.dy > 10 && g.dy > Math.abs(g.dx) * 1.4;
      },
      onPanResponderMove: (_, g) => { if (g.dy > 0) dragY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > 0.7) commit();
        else settle();
      },
      onPanResponderTerminate: settle,
    }),
  ).current;

  return (
    <Animated.View style={[styles.fill, { transform: [{ translateY: dragY }] }]} {...pan.panHandlers}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Transparent so the area revealed while dragging shows the stack's own card
  // background (light app screens, dark auth screens) instead of a fixed colour.
  fill: { flex: 1 },
});

export default SwipeBackView;
