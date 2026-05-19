import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronUp, ChevronDown } from 'lucide-react-native';

const ACCENT = '#FF6B00';
const BORDER = 'rgba(255,107,0,0.2)';

interface Props {
    hour: number;       // 1–12
    minute: number;     // 0–59
    amPm: 'AM' | 'PM';
    onHourChange: (h: number) => void;
    onMinuteChange: (m: number) => void;
    onAmPmChange: (p: 'AM' | 'PM') => void;
    minuteStep?: number; // default 5
    compact?: boolean;   // smaller boxes for side-by-side layouts
}

export function TimeArrowPicker({
    hour, minute, amPm,
    onHourChange, onMinuteChange, onAmPmChange,
    minuteStep = 5,
    compact = false,
}: Props) {
    const hourUp   = () => onHourChange(hour % 12 + 1);
    const hourDown = () => onHourChange(hour === 1 ? 12 : hour - 1);
    const minUp    = () => onMinuteChange((minute + minuteStep) % 60);
    const minDown  = () => onMinuteChange((minute - minuteStep + 60) % 60);

    return (
        <View style={s.row}>
            <Spinner
                display={String(hour).padStart(2, '0')}
                onUp={hourUp}
                onDown={hourDown}
                compact={compact}
            />
            <Text style={[s.colon, compact && s.colonCompact]}>:</Text>
            <Spinner
                display={String(minute).padStart(2, '0')}
                onUp={minUp}
                onDown={minDown}
                compact={compact}
            />
            <View style={s.ampmStack}>
                {(['AM', 'PM'] as const).map(period => (
                    <TouchableOpacity
                        key={period}
                        style={[s.ampmOption, compact && s.ampmOptionCompact, amPm === period && s.ampmOptionActive]}
                        onPress={() => onAmPmChange(period)}
                        activeOpacity={0.8}
                    >
                        <Text style={[s.ampmText, amPm === period && s.ampmTextActive]}>
                            {period}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

function Spinner({ display, onUp, onDown, compact }: {
    display: string;
    onUp: () => void;
    onDown: () => void;
    compact?: boolean;
}) {
    return (
        <View style={s.spinWrap}>
            <TouchableOpacity style={s.arrow} onPress={onUp} activeOpacity={0.7}>
                <ChevronUp color={ACCENT} size={compact ? 16 : 20} />
            </TouchableOpacity>
            <View style={[s.box, compact && s.boxCompact]}>
                <Text style={[s.boxText, compact && s.boxTextCompact]}>{display}</Text>
            </View>
            <TouchableOpacity style={s.arrow} onPress={onDown} activeOpacity={0.7}>
                <ChevronDown color={ACCENT} size={compact ? 16 : 20} />
            </TouchableOpacity>
        </View>
    );
}

const s = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    spinWrap: { alignItems: 'center', gap: 4 },
    arrow: { padding: 4 },
    box: {
        width: 56,
        height: 52,
        backgroundColor: '#0a1628',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BORDER,
        alignItems: 'center',
        justifyContent: 'center',
    },
    boxCompact: {
        width: 42,
        height: 40,
        borderRadius: 8,
    },
    boxText: { color: '#fff', fontSize: 24, fontWeight: '800' },
    boxTextCompact: { fontSize: 18 },
    colon: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '800',
        marginBottom: 6,
    },
    colonCompact: {
        fontSize: 20,
        marginBottom: 4,
    },
    ampmStack: {
        flexDirection: 'column',
        gap: 5,
        marginLeft: 6,
    },
    ampmOption: {
        paddingHorizontal: 10,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: '#0a1628',
        borderWidth: 1,
        borderColor: BORDER,
        alignItems: 'center',
        minWidth: 46,
    },
    ampmOptionCompact: {
        paddingHorizontal: 8,
        paddingVertical: 6,
        minWidth: 38,
    },
    ampmOptionActive: {
        backgroundColor: ACCENT,
        borderColor: ACCENT,
    },
    ampmText: {
        color: '#4a6480',
        fontSize: 12,
        fontWeight: '700',
    },
    ampmTextActive: {
        color: '#fff',
    },
});
