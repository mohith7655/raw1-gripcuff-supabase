/**
 * Glass UI — shared "One UI 8.5 / Ambient Design" surface components.
 *
 *   <AmbientBackground> — soft ambient mesh screen backdrop.
 *   <GlassCard> / <GlassSurface> / <GlassPill> — frosted-glass surfaces.
 *
 * Design tokens live in core/theme/app_theme.ts under `Glass`.
 */
export { AmbientBackground } from './AmbientBackground';
export { GlassCard, GlassSurface, GlassPill, GlassSheen } from './GlassCard';
export type { GlassSurfaceProps } from './GlassCard';
export { isBlurEnabled, setBlurEnabled } from './blurSupport';
