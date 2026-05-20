import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { ChevronRight, Zap } from 'lucide-react-native';
import { StreakData } from '../../services/streak.service';
import { getDateKey, getWeekdayIndex, getYesterdayKey, buildWeekDates } from '../../utils/streakDate';
import { getResolvedTimezone } from '../../utils/timezone';

const ACCENT = '#FF6B00';
const CARD_BG = '#111d2e';
const BORDER = 'rgba(255,107,0,0.18)';
const WEEKLY_TOTAL = 7;

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function formatMinutes(value?: number): string {
    const safe = Number(value || 0);
    if (safe <= 0) return '';
    if (safe >= 60) return `${Math.floor(safe / 60)}h`;
    const rounded = Math.round(safe * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}m` : `${rounded.toFixed(1)}m`;
}

function motivationText(streak: number): string {
    if (streak <= 2) return 'Start your comeback';
    if (streak <= 6) return 'Building momentum';
    if (streak <= 13) return "You're on fire!";
    if (streak <= 29) return 'Unstoppable';
    return 'Elite consistency 🏆';
}

/**
 * Single day circle in the week row.
 *
 * States (priority order):
 *  active=true              → solid orange fill  (completed)
 *  isCurrentStreakDay=true  → soft orange fill + pulsing border  (streak alive, not yet done today)
 *  isToday=true (only)     → orange border + dim pulse  (today, but streak broken)
 *  default                  → dark inactive
 */
function DayDot({
    active,
    isToday,
    isCurrentStreakDay,
    label,
    minutes,
}: {
    active: boolean;
    isToday: boolean;
    isCurrentStreakDay: boolean;
    label: string;
    minutes?: number;
}) {
    const minLabel = active ? formatMinutes(minutes ?? 0) : '';

    return (
        <View style={styles.dayCol}>
            <View
                style={[
                    styles.dayDot,
                    active && styles.dayDotActive,
                    !active && isCurrentStreakDay && styles.dayDotStreakActive,
                    !active && !isCurrentStreakDay && isToday && styles.dayDotToday,
                ]}
            >
                {minLabel ? (
                    <Text
                        style={styles.dayDotText}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                    >
                        {minLabel}
                    </Text>
                ) : null}
            </View>
            <Text style={[
                styles.dayLabel,
                active && styles.dayLabelActive,
                !active && isCurrentStreakDay && styles.dayLabelStreakActive,
            ]}>
                {label}
            </Text>
        </View>
    );
}

function ChallengesBar({ completed }: { completed: number }) {
    const widthAnim = useRef(new Animated.Value(0)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    const ratio = Math.min(completed / WEEKLY_TOTAL, 1);

    useEffect(() => {
        Animated.timing(widthAnim, {
            toValue: ratio,
            duration: 700,
            useNativeDriver: false,
            easing: Easing.out(Easing.cubic),
        }).start();
    }, [ratio]);

    useEffect(() => {
        if (completed <= 0) return;
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
                Animated.timing(glowAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [completed > 0]);

    const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });

    return (
        <View style={styles.challengesSection}>
            <View style={styles.challengesDivider} />
            <View style={styles.challengesRow}>
                <View style={styles.challengesLeft}>
                    <Zap color={ACCENT} size={11} />
                    <Text style={styles.challengesLabel}>Daily Challenges</Text>
                </View>
                <Text style={styles.challengesCount}>
                    {completed}/{WEEKLY_TOTAL} <Text style={styles.challengesCountSuffix}>this week</Text>
                </Text>
            </View>
            <View style={styles.barTrack}>
                <Animated.View
                    style={[
                        styles.barFill,
                        {
                            width: widthAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0%', '100%'],
                            }),
                            opacity: completed > 0 ? glowOpacity : 1,
                        },
                    ]}
                />
            </View>
        </View>
    );
}

type Props = {
    data: StreakData | null;
    onPress?: () => void;
};

export function StreakCard({ data, onPress }: Props) {
    const flameAnim = useRef(new Animated.Value(1)).current;

    const streak = data?.currentStreak ?? 0;
    const best = data?.bestStreak ?? 0;
    const challengesCompleted = data?.weeklyChallengesCompleted ?? 0;

    // Device timezone always wins — getResolvedTimezone ignores stale stored values.
    const tz = getResolvedTimezone(data ?? undefined);

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(flameAnim, { toValue: 1.14, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
                Animated.timing(flameAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, []);

    // buildWeekDates returns [Mon, Tue, Wed, Thu, Fri, Sat, Sun] in user timezone.
    const weekKeys = buildWeekDates(tz, 0);
    const todayKey = getDateKey(tz);
    const yesterdayKey = getYesterdayKey(tz);
    // getWeekdayIndex returns 0=Sun…6=Sat; convert to Mon=0 for DAY_LABELS index.
    const todayWday = getWeekdayIndex(tz);          // 0=Sun…6=Sat
    const todayIdx  = (todayWday + 6) % 7;           // Mon=0…Sun=6 for DAY_LABELS
    const weeklyActivity = data?.weeklyActivity ?? {};
    const lastWorkoutDate = data?.lastWorkoutDate ?? null;

    // Streak is alive if the last recorded workout was today or yesterday.
    // Does NOT require today's activity — this is the "continuing" indicator.
    const streakIsAlive = streak > 0 && (
        lastWorkoutDate === todayKey || lastWorkoutDate === yesterdayKey
    );

    const todayCompleted = !!weeklyActivity[todayKey];

    console.log('[Streak UI]', {
        todayKey,
        yesterdayKey,
        lastWorkoutDate,
        streakIsAlive,
        todayCompleted,
        isCurrentStreakDay: !todayCompleted && streakIsAlive,
        weeklyActivity,
    });

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
            {/* Main row: flame + dots + best */}
            <View style={styles.mainRow}>
                <View style={styles.leftBlock}>
                    <Animated.Text style={[styles.flameEmoji, { transform: [{ scale: flameAnim }] }]}>🔥</Animated.Text>
                    <Text style={styles.streakNumber}>{streak}</Text>
                    <Text style={styles.streakLabel}>Day{streak !== 1 ? 's' : ''}</Text>
                    <Text style={styles.motivationText} numberOfLines={1}>{motivationText(streak)}</Text>
                </View>

                <View style={styles.centerBlock}>
                    {weekKeys.map((key, i) => {
                        const isToday = key === todayKey;
                        const active = !!weeklyActivity[key];
                        // Glowing "you're on a streak, keep it going" state:
                        // today hasn't been completed yet, but the streak is still alive.
                        const isCurrentStreakDay = isToday && streakIsAlive && !active;
                        return (
                            <DayDot
                                key={key}
                                label={DAY_LABELS[i]}
                                active={active}
                                isToday={isToday}
                                isCurrentStreakDay={isCurrentStreakDay}
                                minutes={data?.weeklyMinutes?.[key]}
                            />
                        );
                    })}
                </View>

                <View style={styles.rightBlock}>
                    <Text style={styles.bestLabel}>Best</Text>
                    <Text style={styles.bestValue}>{best}d</Text>
                    <ChevronRight color="#4a6480" size={16} style={{ marginTop: 4 }} />
                </View>
            </View>

            {/* Challenges progress */}
            <ChallengesBar completed={challengesCompleted} />
        </TouchableOpacity>
    );
}

const DOT_SIZE = 36;

const styles = StyleSheet.create({
    card: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER,
        marginHorizontal: 16,
        marginBottom: 12,
        paddingVertical: 14,
        paddingHorizontal: 10,
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    leftBlock: { alignItems: 'center', minWidth: 50 },
    flameEmoji: { fontSize: 22, lineHeight: 26 },
    streakNumber: { color: '#ffffff', fontSize: 24, fontWeight: '800', lineHeight: 28 },
    streakLabel: { color: ACCENT, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
    motivationText: { color: '#4a6480', fontSize: 9, fontWeight: '500', marginTop: 2, textAlign: 'center' },
    centerBlock: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dayCol: { alignItems: 'center', gap: 5 },
    dayDot: {
        width: DOT_SIZE,
        height: DOT_SIZE,
        borderRadius: DOT_SIZE / 2,
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    // Completed day — solid orange fill + glow
    dayDotActive: {
        backgroundColor: '#FF7A00',
        borderColor: '#FF7A00',
        borderWidth: 2,
        shadowColor: '#FF7A00',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    // Today, streak alive, not yet completed — orange ring, dark center
    dayDotStreakActive: {
        backgroundColor: '#1A2238',
        borderColor: '#FF7A00',
        borderWidth: 2,
        shadowColor: '#FF7A00',
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    // Today, streak broken — faint orange border only
    dayDotToday: {
        borderColor: ACCENT,
        borderWidth: 2,
    },
    dayLabel: { color: '#3a5470', fontSize: 11, fontWeight: '600' },
    dayLabelActive: { color: ACCENT },
    dayLabelStreakActive: { color: ACCENT },
    dayDotText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800',
        lineHeight: 16,
        textAlign: 'center',
    },
    rightBlock: { alignItems: 'center', minWidth: 28 },
    bestLabel: { color: '#3a5470', fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    bestValue: { color: '#8aaccc', fontSize: 13, fontWeight: '700' },

    // Challenges section
    challengesSection: { marginTop: 10 },
    challengesDivider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginBottom: 8,
    },
    challengesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    challengesLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    challengesLabel: {
        color: '#8aaccc',
        fontSize: 11,
        fontWeight: '600',
    },
    challengesCount: {
        color: ACCENT,
        fontSize: 11,
        fontWeight: '700',
    },
    challengesCountSuffix: {
        color: '#4a6480',
        fontSize: 10,
        fontWeight: '500',
    },
    barTrack: {
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.07)',
        overflow: 'hidden',
    },
    barFill: {
        height: 4,
        borderRadius: 2,
        backgroundColor: ACCENT,
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 4,
    },
});
