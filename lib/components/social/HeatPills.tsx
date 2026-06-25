/**
 * HeatPills — the tiny "how active" widget: a high-five (social) pill and a
 * dumbbell (workout) pill, each tinted hot ↔ cold by the user's recent activity.
 * Used in the connection preview sheet and on the full profile.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Hand, Dumbbell } from 'lucide-react-native';
import { Heat } from '../../utils/activityHeat';

function HeatPill({ Icon, label, heat }: { Icon: any; label: string; heat: Heat }) {
  return (
    <View style={[s.pill, { backgroundColor: heat.soft, borderColor: heat.color }]}>
      <Icon size={14} color={heat.color} strokeWidth={2.4} />
      <Text style={[s.label, { color: heat.color }]}>{label}</Text>
      <Text style={[s.heatLabel, { color: heat.color }]}>{heat.label}</Text>
    </View>
  );
}

export function HeatPills({
  social, workout, size = 'md',
}: { social: Heat; workout: Heat; size?: 'sm' | 'md' }) {
  return (
    <View style={[s.row, size === 'sm' && s.rowSm]}>
      <HeatPill Icon={Hand} label="Social" heat={social} />
      <HeatPill Icon={Dumbbell} label="Workout" heat={workout} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  rowSm: { gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  label: { fontSize: 12, fontWeight: '700' },
  heatLabel: { fontSize: 11, fontWeight: '800', opacity: 0.85 },
});
