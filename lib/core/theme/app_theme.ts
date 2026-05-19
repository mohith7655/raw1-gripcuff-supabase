// Theme colors and styles matching Flutter app exactly
export const AppTheme = {
  // Colors
  background: '#0F172A',
  cardColor: '#1E293B',
  primaryColor: '#F97316', // Orange
  textWhite: '#FFFFFF',
  textGrey: '#94A3B8', // Slate 400
  inactiveColor: '#334155', // Slate 700

  // Additional colors for UI elements
  metalGray: '#465060',
  silver: '#a6afc2',
  orange: '#e46600',
  darkBackground: '#1d2337',
};

// Premium Theme for Personal Coaching section
export const CoachingTheme = {
  background: '#020509',   // deep black-blue
  darkBg: '#030b12',   // dark navy-black
  cardColor: '#0a1628',   // dark blue card
  cardDark: '#060e1c',   // very dark blue
  primaryColor: '#4E87A0',   // muted steel blue
  primaryLight: '#6BA3B8',   // soft muted blue
  primaryGlow: 'rgba(78,135,160,0.12)',
  primaryBorder: 'rgba(78,135,160,0.2)',
  textWhite: '#f0f8ff',   // soft white-blue
  textGrey: '#4a7a9b',   // muted blue-grey
  textMuted: '#2d5a7a',
  border: 'rgba(78,135,160,0.1)',
  borderStrong: 'rgba(78,135,160,0.2)',
  tabActive: '#4E87A0',
  statCard: '#0a1628',
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
