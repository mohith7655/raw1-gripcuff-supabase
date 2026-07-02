/**
 * SocialWorkoutHeatmap — "are you being social or working out?" as a heat map.
 *
 * Three GitHub-style rows over a swipeable timeline:
 *   • Workout   (green)  — any active workout that day, darker = more minutes
 *   • Social    (indigo) — days you trained WITH friends (co-workout)
 *   • Challenge (rose)   — days you did a head-to-head Challenge Lobby session
 *
 * The row labels stay pinned on the left while the three rows scroll together
 * horizontally — swipe left for the past, right for upcoming days. On load the
 * grid is positioned so today sits at the right edge (showing the recent window).
 * The footer summarises the trailing 21 days.
 *
 * Self-fetches by uid via the same activity map that powers the profile heatmap.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { ActivityMapData, loadActivityMap } from '../../services/activityMap.service';

const C = { text: '#211832', muted: '#7A7C90', empty: 'rgba(33,24,50,0.07)', orange: '#F25912' };
const WORKOUT_SHADES   = ['#9be9a8', '#40c463', '#30a14e', '#216e39']; // GitHub greens
const SOCIAL_SHADES    = ['#B7BCDE', '#7E83BA', '#565A93', '#393C66']; // indigo
const CHALLENGE_SHADES = ['#FBC9D6', '#F58BA6', '#E11D48', '#9F1239']; // rose / head-to-head

const DAYS = 21;          // trailing window summarised in the footer
const PAST_DAYS = 120;    // history loaded / rendered in the scrollable grid
const FUTURE_DAYS = 21;   // empty upcoming days you can swipe into
const CELL = 10;          // fixed cell size (scrolls instead of stretching)
const GAP = 3;
const COL_W = CELL + GAP;
const LABEL_W = 68;

const ROWS = [
  { key: 'workout' as const,   label: 'Workout' },
  { key: 'social' as const,    label: 'Social' },
  { key: 'challenge' as const, label: 'Challenge' },
];

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const levelFromMinutes = (m: number) => (m >= 46 ? 4 : m >= 26 ? 3 : m >= 11 ? 2 : 1);

export function SocialWorkoutHeatmap({ uid }: { uid: string }) {
  const [data, setData] = useState<ActivityMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  const [viewW, setViewW] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadActivityMap(uid, PAST_DAYS + 1)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) { setData(null); setLoading(false); } });
    return () => { alive = false; };
  }, [uid]);

  const { timeline, workoutDays, socialDays, challengeDays, todayIndex } = useMemo(() => {
    const byDay = data?.byDay ?? {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const out: { future: boolean; workout: string; social: string; challenge: string }[] = [];
    let wd = 0, sd = 0, cd = 0;

    for (let idx = 0; idx < PAST_DAYS + FUTURE_DAYS; idx++) {
      // offset from today: >0 = past, 0 = today, <0 = upcoming.
      const offset = (PAST_DAYS - 1) - idx;
      const dt = new Date(today); dt.setDate(today.getDate() - offset);
      const future = offset < 0;
      const e = future ? undefined : byDay[keyOf(dt)];
      const active = !!(e && e.active);
      // Social = trained with a friend OR any social interaction (chat / invite).
      const social = !!(e && (e.kinds.has('friend') || e.kinds.has('social')));
      const challenge = !!(e && e.kinds.has('challenge'));
      // Challenge / social days are always "active"; floor the level at 1 so the
      // cell is visible even when the day logged no watch-minutes.
      const lvl = active ? levelFromMinutes(e!.minutes) : 0;
      const altLvl = Math.max(1, lvl);
      // Trailing 21-day tally (footer summary).
      if (offset >= 0 && offset <= DAYS - 1) {
        if (active) wd++;
        if (social) sd++;
        if (challenge) cd++;
      }
      out.push({
        future,
        workout: active ? WORKOUT_SHADES[lvl - 1] : C.empty,
        social: social ? SOCIAL_SHADES[altLvl - 1] : C.empty,
        challenge: challenge ? CHALLENGE_SHADES[altLvl - 1] : C.empty,
      });
    }
    return { timeline: out, workoutDays: wd, socialDays: sd, challengeDays: cd, todayIndex: PAST_DAYS - 1 };
  }, [data]);

  // Land on the recent window (today at the right edge) once measured.
  useEffect(() => {
    if (!viewW || loading) return;
    const x = Math.max(0, (todayIndex + 1) * COL_W - viewW);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x, animated: false }));
  }, [viewW, loading, todayIndex]);

  if (loading) return <ActivityIndicator color={C.orange} style={{ paddingVertical: 16 }} />;

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {/* Frozen row labels */}
        <View style={{ width: LABEL_W }}>
          {ROWS.map((r, i) => (
            <View key={r.key} style={{ height: CELL, marginTop: i === 0 ? 0 : GAP + 1, justifyContent: 'center' }}>
              <Text style={s.rowName}>{r.label}</Text>
            </View>
          ))}
        </View>

        {/* Swipeable timeline — all three rows scroll together */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
        >
          <View>
            {ROWS.map((r, ri) => (
              <View key={r.key} style={{ flexDirection: 'row', gap: GAP, marginTop: ri === 0 ? 0 : GAP + 1 }}>
                {timeline.map((d, i) => (
                  <View
                    key={i}
                    style={[
                      s.cell,
                      { backgroundColor: d[r.key] },
                      d.future && s.futureCell,
                      i === todayIndex && s.todayCell,
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={s.footer}>
        <Text style={s.footText}>Last {DAYS} days · swipe →</Text>
        <View style={s.legend}>
          <View style={[s.legendDot, { backgroundColor: WORKOUT_SHADES[2] }]} />
          <Text style={s.footText}>{workoutDays}d working out</Text>
          <View style={[s.legendDot, { backgroundColor: SOCIAL_SHADES[2], marginLeft: 10 }]} />
          <Text style={s.footText}>{socialDays}d social</Text>
          <View style={[s.legendDot, { backgroundColor: CHALLENGE_SHADES[2], marginLeft: 10 }]} />
          <Text style={s.footText}>{challengeDays}d challenge</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  rowName: { color: C.muted, fontSize: 12, fontWeight: '700' },
  cell: { width: CELL, height: CELL, borderRadius: 2 },
  futureCell: { opacity: 0.4 },
  todayCell: { borderWidth: 1, borderColor: 'rgba(33,24,50,0.28)' },
  footer: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  footText: { color: C.muted, fontSize: 11.5, fontWeight: '600' },
});

export default SocialWorkoutHeatmap;
