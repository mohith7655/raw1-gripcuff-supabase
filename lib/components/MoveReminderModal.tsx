import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { X, Zap } from 'lucide-react-native';
import { IntensityComparisonCard, ExerciseName } from './IntensityComparisonCard';
import { TimeArrowPicker } from './TimeArrowPicker';
import { AlarmPillSheet } from './AlarmPillSheet';
import { AlarmListRow } from './AlarmListRow';
import { ChallengeUserPickerModal } from './ChallengeUserPickerModal';
import {
    MoveReminder,
    AlarmConfig,
    DEFAULT_MOVE_REMINDER,
    MoveReminderService,
    generateMoveTimes,
    formatMoveTime12h,
    timesToAlarmConfigs,
} from '../services/moveReminder.service';
import { reminderWatcherService } from '../services/reminderWatcher.service';

const ACCENT = '#FF6B00';
const BG = '#0d1825';
const CARD = '#111d2e';
const BORDER = 'rgba(255,107,0,0.2)';

type IntervalMode = '1hr' | '2hr' | 'custom';

interface Props {
    visible: boolean;
    userId: string;
    onClose: () => void;
    onSaved: (reminder: MoveReminder) => void;
    navigation?: any;
}

function to24h(hour: number, minute: number, amPm: 'AM' | 'PM'): string {
    let h24 = hour % 12;
    if (amPm === 'PM') h24 += 12;
    return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function from24h(time24: string): { hour: number; minute: number; amPm: 'AM' | 'PM' } {
    const [h, m] = time24.split(':').map(Number);
    const amPm: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return { hour, minute: m, amPm };
}

export function MoveReminderModal({ visible, userId, onClose, onSaved, navigation }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [challengePickerVisible, setChallengePickerVisible] = useState(false);
    const [saved, setSaved] = useState(false);
    const [reminderId, setReminderId] = useState<string | undefined>(undefined);

    const [enabled, setEnabled] = useState(DEFAULT_MOVE_REMINDER.enabled);
    const [intervalMode, setIntervalMode] = useState<IntervalMode>('1hr');
    const [customIntervalMins, setCustomIntervalMins] = useState('60');
    const [workoutDurationMin, setWorkoutDurationMin] = useState(DEFAULT_MOVE_REMINDER.workoutDurationMin);
    const [exerciseName, setExerciseName] = useState<ExerciseName>('Squats');
    const [savedTimes, setSavedTimes] = useState<string[]>([]);
    const [alarmConfigs, setAlarmConfigs] = useState<AlarmConfig[]>([]);
    const [selectedAlarm, setSelectedAlarm] = useState<AlarmConfig | null>(null);
    const [sheetVisible, setSheetVisible] = useState(false);

    const defStart = from24h(DEFAULT_MOVE_REMINDER.startTime);
    const [startHour, setStartHour] = useState(defStart.hour);
    const [startMinute, setStartMinute] = useState(defStart.minute);
    const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>(defStart.amPm);

    const defEnd = from24h(DEFAULT_MOVE_REMINDER.endTime);
    const [endHour, setEndHour] = useState(defEnd.hour);
    const [endMinute, setEndMinute] = useState(defEnd.minute);
    const [endAmPm, setEndAmPm] = useState<'AM' | 'PM'>(defEnd.amPm);

    const sliderWidthRef = useRef(0);
    const scrollRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (!visible) return;
        setLoading(true);
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
                setStartHour(s.hour);
                setStartMinute(s.minute);
                setStartAmPm(s.amPm);
                const e = from24h(r.endTime);
                setEndHour(e.hour);
                setEndMinute(e.minute);
                setEndAmPm(e.amPm);
                const times = r.generatedTimes ?? [];
                setSavedTimes(times);
                setAlarmConfigs(r.alarmConfigs?.length ? r.alarmConfigs : timesToAlarmConfigs(times));
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [visible, userId]);

    // Recompute every render — explicit deps on all raw state primitives
    const startTime = useMemo(
        () => to24h(startHour, startMinute, startAmPm),
        [startHour, startMinute, startAmPm],
    );
    const endTime = useMemo(
        () => to24h(endHour, endMinute, endAmPm),
        [endHour, endMinute, endAmPm],
    );

    const intervalMins = intervalMode === '1hr' ? 60 : intervalMode === '2hr' ? 120 : (parseInt(customIntervalMins) || 60);

    const [totalSessions, setTotalSessions] = useState(0);
    useEffect(() => {
        setTotalSessions(generateMoveTimes(startTime, endTime, intervalMins).length);
    }, [startHour, startMinute, startAmPm, endHour, endMinute, endAmPm, intervalMins]);

    const totalWorkoutMins = totalSessions * workoutDurationMin;
    const invalidRange = startTime >= endTime;

    const handleSave = async () => {
        setSaving(true);
        const freshTimes = generateMoveTimes(startTime, endTime, intervalMins);
        const freshConfigs = timesToAlarmConfigs(freshTimes);
        const reminder: MoveReminder = {
            id: reminderId,
            userId,
            enabled,
            title: 'Reminder to Move',
            startTime,
            endTime,
            intervalMinutes: intervalMins,
            workoutDurationMin,
            generatedTimes: freshTimes,
            alarmConfigs: freshConfigs,
            recurring: true,
        };
        try {
            const savedReminder = await MoveReminderService.save(userId, reminder);
            setReminderId(savedReminder.id);
            setSavedTimes(savedReminder.generatedTimes);
            setAlarmConfigs(savedReminder.alarmConfigs);
            reminderWatcherService.invalidateMoveCache();
            onSaved(savedReminder);
            setSaved(true);
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }, 150);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            console.warn('[MoveReminderModal] save failed:', e);
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
            onSaved(saved);
        } catch (e) {
            console.warn('[MoveReminderModal] saveAlarmConfigs failed:', e);
        }
    };

    const removeTime = async (t: string) => {
        const newTimes = savedTimes.filter(x => x !== t);
        setSavedTimes(newTimes);
        try {
            const saved = await MoveReminderService.save(userId, {
                id: reminderId,
                userId,
                enabled,
                title: 'Reminder to Move',
                startTime,
                endTime,
                intervalMinutes: intervalMins,
                workoutDurationMin,
                generatedTimes: newTimes,
                recurring: true,
            });
            setReminderId(saved.id);
            reminderWatcherService.invalidateMoveCache();
            onSaved(saved);
        } catch (e) {
            console.warn('[MoveReminderModal] removeTime failed:', e);
        }
    };

    return (
        <>
        <Modal visible={visible} transparent animationType="slide">
            <SafeAreaView style={s.overlay}>
                <View style={s.sheet}>
                    {/* Header */}
                    <View style={s.header}>
                        <View style={s.titleBlock}>
                            <Text style={s.title}>Reminder to Move</Text>
                            <Text style={s.titleSubtitle}>Avoid a dangerous sedentary lifestyle by exercising for 1 minute each hour.</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={s.closeBtn}>
                            <X color="#4a6480" size={22} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
                    ) : (
                        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
                            {/* Challenge button */}
                            <TouchableOpacity
                                style={s.challengeBtn}
                                onPress={() => setChallengePickerVisible(true)}
                                activeOpacity={0.85}
                            >
                                <Zap color="#fff" size={16} />
                                <Text style={s.challengeBtnText}>Challenge a Friend</Text>
                            </TouchableOpacity>

                            {/* Enable toggle */}
                            <View style={s.row}>
                                <Text style={s.sectionLabel}>Enable Reminder to Move</Text>
                                <TouchableOpacity
                                    style={[s.togglePill, enabled && s.togglePillOn]}
                                    onPress={() => setEnabled(e => !e)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[s.toggleThumb, enabled && s.toggleThumbOn]} />
                                </TouchableOpacity>
                            </View>

                            {/* Start + End time side by side */}
                            <View style={s.timeDualRow}>
                                <View style={s.timeHalf}>
                                    <Text style={s.sectionLabel}>Start Time</Text>
                                    <View style={s.card}>
                                        <TimeArrowPicker
                                            compact
                                            hour={startHour}
                                            minute={startMinute}
                                            amPm={startAmPm}
                                            onHourChange={setStartHour}
                                            onMinuteChange={setStartMinute}
                                            onAmPmChange={setStartAmPm}
                                        />
                                    </View>
                                </View>
                                <Text style={s.dualArrow}>→</Text>
                                <View style={s.timeHalf}>
                                    <Text style={s.sectionLabel}>End Time</Text>
                                    <View style={s.card}>
                                        <TimeArrowPicker
                                            compact
                                            hour={endHour}
                                            minute={endMinute}
                                            amPm={endAmPm}
                                            onHourChange={setEndHour}
                                            onMinuteChange={setEndMinute}
                                            onAmPmChange={setEndAmPm}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Interval */}
                            <Text style={[s.sectionLabel, { marginTop: 18 }]}>Interval Between Reminders</Text>
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
                                        placeholderTextColor="#3a5a7a"
                                        maxLength={4}
                                    />
                                </View>
                            )}

                            {/* Active Workout Time */}
                            <Text style={[s.sectionLabel, { marginTop: 22 }]}>Active Workout Time</Text>
                            <Text style={s.durationDisplay}>
                                Duration: <Text style={{ color: ACCENT }}>{workoutDurationMin}</Text> min
                            </Text>

                            {/* Slider — 1 to 5 min */}
                            <View
                                style={s.sliderTrack}
                                onLayout={(e) => { sliderWidthRef.current = e.nativeEvent.layout.width; }}
                                onStartShouldSetResponder={() => true}
                                onResponderGrant={(e) => {
                                    const ratio = Math.min(Math.max(e.nativeEvent.locationX / sliderWidthRef.current, 0), 1);
                                    setWorkoutDurationMin(Math.max(1, Math.min(5, Math.round(ratio * 4) + 1)));
                                }}
                                onResponderMove={(e) => {
                                    const ratio = Math.min(Math.max(e.nativeEvent.locationX / sliderWidthRef.current, 0), 1);
                                    setWorkoutDurationMin(Math.max(1, Math.min(5, Math.round(ratio * 4) + 1)));
                                }}
                            >
                                <View style={[s.sliderFill, { width: `${((workoutDurationMin - 1) / 4) * 100}%` as any }]} />
                                <View style={[s.sliderThumb, { left: `${((workoutDurationMin - 1) / 4) * 100}%` as any }]} />
                            </View>
                            <View style={s.sliderLabels}>
                                <Text style={s.sliderLabelText}>1 min</Text>
                                <Text style={s.sliderLabelText}>5 min</Text>
                            </View>

                            {/* Exercise Selector */}
                            <Text style={[s.sectionLabel, { marginTop: 22 }]}>Exercise</Text>
                            <View style={s.chipRow}>
                                {(['Squats', 'Wall Sits', 'Standing Glute Kickbacks'] as ExerciseName[]).map(ex => (
                                    <TouchableOpacity
                                        key={ex}
                                        style={[s.chip, exerciseName === ex && s.chipActive]}
                                        onPress={() => setExerciseName(ex)}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[s.chipText, exerciseName === ex && s.chipTextActive]}>
                                            {ex}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Movement Intensity Comparison */}
                            <IntensityComparisonCard
                                workoutDurationMin={workoutDurationMin}
                                intervalMins={intervalMins}
                                startTime={startTime}
                                endTime={endTime}
                                exerciseName={exerciseName}
                            />

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

                            {/* Scheduled alarms — clock-app style list */}
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

                            {/* Alarm detail sheet */}
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
                                    ? <ActivityIndicator color="#fff" size="small" />
                                    : <Text style={s.saveBtnText}>{saved ? 'Saved! ✓' : 'Save Reminder to Move'}</Text>
                                }
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>
            </SafeAreaView>
        </Modal>

        {/* Challenge friend picker */}
        <ChallengeUserPickerModal
            visible={challengePickerVisible}
            exerciseName={exerciseName}
            workoutDurationSecs={workoutDurationMin * 60}
            onClose={() => setChallengePickerVisible(false)}
            onChallengeStarted={(params) => {
                setChallengePickerVisible(false);
                onClose();
                navigation?.navigate('ChallengeVideoRoom', params);
            }}
        />
        </>
    );
}

const s = StyleSheet.create({
    challengeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,107,0,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.35)',
        borderRadius: 12,
        paddingVertical: 12,
        marginBottom: 18,
    },
    challengeBtnText: {
        color: ACCENT,
        fontSize: 14,
        fontWeight: '700',
    },
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheet: {
        backgroundColor: BG,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingTop: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    titleBlock: {
        flex: 1,
        marginRight: 12,
    },
    title: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    titleSubtitle: {
        color: 'rgba(150,180,210,0.7)',
        fontSize: 12,
        fontWeight: '400',
        lineHeight: 18,
        marginTop: 4,
    },
    closeBtn: {
        marginTop: 2,
    },
    body: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        paddingTop: 16,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    sectionLabel: {
        color: '#4a6480',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.7,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    card: {
        backgroundColor: CARD,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 10,
    },
    timeDualRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 18,
    },
    timeHalf: {
        flex: 1,
    },
    dualArrow: {
        color: 'rgba(255,107,0,0.5)',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 28,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: CARD,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    chipActive: {
        backgroundColor: ACCENT,
        borderColor: ACCENT,
    },
    chipText: {
        color: '#4a6480',
        fontSize: 13,
        fontWeight: '600',
    },
    chipTextActive: {
        color: '#fff',
    },
    numericInput: {
        backgroundColor: CARD,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BORDER,
        color: '#fff',
        fontSize: 15,
        paddingHorizontal: 14,
        paddingVertical: 10,
        width: 120,
    },
    durationDisplay: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 12,
    },
    sliderTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.1)',
        position: 'relative',
        marginVertical: 8,
    },
    sliderFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        height: 6,
        borderRadius: 3,
        backgroundColor: ACCENT,
    },
    sliderThumb: {
        position: 'absolute',
        top: -7,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: ACCENT,
        marginLeft: -10,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
        marginBottom: 2,
    },
    sliderLabelText: {
        color: '#2a4060',
        fontSize: 11,
        fontWeight: '600',
    },
    summaryCard: {
        marginTop: 20,
        backgroundColor: '#071120',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.15)',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    summaryTitle: {
        color: '#2a4060',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
        textAlign: 'center',
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryStat: {
        flex: 1,
        alignItems: 'center',
    },
    summaryStatValue: {
        color: ACCENT,
        fontSize: 28,
        fontWeight: '800',
        lineHeight: 32,
    },
    summaryStatLabel: {
        color: 'rgba(150,180,210,0.6)',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    summaryDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.07)',
        marginHorizontal: 12,
    },
    summaryWarning: {
        color: 'rgba(255,107,0,0.7)',
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        paddingVertical: 4,
    },
    timesCard: {
        marginTop: 16,
        backgroundColor: '#071120',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    alarmListCard: {
        marginTop: 16,
        backgroundColor: '#071120',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.07)',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
    },
    timesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    timesTitle: {
        color: '#2a4060',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    timesCount: {
        color: 'rgba(255,107,0,0.6)',
        fontSize: 11,
        fontWeight: '700',
    },
    timesPillRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    timesPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    timesPillStop: {
        backgroundColor: 'rgba(255,107,0,0.08)',
        borderColor: 'rgba(255,107,0,0.3)',
    },
    timesPillText: {
        color: 'rgba(150,180,210,0.7)',
        fontSize: 11,
        fontWeight: '600',
    },
    timesPillTextStop: {
        color: ACCENT,
    },
    timesPillDisabled: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderColor: 'rgba(255,255,255,0.06)',
        opacity: 0.5,
    },
    timesPillTextDisabled: {
        color: 'rgba(150,180,210,0.35)',
    },
    offBadge: {
        color: '#4a6480',
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.5,
        backgroundColor: 'rgba(255,255,255,0.06)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    stopBadge: {
        color: ACCENT,
        fontSize: 8,
        fontWeight: '800',
        letterSpacing: 0.5,
        backgroundColor: 'rgba(255,107,0,0.15)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    timesEditBtn: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    timesEditBtnActive: {
        backgroundColor: 'rgba(255,107,0,0.15)',
        borderColor: 'rgba(255,107,0,0.4)',
    },
    timesEditBtnText: {
        color: 'rgba(150,180,210,0.7)',
        fontSize: 11,
        fontWeight: '700',
    },
    timesEditBtnTextActive: {
        color: ACCENT,
    },
    timesPillEditing: {
        borderColor: 'rgba(255,80,80,0.4)',
        backgroundColor: 'rgba(255,80,80,0.06)',
    },
    timesPillX: {
        color: 'rgba(255,100,100,0.8)',
        fontSize: 10,
        fontWeight: '800',
    },
    timesEditHint: {
        color: 'rgba(150,180,210,0.4)',
        fontSize: 10,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 8,
    },
    saveBtn: {
        marginTop: 24,
        backgroundColor: ACCENT,
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    togglePill: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#1c2e42',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    togglePillOn: {
        backgroundColor: ACCENT,
        borderColor: ACCENT,
    },
    toggleThumb: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#4a6480',
    },
    toggleThumbOn: {
        backgroundColor: '#fff',
        alignSelf: 'flex-end',
    },
});
