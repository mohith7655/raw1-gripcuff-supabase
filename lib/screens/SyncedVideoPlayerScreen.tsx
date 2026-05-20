import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Platform,
    Animated,
    PanResponder,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Play, Pause, RotateCcw, RotateCw, ArrowLeft, Mic, MicOff, Camera, CameraOff, RefreshCw } from 'lucide-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '../providers/AuthContext';
import { useLibrary } from '../providers/LibraryContext';
import { AgoraVoice } from '../services/agora/AgoraVoice';
import { getLocalVideoTrack, getAgoraDebugInfo, getAgoraClient, getLocalAudioTrack } from '../services/agora/AgoraVideoHelper';
import { LiveSessionService, JoinRequest } from '../services/liveSession.service';
import { recordUniversalWorkoutCompletion } from '../services/workoutCompletion.service';

const SILENCE_TIMEOUT_MS = 1500;

const { height: SCREEN_H } = Dimensions.get('window');
const HEADER_HEIGHT = 56;
const VIDEO_HEIGHT = 220;
const COMING_SOON_HEIGHT = 80;
const CONTROLS_HEIGHT = 72;
const CAMERA_HEIGHT = SCREEN_H - HEADER_HEIGHT - VIDEO_HEIGHT - COMING_SOON_HEIGHT - CONTROLS_HEIGHT;

export const SyncedVideoPlayerScreen = () => {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { sessionId, videoId, videoTitle, friendName } = route.params;

    const { supabaseUserId } = useAuth();
    const { allVideos, gripCuffVideos, trainerVideos } = useLibrary();

    const [role, setRole] = useState<'host' | 'guest'>('guest');
    const [cameraPermissionGranted, setCameraPermissionGranted] = useState<boolean | null>(null);
    const player = useVideoPlayer(null);

    const sourceVideo = useMemo(() => {
        const fallbackUrl = gripCuffVideos.find(v => v.videoUrl)?.videoUrl;
        const found = [...gripCuffVideos, ...trainerVideos, ...allVideos].find(v => v.id === videoId);
        if (found) return { ...found, videoUrl: found.videoUrl || fallbackUrl };
        if (fallbackUrl) return { id: videoId, title: videoTitle, videoUrl: fallbackUrl } as any;
        return null;
    }, [videoId, gripCuffVideos.length, trainerVideos.length, allVideos.length]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [, setControlledBy] = useState<string | null>(null);

    // Agora state
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOff, setIsCameraOff] = useState(false);
    const [isFront, setIsFront] = useState(true);
    const [swapped, setSwapped] = useState(false); // true = self is big, remote is small overlay
    const [agoraJoined, setAgoraJoined] = useState(false);
    const [agoraError, setAgoraError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState(getAgoraDebugInfo());

    // Join requests from other users wanting to join this live call
    const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

    // Active speaker UID — null means no one speaking (equal-sized boxes)
    const [activeSpeakerUid, setActiveSpeakerUid] = useState<string | null>(null);
    const silenceTimerRef = useRef<any>(null);

    // Animated scale values for volume-driven card resize
    const localScale = useRef(new Animated.Value(1)).current;
    const remoteScale = useRef(new Animated.Value(1)).current;

    // Auto-hide controls (video player)
    const controlsOpacity = useRef(new Animated.Value(1)).current;
    const controlsHideTimerRef = useRef<any>(null);
    const isPlayingRef = useRef(false);
    const [controlsVisible, setControlsVisible] = useState(true);

    // Auto-hide cam controls (video call overlay)
    const camControlsOpacity = useRef(new Animated.Value(0)).current;
    const camControlsHideTimerRef = useRef<any>(null);
    const [camControlsVisible, setCamControlsVisible] = useState(false);

    // Completion tracking — prevent double-counting per session
    const completionFiredRef = useRef(false);

    const handleSessionComplete = async (finalCurrentTime: number, finalDuration: number) => {
        const uid = supabaseUserId;
        if (!uid || completionFiredRef.current) return;

        const pct = finalDuration > 0 ? finalCurrentTime / finalDuration : 0;
        if (pct < 0.85) return; // must watch >= 85% of video

        completionFiredRef.current = true;
        const watchMinutes = Math.max(1, Math.round(finalCurrentTime / 60));

        recordUniversalWorkoutCompletion(uid, {
            workoutId: videoId,
            workoutTitle: videoTitle,
            sourceType: 'friend_workout',
            watchMinutes,
        }).then(r => console.log('[SyncedPlayer] completion recorded — streak:', r.newStreak))
          .catch(e => console.warn('[SyncedPlayer] completion failed:', e?.message ?? e));
    };

    // Sync debounce
    const syncDebounceRef = useRef<any>(null);

    // Progress bar drag
    const barWidthRef = useRef(1);
    const durationRef = useRef(0);
    const dragStartXRef = useRef(0);   // locationX at touch start (within bar)
    const dragStartTimeRef = useRef(0); // video time at touch start

    const progressPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (e) => {
                // Record where the user touched on the bar
                dragStartXRef.current = e.nativeEvent.locationX;
                dragStartTimeRef.current = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidthRef.current)) * durationRef.current;
            },
            onPanResponderMove: (_e, gestureState) => {
                // gestureState.dx is cumulative horizontal movement from start — left-to-right = positive
                const newX = dragStartXRef.current + gestureState.dx;
                const pct = Math.max(0, Math.min(1, newX / barWidthRef.current));
                const newTime = pct * durationRef.current;
                player.currentTime = newTime;
                setCurrentTime(newTime);
            },
            onPanResponderRelease: (_e, gestureState) => {
                const newX = dragStartXRef.current + gestureState.dx;
                const pct = Math.max(0, Math.min(1, newX / barWidthRef.current));
                const newTime = pct * durationRef.current;
                player.currentTime = newTime;
                setCurrentTime(newTime);
                updateSyncState(isPlayingRef.current, newTime);
            },
        })
    ).current;

    // Track local UID so we can compare in volume-indicator callback
    const localUidRef = useRef<string | null>(null);
    const lastSelfTapRef = useRef<number>(0);

    // ── Keep refs current ──
    const currentTimeRef = useRef(0);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
    useEffect(() => { durationRef.current = duration; }, [duration]);
    useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

    // ── Live session presence ──
    useEffect(() => {
        if (!agoraJoined || !sessionId) return;
        LiveSessionService.markLive(sessionId);
    }, [agoraJoined, sessionId]);

    useEffect(() => {
        if (!sessionId) return;
        return () => { LiveSessionService.markEnded(sessionId); };
    }, [sessionId]);

    // ── Listen for join requests while in call ──
    useEffect(() => {
        if (!sessionId) return;
        return LiveSessionService.subscribeToJoinRequests(sessionId, setJoinRequests);
    }, [sessionId]);

    // ── Controls fade helpers ──
    const fadeControlsIn = () => {
        setControlsVisible(true);
        Animated.timing(controlsOpacity, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start();
    };
    const fadeControlsOut = () => {
        Animated.timing(controlsOpacity, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }).start(() => setControlsVisible(false));
    };
    const scheduleHide = () => {
        if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
        controlsHideTimerRef.current = setTimeout(fadeControlsOut, 2000);
    };

    // ── Auto-hide controls ──
    useEffect(() => {
        if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
        if (isPlaying) {
            scheduleHide();
        } else {
            fadeControlsIn();
        }
        return () => { if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current); };
    }, [isPlaying]);

    const showControls = () => {
        fadeControlsIn();
        if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
        if (isPlayingRef.current) scheduleHide();
    };

    // ── Log when active speaker changes ──
    useEffect(() => {
        const label = activeSpeakerUid === null
            ? 'none'
            : activeSpeakerUid === localUidRef.current ? 'ME' : 'REMOTE';
        console.log('[SizeChange] activeSpeaker:', activeSpeakerUid, `(${label})`);
    }, [activeSpeakerUid]);

    // ── Animate card scale based on active speaker ──
    useEffect(() => {
        const localLoud = activeSpeakerUid !== null && activeSpeakerUid === localUidRef.current;
        const remoteLoud = activeSpeakerUid !== null && activeSpeakerUid !== localUidRef.current;
        Animated.parallel([
            Animated.spring(localScale, {
                toValue: localLoud ? 1.2 : remoteLoud ? 0.8 : 1,
                useNativeDriver: false,
                tension: 50,
                friction: 7,
            }),
            Animated.spring(remoteScale, {
                toValue: remoteLoud ? 1.2 : localLoud ? 0.8 : 1,
                useNativeDriver: false,
                tension: 50,
                friction: 7,
            }),
        ]).start();
    }, [activeSpeakerUid]);


    // Helper: mark a speaker active and reset the silence timer
    const markActiveSpeaker = (uid: string) => {
        setActiveSpeakerUid(uid);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
            setActiveSpeakerUid(null);
        }, SILENCE_TIMEOUT_MS);
    };

    // ── Set up Agora volume-indicator + local audio polling after join ──
    useEffect(() => {
        if (!agoraJoined || Platform.OS !== 'web') return;

        const agoraClient = getAgoraClient();
        if (!agoraClient) return;

        localUidRef.current = agoraClient.uid?.toString() ?? null;

        // Remote volume via volume-indicator event
        const handleVolume = (volumes: { uid: string | number; level: number }[]) => {
            const loudest = volumes.reduce(
                (best, v) => (v.level > best.level ? v : best),
                { uid: '', level: 0 },
            );
            if (loudest.level > 25) {
                markActiveSpeaker(loudest.uid.toString());
            }
        };
        (agoraClient as any).on('volume-indicator', handleVolume);

        // Local microphone volume polling
        const localPollInterval = setInterval(() => {
            const audioTrack = getLocalAudioTrack();
            if (!audioTrack) return;
            const level = ((audioTrack as any).getVolumeLevel?.() ?? 0) * 100;
            if (level > 25 && localUidRef.current) {
                markActiveSpeaker(localUidRef.current);
            }
        }, 200);

        return () => {
            (agoraClient as any).off('volume-indicator', handleVolume);
            clearInterval(localPollInterval);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };
    }, [agoraJoined]);

    // ── Player source + events ──
    useEffect(() => {
        if (sourceVideo?.videoUrl) {
            player.replace({ uri: sourceVideo.videoUrl });
        }
    }, [sourceVideo?.videoUrl]);

    const handleSessionCompleteRef = useRef(handleSessionComplete);
    handleSessionCompleteRef.current = handleSessionComplete;

    useEffect(() => {
        const statusSub = player.addListener('statusChange', ({ status: s }: any) => {
            if (s === 'readyToPlay') {
                setDuration(player.duration);
            }
        });
        const timeSub = player.addListener('timeUpdate', ({ currentTime: ct }: any) => {
            setCurrentTime(ct);
            if (player.duration > 0) setDuration(player.duration);
        });
        const endSub = player.addListener('playToEnd', () => {
            handleSessionCompleteRef.current(currentTimeRef.current, durationRef.current);
        });
        return () => {
            statusSub.remove();
            timeSub.remove();
            endSub.remove();
        };
    }, [player]);

    // ── Session + Agora init ──
    useEffect(() => {
        if (!supabaseUserId || !sessionId) return;

        let cancelled = false;

        const initSession = async () => {
            const initAgora = async () => {
                if (Platform.OS === 'web') {
                    try {
                        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                        stream.getTracks().forEach(t => t.stop());
                        setCameraPermissionGranted(true);
                    } catch (err) {
                        setCameraPermissionGranted(false);
                        return;
                    }
                }

                try {
                    await AgoraVoice.joinChannel(sessionId, () => { });
                    if (!cancelled) {
                        setAgoraJoined(true);
                        console.log('[SyncedVideoPlayer] Agora joined successfully');
                    }
                } catch (err: any) {
                    if (cancelled) return;
                    setAgoraError(err?.message ?? 'Failed to connect camera and audio');
                }
            };

            initAgora();
        };

        initSession();

        return () => {
            cancelled = true;
            AgoraVoice.leaveChannel();
        };
    }, [sessionId, supabaseUserId]);

    // ── Play local camera once joined ──
    useEffect(() => {
        if (!agoraJoined || Platform.OS !== 'web') return;
        const t = setTimeout(() => {
            const track = getLocalVideoTrack();
            if (track) track.play('local-video');
        }, 300);
        return () => clearTimeout(t);
    }, [agoraJoined]);

    // ── Poll Agora debug info ──
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const interval = setInterval(() => setDebugInfo(getAgoraDebugInfo()), 1000);
        return () => clearInterval(interval);
    }, []);


    // ── Sync write helpers (no-op stubs — Firebase removed) ──
    const updateSyncStateNow = (_playing: boolean, _positionSeconds: number) => {};

    const updateSyncState = (_playing: boolean, _positionSeconds: number) => {};

    const handlePlayPause = () => {
        const next = !isPlaying;
        setIsPlaying(next);
        if (next) { player.play(); }
        else { player.pause(); }
        updateSyncStateNow(next, currentTimeRef.current);
    };

    const handleSeek = (offsetSeconds: number) => {
        const newTime = Math.max(0, Math.min(currentTime + offsetSeconds, duration));
        player.currentTime = newTime;
        setCurrentTime(newTime);
        updateSyncState(isPlaying, newTime);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const toggleMic = async () => {
        setIsMuted(!isMuted);
        await AgoraVoice.toggleMute(!isMuted);
    };

    const toggleCamera = async () => {
        const track = getLocalVideoTrack();
        if (!track) return;
        const next = !isCameraOff;
        await (track as any).setMuted(next);
        setIsCameraOff(next);
    };

    const flipCamera = async () => {
        if (Platform.OS !== 'web') return;
        const track = getLocalVideoTrack();
        if (!track) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            if (videoDevices.length < 2) return;
            // On mobile: prefer facingMode label match; on desktop: cycle through devices
            const nextFront = !isFront;
            const preferred = videoDevices.find(d =>
                nextFront
                    ? d.label.toLowerCase().includes('front') || d.label.toLowerCase().includes('user')
                    : d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
            );
            const target = preferred ?? videoDevices.find(d => d.deviceId !== (track as any).getTrackLabel?.());
            if (target) {
                await (track as any).setDevice(target.deviceId);
                setIsFront(nextFront);
            }
        } catch (err) {
            console.warn('[flipCamera] failed:', err);
        }
    };

    const isLocalActive = activeSpeakerUid !== null && activeSpeakerUid === localUidRef.current;
    const isRemoteActive = activeSpeakerUid !== null && activeSpeakerUid !== localUidRef.current;

    if (!sourceVideo) {
        return (
            <SafeAreaView style={styles.centerContainer}>
                <Text style={styles.errorText}>Video not found.</Text>
                <TouchableOpacity style={styles.backBtnWrapper} onPress={() => navigation.goBack()}>
                    <ArrowLeft color="white" size={24} />
                    <Text style={{ color: 'white', marginLeft: 8 }}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>

            {/* ── 1. Header ── */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
                    <ArrowLeft color="white" size={24} />
                </TouchableOpacity>
                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>{friendName}</Text>
                    <View style={styles.liveIndicatorContainer}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>Live</Text>
                    </View>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.endSessionBtn} onPress={() => {
                        handleSessionComplete(currentTime, duration);
                        navigation.goBack();
                    }}>
                        <Text style={styles.endSessionText}>End</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Camera Permission Banner ── */}
            {Platform.OS === 'web' && cameraPermissionGranted === false && (
                <View style={styles.permissionBanner}>
                    <Text style={styles.permissionText}>
                        Camera access blocked — tap here to enable in browser settings
                    </Text>
                </View>
            )}

            <View style={{ flex: 1 }}>

                {/* ── 1. Video player ── */}
                <TouchableWithoutFeedback onPress={showControls}>
                    <View style={styles.videoContainer}>
                        <VideoView
                            player={player}
                            style={styles.video}
                            contentFit="contain"
                            nativeControls={false}
                        />
                        {/* ── Video player controls overlay ── */}
                        <Animated.View pointerEvents={controlsVisible ? 'auto' : 'none'} style={[styles.controlsOverlay, { opacity: controlsOpacity }]}>
                            <View style={styles.controlsRow}>
                                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                                <View style={styles.mainControls}>
                                    <TouchableOpacity style={styles.controlBtn} onPress={() => handleSeek(-10)}>
                                        <RotateCcw color="white" size={24} />
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
                                        {isPlaying
                                            ? <Pause color="black" size={28} />
                                            : <Play color="black" size={28} style={{ marginLeft: 4 }} />}
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.controlBtn} onPress={() => handleSeek(10)}>
                                        <RotateCw color="white" size={24} />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.timeText}>{formatTime(duration)}</Text>
                            </View>
                        </Animated.View>
                        <View pointerEvents="none" style={styles.timeRail}>
                            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                            <Text style={styles.timeText}>{formatTime(duration)}</Text>
                        </View>
                    </View>
                </TouchableWithoutFeedback>

                {/* ── 2. Progress bar ── */}
                {(() => {
                    const clampedPct = Math.min(100, Math.max(0,
                        duration > 0 && isFinite(currentTime) && isFinite(duration)
                            ? (currentTime / duration) * 100
                            : 0
                    ));
                    return (
                        <View
                            style={styles.progressBarBg}
                            onLayout={(e) => { barWidthRef.current = e.nativeEvent.layout.width; }}
                            {...progressPanResponder.panHandlers}
                        >
                            <View style={styles.progressBarTrack}>
                                <View style={[styles.progressBarFill, { width: `${clampedPct}%` } as any]} />
                            </View>
                            <View style={{
                                position: 'absolute',
                                top: 4,
                                left: `${clampedPct}%`,
                                width: 12, height: 12, borderRadius: 6,
                                backgroundColor: '#FF6B00',
                                marginLeft: -6,
                            } as any} />
                        </View>
                    );
                })()}

                {/* ── 4. Coming Soon ── */}
                {Platform.OS === 'web' && (
                    <View style={{
                        flex: 0.35,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 28,
                        paddingHorizontal: 16,
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        borderTopWidth: 1,
                        borderBottomWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                    } as any}>
                        <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: 1.5, textAlign: 'center', marginBottom: 12 }}>
                            ✦ Live reactions & chat — coming soon
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textTransform: 'uppercase', fontStyle: 'italic', letterSpacing: 1.5, textAlign: 'center' }}>
                            ✦ Shared workout stats — coming soon
                        </Text>
                    </View>
                )}

                {/* ── 5. Video call — Google Meet style ── */}
                {Platform.OS === 'web' && (
                    <View style={styles.videoCallContainer}>

                        {/* Camera area — fills available space */}
                        <View style={styles.cameraArea}>
                            {/* Remote video — style swaps between big fill and small overlay */}
                            <TouchableOpacity activeOpacity={1} onPress={() => {
                                if (swapped) setSwapped(false);
                                // Show cam controls on tap
                                setCamControlsVisible(true);
                                Animated.timing(camControlsOpacity, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start();
                                if (camControlsHideTimerRef.current) clearTimeout(camControlsHideTimerRef.current);
                                camControlsHideTimerRef.current = setTimeout(() => {
                                    Animated.timing(camControlsOpacity, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }).start(() => setCamControlsVisible(false));
                                }, 2000);
                            }} style={[
                                swapped ? styles.selfVideoOverlay : styles.remoteVideoFill,
                                isRemoteActive && (swapped ? styles.selfVideoActive : styles.remoteVideoActive),
                                swapped && { zIndex: 10 } as any,
                            ]}>
                                <View nativeID="remote-video" style={styles.cameraVideo} />
                                {!debugInfo.remoteVideoActive && <Text style={styles.cameraPlaceholderText}>Camera Off</Text>}
                                <Text style={swapped ? styles.selfNameLabel : styles.remoteNameLabel}>{friendName}</Text>
                            </TouchableOpacity>

                            {/* Local video — style swaps between small overlay and big fill */}
                            <TouchableOpacity
                                activeOpacity={1}
                                style={[
                                    swapped ? styles.remoteVideoFill : styles.selfVideoOverlay,
                                    isLocalActive && (swapped ? styles.remoteVideoActive : styles.selfVideoActive),
                                    !swapped && { zIndex: 10 } as any,
                                ]}
                                onPress={() => {
                                    const now = Date.now();
                                    const isDoubleTap = now - lastSelfTapRef.current < 300;
                                    lastSelfTapRef.current = now;
                                    if (isDoubleTap) {
                                        flipCamera();
                                    } else if (swapped) {
                                        setSwapped(false);
                                    } else {
                                        setSwapped(true);
                                    }
                                    // Show cam controls on tap
                                    setCamControlsVisible(true);
                                    Animated.timing(camControlsOpacity, { toValue: 1, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start();
                                    if (camControlsHideTimerRef.current) clearTimeout(camControlsHideTimerRef.current);
                                    camControlsHideTimerRef.current = setTimeout(() => {
                                        Animated.timing(camControlsOpacity, { toValue: 0, duration: 300, useNativeDriver: Platform.OS !== 'web' }).start(() => setCamControlsVisible(false));
                                    }, 2000);
                                }}
                            >
                                <View nativeID="local-video" style={styles.cameraVideo} />
                                {!agoraJoined && <Text style={styles.cameraPlaceholderText}>Camera Off</Text>}
                                <Text style={swapped ? styles.remoteNameLabel : styles.selfNameLabel}>You</Text>
                            </TouchableOpacity>

                            {/* Controls overlay — absolute, inside camera area, hidden by default */}
                            <Animated.View pointerEvents={camControlsVisible ? 'auto' : 'none'} style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                flexDirection: 'row',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: 24,
                                paddingVertical: 14,
                                paddingBottom: 20,
                                backgroundColor: 'transparent',
                                zIndex: 20,
                                opacity: camControlsOpacity,
                            } as any}>
                                <TouchableOpacity
                                    style={[styles.camOverlayBtn, isMuted && styles.camOverlayBtnActive]}
                                    onPress={() => toggleMic()}
                                >
                                    {isMuted ? <MicOff color="white" size={18} /> : <Mic color="white" size={18} />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.camOverlayBtn, isCameraOff && styles.camOverlayBtnActive]}
                                    onPress={() => toggleCamera()}
                                >
                                    {isCameraOff ? <CameraOff color="white" size={18} /> : <Camera color="white" size={18} />}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.camOverlayBtn}
                                    onPress={() => flipCamera()}
                                >
                                    <RefreshCw color="white" size={18} />
                                </TouchableOpacity>
                            </Animated.View>
                        </View>

                    </View>
                )}

                {/* ── Agora error banner ── */}
                {Platform.OS === 'web' && agoraError && (
                    <View style={styles.agoraErrorBanner}>
                        <Text style={styles.agoraErrorTitle}>⚠️ Camera / Audio Error</Text>
                        <Text style={styles.agoraErrorBody}>{agoraError}</Text>
                    </View>
                )}

            </View>

            {/* ── Join request overlay ── */}
            {joinRequests.length > 0 && (
                <View style={styles.joinRequestsOverlay}>
                    {joinRequests.map((req) => (
                        <View key={req.id} style={styles.joinRequestCard}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.joinRequestTitle}>Someone wants to join</Text>
                                <Text style={styles.joinRequestName}>{req.requesterName}</Text>
                                <Text style={styles.joinRequestSub}>wants to join your live workout</Text>
                            </View>
                            <View style={styles.joinRequestBtns}>
                                <TouchableOpacity
                                    style={styles.joinAllowBtn}
                                    onPress={() => LiveSessionService.respondToJoinRequest(sessionId, req.id, 'allowed')}
                                >
                                    <Text style={styles.joinAllowText}>Allow</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.joinDenyBtn}
                                    onPress={() => LiveSessionService.respondToJoinRequest(sessionId, req.id, 'denied')}
                                >
                                    <Text style={styles.joinDenyText}>Deny</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centerContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: { color: 'white', fontSize: 18, marginBottom: 16 },
    backBtnWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(255,107,0,0.2)',
        borderRadius: 12,
    },

    /* ── Header ── */
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerBtn: { padding: 8 },
    headerTitleContainer: { alignItems: 'center' },
    headerTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    liveIndicatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00ff88', marginRight: 4 },
    liveText: { color: '#00ff88', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' },
    headerActions: { flexDirection: 'row', alignItems: 'center' },
    endSessionBtn: {
        backgroundColor: '#ff4444',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginLeft: 12,
    },
    endSessionText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

    /* ── Permission banner ── */
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

    /* ── Video ── */
    videoContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#111',
        overflow: 'hidden',
    },
    video: {
        width: '100%',
        height: '100%',
    },
    videoInner: {
        width: '100%',
        height: '100%',
        objectFit: 'contain',
    },
    timeRail: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    friendStatusBanner: {
        position: 'absolute',
        top: 12,
        left: 16,
        right: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.65)',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    friendStatusText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },

    /* ── Controls bar — below video ── */
    controlsBar: {
        width: '100%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'transparent',
    },
    progressBarBg: {
        height: 20,           // tall touch target for easy finger grab
        justifyContent: 'center',
        backgroundColor: 'transparent',
        paddingHorizontal: 0,
        position: 'relative',
    },
    progressBarTrack: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: { height: 4, backgroundColor: '#FF6B00', borderRadius: 2 },
    controlsOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    mainControls: { flexDirection: 'row', alignItems: 'center', gap: 24 },
    controlBtn: { padding: 8 },
    playBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeText: { color: 'white', fontSize: 12, fontWeight: '600', width: 40, textAlign: 'center' },
    controlledByText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        textAlign: 'center',
        marginTop: 6,
    },

    /* ── Video call — Google Meet style ── */
    videoCallContainer: {
        flex: 0.85,
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
    remoteVideoActive: {
        borderWidth: 2,
        borderColor: 'rgba(255, 165, 0, 0.8)',
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
    selfVideoActive: {
        borderColor: 'rgba(255, 165, 0, 1)',
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
    cameraNameText: {
        position: 'absolute',
        bottom: 6,
        alignSelf: 'center',
        color: 'white',
        fontSize: 11,
        fontWeight: 'bold',
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        zIndex: 3,
    },

    /* ── Agora error banner ── */
    agoraErrorBanner: {
        position: 'absolute',
        bottom: 80,
        right: 16,
        left: 16,
        backgroundColor: 'rgba(200, 40, 40, 0.95)',
        borderRadius: 10,
        padding: 14,
        zIndex: 1000,
    },
    agoraErrorTitle: { color: 'white', fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
    agoraErrorBody: { color: 'rgba(255,255,255,0.9)', fontSize: 12, lineHeight: 18 },

    /* ── Join request overlay ── */
    joinRequestsOverlay: {
        position: 'absolute',
        top: 64,
        left: 12,
        right: 12,
        zIndex: 2000,
        gap: 8,
    },
    joinRequestCard: {
        backgroundColor: 'rgba(13,21,32,0.97)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(212,98,42,0.6)',
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    joinRequestTitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    joinRequestName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    joinRequestSub: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 2,
    },
    joinRequestBtns: {
        flexDirection: 'row',
        gap: 8,
    },
    joinAllowBtn: {
        backgroundColor: '#D4622A',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    joinAllowText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    joinDenyBtn: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    joinDenyText: {
        color: 'rgba(255,255,255,0.7)',
        fontWeight: '600',
        fontSize: 13,
    },

    /* ── Debug panel ── */
    debugPanel: {
        position: 'absolute',
        top: 72,
        left: 12,
        backgroundColor: 'rgba(0,0,0,0.82)',
        borderRadius: 8,
        padding: 10,
        zIndex: 1000,
        minWidth: 190,
        borderWidth: 1,
        borderColor: 'rgba(79,195,247,0.4)',
    },
    debugTitle: {
        color: '#4FC3F7',
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 6,
        letterSpacing: 0.5,
    },
    debugRow: {
        color: '#aaffaa',
        fontSize: 11,
        marginBottom: 3,
        fontFamily: 'monospace',
    },
    debugError: { color: '#ff6b6b' },

    /* ── Camera card tap overlay ── */
    camControls: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 14,
        paddingBottom: 24,
        gap: 24,
        backgroundColor: '#0d0d0d',
    } as any,
    camOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 10,
        zIndex: 10,
    } as any,
    camOverlayBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    camOverlayBtnActive: {
        backgroundColor: 'rgba(229,62,62,0.8)',
    },

    /* ── Debug volume meter (on local camera box) ── */
    volumeMeterBg: {
        position: 'absolute',
        bottom: 26,
        left: 6,
        right: 6,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        zIndex: 4,
        overflow: 'hidden',
    },
    volumeMeterFill: {
        height: 4,
        borderRadius: 2,
    },
    volumeNumber: {
        position: 'absolute',
        top: 6,
        right: 6,
        fontSize: 10,
        fontWeight: 'bold',
        zIndex: 4,
    },
});
