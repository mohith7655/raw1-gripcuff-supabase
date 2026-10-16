import React from 'react';
import { Animated } from 'react-native';
import { useTabBarVisibility, HIDE_OFFSET } from '../providers/TabBarVisibilityContext';

// Resting spot sits just above the floating pill nav (~88px tall incl. padding).
const BOTTOM = 96;
// When the nav slides away, drop this much so the pill settles near the screen
// edge instead of floating mid-air.
const DROP = 72;

/**
 * Always-visible floating dock for a screen's segmented toggle. Centered above
 * the bottom nav and tracks the nav's auto-hide, so it never overlaps it.
 * Place it as the last child of a full-height (non bottom-insetted) container.
 */
export function FloatingAboveTabBar({ children }: { children: React.ReactNode }) {
  const tabBar = useTabBarVisibility();
  const translateY = tabBar?.translateY.interpolate({
    inputRange: [0, HIDE_OFFSET],
    outputRange: [0, DROP],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: BOTTOM,
        alignItems: 'center',
        zIndex: 90,
        transform: translateY ? [{ translateY }] : undefined,
      }}
    >
      {children}
    </Animated.View>
  );
}
