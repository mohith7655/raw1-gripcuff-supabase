import React, { useRef, useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

const ITEM_H = 46;
const VISIBLE = 5;                     // odd number so centre is the selection
const PICKER_H = ITEM_H * VISIBLE;     // total visible height
const PAD = ITEM_H * 2;               // top/bottom padding so first/last can centre

interface Props {
    hour: number;
    minute: number;
    amPm: 'AM' | 'PM';
    onHourChange: (h: number) => void;
    onMinuteChange: (m: number) => void;
    onAmPmChange: (p: 'AM' | 'PM') => void;
    minuteStep?: number;
    compact?: boolean;
}

export function TimeArrowPicker({
    hour, minute, amPm,
    onHourChange, onMinuteChange, onAmPmChange,
    minuteStep = 5,
}: Props) {
    const hours   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) =>
        String(i * minuteStep).padStart(2, '0'),
    );
    const periods = ['AM', 'PM'];

    const hIdx = hour - 1;
    const mIdx = Math.round(minute / minuteStep) % minutes.length;
    const pIdx = amPm === 'AM' ? 0 : 1;

    return (
        <View style={s.row}>
            <WheelColumn values={hours}   selectedIndex={hIdx} onSelect={(i) => onHourChange(i + 1)}                flex={3} />
            <Text style={s.colon}>:</Text>
            <WheelColumn values={minutes} selectedIndex={mIdx} onSelect={(i) => onMinuteChange(i * minuteStep)}    flex={3} />
            <WheelColumn values={periods} selectedIndex={pIdx} onSelect={(i) => onAmPmChange(i === 0 ? 'AM' : 'PM')} flex={2} />
        </View>
    );
}

interface ColProps {
    values: string[];
    selectedIndex: number;
    onSelect: (index: number) => void;
    flex?: number;
}

function WheelColumn({ values, selectedIndex, onSelect, flex = 1 }: ColProps) {
    const ref = useRef<ScrollView>(null);
    const isDragging = useRef(false);
    // Fires the commit once scrolling has settled. Native momentum/drag-end
    // events are unreliable on web, so we also detect "scroll stopped" here.
    const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Live visual index — updated on every scroll event so highlight follows the finger
    const [liveIndex, setLiveIndex] = useState(selectedIndex);

    // Scroll to position when the value is changed externally (not by this column)
    useEffect(() => {
        if (!isDragging.current) {
            ref.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
            setLiveIndex(selectedIndex);
        }
    }, [selectedIndex]);

    useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

    const idxFromY = (y: number) =>
        Math.max(0, Math.min(values.length - 1, Math.round(y / ITEM_H)));

    const commit = (y: number) => {
        if (settleTimer.current) { clearTimeout(settleTimer.current); settleTimer.current = null; }
        const idx = idxFromY(y);
        setLiveIndex(idx);
        isDragging.current = false;
        onSelect(idx);
    };

    const handleScroll = (e: any) => {
        const y = e.nativeEvent.contentOffset.y;
        setLiveIndex(idxFromY(y));
        // Debounced scroll-stop detection — the resilient cross-platform commit path.
        if (settleTimer.current) clearTimeout(settleTimer.current);
        settleTimer.current = setTimeout(() => commit(y), 140);
    };

    const snapToIndex = (y: number) => {
        const idx = idxFromY(y);
        ref.current?.scrollTo({ y: idx * ITEM_H, animated: true });
        commit(idx * ITEM_H);
    };

    return (
        <View style={[s.column, { flex }]}>
            {/* centre highlight band */}
            <View style={s.highlight} pointerEvents="none" />

            <ScrollView
                ref={ref}
                showsVerticalScrollIndicator={false}
                snapToInterval={ITEM_H}
                decelerationRate="fast"
                contentContainerStyle={{ paddingVertical: PAD }}
                onScrollBeginDrag={() => { isDragging.current = true; }}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onMomentumScrollEnd={(e) => snapToIndex(e.nativeEvent.contentOffset.y)}
                onScrollEndDrag={(e) => snapToIndex(e.nativeEvent.contentOffset.y)}
            >
                {values.map((v, i) => {
                    const dist = Math.abs(i - liveIndex);
                    return (
                        <View key={i} style={s.item}>
                            <Text style={[
                                s.itemText,
                                dist === 0 && s.itemTextSelected,
                                dist === 1 && s.itemTextNear,
                                dist >= 2  && s.itemTextFar,
                            ]}>
                                {v}
                            </Text>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%' as any,
        overflow: 'hidden' as any,
    },
    colon: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        paddingHorizontal: 4,
        marginTop: -2,
    },
    column: {
        height: PICKER_H,
        overflow: 'hidden' as any,
        position: 'relative',
    },
    highlight: {
        position: 'absolute',
        top: ITEM_H * 2,
        left: 4,
        right: 4,
        height: ITEM_H,
        backgroundColor: 'rgba(232,153,81,0.12)',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(232,153,81,0.35)',
        borderRadius: 8,
        zIndex: 1,
    },
    item: {
        height: ITEM_H,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '600',
    },
    itemTextSelected: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
    },
    itemTextNear: {
        fontSize: 19,
        fontWeight: '400',
        opacity: 0.45,
    },
    itemTextFar: {
        fontSize: 16,
        fontWeight: '400',
        opacity: 0.18,
    },
});
