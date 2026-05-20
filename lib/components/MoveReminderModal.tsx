import React, { useState, useEffect, useRef } from 'react';
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
import { X } from 'lucide-react-native';
import { IntensityComparisonCard } from './IntensityComparisonCard';
import { TimeArrowPicker } from './TimeArrowPicker';
import {
    MoveReminder,
    DEFAULT_MOVE_REMINDER,
    MoveReminderService,
    generateMoveTimes,
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

export function MoveReminderModal({ visible, userId, onClose, onSaved }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [reminderId, setReminderId] = useState<string | undefined>(undefined);

    const [enabled, setEnabled] = useState(DEFAULT_MOVE_REMINDER.enabled);
    const [intervalMode, setIntervalMode] = useState<IntervalMode>('1hr');
    const [customIntervalMins, setCustomIntervalMins] = useState('60');
    const [workoutDurationMin, setWorkoutDurationMin] = useState(DEFAULT_MOVE_REMINDER.workoutDurationMin);

    const defStart = from24h(DEFAULT_MOVE_REMINDER.startTime);
    const [startHour, setStartHour] = useState(defStart.hour);
    const [startMinute, setStartMinute] = useState(defStart.minute);
    const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>(defStart.amPm);

    const defEnd = from24h(DEFAULT_MOVE_REMINDER.endTime);
    const [endHour, setEndHour] = useState(defEnd.hour);
    const [endMinute, setEndMinute] = useState(defEnd.minute);
    const [endAmPm, setEndAmPm] = useState<'AM' | 'PM'>(defEnd.amPm);

    const sliderWidthRef = useRef(0);

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
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [visible, userId]);

    const startTime = to24h(startHour, startMinute, startAmPm);
    const endTime = to24h(endHour, endMinute, endAmPm);

    const intervalMins = intervalMode === '1hr' ? 60 : intervalMode === '2hr' ? 120 : (parseInt(customIntervalMins) || 60);

    const handleSave = async () => {
        setSaving(true);
        const reminder: MoveReminder = {
            id: reminderId,
            userId,
            enabled,
            title: 'Reminder to Move',
            startTime,
            endTime,
            intervalMinutes: intervalMins,
            workoutDurationMin,
            generatedTimes: generateMoveTimes(startTime, endTime, intervalMins),
            recurring: true,
        };
        try {
            const savedReminder = await MoveReminderService.save(userId, reminder);
            setReminderId(savedReminder.id);
            reminderWatcherService.invalidateMoveCache();
            onSaved(savedReminder);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (e) {
            console.warn('[MoveReminderModal] save failed:', e);
        } finally {
            setSaving(false);
        }
    };

    return (
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
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
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

                            {/* Movement Intensity Comparison */}
                            <IntensityComparisonCard
                                workoutDurationMin={workoutDurationMin}
                                intervalMins={intervalMins}
                                startTime={startTime}
                                endTime={endTime}
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
    );
}

const s = StyleSheet.create({
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
