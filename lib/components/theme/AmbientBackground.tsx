/**
 * AmbientBackground — frosted "Liquid Glass" ambient backdrop (One UI 8.5).
 *
 * Wraps a screen so the glass surfaces have colour to refract:
 *   1. a base diagonal LinearGradient (~165°): #EEEDF6 → #E2E3F0 → #E8EAF6.
 *   2. four corner glows, anchored at the spec positions and fading to
 *      transparent at the spec falloff. These use expo-linear-gradient (which
 *      renders reliably on web — react-native-svg RadialGradient does NOT, and
 *      left the top-right corner bare-white):
 *        • orange  top-left   14%/4%   → transparent ~38%   (0.20)
 *        • indigo  top-right  92%/16%  → transparent ~44%   (0.26)
 *        • orange  left        8%/60%  → transparent ~40%   (0.10)
 *        • indigo  bottom-ctr 50%/110% → transparent ~52%   (0.20)
 *
 * It is OPAQUE, so stacked navigator screens never bleed through. Wrap a screen
 * body and give children transparent backgrounds so the mesh shows through.
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

const T_ORANGE = 'rgba(242,89,18,0)';
const T_INDIGO = 'rgba(76,78,120,0)';

export function AmbientBackground({ children, style, glows = true }: AmbientBackgroundProps) {
  return (
    <View style={[styles.root, style]}>
      {/* Base diagonal gradient (~165°). */}
      <LinearGradient
        colors={Glass.ambientBase as unknown as string[]}
        start={{ x: 0.35, y: 0 }}
        end={{ x: 0.65, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {glows && (
        <>
          {/* Orange glow — anchored top-left (14%/4%), fading toward centre. */}
          <LinearGradient
            colors={[Glass.glowOrangeTL, T_ORANGE]}
            locations={[0, 0.45]}
            start={{ x: 0.14, y: 0.04 }}
            end={{ x: 0.7, y: 0.6 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Indigo glow — anchored top-right (92%/16%); kills the bare-white corner. */}
          <LinearGradient
            colors={[Glass.glowIndigoTR, T_INDIGO]}
            locations={[0, 0.5]}
            start={{ x: 0.92, y: 0.1 }}
            end={{ x: 0.3, y: 0.62 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Soft orange — left edge (8%/60%). */}
          <LinearGradient
            colors={[Glass.glowOrangeL, T_ORANGE]}
            locations={[0, 0.42]}
            start={{ x: 0.04, y: 0.6 }}
            end={{ x: 0.6, y: 0.62 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Indigo glow — rising from bottom-centre (50%/110%). */}
          <LinearGradient
            colors={[T_INDIGO, Glass.glowIndigoBC]}
            locations={[0.48, 1]}
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
