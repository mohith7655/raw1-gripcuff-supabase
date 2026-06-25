/**
 * Shared video-card bits so every thumbnail across the app shows difficulty and
 * category the same way:
 *   • DifficultyDot     — a bare coloured dot (🟢/🟡/🔴 → green/amber/red) shown
 *                          right after the title (no text label).
 *   • ThumbnailCategory — the video's category pinned to the thumbnail's
 *                          bottom-left.
 */
import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { difficultyColor } from '../core/difficulty';

export function DifficultyDot({
  difficulty, size = 9, style,
}: { difficulty?: string | null; size?: number; style?: StyleProp<ViewStyle> }) {
  const color = difficultyColor(difficulty);
  if (!color) return null;
  return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/** Spaced-out, readable category label (e.g. "MuscleGrowth" → "Muscle Growth"). */
export function categoryLabel(cat?: string | null): string {
  if (!cat) return '';
  return String(cat).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

export function ThumbnailCategory({ category }: { category?: string | null }) {
  const label = categoryLabel(category);
  if (!label) return null;
  return (
    <View style={s.badge} pointerEvents="none">
      <Text style={s.text} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    maxWidth: '68%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.2 },
});
