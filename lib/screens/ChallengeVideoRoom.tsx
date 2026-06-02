import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Dimensions, Platform, PermissionsAndroid, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Mic, MicOff, PhoneOff, CircleUserRound, Flag } from 'lucide-react-native';
import { AGORA_APP_ID } from '../core/config/api_keys';
import { ChallengeSessionService, ChallengeSession } from '../services/challengeSession.service';
import { playReminderBeep } from '../utils/webAudio';

// react-native-agora is native-only. Wrap in try/catch so the web bundler
// doesn't crash when it encounters the unresolvable native module.
let createAgoraRtcEngine: any = null;
let ChannelProfileType: any = { ChannelProfileCommunication: 0 };
let ClientRoleType: any = { ClientRoleBroadcaster: 1 };
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const agora = require('react-native-agora');
    createAgoraRtcEngine = agora.createAgoraRtcEngine;
    ChannelProfileType = agora.ChannelProfileType;
    ClientRoleType = agora.ClientRoleType;
} catch {
    // Web — Agora native SDK not available; voice call disabled, exercise UI still works
}

type Phase = 'waiting' | 'countdown' | 'active' | 'finished';

type ParamList = {
    ChallengeVideoRoom: {
        channelName: string;
        opponentName?: string;
        opponentUid?: string;
        token?: string;
        challengeSessionId?: string;
        exerciseName?: string;
        workoutDurationSecs?: number;
        isHost?: boolean;
        myUid?: string;
    };
};

const { width, height } = Dimensions.get('window');

function pad(n: number) { return String(n).padStart(2, '0'); }
function fmtTime(s: number) { return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; }

export const ChallengeVideoRoom: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<RouteProp<ParamList, 'ChallengeVideoRoom'>>();
    const {
        channelName, opponentName = 'Opponent', token = '',
        challengeSessionId, exerciseName = 'Squats',
        workoutDurationSecs = 60, isHost = true, myUid,
    } = route.params;

    const engineRef = useRef<any>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isConnecting, setIsConnecting] = useState(true);

    // Challenge phase state machine
    const [phase, setPhase] = useState<Phase>('waiting');
    const [iMeReady, setIMeReady] = useState(false);
    const [opponentReady, setOpponentReady] = useState(false);
    const [countdown, setCountdown] = useState(5);
    const [remainingSecs, setRemainingSecs] = useState(workoutDurationSecs);

    // Animations
    const countdownScale = useRef(new Animated.Value(1)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Agora voice init (native only) ──────────────────────────────
    useEffect(() => {
        if (Platform.OS === 'web') { setIsConnecting(false); return; }

        const init = async () => {
            if (Platform.OS === 'android') {
                await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
            }
            const engine = createAgoraRtcEngine();
            engineRef.current = engine;
            engine.initialize({
                appId: AGORA_APP_ID,
                channelProfile: ChannelProfileType.ChannelProfileCommunication,
            });
            engine.enableAudio();
            engine.disableVideo();
            engine.addListener('onJoinChannelSuccess', () => setIsConnecting(false));
            await engine.joinChannel(token, channelName, 0, {
                clientRoleType: ClientRoleType.ClientRoleBroadcaster,
                publishMicrophoneTrack: true,
                publishCameraTrack: false,
            });
        };

        init().catch(() => setIsConnecting(false));

        return () => {
            engineRef.current?.leaveChannel();
            engineRef.current?.release();
        };
    }, []);

    // ── Supabase Realtime — sync ready state ─────────────────────────
    useEffect(() => {
        if (!challengeSessionId) return;

        const unsub = ChallengeSessionService.subscribe(challengeSessionId, (session) => {
            const myReady   = isHost ? session.hostReady  : session.guestReady;
            const theirReady = isHost ? session.guestReady : session.hostReady;

            setOpponentReady(theirReady);
            if (myReady) setIMeReady(true);

            if (session.hostReady && session.guestReady && phase === 'waiting') {
                startCountdown();
            }

            if (session.status === 'completed' && phase !== 'finished') {
                finishWorkout(false);
            }
        });

        return unsub;
    }, [challengeSessionId, phase]);

    // ── Countdown 5 → GO ────────────────────────────────────────────
    const startCountdown = () => {
        setPhase('countdown');
        let c = 5;
        setCountdown(c);
        playReminderBeep();

        countdownInterval.current = setInterval(() => {
            c--;
            if (c <= 0) {
                clearInterval(countdownInterval.current!);
                playReminderBeep();
                setPhase('active');
                startWorkoutTimer();
            } else {
                setCountdown(c);
                // Pulse animation on each tick
                Animated.sequence([
                    Animated.timing(countdownScale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
                    Animated.timing(countdownScale, { toValue: 1,   duration: 280, useNativeDriver: true }),
                ]).start();
            }
        }, 1000);
    };

    // ── Workout timer (counts down) ──────────────────────────────────
    const startWorkoutTimer = () => {
        setRemainingSecs(workoutDurationSecs);
        // Subtle pulse on active phase
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
            ])
        ).start();

        timerInterval.current = setInterval(() => {
            setRemainingSecs(s => {
                if (s <= 1) {
                    clearInterval(timerInterval.current!);
                    pulseAnim.stopAnimation();
                    playReminderBeep();
                    finishWorkout(true);
                    return 0;
                }
                return s - 1;
            });
        }, 1000);
    };

    const finishWorkout = (markDB: boolean) => {
        setPhase('finished');
        if (markDB && challengeSessionId) {
            ChallengeSessionService.markCompleted(challengeSessionId).catch(() => {});
        }
    };

    // ── Press "I'm Ready" ────────────────────────────────────────────
    const handleReady = async () => {
        setIMeReady(true);
        if (challengeSessionId) {
            const role = isHost ? 'host' : 'guest';
            await ChallengeSessionService.setReady(challengeSessionId, role);
        } else {
            // No session (direct nav) — just start immediately for testing
            startCountdown();
        }
    };

    // ── End call / leave ─────────────────────────────────────────────
    const handleLeave = () => {
        clearInterval(timerInterval.current!);
        clearInterval(countdownInterval.current!);
        if (challengeSessionId) ChallengeSessionService.cancel(challengeSessionId).catch(() => {});
        engineRef.current?.leaveChannel();
        navigation.goBack();
    };

    const toggleMute = () => {
        engineRef.current?.muteLocalAudioStream(!isMuted);
        setIsMuted(m => !m);
    };

    // ── Render ────────────────────────────────────────────────────────
    return (
        <View style={st.root}>
            {/* Background gradient feel */}
            <View style={st.bgTop} />
            <View style={st.bgBottom} />

            <SafeAreaView style={st.safe} edges={['top', 'bottom']}>

                {/* Top bar */}
                <View style={st.topBar}>
                    <View style={st.challengePill}>
                        <Text style={st.fireEmoji}>🔥</Text>
                        <Text style={st.challengeLabel}>Challenge</Text>
                    </View>
                    <Text style={st.exerciseNameTop}>{exerciseName.toUpperCase()}</Text>
                </View>

                {/* ── CENTER CONTENT by phase ── */}
                <View style={st.center}>

                    {/* WAITING */}
                    {phase === 'waiting' && (
                        <View style={st.waitingWrap}>
                            <CircleUserRound color="#2a4060" size={72} strokeWidth={1} />
                            <Text style={st.opponentName}>{opponentName}</Text>
                            <Text style={st.opponentStatus}>
                                {opponentReady ? '✓ Ready!' : 'Waiting to get ready…'}
                            </Text>

                            <View style={st.readyStatusRow}>
                                <View style={[st.readyDot, iMeReady && st.readyDotOn]} />
                                <Text style={st.readyStatusText}>
                                    {iMeReady ? 'You are ready' : 'Tap to ready up'}
                                </Text>
                                <View style={[st.readyDot, opponentReady && st.readyDotOn]} />
                            </View>

                            {!iMeReady && (
                                <TouchableOpacity
                                    style={st.readyBtn}
                                    onPress={handleReady}
                                    activeOpacity={0.85}
                                >
                                    <Text style={st.readyBtnText}>I'm Ready! 💪</Text>
                                </TouchableOpacity>
                            )}

                            {iMeReady && !opponentReady && (
                                <View style={st.waitingForOpponent}>
                                    <ActivityIndicator color="#E89951" size="small" />
                                    <Text style={st.waitingForText}>Waiting for {opponentName}…</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* COUNTDOWN */}
                    {phase === 'countdown' && (
                        <View style={st.countdownWrap}>
                            <Animated.Text
                                style={[
                                    st.countdownNumber,
                                    { transform: [{ scale: countdownScale }] },
                                ]}
                            >
                                {countdown}
                            </Animated.Text>
                            <Text style={st.countdownLabel}>GET READY</Text>
                        </View>
                    )}

                    {/* ACTIVE TIMER */}
                    {phase === 'active' && (
                        <Animated.View style={[st.activeWrap, { transform: [{ scale: pulseAnim }] }]}>
                            <Text style={st.activeExercise}>{exerciseName.toUpperCase()}</Text>
                            <Text style={st.activeTimer}>{fmtTime(remainingSecs)}</Text>
                            <Text style={st.activeSubtitle}>Keep going! 💪</Text>

                            {/* Progress ring (visual arc) */}
                            <View style={st.progressRing}>
                                <View style={[
                                    st.progressFill,
                                    { width: `${(1 - remainingSecs / workoutDurationSecs) * 100}%` as any },
                                ]} />
                            </View>
                        </Animated.View>
                    )}

                    {/* FINISHED */}
                    {phase === 'finished' && (
                        <View style={st.finishedWrap}>
                            <Text style={st.finishedEmoji}>🏆</Text>
                            <Text style={st.finishedTitle}>Time's Up!</Text>
                            <Text style={st.finishedSub}>
                                Great job! {workoutDurationSecs / 60} min of {exerciseName} complete.
                            </Text>
                            <TouchableOpacity
                                style={st.endWorkoutBtn}
                                onPress={handleLeave}
                                activeOpacity={0.85}
                            >
                                <Flag color="#fff" size={18} />
                                <Text style={st.endWorkoutBtnText}>End Workout</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Bottom controls */}
                {phase !== 'finished' && (
                    <View style={st.controls}>
                        <TouchableOpacity
                            style={[st.ctrlBtn, isMuted && st.ctrlBtnActive]}
                            onPress={toggleMute}
                            activeOpacity={0.8}
                        >
                            {isMuted
                                ? <MicOff color="#fff" size={20} />
                                : <Mic color="#fff" size={20} />}
                        </TouchableOpacity>

                        <TouchableOpacity style={st.endBtn} onPress={handleLeave} activeOpacity={0.85}>
                            <PhoneOff color="#fff" size={24} />
                        </TouchableOpacity>

                        {/* Show "End Workout" when active (early finish) */}
                        {phase === 'active' && (
                            <TouchableOpacity
                                style={st.ctrlBtn}
                                onPress={() => finishWorkout(true)}
                                activeOpacity={0.8}
                            >
                                <Flag color="#fff" size={20} />
                            </TouchableOpacity>
                        )}
                        {phase !== 'active' && <View style={st.ctrlBtn} />}
                    </View>
                )}

                {isConnecting && Platform.OS !== 'web' && (
                    <View style={st.connectingBadge}>
                        <ActivityIndicator color="#E89951" size="small" />
                        <Text style={st.connectingText}>Connecting voice…</Text>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
};

const ORANGE = '#E89951';

const st = StyleSheet.create({
    root:      { flex: 1, backgroundColor: '#080e18' },
    bgTop:     { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.55, backgroundColor: '#0d1520' },
    bgBottom:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.45, backgroundColor: '#060c14' },
    safe:      { flex: 1 },

    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4,
    },
    challengePill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(232,153,81,0.15)', borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1, borderColor: 'rgba(232,153,81,0.3)',
    },
    fireEmoji: { fontSize: 14 },
    challengeLabel: { color: ORANGE, fontSize: 13, fontWeight: '700' },
    exerciseNameTop: {
        color: 'rgba(150,180,210,0.5)', fontSize: 11, fontWeight: '700',
        letterSpacing: 1.2,
    },

    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

    // Waiting
    waitingWrap: { alignItems: 'center', gap: 12 },
    opponentName: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 8 },
    opponentStatus: { color: 'rgba(150,180,210,0.6)', fontSize: 14 },
    readyStatusRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        marginTop: 8, marginBottom: 4,
    },
    readyDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1c2e42' },
    readyDotOn: { backgroundColor: '#4ade80' },
    readyStatusText: { color: 'rgba(150,180,210,0.5)', fontSize: 12 },
    readyBtn: {
        marginTop: 24,
        backgroundColor: '#FF6B00', borderRadius: 16,
        paddingHorizontal: 36, paddingVertical: 16,
    },
    readyBtnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    waitingForOpponent: {
        flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24,
    },
    waitingForText: { color: 'rgba(150,180,210,0.5)', fontSize: 14 },

    // Countdown
    countdownWrap: { alignItems: 'center', gap: 16 },
    countdownNumber: {
        color: '#fff',
        fontSize: 140,
        fontWeight: '900',
        lineHeight: 160,
        textShadowColor: ORANGE,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 30,
    },
    countdownLabel: {
        color: 'rgba(150,180,210,0.5)', fontSize: 14, fontWeight: '700', letterSpacing: 2,
    },

    // Active timer
    activeWrap: { alignItems: 'center', gap: 12 },
    activeExercise: {
        color: ORANGE, fontSize: 13, fontWeight: '800', letterSpacing: 1.5,
    },
    activeTimer: {
        color: '#fff',
        fontSize: 88,
        fontWeight: '800',
        fontVariant: ['tabular-nums'] as any,
        lineHeight: 100,
        letterSpacing: -2,
    },
    activeSubtitle: { color: 'rgba(150,180,210,0.45)', fontSize: 14 },
    progressRing: {
        width: width * 0.7, height: 5, borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 16, overflow: 'hidden',
    },
    progressFill: {
        height: '100%', backgroundColor: ORANGE, borderRadius: 3,
    },

    // Finished
    finishedWrap: { alignItems: 'center', gap: 14 },
    finishedEmoji: { fontSize: 72 },
    finishedTitle: { color: '#fff', fontSize: 34, fontWeight: '800' },
    finishedSub: {
        color: 'rgba(150,180,210,0.6)', fontSize: 14, textAlign: 'center', lineHeight: 20,
    },
    endWorkoutBtn: {
        marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#FF6B00', borderRadius: 16,
        paddingHorizontal: 36, paddingVertical: 16,
    },
    endWorkoutBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },

    // Controls
    controls: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 24, paddingBottom: 16,
    },
    ctrlBtn: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    ctrlBtnActive: { backgroundColor: 'rgba(232,153,81,0.3)' },
    endBtn: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: '#e53935',
        alignItems: 'center', justifyContent: 'center',
    },

    connectingBadge: {
        position: 'absolute', bottom: 90, alignSelf: 'center',
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20,
        paddingHorizontal: 14, paddingVertical: 7,
    },
    connectingText: { color: '#fff', fontSize: 13 },
});
