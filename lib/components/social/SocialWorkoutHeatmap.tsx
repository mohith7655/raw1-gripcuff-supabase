/**
 * SocialWorkoutHeatmap — "are you being social or working out?" as a heat map.
 *
 * Two GitHub-style rows over the last N days:
 *   • Workout (green)  — any active workout that day, darker = more minutes
 *   • Social  (indigo) — days you trained WITH others (co-workout / challenge)
 *
 * Self-fetches by uid via the same activity map that powers the profile heatmap.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { ActivityMapData, loadActivityMap } from '../../services/activityMap.service';

const C = { text: '#211832', muted: '#7A7C90', empty: 'rgba(33,24,50,0.07)', orange: '#F25912' };
const WORKOUT_SHADES = ['#9be9a8', '#40c463', '#30a14e', '#216e39']; // GitHub greens
const SOCIAL_SHADES  = ['#B7BCDE', '#7E83BA', '#565A93', '#393C66']; // indigo
const DAYS = 21;

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const levelFromMinutes = (m: number) => (m >= 46 ? 4 : m >= 26 ? 3 : m >= 11 ? 2 : 1);

export function SocialWorkoutHeatmap({ uid }: { uid: string }) {
  const [data, setData] = useState<ActivityMapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadActivityMap(uid, DAYS + 1)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) { setData(null); setLoading(false); } });
    return () => { alive = false; };
  }, [uid]);

  const { days, workoutDays, socialDays } = useMemo(() => {
    const byDay = data?.byDay ?? {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const out: { workout: string; social: string }[] = [];
    let wd = 0, sd = 0;
    for (let i = DAYS - 1; i >= 0; i--) {
      const dt = new Date(today); dt.setDate(today.getDate() - i);
      const e = byDay[keyOf(dt)];
      const active = !!(e && e.active);
      const social = !!(e && (e.kinds.has('friend') || e.kinds.has('challenge')));
      const lvl = active ? levelFromMinutes(e!.minutes) : 0;
      if (active) wd++;
      if (social) sd++;
      out.push({
        workout: active ? WORKOUT_SHADES[lvl - 1] : C.empty,
        social: social ? SOCIAL_SHADES[lvl - 1] : C.empty,
      });
    }
    return { days: out, workoutDays: wd, socialDays: sd };
  }, [data]);

  if (loading) return <ActivityIndicator color={C.orange} style={{ paddingVertical: 16 }} />;

  return (
    <View>
      <View style={s.gridRow}>
        <Text style={s.rowName}>Workout</Text>
        <View style={s.cells}>
          {days.map((d, i) => <View key={i} style={[s.cell, { backgroundColor: d.workout }]} />)}
        </View>
      </View>
      <View style={[s.gridRow, { marginTop: 4 }]}>
        <Text style={s.rowName}>Social</Text>
        <View style={s.cells}>
          {days.map((d, i) => <View key={i} style={[s.cell, { backgroundColor: d.social }]} />)}
        </View>
      </View>

      <View style={s.footer}>
        <Text style={s.footText}>Last {DAYS} days</Text>
        <View style={s.legend}>
          <View style={[s.legendDot, { backgroundColor: WORKOUT_SHADES[2] }]} />
          <Text style={s.footText}>{workoutDays}d working out</Text>
          <View style={[s.legendDot, { backgroundColor: SOCIAL_SHADES[2], marginLeft: 10 }]} />
          <Text style={s.footText}>{socialDays}d social</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  gridRow: { flexDirection: 'row', alignItems: 'center' },
  rowName: { width: 58, color: C.muted, fontSize: 12, fontWeight: '700' },
  cells: { flex: 1, flexDirection: 'row', gap: 3 },
  cell: { flex: 1, aspectRatio: 1, borderRadius: 2 },
  footer: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  footText: { color: C.muted, fontSize: 11.5, fontWeight: '600' },
});

export default SocialWorkoutHeatmap;
