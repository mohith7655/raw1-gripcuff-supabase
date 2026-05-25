import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
    friendName?: string;
    remoteUids?: number[]; // unused on web — remote video renders via DOM injection
    cameraPermissionDenied?: boolean;
}

/**
 * Web: large remote camera area with overlay "You" tile bottom-right.
 * Layout mirrors SyncedVideoPlayerScreen's videoCallContainer. AgoraVoice.web.ts
 * injects remote video into #remote-video and local video into #local-video.
 */
export function CoWorkoutCameraTiles({ friendName, cameraPermissionDenied }: Props) {
    return (
        <View style={styles.container}>
            {cameraPermissionDenied && (
                <View style={styles.permissionBanner}>
                    <Text style={styles.permissionText}>
                        Camera access blocked — tap here to enable in browser settings
                    </Text>
                </View>
            )}

            {/* COMING SOON section */}
            <View style={styles.comingSoonSection}>
                <Text style={styles.comingSoonPrimary}>
                    ✦ Live reactions & chat — coming soon
                </Text>
                <Text style={styles.comingSoonSecondary}>
                    ✦ Shared workout stats — coming soon
                </Text>
            </View>

            {/* Camera area */}
            <View style={styles.videoCallContainer}>
                <View style={styles.cameraArea}>
                    {/* Remote video — fills the area */}
                    <View style={styles.remoteVideoFill}>
                        <View nativeID="remote-video" style={styles.cameraVideo} />
                        <Text style={styles.cameraPlaceholderText}>Camera Off</Text>
                        <Text style={styles.remoteNameLabel}>{friendName ?? 'Partner'}</Text>
                    </View>

                    {/* Local "You" tile overlay */}
                    <View style={styles.selfVideoOverlay}>
                        <View nativeID="local-video" style={styles.cameraVideo} />
                        <Text style={styles.cameraPlaceholderText}>Camera Off</Text>
                        <Text style={styles.selfNameLabel}>You</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

// Styles ported from SyncedVideoPlayerScreen
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    permissionBanner: {
        backgroundColor: '#ff4444',
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    permissionText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
        textAlign: 'center',
    },
    comingSoonSection: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 28,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    comingSoonPrimary: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 13,
        textTransform: 'uppercase',
        fontStyle: 'italic',
        letterSpacing: 1.5,
        textAlign: 'center',
        marginBottom: 12,
    },
    comingSoonSecondary: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        textTransform: 'uppercase',
        fontStyle: 'italic',
        letterSpacing: 1.5,
        textAlign: 'center',
    },
    videoCallContainer: {
        flex: 1,
        backgroundColor: '#111',
    },
    cameraArea: {
        flex: 1,
        backgroundColor: '#111',
        position: 'relative',
    },
    remoteVideoFill: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#1a1a1a',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    remoteNameLabel: {
        position: 'absolute',
        bottom: 8,
        left: 12,
        color: 'white',
        fontSize: 12,
        zIndex: 2,
    },
    selfVideoOverlay: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: 90,
        height: 120,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        borderWidth: 2,
        borderColor: 'rgba(255,165,0,0.6)',
        zIndex: 10,
    },
    selfNameLabel: {
        position: 'absolute',
        bottom: 4,
        width: '100%',
        textAlign: 'center',
        color: 'white',
        fontSize: 10,
        zIndex: 2,
    },
    cameraVideo: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
    },
    cameraPlaceholderText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        zIndex: 2,
    },
});
