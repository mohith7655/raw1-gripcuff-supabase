import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
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

const INTERVAL_OPTIONS: { label: string; value: 1 | 2 }[] = [
    { label: '1 hr', value: 1 },
    { label: '2 hr', value: 2 },
];

const MINUTES_BEFORE_OPTIONS: { label: string; value: 5 | 10 | 15 | 30 }[] = [
    { label: '5 min', value: 5 },
    { label: '10 min', value: 10 },
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
];

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
    const [reminderId, setReminderId] = useState<string | undefined>(undefined);

    const [enabled, setEnabled] = useState(DEFAULT_MOVE_REMINDER.enabled);
    const [intervalHours, setIntervalHours] = useState<1 | 2>(DEFAULT_MOVE_REMINDER.intervalHours);
    const [minutesBefore, setMinutesBefore] = useState<5 | 10 | 15 | 30>(DEFAULT_MOVE_REMINDER.minutesBefore);

    // Start time
    const defStart = from24h(DEFAULT_MOVE_REMINDER.startTime);
    const [startHour, setStartHour] = useState(defStart.hour);
    const [startMinute, setStartMinute] = useState(defStart.minute);
    const [startAmPm, setStartAmPm] = useState<'AM' | 'PM'>(defStart.amPm);

    // End time
    const defEnd = from24h(DEFAULT_MOVE_REMINDER.endTime);
    const [endHour, setEndHour] = useState(defEnd.hour);
    const [endMinute, setEndMinute] = useState(defEnd.minute);
    const [endAmPm, setEndAmPm] = useState<'AM' | 'PM'>(defEnd.amPm);

    useEffect(() => {
        if (!visible) return;
        setLoading(true);
        MoveReminderService.loadDefault(userId).then(r => {
            if (r) {
                setReminderId(r.id);
                setEnabled(r.enabled);
                setIntervalHours(r.intervalHours);
                setMinutesBefore(r.minutesBefore);
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

    const handleSave = async () => {
        setSaving(true);
        const reminder: MoveReminder = {
            id: reminderId,
            userId,
            enabled,
            title: 'Reminder to Move',
            startTime,
            endTime,
            intervalHours,
            minutesBefore,
            generatedTimes: previewTimes,
            recurring: true,
        };
        try {
            const saved = await MoveReminderService.save(userId, reminder);
            setReminderId(saved.id);
            reminderWatcherService.invalidateMoveCache();
            onSaved(saved);
            onClose();
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
                                {/* Start */}
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

                                {/* Divider arrow */}
                                <Text style={s.dualArrow}>→</Text>

                                {/* End */}
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
                                {INTERVAL_OPTIONS.map(opt => (
                                    <TouchableOpacity
                                        key={opt.value}
                                        style={[s.chip, intervalHours === opt.value && s.chipActive]}
                                        onPress={() => setIntervalHours(opt.value)}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[s.chipText, intervalHours === opt.value && s.chipTextActive]}>
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Minutes before */}
                            <Text style={[s.sectionLabel, { marginTop: 18 }]}>Minutes Before Reminder</Text>
                            <View style={s.chipRow}>
                                {MINUTES_BEFORE_OPTIONS.map(opt => (
                                    <TouchableOpacity
                                        key={opt.value}
                                        style={[s.chip, minutesBefore === opt.value && s.chipActive]}
                                        onPress={() => setMinutesBefore(opt.value)}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[s.chipText, minutesBefore === opt.value && s.chipTextActive]}>
                                            {opt.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Save */}
                            <TouchableOpacity
                                style={[s.saveBtn, saving && { opacity: 0.6 }]}
                                onPress={handleSave}
                                disabled={saving}
                                activeOpacity={0.8}
                            >
                                {saving
                                    ? <ActivityIndicator color="#fff" size="small" />
                                    : <Text style={s.saveBtnText}>Save Reminder to Move</Text>
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
