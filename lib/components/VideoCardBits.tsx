/**
 * Shared video-card bits so every thumbnail across the app shows difficulty and
 * category the same way:
 *   • DifficultyDot     — a bare coloured dot (🟢/🟡/🔴 → green/amber/red) shown
 *                          right after the title (no text label).
 *   • ThumbnailCategory — the video's category pinned to the thumbnail's
 *                          bottom-left.
 */
import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { difficultyColor, difficultyLetter } from '../core/difficulty';
import { setupLevelFor, SETUP_DISPLAY } from '../core/setupTime';

/**
 * Category → body-pictogram glyph (MaterialCommunityIcons). Keys cover both the
 * compact data keys ("MuscleGrowth") and spaced labels ("Muscle Growth");
 * unknown categories fall back to a generic dumbbell.
 */
const CATEGORY_ICON: Record<string, string> = {
  MuscleGrowth: 'arm-flex',
  Strength: 'weight-lifter',
  AthleticPerformance: 'run-fast',
  Stretching: 'yoga',
  Gripcuff: 'dumbbell',
  InjuryRehab: 'human-cane',
  Recovery: 'meditation',
  Mobility: 'walk',
  HIIT: 'fire',
  Challenge: 'sword-cross',
  Tutorial: 'school',
};

export function categoryIconName(cat?: string | null): string {
  if (!cat) return 'dumbbell';
  const key = String(cat).replace(/\s+/g, '');
  return CATEGORY_ICON[key] ?? CATEGORY_ICON[String(cat)] ?? 'dumbbell';
}

/** Category → accent colour, matching the Library/Workouts category rows. */
const CATEGORY_COLOR: Record<string, string> = {
  MuscleGrowth: '#66BB6A',
  Strength: '#FF7043',
  AthleticPerformance: '#FFD600',
  Stretching: '#4FC3F7',
  Gripcuff: '#F25912',
  InjuryRehab: '#f44336',
  Recovery: '#26C6DA',
  Mobility: '#AB47BC',
  HIIT: '#FB8C00',
  Challenge: '#EC407A',
  Tutorial: '#90A4AE',
};

export function categoryColor(cat?: string | null): string {
  if (!cat) return '#E0E0E0';
  const key = String(cat).replace(/\s+/g, '');
  return CATEGORY_COLOR[key] ?? CATEGORY_COLOR[String(cat)] ?? '#E0E0E0';
}

// Difficulty shown as a single coloured letter — S (Simple), M (Medium),
// C (Complex) — in the difficulty's colour. `size` scales the letter so existing
// callers (which pass the old dot diameter) stay visually balanced.
export function DifficultyDot({
  difficulty, size = 9, style,
}: { difficulty?: string | null; size?: number; style?: StyleProp<ViewStyle> }) {
  const color = difficultyColor(difficulty);
  const letter = difficultyLetter(difficulty);
  if (!color || !letter) return null;
  const fontSize = Math.round(size + 3);
  return (
    <Text style={[{ color, fontSize, lineHeight: fontSize + 1, fontWeight: '800' }, style as StyleProp<TextStyle>]}>
      {letter}
    </Text>
  );
}

/** Spaced-out, readable category label (e.g. "MuscleGrowth" → "Muscle Growth"). */
export function categoryLabel(cat?: string | null): string {
  if (!cat) return '';
  return String(cat).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/**
 * Setup-time hourglass — quick (near-empty) → fast → slow (full), coloured
 * green→amber→red. Level is derived from the category (equipment) with difficulty
 * as a fallback. Returns null when it can't be determined.
 */
export function SetupTimeIcon({
  category, difficulty, size = 14,
}: { category?: string | null; difficulty?: string | null; size?: number }) {
  const level = setupLevelFor(category, difficulty);
  if (!level) return null;
  const meta = SETUP_DISPLAY[level];
  return <MaterialCommunityIcons name={meta.icon as any} color={meta.color} size={size} />;
}

// Thumbnail overlays: category pictogram bottom-left, setup-time hourglass
// top-right (top-left = logo, bottom-right = duration are already taken).
export function ThumbnailCategory({
  category, difficulty,
}: { category?: string | null; difficulty?: string | null }) {
  const level = setupLevelFor(category, difficulty);
  return (
    <>
      {category ? (
        <View style={s.badge} pointerEvents="none">
          <MaterialCommunityIcons name={categoryIconName(category) as any} color={categoryColor(category)} size={14} />
        </View>
      ) : null}
      {level ? (
        <View style={s.setupBadge} pointerEvents="none">
          <MaterialCommunityIcons name={SETUP_DISPLAY[level].icon as any} color={SETUP_DISPLAY[level].color} size={14} />
        </View>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
