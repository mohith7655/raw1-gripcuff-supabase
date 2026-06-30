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
  // Surface fill (no-blur fallback base under the sheen). Opaque enough that
  // #211832 / #7A7C90 text stays legible when blur is unavailable.
  fill: 'rgba(248,248,252,0.55)',
  fillStrong: 'rgba(248,248,252,0.72)',
  // Solid fallback fill used when blur is unsupported / disabled (low-end /
  // janky Android). More opaque so text keeps contrast without blur.
  solidFallback: 'rgba(248,248,252,0.92)',
  // Diagonal (150°) translucent sheen drawn OVER the blur — the glass material.
  sheen: ['rgba(255,255,255,0.62)', 'rgba(255,255,255,0.30)', 'rgba(255,255,255,0.42)'] as const,
  sheenLocations: [0, 0.48, 1] as const,
  // 1px luminous border (replaces solid #D8D8E4).
  border: 'rgba(255,255,255,0.9)',
  // Faint inner rim — the second glass edge, inset 1px.
  innerRim: 'rgba(255,255,255,0.35)',
  // Bright 1.5px top specular highlight (fakes CSS `inset 0 1.5px 0`).
  highlight: 'rgba(255,255,255,0.95)',
  // Depth shadow.
  shadowColor: '#211832',
  shadowOpacity: 0.12,
  shadowRadius: 34,
  shadowOffset: { width: 0, height: 10 },
  androidElevation: 6,
  // Hairline divider — faint deep-indigo line.
  divider: 'rgba(33,24,50,0.06)',
  // Default BlurView intensity / tint.
  blurIntensity: 34,
  blurTint: 'light' as const,
  radius: 22,
  // Ambient mesh — base diagonal gradient (~165°), cool lavender so the canvas
  // has colour for the glass to refract (no near-white that reads as a bug).
  ambientBase: ['#EEEDF6', '#E2E3F0', '#E8EAF6'] as const,
  ambientFallback: '#E8EAF6',
  // Radial glow stops for the mesh (positions/falloff live in AmbientBackground).
  glowOrangeTL: 'rgba(242,89,18,0.20)',   // top-left   14%/4%   → transparent 38%
  glowIndigoTR: 'rgba(76,78,120,0.26)',   // top-right  92%/16%  → transparent 44%
  glowOrangeL:  'rgba(242,89,18,0.10)',   // left        8%/60%  → transparent 40%
  glowIndigoBC: 'rgba(76,78,120,0.20)',   // bottom-ctr 50%/110% → transparent 52%
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
