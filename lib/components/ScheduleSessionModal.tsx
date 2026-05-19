import React, { useState, useMemo, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Image,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { X, Clock, CalendarDays, PlayCircle, Check, ChevronLeft } from 'lucide-react-native';
import { CircleUserRound } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useFriend } from '../providers/FriendContext';
import { useInvite } from '../hooks/useInvite';
import type { User } from '../models/User';

const ACCENT = '#FF6B00';
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

type Step = 'datetime' | 'friends' | 'sending' | 'done' | 'error';

interface Props {
    visible: boolean;
    videoId: string;
    videoTitle: string;
    category?: string;
    programName?: string;
    selectedWorkout?: { id?: string; title?: string } | null;
    selectedProgram?: { id?: string; title?: string } | null;
    selectedCategory?: { id?: string; title?: string } | null;
    thumbnail?: string;
    onClose: () => void;
}

export function ScheduleSessionModal({
    visible,
    videoId,
    videoTitle,
    category,
    programName,
    selectedWorkout: _selectedWorkout,
    selectedProgram: _selectedProgram,
    selectedCategory: _selectedCategory,
    thumbnail,
    onClose,
}: Props) {
    const navigation = useNavigation<any>();
    const { friends } = useFriend();
    const { sendInvite } = useInvite();

    const [step, setStep] = useState<Step>('datetime');
    const [selectedDateIdx, setSelectedDateIdx] = useState(0);
    const [selectedHour, setSelectedHour] = useState(() => {
        const h = new Date().getHours() + 1;
        return h > 23 ? 0 : h;
    });
    const [selectedMinute, setSelectedMinute] = useState(0);

    const mountedRef = useRef(true);

    // Generate today + next 6 days
    const dateOptions = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            d.setHours(0, 0, 0, 0);
            return d;
        });
    }, []);

    const scheduledAt = useMemo(() => {
        const d = new Date(dateOptions[selectedDateIdx]);
        d.setHours(selectedHour, selectedMinute, 0, 0);
        return d;
    }, [dateOptions, selectedDateIdx, selectedHour, selectedMinute]);

    const resetAndClose = () => {
        setStep('datetime');
        setSelectedDateIdx(0);
        onClose();
    };

    const handleSelectFriend = async (friend: User) => {
        setStep('sending');
        try {
            const res = await sendInvite({
                type: 'scheduled_workout',
                toUid: friend.uid,
                toName: friend.fullName ?? friend.username,
                toAvatarUrl: friend.profileImageUrl ?? null,
                videoId,
                videoTitle,
                scheduledAt,
                betCredits: 0,
                inviteType: 'scheduled',
                category,
                programName,
                thumbnail,
            });
            if (!mountedRef.current) return;
            if (res.success && res.sessionId) {
                setStep('done');
                setTimeout(() => {
                    if (!mountedRef.current) return;
                    resetAndClose();
                }, 1800);
            } else {
                setStep('error');
            }
        } catch {
            if (mountedRef.current) setStep('error');
        }
    };

    const labelForDay = (d: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        if (d.getTime() === today.getTime()) return 'Today';
        if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    };

    const shortDate = (d: Date) =>
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const formatHour = (h: number) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${h12} ${ampm}`;
    };

    const formatMinute = (m: number) => (m === 0 ? '00' : String(m));

    const scheduledSummary =
        `${labelForDay(dateOptions[selectedDateIdx])}, ${shortDate(dateOptions[selectedDateIdx])} at ${formatHour(selectedHour)}:${formatMinute(selectedMinute)}`;

    const stepTitle =
        step === 'datetime' ? 'Schedule Workout' :
        step === 'friends'  ? 'Invite a Friend' :
        step === 'done'     ? 'Scheduled!' :
        step === 'error'    ? 'Something went wrong' :
        'Scheduling…';

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={resetAndClose}>
            <TouchableOpacity
                style={s.backdrop}
                activeOpacity={1}
                onPress={step === 'datetime' || step === 'friends' ? resetAndClose : undefined}
            />

            <View style={s.sheet}>
                <View style={s.handle} />

                {/* Header */}
                <View style={s.header}>
                    {step === 'friends' ? (
                        <TouchableOpacity onPress={() => setStep('datetime')} style={s.backBtn}>
                            <ChevronLeft color="#aaa" size={22} />
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 36 }} />
                    )}
                    <Text style={s.title}>{stepTitle}</Text>
                    <TouchableOpacity onPress={resetAndClose} style={s.closeBtn}>
                        <X color="#aaa" size={20} />
                    </TouchableOpacity>
                </View>

                {/* Workout context banner */}
                <View style={s.workoutBanner}>
                    {thumbnail ? (
                        <Image source={{ uri: thumbnail }} style={s.thumb} />
                    ) : (
                        <View style={s.thumbPlaceholder}>
                            <PlayCircle color={ACCENT} size={18} />
                        </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        {(category || programName) && (
                            <Text style={s.bannerMeta} numberOfLines={1}>
                                {[category, programName].filter(Boolean).join(' · ')}
                            </Text>
                        )}
                        <Text style={s.bannerTitle} numberOfLines={1}>{videoTitle}</Text>
                    </View>
                </View>

                {/* ── STEP 1: Date & Time ── */}
                {step === 'datetime' && (
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Date */}
                        <View style={s.sectionHeader}>
                            <CalendarDays color={ACCENT} size={15} />
                            <Text style={s.sectionLabel}>Date</Text>
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
                                    <Text style={[s.chipTopText, selectedDateIdx === i && s.chipTextActive]}>
                                        {labelForDay(d)}
                                    </Text>
                                    <Text style={[s.chipBotText, selectedDateIdx === i && s.chipTextActive]}>
                                        {shortDate(d)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Hour */}
                        <View style={s.sectionHeader}>
                            <Clock color={ACCENT} size={15} />
                            <Text style={s.sectionLabel}>Hour</Text>
                        </View>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={s.chipRow}
                        >
                            {HOURS.map((h) => (
                                <TouchableOpacity
                                    key={h}
                                    style={[s.hourChip, selectedHour === h && s.chipActive]}
                                    onPress={() => setSelectedHour(h)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[s.hourText, selectedHour === h && s.chipTextActive]}>
                                        {formatHour(h)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Minute */}
                        <View style={s.sectionHeader}>
                            <Clock color={ACCENT} size={15} />
                            <Text style={s.sectionLabel}>Minute</Text>
                        </View>
                        <View style={s.minuteRow}>
                            {MINUTES.map((m) => (
                                <TouchableOpacity
                                    key={m}
                                    style={[s.minuteChip, selectedMinute === m && s.chipActive]}
                                    onPress={() => setSelectedMinute(m)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[s.minuteText, selectedMinute === m && s.chipTextActive]}>
                                        :{formatMinute(m)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Summary */}
                        <View style={s.summaryBox}>
                            <Clock color={ACCENT} size={14} />
                            <Text style={s.summaryText}>{scheduledSummary}</Text>
                        </View>

                        <TouchableOpacity
                            style={s.primaryBtn}
                            onPress={() => setStep('friends')}
                            activeOpacity={0.85}
                        >
                            <Text style={s.primaryBtnText}>Next — Choose Friend</Text>
                        </TouchableOpacity>

                        <View style={{ height: 16 }} />
                    </ScrollView>
                )}

                {/* ── STEP 2: Friend List ── */}
                {step === 'friends' && (
                    <>
                        <View style={s.scheduledBadge}>
                            <Clock color={ACCENT} size={13} />
                            <Text style={s.scheduledBadgeText}>{scheduledSummary}</Text>
                        </View>

                        {friends.length === 0 ? (
                            <View style={s.empty}>
                                <Text style={s.emptyText}>No friends yet. Add some first!</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={friends}
                                keyExtractor={(f) => f.uid}
                                style={s.list}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={s.friendRow}
                                        onPress={() => handleSelectFriend(item)}
                                        activeOpacity={0.75}
                                    >
                                        {item.profileImageUrl ? (
                                            <Image source={{ uri: item.profileImageUrl }} style={s.avatar} />
                                        ) : (
                                            <CircleUserRound color={ACCENT} size={38} />
                                        )}
                                        <View style={s.friendInfo}>
                                            <Text style={s.friendName}>{item.fullName || item.username}</Text>
                                            <Text style={s.friendHandle}>@{item.username}</Text>
                                        </View>
                                        <View style={s.scheduleChip}>
                                            <Text style={s.scheduleChipText}>Schedule</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </>
                )}

                {/* ── Sending ── */}
                {step === 'sending' && (
                    <View style={s.centered}>
                        <ActivityIndicator color={ACCENT} size="large" />
                        <Text style={s.statusText}>Scheduling session…</Text>
                        <Text style={s.statusSub}>{scheduledSummary}</Text>
                    </View>
                )}

                {/* ── Done ── */}
                {step === 'done' && (
                    <View style={s.centered}>
                        <View style={s.successIcon}>
                            <Check color="#fff" size={32} />
                        </View>
                        <Text style={s.statusText}>Session scheduled!</Text>
                        <Text style={s.statusSub}>
                            It will appear in your Sessions tab once your friend accepts.
                        </Text>
                    </View>
                )}

                {/* ── Error ── */}
                {step === 'error' && (
                    <View style={s.centered}>
                        <Text style={s.statusText}>Could not schedule the session.</Text>
                        <TouchableOpacity
                            style={s.primaryBtn}
                            onPress={() => setStep('friends')}
                            activeOpacity={0.85}
                        >
                            <Text style={s.primaryBtnText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    sheet: {
        backgroundColor: '#0f1923',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: '88%',
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
    },
    backBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    workoutBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,107,0,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.2)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    thumb: {
        width: 44,
        height: 44,
        borderRadius: 8,
        flexShrink: 0,
    },
    thumbPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 8,
        backgroundColor: 'rgba(255,107,0,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    bannerMeta: {
        color: 'rgba(255,107,0,0.7)',
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    bannerTitle: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
        marginTop: 12,
    },
    sectionLabel: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    chipRow: {
        gap: 8,
        paddingBottom: 4,
    },
    dateChip: {
        minWidth: 64,
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    chipActive: {
        backgroundColor: 'rgba(255,107,0,0.15)',
        borderColor: ACCENT,
    },
    chipTopText: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600',
    },
    chipBotText: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 2,
    },
    chipTextActive: {
        color: ACCENT,
    },
    hourChip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    hourText: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '600',
    },
    minuteRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 4,
    },
    minuteChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    minuteText: {
        color: '#94A3B8',
        fontSize: 15,
        fontWeight: '700',
    },
    summaryBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,107,0,0.08)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginTop: 16,
        marginBottom: 12,
    },
    summaryText: {
        color: ACCENT,
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    primaryBtn: {
        backgroundColor: ACCENT,
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    scheduledBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,107,0,0.1)',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 16,
    },
    scheduledBadgeText: {
        color: ACCENT,
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
    },
    list: {
        maxHeight: 300,
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
        backgroundColor: '#1a2530',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
    },
    friendInfo: {
        flex: 1,
        marginLeft: 12,
    },
    friendName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    friendHandle: {
        color: '#888',
        fontSize: 12,
        marginTop: 1,
    },
    scheduleChip: {
        backgroundColor: '#818CF8',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    scheduleChipText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    empty: {
        paddingVertical: 32,
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
    },
    centered: {
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 8,
    },
    successIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    statusText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
        marginBottom: 6,
        textAlign: 'center',
    },
    statusSub: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        paddingHorizontal: 24,
    },
});
