import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { PRE_RECORDED_PROGRAMS, PreRecordedProgram } from '../data/preRecordedPrograms';
import { getDateKey, getTimeSlot } from '../utils/streakDate';
import { getResolvedTimezone } from '../utils/timezone';

const ALL_PROGRAMS: PreRecordedProgram[] = Object.values(PRE_RECORDED_PROGRAMS).flat();

/**
 * Select today's challenge deterministically from the program list.
 * Seed changes every 12 hours using the user's LOCAL date and hour block,
 * not the UTC hour — so the challenge rotates at the user's local 00:00 and 12:00.
 */
function getTodaysChallenge(programs: PreRecordedProgram[], timezone: string): PreRecordedProgram | null {
    if (!programs.length) return null;
    const dateKey = getDateKey(timezone);                    // e.g. "2026-05-19"
    const timeSlot = getTimeSlot(timezone);                  // e.g. "14:35" in user tz
    const hourBlock = Math.floor(Number(timeSlot.split(':')[0]) / 12); // 0 or 1
    const seed = `${dateKey}-${hourBlock}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return programs[Math.abs(hash) % programs.length];
}

/**
 * Milliseconds until the next 12-hour boundary in the user's timezone.
 */
function msUntilNextBlock(timezone: string): number {
    const timeSlot = getTimeSlot(timezone); // "HH:MM"
    const [hStr, mStr] = timeSlot.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    const secondsNow = new Date().getSeconds();
    const elapsedInBlock = (h % 12) * 3600 + m * 60 + secondsNow;
    const remainingSeconds = 12 * 3600 - elapsedInBlock;
    return Math.max(0, remainingSeconds * 1000);
}

interface Props {
    /** IANA timezone string from the user's streak data. Falls back to device timezone. */
    timezone?: string;
}

export function TodaysChallengeCard({ timezone }: Props) {
    const navigation = useNavigation<any>();
    const tz = getResolvedTimezone({ timezone });

    const [challenge, setChallenge] = useState(() => getTodaysChallenge(ALL_PROGRAMS, tz));
    const [timeUntilRefresh, setTimeUntilRefresh] = useState('');

    // Re-select challenge when timezone prop changes (e.g. user data loads)
    useEffect(() => {
        setChallenge(getTodaysChallenge(ALL_PROGRAMS, tz));
    }, [tz]);

    // Countdown timer + auto-refresh at next 12-hour boundary in user timezone
    useEffect(() => {
        const update = () => {
            const ms = msUntilNextBlock(tz);
            const h = Math.floor(ms / 3_600_000);
            const m = Math.floor((ms % 3_600_000) / 60_000);
            const s = Math.floor((ms % 60_000) / 1_000);
            setTimeUntilRefresh(`${h}h ${m}m ${s}s`);
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [tz]);

    // Refresh challenge when the 12-hour boundary passes
    useEffect(() => {
        const ms = msUntilNextBlock(tz);
        const timer = setTimeout(() => {
            setChallenge(getTodaysChallenge(ALL_PROGRAMS, tz));
        }, ms + 500); // 500ms buffer
        return () => clearTimeout(timer);
    }, [tz]);

    if (!challenge) return null;

    const dayVideo = challenge.videos[0];
    const durationMin = dayVideo ? Math.round(dayVideo.duration / 60) : null;

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Today's Challenge</Text>
                <Text style={styles.refreshLabel}>🔄 Refreshes in {timeUntilRefresh}</Text>
            </View>
            <TouchableOpacity
                style={styles.challengeCard}
                onPress={() => dayVideo && navigation.navigate('VideoPlayer', {
                    videoId: dayVideo.id,
                    title: dayVideo.title,
                    videoUrl: dayVideo.videoUrl,
                    workoutId: challenge.id,
                    workoutTitle: challenge.title,
                    programName: challenge.title,
                    category: dayVideo.category,
                    allowInvite: true,
                    isChallengeVideo: true,
                })}
                activeOpacity={0.85}
            >
                <View style={styles.challengeAccent} />
                <View style={styles.challengeContent}>
                    <View style={styles.challengeTop}>
                        <View style={styles.challengeBadge}>
                            <Text style={styles.challengeBadgeText}>⚡ DAILY</Text>
                        </View>
                        {durationMin && (
                            <Text style={styles.challengeDuration}>{durationMin} min</Text>
                        )}
                    </View>
                    <Text style={styles.challengeProgramName}>
                        {dayVideo?.category?.toUpperCase() ?? 'WORKOUT'}
                    </Text>
                    <Text style={styles.challengeTitle} numberOfLines={2}>
                        {challenge.title}
                        {dayVideo ? ` — ${(() => { const m = dayVideo.id.match(/_d(\d+)$/); return m ? `Day ${m[1]}` : dayVideo.title; })()}` : ''}
                    </Text>
                    <View style={styles.challengeMeta}>
                        <Text style={styles.challengeMetaText}>💪 {challenge.level}</Text>
                        <Text style={styles.challengeMetaText}>📂 {dayVideo?.category || 'Workout'}</Text>
                    </View>
                    <View style={styles.challengeFooter}>
                        <Text style={styles.challengeStart}>Start Challenge →</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionContainer: {
        marginTop: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffffff',
    },
    refreshLabel: {
        fontSize: 11,
        color: '#8899aa',
    },
    challengeCard: {
        backgroundColor: '#0f1923',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#FF6B00',
        flexDirection: 'row',
        overflow: 'hidden',
        minHeight: 110,
    },
    challengeAccent: {
        width: 4,
        backgroundColor: '#FF6B00',
    },
    challengeContent: {
        flex: 1,
        padding: 14,
        gap: 6,
    },
    challengeTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    challengeBadge: {
        backgroundColor: 'rgba(255,107,0,0.15)',
        borderRadius: 4,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    challengeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FF6B00',
        letterSpacing: 0.5,
    },
    challengeDuration: {
        fontSize: 12,
        color: '#8899aa',
    },
    challengeProgramName: {
        fontSize: 11,
        color: '#FF6B00',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    challengeTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
        lineHeight: 22,
    },
    challengeMeta: {
        flexDirection: 'row',
        gap: 12,
    },
    challengeMetaText: {
        fontSize: 12,
        color: '#8899aa',
    },
    challengeFooter: {
        marginTop: 4,
    },
    challengeStart: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FF6B00',
    },
});
