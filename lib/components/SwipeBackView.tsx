/**
 * SwipeBackView — drag-down-to-go-back wrapper for stacked screens.
 *
 * A clear downward drag slides the screen down and, past a threshold, navigates
 * back — or Home when there's nothing to go back to. It never fights scrolling:
 *   • Native — the drag must START in the top (header) zone.
 *   • Web — the drag can start anywhere, but only takes over when the scroll
 *     container under the finger is already at the top (otherwise it scrolls).
 *
 * Applied centrally via the stack group's `screenLayout` prop (see App.tsx) so
 * every stacked screen gets the gesture without per-screen wiring.
 *
 * Two code paths:
 *   • Native — a PanResponder, with capture handlers so it can take the drag
 *     away from an inner ScrollView.
 *   • Web — real DOM pointer/touch listeners. On web a vertical drag inside a
 *     scrollable <div> is consumed by the browser's native scroll and NEVER
 *     reaches RN's responder system, so PanResponder can't see it over content.
 *     The DOM listeners sidestep that, and `useIsFocused` makes sure only the
 *     visible screen reacts (lower stacked screens stay mounted on web).
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, PanResponder, Platform, StyleSheet } from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';

const { height: SCREEN_H } = Dimensions.get('window');
// Drag must begin within this many px of the top (covers the safe-area + header).
const TOP_ZONE = 160;
// Release past this drag distance (or a fast flick) commits the back navigation.
const DISMISS_DISTANCE = 110;
const isWeb = Platform.OS === 'web';
// Web can't use the native animation driver for transforms.
const useNative = !isWeb;

export function SwipeBackView({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused();
  const dragY = useRef(new Animated.Value(0)).current;

  const goBack = () => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('HomeTabs');
  };
  const settle = () =>
    Animated.spring(dragY, { toValue: 0, bounciness: 2, useNativeDriver: useNative }).start();
  const commit = () =>
    Animated.timing(dragY, { toValue: SCREEN_H, duration: 220, useNativeDriver: useNative }).start(goBack);

  // ── Native: PanResponder ───────────────────────────────────────────────────
  // Claim only a clear downward drag that BEGINS in the top zone. The same test
  // runs in the capture phase so we can take the responder from an inner
  // ScrollView that would otherwise swallow the drag.
  const shouldClaim = (e: any, g: any) => {
    const startY = (e.nativeEvent.pageY ?? 0) - g.dy;
    return startY < TOP_ZONE && g.dy > 10 && g.dy > Math.abs(g.dx) * 1.4;
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: shouldClaim,
      onMoveShouldSetPanResponderCapture: shouldClaim,
      onPanResponderMove: (_, g) => { if (g.dy > 0) dragY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DISMISS_DISTANCE || g.vy > 0.7) commit();
        else settle();
      },
      onPanResponderTerminate: settle,
    }),
  ).current;

  // Reset any in-progress drag offset when this screen loses focus.
  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;
  useEffect(() => { if (!isFocused) dragY.setValue(0); }, [isFocused, dragY]);

  // ── Web: DOM pointer + touch listeners ─────────────────────────────────────
  // A downward, mostly-vertical drag goes back — but ONLY when the scroll
  // container under the finger is already at the top. That makes it work from
  // anywhere on the screen (not just a narrow header strip) while never fighting
  // scrolling: scrolled-down content just scrolls up as usual.
  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;

    let startX = 0, startY = 0, lastY = 0, lastT = 0, vy = 0;
    let down = false, claimed = false, mouse = false;
    let scroller: HTMLElement | null = null;
    let lastTouchAt = 0;

    // Nearest vertically-scrollable ancestor of the touched node (skips
    // horizontal-only scrollers like the hobby/goal chip rows).
    const findScroller = (node: any): HTMLElement | null => {
      let el: HTMLElement | null = node as HTMLElement;
      while (el && el !== document.body && el !== document.documentElement) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1) return el;
        el = el.parentElement;
      }
      return null;
    };

    const begin = (x: number, y: number, target: any, isMouse: boolean) => {
      if (!focusedRef.current) return;
      down = true; claimed = false; mouse = isMouse;
      startX = x; startY = lastY = y; lastT = Date.now(); vy = 0;
      scroller = findScroller(target);
    };

    // Returns true once the gesture is (or stays) claimed — caller then
    // preventDefault()s to keep the browser from scrolling.
    const evaluate = (x: number, y: number): boolean => {
      const now = Date.now();
      if (now > lastT) vy = (y - lastY) / (now - lastT);
      lastY = y; lastT = now;
      if (claimed) { dragY.setValue(Math.max(0, y - startY)); return true; }
      const dx = x - startX, dy = y - startY;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      if (adx < 8 && ady < 8) return false;            // too small to judge yet
      if (adx > ady || dy < 0) { down = false; return false; } // horizontal / up → scroll
      if (scroller && scroller.scrollTop > 0) { down = false; return false; } // not at top
      claimed = true;
      dragY.setValue(Math.max(0, dy));
      return true;
    };

    const finish = () => {
      if (claimed) {
        const dy = lastY - startY;
        if (dy > DISMISS_DISTANCE || vy > 0.5) commit();
        else settle();
      }
      down = claimed = false; scroller = null;
    };

    // ── Touch (real devices + DevTools touch emulation) ──
    // touchmove is non-passive so preventDefault() can beat the browser's own
    // vertical pan — the reason the pointer-based version got cancelled.
    const onTouchStart = (e: TouchEvent) => {
      lastTouchAt = Date.now();
      const t = e.touches[0]; if (!t) return;
      begin(t.clientX, t.clientY, e.target, false);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!down || mouse) return;
      const t = e.touches[0]; if (!t) return;
      if (evaluate(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
    };
    const onTouchEnd = () => { if (!mouse) finish(); };

    // ── Mouse (desktop) ──  (mouse drags don't scroll, so no scroll conflict)
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (Date.now() - lastTouchAt < 600) return; // ignore synthetic post-touch mouse
      begin(e.clientX, e.clientY, e.target, true);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!down || !mouse) return;
      if (evaluate(e.clientX, e.clientY)) e.preventDefault();
    };
    const onMouseUp = () => { if (mouse) finish(); };

    // Block native image-drag / text-selection mid-gesture so it can't steal
    // the pointer before we claim.
    const onDragStart = (e: Event) => { if (down) e.preventDefault(); };
    const onSelectStart = (e: Event) => { if (down && claimed) e.preventDefault(); };

    window.addEventListener('touchstart', onTouchStart, { passive: false, capture: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    window.addEventListener('touchend', onTouchEnd, true);
    window.addEventListener('touchcancel', onTouchEnd, true);
    window.addEventListener('mousedown', onMouseDown, true);
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);
    window.addEventListener('dragstart', onDragStart, true);
    window.addEventListener('selectstart', onSelectStart, true);
    return () => {
      window.removeEventListener('touchstart', onTouchStart, true);
      window.removeEventListener('touchmove', onTouchMove, true);
      window.removeEventListener('touchend', onTouchEnd, true);
      window.removeEventListener('touchcancel', onTouchEnd, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', onMouseUp, true);
      window.removeEventListener('dragstart', onDragStart, true);
      window.removeEventListener('selectstart', onSelectStart, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[styles.fill, { transform: [{ translateY: dragY }] }]}
      {...(isWeb ? {} : pan.panHandlers)}
    >
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
