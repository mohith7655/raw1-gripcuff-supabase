import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
    remoteUids?: number[];
    friendName?: string;
    cameraPermissionDenied?: boolean;
}

/**
 * Native placeholder — video call is web-only for now. Native build will get
 * its own implementation using RtcSurfaceView in a follow-up.
 */
export function CoWorkoutCameraTiles({ }: Props) {
    return (
        <View style={styles.container}>
            <Text style={styles.placeholder}>Video call available on web</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    placeholder: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        textAlign: 'center',
    },
});
