import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Switch,
    TextInput,
    Keyboard,
} from 'react-native';
import { Bell } from 'lucide-react-native';
import { IntervalAlertConfig, INTERVAL_PRESETS, MESSAGE_PRESETS } from '../hooks/useIntervalAlerts';

const ACCENT = '#F97316';
const SURFACE = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.1)';

interface Props {
    value: IntervalAlertConfig;
    onChange: (config: IntervalAlertConfig) => void;
    /** compact=true renders just toggles for use inside SelfScheduleModal */
    compact?: boolean;
}

export function IntervalAlertsConfig({ value, onChange, compact = false }: Props) {
    const [showCustomMessage, setShowCustomMessage] = useState(false);
    const [customIntervalText, setCustomIntervalText] = useState('');
    const [showCustomInterval, setShowCustomInterval] = useState(false);

    const update = (patch: Partial<IntervalAlertConfig>) =>
        onChange({ ...value, ...patch });

    if (compact) {
        return (
            <View>
                <ToggleRow
                    label="Interval alerts during workout"
                    sub={value.enabled
                        ? `Every ${value.intervalMinutes} min — "${value.message.slice(0, 28)}…"`
                        : 'Get in-app + push nudges while you work out'}
                    value={value.enabled}
                    onToggle={v => update({ enabled: v })}
                />
                {value.enabled && (
                    <View style={s.compactBody}>
                        <Label>Alert every</Label>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                            {INTERVAL_PRESETS.map(m => (
                                <Chip
                                    key={m}
                                    label={`${m} min`}
                                    active={value.intervalMinutes === m && !showCustomInterval}
                                    onPress={() => { setShowCustomInterval(false); update({ intervalMinutes: m }); }}
                                />
                            ))}
                            <Chip
                                label="Custom"
                                active={showCustomInterval}
                                onPress={() => setShowCustomInterval(v => !v)}
                            />
                        </ScrollView>
                        {showCustomInterval && (
                            <TextInput
                                style={s.customInput}
                                placeholder="minutes"
                                placeholderTextColor="#555"
                                keyboardType="number-pad"
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                                value={customIntervalText}
                                onChangeText={t => {
                                    setCustomIntervalText(t.replace(/[^0-9]/g, ''));
                                    const n = parseInt(t, 10);
                                    if (n > 0) update({ intervalMinutes: n });
                                }}
                            />
                        )}
                    </View>
                )}
            </View>
        );
    }

    // Full version (for VideoPlayerScreen / active workout)
    return (
        <View style={s.container}>
            <View style={s.headerRow}>
                <Bell size={16} color={ACCENT} />
                <Text style={s.heading}>Interval Alerts</Text>
                <Switch
                    value={value.enabled}
                    onValueChange={v => update({ enabled: v })}
                    trackColor={{ false: '#334155', true: 'rgba(249,115,22,0.4)' }}
                    thumbColor={value.enabled ? ACCENT : '#94A3B8'}
                />
            </View>

            {value.enabled && (
                <View>
                    {/* Interval picker */}
                    <Label>Alert every</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                        {INTERVAL_PRESETS.map(m => (
                            <Chip
                                key={m}
                                label={`${m} min`}
                                active={value.intervalMinutes === m && !showCustomInterval}
                                onPress={() => { setShowCustomInterval(false); update({ intervalMinutes: m }); }}
                            />
                        ))}
                        <Chip
                            label="Custom"
                            active={showCustomInterval}
                            onPress={() => setShowCustomInterval(v => !v)}
                        />
                    </ScrollView>
                    {showCustomInterval && (
                        <TextInput
                            style={s.customInput}
                            placeholder="Enter minutes"
                            placeholderTextColor="#555"
                            keyboardType="number-pad"
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            value={customIntervalText}
                            onChangeText={t => {
                                setCustomIntervalText(t.replace(/[^0-9]/g, ''));
                                const n = parseInt(t, 10);
                                if (n > 0) update({ intervalMinutes: n });
                            }}
                        />
                    )}

                    {/* Message picker */}
                    <Label>Alert message</Label>
                    <View style={s.msgList}>
                        {MESSAGE_PRESETS.map(msg => (
                            <TouchableOpacity
                                key={msg}
                                style={[s.msgChip, value.message === msg && !showCustomMessage && s.msgChipActive]}
                                onPress={() => { setShowCustomMessage(false); update({ message: msg }); }}
                                activeOpacity={0.75}
                            >
                                <Text style={[s.msgTxt, value.message === msg && !showCustomMessage && s.msgTxtActive]}>
                                    {msg}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[s.msgChip, showCustomMessage && s.msgChipActive]}
                            onPress={() => setShowCustomMessage(v => !v)}
                            activeOpacity={0.75}
                        >
                            <Text style={[s.msgTxt, showCustomMessage && s.msgTxtActive]}>Custom…</Text>
                        </TouchableOpacity>
                    </View>
                    {showCustomMessage && (
                        <TextInput
                            style={s.customInput}
                            placeholder="Your motivational message"
                            placeholderTextColor="#555"
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            value={MESSAGE_PRESETS.includes(value.message) ? '' : value.message}
                            onChangeText={t => update({ message: t })}
                            maxLength={80}
                        />
                    )}

                    {/* Duration cap */}
                    <Label>Stop after (minutes)</Label>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                        {[15, 30, 45, 60, 90].map(m => (
                            <Chip
                                key={m}
                                label={`${m} min`}
                                active={value.totalMinutes === m}
                                onPress={() => update({ totalMinutes: m })}
                            />
                        ))}
                    </ScrollView>

                    <View style={s.infoBox}>
                        <Text style={s.infoTxt}>
                            {Math.floor(value.totalMinutes / value.intervalMinutes)} alerts will be sent
                            every {value.intervalMinutes} min for {value.totalMinutes} min.
                            Notifications fire even when the app is closed.
                        </Text>
                    </View>
                </View>
            )}
        </View>
    );
}

// ── Shared sub-components ────────────────────────────────────────────────────
function Label({ children }: { children: string }) {
    return (
        <Text style={s.label}>{children}</Text>
    );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            style={[s.chip, active && s.chipActive]}
            onPress={onPress}
            activeOpacity={0.75}
        >
            <Text style={[s.chipTxt, active && s.chipTxtActive]}>{label}</Text>
        </TouchableOpacity>
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
                {!!sub && <Text style={s.toggleSub}>{sub}</Text>}
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
    container: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 14, borderWidth: 1, borderColor: BORDER,
        padding: 14, marginTop: 8,
    },
    headerRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    heading: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
    label: {
        color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600',
        letterSpacing: 0.5, textTransform: 'uppercase',
        marginTop: 14, marginBottom: 8,
    },
    chipRow: { gap: 8, paddingBottom: 4 },
    chip: {
        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
        backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    },
    chipActive: { backgroundColor: 'rgba(249,115,22,0.15)', borderColor: ACCENT },
    chipTxt: { color: '#9CA3AF', fontSize: 13, fontWeight: '600' },
    chipTxtActive: { color: ACCENT },
    msgList: { gap: 6 },
    msgChip: {
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
        backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    },
    msgChipActive: { backgroundColor: 'rgba(249,115,22,0.1)', borderColor: ACCENT },
    msgTxt: { color: '#9CA3AF', fontSize: 13 },
    msgTxtActive: { color: '#fff' },
    customInput: {
        marginTop: 8, backgroundColor: SURFACE, borderRadius: 12,
        borderWidth: 1, borderColor: BORDER,
        color: '#fff', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12,
    },
    infoBox: {
        marginTop: 12, padding: 10, borderRadius: 10,
        backgroundColor: 'rgba(129,140,248,0.08)',
    },
    infoTxt: { color: '#818CF8', fontSize: 12, lineHeight: 18 },
    toggleRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10,
    },
    toggleLabel: { color: '#fff', fontSize: 14, fontWeight: '500', marginBottom: 2 },
    toggleSub: { color: '#6B7280', fontSize: 12 },
    compactBody: { paddingLeft: 4, marginTop: 4 },
});
