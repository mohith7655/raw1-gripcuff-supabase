/**
 * AmbientBackground — soft "ambient mesh" screen backdrop for the Glass UI.
 *
 * Replaces a screen's flat #EEEEF2 canvas fill so the frosted-glass surfaces
 * (<GlassCard> etc.) have something to refract. It layers expo-linear-gradient
 * views (chosen over react-native-svg radial gradients because SVG radials do
 * not render reliably on react-native-web — they left the top-right corner a
 * bare near-white patch):
 *   1. a base diagonal gradient, warm cream top-left → soft lilac → cool
 *   2. a warm peach glow fading in from the top-left
 *   3. an indigo glow fading in from the top-right (so that corner is never
 *      bare white)
 *   4. a faint indigo glow rising from the bottom-center
 *
 * Usage — wrap a screen body (it fills its parent, so give it flex:1). It is
 * OPAQUE, so stacked navigator screens never bleed through it:
 *
 *   <AmbientBackground>
 *     <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>…</SafeAreaView>
 *   </AmbientBackground>
 *
 * Children should use transparent backgrounds so the mesh shows through.
 */
import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Glass } from '../../core/theme/app_theme';

interface AmbientBackgroundProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Hide the corner glows and keep just the base gradient. */
  glows?: boolean;
}

export function AmbientBackground({ children, style, glows = true }: AmbientBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      {/* Base diagonal gradient — warm cream (top-left) → soft lilac → cool. */}
      <LinearGradient
        colors={['#F6EFE9', '#EEEBF4', '#E7E9F3']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {glows && (
        <>
          {/* Warm peach glow fading in from the top-left. */}
          <LinearGradient
            colors={[Glass.glowOrange, 'rgba(243,150,95,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.85, y: 0.7 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Indigo glow fading in from the top-right (kills the bare-white corner). */}
          <LinearGradient
            colors={[Glass.glowIndigo, 'rgba(108,108,168,0)']}
            start={{ x: 1, y: 0 }}
            end={{ x: 0.1, y: 0.7 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Faint indigo rising from the bottom-center. */}
          <LinearGradient
            colors={['rgba(108,108,168,0)', Glass.glowIndigoSoft]}
            start={{ x: 0.5, y: 0.45 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      )}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Glass.ambientFallback,
  },
});

export default AmbientBackground;
