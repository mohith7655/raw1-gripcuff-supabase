/**
 * WorkoutTogetherModal
 *
 * Single self-contained bottom sheet for the entire "Workout Together" flow.
 * No external modals are opened — every step lives here.
 *
 * Step flow:
 *   datetime → sessionType → friendSelect (only for "Invite Friend")
 *                                ↓
 *                            saving → done | error
 *
 * Back navigation:
 *   friendSelect → sessionType  (resets selectedFriend)
 *   sessionType  → datetime     (resets selectedType)
 *   datetime     → close modal
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    CalendarClock,
    CalendarDays,
    Check,
    ChevronLeft,
    CircleUserRound,
    Clock,
    PlayCircle,
    Search,
    Users,
    X,
} from 'lucide-react-native';
import { TimeArrowPicker } from './TimeArrowPicker';
import { useFriend } from '../providers/FriendContext';
import { useInvite } from '../hooks/useInvite';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { WorkoutReminderService } from '../services/workoutReminder.service';
import type { User } from '../models/User';

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT  = '#FF6B00';
const BG      = '#0f1923';
const SURFACE = 'rgba(255,255,255,0.06)';
const BORDER  = 'rgba(255,255,255,0.08)';

// ── Types ─────────────────────────────────────────────────────────────────────
type Step =
    | 'datetime'
    | 'sessionType'
    | 'friendSelect'
    | 'saving'
    | 'done'
    | 'error';

export interface WorkoutTogetherModalProps {
    visible: boolean;
    videoId: string;
    videoTitle: string;
    workoutId?: string;
    workoutTitle?: string;
    category?: string;
    programName?: string;
    thumbnail?: string;
    /** Fires after a self-schedule or friend-invite completes. */
    onScheduled?: (type: 'self' | 'friend') => void;
    onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLocalNow() {
    const now   = new Date();
    const h24   = now.getHours();
    const rawMin = now.getMinutes();
    const minute = Math.round(rawMin / 5) * 5 % 60;
    const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { displayHour: hour12, amPm: period, selectedMinute: minute };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function WorkoutTogetherModal({
    visible,
    videoId,
    videoTitle,
    workoutId,
    workoutTitle,
    category,
    programName,
    thumbnail,
    onScheduled,
    onClose,
}: WorkoutTogetherModalProps) {
    const { friends }            = useFriend();
    const { sendInvite }         = useInvite();
    const { createSelfSession }  = useWorkoutSession();
    const mountedRef             = useRef(true);

    // ── Navigation ────────────────────────────────────────────────────────────
    const [currentStep,   setCurrentStep]   = useState<Step>('datetime');
    const [selectedType,  setSelectedType]  = useState<'self' | 'friend' | null>(null);
    const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
    const [searchQuery,   setSearchQuery]   = useState('');
    const [errorMsg,      setErrorMsg]      = useState('');

    // ── Date / time ───────────────────────────────────────────────────────────
    const [selectedDateIdx, setSelectedDateIdx] = useState(0);
    const localNow = getLocalNow();
    const [displayHour,    setDisplayHour]    = useState(localNow.displayHour);
    const [amPm,           setAmPm]           = useState<'AM' | 'PM'>(localNow.amPm);
    const [selectedMinute, setSelectedMinute] = useState(localNow.selectedMinute);

    // Full reset on every open
    useEffect(() => {
        if (!visible) return;
        mountedRef.current = true;
        const { displayHour: h, amPm: a, selectedMinute: m } = getLocalNow();
        setDisplayHour(h);
        setAmPm(a);
        setSelectedMinute(m);
        setSelectedDateIdx(0);
        setCurrentStep('datetime');
        setSelectedType(null);
        setSelectedFriend(null);
        setSearchQuery('');
        setErrorMsg('');
        return () => { mountedRef.current = false; };
    }, [visible]);

    // ── Derived date/time ─────────────────────────────────────────────────────
    const dateOptions = useMemo(() =>
        Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            d.setHours(0, 0, 0, 0);
            return d;
        }),
    []);

    const selectedHour = useMemo(() =>
        amPm === 'AM'
            ? (displayHour === 12 ? 0 : displayHour)
            : (displayHour === 12 ? 12 : displayHour + 12),
    [displayHour, amPm]);

    const scheduledAt = useMemo(() => {
        const d = new Date(dateOptions[selectedDateIdx]);
        d.setHours(selectedHour, selectedMinute, 0, 0);
        return d;
    }, [dateOptions, selectedDateIdx, selectedHour, selectedMinute]);

    const labelForDay = (d: Date) => {
        const today    = new Date(); today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
        if (d.getTime() === today.getTime())    return 'Today';
        if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    };
    const shortDate = (d: Date) =>
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fmtMin = (m: number) => String(m).padStart(2, '0');

    const scheduledSummary = `${labelForDay(dateOptions[selectedDateIdx])}, ${shortDate(dateOptions[selectedDateIdx])} at ${displayHour}:${fmtMin(selectedMinute)} ${amPm}`;

    // ── Filtered friends ──────────────────────────────────────────────────────
    const filteredFriends = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return friends;
        return friends.filter(f =>
            (f.fullName  ?? '').toLowerCase().includes(q) ||
            (f.username  ?? '').toLowerCase().includes(q),
        );
    }, [friends, searchQuery]);

    // ── Navigation ────────────────────────────────────────────────────────────
    const resetAndClose = () => {
        setCurrentStep('datetime');
        setSelectedType(null);
        setSelectedFriend(null);
        setSearchQuery('');
        setErrorMsg('');
        onClose();
    };

    const handleBack = () => {
        switch (currentStep) {
            case 'friendSelect':
                setSelectedFriend(null);
                setCurrentStep('sessionType');
                break;
            case 'sessionType':
                setSelectedType(null);
                setCurrentStep('datetime');
                break;
            default:
                resetAndClose();
        }
    };

    // ── CTA metadata ──────────────────────────────────────────────────────────
    const ctaLabel = useMemo(() => {
        if (currentStep === 'sessionType') {
            if (selectedType === 'self')   return 'Schedule Workout';
            if (selectedType === 'friend') return 'Choose Friend';
        }
        if (currentStep === 'friendSelect') return 'Send Invite';
        return 'Continue';
    }, [currentStep, selectedType]);

    const ctaDisabled =
        (currentStep === 'sessionType'  && selectedType   === null) ||
        (currentStep === 'friendSelect' && selectedFriend === null);

    // ── Save: self schedule ───────────────────────────────────────────────────
    const handleSelfSchedule = async () => {
        setCurrentStep('saving');
        try {
            // Request local notification permissions (best-effort, non-blocking)
            if (Platform.OS !== 'web') {
                await WorkoutReminderService.requestPermissions().catch(() => {});
            }

            // Write the session to Supabase — uses host's UID, no guest/invite row
            await createSelfSession(
                workoutId ?? videoId,
                workoutTitle ?? videoTitle,
                scheduledAt,
                { category, programName, thumbnail },
            );

            if (!mountedRef.current) return;
            setCurrentStep('done');
            onScheduled?.('self');
            setTimeout(() => { if (mountedRef.current) resetAndClose(); }, 1800);
        } catch (e: any) {
            if (mountedRef.current) {
                setErrorMsg(e?.message ?? 'Could not schedule. Please try again.');
                setCurrentStep('error');
            }
        }
    };

    // ── Save: send invite ─────────────────────────────────────────────────────
    const handleSendInvite = async (friend: User) => {
        setCurrentStep('saving');
        try {
            const result = await sendInvite({
                type:         'scheduled_workout',
                toUid:        friend.uid,
                toName:       friend.fullName ?? friend.username,
                toAvatarUrl:  friend.profileImageUrl ?? null,
                videoId,
                videoTitle,
                scheduledAt,
                inviteType:   'scheduled',
                category,
                programName,
                thumbnail,
            });
            if (!mountedRef.current) return;
            if (result.success) {
                setCurrentStep('done');
                onScheduled?.('friend');
                setTimeout(() => { if (mountedRef.current) resetAndClose(); }, 1800);
            } else {
                setErrorMsg(result.error ?? 'Could not send invite. Please try again.');
                setCurrentStep('error');
            }
        } catch (e: any) {
            if (mountedRef.current) {
                setErrorMsg(e?.message ?? 'Could not send invite. Please try again.');
                setCurrentStep('error');
            }
        }
    };

    // ── Main CTA dispatcher ───────────────────────────────────────────────────
    const handleCta = async () => {
        if (currentStep === 'datetime') {
            setCurrentStep('sessionType');
            return;
        }
        if (currentStep === 'sessionType') {
            if (selectedType === 'self')   await handleSelfSchedule();
            if (selectedType === 'friend') setCurrentStep('friendSelect');
            return;
        }
        if (currentStep === 'friendSelect' && selectedFriend) {
            await handleSendInvite(selectedFriend);
        }
    };

    // ── Header title ──────────────────────────────────────────────────────────
    const headerTitle = (() => {
        switch (currentStep) {
            case 'datetime':     return 'Workout Together';
            case 'sessionType':  return 'Choose Session Type';
            case 'friendSelect': return 'Select a Friend';
            case 'saving':       return 'Scheduling…';
            case 'done':         return selectedType === 'friend' ? 'Invite Sent!' : 'Scheduled!';
            case 'error':        return 'Something went wrong';
        }
    })();

    const isActive = ['datetime', 'sessionType', 'friendSelect'].includes(currentStep);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={resetAndClose}
        >
            <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={resetAndClose} />

            <View style={s.sheet}>
                <View style={s.handle} />

                {/* ── Header ── */}
                <View style={s.header}>
                    {['sessionType', 'friendSelect'].includes(currentStep) ? (
                        <TouchableOpacity onPress={handleBack} style={s.iconBtn}>
                            <ChevronLeft color="#aaa" size={22} />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 36 }} />
                    )}
                    <Text style={s.title}>{headerTitle}</Text>
                    <TouchableOpacity onPress={resetAndClose} style={s.iconBtn}>
                        <X color="#aaa" size={20} />
                    </TouchableOpacity>
                </View>

                {/* ── Workout banner ── */}
                {isActive && (
                    <View style={s.banner}>
                        {thumbnail ? (
                            <Image source={{ uri: thumbnail }} style={s.thumb} />
                        ) : (
                            <View style={s.thumbPlaceholder}>
                                <PlayCircle color={ACCENT} size={18} />
                            </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            {(category || programName) ? (
                                <Text style={s.bannerMeta} numberOfLines={1}>
                                    {[category, programName].filter(Boolean).join(' · ')}
                                </Text>
                            ) : null}
                            <Text style={s.bannerTitle} numberOfLines={1}>{videoTitle}</Text>
                        </View>
                    </View>
                )}

                {/* ════════════════════════════════════════
                    STEP 1 — Date & Time
                ════════════════════════════════════════ */}
                {currentStep === 'datetime' && (
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Date chips */}
                        <View style={s.labelRow}>
                            <CalendarDays color={ACCENT} size={14} />
                            <Text style={s.labelText}>Date</Text>
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={s.chipRow}
                        >
                            {dateOptions.map((d, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={[s.dateChip, selectedDateIdx === i && s.chipActive]}
                                    onPress={() => setSelectedDateIdx(i)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[s.chipTopText, selectedDateIdx === i && s.chipActiveText]}>
                                        {labelForDay(d)}
                                    </Text>
                                    <Text style={[s.chipBotText, selectedDateIdx === i && s.chipActiveText]}>
                                        {shortDate(d)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Time picker */}
                        <View style={s.labelRow}>
                            <Clock color={ACCENT} size={14} />
                            <Text style={s.labelText}>Time</Text>
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

                        {/* Summary */}
                        <View style={s.summaryBox}>
                            <Clock color={ACCENT} size={14} />
                            <Text style={s.summaryText}>{scheduledSummary}</Text>
                        </View>
                        <View style={{ height: 8 }} />
                    </ScrollView>
                )}

                {/* ════════════════════════════════════════
                    STEP 2 — Session type
                ════════════════════════════════════════ */}
                {currentStep === 'sessionType' && (
                    <View>
                        <View style={s.summaryBox}>
                            <Clock color={ACCENT} size={14} />
                            <Text style={s.summaryText}>{scheduledSummary}</Text>
                        </View>

                        <View style={s.optionRow}>
                            {/* Self Schedule */}
                            <TouchableOpacity
                                style={[s.optionCard, selectedType === 'self' && s.optionCardSelected]}
                                onPress={() => setSelectedType('self')}
                                activeOpacity={0.82}
                            >
                                <View style={[s.iconCircle, { backgroundColor: 'rgba(99,102,241,0.15)' }]}>
                                    <CalendarClock color="#818CF8" size={20} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.optionTitle}>Self Schedule</Text>
                                    <Text style={s.optionSub}>Workout privately on your own schedule</Text>
                                </View>
                            </TouchableOpacity>

                            {/* Invite Friend */}
                            <TouchableOpacity
                                style={[s.optionCard, selectedType === 'friend' && s.optionCardSelected]}
                                onPress={() => setSelectedType('friend')}
                                activeOpacity={0.82}
                            >
                                <View style={[s.iconCircle, { backgroundColor: 'rgba(255,107,0,0.12)' }]}>
                                    <Users color={ACCENT} size={20} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.optionTitle}>Invite Friend</Text>
                                    <Text style={s.optionSub}>Train together with a friend</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                        <View style={{ height: 8 }} />
                    </View>
                )}

                {/* ════════════════════════════════════════
                    STEP 3B — Friend selector
                ════════════════════════════════════════ */}
                {currentStep === 'friendSelect' && (
                    <View style={s.friendSelectWrap}>
                        {/* Search */}
                        <View style={s.searchRow}>
                            <Search color="#64748B" size={15} />
                            <TextInput
                                style={s.searchInput}
                                placeholder="Search friends…"
                                placeholderTextColor="#475569"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        {filteredFriends.length === 0 ? (
                            <View style={s.emptyState}>
                                <CircleUserRound color="#334155" size={36} />
                                <Text style={s.emptyText}>
                                    {friends.length === 0
                                        ? 'No friends yet. Add some first!'
                                        : 'No matches found.'}
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredFriends}
                                keyExtractor={f => f.uid}
                                style={s.friendList}
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            s.friendRow,
                                            selectedFriend?.uid === item.uid && s.friendRowSelected,
                                        ]}
                                        onPress={() => setSelectedFriend(item)}
                                        activeOpacity={0.78}
                                    >
                                        {item.profileImageUrl ? (
                                            <Image source={{ uri: item.profileImageUrl }} style={s.avatar} />
                                        ) : (
                                            <View style={s.avatarPlaceholder}>
                                                <CircleUserRound color={ACCENT} size={22} />
                                            </View>
                                        )}
                                        <View style={s.friendInfo}>
                                            <Text style={s.friendName} numberOfLines={1}>
                                                {item.fullName || item.username}
                                            </Text>
                                            <Text style={s.friendHandle}>@{item.username}</Text>
                                        </View>
                                        {selectedFriend?.uid === item.uid && (
                                            <View style={s.checkBadge}>
                                                <Check color="#fff" size={11} />
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                )}

                {/* ════════════════════════════════════════
                    STATUS screens — Saving / Done / Error
                ════════════════════════════════════════ */}
                {currentStep === 'saving' && (
                    <View style={s.statusWrap}>
                        <ActivityIndicator color={ACCENT} size="large" />
                        <Text style={s.statusTitle}>Scheduling…</Text>
                        <Text style={s.statusSub}>{scheduledSummary}</Text>
                    </View>
                )}

                {currentStep === 'done' && (
                    <View style={s.statusWrap}>
                        <View style={s.successCircle}>
                            <Check color="#fff" size={30} />
                        </View>
                        <Text style={s.statusTitle}>
                            {selectedType === 'friend' ? 'Invite Sent!' : 'Workout Scheduled!'}
                        </Text>
                        <Text style={s.statusSub}>{scheduledSummary}</Text>
                    </View>
                )}

                {currentStep === 'error' && (
                    <View style={s.statusWrap}>
                        <Text style={s.statusTitle}>Something went wrong</Text>
                        <Text style={s.statusSub}>{errorMsg}</Text>
                        <TouchableOpacity
                            style={[s.ctaBtn, { marginTop: 20 }]}
                            onPress={() =>
                                setCurrentStep(
                                    selectedType === 'friend' ? 'friendSelect' : 'sessionType',
                                )
                            }
                            activeOpacity={0.85}
                        >
                            <Text style={s.ctaBtnText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── Shared CTA button ── */}
                {isActive && (
                    <TouchableOpacity
                        style={[s.ctaBtn, ctaDisabled && s.ctaBtnDisabled]}
                        onPress={handleCta}
                        activeOpacity={0.85}
                        disabled={ctaDisabled}
                    >
                        <Text style={s.ctaBtnText}>{ctaLabel}</Text>
                    </TouchableOpacity>
                )}

                <View style={{ height: 16 }} />
            </View>
        </Modal>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    // Sheet
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    sheet: {
        backgroundColor: BG,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 8,
        maxHeight: '92%',
    },
    handle: {
        width: 40, height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10, marginBottom: 4,
    },

    // Header
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
    },
    iconBtn: {
        width: 36, height: 36,
        alignItems: 'center', justifyContent: 'center',
    },
    title: {
        color: '#fff', fontSize: 17, fontWeight: '700',
        flex: 1, textAlign: 'center',
    },

    // Banner
    banner: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,107,0,0.08)',
        borderWidth: 1, borderColor: 'rgba(255,107,0,0.2)',
        borderRadius: 12, padding: 12, marginBottom: 14,
    },
    thumb: { width: 44, height: 44, borderRadius: 8, flexShrink: 0 },
    thumbPlaceholder: {
        width: 44, height: 44, borderRadius: 8,
        backgroundColor: 'rgba(255,107,0,0.15)',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    bannerMeta: {
        color: 'rgba(255,107,0,0.7)', fontSize: 10, fontWeight: '600',
        letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 2,
    },
    bannerTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },

    // Date chips
    labelRow: {
        flexDirection: 'row', alignItems: 'center',
        gap: 6, marginTop: 12, marginBottom: 8,
    },
    labelText: {
        color: 'rgba(255,255,255,0.45)', fontSize: 11,
        fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase',
    },
    chipRow: { gap: 8, paddingBottom: 4 },
    dateChip: {
        minWidth: 64, alignItems: 'center',
        paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 12, backgroundColor: SURFACE,
        borderWidth: 1, borderColor: BORDER,
    },
    chipActive: { backgroundColor: 'rgba(255,107,0,0.15)', borderColor: ACCENT },
    chipTopText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
    chipBotText: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
    chipActiveText: { color: ACCENT },

    // Time picker
    pickerWrap: { marginVertical: 10, alignItems: 'center' },

    // Summary pill
    summaryBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(255,107,0,0.08)',
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
        marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,107,0,0.2)',
    },
    summaryText: { color: ACCENT, fontSize: 13, fontWeight: '600', flex: 1 },

    // Session type cards
    optionRow: { flexDirection: 'row', gap: 10 },
    optionCard: {
        flex: 1, flexDirection: 'column',
        alignItems: 'flex-start', gap: 8,
        backgroundColor: SURFACE,
        borderWidth: 1, borderColor: BORDER,
        borderRadius: 14, padding: 14,
    },
    optionCardSelected: {
        borderColor: ACCENT,
        backgroundColor: 'rgba(255,107,0,0.08)',
    },
    iconCircle: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
    },
    optionTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
    optionSub:   { color: '#64748B', fontSize: 11, lineHeight: 15, marginTop: 2 },

    // Friend selector
    friendSelectWrap: { flex: 1, minHeight: 220 },
    searchRow: {
        flexDirection: 'row', alignItems: 'center',
        gap: 8, backgroundColor: SURFACE,
        borderWidth: 1, borderColor: BORDER,
        borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
        marginBottom: 10,
    },
    searchInput: {
        flex: 1, color: '#fff', fontSize: 14,
        paddingVertical: 0,
    },
    friendList: { maxHeight: 260 },
    friendRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, paddingHorizontal: 4,
        borderRadius: 12, gap: 10,
        borderWidth: 1, borderColor: 'transparent',
        marginBottom: 2,
    },
    friendRowSelected: {
        backgroundColor: 'rgba(255,107,0,0.07)',
        borderColor: 'rgba(255,107,0,0.25)',
    },
    avatar: { width: 40, height: 40, borderRadius: 20, flexShrink: 0 },
    avatarPlaceholder: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,107,0,0.1)',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    friendInfo: { flex: 1 },
    friendName: { color: '#fff', fontSize: 14, fontWeight: '600' },
    friendHandle: { color: '#64748B', fontSize: 12, marginTop: 1 },
    checkBadge: {
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: ACCENT,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    emptyState: {
        alignItems: 'center', paddingVertical: 32, gap: 10,
    },
    emptyText: { color: '#475569', fontSize: 14, textAlign: 'center' },

    // Status screens
    statusWrap: {
        alignItems: 'center', paddingVertical: 36, gap: 8,
    },
    statusTitle: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
    statusSub:   { color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 20 },
    successCircle: {
        width: 68, height: 68, borderRadius: 34,
        backgroundColor: '#10B981',
        alignItems: 'center', justifyContent: 'center', marginBottom: 8,
    },

    // CTA button
    ctaBtn: {
        backgroundColor: ACCENT,
        borderRadius: 14, paddingVertical: 14,
        alignItems: 'center', marginTop: 6,
    },
    ctaBtnDisabled: { backgroundColor: 'rgba(255,107,0,0.35)' },
    ctaBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
