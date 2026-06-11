/**
 * ChallengeVideoStage.native.tsx
 *
 * Renders the live video layer for the challenge room on iOS/Android:
 *   • the opponent's stream fills the screen (RtcSurfaceView with their uid)
 *   • the local camera shows as a small picture-in-picture bottom-right
 *
 * The engine itself is created/joined by AgoraVoice.native — RtcSurfaceView
 * binds to that singleton engine by uid, so no engine prop is needed here.
 * Metro auto-selects ChallengeVideoStage.web.tsx on web.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RtcSurfaceView, VideoSourceType } from 'react-native-agora';
import { CircleUserRound, VideoOff } from 'lucide-react-native';

export interface ChallengeVideoStageProps {
    /** Remote participant uid, or undefined while waiting for them to join. */
    remoteUid?: number;
    /** Hide the local camera PiP when the user turns their camera off. */
    isCameraOff: boolean;
    opponentName: string;
}

export const ChallengeVideoStage: React.FC<ChallengeVideoStageProps> = ({
    remoteUid,
    isCameraOff,
    opponentName,
}) => {
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {/* ── Opponent — full screen ── */}
            {remoteUid !== undefined ? (
                <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: remoteUid }} />
            ) : (
                <View style={styles.remotePlaceholder}>
                    <CircleUserRound color="#D8D8E4" size={72} strokeWidth={1} />
                    <Text style={styles.remoteName}>{opponentName}</Text>
                </View>
            )}

            {/* ── Local camera PiP — bottom right ── */}
            <View style={styles.pip}>
                {!isCameraOff ? (
                    <RtcSurfaceView
                        style={styles.pipVideo}
                        canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
                        zOrderMediaOverlay
                    />
                ) : (
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
    },
    pipVideo: { width: 92, height: 128 },
    pipOff: {
        width: 92,
        height: 128,
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
});
