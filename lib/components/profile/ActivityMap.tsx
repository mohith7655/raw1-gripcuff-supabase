/**
 * ActivityMap — GitHub-contribution-style heatmap of workout activity.
 *
 * 18 weeks × 7 days, with month labels across the top and weekday labels down
 * the side (the classic monthly / weekly view). Cell darkness scales with that
 * day's watched minutes; the hue marks the day's most notable activity type
 * (challenge › with-friend › solo). A header line shows days since the last
 * workout.
 *
 * Renders content only (no card) so the host screen wraps it in its ProfileCard.
 * Self-fetches by uid, so it works for the owner and other users.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { ActivityKind, ActivityMapData, loadActivityMap } from '../../services/activityMap.service';

const C = { text: '#211832', muted: '#7A7C90', empty: 'rgba(33,24,50,0.07)', orange: '#F25912' };

// Light → dark shades (levels 1–4) per activity type — green is the default.
const SHADES: Record<ActivityKind, string[]> = {
  solo:      ['#9be9a8', '#40c463', '#30a14e', '#216e39'], // GitHub greens
  friend:    ['#B7BCDE', '#7E83BA', '#565A93', '#393C66'], // indigo
  challenge: ['#FBC9A8', '#F59A5C', '#F2712B', '#B83C06'], // orange
};
const KIND_LABEL: Record<ActivityKind, string> = { solo: 'Workout', friend: 'With friend', challenge: 'Challenge' };
const PRIORITY: ActivityKind[] = ['challenge', 'friend', 'solo']; // most notable wins the cell hue

const WEEKS = 18;        // weeks shown at once
const FETCH_WEEKS = 52;  // ~1 year of history loaded, paged via the arrows
const STEP_WEEKS = 4;    // each arrow press shifts ~a month
const CELL = 13;
const GAP = 3;

const saturdayOf = (d: Date) => { const s = new Date(d); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() + (6 - s.getDay())); return s; };
const COL_W = CELL + GAP;
const WDAY_W = 24;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD_LABEL: Record<number, string> = { 1: 'Mon', 3: 'Wed', 5: 'Fri' };

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Cell { color: string }

export function ActivityMap({ uid, lastWorkoutDate }: { uid: string; lastWorkoutDate?: string | null }) {
  const [data, setData] = useState<ActivityMapData | null>(null);
  const [loading, setLoading] = useState(true);
  // How many weeks back the visible window is shifted (0 = current).
  const [offsetWeeks, setOffsetWeeks] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setOffsetWeeks(0);
    loadActivityMap(uid, FETCH_WEEKS * 7)
      .then((d) => { if (alive) { setData(d); setLoading(false); } })
      .catch(() => { if (alive) { setData(null); setLoading(false); } });
    return () => { alive = false; };
  }, [uid]);

  // Page back across the full loaded history (even over quiet stretches) so the
  // arrows always work; clamp so we never scroll past the fetched range.
  const maxBackWeeks = Math.max(0, FETCH_WEEKS - WEEKS);

  const { columns, monthLabels, daysSince, activeDays } = useMemo(() => {
    const byDay = data?.byDay ?? {};
    const today = new Date(); today.setHours(0, 0, 0, 0);
    // Window ends `offsetWeeks` before this week's Saturday.
    const end = saturdayOf(today); end.setDate(end.getDate() - offsetWeeks * 7);
    const totalDays = WEEKS * 7;

    const levelFromMinutes = (m: number) => (m >= 46 ? 4 : m >= 26 ? 3 : m >= 11 ? 2 : 1);

    const cols: Cell[][] = [];
    const labels: { ci: number; label: string }[] = [];
    let prevMonth = -1;

    for (let w = 0; w < WEEKS; w++) {
      const col: Cell[] = [];
      for (let r = 0; r < 7; r++) {
        const d = new Date(end);
        d.setDate(end.getDate() - (totalDays - 1) + (w * 7 + r));
        if (r === 0) {
          const m = d.getMonth();
          if (m !== prevMonth) { labels.push({ ci: w, label: MONTHS[m] }); prevMonth = m; }
        }
        if (d.getTime() > today.getTime()) { col.push({ color: 'transparent' }); continue; }
        const e = byDay[keyOf(d)];
        if (!e || !e.active) { col.push({ color: C.empty }); continue; }
        let kind: ActivityKind = 'solo';
        for (const k of PRIORITY) if (e.kinds.has(k)) { kind = k; break; }
        const level = levelFromMinutes(e.minutes);
        col.push({ color: SHADES[kind][level - 1] });
      }
      cols.push(col);
    }

    const last = data?.lastActiveDate ?? lastWorkoutDate ?? null;
    let ds: number | null = null;
    if (last) {
      const l = new Date(last); l.setHours(0, 0, 0, 0);
      ds = Math.round((today.getTime() - l.getTime()) / 86400000);
    }
    return { columns: cols, monthLabels: labels, daysSince: ds, activeDays: data?.activeDays ?? 0 };
  }, [data, lastWorkoutDate, offsetWeeks]);

  const canPrev = offsetWeeks < maxBackWeeks;
  const canNext = offsetWeeks > 0;
  const goPrev = () => setOffsetWeeks((o) => Math.min(maxBackWeeks, o + STEP_WEEKS));
  const goNext = () => setOffsetWeeks((o) => Math.max(0, o - STEP_WEEKS));

  const sinceText =
    daysSince == null ? 'No workouts yet'
    : daysSince <= 0 ? 'Last workout today'
    : daysSince === 1 ? '1 day since last workout'
    : `${daysSince} days since last workout`;

  const gridW = WEEKS * COL_W;

  return (
    <View>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Activity</Text>
          <Text style={s.since}>{sinceText}</Text>
        </View>
        {!loading && (
          <View style={s.navRow}>
            <TouchableOpacity
              style={[s.navBtn, !canPrev && s.navBtnOff]}
              onPress={goPrev}
              disabled={!canPrev}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <ChevronLeft size={16} color={canPrev ? C.text : C.muted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.navBtn, !canNext && s.navBtnOff]}
              onPress={goNext}
              disabled={!canNext}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <ChevronRight size={16} color={canNext ? C.text : C.muted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color={C.orange} style={{ paddingVertical: 24 }} />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Month labels */}
              <View style={[s.monthRow, { marginLeft: WDAY_W + GAP, width: gridW }]}>
                {monthLabels.map((ml) => (
                  <Text key={`${ml.ci}-${ml.label}`} style={[s.monthLabel, { left: ml.ci * COL_W }]}>
                    {ml.label}
                  </Text>
                ))}
              </View>

              {/* Weekday labels + grid */}
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: WDAY_W, marginRight: GAP }}>
                  {[0, 1, 2, 3, 4, 5, 6].map((r) => (
                    <View key={r} style={{ height: CELL, marginBottom: r < 6 ? GAP : 0, justifyContent: 'center' }}>
                      {WD_LABEL[r] ? <Text style={s.wdLabel}>{WD_LABEL[r]}</Text> : null}
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', gap: GAP }}>
                  {columns.map((col, ci) => (
                    <View key={ci} style={{ gap: GAP }}>
                      {col.map((cell, ri) => (
                        <View key={ri} style={[s.cell, { backgroundColor: cell.color }]} />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={s.legendRow}>
            {(['solo', 'friend', 'challenge'] as ActivityKind[]).map((k) => (
              <View key={k} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: SHADES[k][2] }]} />
                <Text style={s.legendText}>{KIND_LABEL[k]}</Text>
              </View>
            ))}
            {activeDays > 0 && <Text style={s.totalText}>{activeDays} active days</Text>}
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { color: C.text, fontSize: 15, fontWeight: '800' },
  since: { color: C.muted, fontSize: 12, fontWeight: '600', marginTop: 1 },
  navRow: { flexDirection: 'row', gap: 8 },
  navBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EEEEF2', borderWidth: 1, borderColor: 'rgba(33,24,50,0.08)',
  },
  navBtnOff: { opacity: 0.4 },

  monthRow: { height: 14, position: 'relative', marginBottom: 4 },
  monthLabel: { position: 'absolute', top: 0, fontSize: 9.5, fontWeight: '700', color: C.muted },
  wdLabel: { fontSize: 9, fontWeight: '600', color: C.muted },

  cell: { width: CELL, height: CELL, borderRadius: 3 },

  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { color: C.muted, fontSize: 11.5, fontWeight: '600' },
  totalText: { color: C.muted, fontSize: 11.5, fontWeight: '600', marginLeft: 'auto' },
});

export default ActivityMap;
