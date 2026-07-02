/**
 * SocialWorkoutHeatmap — "are you being social or working out?" as a heat map.
 *
 * Three GitHub-style rows over a paged 21-day window:
 *   • Workout   (green)  — any active workout that day, darker = more minutes
 *   • Social    (indigo) — days you trained WITH friends (co-workout)
 *   • Challenge (rose)   — days you did a head-to-head Challenge Lobby session
 *
 * The row labels stay pinned on the left. The grid pages one 21-day window per
 * swipe (not free scroll) — swipe left for the previous 21 days, right for the
 * next. On load it lands on the window ending today. The footer shows the active
 * window's date range and its workout / social / challenge day counts.
 *
 * Self-fetches by uid via the same activity map that powers the profile heatmap.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { ActivityMapData, loadActivityMap } from '../../services/activityMap.service';

const C = { text: '#211832', muted: '#7A7C90', empty: 'rgba(33,24,50,0.07)', orange: '#F25912' };
const WORKOUT_SHADES   = ['#9be9a8', '#40c463', '#30a14e', '#216e39']; // GitHub greens
const SOCIAL_SHADES    = ['#B7BCDE', '#7E83BA', '#565A93', '#393C66']; // indigo
const CHALLENGE_SHADES = ['#FBC9D6', '#F58BA6', '#E11D48', '#9F1239']; // rose / head-to-head

const DAYS_PER_PAGE = 21;   // one swipe = this many days
const PAST_PAGES = 5;       // windows of history reachable by swiping back
const FUTURE_PAGES = 1;     // empty upcoming window you can swipe into
const PAGES = PAST_PAGES + 1 + FUTURE_PAGES;
const CUR_PAGE = PAST_PAGES; // index of the window ending today
const LOAD_DAYS = PAST_PAGES * DAYS_PER_PAGE + 1;
const CELL_H = 12;
const GAP = 3;
const LABEL_W = 68;

const ROWS = [
  { key: 'workout' as const,   label: 'Workout' },
  { key: 'social' as const,    label: 'Social' },
  { key: 'challenge' as const, label: 'Challenge' },
];

type Cell = { color: string; future: boolean };
type Page = { workout: Cell[]; social: Cell[]; challenge: Cell[]; wd: number; sd: number; cd: number; start: Date; end: Date };

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const levelFromMinutes = (m: number) => (m >= 46 ? 4 : m >= 26 ? 3 : m >= 11 ? 2 : 1);
const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function SocialWorkoutHeatmap({ uid }: { uid: string }) {
  const [data, setData] = useState<ActivityMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewW, setViewW] = useState(0);
  const [activePage, setActivePage] = useState(CUR_PAGE);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadActivityMap(uid, LOAD_DAYS)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) { setData(null); setLoading(false); } });
    return () => { alive = false; };
  }, [uid]);

  const pages = useMemo<Page[]>(() => {
    const byDay = data?.byDay ?? {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const out: Page[] = [];
    for (let p = 0; p < PAGES; p++) {
      // Days-before-today of this window's most recent (right-most) cell.
      const endOffset = (CUR_PAGE - p) * DAYS_PER_PAGE;
      const workout: Cell[] = [], social: Cell[] = [], challenge: Cell[] = [];
      let wd = 0, sd = 0, cd = 0;
      for (let di = 0; di < DAYS_PER_PAGE; di++) {
        const offset = endOffset + (DAYS_PER_PAGE - 1 - di); // di=0 oldest → di=20 newest
        const dt = new Date(today); dt.setDate(today.getDate() - offset);
        const future = offset < 0;
        const e = future ? undefined : byDay[keyOf(dt)];
        const active = !!(e && e.active);
        const soc = !!(e && (e.kinds.has('friend') || e.kinds.has('social')));
        const chal = !!(e && e.kinds.has('challenge'));
        const lvl = active ? levelFromMinutes(e!.minutes) : 0;
        const alt = Math.max(1, lvl);
        if (active) wd++;
        if (soc) sd++;
        if (chal) cd++;
        workout.push({ color: active ? WORKOUT_SHADES[lvl - 1] : C.empty, future });
        social.push({ color: soc ? SOCIAL_SHADES[alt - 1] : C.empty, future });
        challenge.push({ color: chal ? CHALLENGE_SHADES[alt - 1] : C.empty, future });
      }
      const end = new Date(today); end.setDate(today.getDate() - endOffset);
      const start = new Date(end); start.setDate(end.getDate() - (DAYS_PER_PAGE - 1));
      out.push({ workout, social, challenge, wd, sd, cd, start, end });
    }
    return out;
  }, [data]);

  // Land on the window ending today once the width is measured.
  useEffect(() => {
    if (!viewW || loading) return;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: CUR_PAGE * viewW, animated: false }));
  }, [viewW, loading]);

  const onSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!viewW) return;
    setActivePage(Math.max(0, Math.min(PAGES - 1, Math.round(e.nativeEvent.contentOffset.x / viewW))));
  };

  if (loading) return <ActivityIndicator color={C.orange} style={{ paddingVertical: 16 }} />;

  const ap = pages[activePage] ?? pages[CUR_PAGE];
  const rangeLabel = activePage === CUR_PAGE ? 'Last 21 days' : `${fmtDate(ap.start)} – ${fmtDate(ap.end)}`;

  return (
    <View>
      <View style={{ flexDirection: 'row' }}>
        {/* Frozen row labels */}
        <View style={{ width: LABEL_W }}>
          {ROWS.map((r, i) => (
            <View key={r.key} style={{ height: CELL_H, marginTop: i === 0 ? 0 : GAP, justifyContent: 'center' }}>
              <Text style={s.rowName}>{r.label}</Text>
            </View>
          ))}
        </View>

        {/* Paged 21-day windows — one swipe advances exactly one window */}
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={viewW || 1}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          style={{ flex: 1 }}
          onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
          onMomentumScrollEnd={onSettle}
          onScrollEndDrag={onSettle}
          scrollEventThrottle={16}
        >
          {pages.map((page, p) => (
            <View key={p} style={{ width: viewW }}>
              {ROWS.map((r, ri) => (
                <View key={r.key} style={{ flexDirection: 'row', gap: GAP, marginTop: ri === 0 ? 0 : GAP }}>
                  {page[r.key].map((cell, di) => (
                    <View
                      key={di}
                      style={[
                        { flex: 1, height: CELL_H, borderRadius: 2, backgroundColor: cell.color },
                        cell.future && { opacity: 0.4 },
                        p === CUR_PAGE && di === DAYS_PER_PAGE - 1 && s.todayCell,
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={s.footer}>
        <Text style={s.footText}>{rangeLabel}</Text>
        <View style={s.legend}>
          <View style={[s.legendDot, { backgroundColor: WORKOUT_SHADES[2] }]} />
          <Text style={s.footText}>{ap.wd}d working out</Text>
          <View style={[s.legendDot, { backgroundColor: SOCIAL_SHADES[2], marginLeft: 10 }]} />
          <Text style={s.footText}>{ap.sd}d social</Text>
          <View style={[s.legendDot, { backgroundColor: CHALLENGE_SHADES[2], marginLeft: 10 }]} />
          <Text style={s.footText}>{ap.cd}d challenge</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  rowName: { color: C.muted, fontSize: 12, fontWeight: '700' },
  todayCell: { borderWidth: 1, borderColor: 'rgba(33,24,50,0.28)' },
  footer: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  footText: { color: C.muted, fontSize: 11.5, fontWeight: '600' },
});

export default SocialWorkoutHeatmap;
