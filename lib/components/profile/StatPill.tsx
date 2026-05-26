/**
 * StatPill — 3-card stat row: Day Streak | Workouts | PRs
 * Used on ProfileScreen and ScannedProfileScreen.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Flame, Dumbbell, Trophy } from 'lucide-react-native';

const ORANGE = '#ff7a00';
const TEXT   = '#ffffff';
const MUTED  = '#9ca3af';
const BORDER = 'rgba(255,255,255,0.06)';

interface Props {
  streak: number;
  workouts: number;
  prs: number;
}

export function StatPill({ streak, workouts, prs }: Props) {
  return (
    <View style={s.row}>
      {/* Day Streak */}
      <View style={s.cell}>
        <Flame size={28} color={ORANGE} strokeWidth={2.2} />
        <Text style={s.value}>{streak}</Text>
        <Text style={s.label}>Day Streak</Text>
      </View>

      <View style={s.divider} />

      {/* Workouts */}
      <View style={s.cell}>
        <Dumbbell size={28} color={ORANGE} strokeWidth={2.2} />
        <Text style={s.value}>{workouts}</Text>
        <Text style={s.label}>Workouts</Text>
      </View>

      <View style={s.divider} />

      {/* PRs */}
      <View style={s.cell}>
        <Trophy size={28} color={ORANGE} strokeWidth={2.2} />
        <Text style={s.value}>{prs}</Text>
        <Text style={s.label}>PRs</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 5,
  },
  divider: {
    width: 1,
    backgroundColor: BORDER,
    marginVertical: 14,
  },
  value: {
    color: TEXT,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
  },
  label: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
});
