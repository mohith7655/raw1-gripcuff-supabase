import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MovementEquivalenceCard } from './MovementEquivalenceCard';

export type ExerciseName = 'Squats' | 'Wall Sits' | 'Standing Glute Kickbacks';

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
    'Wall Sits': {
        unit: 'holds',
        headerLabel: 'WALL SITS',
        rates: [1, 2, 3],
        multipliers: [1.05, 1.18, 1.35],
    },
    'Standing Glute Kickbacks': {
        unit: 'kicks',
        headerLabel: 'GLUTE KICKBACKS',
        rates: [15, 25, 40],
        multipliers: [0.90, 1.05, 1.20],
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
