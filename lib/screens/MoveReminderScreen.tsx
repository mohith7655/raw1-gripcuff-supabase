import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, ScrollView, ActivityIndicator, TextInput, Modal, Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { ArrowLeft, Zap, ChevronRight } from 'lucide-react-native';
import { IntensityComparisonCard, ExerciseName } from '../components/IntensityComparisonCard';
import { TimeArrowPicker } from '../components/TimeArrowPicker';
import { AlarmPillSheet } from '../components/AlarmPillSheet';
import { AlarmListRow } from '../components/AlarmListRow';
import { ChallengeLobbyModal } from '../components/ChallengeLobbyModal';
import {
    MoveReminder, AlarmConfig, DEFAULT_MOVE_REMINDER, MoveReminderService,
    generateMoveTimes, timesToAlarmConfigs,
} from '../services/moveReminder.service';
import { reminderWatcherService } from '../services/reminderWatcher.service';

const ACCENT = '#F25912';
const CTA    = '#F25912';
const BG     = '#EEEEF2';
const CARD   = '#F8F8FC';
const BORDER = 'rgba(242,89,18,0.2)';

type IntervalMode = '1hr' | '2hr' | 'custom';
type ExerciseSelection = ExerciseName | 'Random';
const EXERCISE_OPTIONS: ExerciseName[] = ['Squats', 'Leaning Pullups'];

function resolveExercise(sel: ExerciseSelection): ExerciseName {
    return sel === 'Random'
        ? EXERCISE_OPTIONS[Math.floor(Math.random() * EXERCISE_OPTIONS.length)]
        : sel;
}

function to24h(hour: number, minute: number, amPm: 'AM' | 'PM') {
    let h = hour % 12;
    if (amPm === 'PM') h += 12;
    return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function from24h(t: string) {
    const [h, m] = t.split(':').map(Number);
    const amPm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    return { hour: h % 12 === 0 ? 12 : h % 12, minute: m, amPm };
}

type Params = { MoveReminderScreen: { userId: string } };

export function MoveReminderScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<Params, 'MoveReminderScreen'>>();
    const { userId } = route.params;

    const [loading,   setLoading]   = useState(true);
    const [saving,    setSaving]    = useState(false);
    const [saved,     setSaved]     = useState(false);
    const [reminderId, setReminderId] = useState<string | undefined>();
    const [enabled,   setEnabled]   = useState(DEFAULT_MOVE_REMINDER.enabled);
    const [intervalMode, setIntervalMode] = useState<IntervalMode>('1hr');
    const [customIntervalMins, setCustomIntervalMins] = useState('60');
    const [workoutDurationMin, setWorkoutDurationMin] = useState(DEFAULT_MOVE_REMINDER.workoutDurationMin);
    const [exerciseName, setExerciseName] = useState<ExerciseSelection>('Squats');
    const [pickerExercise, setPickerExercise] = useState<ExerciseName>('Squats');
    const [savedTimes, setSavedTimes] = useState<string[]>([]);
    const [alarmConfigs, setAlarmConfigs] = useState<AlarmConfig[]>([]);
    const [selectedAlarm, setSelectedAlarm] = useState<AlarmConfig | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [challengePickerVisible, setChallengePickerVisible] = useState(false);

    const defStart = from24h(DEFAULT_MOVE_REMINDER.startTime);
    const [startHour,   setStartHour]   = useState(defStart.hour);
    const [startMinute, setStartMinute] = useState(defStart.minute);
    const [startAmPm,   setStartAmPm]   = useState<'AM' | 'PM'>(defStart.amPm);

    const defEnd = from24h(DEFAULT_MOVE_REMINDER.endTime);
    const [endHour,   setEndHour]   = useState(defEnd.hour);
    const [endMinute, setEndMinute] = useState(defEnd.minute);
    const [endAmPm,   setEndAmPm]   = useState<'AM' | 'PM'>(defEnd.amPm);

    // Bottom-sheet time picker
    const [timeSheet, setTimeSheet] = useState<'start' | 'end' | null>(null);
    const sheetAnim = useRef(new Animated.Value(0)).current;

    const openTimeSheet = (which: 'start' | 'end') => {
        setTimeSheet(which);
        Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, bounciness: 4 }).start();
    };
    const closeTimeSheet = () => {
        Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setTimeSheet(null));
    };

    const fmtTime = (h: number, m: number, ap: 'AM' | 'PM') =>
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ap}`;

    const sliderWidthRef = useRef(0);
    const sliderLeftRef = useRef(0);
    const sliderRef = useRef<View>(null);
    const scrollRef = useRef<ScrollView>(null);

    // Measure the track's position/width in the window so drags map to the
    // correct value. We use pageX (absolute) rather than locationX, which on
    // React Native Web is relative to whichever child node the pointer is over
    // (the thumb/fill) and would otherwise snap the value back toward 1 min.
    const measureSlider = () => {
        sliderRef.current?.measureInWindow((x, _y, w) => {
            sliderLeftRef.current = x;
            if (w) sliderWidthRef.current = w;
        });
    };
    const setDurationFromPageX = (pageX: number) => {
        const w = sliderWidthRef.current || 1;
        const ratio = Math.min(Math.max((pageX - sliderLeftRef.current) / w, 0), 1);
        setWorkoutDurationMin(Math.max(1, Math.min(5, Math.round(ratio * 4) + 1)));
    };

    useEffect(() => {
        MoveReminderService.loadDefault(userId).then(r => {
            if (r) {
                setReminderId(r.id);
                setEnabled(r.enabled);
                const mins = r.intervalMinutes ?? 60;
                if (mins === 60) setIntervalMode('1hr');
                else if (mins === 120) setIntervalMode('2hr');
                else { setIntervalMode('custom'); setCustomIntervalMins(String(mins)); }
                setWorkoutDurationMin(Math.min(5, r.workoutDurationMin ?? 1));
                const s = from24h(r.startTime);
                setStartHour(s.hour); setStartMinute(s.minute); setStartAmPm(s.amPm);
                const e = from24h(r.endTime);
                setEndHour(e.hour); setEndMinute(e.minute); setEndAmPm(e.amPm);
                const times = r.generatedTimes ?? [];
                setSavedTimes(times);
                setAlarmConfigs(r.alarmConfigs?.length ? r.alarmConfigs : timesToAlarmConfigs(times));
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [userId]);

    const startTime = useMemo(() => to24h(startHour, startMinute, startAmPm), [startHour, startMinute, startAmPm]);
    const endTime   = useMemo(() => to24h(endHour, endMinute, endAmPm),       [endHour, endMinute, endAmPm]);
    const intervalMins = intervalMode === '1hr' ? 60 : intervalMode === '2hr' ? 120 : (parseInt(customIntervalMins) || 60);
    const invalidRange = startTime >= endTime;

    const [totalSessions, setTotalSessions] = useState(0);
    useEffect(() => {
        setTotalSessions(generateMoveTimes(startTime, endTime, intervalMins).length);
    }, [startHour, startMinute, startAmPm, endHour, endMinute, endAmPm, intervalMins]);

    const totalWorkoutMins = totalSessions * workoutDurationMin;

    const handleSave = async () => {
        setSaving(true);
        const freshTimes   = generateMoveTimes(startTime, endTime, intervalMins);
        const freshConfigs = timesToAlarmConfigs(freshTimes);
        const reminder: MoveReminder = {
            id: reminderId, userId, enabled,
            title: 'Reminder to Move', startTime, endTime,
            intervalMinutes: intervalMins, workoutDurationMin,
            generatedTimes: freshTimes, alarmConfigs: freshConfigs, recurring: true,
        };
        try {
            const saved = await MoveReminderService.save(userId, reminder);
            setReminderId(saved.id);
            setSavedTimes(saved.generatedTimes);
            setAlarmConfigs(saved.alarmConfigs);
            reminderWatcherService.invalidateMoveCache();
            setSaved(true);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
            setTimeout(() => { setSaved(false); navigation.goBack(); }, 1200);
        } catch (e) {
            console.warn('[MoveReminderScreen] save failed:', e);
        } finally {
            setSaving(false);
        }
    };

    const saveAlarmConfigs = async (configs: AlarmConfig[]) => {
        const times = configs.map(c => c.time);
        try {
            const saved = await MoveReminderService.save(userId, {
                id: reminderId, userId, enabled,
                title: 'Reminder to Move', startTime, endTime,
                intervalMinutes: intervalMins, workoutDurationMin,
                generatedTimes: times, alarmConfigs: configs, recurring: true,
            });
            setReminderId(saved.id);
            setSavedTimes(saved.generatedTimes);
            setAlarmConfigs(saved.alarmConfigs);
            reminderWatcherService.invalidateMoveCache();
        } catch (e) {
            console.warn('[MoveReminderScreen] saveAlarmConfigs failed:', e);
        }
    };

    return (
        <SafeAreaView style={s.safe}>

            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <ArrowLeft color="#211832" size={22} />
                </TouchableOpacity>
                <View style={s.titleBlock}>
                    <Text style={s.title}>Stay Active All Day</Text>
                    <Text style={s.titleSubtitle}>Set minutes every hour to break the cycle.</Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator color={ACCENT} style={{ marginTop: 60 }} />
            ) : (
                <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>

                    {/* Enable toggle */}
                    <View style={s.row}>
                        <Text style={s.sectionLabel}>Enable Movement Reminders</Text>
                        <TouchableOpacity
                            style={[s.togglePill, enabled && s.togglePillOn]}
                            onPress={() => setEnabled(e => !e)}
                            activeOpacity={0.8}
                        >
                            <View style={[s.toggleThumb, enabled && s.toggleThumbOn]} />
                        </TouchableOpacity>
                    </View>

                    {/* Exercise */}
                    <Text style={[s.sectionLabel, { marginTop: 22 }]}>Exercise</Text>
                    <View style={s.chipRow}>
                        {(['Squats', 'Leaning Pullups', 'Random'] as ExerciseSelection[]).map(ex => (
                            <TouchableOpacity
                                key={ex}
                                style={[s.chip, exerciseName === ex && s.chipActive]}
                                onPress={() => setExerciseName(ex)}
                                activeOpacity={0.75}
                            >
                                <Text style={[s.chipText, exerciseName === ex && s.chipTextActive]}>
                                    {ex === 'Random' ? '🎲 Random' : ex}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Start + End time — tap to open bottom sheet picker */}
                    <View style={s.timeDualRow}>
                        <TouchableOpacity style={[s.timeCard, s.timeHalf]} onPress={() => openTimeSheet('start')} activeOpacity={0.75}>
                            <Text style={s.sectionLabel}>Start Time</Text>
                            <Text style={s.timeValue}>{fmtTime(startHour, startMinute, startAmPm)}</Text>
                            <ChevronRight color="#7A7C90" size={14} style={{ position: 'absolute', right: 12, top: '50%' } as any} />
                        </TouchableOpacity>
                        <Text style={s.dualArrow}>→</Text>
                        <TouchableOpacity style={[s.timeCard, s.timeHalf]} onPress={() => openTimeSheet('end')} activeOpacity={0.75}>
                            <Text style={s.sectionLabel}>End Time</Text>
                            <Text style={s.timeValue}>{fmtTime(endHour, endMinute, endAmPm)}</Text>
                            <ChevronRight color="#7A7C90" size={14} style={{ position: 'absolute', right: 12, top: '50%' } as any} />
                        </TouchableOpacity>
                    </View>

                    {/* How long + How often */}
                    <View style={s.dualRow}>
                        <View style={s.dualHalf}>
                            <Text style={[s.sectionLabel, { marginTop: 18 }]}>How long each session?</Text>
                            <Text style={s.durationDisplay}>
                                Duration: <Text style={{ color: ACCENT }}>{workoutDurationMin}</Text> min
                            </Text>
                            <View
                                ref={sliderRef}
                                style={s.sliderTrack}
                                onLayout={(e) => { sliderWidthRef.current = e.nativeEvent.layout.width; measureSlider(); }}
                                onStartShouldSetResponder={() => true}
                                onMoveShouldSetResponder={() => true}
                                onResponderTerminationRequest={() => false}
                                onResponderGrant={(e) => { measureSlider(); setDurationFromPageX(e.nativeEvent.pageX); }}
                                onResponderMove={(e) => setDurationFromPageX(e.nativeEvent.pageX)}
                            >
                                <View pointerEvents="none" style={[s.sliderFill, { width: `${((workoutDurationMin - 1) / 4) * 100}%` as any }]} />
                                <View pointerEvents="none" style={[s.sliderThumb, { left: `${((workoutDurationMin - 1) / 4) * 100}%` as any }]} />
                            </View>
                            <View style={s.sliderLabels}>
                                <Text style={s.sliderLabelText}>1 min</Text>
                                <Text style={s.sliderLabelText}>5 min</Text>
                            </View>
                        </View>

                        <View style={s.dualHalf}>
                            <Text style={[s.sectionLabel, { marginTop: 18 }]}>How often?</Text>
                            <View style={s.chipRow}>
                                {(['1hr', '2hr', 'custom'] as IntervalMode[]).map(mode => (
                                    <TouchableOpacity
                                        key={mode}
                                        style={[s.chip, intervalMode === mode && s.chipActive]}
                                        onPress={() => setIntervalMode(mode)}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[s.chipText, intervalMode === mode && s.chipTextActive]}>
                                            {mode === '1hr' ? '1 hr' : mode === '2hr' ? '2 hr' : 'Custom'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            {intervalMode === 'custom' && (
                                <View style={{ marginTop: 10 }}>
                                    <Text style={[s.sectionLabel, { marginBottom: 6 }]}>Minutes between reminders</Text>
                                    <TextInput
                                        style={s.numericInput}
                                        keyboardType="numeric"
                                        value={customIntervalMins}
                                        onChangeText={setCustomIntervalMins}
                                        placeholder="60"
                                        placeholderTextColor="#D8D8E4"
                                        maxLength={4}
                                    />
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Daily Summary */}
                    <View style={s.summaryCard}>
                        <Text style={s.summaryTitle}>DAILY SUMMARY</Text>
                        {invalidRange ? (
                            <Text style={s.summaryWarning}>End time must be after start time</Text>
                        ) : (
                            <View style={s.summaryRow}>
                                <View style={s.summaryStat}>
                                    <Text style={s.summaryStatValue}>{totalSessions}</Text>
                                    <Text style={s.summaryStatLabel}>workout sessions</Text>
                                </View>
                                <View style={s.summaryDivider} />
                                <View style={s.summaryStat}>
                                    <Text style={s.summaryStatValue}>{totalWorkoutMins}</Text>
                                    <Text style={s.summaryStatLabel}>total minutes</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Challenge button */}
                    <TouchableOpacity
                        style={s.challengeBtn}
                        onPress={() => { setPickerExercise(resolveExercise(exerciseName)); setChallengePickerVisible(true); }}
                        activeOpacity={0.85}
                    >
                        <Zap color="#211832" size={16} />
                        <Text style={s.challengeBtnText}>Enter Challenge Lobby</Text>
                    </TouchableOpacity>

                    {/* Scheduled alarms */}
                    {alarmConfigs.length > 0 && (
                        <View style={s.alarmListCard}>
                            <View style={s.timesHeader}>
                                <Text style={s.timesTitle}>SCHEDULED REMINDERS</Text>
                                <Text style={s.timesCount}>
                                    {alarmConfigs.filter(a => a.enabled).length}/{alarmConfigs.length} on
                                </Text>
                            </View>
                            {alarmConfigs.map((cfg, i) => (
                                <AlarmListRow
                                    key={cfg.time}
                                    alarm={cfg}
                                    isLast={i === alarmConfigs.length - 1}
                                    onPress={() => { setSelectedAlarm(cfg); setSheetVisible(true); }}
                                    onToggle={(val) => {
                                        const next = alarmConfigs.map(c =>
                                            c.time === cfg.time ? { ...c, enabled: val } : c
                                        );
                                        setAlarmConfigs(next);
                                        saveAlarmConfigs(next);
                                    }}
                                />
                            ))}
                        </View>
                    )}

                    <AlarmPillSheet
                        visible={sheetVisible}
                        alarm={selectedAlarm}
                        reminderId={reminderId ?? 'default'}
                        onClose={() => setSheetVisible(false)}
                        onUpdate={(updated) => {
                            const next = alarmConfigs.map(c =>
                                c.time === selectedAlarm?.time ? updated : c
                            );
                            setAlarmConfigs(next);
                            saveAlarmConfigs(next);
                        }}
                        onDelete={() => {
                            const next = alarmConfigs.filter(c => c.time !== selectedAlarm?.time);
                            setAlarmConfigs(next);
                            setSavedTimes(next.map(c => c.time));
                            saveAlarmConfigs(next);
                        }}
                    />

                    {/* Save */}
                    <TouchableOpacity
                        style={[s.saveBtn, saving && { opacity: 0.6 }]}
                        onPress={handleSave}
                        disabled={saving}
                        activeOpacity={0.8}
                    >
                        {saving
                            ? <ActivityIndicator color="#211832" size="small" />
                            : <Text style={s.saveBtnText}>{saved ? 'Saved! ✓' : 'Save Reminder to Move'}</Text>
                        }
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* ── Time picker bottom sheet ── */}
            {timeSheet !== null && (
                <Modal transparent animationType="none" onRequestClose={closeTimeSheet}>
                    <TouchableOpacity style={s.sheetOverlay} activeOpacity={1} onPress={closeTimeSheet} />
                    <Animated.View style={[s.sheet, {
                        transform: [{ translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }],
                    }]}>
                        <View style={s.sheetHandle} />
                        <Text style={s.sheetTitle}>{timeSheet === 'start' ? 'Start Time' : 'End Time'}</Text>

                        <View style={s.sheetPicker}>
                            <TimeArrowPicker
                                hour={timeSheet === 'start' ? startHour : endHour}
                                minute={timeSheet === 'start' ? startMinute : endMinute}
                                amPm={timeSheet === 'start' ? startAmPm : endAmPm}
                                onHourChange={timeSheet === 'start' ? setStartHour : setEndHour}
                                onMinuteChange={timeSheet === 'start' ? setStartMinute : setEndMinute}
                                onAmPmChange={timeSheet === 'start' ? setStartAmPm : setEndAmPm}
                            />
                        </View>

                        <TouchableOpacity style={s.sheetDone} onPress={closeTimeSheet} activeOpacity={0.85}>
                            <Text style={s.sheetDoneText}>Done</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Modal>
            )}

            <ChallengeLobbyModal
                visible={challengePickerVisible}
                exerciseName={pickerExercise}
                workoutDurationSecs={workoutDurationMin * 60}
                onClose={() => setChallengePickerVisible(false)}
                onChallengeStarted={(params) => {
                    setChallengePickerVisible(false);
                    navigation.navigate('ChallengeVideoRoom', params);
                }}
            />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: BG },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(33,24,50,0.06)',
        gap: 12,
    },
    backBtn: {
        marginTop: 2,
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.07)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleBlock: { flex: 1 },
    title: { color: '#211832', fontSize: 17, fontWeight: '700' },
    titleSubtitle: {
        color: 'rgba(150,180,210,0.7)', fontSize: 12,
        fontWeight: '400', lineHeight: 18, marginTop: 4,
    },
    body: { paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 },
    challengeBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, backgroundColor: 'rgba(242,89,18,0.12)',
        borderWidth: 1, borderColor: 'rgba(242,89,18,0.35)',
        borderRadius: 12, paddingVertical: 12, marginTop: 16, marginBottom: 18,
    },
    challengeBtnText: { color: CTA, fontSize: 14, fontWeight: '700' },
    row: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 18,
    },
    sectionLabel: {
        color: '#7A7C90', fontSize: 11, fontWeight: '700',
        letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 10,
    },
    card: {
        backgroundColor: CARD, borderRadius: 14,
        borderWidth: 1, borderColor: BORDER,
        paddingVertical: 6,
        overflow: 'hidden' as any,
    },
    timeDualRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18, marginTop: 24,
    },
    timeHalf: { flex: 1 },
    timeCard: {
        backgroundColor: CARD, borderRadius: 14,
        borderWidth: 1, borderColor: BORDER,
        paddingHorizontal: 14, paddingVertical: 14,
        position: 'relative',
    },
    timeValue: {
        color: '#211832', fontSize: 20, fontWeight: '700', marginTop: 2,
    },
    // Bottom sheet
    sheetOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
    } as any,
    sheet: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#F8F8FC',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingBottom: 36,
    } as any,
    sheetHandle: {
        width: 40, height: 4, borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignSelf: 'center', marginTop: 12, marginBottom: 4,
    },
    sheetTitle: {
        color: 'rgba(150,180,210,0.6)', fontSize: 12, fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: 0.8,
        textAlign: 'center', marginTop: 8, marginBottom: 4,
    },
    sheetPicker: {
        marginHorizontal: 24, marginVertical: 8,
    },
    sheetDone: {
        marginHorizontal: 24, marginTop: 12,
        backgroundColor: CTA, borderRadius: 14,
        paddingVertical: 16, alignItems: 'center',
    },
    sheetDoneText: { color: '#211832', fontSize: 16, fontWeight: '700' },
    dualRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    dualHalf: { flex: 1 },
    dualArrow: {
        color: 'rgba(242,89,18,0.5)', fontSize: 16, fontWeight: '600', marginTop: 28,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: CARD, borderWidth: 1, borderColor: 'rgba(33,24,50,0.1)',
    },
    chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
    chipText: { color: '#7A7C90', fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: '#211832' },
    numericInput: {
        backgroundColor: CARD, borderRadius: 10, borderWidth: 1,
        borderColor: BORDER, color: '#211832', fontSize: 15,
        paddingHorizontal: 14, paddingVertical: 10, width: 120,
    },
    durationDisplay: { color: 'rgba(33,24,50,0.7)', fontSize: 14, fontWeight: '600', marginBottom: 12 },
    sliderTrack: {
        height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)',
        position: 'relative', marginVertical: 8,
    },
    sliderFill: {
        position: 'absolute', top: 0, left: 0, height: 6, borderRadius: 3, backgroundColor: ACCENT,
    },
    sliderThumb: {
        position: 'absolute', top: -7, width: 20, height: 20,
        borderRadius: 10, backgroundColor: ACCENT, marginLeft: -10,
    },
    sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, marginBottom: 2 },
    sliderLabelText: { color: '#D8D8E4', fontSize: 11, fontWeight: '600' },
    summaryCard: {
        marginTop: 20, backgroundColor: '#EEEEF2', borderRadius: 14,
        borderWidth: 1, borderColor: 'rgba(242,89,18,0.15)',
        paddingVertical: 14, paddingHorizontal: 16,
    },
    summaryTitle: {
        color: '#D8D8E4', fontSize: 10, fontWeight: '800',
        letterSpacing: 0.8, textAlign: 'center', marginBottom: 12,
    },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    summaryStat: { flex: 1, alignItems: 'center' },
    summaryStatValue: { color: ACCENT, fontSize: 28, fontWeight: '800', lineHeight: 32 },
    summaryStatLabel: { color: 'rgba(150,180,210,0.6)', fontSize: 11, fontWeight: '600', marginTop: 2 },
    summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.07)', marginHorizontal: 12 },
    summaryWarning: { color: 'rgba(242,89,18,0.7)', fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 4 },
    alarmListCard: {
        marginTop: 16, backgroundColor: '#EEEEF2', borderRadius: 16,
        borderWidth: 1, borderColor: 'rgba(33,24,50,0.07)',
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4,
    },
    timesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    timesTitle: { color: '#D8D8E4', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
    timesCount: { color: 'rgba(242,89,18,0.6)', fontSize: 11, fontWeight: '700' },
    saveBtn: {
        marginTop: 24, backgroundColor: CTA, borderRadius: 12,
        paddingVertical: 16, alignItems: 'center',
    },
    saveBtnText: { color: '#211832', fontSize: 16, fontWeight: '700' },
    togglePill: {
        width: 50, height: 28, borderRadius: 14, backgroundColor: '#F8F8FC',
        borderWidth: 1, borderColor: 'rgba(33,24,50,0.1)',
        justifyContent: 'center', paddingHorizontal: 3,
    },
    togglePillOn: { backgroundColor: '#F25912', borderColor: '#F25912' },
    toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#7A7C90' },
    toggleThumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },
});
