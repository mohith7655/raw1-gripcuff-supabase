/**
 * ScheduleChallengeModal — schedule a head-to-head exercise challenge with a
 * specific person for a future time. Opened from the "Open to Challenge" chips
 * on someone's profile: tap an exercise → pick a date/time + duration → an
 * invite is sent that lands in their Sessions tab to accept later.
 *
 * Mirrors ScheduleSessionModal's date/time UX, but writes a scheduled
 * `challenge_sessions` row (scheduled_at set) rather than a workout session, so
 * it never triggers the instant challenge alert.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native';
import { X, Clock, CalendarDays, Swords, Check, Timer } from 'lucide-react-native';
import { TimeArrowPicker } from './TimeArrowPicker';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { TierAvatar } from './profile/TierAvatar';
import { ChallengeSessionService } from '../services/challengeSession.service';
import { NotificationService } from '../services/notification.service';

const ACCENT = '#F25912';

type Step = 'config' | 'sending' | 'done' | 'error';

const DURATION_OPTIONS = [
    { label: '1 min', secs: 60 },
    { label: '3 min', secs: 180 },
    { label: '5 min', secs: 300 },
];

interface Props {
    visible: boolean;
    opponentUid: string;
    opponentName: string;
    opponentAvatar?: string | null;
    /** Exercise label as displayed on the chip, e.g. "Squats". */
    exerciseName: string;
    onClose: () => void;
    /** Called after a challenge is successfully scheduled. */
    onScheduled?: () => void;
}

export function ScheduleChallengeModal({
    visible, opponentUid, opponentName, opponentAvatar, exerciseName, onClose, onScheduled,
}: Props) {
    const { supabaseUserId } = useAuth() as any;
    const { profile } = useUser();

    const [step, setStep] = useState<Step>('config');
    const [selectedDateIdx, setSelectedDateIdx] = useState(0);
    const [durationSecs, setDurationSecs] = useState(60);
    const [errorMsg, setErrorMsg] = useState('Could not schedule the challenge.');
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    const getLocalNow = () => {
        const now = new Date();
        const h24 = now.getHours();
        const minute = Math.round(now.getMinutes() / 5) * 5 % 60;
        const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
        const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
        return { displayHour: hour12, amPm: period, selectedMinute: minute };
    };
    const _now = getLocalNow();
    const [displayHour, setDisplayHour] = useState(_now.displayHour);
    const [amPm, setAmPm] = useState<'AM' | 'PM'>(_now.amPm);
    const [selectedMinute, setSelectedMinute] = useState(_now.selectedMinute);

    const selectedHour = amPm === 'AM'
        ? (displayHour === 12 ? 0 : displayHour)
        : (displayHour === 12 ? 12 : displayHour + 12);

    const dateOptions = useMemo(() => Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        d.setHours(0, 0, 0, 0);
        return d;
    }), []);

    // Reset to defaults each time the modal opens.
    useEffect(() => {
        if (!visible) return;
        const { displayHour: h, amPm: a, selectedMinute: m } = getLocalNow();
        setDisplayHour(h);
        setAmPm(a);
        setSelectedMinute(m);
        setSelectedDateIdx(0);
        setDurationSecs(60);
        setStep('config');
        setErrorMsg('Could not schedule the challenge.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    const scheduledAt = useMemo(() => {
        const d = new Date(dateOptions[selectedDateIdx]);
        d.setHours(selectedHour, selectedMinute, 0, 0);
        return d;
    }, [dateOptions, selectedDateIdx, selectedHour, selectedMinute]);

    const labelForDay = (d: Date) => {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        if (d.getTime() === today.getTime()) return 'Today';
        if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    };
    const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fmtMin = (m: number) => String(m).padStart(2, '0');
    const scheduledSummary =
        `${labelForDay(dateOptions[selectedDateIdx])}, ${shortDate(dateOptions[selectedDateIdx])} at ${displayHour}:${fmtMin(selectedMinute)} ${amPm}`;

    const selfName =
        profile?.fullName || profile?.username || 'Someone';

    const handleSchedule = async () => {
        if (!supabaseUserId || !opponentUid) {
            setErrorMsg('You need to be signed in to schedule a challenge.');
            setStep('error');
            return;
        }
        if (scheduledAt.getTime() <= Date.now()) {
            setErrorMsg('Pick a time in the future.');
            setStep('error');
            return;
        }
        setStep('sending');
        try {
            const session = await ChallengeSessionService.create({
                hostId: supabaseUserId,
                guestId: opponentUid,
                exerciseName,
                durationSeconds: durationSecs,
                scheduledAt,
            });

            await NotificationService.insert({
                toUid: opponentUid,
                fromUid: supabaseUserId,
                fromName: selfName,
                type: 'challenge_invite',
                title: '🗓️ Scheduled Challenge',
                body: `${selfName} scheduled a ${durationSecs / 60} min ${exerciseName} challenge for ${scheduledSummary}.`,
                sessionId: session.id,
            }).catch(() => {});

            if (!mountedRef.current) return;
            setStep('done');
            onScheduled?.();
            setTimeout(() => { if (mountedRef.current) onClose(); }, 1800);
        } catch (e: any) {
            console.error('[ScheduleChallengeModal] schedule failed:', e);
            if (mountedRef.current) {
                setErrorMsg(e?.message ?? 'Could not schedule the challenge.');
                setStep('error');
            }
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity
                style={s.backdrop}
                activeOpacity={1}
                onPress={step === 'config' ? onClose : undefined}
            />

            <View style={s.sheet}>
                <View style={s.handle} />

                <View style={s.header}>
                    <View style={{ width: 36 }} />
                    <Text style={s.title}>
                        {step === 'done' ? 'Scheduled!' : step === 'error' ? 'Something went wrong' : 'Schedule Challenge'}
                    </Text>
                    <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                        <X color="#aaa" size={20} />
                    </TouchableOpacity>
                </View>

                {/* Opponent + exercise banner */}
                <View style={s.banner}>
                    <TierAvatar uri={opponentAvatar} size={44} uid={opponentUid} name={opponentName} radius={10} showBadge={false} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={s.bannerMeta} numberOfLines={1}>CHALLENGE</Text>
                        <Text style={s.bannerTitle} numberOfLines={1}>
                            {exerciseName} · vs {opponentName}
                        </Text>
                    </View>
                    <Swords size={20} color={ACCENT} strokeWidth={2.2} />
                </View>

                {step === 'config' && (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Date */}
                        <View style={s.sectionHeader}>
                            <CalendarDays color={ACCENT} size={15} />
                            <Text style={s.sectionLabel}>Date</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                            {dateOptions.map((d, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={[s.dateChip, selectedDateIdx === i && s.chipActive]}
                                    onPress={() => setSelectedDateIdx(i)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[s.chipTopText, selectedDateIdx === i && s.chipTextActive]}>{labelForDay(d)}</Text>
                                    <Text style={[s.chipBotText, selectedDateIdx === i && s.chipTextActive]}>{shortDate(d)}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Time */}
                        <View style={s.sectionHeader}>
                            <Clock color={ACCENT} size={15} />
                            <Text style={s.sectionLabel}>Time</Text>
                        </View>
                        <View style={s.pickerWrap}>
                            <TimeArrowPicker
                                hour={displayHour}
                                minute={selectedMinute}
                                amPm={amPm}
                                onHourChange={setDisplayHour}
                                onMinuteChange={setSelectedMinute}
                                onAmPmChange={setAmPm}
                                minuteStep={5}
                            />
                        </View>

                        {/* Duration */}
                        <View style={s.sectionHeader}>
                            <Timer color={ACCENT} size={15} />
                            <Text style={s.sectionLabel}>Duration</Text>
                        </View>
                        <View style={s.durationRow}>
                            {DURATION_OPTIONS.map(opt => (
                                <TouchableOpacity
                                    key={opt.secs}
                                    style={[s.durationChip, durationSecs === opt.secs && s.chipActive]}
                                    onPress={() => setDurationSecs(opt.secs)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[s.durationText, durationSecs === opt.secs && s.chipTextActive]}>{opt.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Summary */}
                        <View style={s.summaryBox}>
                            <Clock color={ACCENT} size={14} />
                            <Text style={s.summaryText}>{scheduledSummary}</Text>
                        </View>

                        <TouchableOpacity style={s.primaryBtn} onPress={handleSchedule} activeOpacity={0.85}>
                            <Swords color="#fff" size={16} />
                            <Text style={s.primaryBtnText}>Send Challenge</Text>
                        </TouchableOpacity>

                        <View style={{ height: 16 }} />
                    </ScrollView>
                )}

                {step === 'sending' && (
                    <View style={s.centered}>
                        <ActivityIndicator color={ACCENT} size="large" />
                        <Text style={s.statusText}>Sending challenge…</Text>
                        <Text style={s.statusSub}>{scheduledSummary}</Text>
                    </View>
                )}

                {step === 'done' && (
                    <View style={s.centered}>
                        <View style={s.successIcon}>
                            <Check color="#fff" size={32} />
                        </View>
                        <Text style={s.statusText}>Challenge scheduled!</Text>
                        <Text style={s.statusSub}>
                            It’ll appear in {opponentName}’s Sessions tab to accept. Both of you can join at the scheduled time.
                        </Text>
                    </View>
                )}

                {step === 'error' && (
                    <View style={s.centered}>
                        <Text style={s.statusText}>Something went wrong</Text>
                        <Text style={s.statusSub}>{errorMsg}</Text>
                        <TouchableOpacity style={[s.primaryBtn, { marginTop: 20 }]} onPress={() => setStep('config')} activeOpacity={0.85}>
                            <Text style={s.primaryBtnText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
    sheet: {
        backgroundColor: '#EEEEF2',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: '88%',
    },
    handle: {
        width: 40, height: 4, backgroundColor: '#333', borderRadius: 2,
        alignSelf: 'center', marginTop: 10, marginBottom: 4,
    },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14,
    },
    closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    title: { color: '#211832', fontSize: 17, fontWeight: '700' },
    banner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(242,89,18,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(242,89,18,0.2)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    bannerMeta: {
        color: 'rgba(242,89,18,0.7)', fontSize: 10, fontWeight: '600',
        letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2,
    },
    bannerTitle: { color: '#211832', fontSize: 13, fontWeight: '600' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 12 },
    sectionLabel: {
        color: 'rgba(33,24,50,0.45)', fontSize: 11, fontWeight: '600',
        letterSpacing: 0.5, textTransform: 'uppercase',
    },
    chipRow: { gap: 8, paddingBottom: 4 },
    dateChip: {
        minWidth: 64, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(33,24,50,0.08)',
    },
    chipActive: { backgroundColor: 'rgba(242,89,18,0.15)', borderColor: ACCENT },
    chipTopText: { color: '#7A7C90', fontSize: 12, fontWeight: '600' },
    chipBotText: { color: '#7A7C90', fontSize: 11, marginTop: 2 },
    chipTextActive: { color: ACCENT },
    pickerWrap: { marginVertical: 16, alignItems: 'center' },
    durationRow: { flexDirection: 'row', gap: 8 },
    durationChip: {
        flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(33,24,50,0.08)',
    },
    durationText: { color: '#7A7C90', fontSize: 14, fontWeight: '700' },
    summaryBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(242,89,18,0.08)', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 10, marginTop: 16, marginBottom: 12,
    },
    summaryText: { color: ACCENT, fontSize: 14, fontWeight: '600', flex: 1 },
    primaryBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14,
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    centered: { alignItems: 'center', paddingTop: 32, paddingBottom: 8 },
    successIcon: {
        width: 72, height: 72, borderRadius: 36, backgroundColor: '#10B981',
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    statusText: { color: '#211832', fontSize: 18, fontWeight: '700', marginTop: 16, marginBottom: 6, textAlign: 'center' },
    statusSub: { color: '#7A7C90', fontSize: 14, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20 },
});
