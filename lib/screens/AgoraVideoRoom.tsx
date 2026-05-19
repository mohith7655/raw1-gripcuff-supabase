import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Platform,
    PermissionsAndroid,
    ActivityIndicator,
    Animated,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
    createAgoraRtcEngine,
    IRtcEngine,
    IRtcEngineEventHandler,
    ChannelProfileType,
    ClientRoleType,
    RtcSurfaceView,
    VideoSourceType,
} from 'react-native-agora';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Tv2, Eye } from 'lucide-react-native';
import { AGORA_APP_ID } from '../core/config/api_keys';
import { CastButton } from '../components/cast/CastButton';
import { CastStatusBanner } from '../components/cast/CastStatusBanner';
import { RemoteControlBar } from '../components/cast/RemoteControlBar';
import { useCast } from '../hooks/useCast';
import { CAST_RECEIVER_URL } from '../services/cast/types';
import { useAuth } from '../providers/AuthContext';
import { useLiveViewerCount } from '../hooks/useLiveViewerCount';

/* ─── Types ─── */
type ParamList = {
    AgoraVideoRoom: {
        channelName: string;
        participantName?: string;
        token?: string;
    };
};

const { width, height } = Dimensions.get('window');

/* ─── Screen ─── */
export const AgoraVideoRoom: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<ParamList, 'AgoraVideoRoom'>>();
    const { channelName, participantName = 'You', token = '' } = route.params;

    const engineRef = useRef<IRtcEngine | null>(null);
    const localAnim = useRef(new Animated.Value(0)).current;

    const [isJoined, setIsJoined] = useState(false);
    const [remoteUids, setRemoteUids] = useState<number[]>([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(true);

    const { firebaseUid, email } = useAuth();
    const { count: viewerCount } = useLiveViewerCount(
        channelName,
        firebaseUid,
        email?.split('@')[0] ?? null,
    );

    const {
        isCasting,
        deviceName,
        castAgora,
        endSession: endCastSession,
    } = useCast();

    /* ── Permissions ── */
    const requestPermissions = async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return true;
        try {
            const grants = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.CAMERA,
                PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            ]);
            return (
                grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED &&
                grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED
            );
        } catch {
            return false;
        }
    };

    /* ── Animate local PiP in from bottom-right ── */
    const animateLocalIn = () => {
        Animated.spring(localAnim, {
                toValue: 1,
                tension: 55,
                friction: 7,
                useNativeDriver: Platform.OS !== 'web',
            }).start();
    };

    /* ── Setup + teardown ── */
    useEffect(() => {
        let mounted = true;

        const setup = async () => {
            const granted = await requestPermissions();
            if (!mounted) return;
            if (!granted) {
                setPermissionError('Camera and microphone permissions are required for video calls.');
                return;
            }

            try {
                const engine = createAgoraRtcEngine();
                engineRef.current = engine;

                engine.initialize({ appId: AGORA_APP_ID });
                engine.enableVideo();
                engine.enableAudio();
                engine.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
                engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

                // Show local preview immediately before joining
                engine.startPreview();

                const handler: IRtcEngineEventHandler = {
                    onJoinChannelSuccess: (_connection, _elapsed) => {
                        if (!mounted) return;
                        console.log('[AgoraVideoRoom] Joined channel:', channelName);
                        setIsJoined(true);
                        setIsConnecting(false);
                        animateLocalIn();
                    },
                    onUserJoined: (_connection, remoteUid, _elapsed) => {
                        if (!mounted) return;
                        console.log('[AgoraVideoRoom] Remote user joined:', remoteUid);
                        setRemoteUids(prev =>
                            prev.includes(remoteUid) ? prev : [...prev, remoteUid]
                        );
                    },
                    onUserOffline: (_connection, remoteUid, _reason) => {
                        if (!mounted) return;
                        console.log('[AgoraVideoRoom] Remote user left:', remoteUid);
                        setRemoteUids(prev => prev.filter(u => u !== remoteUid));
                    },
                    onError: (errCode) => {
                        console.warn('[AgoraVideoRoom] Engine error code:', errCode);
                    },
                };

                engine.registerEventHandler(handler);

                engine.joinChannel(token, channelName, 0, {
                    clientRoleType: ClientRoleType.ClientRoleBroadcaster,
                    publishCameraTrack: true,
                    publishMicrophoneTrack: true,
                    autoSubscribeAudio: true,
                    autoSubscribeVideo: true,
                });
            } catch (err: any) {
                console.error('[AgoraVideoRoom] Setup error:', err);
                if (mounted) {
                    setPermissionError(err?.message ?? 'Failed to initialize video call.');
                    setIsConnecting(false);
                }
            }
        };

        setup();

        return () => {
            mounted = false;
            const engine = engineRef.current;
            if (engine) {
                engine.leaveChannel();
                engine.stopPreview();
                engine.release();
                engineRef.current = null;
            }
        };
    }, [channelName, token]);

    /* ── Controls ── */
    const toggleMic = () => {
        const next = !isMuted;
        engineRef.current?.muteLocalAudioStream(next);
        setIsMuted(next);
    };

    const toggleCamera = () => {
        const next = !isCameraOff;
        engineRef.current?.muteLocalVideoStream(next);
        setIsCameraOff(next);
    };

    const leave = () => {
        const engine = engineRef.current;
        if (engine) {
            engine.leaveChannel();
            engine.stopPreview();
            engine.release();
            engineRef.current = null;
        }
        // Also end any active cast session
        if (isCasting) endCastSession();
        navigation.goBack();
    };

    /* ── Cast: push live call to Chromecast ── */
    const handleCastAgora = async () => {
        await castAgora({
            type: 'agora',
            channelName,
            token,
            appId: AGORA_APP_ID,
            // The receiver joins as audience with uid 9999 to avoid collision
            uid: 9999,
            receiverUrl: CAST_RECEIVER_URL,
        });
    };

    /* ── Permission error state ── */
    if (permissionError) {
        return (
            <View style={styles.center}>
                <StatusBar barStyle="light-content" backgroundColor="#0d1520" />
                <Text style={styles.errorIcon}>🎥</Text>
                <Text style={styles.errorTitle}>Permission Required</Text>
                <Text style={styles.errorBody}>{permissionError}</Text>
                <TouchableOpacity style={styles.goBackBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                    <Text style={styles.goBackText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    /* ── Connecting state ── */
    if (isConnecting) {
        return (
            <View style={styles.center}>
                <StatusBar barStyle="light-content" backgroundColor="#0d1520" />
                <ActivityIndicator size="large" color="#4FC3F7" />
                <Text style={styles.connectingTitle}>Joining session…</Text>
                <Text style={styles.connectingSubtitle}>{channelName}</Text>
            </View>
        );
    }

    const firstRemote = remoteUids[0];

    /* ── Connected: video call UI ── */
    return (
        <View style={styles.root}>
            <StatusBar barStyle="light-content" backgroundColor="#000" translucent />

            {/* ── Remote video OR cast placeholder ── */}
            {isCasting ? (
                /* Casting active: Chromecast shows the remote video, phone shows placeholder */
                <View style={styles.castPlaceholder}>
                    <Tv2 color="#4FC3F7" size={64} />
                    <Text style={styles.castTitle}>Live call on TV</Text>
                    <Text style={styles.castDevice} numberOfLines={1}>
                        {deviceName ?? 'Connected device'}
                    </Text>
                </View>
            ) : firstRemote !== undefined ? (
                <RtcSurfaceView
                    style={styles.remoteVideo}
                    canvas={{ uid: firstRemote }}
                />
            ) : (
                <View style={styles.remotePlaceholder}>
                    <View style={styles.avatarCircle}>
                        <VideoOff color="#607a94" size={40} />
                    </View>
                    <Text style={styles.waitingText}>Waiting for partner to join…</Text>
                </View>
            )}

            {/* Local camera PiP — hidden when casting (TV shows remote, phone is remote control) */}
            {!isCasting && (
                <Animated.View
                    style={[
                        styles.localWrapper,
                        {
                            opacity: localAnim,
                            transform: [
                                {
                                    scale: localAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.5, 1],
                                    }),
                                },
                                {
                                    translateY: localAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [50, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    {!isCameraOff ? (
                        <RtcSurfaceView
                            style={styles.localVideo}
                            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
                            zOrderMediaOverlay
                        />
                    ) : (
                        <View style={styles.cameraOffPlaceholder}>
                            <VideoOff color="#607a94" size={22} />
                        </View>
                    )}
                    <View style={styles.localNameBadge}>
                        <Text style={styles.localNameText} numberOfLines={1}>
                            {participantName}
                        </Text>
                    </View>
                </Animated.View>
            )}

            {/* Channel name pill — top left */}
            <View style={[styles.channelPill, { top: Platform.OS === 'ios' ? 56 : 20 }]}>
                <View style={[styles.liveDot, { backgroundColor: isJoined ? '#00e676' : '#FFB300' }]} />
                <Text style={styles.channelPillText} numberOfLines={1}>
                    {isJoined ? 'Live' : 'Connecting'} · {channelName}
                </Text>
            </View>

            {/* Viewer count badge — top left below channel pill */}
            {isJoined && (
                <View style={[styles.viewerPill, { top: Platform.OS === 'ios' ? 100 : 64 }]}>
                    <Eye color="#fff" size={11} />
                    <Text style={styles.viewerPillText}>{viewerCount} watching</Text>
                </View>
            )}

            {/* Cast button — top right (auto-hides when no devices found) */}
            {!isCasting && (
                <View style={[styles.castBtnWrapper, { top: Platform.OS === 'ios' ? 50 : 14 }]}>
                    <TouchableOpacity
                        style={styles.castBtnTouchable}
                        onPress={handleCastAgora}
                        activeOpacity={0.75}
                    >
                        <CastButton tintColor="white" size={22} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Control bar — regular call controls OR remote-only controls when casting */}
            {isCasting ? (
                <RemoteControlBar
                    mode="agora"
                    isMuted={isMuted}
                    isCameraOff={isCameraOff}
                    onToggleMic={toggleMic}
                    onToggleCamera={toggleCamera}
                    onEndCall={leave}
                    onStopCast={endCastSession}
                />
            ) : (
                <SafeAreaView style={styles.controlSafe} edges={['bottom']}>
                    <View style={styles.controlBar}>
                        <TouchableOpacity
                            style={[styles.btn, isMuted && styles.btnActive]}
                            onPress={toggleMic}
                            activeOpacity={0.75}
                        >
                            {isMuted ? <MicOff color="#fff" size={24} /> : <Mic color="#fff" size={24} />}
                            <Text style={styles.btnLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.endBtn} onPress={leave} activeOpacity={0.8}>
                            <PhoneOff color="#fff" size={26} />
                            <Text style={styles.endBtnLabel}>Leave</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.btn, isCameraOff && styles.btnActive]}
                            onPress={toggleCamera}
                            activeOpacity={0.75}
                        >
                            {isCameraOff ? <VideoOff color="#fff" size={24} /> : <Video color="#fff" size={24} />}
                            <Text style={styles.btnLabel}>{isCameraOff ? 'Show' : 'Camera'}</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            )}
        </View>
    );
};

/* ─── Styles ─── */
const styles = StyleSheet.create({
    /* Shared center container for loading/error */
    center: {
        flex: 1,
        backgroundColor: '#0d1520',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },

    /* Connected root */
    root: {
        flex: 1,
        width,
        height,
        backgroundColor: '#000',
    },

    /* Loading */
    connectingTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 20,
    },
    connectingSubtitle: {
        color: '#607a94',
        fontSize: 13,
        marginTop: 6,
    },

    /* Error */
    errorIcon: { fontSize: 48, marginBottom: 14 },
    errorTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 10 },
    errorBody: {
        color: '#607a94',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
        marginBottom: 28,
    },
    goBackBtn: {
        backgroundColor: '#4FC3F7',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 28,
    },
    goBackText: { color: '#000', fontWeight: '700', fontSize: 15 },

    /* Remote video */
    remoteVideo: {
        position: 'absolute',
        top: 0,
        left: 0,
        width,
        height,
    },
    remotePlaceholder: {
        flex: 1,
        backgroundColor: '#0d1520',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#1c2e42',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 18,
    },
    waitingText: {
        color: '#607a94',
        fontSize: 15,
        fontWeight: '500',
        textAlign: 'center',
        paddingHorizontal: 40,
    },

    /* Cast placeholder */
    castPlaceholder: {
        flex: 1,
        backgroundColor: '#060f1c',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    castTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '700',
        marginTop: 8,
    },
    castDevice: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 14,
        maxWidth: 240,
        textAlign: 'center',
    },

    /* Channel pill */
    channelPill: {
        position: 'absolute',
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        maxWidth: width * 0.6,
    },
    liveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 7 },
    channelPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    viewerPill: {
        position: 'absolute',
        left: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(0,0,0,0.55)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    viewerPillText: { color: '#fff', fontSize: 11, fontWeight: '600' },

    /* Cast button wrapper (top-right) */
    castBtnWrapper: {
        position: 'absolute',
        right: 16,
    },
    castBtnTouchable: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        padding: 6,
    },

    /* Local PiP */
    localWrapper: {
        position: 'absolute',
        bottom: 112,
        right: 16,
        width: 96,
        height: 134,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#4FC3F7',
        backgroundColor: '#1c2e42',
    },
    localVideo: { width: 96, height: 134 },
    cameraOffPlaceholder: {
        width: 96,
        height: 134,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1c2e42',
    },
    localNameBadge: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.65)',
        paddingVertical: 3,
        alignItems: 'center',
    },
    localNameText: { color: '#fff', fontSize: 10, fontWeight: '600' },

    /* Control bar */
    controlSafe: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    controlBar: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        backgroundColor: 'rgba(5,5,5,0.88)',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    btn: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    btnActive: { backgroundColor: 'rgba(255,59,48,0.28)' },
    btnLabel: { color: '#aaa', fontSize: 10, marginTop: 3 },
    endBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#C62828',
    },
    endBtnLabel: { color: '#fff', fontSize: 10, fontWeight: '700', marginTop: 3 },
});
