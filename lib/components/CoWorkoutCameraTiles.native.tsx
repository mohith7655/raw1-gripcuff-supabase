import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RtcSurfaceView } from 'react-native-agora';

interface Props {
    remoteUids?: number[];
    friendName?: string;
}

/**
 * Native: renders local preview (uid 0) and one tile per remote participant
 * using RtcSurfaceView. The Agora engine writes video directly into these views.
 */
export function CoWorkoutCameraTiles({ remoteUids = [], friendName }: Props) {
    return (
        <View style={styles.row}>
            {/* Local camera preview */}
            <View style={styles.card}>
                <RtcSurfaceView style={styles.video} canvas={{ uid: 0 }} />
                <Text style={styles.label}>You</Text>
            </View>

            {/* Remote participant(s) */}
            {remoteUids.length > 0 ? (
                remoteUids.map(uid => (
                    <View key={uid} style={styles.card}>
                        <RtcSurfaceView style={styles.video} canvas={{ uid }} />
                        <Text style={styles.label}>{friendName ?? 'Partner'}</Text>
                    </View>
                ))
            ) : (
                <View style={[styles.card, styles.waitingCard]}>
                    <Text style={styles.waitingText}>Waiting for partner…</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        backgroundColor: '#0d1520',
        height: 110,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
    },
    card: {
        flex: 1,
        backgroundColor: '#1c2e42',
        borderRadius: 10,
        overflow: 'hidden',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    video: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    label: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
        backgroundColor: 'rgba(0,0,0,0.45)',
        paddingVertical: 2,
    },
    waitingCard: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    waitingText: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 11,
        textAlign: 'center',
    },
});
