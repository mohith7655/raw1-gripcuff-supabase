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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
    createAgoraRtcEngine,
    IRtcEngine,
    ChannelProfileType,
    ClientRoleType,
    RtcSurfaceView,
    VideoSourceType,
} from 'react-native-agora';
import { Mic, MicOff, Video, VideoOff, PhoneOff, CircleUserRound } from 'lucide-react-native';
import { AGORA_APP_ID } from '../core/config/api_keys';

type ParamList = {
    ChallengeVideoRoom: {
        channelName: string;
        opponentName?: string;
        opponentUid?: string;
        token?: string;
    };
};

const { width, height } = Dimensions.get('window');

export const ChallengeVideoRoom: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<ParamList, 'ChallengeVideoRoom'>>();
    const { channelName, opponentName = 'Opponent', token = '' } = route.params;

    const engineRef = useRef<IRtcEngine | null>(null);
    const pipAnim = useRef(new Animated.Value(0)).current;

    const [isJoined, setIsJoined] = useState(false);
    const [remoteUid, setRemoteUid] = useState<number | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isConnecting, setIsConnecting] = useState(true);
    const [elapsedSecs, setElapsedSecs] = useState(0);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fmtTime = (s: number) => {
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const sec = (s % 60).toString().padStart(2, '0');
        return `${m}:${sec}`;
    };

    const requestPerms = async () => {
        if (Platform.OS !== 'android') return true;
        const grants = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            PermissionsAndroid.PERMISSIONS.CAMERA,
        ]);
        return (
            grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED &&
            grants[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED
        );
    };

    useEffect(() => {
        let engine: IRtcEngine | null = null;

        const init = async () => {
            const ok = await requestPerms();
            if (!ok) { setIsConnecting(false); return; }

            engine = createAgoraRtcEngine();
            engineRef.current = engine;

            engine.initialize({ appId: AGORA_APP_ID, channelProfile: ChannelProfileType.ChannelProfileCommunication });
            engine.enableVideo();
            engine.startPreview();

            engine.addListener('onUserJoined', (connection, uid) => {
                setRemoteUid(uid);
                Animated.spring(pipAnim, { toValue: 1, useNativeDriver: true, bounciness: 8, speed: 12 }).start();
            });
            engine.addListener('onUserOffline', () => {
                setRemoteUid(null);
            });
            engine.addListener('onJoinChannelSuccess', () => {
                setIsJoined(true);
                setIsConnecting(false);
                timerRef.current = setInterval(() => setElapsedSecs(s => s + 1), 1000);
            });

            await engine.joinChannel(token, channelName, 0, {
                clientRoleType: ClientRoleType.ClientRoleBroadcaster,
                publishCameraTrack: true,
                publishMicrophoneTrack: true,
            });
        };

        init().catch(console.error);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            engine?.leaveChannel();
            engine?.release();
        };
    }, [channelName, token]);

    const toggleMute = () => {
        engineRef.current?.muteLocalAudioStream(!isMuted);
        setIsMuted(m => !m);
    };

    const toggleCamera = () => {
        engineRef.current?.muteLocalVideoStream(!isCameraOff);
        setIsCameraOff(c => !c);
    };

    const endCall = () => {
        engineRef.current?.leaveChannel();
        navigation.goBack();
    };

    return (
        <View style={styles.root}>
            {/* Remote full-screen video */}
            {remoteUid ? (
                <RtcSurfaceView
                    canvas={{ uid: remoteUid, sourceType: VideoSourceType.VideoSourceRemote }}
                    style={StyleSheet.absoluteFill}
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, styles.waitingBg]}>
                    <CircleUserRound color="#607a94" size={72} strokeWidth={1.2} />
                    <Text style={styles.waitingName}>{opponentName}</Text>
                    <Text style={styles.waitingLabel}>Waiting to join…</Text>
                </View>
            )}

            {/* Dim overlay at top/bottom for UI readability */}
            <View style={styles.topOverlay} pointerEvents="none" />
            <View style={styles.bottomOverlay} pointerEvents="none" />

            <SafeAreaView style={styles.safeLayer} edges={['top', 'bottom']}>
                {/* Top bar */}
                <View style={styles.topBar}>
                    <View style={styles.channelPill}>
                        <Text style={styles.fireEmoji}>🔥</Text>
                        <Text style={styles.challengeLabel}>Challenge</Text>
                    </View>
                    {isJoined && (
                        <View style={styles.timerPill}>
                            <Text style={styles.timerText}>{fmtTime(elapsedSecs)}</Text>
                        </View>
                    )}
                </View>

                {/* Opponent name tag (bottom of remote video area) */}
                {remoteUid && (
                    <View style={styles.opponentTag}>
                        <Text style={styles.opponentName}>{opponentName}</Text>
                    </View>
                )}

                {/* Connecting overlay */}
                {isConnecting && (
                    <View style={styles.connectingOverlay}>
                        <ActivityIndicator color="#FF6B00" size="large" />
                        <Text style={styles.connectingText}>Connecting…</Text>
                    </View>
                )}

                {/* Local PiP — top-right */}
                <Animated.View style={[
                    styles.localPip,
                    { transform: [{ scale: pipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }], opacity: pipAnim },
                ]}>
                    {!isCameraOff ? (
                        <RtcSurfaceView
                            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
                            style={styles.pipVideo}
                        />
                    ) : (
                        <View style={[styles.pipVideo, styles.pipCameraOff]}>
                            <CircleUserRound color="#607a94" size={28} strokeWidth={1.2} />
                        </View>
                    )}
                </Animated.View>

                {/* Controls */}
                <View style={styles.controls}>
                    <TouchableOpacity style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]} onPress={toggleMute} activeOpacity={0.8}>
                        {isMuted ? <MicOff color="#fff" size={22} /> : <Mic color="#fff" size={22} />}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.endBtn} onPress={endCall} activeOpacity={0.85}>
                        <PhoneOff color="#fff" size={26} />
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.ctrlBtn, isCameraOff && styles.ctrlBtnActive]} onPress={toggleCamera} activeOpacity={0.8}>
                        {isCameraOff ? <VideoOff color="#fff" size={22} /> : <Video color="#fff" size={22} />}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0a0f1a' },
    safeLayer: { flex: 1, justifyContent: 'space-between' },

    topOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, height: 140,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    bottomOverlay: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 160,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },

    waitingBg: {
        backgroundColor: '#0a0f1a',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    waitingName: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 8 },
    waitingLabel: { color: '#607a94', fontSize: 14 },

    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    channelPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,107,0,0.18)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.35)',
    },
    fireEmoji: { fontSize: 14 },
    challengeLabel: { color: '#FF6B00', fontSize: 13, fontWeight: '700' },
    timerPill: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 5,
    },
    timerText: { color: '#fff', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },

    opponentTag: {
        alignSelf: 'flex-start',
        marginLeft: 16,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    opponentName: { color: '#fff', fontSize: 13, fontWeight: '600' },

    connectingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    connectingText: { color: '#fff', fontSize: 15, fontWeight: '600' },

    localPip: {
        position: 'absolute',
        top: 80,
        right: 16,
        width: 100,
        height: 140,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#FF6B00',
    },
    pipVideo: { width: '100%', height: '100%' },
    pipCameraOff: {
        backgroundColor: '#131f2e',
        alignItems: 'center',
        justifyContent: 'center',
    },

    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        paddingBottom: 12,
    },
    ctrlBtn: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ctrlBtnActive: { backgroundColor: 'rgba(255,107,0,0.35)' },
    endBtn: {
        width: 66,
        height: 66,
        borderRadius: 33,
        backgroundColor: '#e53935',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
