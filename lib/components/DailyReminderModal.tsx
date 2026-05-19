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
import { X, ChevronUp, ChevronDown } from 'lucide-react-native';
import {
    DailyReminderSettings,
    DEFAULT_REMINDER_SETTINGS,
    generateReminderTimes,
    format12h,
    DailyReminderService,
} from '../services/dailyReminder.service';

const ACCENT = '#FF6B00';
const BG = '#0d1825';
const CARD = '#111d2e';
const BORDER = 'rgba(255,107,0,0.2)';

const REMINDERS_PER_DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10];
const INTERVAL_OPTIONS = [
    { label: '15 min', value: 15 },
    { label: '30 min', value: 30 },
    { label: '45 min', value: 45 },
    { label: '1 hr', value: 60 },
    { label: '2 hr', value: 120 },
    { label: '3 hr', value: 180 },
    { label: '4 hr', value: 240 },
];

interface Props {
    visible: boolean;
    userId: string;
    onClose: () => void;
    onSaved: (settings: DailyReminderSettings) => void;
}

function SpinnerField({
    label,
    value,
    onUp,
    onDown,
    display,
}: {
    label: string;
    value: number | string;
    onUp: () => void;
    onDown: () => void;
    display?: string;
}) {
    return (
        <View style={sp.wrap}>
            <Text style={sp.label}>{label}</Text>
            <TouchableOpacity style={sp.arrow} onPress={onUp} activeOpacity={0.7}>
                <ChevronUp color={ACCENT} size={20} />
            </TouchableOpacity>
            <View style={sp.valueBox}>
                <Text style={sp.value}>{display ?? String(value).padStart(2, '0')}</Text>
            </View>
            <TouchableOpacity style={sp.arrow} onPress={onDown} activeOpacity={0.7}>
                <ChevronDown color={ACCENT} size={20} />
            </TouchableOpacity>
        </View>
    );
}

const sp = StyleSheet.create({
    wrap: { alignItems: 'center', gap: 4 },
    label: { color: '#4a6480', fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 2 },
    arrow: { padding: 4 },
    valueBox: {
        width: 56,
        height: 48,
        backgroundColor: '#0a1628',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BORDER,
        alignItems: 'center',
        justifyContent: 'center',
    },
    value: { color: '#fff', fontSize: 22, fontWeight: '800' },
});

export function DailyReminderModal({ visible, userId, onClose, onSaved }: Props) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [hour, setHour] = useState(DEFAULT_REMINDER_SETTINGS.startHour);
    const [minute, setMinute] = useState(DEFAULT_REMINDER_SETTINGS.startMinute);
    const [amPm, setAmPm] = useState<'AM' | 'PM'>(DEFAULT_REMINDER_SETTINGS.amPm);
    const [count, setCount] = useState(DEFAULT_REMINDER_SETTINGS.remindersPerDay);
    const [interval, setInterval_] = useState(DEFAULT_REMINDER_SETTINGS.intervalMinutes);
    const [enabled, setEnabled] = useState(DEFAULT_REMINDER_SETTINGS.enabled);

    useEffect(() => {
        if (!visible) return;
        setLoading(true);
        DailyReminderService.load(userId).then((s) => {
            setHour(s.startHour);
            setMinute(s.startMinute);
            setAmPm(s.amPm);
            setCount(s.remindersPerDay);
            setInterval_(s.intervalMinutes);
            setEnabled(s.enabled);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [visible, userId]);

    const previewTimes = generateReminderTimes(hour, minute, amPm, count, interval);

    const handleSave = async () => {
        setSaving(true);
        const settings: DailyReminderSettings = {
            enabled,
            startHour: hour,
            startMinute: minute,
            amPm,
            remindersPerDay: count,
            intervalMinutes: interval,
            generatedReminderTimes: previewTimes,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        await DailyReminderService.save(userId, settings).catch(() => {});
        setSaving(false);
        onSaved(settings);
        onClose();
    };

    const hourUp   = () => setHour(h => (h % 12) + 1);
    const hourDown = () => setHour(h => h === 1 ? 12 : h - 1);
    const minUp    = () => setMinute(m => (m + 1) % 60);
    const minDown  = () => setMinute(m => (m + 59) % 60);

    return (
        <Modal visible={visible} transparent animationType="slide">
            <SafeAreaView style={s.overlay}>
                <View style={s.sheet}>
                    {/* Header */}
                    <View style={s.header}>
                        <Text style={s.title}>Daily Reminder Schedule</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X color="#4a6480" size={22} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.body}>
                            {/* Enable toggle */}
                            <View style={s.row}>
                                <Text style={s.sectionLabel}>Enable Reminders</Text>
                                <TouchableOpacity
                                    style={[s.togglePill, enabled && s.togglePillOn]}
                                    onPress={() => setEnabled(e => !e)}
                                    activeOpacity={0.8}
                                >
                                    <View style={[s.toggleThumb, enabled && s.toggleThumbOn]} />
                                </TouchableOpacity>
                            </View>

                            {/* Start time */}
                            <Text style={s.sectionLabel}>Start Time</Text>
                            <View style={[s.card, s.timeRow]}>
                                <SpinnerField
                                    label="Hour"
                                    value={hour}
                                    onUp={hourUp}
                                    onDown={hourDown}
                                />
                                <Text style={s.colon}>:</Text>
                                <SpinnerField
                                    label="Min"
                                    value={minute}
                                    onUp={minUp}
                                    onDown={minDown}
                                    display={String(minute).padStart(2, '0')}
                                />
                                <TouchableOpacity
                                    style={s.ampmBtn}
                                    onPress={() => setAmPm(a => a === 'AM' ? 'PM' : 'AM')}
                                    activeOpacity={0.8}
                                >
                                    <Text style={s.ampmText}>{amPm}</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Reminders per day */}
                            <Text style={[s.sectionLabel, { marginTop: 18 }]}>Reminders Per Day</Text>
                            <View style={s.chipRow}>
                                {REMINDERS_PER_DAY_OPTIONS.map(n => (
                                    <TouchableOpacity
                                        key={n}
                                        style={[s.chip, count === n && s.chipActive]}
                                        onPress={() => setCount(n)}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[s.chipText, count === n && s.chipTextActive]}>{n}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Interval */}
                            <Text style={[s.sectionLabel, { marginTop: 18 }]}>Interval Between Reminders</Text>
                            <View style={s.chipRow}>
                                {INTERVAL_OPTIONS.map(opt => (
                                    <TouchableOpacity
                                        key={opt.value}
                                        style={[s.chip, interval === opt.value && s.chipActive]}
                                        onPress={() => setInterval_(opt.value)}
                                        activeOpacity={0.75}
                                    >
                                        <Text style={[s.chipText, interval === opt.value && s.chipTextActive]}>{opt.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Preview */}
                            <View style={s.previewBox}>
                                <Text style={s.previewTitle}>Generated Schedule</Text>
                                <View style={s.previewList}>
                                    {previewTimes.map((t, i) => (
                                        <View key={t + i} style={s.previewItem}>
                                            <View style={s.previewDot} />
                                            <Text style={s.previewTime}>{format12h(t)}</Text>
                                        </View>
                                    ))}
                                </View>
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
                                    : <Text style={s.saveBtnText}>Save Schedule</Text>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    title: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
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
        padding: 16,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        justifyContent: 'center',
    },
    colon: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
        marginBottom: 8,
    },
    ampmBtn: {
        backgroundColor: ACCENT,
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginLeft: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ampmText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
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
    previewBox: {
        marginTop: 22,
        backgroundColor: CARD,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 16,
    },
    previewTitle: {
        color: '#4a6480',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.7,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    previewList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    previewItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,107,0,0.08)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    previewDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: ACCENT,
    },
    previewTime: {
        color: ACCENT,
        fontSize: 13,
        fontWeight: '700',
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
    // Toggle pill
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
