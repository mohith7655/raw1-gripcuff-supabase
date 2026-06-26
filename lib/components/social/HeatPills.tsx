/**
 * HeatPills — the tiny "how active" widget: a high-five (social) pill and a
 * dumbbell (workout) pill, each tinted hot ↔ cold by the user's recent activity.
 * Used in the connection preview sheet and on the full profile.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Hand, Dumbbell, Snowflake, Sun, Flame } from 'lucide-react-native';
import { Heat } from '../../utils/activityHeat';

// ❄️ cold/cool · ☀️ warm · 🔥 hot — replaces the heat word with an icon.
function HeatGlyph({ heat, size = 13 }: { heat: Heat; size?: number }) {
  const Icon = heat.level === 'hot' ? Flame : heat.level === 'warm' ? Sun : Snowflake;
  return <Icon size={size} color={heat.color} strokeWidth={2.4} />;
}

function HeatPill({ Icon, label, heat }: { Icon: any; label: string; heat: Heat }) {
  return (
    <View style={[s.pill, { backgroundColor: heat.soft, borderColor: heat.color }]}>
      <Icon size={14} color={heat.color} strokeWidth={2.4} />
      <Text style={[s.label, { color: heat.color }]}>{label}</Text>
      <HeatGlyph heat={heat} />
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
