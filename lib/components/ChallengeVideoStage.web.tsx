/**
 * ChallengeVideoStage.web.tsx
 *
 * Web counterpart of ChallengeVideoStage.native. AgoraVoice.web plays the
 * remote stream into the element with id `remote-video` and the local camera
 * into `local-video`, so here we just render those container divs (via
 * react-native-web's `nativeID` → DOM `id`) in the right layout.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CircleUserRound, VideoOff } from 'lucide-react-native';

export interface ChallengeVideoStageProps {
    /** Unused on web (remote is rendered via DOM injection), kept for parity. */
    remoteUid?: number;
    isCameraOff: boolean;
    opponentName: string;
}

export const ChallengeVideoStage: React.FC<ChallengeVideoStageProps> = ({
    isCameraOff,
    opponentName,
}) => {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* Placeholder shows until Agora injects the remote <video> on top */}
            <View style={styles.remotePlaceholder}>
                <CircleUserRound color="#D8D8E4" size={72} strokeWidth={1} />
                <Text style={styles.remoteName}>{opponentName}</Text>
            </View>

            {/* Opponent stream — AgoraVoice.web plays into #remote-video */}
            <View nativeID="remote-video" style={StyleSheet.absoluteFill} />

            {/* ── Local camera PiP — bottom right ── */}
            <View style={styles.pip}>
                {/* Keep #local-video mounted so Agora can always play into it */}
                <View nativeID="local-video" style={[styles.pipVideo, isCameraOff && styles.hidden]} />
                {isCameraOff && (
                    <View style={styles.pipOff}>
                        <VideoOff color="#7A7C90" size={20} />
                    </View>
                )}
                <View style={styles.pipBadge}>
                    <Text style={styles.pipBadgeText}>You</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    remotePlaceholder: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    remoteName: { color: '#211832', fontSize: 20, fontWeight: '700' },

    pip: {
        position: 'absolute',
        bottom: 96,
        right: 16,
        width: 92,
        height: 128,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(242,89,18,0.85)',
        backgroundColor: '#F8F8FC',
    } as any,
    pipVideo: { width: 92, height: 128, backgroundColor: '#F8F8FC' } as any,
    pipOff: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8F8FC',
    },
    pipBadge: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 3,
        alignItems: 'center',
    },
    pipBadgeText: { color: '#fff', fontSize: 10, fontWeight: '600' },
    hidden: { opacity: 0, position: 'absolute' } as any,
});
