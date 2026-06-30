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

/**
 * Frosted blur layer — the actual glass refraction.
 *  • web    → real CSS `backdrop-filter: blur(34px) saturate(1.9)` (what the
 *             reference uses; expo-blur's web path renders only a flat tint).
 *  • native → expo-blur BlurView.
 *  • blur off (low-end) → opaque solid fallback for legibility.
 */
function GlassBlurLayer({ intensity, enabled }: { intensity: number; enabled: boolean }) {
  if (!enabled) {
    return (
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: Glass.solidFallback }]}
        pointerEvents="none"
      />
    );
  }
  if (Platform.OS === 'web') {
    const css = `blur(${intensity}px) saturate(1.9)`;
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backdropFilter: css, WebkitBackdropFilter: css } as any]}
      />
    );
  }
  return (
    <BlurView intensity={intensity} tint={Glass.blurTint} style={StyleSheet.absoluteFill} pointerEvents="none" />
  );
}

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
  fill = 'transparent',
  border = true,
  highlight = true,
  shadow = true,
  solid = false,
  pointerEvents,
}: GlassSurfaceProps) {
  const useBlur = !solid && isBlurEnabled();
  // Optional extra tint over the material (e.g. fillStrong for the floating nav
  // so it stays legible over busy content). Default is none.
  const tint = fill && fill !== 'transparent' ? fill : null;

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
        <GlassBlurLayer intensity={intensity} enabled={useBlur} />
        {/* Optional opacity tint (nav bar etc.). */}
        {tint && (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" />
        )}
        {/* Diagonal (150°) translucent sheen — the glass material. */}
        <LinearGradient
          colors={Glass.sheen as unknown as string[]}
          locations={Glass.sheenLocations as unknown as number[]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        {/* Faint inner rim — the second glass edge, inset 1px. */}
        {highlight && (
          <View
            style={[styles.innerRim, { borderRadius: Math.max(0, radius - 1) }]}
            pointerEvents="none"
          />
        )}
        {/* Bright 1.5px top specular highlight. */}
        {highlight && (
          <View
            style={[styles.highlight, { borderTopLeftRadius: radius, borderTopRightRadius: radius }]}
            pointerEvents="none"
          />
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
 * GlassSheen — drop-in FULL glass material for an existing card View. Add it as
 * the FIRST child of a card whose `backgroundColor` is 'transparent' (so the
 * blur can refract the AmbientBackground behind it) and that has a luminous
 * border + soft shadow + matching borderRadius. It paints: BlurView (or a solid
 * fallback when blur is off) → diagonal sheen → inner rim → top specular line.
 * Content rendered after it stays crisp on top. No layout impact.
 *
 *   <View style={styles.card}>        // styles.card.backgroundColor = 'transparent'
 *     <GlassSheen radius={20} />
 *     …card content…
 *   </View>
 */
export function GlassSheen({
  radius = 20,
  intensity = Glass.blurIntensity,
  edge = false,
  style,
}: {
  radius?: number;
  intensity?: number;
  /** Paint the luminous inner rim + top specular line (off by default). */
  edge?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const useBlur = isBlurEnabled();
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }, style]}
    >
      <GlassBlurLayer intensity={intensity} enabled={useBlur} />
      <LinearGradient
        colors={Glass.sheen as unknown as string[]}
        locations={Glass.sheenLocations as unknown as number[]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {edge && <View style={[styles.innerRim, { borderRadius: Math.max(0, radius - 1) }]} />}
      {edge && <View style={styles.highlight} />}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    // iOS needs a backing layer for the clip; the fill view supplies color.
    backgroundColor: Platform.OS === 'android' ? 'transparent' : undefined,
  },
  innerRim: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    borderWidth: 1,
    borderColor: Glass.innerRim,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1.5,
    backgroundColor: Glass.highlight,
  },
});

export default GlassCard;
