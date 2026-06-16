/**
 * StatPill — 3-card stat row: Squats | Workouts | PRs
 * Used on ProfileScreen and ScannedProfileScreen.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PersonStanding, Dumbbell, Trophy } from 'lucide-react-native';

const ORANGE = '#F25912';
const TEXT   = '#211832';
const MUTED  = '#7A7C90';
const BORDER = 'rgba(33,24,50,0.06)';

interface Props {
  squats: number;
  workouts: number;
  prs: number;
  /** When true, drops the card background/border so it can sit inside a ProfileCard. */
  bare?: boolean;
}

export function StatPill({ squats, workouts, prs, bare }: Props) {
  return (
    <View style={[s.row, bare && s.rowBare]}>
      {/* Squats */}
      <View style={s.cell}>
        <PersonStanding size={28} color={ORANGE} strokeWidth={2.2} />
        <Text style={s.value}>{squats}</Text>
        <Text style={s.label}>Squats</Text>
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
    backgroundColor: '#F8F8FC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  rowBare: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderRadius: 0,
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
