/**
 * AlarmPillSheet — bottom sheet that opens when a user taps a scheduled alarm pill.
 * Lets them: edit the time, toggle it on/off, snooze (skip / +15 / +30 min), or delete it.
 */
import React, { useState, useEffect } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Switch, TextInput,
} from 'react-native';
import { X, Trash2, Clock } from 'lucide-react-native';
import { AlarmConfig, formatMoveTime12h } from '../services/moveReminder.service';
import { reminderWatcherService } from '../services/reminderWatcher.service';
import { getUserDateKey } from '../utils/userDate';

const ACCENT   = '#E89951';
const BG       = '#0d1825';
const CARD     = '#111d2e';
const BORDER   = 'rgba(232,153,81,0.2)';
const SNOOZE_OPTIONS = [
    { label: 'Skip today',  mins: 0,  color: '#f87171' },
    { label: '+15 min',     mins: 15, color: '#f59e0b' },
    { label: '+30 min',     mins: 30, color: '#4ade80' },
];

interface Props {
    visible: boolean;
    alarm: AlarmConfig | null;
    reminderId: string;
    onClose: () => void;
    /** Called when user toggles or edits the alarm time. Caller saves to DB. */
    onUpdate: (updated: AlarmConfig) => void;
    onDelete: () => void;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function parse24(slot: string): { h: number; m: number } {
    const [h, m] = slot.split(':').map(Number);
    return { h, m };
}

function to24(h: number, m: number): string {
    return `${pad(h)}:${pad(m)}`;
}

export function AlarmPillSheet({ visible, alarm, reminderId, onClose, onUpdate, onDelete }: Props) {
    const [editH, setEditH] = useState(0);
    const [editM, setEditM] = useState(0);
    const [enabled, setEnabled] = useState(true);
    const [label, setLabel] = useState('');
    const [snoozedLabel, setSnoozedLabel] = useState<string | null>(null);

    useEffect(() => {
        if (!alarm) return;
        const { h, m } = parse24(alarm.time);
        setEditH(h);
        setEditM(m);
        setEnabled(alarm.enabled);
        setLabel(alarm.label || '');
        setSnoozedLabel(null);
    }, [alarm]);

    if (!alarm) return null;

    const timeChanged = to24(editH, editM) !== alarm.time;

    const handleToggle = (val: boolean) => {
        setEnabled(val);
        onUpdate({ ...alarm, enabled: val });
    };

    const handleSaveTime = () => {
        const newTime = to24(editH, editM);
        onUpdate({ ...alarm, time: newTime, label: label || undefined });
        onClose();
    };

    const handleLabelBlur = () => {
        onUpdate({ ...alarm, label: label || undefined });
    };

    const handleSnooze = (mins: number, label: string) => {
        const dateKey = getUserDateKey(
            Intl.DateTimeFormat().resolvedOptions().timeZone,
            new Date()
        );
        reminderWatcherService.snoozeAlarm(reminderId, alarm.time, mins, dateKey);
        setSnoozedLabel(label);
    };

    const hourUp   = () => setEditH(h => (h + 1) % 24);
    const hourDown = () => setEditH(h => (h + 23) % 24);
    const minUp    = () => setEditM(m => (m + 5) % 60);
    const minDown  = () => setEditM(m => (m - 5 + 60) % 60);

    const display12h = (() => {
        const ampm = editH >= 12 ? 'PM' : 'AM';
        const h12 = editH % 12 === 0 ? 12 : editH % 12;
        return `${h12}:${pad(editM)} ${ampm}`;
    })();

    return (
        <Modal visible={visible} transparent animationType="slide">
            <SafeAreaView style={ss.overlay}>
                <View style={ss.sheet}>
                    {/* Header */}
                    <View style={ss.header}>
                        <Text style={ss.headerTitle}>Alarm Settings</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <X color="#4a6480" size={22} />
                        </TouchableOpacity>
                    </View>

                    {/* Time editor */}
                    <View style={ss.timeCard}>
                        <View style={ss.spinnerRow}>
                            {/* Hours */}
                            <View style={ss.spinner}>
                                <TouchableOpacity style={ss.arrow} onPress={hourUp} activeOpacity={0.7}>
                                    <Text style={ss.arrowText}>▲</Text>
                                </TouchableOpacity>
                                <View style={ss.timeBox}>
                                    <Text style={ss.timeBoxText}>{pad(editH)}</Text>
                                </View>
                                <TouchableOpacity style={ss.arrow} onPress={hourDown} activeOpacity={0.7}>
                                    <Text style={ss.arrowText}>▼</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={ss.colon}>:</Text>

                            {/* Minutes */}
                            <View style={ss.spinner}>
                                <TouchableOpacity style={ss.arrow} onPress={minUp} activeOpacity={0.7}>
                                    <Text style={ss.arrowText}>▲</Text>
                                </TouchableOpacity>
                                <View style={ss.timeBox}>
                                    <Text style={ss.timeBoxText}>{pad(editM)}</Text>
                                </View>
                                <TouchableOpacity style={ss.arrow} onPress={minDown} activeOpacity={0.7}>
                                    <Text style={ss.arrowText}>▼</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={ss.ampm}>{editH >= 12 ? 'PM' : 'AM'}</Text>
                        </View>

                        {timeChanged && (
                            <TouchableOpacity style={ss.saveTimeBtn} onPress={handleSaveTime} activeOpacity={0.8}>
                                <Clock color="#fff" size={13} />
                                <Text style={ss.saveTimeBtnText}>Save new time</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Label */}
                    <Text style={ss.sectionLabel}>Label</Text>
                    <TextInput
                        style={ss.labelInput}
                        value={label}
                        onChangeText={setLabel}
                        onBlur={handleLabelBlur}
                        placeholder="e.g. Stretch break"
                        placeholderTextColor="#2a4060"
                        maxLength={40}
                    />

                    {/* Enable toggle */}
                    <View style={ss.row}>
                        <Text style={ss.rowLabel}>Alarm enabled</Text>
                        <Switch
                            value={enabled}
                            onValueChange={handleToggle}
                            trackColor={{ false: '#1c2e42', true: ACCENT }}
                            thumbColor="#fff"
                        />
                    </View>

                    {/* Snooze */}
                    <Text style={ss.sectionLabel}>Snooze for today</Text>
                    <View style={ss.snoozeRow}>
                        {SNOOZE_OPTIONS.map(opt => {
                            const active = snoozedLabel === opt.label;
                            return (
                                <TouchableOpacity
                                    key={opt.label}
                                    style={[ss.snoozeChip, active && { borderColor: opt.color, backgroundColor: opt.color + '22' }]}
                                    onPress={() => handleSnooze(opt.mins, opt.label)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[ss.snoozeChipText, active && { color: opt.color }]}>
                                        {active ? '✓ ' : ''}{opt.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <Text style={ss.snoozeHint}>Snooze affects today only — permanent schedule unchanged.</Text>

                    {/* Delete */}
                    <TouchableOpacity style={ss.deleteBtn} onPress={() => { onDelete(); onClose(); }} activeOpacity={0.8}>
                        <Trash2 color="#f87171" size={15} />
                        <Text style={ss.deleteBtnText}>Remove this alarm</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const ss = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheet: {
        backgroundColor: BG,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        paddingHorizontal: 20,
        paddingBottom: 36,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: BORDER,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        marginBottom: 18,
    },
    headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    timeCard: {
        backgroundColor: CARD,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 16,
        alignItems: 'center',
        marginBottom: 18,
    },
    spinnerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    spinner: { alignItems: 'center', gap: 4 },
    arrow: { padding: 6 },
    arrowText: { color: ACCENT, fontSize: 16, fontWeight: '700' },
    timeBox: {
        width: 64,
        height: 56,
        backgroundColor: '#0a1628',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER,
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeBoxText: { color: '#fff', fontSize: 28, fontWeight: '800' },
    colon: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 4 },
    ampm: { color: ACCENT, fontSize: 16, fontWeight: '700', marginLeft: 4, alignSelf: 'center' },
    saveTimeBtn: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FF6B00',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    saveTimeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        marginBottom: 16,
    },
    rowLabel: { color: 'rgba(200,220,240,0.85)', fontSize: 14, fontWeight: '600' },
    sectionLabel: {
        color: '#4a6480',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.7,
        textTransform: 'uppercase',
        marginBottom: 10,
    },
    labelInput: {
        backgroundColor: CARD,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BORDER,
        color: '#fff',
        fontSize: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
    },
    snoozeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    snoozeChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        backgroundColor: CARD,
        alignItems: 'center',
    },
    snoozeChipText: { color: 'rgba(150,180,210,0.7)', fontSize: 12, fontWeight: '700' },
    snoozeHint: {
        color: 'rgba(150,180,210,0.35)',
        fontSize: 11,
        textAlign: 'center',
        marginBottom: 20,
    },
    deleteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(248,113,113,0.3)',
        backgroundColor: 'rgba(248,113,113,0.06)',
    },
    deleteBtnText: { color: '#f87171', fontSize: 14, fontWeight: '700' },
});
