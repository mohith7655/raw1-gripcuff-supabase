/**
 * Shared video-card bits so every thumbnail across the app shows difficulty and
 * category the same way:
 *   • DifficultyDot     — a bare coloured letter (S/M/C → green/amber/red) for
 *                          the difficulty; rendered inside ThumbnailCategory.
 *   • ThumbnailCategory — the category pictogram, then the difficulty letter,
 *                          then the setup-time hourglass, in a meta row below
 *                          the card's title.
 */
import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { difficultyColor, difficultyLetter } from '../core/difficulty';
import { setupLevelFor, SETUP_DISPLAY } from '../core/setupTime';
import { useVideoEngagementCounts, formatEngagement } from '../services/videoEngagementCounts.service';

const META_GREY = '#7A7C90';

/**
 * "X trying · Y favorites" — how many people added the video to Trying / Favorites,
 * shown in grey under a card after the views. Hidden until there's at least one.
 */
export function VideoEngagementIcons({
  videoId, size = 11, style,
}: { videoId?: string | null; size?: number; style?: StyleProp<ViewStyle> }) {
  const counts = useVideoEngagementCounts(videoId ?? null);
  if (!counts || (!counts.tries && !counts.favorites)) return null;
  const parts: string[] = [];
  if (counts.tries) parts.push(`${formatEngagement(counts.tries)} trying`);
  if (counts.favorites) parts.push(`${formatEngagement(counts.favorites)} favorites`);
  return (
    <Text style={[engStyles.text, { fontSize: size }, style as StyleProp<TextStyle>]}>
      {parts.join(' · ')}
    </Text>
  );
}

const engStyles = StyleSheet.create({
  text: { color: META_GREY, fontWeight: '600', marginTop: 3 },
});

/**
 * Category → body-pictogram glyph (MaterialCommunityIcons). Keys cover both the
 * compact data keys ("MuscleGrowth") and spaced labels ("Muscle Growth");
 * unknown categories fall back to a generic dumbbell.
 */
const CATEGORY_ICON: Record<string, string> = {
  MuscleGrowth: 'weight-lifter',
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
  GeneralHealth: 'heart-pulse',
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
  GeneralHealth: '#26A69A',
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

// Category pictogram + difficulty letter + setup-time hourglass, shown inline
// right below a video card's title (no longer overlaid on the thumbnail). The
// difficulty (S/M/C) sits right after the category. `style` lets callers tweak
// spacing for their card layout.
export function ThumbnailCategory({
  category, difficulty, style,
}: { category?: string | null; difficulty?: string | null; style?: StyleProp<ViewStyle> }) {
  const level = setupLevelFor(category, difficulty);
  const hasDiff = !!difficultyLetter(difficulty);
  if (!category && !level && !hasDiff) return null;
  return (
    <View style={[s.metaRow, style]}>
      {category ? (
        <MaterialCommunityIcons name={categoryIconName(category) as any} color={categoryColor(category)} size={14} />
      ) : null}
      <DifficultyDot difficulty={difficulty} />
      {level ? (
        <MaterialCommunityIcons name={SETUP_DISPLAY[level].icon as any} color={SETUP_DISPLAY[level].color} size={14} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
});
