import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MovementEquivalenceCard } from './MovementEquivalenceCard';

export type ExerciseName = 'Squats' | 'Leaning Pullups';

interface Props {
    workoutDurationMin: number;
    intervalMins: number;
    startTime: string;
    endTime: string;
    exerciseName: ExerciseName;
}

const COLUMNS_BASE = [
    { key: 'slow',  icon: '🐢', pace: 'Slow pace',  color: '#4ade80' },
    { key: 'avg',   icon: '🏃', pace: 'Avg pace',   color: '#f59e0b' },
    { key: 'fast',  icon: '⚡', pace: 'Fast pace',  color: '#f87171' },
] as const;

const EXERCISE_CONFIG: Record<ExerciseName, {
    unit: string;
    headerLabel: string;
    rates: [number, number, number];        // slow / avg / fast ratePerMin
    multipliers: [number, number, number];  // step equivalence multipliers
}> = {
    'Squats': {
        unit: 'squats',
        headerLabel: 'SQUATS',
        rates: [10, 15, 25],
        multipliers: [1.10, 1.27, 1.24],
    },
    'Leaning Pullups': {
        unit: 'reps',
        headerLabel: 'LEANING PULLUPS',
        rates: [8, 12, 20],
        multipliers: [1.15, 1.30, 1.40],
    },
};

export function IntensityComparisonCard({ workoutDurationMin, intervalMins, exerciseName }: Props) {
    const config = EXERCISE_CONFIG[exerciseName];

    const cols = useMemo(() =>
        COLUMNS_BASE.map((base, i) => ({
            ...base,
            count: config.rates[i] * workoutDurationMin,
            steps: Math.round(config.rates[i] * workoutDurationMin * config.multipliers[i]),
        })),
        [workoutDurationMin, exerciseName],
    );

    const intervalDisplay = intervalMins >= 60
        ? `${intervalMins / 60}hr`
        : `${intervalMins} min`;

    return (
        <View style={s.root}>
            {/* Header */}
            <Text style={s.header}>
                IF YOU DO {config.headerLabel} FOR {workoutDurationMin} MIN
            </Text>

            {/* 3-column row */}
            <View style={s.card}>
                {cols.map((col, i) => (
                    <React.Fragment key={col.key}>
                        <MovementEquivalenceCard
                            icon={col.icon}
                            pace={col.pace}
                            count={col.count}
                            unit={config.unit}
                            steps={col.steps}
                            accentColor={col.color}
                        />
                        {i < cols.length - 1 && <View style={s.divider} />}
                    </React.Fragment>
                ))}
            </View>

            {/* Footer */}
            <Text style={s.footer}>
                {cols[0].count} {config.unit} every {intervalDisplay} = metabolic benefits equal to a 10,000-step walk 💪
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
