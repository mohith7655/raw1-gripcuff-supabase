/**
 * GlassCard / GlassSurface / GlassPill — frosted-glass surfaces for the Glass UI.
 *
 * Replaces the old solid card style (#F8F8FC fill + #D8D8E4 1px border) with a
 * translucent blurred surface that refracts the <AmbientBackground> mesh:
 *   • expo-blur <BlurView intensity={22} tint="light"> as the material
 *   • a translucent fill rgba(252,252,255,0.55) over the blur
 *   • a 1px luminous white border rgba(255,255,255,0.75)
 *   • a soft depth shadow (shadowColor #211832, opacity .08, radius 22, y+6;
 *     elevation 4 on Android)
 *   • a bright top specular highlight (a 1px rgba(255,255,255,0.85) inner line)
 *
 * Blur is gated behind isBlurEnabled(); when off, the surface falls back to a
 * near-solid translucent fill so #211832 / #7A7C90 text stays legible.
 *
 *   <GlassCard style={{ marginHorizontal: 16 }}>…</GlassCard>   // card defaults
 *   <GlassSurface radius={14} padding={12}>…</GlassSurface>      // bare surface
 *   <GlassPill>…</GlassPill>                                     // fully-rounded
 *
 * Do NOT use this for primary CTAs (orange #F25912) or indigo action buttons —
 * those stay opaque as the focal accents the glass layers sit against.
 */
import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Glass } from '../../core/theme/app_theme';
import { isBlurEnabled } from './blurSupport';

export interface GlassSurfaceProps {
  children?: React.ReactNode;
  /** Outer style — margins, width, etc. (shadow + radius live here). */
  style?: StyleProp<ViewStyle>;
  /** Inner content padding wrapper style. */
  contentStyle?: StyleProp<ViewStyle>;
  radius?: number;
  /** Inner content padding (ignored if contentStyle sets its own). */
  padding?: number;
  /** BlurView intensity. */
  intensity?: number;
  /** Translucent fill drawn over the blur. */
  fill?: string;
  /** Show the 1px luminous border. */
  border?: boolean;
  /** Show the bright top specular highlight line. */
  highlight?: boolean;
  /** Render the soft depth shadow. */
  shadow?: boolean;
  /** Force the solid fallback (no blur) regardless of global blur setting. */
  solid?: boolean;
  pointerEvents?: ViewStyle['pointerEvents'];
}

export function GlassSurface({
  children,
  style,
  contentStyle,
  radius = Glass.radius,
  padding,
  intensity = Glass.blurIntensity,
  fill = Glass.fill,
  border = true,
  highlight = true,
  shadow = true,
  solid = false,
  pointerEvents,
}: GlassSurfaceProps) {
  const useBlur = !solid && isBlurEnabled();
  // Without blur, lean on a more opaque fill so text contrast survives.
  const fillColor = useBlur ? fill : Glass.solidFallback;

  const shadowStyle: ViewStyle | undefined = shadow
    ? {
        shadowColor: Glass.shadowColor,
        shadowOpacity: Glass.shadowOpacity,
        shadowRadius: Glass.shadowRadius,
        shadowOffset: Glass.shadowOffset,
        elevation: Glass.androidElevation,
      }
    : undefined;

  return (
    // Outer wrapper carries the shadow + radius (no overflow clip, so the shadow
    // shows). Inner wrapper clips the blur/fill to the rounded corners.
    <View pointerEvents={pointerEvents} style={[{ borderRadius: radius }, shadowStyle, style]}>
      <View
        style={[
          styles.clip,
          {
            borderRadius: radius,
            borderWidth: border ? 1 : 0,
            borderColor: Glass.border,
          },
        ]}
      >
        {useBlur && (
          <BlurView
            intensity={intensity}
            tint={Glass.blurTint}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}
        {/* Translucent fill over the blur. */}
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: fillColor }]}
          pointerEvents="none"
        />
        {/* Glossy sheen — light catches the upper third and fades out (the key
            "glass" cue), plus a bright specular line on the very top edge. */}
        {highlight && (
          <>
            <LinearGradient
              colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              locations={[0, 0.55]}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View
              style={[styles.highlight, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
              pointerEvents="none"
            />
          </>
        )}
        <View style={[padding != null ? { padding } : null, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

/** Frosted card — drop-in replacement for the old #F8F8FC card style. */
export function GlassCard({ radius = 22, padding = 16, ...rest }: GlassSurfaceProps) {
  return <GlassSurface radius={radius} padding={padding} {...rest} />;
}

/** Fully-rounded glass control — pills, segmented toggles, chips, floating bars. */
export function GlassPill({ radius = 999, ...rest }: GlassSurfaceProps) {
  return <GlassSurface radius={radius} {...rest} />;
}

/**
 * GlassSheen — drop-in glossy overlay for an existing card View. Add it as the
 * FIRST child of any card that already has a translucent fill + soft shadow +
 * matching borderRadius, and it paints the glass sheen (top-third light catch)
 * + a bright specular line on the top edge. Content rendered after it stays
 * crisp on top. No layout impact (absolutely positioned, non-interactive).
 *
 *   <View style={styles.card}>
 *     <GlassSheen radius={20} />
 *     …card content…
 *   </View>
 */
export function GlassSheen({
  radius = 20,
  style,
}: {
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }, style]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.5]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.highlight} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    // iOS needs a backing layer for the clip; the fill view supplies color.
    backgroundColor: Platform.OS === 'android' ? 'transparent' : undefined,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Glass.highlight,
  },
});

export default GlassCard;
