import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Dimensions, ActivityIndicator, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Mic, MicOff, PhoneOff, Flag, Video, VideoOff } from 'lucide-react-native';
import { ChallengeSessionService, ChallengeSession } from '../services/challengeSession.service';
import { supabase } from '../core/config/supabase';
import { playReminderBeep } from '../utils/webAudio';
// Platform-split voice service — picks .native.ts (react-native-agora) on mobile
// and .web.ts (agora-rtc-sdk-ng) on web, so voice works everywhere.
import { AgoraVoice } from '../services/agora/AgoraVoice';
// Platform-split video layer — opponent fills the screen, local camera as PiP.
import { ChallengeVideoStage } from '../components/ChallengeVideoStage';
import { PostChallengeQuestionnaire, PostChallengeAnswers } from '../components/PostChallengeQuestionnaire';

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

    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [remoteUids, setRemoteUids] = useState<number[]>([]);
    const [isConnecting, setIsConnecting] = useState(true);

    // Challenge phase state machine
    const [phase, setPhase] = useState<Phase>('waiting');
    const [iMeReady, setIMeReady] = useState(false);
    const [opponentReady, setOpponentReady] = useState(false);
    const [countdownText, setCountdownText] = useState('Ready');
    const [remainingSecs, setRemainingSecs] = useState(workoutDurationSecs);

    // Introduction call — 60s grace period before the challenge where both
    // participants get settled and ready up. Ready buttons are live the whole
    // time; the Ready·Steady·Go only fires once BOTH have readied. If the timer
    // runs out without both ready, we nudge with "Please ready up".
    const INTRO_SECS = 60;
    const [introSecs, setIntroSecs] = useState(INTRO_SECS);
    const [introExpired, setIntroExpired] = useState(false);
    const introInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const introStartedRef = useRef(false);
    const introStartAtRef = useRef<number | null>(null);

    // Post-challenge questionnaire (shown once the workout finishes)
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);
    const [submittingFeedback, setSubmittingFeedback] = useState(false);

    // Animations
    const countdownScale = useRef(new Animated.Value(1)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    // Ready-state sync via Realtime presence (no DB-publication dependency)
    const myRole = isHost ? 'host' : 'guest';
    const readyChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
    const iMeReadyRef = useRef(false);
    const startedRef = useRef(false);
    const phaseRef = useRef<Phase>('waiting');
    phaseRef.current = phase;

    // ── Agora voice init (works on native + web via platform-split service) ──
    useEffect(() => {
        let cancelled = false;

        AgoraVoice.joinChannelWithToken(
            token,
            channelName,
            0,
            () => {},  // onSpeakerActive — not used here
            (uid) => setRemoteUids(prev => (prev.includes(uid) ? prev : [...prev, uid])),
            (uid) => setRemoteUids(prev => prev.filter(u => u !== uid)),
        )
            .then(() => { if (!cancelled) setIsConnecting(false); })
            .catch((e) => {
                console.warn('[ChallengeVideoRoom] voice join failed:', e);
                if (!cancelled) setIsConnecting(false);
            });

        return () => {
            cancelled = true;
            AgoraVoice.leaveChannel().catch(() => {});
        };
    }, []);

    // ── Ready-state sync via Realtime broadcast (+ presence) ─────────
    // Both participants join `challenge:<sessionId>`. We use *broadcast* events
    // ('ready' / 'finished') as the primary signal because they are delivered
    // immediately and reliably (same mechanism as the lobby invite), whereas
    // presence-metadata *updates* on re-track were being dropped — leaving both
    // sides stuck on "Waiting for Challenger" even after both pressed Ready.
    // Presence is still tracked so a late joiner can read the current state, and
    // we re-announce our ready state whenever the opponent joins.
    useEffect(() => {
        if (!challengeSessionId) return;

        const ch = supabase.channel(`challenge:${challengeSessionId}`, {
            config: { presence: { key: myRole }, broadcast: { self: false } },
        });
        readyChannelRef.current = ch;

        // Re-broadcast my ready state — used when I press Ready and whenever the
        // opponent (re)joins, so they can never miss that I'm already ready. The
        // host also re-announces the synced intro start so a late joiner picks it up.
        const announce = () => {
            if (iMeReadyRef.current) {
                ch.send({ type: 'broadcast', event: 'ready', payload: { role: myRole } }).catch(() => {});
            }
            if (isHost && introStartAtRef.current) {
                ch.send({ type: 'broadcast', event: 'intro_start', payload: { startAt: introStartAtRef.current } }).catch(() => {});
            }
        };

        // Read the opponent's tracked presence (covers the case where they
        // readied up — or the host started the intro — before we subscribed, so
        // we missed their broadcast).
        const evaluate = () => {
            const state = ch.presenceState() as Record<string, any[]>;
            const theirs = isHost ? state['guest']?.[0] : state['host']?.[0];
            if (theirs?.ready) {
                console.log('[ChallengeRoom] opponent ready (presence)');
                setOpponentReady(true);
            }
            if (!isHost && theirs?.introStartAt && !introStartedRef.current) {
                beginIntro(theirs.introStartAt);
            }
            if (theirs?.finished && phaseRef.current !== 'finished') finishWorkout(false);
        };

        ch.on('presence', { event: 'sync' }, evaluate)
            .on('presence', { event: 'join' }, () => { evaluate(); announce(); })
            .on('presence', { event: 'leave' }, evaluate)
            .on('broadcast', { event: 'ready' }, ({ payload }) => {
                if (payload?.role && payload.role !== myRole) {
                    console.log('[ChallengeRoom] opponent ready (broadcast)');
                    setOpponentReady(true);
                }
            })
            .on('broadcast', { event: 'intro_start' }, ({ payload }) => {
                if (payload?.startAt && !introStartedRef.current) {
                    console.log('[ChallengeRoom] synced intro start');
                    beginIntro(payload.startAt);
                }
            })
            .on('broadcast', { event: 'finished' }, ({ payload }) => {
                if (payload?.role && payload.role !== myRole && phaseRef.current !== 'finished') {
                    finishWorkout(false);
                }
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await ch.track({ role: myRole, ready: iMeReadyRef.current, finished: false });
                    evaluate();   // opponent may already be present & ready
                    announce();   // tell an already-present opponent if I'm ready
                }
            });

        return () => {
            supabase.removeChannel(ch);
            readyChannelRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [challengeSessionId, isHost]);

    // ── Introduction call countdown (60 → 0) ─────────────────────────
    // Synced across both clients: the host picks a shared start timestamp once
    // both are in the live call and broadcasts it; both sides drive the display
    // off that common deadline (so the numbers stay identical regardless of tick
    // jitter). Guarded by introStartedRef so it only ever starts once. Does NOT
    // auto-start the challenge — that only happens when both press Ready. When
    // it reaches 0 we surface the "Please ready up" nudge.
    const bothJoined = remoteUids.length > 0;

    const beginIntro = (startAt: number) => {
        if (introStartedRef.current) return;
        introStartedRef.current = true;
        introStartAtRef.current = startAt;
        const tick = () => {
            const elapsed = Math.floor((Date.now() - startAt) / 1000);
            const remaining = Math.max(0, Math.min(INTRO_SECS, INTRO_SECS - elapsed));
            setIntroSecs(remaining);
            if (remaining <= 0) {
                if (introInterval.current) clearInterval(introInterval.current);
                setIntroExpired(true);
            }
        };
        tick();
        introInterval.current = setInterval(tick, 500);
    };

    // Host initiates the synced intro once both are in the call. The guest waits
    // for the broadcast / presence value (handled in the channel effect above).
    useEffect(() => {
        if (phase !== 'waiting' || !bothJoined || introStartedRef.current || !isHost) return;
        const startAt = Date.now() + 800; // small buffer so both receive it before t=0
        const ch = readyChannelRef.current;
        ch?.send({ type: 'broadcast', event: 'intro_start', payload: { startAt } }).catch(() => {});
        ch?.track({ role: myRole, ready: iMeReadyRef.current, finished: false, introStartAt: startAt }).catch(() => {});
        beginIntro(startAt);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, bothJoined, isHost]);

    // Stop the intro timer on unmount (other exits clear it explicitly).
    useEffect(() => () => { if (introInterval.current) clearInterval(introInterval.current); }, []);

    // ── Start the countdown once BOTH sides are ready ────────────────
    // Driven off React state (not presenceState) so it fires deterministically
    // for whoever readies up second — their opponentReady flag is already set
    // from the opponent's earlier presence event, and iMeReady is local.
    useEffect(() => {
        if (iMeReady && opponentReady && !startedRef.current && phaseRef.current === 'waiting') {
            startedRef.current = true;
            startCountdown();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [iMeReady, opponentReady]);

    // ── Reliable fallback: poll the DB ready flags ───────────────────
    // Broadcast/presence can drop a packet (e.g. one side readies before the
    // other subscribes), leaving the countdown stuck. setReady() always writes
    // host_ready/guest_ready, so poll it while waiting and pick up the
    // opponent's ready state even if the realtime signal was missed.
    useEffect(() => {
        if (!challengeSessionId || opponentReady || startedRef.current) return;
        let cancelled = false;
        const poll = setInterval(async () => {
            if (cancelled || startedRef.current) return;
            const s = await ChallengeSessionService.get(challengeSessionId).catch(() => null);
            if (!s || cancelled) return;
            const theirReady = isHost ? s.guestReady : s.hostReady;
            if (theirReady) setOpponentReady(true);
        }, 1500);
        return () => { cancelled = true; clearInterval(poll); };
    }, [challengeSessionId, isHost, opponentReady]);

    // ── Countdown: Ready → Steady → Go! ──────────────────────────────
    const startCountdown = () => {
        if (introInterval.current) clearInterval(introInterval.current);
        setPhase('countdown');
        const phrases = ['Ready', 'Steady', 'Go!'];
        let i = 0;

        const showPhrase = () => {
            setCountdownText(phrases[i]);
            playReminderBeep();
            // Pop animation on each word
            Animated.sequence([
                Animated.timing(countdownScale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
                Animated.timing(countdownScale, { toValue: 1,   duration: 280, useNativeDriver: true }),
            ]).start();
        };

        showPhrase(); // "Ready"

        countdownInterval.current = setInterval(() => {
            i++;
            if (i >= phrases.length) {
                // "Go!" was the last phrase shown — start the workout
                clearInterval(countdownInterval.current!);
                setPhase('active');
                if (challengeSessionId) ChallengeSessionService.markActive(challengeSessionId).catch(() => {});
                startWorkoutTimer();
            } else {
                showPhrase(); // "Steady", then "Go!"
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
        if (phaseRef.current === 'finished') return;
        setPhase('finished');
        if (introInterval.current) clearInterval(introInterval.current);
        // Let the opponent know via broadcast (primary) + presence (idempotent)
        const ch = readyChannelRef.current;
        ch?.send({ type: 'broadcast', event: 'finished', payload: { role: myRole } }).catch(() => {});
        ch?.track({ role: myRole, ready: true, finished: true }).catch(() => {});
        if (markDB && challengeSessionId) {
            ChallengeSessionService.markCompleted(challengeSessionId).catch(() => {});
        }
        // Surface the post-challenge questionnaire once the call has ended.
        setShowQuestionnaire(true);
    };

    // ── Post-challenge questionnaire submit / skip ───────────────────
    const handleSubmitFeedback = async (answers: PostChallengeAnswers) => {
        setSubmittingFeedback(true);
        try {
            // Resolve participant ids reliably — route params may omit them, so
            // fall back to the session's host/guest ids.
            let meId = myUid ?? null;
            let oppId = opponentUid ?? null;
            if ((!meId || !oppId) && challengeSessionId) {
                const s = await ChallengeSessionService.get(challengeSessionId).catch(() => null);
                if (s) {
                    meId = meId ?? (isHost ? s.hostId : s.guestId);
                    oppId = oppId ?? (isHost ? s.guestId : s.hostId);
                }
            }
            if (challengeSessionId && meId) {
                await ChallengeSessionService.submitFeedback({
                    sessionId: challengeSessionId,
                    userId: meId,
                    feeling: answers.feeling,
                    friendliness: answers.friendliness,
                    reps: answers.reps,
                    winnerId: answers.winner === 'me' ? meId : oppId,
                });
            }
        } catch (e) {
            console.warn('[ChallengeVideoRoom] feedback submit failed:', e);
        } finally {
            setSubmittingFeedback(false);
            setShowQuestionnaire(false);
            handleLeave();
        }
    };

    const handleSkipFeedback = () => {
        setShowQuestionnaire(false);
        handleLeave();
    };

    // ── Press "I'm Ready" ────────────────────────────────────────────
    const handleReady = async () => {
        setIMeReady(true);
        iMeReadyRef.current = true;
        if (challengeSessionId) {
            // Broadcast my ready state (primary, instant) + track via presence
            // (so a later joiner can still read it), and persist a DB record.
            const ch = readyChannelRef.current;
            ch?.send({ type: 'broadcast', event: 'ready', payload: { role: myRole } }).catch(() => {});
            ch?.track({ role: myRole, ready: true, finished: false }).catch(() => {});
            ChallengeSessionService.setReady(challengeSessionId, myRole).catch(() => {});
        } else {
            // No session (direct nav) — just start immediately for testing
            startCountdown();
        }
    };

    // ── End call / leave ─────────────────────────────────────────────
    const handleLeave = () => {
        clearInterval(timerInterval.current!);
        clearInterval(countdownInterval.current!);
        if (introInterval.current) clearInterval(introInterval.current);
        // Only cancel if we're bailing BEFORE the challenge completed — a finished
        // challenge has already been marked completed and must not be overwritten.
        if (challengeSessionId && phaseRef.current !== 'finished') {
            ChallengeSessionService.cancel(challengeSessionId).catch(() => {});
        }
        AgoraVoice.leaveChannel().catch(() => {});
        navigation.goBack();
    };

    const toggleMute = () => {
        const next = !isMuted;
        AgoraVoice.toggleMute(next).catch(() => {});
        setIsMuted(next);
    };

    const toggleCamera = () => {
        const next = !isCameraOff;
        AgoraVoice.toggleCamera(next).catch(() => {});
        setIsCameraOff(next);
    };

    // ── Render ────────────────────────────────────────────────────────
    return (
        <View style={st.root}>
            {/* Live video layer — opponent fills the screen, local camera as PiP */}
            <ChallengeVideoStage
                remoteUid={remoteUids[0]}
                isCameraOff={isCameraOff}
                opponentName={opponentName}
            />

            {/* Scrims keep the overlaid text/controls legible over the video */}
            <View style={st.scrimTop} pointerEvents="none" />
            <View style={st.scrimBottom} pointerEvents="none" />

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

                    {/* WAITING — Introduction Call */}
                    {phase === 'waiting' && (
                        <View style={st.waitingWrap}>
                            <Text style={st.introTitle}>INTRODUCTION CALL</Text>

                            {!bothJoined ? (
                                <Text style={st.introReadyUp}>Waiting for {opponentName} to join…</Text>
                            ) : introExpired ? (
                                <Text style={st.introReadyUp}>Please ready up</Text>
                            ) : (
                                <Text style={st.introTimer}>{introSecs}</Text>
                            )}

                            <Text style={st.opponentStatus}>
                                {!bothJoined
                                    ? 'Your intro call starts when you both join'
                                    : opponentReady
                                        ? `✓ ${opponentName} is ready!`
                                        : `Say hi to ${opponentName}, then ready up`}
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

                    {/* COUNTDOWN — Ready · Steady · Go! */}
                    {phase === 'countdown' && (
                        <View style={st.countdownWrap}>
                            <Animated.Text
                                style={[
                                    st.countdownWord,
                                    { transform: [{ scale: countdownScale }] },
                                ]}
                            >
                                {countdownText}
                            </Animated.Text>
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

                        <TouchableOpacity
                            style={[st.ctrlBtn, isCameraOff && st.ctrlBtnActive]}
                            onPress={toggleCamera}
                            activeOpacity={0.8}
                        >
                            {isCameraOff
                                ? <VideoOff color="#fff" size={20} />
                                : <Video color="#fff" size={20} />}
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
                    </View>
                )}

                {isConnecting && (
                    <View style={st.connectingBadge}>
                        <ActivityIndicator color="#E89951" size="small" />
                        <Text style={st.connectingText}>Connecting voice…</Text>
                    </View>
                )}
            </SafeAreaView>

            {/* Post-challenge questionnaire — appears once the call has ended */}
            <PostChallengeQuestionnaire
                visible={showQuestionnaire}
                opponentName={opponentName}
                exerciseName={exerciseName}
                submitting={submittingFeedback}
                onSubmit={handleSubmitFeedback}
                onSkip={handleSkipFeedback}
            />
        </View>
    );
};

const ORANGE = '#E89951';

const st = StyleSheet.create({
    root:      { flex: 1, backgroundColor: '#080e18' },
    scrimTop:    { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.22, backgroundColor: 'rgba(8,14,24,0.55)' },
    scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.28, backgroundColor: 'rgba(6,12,20,0.6)' },
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
    waitingWrap: {
        alignItems: 'center', gap: 12,
        backgroundColor: 'rgba(8,14,24,0.7)',
        borderRadius: 22, paddingHorizontal: 28, paddingVertical: 24,
        borderWidth: 1, borderColor: 'rgba(232,153,81,0.2)',
    },
    introTitle: {
        color: ORANGE, fontSize: 13, fontWeight: '800',
        letterSpacing: 1.8, marginBottom: 4,
    },
    introTimer: {
        color: '#fff', fontSize: 64, fontWeight: '900',
        fontVariant: ['tabular-nums'] as any, lineHeight: 72, letterSpacing: -1,
        textShadow: `0px 0px 24px ${ORANGE}` as any,
    },
    introReadyUp: {
        color: '#fff', fontSize: 22, fontWeight: '600',
        marginVertical: 14, textAlign: 'center',
    },
    opponentStatus: { color: 'rgba(200,220,240,0.85)', fontSize: 14 },
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

    // Countdown — Ready · Steady · Go!
    countdownWrap: { alignItems: 'center', gap: 16 },
    countdownWord: {
        color: '#fff',
        fontSize: 64,
        fontWeight: '900',
        lineHeight: 76,
        letterSpacing: 1,
        textShadow: `0px 0px 24px ${ORANGE}` as any,
    },

    // Active timer
    activeWrap: { alignItems: 'center', gap: 12 },
    activeExercise: {
        color: ORANGE, fontSize: 13, fontWeight: '800', letterSpacing: 1.5,
    },
    activeTimer: {
        color: '#fff',
        fontSize: 52,
        fontWeight: '800',
        fontVariant: ['tabular-nums'] as any,
        lineHeight: 60,
        letterSpacing: -1,
    },
    activeSubtitle: { color: 'rgba(150,180,210,0.45)', fontSize: 13 },
    progressRing: {
        width: width * 0.55, height: 5, borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 14, overflow: 'hidden',
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
