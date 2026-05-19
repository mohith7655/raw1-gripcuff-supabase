import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Image,
    Keyboard,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Bell, CalendarDays, Check, ChevronLeft, Clock, PlayCircle, X } from 'lucide-react-native';
import { TimeArrowPicker } from './TimeArrowPicker';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../core/config/firebase';
import { WorkoutReminderService } from '../services/workoutReminder.service';
import { useAuth } from '../providers/AuthContext';

const ACCENT = '#FF6B00';
const BG = '#0f1923';
const SURFACE = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.08)';

const { width: SW } = Dimensions.get('window');

const LEAD_PRESETS = [
    { label: '5 min',  minutes: 5  },
    { label: '10 min', minutes: 10 },
    { label: '15 min', minutes: 15 },
    { label: '30 min', minutes: 30 },
    { label: '1 hr',   minutes: 60 },
];

const INTERVAL_PRESETS = [1, 2, 5, 10];

const RECUR_PRESETS = [
    { label: 'Every 15 min', minutes: 15 },
    { label: 'Every 30 min', minutes: 30 },
    { label: 'Every 1 hour', minutes: 60 },
    { label: 'Every 2 hours', minutes: 120 },
];

const MSG_PRESETS = [
    'Next set! 💪',
    'Keep going! 🔥',
    'Stay strong! ⚡',
];

type Step = 'datetime' | 'reminders' | 'saving' | 'done' | 'error';

interface Props {
    visible: boolean;
    videoId: string;
    videoTitle: string;
    workoutId?: string;
    workoutTitle?: string;
    category?: string;
    programName?: string;
    selectedWorkout?: { id?: string; title?: string } | null;
    selectedProgram?: { id?: string; title?: string } | null;
    selectedCategory?: { id?: string; title?: string } | null;
    thumbnail?: string;
    onClose: () => void;
}


export function SelfScheduleModal({
    visible,
    videoId,
    videoTitle,
    workoutId,
    workoutTitle,
    category,
    programName,
    selectedWorkout,
    selectedProgram,
    selectedCategory,
    thumbnail,
    onClose,
}: Props) {
    const { requireFirebaseUid } = useAuth();
    const mountedRef = useRef(true);
    const slideAnim = useRef(new Animated.Value(0)).current;
    // SW is the full screen width; subtract both sides of paddingHorizontal:20 from screen style
    const contentW = SW - 40;

    // ── Local-time initializer ──
    const getLocalNow = () => {
        const now = new Date();
        const h24 = now.getHours();
        const rawMin = now.getMinutes();
        const minute = Math.round(rawMin / 5) * 5 % 60;
        const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
        const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
        return { displayHour: hour12, amPm: period, selectedMinute: minute };
    };

    // ── Step 1: date / time ──
    const [selectedDateIdx, setSelectedDateIdx] = useState(0);
    const localNow = getLocalNow();
    const [displayHour, setDisplayHour]         = useState(localNow.displayHour);
    const [amPm, setAmPm]                       = useState<'AM' | 'PM'>(localNow.amPm);
    const [selectedMinute, setSelectedMinute]   = useState(localNow.selectedMinute);
    const [scheduleMode, setScheduleMode] = useState<'one_time' | 'recurring'>('one_time');
    const [recurringValue, setRecurringValue] = useState<number>(15);
    const [recurringUnit, setRecurringUnit] = useState<'minutes' | 'hours'>('minutes');

    // ── Step 2: reminders ──
    const [leadMinutes, setLeadMinutes]           = useState(10);
    const [intervalEnabled, setIntervalEnabled]   = useState(false);
    const [intervalMin, setIntervalMin]           = useState(5);
    const [showCustomInterval, setShowCustomInterval] = useState(false);
    const [customIntervalText, setCustomIntervalText] = useState('');
    const [message, setMessage]                   = useState(MSG_PRESETS[0]);
    const [showCustomMsg, setShowCustomMsg]       = useState(false);
    const [customMsgText, setCustomMsgText]       = useState('');
    const [useExerciseTimers, setUseExerciseTimers] = useState(true);

    const [step, setStep] = useState<Step>('datetime');

    // Re-initialize time to current local time each time the modal becomes visible
    useEffect(() => {
        if (!visible) return;
        const { displayHour: h, amPm: a, selectedMinute: m } = getLocalNow();
        setDisplayHour(h);
        setAmPm(a);
        setSelectedMinute(m);
        setSelectedDateIdx(0);
    }, [visible]);

    // ── Derived date options ──
    const dateOptions = useMemo(() =>
        Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            d.setHours(0, 0, 0, 0);
            return d;
        })
    , []);

    const selectedHour = useMemo(() =>
        amPm === 'AM' ? (displayHour === 12 ? 0 : displayHour)
                      : (displayHour === 12 ? 12 : displayHour + 12)
    , [displayHour, amPm]);

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
    const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const fmtMin = (m: number) => String(m).padStart(2, '0');

    const scheduledSummary = `${labelForDay(dateOptions[selectedDateIdx])}, ${shortDate(dateOptions[selectedDateIdx])} at ${displayHour}:${fmtMin(selectedMinute)} ${amPm}`;

    // ── Navigation ──
    const slideTo = (toVal: number, cb?: () => void) => {
        Animated.timing(slideAnim, {
            toValue: toVal,
            duration: 280,
            useNativeDriver: false,
        }).start(cb);
    };

    const goToReminders = () => {
        setStep('reminders');
        slideTo(-contentW);
    };

    const goBack = () => {
        slideTo(0, () => setStep('datetime'));
    };

    const resetAndClose = () => {
        setStep('datetime');
        slideAnim.setValue(0);
        const { displayHour: h, amPm: a, selectedMinute: m } = getLocalNow();
        setDisplayHour(h);
        setAmPm(a);
        setSelectedMinute(m);
        setSelectedDateIdx(0);
        setLeadMinutes(10);
        setIntervalEnabled(false);
        setIntervalMin(5);
        setShowCustomInterval(false);
        setCustomIntervalText('');
        setMessage(MSG_PRESETS[0]);
        setShowCustomMsg(false);
        setCustomMsgText('');
        setUseExerciseTimers(true);
        setScheduleMode('one_time');
        setRecurringValue(15);
        setRecurringUnit('minutes');
        onClose();
    };

    // ── Effective values ──
    const effectiveIntervalMin = showCustomInterval
        ? (parseInt(customIntervalText, 10) || 5)
        : intervalMin;
    const effectiveMessage = showCustomMsg ? customMsgText : message;

    // ── Save ──
    const handleSave = async () => {
        setStep('saving');
        try {
            const uid = requireFirebaseUid('SelfScheduleModal.handleSave');

            // Request native notification permission on non-web
            if (Platform.OS !== 'web') {
                const granted = await WorkoutReminderService.requestPermissions().catch(() => false);
                if (!granted) {
                    Alert.alert('Notifications Disabled', 'Enable notifications in Settings to get workout reminders.');
                    if (mountedRef.current) setStep('reminders');
                    return;
                }
            }

            if (scheduleMode === 'one_time') {
                const payload = {
                    userId:    uid,
                    workoutId: selectedWorkout?.id ?? workoutId ?? videoId,
                    workoutName: selectedWorkout?.title ?? workoutTitle ?? videoTitle,
                    videoId,
                    videoTitle,
                    category:    selectedCategory?.title ?? category    ?? '',
                    programName: selectedProgram?.title  ?? programName ?? '',
                    // Keep both fields for backward compatibility while server uses scheduledAt.
                    scheduledAt: scheduledAt,
                    scheduledFor: scheduledAt,
                    reminderLeadMinutes: leadMinutes,
                    reminderScheduledFor: new Date(scheduledAt.getTime() - leadMinutes * 60_000),
                    reminderSent: false,
                    notificationSent: false,
                    intervalAlerts: {
                        enabled: intervalEnabled,
                        intervalMinutes: effectiveIntervalMin,
                        message: effectiveMessage,
                    },
                    useExerciseTimers,
                    isPublic: true,
                    status: 'scheduled',
                    notificationIds: [],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                };
                console.log('[Reminder] reminder created', {
                    mode: 'one_time',
                    userId: uid,
                    workoutId: payload.workoutId,
                    scheduledAt: scheduledAt.toISOString(),
                    leadMinutes,
                });
                await addDoc(collection(db, 'scheduledWorkouts'), payload);
            } else {
                // Recurring reminder: schedule with WorkoutReminderService
                const intervalMinutes = recurringUnit === 'hours' ? recurringValue * 60 : recurringValue;
                await WorkoutReminderService.scheduleRecurringReminder({
                    uid,
                    videoId,
                    videoTitle,
                    workoutId: selectedWorkout?.id ?? workoutId ?? null,
                    workoutTitle: selectedWorkout?.title ?? workoutTitle ?? null,
                    scheduledAt,
                    intervalValue: recurringValue,
                    intervalUnit: recurringUnit,
                    thumbnail: thumbnail ?? null,
                    category: selectedCategory?.title ?? category ?? null,
                    programName: selectedProgram?.title ?? programName ?? null,
                });
            }

            if (!mountedRef.current) return;
            setStep('done');
            setTimeout(() => { if (mountedRef.current) resetAndClose(); }, 2200);
        } catch (err: any) {
            console.error('[SelfScheduleModal]', err?.message ?? err);
            if (!mountedRef.current) return;
            if (err?.message?.includes('scheduledAt must be in the future')) {
                Alert.alert('Invalid Time', 'Please pick a time in the future.');
                goBack();
            } else {
                setStep('error');
            }
        }
    };

    const isSliding = step === 'datetime' || step === 'reminders';

    return (
        <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={resetAndClose}>
            <View style={s.screen}>
                    {/* ── Header ── */}
                    <View style={s.header}>
                        {step === 'reminders' ? (
                            <TouchableOpacity onPress={goBack} style={s.iconBtn}>
                                <ChevronLeft color="#aaa" size={22} />
                            </TouchableOpacity>
                        ) : (
                            <View style={{ width: 36 }} />
                        )}
                        <Text style={s.title}>
                            {step === 'datetime' ? 'Schedule for Later'
                            : step === 'reminders' ? 'Set Reminders'
                            : step === 'saving'    ? 'Scheduling…'
                            : step === 'done'      ? 'Scheduled!'
                            : 'Something went wrong'}
                        </Text>
                        <TouchableOpacity onPress={resetAndClose} style={s.iconBtn}>
                            <X color="#aaa" size={20} />
                        </TouchableOpacity>
                    </View>

                    {/* ── Workout banner ── */}
                    {isSliding && (
                        <View style={s.banner}>
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
                    )}

                    {/* ══════════════════════════════════════════════
                        SLIDE CONTAINER — Step 1 & Step 2 side by side
                    ══════════════════════════════════════════════ */}
                    {isSliding && (
                        <View style={{ overflow: 'hidden' }}>
                            <Animated.View
                                style={{
                                    flexDirection: 'row',
                                    width: contentW * 2,
                                    transform: [{ translateX: slideAnim }],
                                }}
                            >
                                {/* ── STEP 1: Date & Time ── */}
                                <ScrollView
                                    style={{ width: contentW }}
                                    showsVerticalScrollIndicator={false}
                                    scrollEnabled={step === 'datetime'}
                                >
                                    <Label icon={<CalendarDays color={ACCENT} size={14} />} text="Date" />
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                                        {dateOptions.map((d, i) => (
                                            <TouchableOpacity
                                                key={i}
                                                style={[s.dateChip, selectedDateIdx === i && s.chipActive]}
                                                onPress={() => setSelectedDateIdx(i)}
                                                activeOpacity={0.75}
                                            >
                                                <Text style={[s.chipTopText, selectedDateIdx === i && s.chipActiveText]}>{labelForDay(d)}</Text>
                                                <Text style={[s.chipBotText, selectedDateIdx === i && s.chipActiveText]}>{shortDate(d)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    <Label icon={<Clock color={ACCENT} size={14} />} text="Time" />
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

                                    <View style={s.summaryAndSchedule}>
                                        <View style={s.summaryBoxInner}>
                                            <Clock color={ACCENT} size={14} />
                                            <Text style={s.summaryText}>{scheduledSummary}</Text>
                                        </View>
                                        {(scheduledAt.getTime() - Date.now()) < 10 * 60 * 1000 &&
                                         scheduledAt.getTime() > Date.now() && (
                                            <Text style={s.soonHint}>⚡ Reminder will trigger soon</Text>
                                        )}
                                    </View>{/* summaryAndSchedule */}

                                    <TouchableOpacity style={s.primaryBtn} onPress={goToReminders} activeOpacity={0.85}>
                                        <Text style={s.primaryBtnText}>Next — Set Reminders</Text>
                                    </TouchableOpacity>
                                    <View style={{ height: 20 }} />
                                </ScrollView>

                                {/* ── STEP 2: Reminders ── */}
                                <ScrollView
                                    style={{ width: contentW }}
                                    showsVerticalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                    scrollEnabled={step === 'reminders'}
                                >
                                    {/* Section 1 — Remind me before */}
                                    <Label icon={<Bell color={ACCENT} size={14} />} text="Remind me before" />
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                                        {LEAD_PRESETS.map(p => (
                                            <TouchableOpacity
                                                key={p.minutes}
                                                style={[s.chip, leadMinutes === p.minutes && s.chipActive]}
                                                onPress={() => setLeadMinutes(p.minutes)}
                                                activeOpacity={0.75}
                                            >
                                                <Text style={[s.chipText, leadMinutes === p.minutes && s.chipActiveText]}>{p.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>

                                    {/* Section 2 — Interval alerts */}
                                    <Label icon={<Bell color={ACCENT} size={14} />} text="Interval alerts" />
                                    <View style={s.toggleRow}>
                                        <Text style={s.toggleLabel}>Notify me every:</Text>
                                        <Switch
                                            value={intervalEnabled}
                                            onValueChange={setIntervalEnabled}
                                            trackColor={{ false: '#334155', true: 'rgba(255,107,0,0.4)' }}
                                            thumbColor={intervalEnabled ? ACCENT : '#94A3B8'}
                                        />
                                    </View>

                                    {intervalEnabled && (
                                        <View>
                                            {/* Interval chips */}
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.chipRow, { marginTop: 10 }]}>
                                                {INTERVAL_PRESETS.map(m => (
                                                    <TouchableOpacity
                                                        key={m}
                                                        style={[s.chip, intervalMin === m && !showCustomInterval && s.chipActive]}
                                                        onPress={() => { setIntervalMin(m); setShowCustomInterval(false); }}
                                                        activeOpacity={0.75}
                                                    >
                                                        <Text style={[s.chipText, intervalMin === m && !showCustomInterval && s.chipActiveText]}>{m} min</Text>
                                                    </TouchableOpacity>
                                                ))}
                                                <TouchableOpacity
                                                    style={[s.chip, showCustomInterval && s.chipActive]}
                                                    onPress={() => setShowCustomInterval(v => !v)}
                                                    activeOpacity={0.75}
                                                >
                                                    <Text style={[s.chipText, showCustomInterval && s.chipActiveText]}>Custom</Text>
                                                </TouchableOpacity>
                                            </ScrollView>

                                            {showCustomInterval && (
                                                <TextInput
                                                    style={s.inlineInput}
                                                    placeholder="Minutes"
                                                    placeholderTextColor="#555"
                                                    keyboardType="number-pad"
                                                    returnKeyType="done"
                                                    onSubmitEditing={Keyboard.dismiss}
                                                    value={customIntervalText}
                                                    onChangeText={t => setCustomIntervalText(t.replace(/[^0-9]/g, ''))}
                                                />
                                            )}

                                            {/* Message chips */}
                                            <Text style={s.miniLabel}>MESSAGE</Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                                                {MSG_PRESETS.map(msg => (
                                                    <TouchableOpacity
                                                        key={msg}
                                                        style={[s.chip, message === msg && !showCustomMsg && s.chipActive]}
                                                        onPress={() => { setMessage(msg); setShowCustomMsg(false); }}
                                                        activeOpacity={0.75}
                                                    >
                                                        <Text style={[s.chipText, message === msg && !showCustomMsg && s.chipActiveText]}>{msg}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                                <TouchableOpacity
                                                    style={[s.chip, showCustomMsg && s.chipActive]}
                                                    onPress={() => setShowCustomMsg(v => !v)}
                                                    activeOpacity={0.75}
                                                >
                                                    <Text style={[s.chipText, showCustomMsg && s.chipActiveText]}>Custom</Text>
                                                </TouchableOpacity>
                                            </ScrollView>

                                            {showCustomMsg && (
                                                <TextInput
                                                    style={s.inlineInput}
                                                    placeholder="Your motivational message"
                                                    placeholderTextColor="#555"
                                                    returnKeyType="done"
                                                    onSubmitEditing={Keyboard.dismiss}
                                                    value={customMsgText}
                                                    onChangeText={setCustomMsgText}
                                                    maxLength={80}
                                                />
                                            )}
                                        </View>
                                    )}

                                    <TouchableOpacity style={[s.primaryBtn, { marginTop: 24 }]} onPress={handleSave} activeOpacity={0.85}>
                                        <Text style={s.primaryBtnText}>Schedule Workout</Text>
                                    </TouchableOpacity>
                                    <View style={{ height: 20 }} />
                                </ScrollView>
                            </Animated.View>
                        </View>
                    )}

                    {/* ── Saving ── */}
                    {step === 'saving' && (
                        <View style={s.centered}>
                            <ActivityIndicator color={ACCENT} size="large" />
                            <Text style={s.statusText}>Scheduling workout…</Text>
                            <Text style={s.statusSub}>{scheduledSummary}</Text>
                        </View>
                    )}

                    {/* ── Done ── */}
                    {step === 'done' && (
                        <View style={s.centered}>
                            <View style={s.successIcon}>
                                <Check color="#fff" size={32} />
                            </View>
                            <Text style={s.statusText}>Workout scheduled!</Text>
                            <Text style={s.statusSub}>{scheduledSummary}</Text>
                        </View>
                    )}

                    {/* ── Error ── */}
                    {step === 'error' && (
                        <View style={s.centered}>
                            <Text style={s.statusText}>Could not schedule the workout.</Text>
                            <TouchableOpacity
                                style={[s.primaryBtn, { marginTop: 20 }]}
                                onPress={() => setStep('reminders')}
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

// ── Shared sub-components ────────────────────────────────────────────────────
function Label({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <View style={s.labelRow}>
            {icon}
            <Text style={s.labelText}>{text}</Text>
        </View>
    );
}



// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: BG,
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
    },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: 14,
    },
    iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    title: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },

    banner: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,107,0,0.08)',
        borderWidth: 1, borderColor: 'rgba(255,107,0,0.2)',
        borderRadius: 12, padding: 12, marginBottom: 16,
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

    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 8 },
    labelText: {
        color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600',
        letterSpacing: 0.5, textTransform: 'uppercase',
    },
    miniLabel: {
        color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600',
        letterSpacing: 0.5, textTransform: 'uppercase',
        marginTop: 14, marginBottom: 8,
    },

    chipRow: { gap: 8, paddingBottom: 4 },

    dateChip: {
        minWidth: 64, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
        borderRadius: 12, backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    },
    chip: {
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
        backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    },
    chipActive: { backgroundColor: 'rgba(255,107,0,0.15)', borderColor: ACCENT },

    chipTopText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
    chipBotText: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
    chipText:    { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
    chipActiveText: { color: ACCENT },

    pickerWrap: {
        marginVertical: 12,
        alignItems: 'center',
    },

    summaryBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(255,107,0,0.08)', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 10, marginTop: 16, marginBottom: 12,
    },
    summaryText: { color: ACCENT, fontSize: 14, fontWeight: '600', flex: 1 },
    soonHint: {
        color: 'rgba(249,115,22,0.7)',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 6,
        textAlign: 'center',
    },

    primaryBtn: {
        backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 14, alignItems: 'center',
    },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    segmentRow: { flexDirection: 'row', marginTop: 8, gap: 8 },
    segmentBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: SURFACE,
        borderWidth: 1,
        borderColor: BORDER,
        alignItems: 'center',
    },
    segmentActive: { backgroundColor: 'rgba(255,107,0,0.18)', borderColor: ACCENT },
    segmentText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700' },
    segmentTextActive: { color: ACCENT },

    recurringCompact: { marginTop: 10 },
    scheduleWrapper: { marginTop: 18 },
    summaryAndSchedule: { marginTop: 20 },
    summaryBoxInner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(255,107,0,0.08)', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
        borderWidth: 1, borderColor: 'rgba(255,107,0,0.2)',
    },
    unitSelector: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: BORDER },
    unitBtn: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'transparent' },
    unitActive: { backgroundColor: 'rgba(255,107,0,0.12)' },
    unitText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
    unitTextActive: { color: ACCENT },

    toggleRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    toggleLabel: { color: '#fff', fontSize: 14, fontWeight: '500' },
    toggleSub:   { color: '#6B7280', fontSize: 12, marginTop: 2 },

    inlineInput: {
        marginTop: 8, backgroundColor: SURFACE, borderRadius: 12,
        borderWidth: 1, borderColor: BORDER,
        color: '#fff', fontSize: 14, paddingHorizontal: 14, paddingVertical: 12,
    },

    centered: { alignItems: 'center', paddingVertical: 48 },
    successIcon: {
        width: 72, height: 72, borderRadius: 36, backgroundColor: '#10B981',
        alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    },
    statusText: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
    statusSub:  { color: '#9CA3AF', fontSize: 14, textAlign: 'center', lineHeight: 22 },
});
