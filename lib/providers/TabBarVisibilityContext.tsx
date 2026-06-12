/**
 * TabBarVisibilityContext
 *
 * Drives the floating bottom tab bar's show/hide as the user scrolls:
 *   • scroll DOWN  → slide the bar off-screen
 *   • scroll UP    → slide it back into view
 *   • at the very top → always visible
 *
 * The tab bar (PillTabBar) is rendered by the Tab.Navigator, separately from the
 * screens, so a shared context lets each screen's scroll container drive the one
 * animated value the bar reads.
 */

import React, { createContext, useContext, useRef, useCallback, useEffect } from 'react';
import { Animated, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

// Far enough to clear the bar height + bottom padding + safe area.
const HIDE_OFFSET = 130;

type TabBarVisibility = {
  translateY: Animated.Value;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  show: () => void;
};

const TabBarVisibilityContext = createContext<TabBarVisibility | null>(null);

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const visible = useRef(true);
  const lastY = useRef(0);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
    if (visible.current) return;
    visible.current = true;
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 6,
      speed: 14,
    }).start();
  }, [translateY]);

  const hide = useCallback(() => {
    if (!visible.current) return;
    visible.current = false;
    Animated.timing(translateY, {
      toValue: HIDE_OFFSET,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastY.current;
    lastY.current = y;

    // Re-show the bar 500ms after scrolling stops.
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => show(), 500);

    if (y <= 4) { show(); return; }   // pinned visible at the very top
    if (Math.abs(dy) < 6) return;     // ignore micro-jitter / bounce
    if (dy > 0) hide();               // scrolling down
    else show();                      // scrolling up
  }, [hide, show]);

  useEffect(() => () => { if (idleTimer.current) clearTimeout(idleTimer.current); }, []);

  return (
    <TabBarVisibilityContext.Provider value={{ translateY, onScroll, show }}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  return useContext(TabBarVisibilityContext);
}
