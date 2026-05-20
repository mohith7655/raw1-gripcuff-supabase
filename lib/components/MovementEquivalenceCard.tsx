import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface Props {
    icon: string;        // emoji
    pace: string;
    squats: number;
    steps: number;
    accentColor: string;
}

export function MovementEquivalenceCard({ icon, pace, squats, steps, accentColor }: Props) {
    const glowAnim = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
                Animated.timing(glowAnim, { toValue: 0.5, duration: 1800, useNativeDriver: true }),
            ])
        ).start();
        return () => { glowAnim.stopAnimation(); };
    }, []);

    const glowStyle = {
        opacity: glowAnim,
        backgroundColor: accentColor,
    };

    return (
        <View style={styles.col}>
            {/* Animated glow ring behind icon */}
            <View style={styles.iconWrap}>
                <Animated.View style={[styles.iconGlow, glowStyle]} />
                <Text style={styles.icon}>{icon}</Text>
            </View>

            {/* Pace label */}
            <Text style={[styles.paceLabel, { color: accentColor }]}>{pace}</Text>

            {/* Squat count */}
            <Text style={[styles.squatNumber, { color: accentColor }]}>{squats}</Text>
            <Text style={styles.squatWord}>squats</Text>

            {/* Step equivalence */}
            <View style={[styles.stepChip, { borderColor: accentColor + '40' }]}>
                <Text style={[styles.stepText, { color: accentColor }]}>≈ {steps} steps</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    col: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 4,
        gap: 5,
    },
    iconWrap: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
    },
    iconGlow: {
        position: 'absolute',
        width: 48,
        height: 48,
        borderRadius: 24,
        opacity: 0.18,
    },
    icon: {
        fontSize: 26,
    },
    paceLabel: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    squatNumber: {
        fontSize: 30,
        fontWeight: '800',
        lineHeight: 34,
    },
    squatWord: {
        fontSize: 10,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.3)',
        marginTop: -2,
    },
    stepChip: {
        marginTop: 4,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    stepText: {
        fontSize: 11,
        fontWeight: '700',
    },
});
