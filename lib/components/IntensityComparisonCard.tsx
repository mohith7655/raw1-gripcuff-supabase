import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MovementEquivalenceCard } from './MovementEquivalenceCard';

interface Props {
    workoutDurationMin: number;
    intervalMins: number;
    startTime: string;
    endTime: string;
}

const COLUMNS = [
    { key: 'slow',  icon: '🐢', pace: 'Slow pace',  ratePerMin: 10, multiplier: 1.10, color: '#4ade80' },
    { key: 'avg',   icon: '🏃', pace: 'Avg pace',   ratePerMin: 15, multiplier: 1.27, color: '#f59e0b' },
    { key: 'fast',  icon: '⚡', pace: 'Fast pace',  ratePerMin: 25, multiplier: 1.24, color: '#f87171' },
] as const;

export function IntensityComparisonCard({ workoutDurationMin, intervalMins }: Props) {
    const cols = useMemo(() =>
        COLUMNS.map(c => ({
            ...c,
            squats: c.ratePerMin * workoutDurationMin,
            steps: Math.round(c.ratePerMin * workoutDurationMin * c.multiplier),
        })),
        [workoutDurationMin],
    );

    const intervalDisplay = intervalMins >= 60
        ? `${intervalMins / 60}hr`
        : `${intervalMins} min`;

    return (
        <View style={s.root}>
            {/* Header */}
            <Text style={s.header}>
                IF YOU DO SQUATS FOR {workoutDurationMin} MIN
            </Text>

            {/* 3-column row */}
            <View style={s.card}>
                {cols.map((col, i) => (
                    <React.Fragment key={col.key}>
                        <MovementEquivalenceCard
                            icon={col.icon}
                            pace={col.pace}
                            squats={col.squats}
                            steps={col.steps}
                            accentColor={col.color}
                        />
                        {i < cols.length - 1 && <View style={s.divider} />}
                    </React.Fragment>
                ))}
            </View>

            {/* Footer */}
            <Text style={s.footer}>
                {cols[0].squats} squats every {intervalDisplay} = metabolic benefits equal to a 10,000-step walk 💪
            </Text>
        </View>
    );
}

const s = StyleSheet.create({
    root: {
        marginTop: 20,
    },
    header: {
        color: '#2a4060',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: 8,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'stretch',
        backgroundColor: '#071120',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    divider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.07)',
        marginVertical: 12,
    },
    footer: {
        color: '#2a4060',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 16,
        paddingHorizontal: 8,
    },
});
