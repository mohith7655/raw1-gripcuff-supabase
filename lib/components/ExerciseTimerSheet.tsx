import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Switch,
    Platform,
} from 'react-native';
import { X, Timer, BedDouble } from 'lucide-react-native';
import { TimerConfig, TimerMode, useWorkoutTimer } from '../hooks/useWorkoutTimer';

const ACCENT = '#F97316';
const BG = '#0f1923';
const SURFACE = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.1)';

interface DurationPreset {
    label: string;
    seconds: number;
}

const DURATION_PRESETS: DurationPreset[] = [
    { label: '30s', seconds: 30 },
    { label: '45s', seconds: 45 },
    { label: '1m',  seconds: 60 },
    { label: '1:30', seconds: 90 },
    { label: '2m',  seconds: 120 },
    { label: '3m',  seconds: 180 },
    { label: '5m',  seconds: 300 },
];

interface Props {
    visible: boolean;
    exerciseName: string;
    initialConfig?: Partial<TimerConfig>;
    onSave: (config: TimerConfig) => void;
    onClose: () => void;
}

// ── Active timer display (shown when timer is running inside the sheet) ─────
function ActiveTimer({ config, onClose }: { config: TimerConfig; onClose: () => void }) {
    const { fmt, isRunning, progress, start, pause, reset } = useWorkoutTimer(config);

    const circumference = 2 * Math.PI * 52;
    const strokeDash = circumference * (1 - progress);

    return (
        <View style={at.container}>
            <View style={at.ring}>
                {/* SVG-free progress arc using border trick */}
                <View style={[at.arc, {
                    borderColor: ACCENT,
                    borderTopColor: progress < 0.75 ? ACCENT : ACCENT,
                    opacity: 0.25 + progress * 0.75,
                }]} />
                <View style={at.arcInner}>
                    <Text style={at.timerFmt}>{fmt}</Text>
                    <Text style={at.timerMode}>{config.mode === 'rest' ? 'REST' : 'WORK'}</Text>
                </View>
            </View>

            <View style={at.controls}>
                <TouchableOpacity style={at.resetBtn} onPress={reset}>
                    <Text style={at.resetTxt}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[at.playBtn, isRunning && at.pauseBtn]}
                    onPress={isRunning ? pause : start}
                >
                    <Text style={at.playTxt}>{isRunning ? 'Pause' : 'Start'}</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={at.doneBtn} onPress={onClose}>
                <Text style={at.doneTxt}>Done</Text>
            </TouchableOpacity>
        </View>
    );
}

// ── Main sheet ───────────────────────────────────────────────────────────────
export function ExerciseTimerSheet({ visible, exerciseName, initialConfig, onSave, onClose }: Props) {
    const [mode, setMode] = useState<TimerMode>(initialConfig?.mode ?? 'countdown');
    const [durationSeconds, setDurationSeconds] = useState(initialConfig?.durationSeconds ?? 60);
    const [autoNext, setAutoNext] = useState(initialConfig?.autoNext ?? false);
    const [notifyOnEnd, setNotifyOnEnd] = useState(initialConfig?.notifyOnEnd ?? false);
    const [showTimer, setShowTimer] = useState(false);

    const config: TimerConfig = { mode, durationSeconds, autoNext, notifyOnEnd };

    const handleSave = () => {
        onSave(config);
        onClose();
    };

    const handleStartNow = () => {
        setShowTimer(true);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
            <View style={s.sheet}>
                <View style={s.handle} />

                {/* Header */}
                <View style={s.header}>
                    <View style={{ width: 36 }} />
                    <Text style={s.title} numberOfLines={1}>
                        Timer — {exerciseName}
                    </Text>
                    <TouchableOpacity onPress={onClose} style={s.iconBtn}>
                        <X color="#aaa" size={20} />
                    </TouchableOpacity>
                </View>

                {showTimer ? (
                    <ActiveTimer config={config} onClose={() => setShowTimer(false)} />
                ) : (
                    <ScrollView showsVerticalScrollIndicator={false}>

                        {/* Mode toggle */}
                        <Label>Mode</Label>
                        <View style={s.modeRow}>
                            {(['countdown', 'rest'] as TimerMode[]).map(m => (
                                <TouchableOpacity
                                    key={m}
                                    style={[s.modeBtn, mode === m && s.modeBtnActive]}
                                    onPress={() => setMode(m)}
                                    activeOpacity={0.8}
                                >
                                    {m === 'countdown'
                                        ? <Timer size={15} color={mode === m ? ACCENT : '#9CA3AF'} />
                                        : <BedDouble size={15} color={mode === m ? '#818CF8' : '#9CA3AF'} />
                                    }
                                    <Text style={[s.modeTxt, mode === m && (m === 'countdown' ? s.modeTxtAccent : s.modeTxtIndigo)]}>
                                        {m === 'countdown' ? 'Countdown' : 'Rest'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Duration presets */}
                        <Label>Duration</Label>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetRow}>
                            {DURATION_PRESETS.map(p => (
                                <TouchableOpacity
                                    key={p.seconds}
                                    style={[s.presetChip, durationSeconds === p.seconds && s.presetChipActive]}
                                    onPress={() => setDurationSeconds(p.seconds)}
                                    activeOpacity={0.75}
                                >
                                    <Text style={[s.presetTxt, durationSeconds === p.seconds && s.presetTxtActive]}>
                                        {p.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Toggles */}
                        <Label>Options</Label>
                        <ToggleRow
                            label="Auto-start next exercise timer"
                            sub="Starts the next timer when this one ends"
                            value={autoNext}
                            onToggle={setAutoNext}
                        />
                        <ToggleRow
                            label="Notify when done"
                            sub="Fire a push notification at zero"
                            value={notifyOnEnd}
                            onToggle={setNotifyOnEnd}
                        />

                        {/* Actions */}
                        <View style={s.actionRow}>
                            <TouchableOpacity style={s.startNowBtn} onPress={handleStartNow} activeOpacity={0.85}>
                                <Text style={s.startNowTxt}>Start Now</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
                                <Text style={s.saveTxt}>Save Config</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ height: 24 }} />
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
}

function Label({ children }: { children: string }) {
    return (
        <Text style={s.label}>{children}</Text>
    );
}

function ToggleRow({
    label, sub, value, onToggle,
}: {
    label: string; sub: string; value: boolean; onToggle: (v: boolean) => void;
}) {
    return (
        <View style={s.toggleRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={s.toggleLabel}>{label}</Text>
                <Text style={s.toggleSub}>{sub}</Text>
            </View>
            <Switch
                value={value}
                onValueChange={onToggle}
                trackColor={{ false: '#334155', true: 'rgba(249,115,22,0.4)' }}
                thumbColor={value ? ACCENT : '#94A3B8'}
            />
        </View>
    );
}

const s = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
    sheet: {
        backgroundColor: BG,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 36,
        maxHeight: '85%',
    },
    handle: {
        width: 40, height: 4, backgroundColor: '#2d3748',
        borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4,
    },
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingVertical: 14,
    },
    iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    title: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, textAlign: 'center' },
    label: {
        color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600',
        letterSpacing: 0.5, textTransform: 'uppercase',
        marginTop: 16, marginBottom: 8,
    },
    modeRow: { flexDirection: 'row', gap: 10 },
    modeBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 12, borderRadius: 12,
        backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    },
    modeBtnActive: { borderColor: ACCENT, backgroundColor: 'rgba(249,115,22,0.1)' },
    modeTxt: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
    modeTxtAccent: { color: ACCENT },
    modeTxtIndigo: { color: '#818CF8' },
    presetRow: { gap: 8, paddingBottom: 4 },
    presetChip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
        backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    },
    presetChipActive: { backgroundColor: 'rgba(249,115,22,0.15)', borderColor: ACCENT },
    presetTxt: { color: '#9CA3AF', fontSize: 14, fontWeight: '600' },
    presetTxtActive: { color: ACCENT },
    toggleRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER,
    },
    toggleLabel: { color: '#fff', fontSize: 14, fontWeight: '500', marginBottom: 2 },
    toggleSub: { color: '#6B7280', fontSize: 12 },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
    startNowBtn: {
        flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center',
        backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    },
    startNowTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
    saveBtn: {
        flex: 1, paddingVertical: 14, borderRadius: 14,
        alignItems: 'center', backgroundColor: ACCENT,
    },
    saveTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// ── Active timer styles ──────────────────────────────────────────────────────
const at = StyleSheet.create({
    container: { alignItems: 'center', paddingVertical: 24 },
    ring: {
        width: 148, height: 148, borderRadius: 74,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
    },
    arc: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 74,
        borderWidth: 6,
        borderColor: ACCENT,
    },
    arcInner: { alignItems: 'center' },
    timerFmt: { color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: 2 },
    timerMode: {
        color: '#9CA3AF', fontSize: 11, fontWeight: '700',
        letterSpacing: 1, textTransform: 'uppercase', marginTop: 2,
    },
    controls: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    resetBtn: {
        paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12,
        backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    },
    resetTxt: { color: '#94A3B8', fontSize: 14, fontWeight: '600' },
    playBtn: {
        paddingHorizontal: 36, paddingVertical: 12,
        borderRadius: 12, backgroundColor: ACCENT,
    },
    pauseBtn: { backgroundColor: '#1d4ed8' },
    playTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
    doneBtn: { marginTop: 8 },
    doneTxt: { color: '#6B7280', fontSize: 14 },
});
