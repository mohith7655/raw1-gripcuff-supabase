// ── Ash & Midnight palette ───────────────────────────────────────────
// Light "washed slate" canvas, deep-indigo text, indigo brand, preserved accent oranges.
//   canvas #EEEEF2 · card #F8F8FC · text #211832 · muted #7A7C90
//   inactive #D8D8E4 · CTA #F25912 · brand #4C4E78
//
// BRAND_ACCENT is the general accent (selected pills/chips, toggles, sliders, text/number
// accents, icons, borders, glows). CTA_ORANGE is reserved ONLY for primary-action buttons
// that commit something (Save, Update, Post, Buy, Start Workout, Send Invite, Challenge…).
// Both resolve to the same accent orange in this palette (#F25912 = rgb 242,89,18).
export const BRAND_ACCENT = '#F25912';
export const CTA_ORANGE = '#F25912';
// Deep-indigo brand color: logo accent, brand chips, badges.
export const BRAND_INDIGO = '#4C4E78';
// Translucent accent for soft backgrounds / borders / glows.
export const accentAlpha = (a: number) => `rgba(242,89,18,${a})`;
// Translucent indigo for soft brand backgrounds / borders.
export const indigoAlpha = (a: number) => `rgba(76,78,120,${a})`;

// ── Glass / Ambient material (One UI 8.5 "Glass UI") ─────────────────────
// Tokens for the frosted-glass surface system. Consumed by <AmbientBackground>
// and <GlassCard>/<GlassSurface>/<GlassPill> in lib/components/theme. The flat
// canvas (#EEEEF2) becomes a soft ambient mesh; solid cards (#F8F8FC + #D8D8E4)
// become translucent blurred surfaces that refract that mesh.
export const Glass = {
  // Surface — bright luminous panel that floats on the ambient mesh. Kept light
  // so cards read as soft white glass, not flat grey.
  fill: 'rgba(255,255,255,0.62)',
  // More opaque fill for controls/rows/nav that need stronger legibility.
  fillStrong: 'rgba(255,255,255,0.78)',
  // Solid fallback fill used when blur is unsupported / disabled (low-end
  // devices). More opaque so #211832 / #7A7C90 text keeps contrast without blur.
  solidFallback: 'rgba(251,250,253,0.96)',
  // Hairline luminous border — barely-there (cards are defined by shadow, not edge).
  border: 'rgba(255,255,255,0.55)',
  // Bright top specular highlight (fakes CSS `inset 0 1px 0 rgba(255,255,255,.9)`).
  highlight: 'rgba(255,255,255,0.9)',
  // Soft, large, diffuse depth shadow so panels float like cushions (warm-tinted).
  shadowColor: '#2A2342',
  shadowOpacity: 0.12,
  shadowRadius: 34,
  shadowOffset: { width: 0, height: 16 },
  androidElevation: 7,
  // Hairline divider — faint deep-indigo line.
  divider: 'rgba(33,24,50,0.06)',
  // Default BlurView intensity / tint.
  blurIntensity: 24,
  blurTint: 'light' as const,
  radius: 22,
  // Ambient mesh — base diagonal gradient (~165°). Warm cream top-left → soft
  // lilac → cool light, so the canvas reads warm + airy (not cold grey). The
  // warmth lives in this gradient (renders reliably on web) with the SVG glows
  // adding focal accents on top.
  ambientBase: ['#F9F5F1', '#F1EEF6', '#E9EAF4'] as const,
  ambientFallback: '#F1EEF5',
  // Radial glow colors for the mesh — warmer + more present than before.
  glowOrange: 'rgba(243,150,95,0.22)',  // warm peach, top-left
  glowIndigo: 'rgba(108,108,168,0.18)', // indigo, top-right
  glowIndigoSoft: 'rgba(108,108,168,0.13)', // indigo, bottom-center
};

// Theme colors and styles — Ash & Midnight (light)
export const AppTheme = {
  // Colors
  background: '#EEEEF2',   // canvas
  cardColor: '#F8F8FC',    // card surface
  primaryColor: '#F25912', // CTA / accent orange
  textWhite: '#211832',    // primary text (deep indigo) — name kept for compatibility
  textGrey: '#7A7C90',     // muted secondary text
  inactiveColor: '#D8D8E4', // borders, empty states

  // Additional colors for UI elements
  metalGray: '#7A7C90',
  silver: '#C8C8D0',
  orange: '#F25912',
  darkBackground: '#E4E4EC',
};

// Premium Theme for Personal Coaching section — Ash & Midnight (light), indigo brand
export const CoachingTheme = {
  background: '#EEEEF2',   // canvas
  darkBg: '#E4E4EC',       // slightly deeper canvas
  cardColor: '#F8F8FC',    // card
  cardDark: '#EEEEF2',     // recessed card
  primaryColor: '#4C4E78',   // brand indigo
  primaryLight: '#6A6CA0',   // lighter indigo
  primaryGlow: 'rgba(76,78,120,0.12)',
  primaryBorder: 'rgba(76,78,120,0.2)',
  textWhite: '#211832',    // primary text
  textGrey: '#7A7C90',     // muted
  textMuted: '#9A9CB0',
  border: 'rgba(76,78,120,0.1)',
  borderStrong: 'rgba(76,78,120,0.2)',
  tabActive: '#4C4E78',
  statCard: '#F8F8FC',
};

export const FontSizes = {
  h1: 28,
  h2: 24,
  h3: 20,
  h4: 18,
  h5: 16,
  body: 14,
  small: 12,
};

export const FontWeights = {
  light: '300' as any,
  regular: '400' as any,
  medium: '500' as any,
  semibold: '600' as any,
  bold: '700' as any,
};

export interface TextStyleProps {
  fontSize: number;
  fontWeight: string;
  color: string;
  lineHeight?: number;
}

export const TextStyles = {
  titleLarge: {
    fontSize: FontSizes.h2,
    fontWeight: FontWeights.bold,
    color: AppTheme.textWhite,
  } as TextStyleProps,

  titleMedium: {
    fontSize: FontSizes.h4,
    fontWeight: FontWeights.semibold,
    color: AppTheme.textWhite,
  } as TextStyleProps,

  subtitle: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.regular,
    color: AppTheme.textGrey,
  } as TextStyleProps,

  bodyMedium: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.medium,
    color: AppTheme.textWhite,
  } as TextStyleProps,

  chipText: {
    fontSize: FontSizes.small,
    fontWeight: FontWeights.semibold,
    color: AppTheme.textWhite,
  } as TextStyleProps,

  buttonText: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.bold,
    color: AppTheme.textWhite,
  } as TextStyleProps,

  bodySmall: {
    fontSize: FontSizes.small,
    fontWeight: FontWeights.regular,
    color: AppTheme.textGrey,
  } as TextStyleProps,
};

// Spacing constants
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radius
export const BorderRadius = {
  small: 8,
  medium: 12,
  large: 16,
  rounded: 24,
};
