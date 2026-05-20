import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    Animated,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
    ArrowLeft,
    CalendarClock,
    ChevronRight,
    Pause,
    Play,
    RotateCcw,
    RotateCw,
    Tv2,
    UserPlus,
    Users,
} from 'lucide-react-native';
import { CastButton } from './cast/CastButton';
import { CastStatusBanner } from './cast/CastStatusBanner';
import { RemoteControlBar } from './cast/RemoteControlBar';
import { useCast } from '../hooks/useCast';

export type SharedVideoPlayerRef = {
    pauseVideo: () => void;
    resumeVideo: () => void;
};

type InviteCta = {
    title: string;
    subtitle: string | React.ReactNode;
    onPress: () => void;
    viewerCount?: number;
    onInviteSocial?: () => void;
    onScheduleSelf?: () => void;
};

interface SharedVideoPlayerProps {
    title: string;
    videoUri: string;
    onBack: () => void;
    actionLabel?: string;
    onActionPress?: () => void;
    inviteCta?: InviteCta;
    footerText?: string;
    headerLeftExtra?: React.ReactNode;
    onPlayStateChange?: (isPlaying: boolean) => void;
    onSeekForward?: (newPositionMs: number) => void;
    onVideoEnd?: () => void;
    onCurrentPositionChange?: (positionMs: number) => void;
}

export const SharedVideoPlayer = forwardRef<SharedVideoPlayerRef, SharedVideoPlayerProps>(function SharedVideoPlayer({
    title,
    videoUri,
    onBack,
    actionLabel,
    onActionPress,
    inviteCta,
    footerText,
    headerLeftExtra,
    onPlayStateChange,
    onSeekForward,
    onVideoEnd,
    onCurrentPositionChange,
}: SharedVideoPlayerProps, ref: React.Ref<SharedVideoPlayerRef>) {
    const player = useVideoPlayer({ uri: videoUri }, p => { p.play(); });
    const onVideoEndRef = useRef(onVideoEnd);
    onVideoEndRef.current = onVideoEnd;
    const onCurrentPositionChangeRef = useRef(onCurrentPositionChange);
    onCurrentPositionChangeRef.current = onCurrentPositionChange;

    const isSeekingRef = useRef(false);
    const seekBarWidth = useRef(1);
    // Guards against firing onVideoEnd more than once per playthrough.
    // Reset when a new video loads (videoUri change) or the user seeks back to the start.
    const completionHandledRef = useRef(false);
    const durationRef = useRef(0);
    const dragStartXRef = useRef(0);
    // Position (ms) at the moment user starts a scrub — used to detect forward seeks
    const positionAtScrubStartRef = useRef(0);

    useImperativeHandle(ref, () => ({
        pauseVideo: () => { player.pause(); },
        resumeVideo: () => { player.play(); },
    }));

    useEffect(() => {
        player.replace({ uri: videoUri });
        completionHandledRef.current = false;
    }, [videoUri]);

    useEffect(() => {
        const statusSub = player.addListener('statusChange', ({ status: s }: any) => {
            if (s === 'readyToPlay') {
                setIsLoaded(true);
                setStatus((prev: any) => ({ ...prev, durationMillis: player.duration * 1000 }));
            }
        });
        const playingSub = player.addListener('playingChange', ({ isPlaying: playing }: any) => {
            setIsPlaying(playing);
            setStatus((prev: any) => ({ ...prev, isPlaying: playing }));
        });
        const timeSub = player.addListener('timeUpdate', ({ currentTime }: any) => {
            if (isSeekingRef.current) return;
            const posMs = currentTime * 1000;
            const durMs = player.duration * 1000;

            if (posMs < 2000 && completionHandledRef.current) {
                completionHandledRef.current = false;
            }

            setStatus((prev: any) => ({
                ...prev,
                positionMillis: posMs,
                ...(durMs > 0 ? { durationMillis: durMs } : {}),
            }));
            setDisplayPositionMs(null);
            onCurrentPositionChangeRef.current?.(posMs);

            if (!completionHandledRef.current && durMs > 0 && posMs >= durMs - 1000 && !player.playing) {
                completionHandledRef.current = true;
                onVideoEndRef.current?.();
            }
        });
        const endSub = player.addListener('playToEnd', () => {
            if (!completionHandledRef.current) {
                completionHandledRef.current = true;
                onVideoEndRef.current?.();
            }
        });

        return () => {
            statusSub.remove();
            playingSub.remove();
            timeSub.remove();
            endSub.remove();
        };
    }, [player]);

    const controlsOpacity = useRef(new Animated.Value(1)).current;
    const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isPlayingRef = useRef(true);

    const [status, setStatus] = useState<any>({});
    const [isLoaded, setIsLoaded] = useState(false);
    const [seekProgress, setSeekProgress] = useState(0);
    const [isSeeking, setIsSeeking] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);
    const [controlsVisible, setControlsVisible] = useState(true);
    const [displayPositionMs, setDisplayPositionMs] = useState<number | null>(null);
    // AirPlay becomes true when iOS routes audio/video to an external display
    const [isAirPlayActive, setIsAirPlayActive] = useState(false);

    const {
        isCasting,
        deviceName,
        isPlaying: castIsPlaying,
        positionSeconds: castPositionSec,
        durationSeconds: castDurationSec,
        castVideo,
        play: castPlay,
        pause: castPause,
        seekTo: castSeekTo,
        seekRelative: castSeekRelative,
        endSession,
    } = useCast();

    // True when video is being watched on an external screen (Chromecast or AirPlay)
    const isCastingChromecast = isCasting && Platform.OS !== 'web';
    const showCastOverlay = isCastingChromecast;

    const duration = status?.durationMillis ?? 0;
    const position = displayPositionMs ?? status?.positionMillis ?? 0;
    const progress = duration > 0 ? position / duration : 0;
    const displayProgress = isSeeking ? seekProgress : progress;

    const formatTime = (ms: number) => {
        if (!ms || !isFinite(ms)) return '0:00';
        const seconds = Math.floor(ms / 1000);
        return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
    };

    const safeSeek = (ms: number) => {
        if (!isLoaded) return;
        if (!isFinite(ms) || ms < 0) return;
        try {
            player.currentTime = ms / 1000;
        } catch {
            // Ignore seek failures caused by transient playback state changes.
        }
    };

    const fadeControlsIn = () => {
        setControlsVisible(true);
        Animated.timing(controlsOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: Platform.OS !== 'web',
        }).start();
    };

    const fadeControlsOut = () => {
        Animated.timing(controlsOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: Platform.OS !== 'web',
        }).start(() => setControlsVisible(false));
    };

    const clearHideTimer = () => {
        if (controlsHideTimerRef.current) {
            clearTimeout(controlsHideTimerRef.current);
            controlsHideTimerRef.current = null;
        }
    };

    const scheduleHide = () => {
        clearHideTimer();
        controlsHideTimerRef.current = setTimeout(() => {
            fadeControlsOut();
        }, 2000);
    };

    const showControls = () => {
        fadeControlsIn();
        if (isPlayingRef.current) {
            scheduleHide();
        } else {
            clearHideTimer();
        }
    };

    useEffect(() => {
        isPlayingRef.current = isPlaying;
        onPlayStateChange?.(isPlaying);
    }, [isPlaying]);

    useEffect(() => {
        durationRef.current = duration;
    }, [duration]);

    useEffect(() => {
        clearHideTimer();
        if (isPlaying) {
            scheduleHide();
        } else {
            fadeControlsIn();
        }

        return () => {
            clearHideTimer();
        };
    }, [isPlaying]);

    const togglePlay = () => {
        if (isPlaying) {
            player.pause();
            setIsPlaying(false);
            return;
        }
        player.play();
        setIsPlaying(true);
    };

    const skipBack = () => {
        isSeekingRef.current = true;
        const nextPosition = Math.max(0, position - 10000);
        setDisplayPositionMs(nextPosition);
        safeSeek(nextPosition);
        setTimeout(() => {
            isSeekingRef.current = false;
            setDisplayPositionMs(null);
        }, 300);
    };

    const skipForward = () => {
        isSeekingRef.current = true;
        const nextPosition = Math.min(duration, position + 10000);
        setDisplayPositionMs(nextPosition);
        onSeekForward?.(nextPosition);
        safeSeek(nextPosition);
        setTimeout(() => {
            isSeekingRef.current = false;
            setDisplayPositionMs(null);
        }, 300);
    };

    const applyScrubPosition = (newPositionMs: number) => {
        const boundedPosition = Math.max(0, Math.min(durationRef.current, newPositionMs));
        const ratio = durationRef.current > 0 ? boundedPosition / durationRef.current : 0;
        setSeekProgress(ratio);
        setDisplayPositionMs(boundedPosition);
        player.currentTime = boundedPosition / 1000;
    };

    const finishSeeking = () => {
        setTimeout(() => {
            isSeekingRef.current = false;
            setIsSeeking(false);
            setDisplayPositionMs(null);
            if (isPlayingRef.current) {
                scheduleHide();
            }
        }, 150);
    };

    const seekPan = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (event) => {
                clearHideTimer();
                fadeControlsIn();
                isSeekingRef.current = true;
                setIsSeeking(true);
                dragStartXRef.current = event.nativeEvent.locationX;
                // Snapshot position before drag so we can detect forward seeks on release
                positionAtScrubStartRef.current = displayPositionMs ?? status?.positionMillis ?? 0;
                const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / seekBarWidth.current));
                applyScrubPosition(ratio * durationRef.current);
            },
            onPanResponderMove: (_event, gestureState) => {
                const nextX = dragStartXRef.current + gestureState.dx;
                const ratio = Math.max(0, Math.min(1, nextX / seekBarWidth.current));
                applyScrubPosition(ratio * durationRef.current);
            },
            onPanResponderRelease: (_event, gestureState) => {
                const nextX = dragStartXRef.current + gestureState.dx;
                const ratio = Math.max(0, Math.min(1, nextX / seekBarWidth.current));
                const newPositionMs = ratio * durationRef.current;
                applyScrubPosition(newPositionMs);
                if (newPositionMs > positionAtScrubStartRef.current + 10000) {
                    onSeekForward?.(newPositionMs);
                }
                finishSeeking();
            },
            onPanResponderTerminate: (_event, gestureState) => {
                const nextX = dragStartXRef.current + gestureState.dx;
                const ratio = Math.max(0, Math.min(1, nextX / seekBarWidth.current));
                const newPositionMs = ratio * durationRef.current;
                applyScrubPosition(newPositionMs);
                if (newPositionMs > positionAtScrubStartRef.current + 10000) {
                    onSeekForward?.(newPositionMs);
                }
                finishSeeking();
            },
        })
    ).current;

    // ── Cast helpers ──────────────────────────────────────────────────────

    const handleCastPress = async () => {
        // Load the current video onto the Chromecast at the current position
        await castVideo({
            type: 'video',
            url: videoUri,
            title,
            startTime: position / 1000,
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
                    <ArrowLeft color="white" size={24} />
                </TouchableOpacity>

                {headerLeftExtra}

                <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {title}
                    </Text>
                </View>

                <View style={styles.headerActions}>
                    {/* Cast button — auto-hides when no devices are available */}
                    <CastButton tintColor="white" size={22} />

                    {actionLabel ? (
                        <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={onActionPress ?? onBack}
                        >
                            <Text style={styles.actionBtnText}>{actionLabel}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            {/* AirPlay status banner (shown when iOS has routed video externally) */}
            {isAirPlayActive && !isCastingChromecast && (
                <View style={styles.airPlayBanner}>
                    <CastStatusBanner
                        deviceName="AirPlay"
                        forceVisible
                        onStopPress={() => {
                            player.pause();
                        }}
                    />
                </View>
            )}

            <TouchableWithoutFeedback onPress={showCastOverlay ? undefined : showControls}>
                <View style={styles.videoStage}>

                    {/* ── Chromecast active: show placeholder instead of video ── */}
                    {showCastOverlay ? (
                        <View style={styles.castPlaceholder}>
                            <Tv2 color="#4FC3F7" size={60} />
                            <Text style={styles.castPlaceholderTitle}>Playing on TV</Text>
                            <Text style={styles.castPlaceholderDevice} numberOfLines={1}>
                                {deviceName ?? 'Connected device'}
                            </Text>
                        </View>
                    ) : (
                        <>
                            <VideoView
                                player={player}
                                style={styles.video}
                                contentFit="contain"
                                nativeControls={false}
                                {...(Platform.OS === 'ios'
                                    ? ({
                                          allowsExternalPlayback: true,
                                          usesExternalPlaybackWhileExiting: true,
                                      } as any)
                                    : {})}
                            />

                            <Animated.View
                                pointerEvents={controlsVisible ? 'auto' : 'none'}
                                style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
                            >
                                <View style={styles.controlsRow}>
                                    <Text style={styles.timeText}>
                                        {formatTime(isSeeking ? seekProgress * duration : position)}
                                    </Text>

                                    <View style={styles.mainControls}>
                                        <TouchableOpacity onPress={skipBack} style={styles.controlBtn}>
                                            <RotateCcw color="white" size={24} />
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
                                            {isPlaying ? (
                                                <Pause color="black" size={28} />
                                            ) : (
                                                <Play color="black" size={28} style={styles.playIcon} />
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={skipForward} style={styles.controlBtn}>
                                            <RotateCw color="white" size={24} />
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.timeText}>{formatTime(duration)}</Text>
                                </View>
                            </Animated.View>

                            <View style={styles.timeRail}>
                                <Text style={styles.timeText}>
                                    {formatTime(isSeeking ? seekProgress * duration : position)}
                                </Text>
                                <Text style={styles.timeText}>{formatTime(duration)}</Text>
                            </View>

                            <View
                                style={styles.seekBar}
                                onLayout={(event) => {
                                    seekBarWidth.current = event.nativeEvent.layout.width;
                                }}
                                {...seekPan.panHandlers}
                            >
                                <View style={styles.seekTrack} />
                                <View style={[styles.seekFill, { width: `${displayProgress * 100}%` }]} />
                                <View style={[styles.seekThumb, { left: `${displayProgress * 100}%` }]} />
                            </View>
                        </>
                    )}
                </View>
            </TouchableWithoutFeedback>

            {/* ── Footer: remote controls when casting, invite CTA otherwise ── */}
            {showCastOverlay ? (
                <RemoteControlBar
                    mode="video"
                    isPlaying={castIsPlaying}
                    positionSeconds={castPositionSec}
                    durationSeconds={castDurationSec}
                    onPlay={castPlay}
                    onPause={castPause}
                    onSeekBack={() => castSeekRelative(-10)}
                    onSeekForward={() => castSeekRelative(10)}
                    onStopCast={endSession}
                />
            ) : inviteCta ? (
                <View style={styles.footerStack}>
                    {/* Invite a Friend */}
                    <TouchableOpacity
                        style={styles.footerBtn}
                        onPress={inviteCta.onPress}
                        activeOpacity={0.85}
                    >
                        <Users color="#FF6B00" size={14} />
                        <Text style={styles.footerBtnText}>Invite Friend</Text>
                    </TouchableOpacity>

                    {/* Schedule for Later */}
                    {inviteCta.onScheduleSelf && (
                        <TouchableOpacity
                            style={styles.footerBtnSchedule}
                            onPress={inviteCta.onScheduleSelf}
                            activeOpacity={0.85}
                        >
                            <CalendarClock color="#818CF8" size={14} />
                            <Text style={styles.footerBtnScheduleText}>Schedule</Text>
                        </TouchableOpacity>
                    )}

                </View>
            ) : footerText ? (
                <View style={styles.footerRow}>
                    <Text style={styles.footerText}>{footerText}</Text>
                </View>
            ) : null}
        </SafeAreaView>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerBtn: {
        padding: 8,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: 12,
    },
    headerTitle: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 72,
        justifyContent: 'flex-end',
    },
    actionBtn: {
        backgroundColor: '#FF6B00',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    actionBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 12,
    },
    airPlayBanner: {
        paddingHorizontal: 16,
        paddingBottom: 8,
        alignItems: 'center',
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    mainControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
    },
    controlBtn: {
        padding: 8,
    },
    playBtn: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playIcon: {
        marginLeft: 4,
    },
    timeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
        width: 40,
        textAlign: 'center',
    },
    videoStage: {
        flex: 1,
        width: '100%',
        backgroundColor: '#000',
        position: 'relative',
        overflow: 'hidden',
    },
    // ── Cast placeholder ───────────────────────────────────────────
    castPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#060f1c',
    },
    castPlaceholderTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 8,
    },
    castPlaceholderDevice: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 14,
        maxWidth: 240,
        textAlign: 'center',
    },
    // ── Video controls ─────────────────────────────────────────────
    controlsOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        paddingHorizontal: 16,
        paddingVertical: 10,
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
        bottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
    },
    seekBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 20,
        justifyContent: 'center',
    },
    seekTrack: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
    },
    seekFill: {
        position: 'absolute',
        left: 0,
        height: 4,
        backgroundColor: '#FF6B00',
        borderRadius: 2,
    },
    seekThumb: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF6B00',
        marginLeft: -6,
        top: 4,
    },
    // ── Footer ─────────────────────────────────────────────────────
    footerStack: {
        width: '100%',
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    footerRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    footerText: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 13,
        textTransform: 'uppercase',
        fontStyle: 'italic',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    footerBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(255,107,0,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.28)',
    },
    footerBtnText: {
        color: '#FF6B00',
        fontSize: 12,
        fontWeight: '700',
    },
    footerBtnSchedule: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(129,140,248,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(129,140,248,0.28)',
    },
    footerBtnScheduleText: {
        color: '#818CF8',
        fontSize: 12,
        fontWeight: '700',
    },
    footerBtnSocial: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 12,
        backgroundColor: '#FF6B00',
    },
    footerBtnSocialText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    liveChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 8,
    },
    liveChipText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#22c55e',
    },
});
