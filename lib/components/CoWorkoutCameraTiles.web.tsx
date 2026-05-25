import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
    friendName?: string;
    remoteUids?: number[]; // unused on web — remote video renders via DOM injection
}

/**
 * Web: renders two <div> containers that AgoraVoice.web.ts injects video
 * tracks into via track.play('local-video') / track.play('remote-video').
 */
export function CoWorkoutCameraTiles({ friendName }: Props) {
    return (
        <View style={styles.row}>
            <View style={styles.card}>
                <View nativeID="local-video" style={styles.video} />
                <Text style={styles.label}>You</Text>
            </View>
            <View style={styles.card}>
                <View nativeID="remote-video" style={styles.video} />
                <Text style={styles.label}>{friendName ?? 'Partner'}</Text>
            </View>
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
    } as any,
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
        backgroundColor: '#1c2e42',
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
});
