import React from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Edit2 } from 'lucide-react-native';
import { AlarmConfig } from '../services/moveReminder.service';

const ACCENT = '#E89951';

interface Props {
    alarm: AlarmConfig;
    isLast?: boolean;
    onPress: () => void;
    onToggle: (enabled: boolean) => void;
    compact?: boolean;
}

function parseTime(slot: string): { hour: string; minute: string; ampm: string } {
    const [h, m] = slot.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return { hour: String(h12), minute: String(m).padStart(2, '0'), ampm };
}

export function AlarmListRow({ alarm, isLast, onPress, onToggle, compact }: Props) {
    const { hour, minute, ampm } = parseTime(alarm.time);
    const timeFontSize = compact ? 28 : 36;
    const ampmFontSize = compact ? 13 : 16;

    return (
        <View style={[r.row, isLast && r.rowLast]}>
            {/* Time */}
            <View style={r.left}>
                <View style={r.timeRow}>
                    <Text style={[r.timeText, { fontSize: timeFontSize }, !alarm.enabled && r.dimText]}>
                        {hour}:{minute}
                    </Text>
                    <Text style={[r.ampmText, { fontSize: ampmFontSize }, !alarm.enabled && r.dimText]}>
                        {' '}{ampm}
                    </Text>
                </View>
            </View>

            {/* Edit button */}
            <TouchableOpacity
                style={r.editBtn}
                onPress={onPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
            >
                <Edit2 color={ACCENT} size={compact ? 14 : 15} />
            </TouchableOpacity>

            {/* Toggle */}
            <Switch
                value={alarm.enabled}
                onValueChange={onToggle}
                trackColor={{ false: '#1c2e42', true: ACCENT }}
                thumbColor="#fff"
                style={r.toggle}
            />
        </View>
    );
}

const r = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.07)',
    },
    rowLast: {
        borderBottomWidth: 0,
    },
    left: {
        flex: 1,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    timeText: {
        color: '#fff',
        fontWeight: '300',
        letterSpacing: -1,
        lineHeight: 42,
    },
    ampmText: {
        color: '#fff',
        fontWeight: '400',
        marginBottom: 4,
    },
    dimText: {
        color: 'rgba(150,180,210,0.28)',
    },
    editBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(232,153,81,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(232,153,81,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    toggle: {
        marginLeft: 2,
    },
});
