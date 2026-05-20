/**
 * LiveCamera.web.tsx
 *
 * Web-only live video component using agora-rtc-sdk-ng.
 * Auto-selected by Metro/Expo on web platform over LiveCamera.tsx (if it exists).
 *
 * Flow:
 *  1. getUserMedia — request camera + mic permission before touching Agora
 *  2. On grant  — init Agora client, join channel, publish tracks
 *  3. On deny   — show browser-specific instructions to re-enable
 *  4. On error  — show actionable error message
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    PanResponder,
    ActivityIndicator,
} from 'react-native';
import type {
    IAgoraRTCClient,
    ICameraVideoTrack,
    IMicrophoneAudioTrack,
    IAgoraRTCRemoteUser,
} from 'agora-rtc-sdk-ng';
import { Platform } from 'react-native';

// Web only APIs MUST be conditionally required, even in .web.ts files
let AgoraRTC: any;
if (Platform.OS === 'web') {
    const agoraModule = require('agora-rtc-sdk-ng');
    AgoraRTC = agoraModule.default || agoraModule;
}
import { Mic, MicOff, Video, VideoOff, PhoneOff, Eye } from 'lucide-react-native';
import { AGORA_APP_ID } from '../core/config/api_keys';
import { useLiveViewerCount } from '../hooks/useLiveViewerCount';
import { useAuth } from '../providers/AuthContext';

/* ─── Types ─── */
type PermState = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

export interface LiveCameraProps {
    channelName: string;
    /** Pass null / omit for Agora projects with no-certificate mode */
    token?: string | null;
    onLeave?: () => void;
}


/* ─── Component ─── */
export const LiveCamera: React.FC<LiveCameraProps> = ({
    channelName,
    token = null,
    onLeave,
}) => {
    const [permState, setPermState] = useState<PermState>('idle');
    const [isJoined, setIsJoined] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showLocalControls, setShowLocalControls] = useState(false);
    const [showRemoteControls, setShowRemoteControls] = useState(false);
    const [isRemoteMuted, setIsRemoteMuted] = useState(false);

    const clientRef = useRef<IAgoraRTCClient | null>(null);
    const localVideoRef = useRef<ICameraVideoTrack | null>(null);
    const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);

    const { supabaseUserId, email } = useAuth();
    const displayName = email?.split('@')[0] ?? null;
    const { count: viewerCount } = useLiveViewerCount(channelName, supabaseUserId, displayName);

    /* ── Draggable PiP ── */
    const pan = useRef(new Animated.ValueXY()).current;
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                // Fold the current position into the offset so dragging
                // always resumes from where it was last dropped.
                pan.extractOffset();
            },
            onPanResponderMove: Animated.event(
                [null, { dx: pan.x, dy: pan.y }],
                { useNativeDriver: false },
            ),
            onPanResponderRelease: () => {
                // Collapse offset back into value so the next extractOffset
                // picks up the final resting position correctly.
                pan.flattenOffset();
            },
        }),
    ).current;

    /* ── Cleanup ── */
    const cleanup = useCallback(async () => {
        const lv = localVideoRef.current;
        const la = localAudioRef.current;
        const client = clientRef.current;

        if (lv) { lv.stop(); lv.close(); localVideoRef.current = null; }
        if (la) { la.stop(); la.close(); localAudioRef.current = null; }
        if (client) {
            client.removeAllListeners();
            await client.leave().catch(() => {});
            clientRef.current = null;
        }
    }, []);

    /* ── Init ── */
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            if (!mounted) return;
            setPermState('requesting');

            /* Step 1 — getUserMedia permission gate */
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true,
                });
                // Release the stream immediately; Agora will re-acquire
                stream.getTracks().forEach(t => t.stop());
                if (!mounted) return;
                setPermState('granted');
            } catch (err: any) {
                if (!mounted) return;
                const name: string = err?.name ?? '';
                if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
                    setPermState('denied');
                } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
                    setPermState('unavailable');
                    setError('No camera or microphone detected on this device.');
                } else {
                    setPermState('denied');
                    setError(err.message ?? 'Failed to access camera or microphone.');
                }
                return;
            }

            /* Step 2 — Agora client + join */
            try {
                AgoraRTC.setLogLevel(4); // silent

                const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
                clientRef.current = client;

                /* Remote track events */
                client.on('user-published', async (user, mediaType) => {
                    await client.subscribe(user, mediaType);
                    if (mediaType === 'audio') {
                        user.audioTrack?.play();
                    }
                    if (mediaType === 'video') {
                        setRemoteUsers(prev => {
                            const without = prev.filter(u => u.uid !== user.uid);
                            return [...without, user];
                        });
                    }
                });

                client.on('user-unpublished', (user, mediaType) => {
                    if (mediaType === 'video') {
                        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
                    }
                });

                client.on('user-left', user => {
                    setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
                });

                /* Join the channel — uid=null lets Agora auto-assign */
                await client.join(AGORA_APP_ID, channelName, token ?? null, null);

                /* Create and publish camera + mic together */
                const [audioTrack, videoTrack] = await Promise.all([
                    AgoraRTC.createMicrophoneAudioTrack(),
                    AgoraRTC.createCameraVideoTrack(),
                ]);

                if (!mounted) {
                    audioTrack.close();
                    videoTrack.close();
                    return;
                }

                localAudioRef.current = audioTrack;
                localVideoRef.current = videoTrack;

                await client.publish([audioTrack, videoTrack]);

                if (mounted) setIsJoined(true);
            } catch (err: any) {
                console.error('[LiveCamera] Agora init error:', err);
                if (mounted) {
                    setError(err?.message ?? 'Failed to connect to video session.');
                }
            }
        };

        init();

        /* Also clean up if the tab/page is about to close */
        const onUnload = () => { cleanup(); };
        window.addEventListener('beforeunload', onUnload);

        return () => {
            mounted = false;
            window.removeEventListener('beforeunload', onUnload);
            cleanup();
        };
    }, [channelName, token, cleanup]);

    /* ── Play local preview once joined & DOM element is ready ── */
    useEffect(() => {
        if (!isJoined) return;
        // Small tick to let React flush the render and mount the container div
        const t = setTimeout(() => {
            localVideoRef.current?.play('agora-local-video');
        }, 80);
        return () => clearTimeout(t);
    }, [isJoined]);

    /* ── Play / replay remote video when the remoteUsers list changes ── */
    useEffect(() => {
        remoteUsers.forEach(user => {
            if (user.videoTrack) {
                user.videoTrack.play(`agora-remote-${user.uid}`);
            }
        });
    }, [remoteUsers]);

    /* ── Controls ── */
    const toggleMic = async () => {
        const track = localAudioRef.current;
        if (!track) return;
        const next = !isMuted;
        await track.setMuted(next);
        setIsMuted(next);
    };

    const toggleCamera = async () => {
        const track = localVideoRef.current;
        if (!track) return;
        const next = !isCameraOff;
        await track.setMuted(next);
        setIsCameraOff(next);
    };

    const leave = async () => {
        await cleanup();
        onLeave?.();
    };

    // Locally mute/unmute the remote user's audio (does not affect what they publish)
    const toggleRemoteMute = () => {
        const remote = remoteUsers[0];
        if (!remote?.audioTrack) return;
        const next = !isRemoteMuted;
        remote.audioTrack.setVolume(next ? 0 : 100);
        setIsRemoteMuted(next);
    };

    /* ════════════════════════════════════════════
       Render: permission denied
    ════════════════════════════════════════════ */
    if (permState === 'denied') {
        return (
            <View style={styles.center}>
                <Text style={styles.bigIcon}>🎥</Text>
                <Text style={styles.errorTitle}>Camera Access Blocked</Text>
                <Text style={styles.errorBody}>
                    Your browser has blocked access to your camera and microphone.
                    {'\n\n'}
                    <Text style={styles.bold}>Chrome / Edge</Text>
                    {'\n'}Click the lock icon (🔒) in the address bar → Camera → Allow
                    {'\n\n'}
                    <Text style={styles.bold}>Firefox</Text>
                    {'\n'}Click the camera icon in the address bar → Allow
                    {'\n\n'}
                    <Text style={styles.bold}>Safari</Text>
                    {'\n'}Settings → Websites → Camera & Microphone → Allow for this site
                    {'\n\n'}
                    Then refresh the page and try again.
                </Text>
                <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => window.location.reload()}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryBtnText}>Refresh Page</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.ghostBtn} onPress={onLeave} activeOpacity={0.7}>
                    <Text style={styles.ghostBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    /* ════════════════════════════════════════════
       Render: no device found
    ════════════════════════════════════════════ */
    if (permState === 'unavailable') {
        return (
            <View style={styles.center}>
                <Text style={styles.bigIcon}>📷</Text>
                <Text style={styles.errorTitle}>No Camera Found</Text>
                <Text style={styles.errorBody}>
                    {error ?? 'No camera or microphone was detected on this device.'}
                    {'\n\n'}
                    Please connect a camera and microphone, then refresh the page.
                </Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={onLeave} activeOpacity={0.8}>
                    <Text style={styles.primaryBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    /* ════════════════════════════════════════════
       Render: general Agora error
    ════════════════════════════════════════════ */
    if (error && permState === 'granted') {
        return (
            <View style={styles.center}>
                <Text style={styles.bigIcon}>⚠️</Text>
                <Text style={styles.errorTitle}>Connection Error</Text>
                <Text style={styles.errorBody}>{error}</Text>
                <TouchableOpacity style={styles.primaryBtn} onPress={onLeave} activeOpacity={0.8}>
                    <Text style={styles.primaryBtnText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    /* ════════════════════════════════════════════
       Render: requesting / connecting
    ════════════════════════════════════════════ */
    if (!isJoined) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#4FC3F7" />
                <Text style={styles.connectingTitle}>
                    {permState === 'requesting'
                        ? 'Requesting camera & mic…'
                        : 'Joining channel…'}
                </Text>
                <Text style={styles.connectingSubtitle}>{channelName}</Text>
            </View>
        );
    }

    /* ════════════════════════════════════════════
       Render: connected — full video call UI
    ════════════════════════════════════════════ */
    const firstRemote = remoteUsers[0];

    return (
        <View style={styles.root}>
            {/* ── Channel status pill — top left ── */}
            <View style={styles.channelPill}>
                <View style={styles.liveDot} />
                <Text style={styles.channelPillText} numberOfLines={1}>
                    Live · {channelName}
                </Text>
                <View style={styles.viewerBadge}>
                    <Eye color="#fff" size={11} />
                    <Text style={styles.viewerBadgeText}>{viewerCount} watching</Text>
                </View>
            </View>

            {/* ── Video row — remote + local side by side ── */}
            <View style={styles.videoRow}>

                {/* Remote card — tap to toggle remote mute overlay */}
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowRemoteControls(v => !v)}
                    style={styles.remoteCard}
                >
                    {firstRemote ? (
                        <View
                            nativeID={`agora-remote-${firstRemote.uid}`}
                            style={styles.cardVideo}
                        />
                    ) : (
                        <View style={styles.waitingPlaceholder}>
                            <VideoOff color="#607a94" size={20} />
                            <Text style={styles.waitingText}>Waiting…</Text>
                        </View>
                    )}
                    {showRemoteControls && (
                        <View style={styles.cardOverlay}>
                            <TouchableOpacity
                                style={[styles.overlayBtn, isRemoteMuted && styles.overlayBtnActive]}
                                onPress={e => { e.stopPropagation?.(); toggleRemoteMute(); }}
                                activeOpacity={0.75}
                            >
                                {isRemoteMuted
                                    ? <MicOff color="#fff" size={16} />
                                    : <Mic color="#fff" size={16} />}
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={styles.cardLabel}>
                        <Text style={styles.cardLabelText}>Partner</Text>
                    </View>
                </TouchableOpacity>

                {/* Local card — tap to toggle mic/camera/leave overlay */}
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={() => setShowLocalControls(v => !v)}
                    style={styles.localWrapper}
                >
                    {/* Always keep in DOM so Agora can play into it */}
                    <View
                        nativeID="agora-local-video"
                        style={[styles.cardVideo, isCameraOff && styles.hidden]}
                    />
                    {isCameraOff && (
                        <View style={styles.waitingPlaceholder}>
                            <VideoOff color="#607a94" size={20} />
                        </View>
                    )}
                    {showLocalControls && (
                        <View style={styles.cardOverlay}>
                            <TouchableOpacity
                                style={[styles.overlayBtn, isMuted && styles.overlayBtnActive]}
                                onPress={e => { e.stopPropagation?.(); toggleMic(); }}
                                activeOpacity={0.75}
                            >
                                {isMuted ? <MicOff color="#fff" size={16} /> : <Mic color="#fff" size={16} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.overlayBtn, isCameraOff && styles.overlayBtnActive]}
                                onPress={e => { e.stopPropagation?.(); toggleCamera(); }}
                                activeOpacity={0.75}
                            >
                                {isCameraOff ? <VideoOff color="#fff" size={16} /> : <Video color="#fff" size={16} />}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.overlayEndBtn}
                                onPress={e => { e.stopPropagation?.(); leave(); }}
                                activeOpacity={0.8}
                            >
                                <PhoneOff color="#fff" size={16} />
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={styles.cardLabel}>
                        <Text style={styles.cardLabelText}>You</Text>
                    </View>
                </TouchableOpacity>

            </View>
        </View>
    );
};

/* ─── Styles ─── */
const styles = StyleSheet.create({
    /* ── Shared loading / error center layout ── */
    center: {
        flex: 1,
        backgroundColor: '#0d1520',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 36,
    },
    bigIcon: {
        fontSize: 52,
        marginBottom: 16,
        textAlign: 'center',
    },
    errorTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 14,
        textAlign: 'center',
    },
    errorBody: {
        color: '#7a9ab8',
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'left',
        maxWidth: 480,
        marginBottom: 28,
    },
    bold: {
        color: '#a0c4e0',
        fontWeight: '700',
    },
    primaryBtn: {
        backgroundColor: '#4FC3F7',
        paddingHorizontal: 36,
        paddingVertical: 14,
        borderRadius: 28,
        marginBottom: 12,
        minWidth: 200,
        alignItems: 'center',
    },
    primaryBtnText: {
        color: '#000',
        fontWeight: '700',
        fontSize: 15,
    },
    ghostBtn: {
        paddingVertical: 10,
    },
    ghostBtnText: {
        color: '#607a94',
        fontSize: 14,
    },
    connectingTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        marginTop: 22,
    },
    connectingSubtitle: {
        color: '#607a94',
        fontSize: 13,
        marginTop: 6,
    },

    /* ── Connected root ── */
    root: {
        width: '100%',
        height: '100dvh',
        backgroundColor: '#0d1520',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    } as any,

    /* ── Video row — both cards side by side ── */
    videoRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        marginTop: 48,   // clear the channel pill
    } as any,

    /* ── Shared card base ── */
    remoteCard: {
        width: 75,
        height: 56,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: '#1c2e42',
        position: 'relative',
    } as any,
    localWrapper: {
        width: 75,
        height: 56,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#4FC3F7',
        backgroundColor: '#1c2e42',
        position: 'relative',
    } as any,

    /* Video fill inside a card */
    cardVideo: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1c2e42',
    } as any,

    /* Waiting / camera-off placeholder inside card */
    waitingPlaceholder: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1c2e42',
    },
    waitingText: {
        color: '#607a94',
        fontSize: 9,
        marginTop: 2,
        textAlign: 'center',
    },

    /* Name label at bottom of card */
    cardLabel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingVertical: 2,
        alignItems: 'center',
    },
    cardLabelText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '600',
    },

    /* Tap overlay — shown when card is pressed */
    cardOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    } as any,
    overlayBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlayBtnActive: {
        backgroundColor: 'rgba(255,59,48,0.7)',
    },
    overlayEndBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#C62828',
        justifyContent: 'center',
        alignItems: 'center',
    },

    /* ── Channel pill ── */
    channelPill: {
        position: 'absolute',
        top: 14,
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        maxWidth: '55%',
        zIndex: 10,
    } as any,
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#00e676',
        marginRight: 7,
    },
    channelPillText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    viewerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    } as any,
    viewerBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
        opacity: 0.85,
    },

    hidden: {
        // Keep in DOM for Agora but hide visually
        opacity: 0,
        position: 'absolute',
    },
    cameraOffText: {
        color: '#607a94',
        fontSize: 10,
        marginTop: 4,
    },
});
