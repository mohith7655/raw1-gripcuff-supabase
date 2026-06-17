import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PulsingDot, StackedAvatars } from './LiveViewersModal';
import { ActiveWatcher } from '../services/WorkoutWatcherService';
import {
    Animated,
    GestureResponderEvent,
    Modal,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
    ArrowLeft,
    CalendarClock,
    ChevronRight,
    Maximize,
    Minimize,
    Pause,
    Play,
    RotateCcw,
    RotateCw,
    Tv2,
    UserPlus,
    Users,
} from 'lucide-react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { CastButton } from './cast/CastButton';
import { CastStatusBanner } from './cast/CastStatusBanner';
import { RemoteControlBar } from './cast/RemoteControlBar';
import { useCast } from '../hooks/useCast';
import { WatchTrackingService } from '../services/watchTracking.service';
import { Raw1Logo } from '../raw1_logo';

export type SharedVideoPlayerRef = {
    pauseVideo: () => void;
    resumeVideo: () => void;
    /** Seek to the given position in milliseconds. No-op if the player is not loaded. */
    seekTo: (ms: number) => void;
};

export type InviteCta = {
    title: string;
    subtitle: string | React.ReactNode;
    /** Opens the unified Workout Together scheduling flow (Step 1 date/time → Step 2 type). */
    onWorkoutTogether: () => void;
    /** @deprecated replaced by onViewersPress — kept for backward compat */
    onStartNow: () => void;
    viewerCount?: number;
    /** Live viewer objects — used for the stacked avatar overlay on the pill. */
    viewers?: ActiveWatcher[];
    /** Current user's UID — used to exclude self from avatar stack. */
    currentUid?: string | null;
    /** Opens the LiveViewersModal. */
    onViewersPress?: () => void;
    onInviteSocial?: () => void;
};

interface SharedVideoPlayerProps {
    title: string;
    videoUri: string;
    onBack: () => void;
    actionLabel?: string;
    onActionPress?: () => void;
    actionVariant?: 'default' | 'danger';
    /** Rendered inside the header title container, below the title — e.g. a LIVE pill. */
    headerTitleSuffix?: React.ReactNode;
    footerText?: string;
    headerLeftExtra?: React.ReactNode;
    onPlayStateChange?: (isPlaying: boolean) => void;
    /**
     * Called when the user presses the player's Play button (a play *intent*),
     * before the video actually plays. Return `false` to suppress playback —
     * e.g. workout mode triggers a Ready/Steady/Go countdown instead and only
     * starts the video imperatively (via resumeVideo) once it finishes.
     */
    onPlayRequest?: () => boolean;
    onSeekForward?: (newPositionMs: number) => void;
    onVideoEnd?: () => void;
    onCurrentPositionChange?: (positionMs: number) => void;
    onDurationChange?: (durationMs: number) => void;
    /** Supabase user ID — when provided, watch time is tracked automatically. */
    userId?: string;
    /** Overlay rendered on top of the video ONLY in fullscreen (e.g. workout
     *  timer). Positioned by the caller via absolute styles. */
    fullscreenExtras?: React.ReactNode;
    /** Overlay rendered on top of the video in BOTH normal and fullscreen
     *  (e.g. prev/next exercise in the top corners). */
    videoNavExtras?: React.ReactNode;
    /** Notified when fullscreen is entered/exited. */
    onFullscreenChange?: (isFullscreen: boolean) => void;
}

/**
 * Hosts the video stage. On native, fullscreen re-parents it into a full-screen
 * Modal (the parent already locks landscape orientation). On web we use the
 * browser Fullscreen API instead, so this is a passthrough there.
 * Defined at module scope so toggling does not remount the player every render.
 */
function FullscreenHost({
    active, onRequestClose, children,
}: { active: boolean; onRequestClose: () => void; children: React.ReactNode }) {
    if (!active) return <>{children}</>;
    return (
        <Modal
            visible
            animationType="fade"
            supportedOrientations={['landscape', 'landscape-left', 'landscape-right', 'portrait']}
            onRequestClose={onRequestClose}
        >
            <View style={styles.fsModalRoot}>{children}</View>
        </Modal>
    );
}

const SharedVideoPlayerInner = forwardRef<SharedVideoPlayerRef, SharedVideoPlayerProps>(function SharedVideoPlayer({
    title,
    videoUri,
    onBack,
    actionLabel,
    onActionPress,
    actionVariant,
    headerTitleSuffix,
    footerText,
    headerLeftExtra,
    onPlayStateChange,
    onPlayRequest,
    onSeekForward,
    onVideoEnd,
    onCurrentPositionChange,
    onDurationChange,
    userId,
    fullscreenExtras,
    videoNavExtras,
    onFullscreenChange,
}: SharedVideoPlayerProps, ref: React.Ref<SharedVideoPlayerRef>) {
    // Stable ref for userId so event listeners never capture a stale closure
    const userIdRef = useRef(userId);
    userIdRef.current = userId;
    // Tracks whether startSession() was called for this video mount (so pause/resume
    // don't re-fire the new-session counter)
    const watchSessionStartedRef = useRef(false);
    // Memoize the source object so useVideoPlayer receives a stable reference
    // across rerenders — prevents the player from being recreated on every render.
    const videoSource = useMemo(() => ({ uri: videoUri }), [videoUri]);
    const player = useVideoPlayer(videoSource, p => { p.play(); });
    const onVideoEndRef = useRef(onVideoEnd);
    onVideoEndRef.current = onVideoEnd;
    const onCurrentPositionChangeRef = useRef(onCurrentPositionChange);
    onCurrentPositionChangeRef.current = onCurrentPositionChange;
    const onDurationChangeRef = useRef(onDurationChange);
    onDurationChangeRef.current = onDurationChange;

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
        seekTo: (ms: number) => { safeSeek(ms); },
    }));

    useEffect(() => {
        console.log('[Video] mounted');
        return () => {
            console.log('[Video] unmounted');
            // Stop tracking and persist any remaining seconds before destroy
            WatchTrackingService.stopSession();
            WatchTrackingService.flushNow().catch(() => {});
        };
    }, []);

    useEffect(() => {
        console.log('[Video] source changed:', videoUri);
        player.replace({ uri: videoUri });
        completionHandledRef.current = false;
        setPlaybackError(null);
        setIsBuffering(true);
        // New video = new session; reset so startSession fires on next play
        watchSessionStartedRef.current = false;
        WatchTrackingService.stopSession();
    }, [videoUri]);

    useEffect(() => {
        const statusSub = player.addListener('statusChange', ({ status: s, error }: any) => {
            if (s === 'loading') {
                setIsLoaded(false);
                setIsBuffering(true);
                // Pause watch tracking while buffering — don't count dead time
                WatchTrackingService.pauseWatchSession();
            } else if (s === 'readyToPlay') {
                setIsLoaded(true);
                setIsBuffering(false);
                setPlaybackError(null);
                const durMs = player.duration * 1000;
                setStatus((prev: any) => ({ ...prev, durationMillis: durMs }));
                onDurationChangeRef.current?.(durMs);
                // Resume if the player is actively playing when it becomes ready
                if (player.playing && userIdRef.current && watchSessionStartedRef.current) {
                    WatchTrackingService.resumeWatchSession();
                }
            } else if (s === 'error' || error) {
                const msg = error?.message || 'Failed to load video';
                const isAudioError = Platform.OS === 'web' && msg.includes('AUDIO_RENDERER_ERROR');
                // Suppress generic HTML5 media element noise (not audio-specific)
                const isMediaElementNoise = Platform.OS === 'web' && !isAudioError && (
                    msg.includes('MEDIA_ELEMENT_ERROR') ||
                    msg.includes('HTMLMediaElement') ||
                    msg.includes('AbortError')
                );
                if (isAudioError) {
                    // Audio suspended by OS (Teams, screen share, etc.) — show friendly prompt
                    setIsBuffering(false);
                    setPlaybackError('audio_interrupted');
                } else if (!isMediaElementNoise) {
                    console.log('[Video Error]', { uri: videoUri, error: msg, platform: Platform.OS });
                    setIsBuffering(false);
                    setPlaybackError(msg);
                }
                WatchTrackingService.pauseWatchSession();
            }
        });
        const playingSub = player.addListener('playingChange', ({ isPlaying: playing }: any) => {
            setIsPlaying(playing);
            setStatus((prev: any) => ({ ...prev, isPlaying: playing }));

            // Watch tracking: start session on first play, pause/resume thereafter
            const uid = userIdRef.current;
            if (uid) {
                if (playing) {
                    if (!watchSessionStartedRef.current) {
                        watchSessionStartedRef.current = true;
                        WatchTrackingService.startSession(uid);
                    } else {
                        WatchTrackingService.resumeWatchSession();
                    }
                } else {
                    WatchTrackingService.pauseWatchSession();
                }
            }
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

        // Race-condition fix: the player auto-starts (p.play() in useVideoPlayer constructor)
        // before this useEffect runs, so the playingChange event fires before the listener
        // is attached. If the player is already playing when we attach, start the session now.
        const uid = userIdRef.current;
        if (uid && player.playing && !watchSessionStartedRef.current) {
            watchSessionStartedRef.current = true;
            WatchTrackingService.startSession(uid);
            console.log('[Video] started session (post-mount catch-up)');
        }

        // Fallback poll: on web, timeUpdate events are unreliable so we read
        // player.currentTime directly every 250 ms while playing.
        let pollId: ReturnType<typeof setInterval> | null = null;
        if (Platform.OS === 'web') {
            pollId = setInterval(() => {
                if (isSeekingRef.current) return;
                const posMs = (player.currentTime ?? 0) * 1000;
                const durMs = (player.duration ?? 0) * 1000;
                if (posMs <= 0 && durMs <= 0) return;

                // Web catch-up: if player is playing but session wasn't started yet
                // (playingChange listener may not have fired), start session now.
                const pollUid = userIdRef.current;
                if (pollUid && player.playing && !watchSessionStartedRef.current) {
                    watchSessionStartedRef.current = true;
                    WatchTrackingService.startSession(pollUid);
                    console.log('[Video] started session (web poll catch-up)');
                }

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
            }, 250);
        }

        return () => {
            statusSub.remove();
            playingSub.remove();
            timeSub.remove();
            endSub.remove();
            if (pollId !== null) clearInterval(pollId);
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
    const [playbackError, setPlaybackError] = useState<string | null>(null);
    const [isBuffering, setIsBuffering] = useState(false);

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

    // ── Double-tap to seek (YouTube style) ──────────────────────────────────────
    // Tap left half twice → −10s, right half twice → +10s. A single tap (after a
    // short delay to rule out a double) toggles the controls.
    const stageWidthRef = useRef(0);
    const lastTapRef = useRef(0);
    const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const skipHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [skipHint, setSkipHint] = useState<'back' | 'forward' | null>(null);

    const flashSkipHint = (dir: 'back' | 'forward') => {
        setSkipHint(dir);
        if (skipHintTimer.current) clearTimeout(skipHintTimer.current);
        skipHintTimer.current = setTimeout(() => setSkipHint(null), 550);
    };

    const handleStageTap = (e: GestureResponderEvent) => {
        const x = e.nativeEvent.locationX;
        const now = Date.now();
        if (now - lastTapRef.current < 280) {
            // Second tap → double-tap seek.
            if (singleTapTimer.current) { clearTimeout(singleTapTimer.current); singleTapTimer.current = null; }
            lastTapRef.current = 0;
            if (x < stageWidthRef.current / 2) {
                skipBack();
                flashSkipHint('back');
            } else {
                skipForward();
                flashSkipHint('forward');
            }
            return;
        }
        // First tap → wait briefly; if no second tap arrives, just toggle controls.
        lastTapRef.current = now;
        if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
        singleTapTimer.current = setTimeout(() => {
            showControls();
            singleTapTimer.current = null;
        }, 280);
    };

    useEffect(() => () => {
        if (singleTapTimer.current) clearTimeout(singleTapTimer.current);
        if (skipHintTimer.current) clearTimeout(skipHintTimer.current);
    }, []);

    // ── Fullscreen (YouTube-style) ──────────────────────────────────────────────
    // Web: browser Fullscreen API on the stage element. Native: lock landscape +
    // re-parent the stage into a full-screen Modal (via FullscreenHost).
    const stageRef = useRef<View>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    // Stage size — used to place the watermark on the letterboxed video content
    // (the stage is taller than the 16:9 video, so the top is black bars).
    const [stageLayout, setStageLayout] = useState({ width: 0, height: 0 });

    const enterFullscreen = async () => {
        if (Platform.OS === 'web') {
            try {
                const node: any = stageRef.current;
                if (node?.requestFullscreen) {
                    await node.requestFullscreen();
                    try { await (window as any).screen?.orientation?.lock?.('landscape'); } catch { /* desktop rejects */ }
                    setIsFullscreen(true);
                    showControls();
                    return;
                }
                // iOS Safari/PWA: no element Fullscreen API — use the native <video>.
                const video: any = node?.querySelector?.('video');
                if (video?.webkitEnterFullscreen) {
                    video.webkitEnterFullscreen();
                    return; // iOS shows its own player UI; no custom overlay possible
                }
            } catch { /* ignore */ }
            setIsFullscreen(true);
        } else {
            try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); } catch { /* ignore */ }
            setIsFullscreen(true);
        }
        showControls();
    };

    const exitFullscreen = async () => {
        if (Platform.OS === 'web') {
            try { if ((document as any).fullscreenElement) await (document as any).exitFullscreen(); } catch { /* ignore */ }
            try { (window as any).screen?.orientation?.unlock?.(); } catch { /* ignore */ }
            setIsFullscreen(false);
        } else {
            try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); } catch { /* ignore */ }
            setIsFullscreen(false);
        }
    };

    const toggleFullscreen = () => { (isFullscreen ? exitFullscreen() : enterFullscreen()); };

    // Sync state when the user exits via Esc / browser UI; restore orientation.
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const onFsChange = () => {
            const fs = !!(document as any).fullscreenElement;
            setIsFullscreen(fs);
            if (!fs) { try { (window as any).screen?.orientation?.unlock?.(); } catch { /* ignore */ } }
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);

    // Always restore portrait on unmount (native).
    useEffect(() => () => {
        if (Platform.OS !== 'web') {
            ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
        }
    }, []);

    useEffect(() => { onFullscreenChange?.(isFullscreen); }, [isFullscreen]);

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
        // Let the parent intercept a play intent (e.g. workout-mode countdown).
        // Returning false suppresses playback — the video is NOT started here,
        // avoiding the flash/stutter of play-then-pause.
        if (onPlayRequest && onPlayRequest() === false) {
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
                    {headerTitleSuffix}
                </View>

                <View style={styles.headerActions}>
                    {actionLabel ? (
                        <TouchableOpacity
                            style={[styles.actionBtn, actionVariant === 'danger' && styles.actionBtnDanger]}
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

            <FullscreenHost active={Platform.OS !== 'web' && isFullscreen} onRequestClose={exitFullscreen}>
            <TouchableWithoutFeedback onPress={showCastOverlay ? undefined : handleStageTap}>
                <View
                    ref={stageRef}
                    style={[styles.videoStage, isFullscreen && styles.videoStageFullscreen]}
                    onLayout={(e) => {
                        stageWidthRef.current = e.nativeEvent.layout.width;
                        setStageLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
                    }}
                >

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
                            {playbackError ? (
                                <View style={styles.errorOverlay}>
                                    {playbackError === 'audio_interrupted' ? (
                                        <>
                                            <Text style={styles.errorText}>🔇 Audio paused</Text>
                                            <Text style={styles.errorSubtext}>
                                                Audio was interrupted by another app. Tap Resume to continue.
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.retryBtn}
                                                onPress={() => {
                                                    setPlaybackError(null);
                                                    player.play();
                                                }}
                                            >
                                                <Text style={styles.retryBtnText}>Resume</Text>
                                            </TouchableOpacity>
                                        </>
                                    ) : (playbackError.toLowerCase().includes('format') ||
                                          playbackError.toLowerCase().includes('notsupported') ||
                                          playbackError.toLowerCase().includes('not supported') ||
                                          playbackError.toLowerCase().includes('source')) ? (
                                        <>
                                            <Text style={styles.errorText}>Video format unsupported</Text>
                                            <Text style={styles.errorSubtext}>
                                                Please re-encode video to H264/AAC MP4
                                            </Text>
                                        </>
                                    ) : (
                                        <>
                                            <Text style={styles.errorText}>⚠️ Failed to load video</Text>
                                            <Text style={styles.errorSubtext}>{playbackError}</Text>
                                            <TouchableOpacity
                                                style={styles.retryBtn}
                                                onPress={() => {
                                                    setPlaybackError(null);
                                                    setIsBuffering(true);
                                                    player.replace({ uri: videoUri });
                                                }}
                                            >
                                                <Text style={styles.retryBtnText}>Retry</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
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
                                    {(!isLoaded || isBuffering) && (
                                        <View style={styles.loadingOverlay}>
                                            <ActivityIndicator size="large" color="#F25912" />
                                            <Text style={styles.loadingText}>Buffering video...</Text>
                                        </View>
                                    )}
                                </>
                            )}

                            <Animated.View
                                pointerEvents={controlsVisible ? 'box-none' : 'none'}
                                style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
                            >
                                <View style={styles.controlsRow}>
                                    <TouchableOpacity onPress={togglePlay} style={styles.playBtn}>
                                        {isPlaying ? (
                                            <Pause color="white" fill="white" size={26} />
                                        ) : (
                                            <Play color="white" fill="white" size={26} style={styles.playIcon} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </Animated.View>

                            {/* Double-tap seek hint */}
                            {skipHint === 'back' && (
                                <View style={[styles.skipHint, styles.skipHintLeft]} pointerEvents="none">
                                    <RotateCcw color="white" size={22} />
                                    <Text style={styles.skipHintText}>10s</Text>
                                </View>
                            )}
                            {skipHint === 'forward' && (
                                <View style={[styles.skipHint, styles.skipHintRight]} pointerEvents="none">
                                    <RotateCw color="white" size={22} />
                                    <Text style={styles.skipHintText}>10s</Text>
                                </View>
                            )}

                            {/* YouTube-style time: current / total, grouped bottom-left */}
                            <View style={styles.timeRail}>
                                <Text style={styles.timeCurrent}>
                                    {formatTime(isSeeking ? seekProgress * duration : position)}
                                </Text>
                                <Text style={styles.timeSep}> / </Text>
                                <Text style={styles.timeTotal}>{formatTime(duration)}</Text>
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

                            {/* Prev/next nav — shown in normal AND fullscreen */}
                            {videoNavExtras && (
                                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                                    {videoNavExtras}
                                </View>
                            )}

                            {/* Caller-supplied fullscreen-only overlay (workout timer) */}
                            {isFullscreen && fullscreenExtras && (
                                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                                    {fullscreenExtras}
                                </View>
                            )}

                            {/* RAW1 watermark — small & faint, pinned to the top-left of
                                the actual (letterboxed) video, not the black stage bars.
                                Pushed down when the Prev/Next nav occupies the top row. */}
                            <View
                                style={[styles.logoWatermark, {
                                    top: 8 + (videoNavExtras ? 34 : 0) + (isFullscreen ? 0 : Math.max(0,
                                        (stageLayout.height - stageLayout.width * 9 / 16) / 2)),
                                }]}
                                pointerEvents="none"
                            >
                                <Raw1Logo fontSize={13} transparent />
                            </View>

                            {/* Cast button — bottom-right, just left of fullscreen */}
                            <View style={styles.castBtn} pointerEvents="box-none">
                                <CastButton tintColor="white" size={16} />
                            </View>

                            {/* Fullscreen toggle (YouTube-style, bottom-right) */}
                            <TouchableOpacity
                                style={styles.fullscreenBtn}
                                onPress={toggleFullscreen}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                {isFullscreen
                                    ? <Minimize color="white" size={20} />
                                    : <Maximize color="white" size={20} />}
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </TouchableWithoutFeedback>
            </FullscreenHost>

            {/* ── Footer: remote controls when casting ── */}
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
            ) : footerText ? (
                <View style={styles.footerRow}>
                    <Text style={styles.footerText}>{footerText}</Text>
                </View>
            ) : null}
        </SafeAreaView>
    );
});

export const SharedVideoPlayer = React.memo(SharedVideoPlayerInner);

/**
 * "Workout with Friend" + LIVE viewer pill. Rendered by the caller (below the
 * video title) rather than inside the player footer.
 */
export function InviteFooter({ cta }: { cta: InviteCta }) {
    return (
        <View style={styles.footerStack}>
            {/* ── Workout Together (primary) ── */}
            <TouchableOpacity
                style={styles.footerBtnWorkoutTogether}
                onPress={cta.onWorkoutTogether}
                activeOpacity={0.85}
            >
                <CalendarClock color="#fff" size={14} />
                <Text style={styles.footerBtnWorkoutTogetherText}>Workout with Friend</Text>
            </TouchableOpacity>

            {/* ── LIVE viewer pill (replaces "Start Now") ── */}
            <TouchableOpacity
                style={styles.footerBtnLive}
                onPress={cta.onViewersPress ?? cta.onStartNow}
                activeOpacity={0.8}
            >
                {/* Stacked avatars for other viewers */}
                {(cta.viewers ?? []).filter(v => v.uid !== cta.currentUid).length > 0 && (
                    <StackedAvatars
                        viewers={cta.viewers ?? []}
                        currentUid={cta.currentUid}
                        maxVisible={3}
                        size={16}
                    />
                )}
                <PulsingDot size={5} color="#22C55E" />
                {/* LIVE + count always together; self counts as 1 */}
                <Text style={styles.footerBtnLiveLabel}>
                    {'LIVE '}
                    <Text style={styles.footerBtnLiveCount}>
                        {Math.max(1, (cta.viewerCount ?? 0) + 1)}
                    </Text>
                </Text>
            </TouchableOpacity>
        </View>
    );
}

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
        backgroundColor: '#F25912',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    actionBtnDanger: {
        backgroundColor: '#ff4444',
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
        justifyContent: 'center',
    },
    mainControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
    },
    controlBtn: {
        padding: 8,
    },
    // YouTube-style: translucent rounded rectangle with a filled white triangle.
    playBtn: {
        width: 70,
        height: 48,
        borderRadius: 12,
        backgroundColor: 'rgba(20,20,20,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playIcon: {
        marginLeft: 3,
    },
    timeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
        width: 40,
        textAlign: 'center',
    },
    // Double-tap seek hint badges
    skipHint: {
        position: 'absolute',
        top: '50%',
        marginTop: -34,
        width: 96,
        height: 68,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    skipHintLeft: { left: '12%' },
    skipHintRight: { right: '12%' },
    skipHintText: { color: 'white', fontSize: 13, fontWeight: '700' },
    // YouTube-style grouped time: "0:01 / 0:18"
    timeCurrent: {
        color: 'white',
        fontSize: 12,
        fontWeight: '700',
    },
    timeSep: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontWeight: '600',
    },
    timeTotal: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '600',
    },
    videoStage: {
        flex: 1,
        width: '100%',
        backgroundColor: '#000',
        position: 'relative',
        overflow: 'hidden',
    },
    videoStageFullscreen: {
        // Web: the Fullscreen API sizes the element to the screen; ensure it fills.
        ...(Platform.OS === 'web' ? { width: '100%', height: '100%' } : {}),
    },
    fsModalRoot: {
        flex: 1,
        backgroundColor: '#000',
    },
    fullscreenBtn: {
        position: 'absolute',
        right: 10,
        bottom: 18,
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoWatermark: {
        position: 'absolute',
        top: 10,
        left: 12,
        opacity: 0.45,
    },
    castBtn: {
        position: 'absolute',
        right: 50,
        bottom: 18,
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // ── Cast placeholder ───────────────────────────────────────────
    castPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#EEEEF2',
    },
    castPlaceholderTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 8,
    },
    castPlaceholderDevice: {
        color: 'rgba(33,24,50,0.45)',
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
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
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
        justifyContent: 'flex-start',
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
        backgroundColor: '#F25912',
        borderRadius: 2,
    },
    seekThumb: {
        position: 'absolute',
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#F25912',
        marginLeft: -6,
        top: 4,
    },
    // ── Footer ─────────────────────────────────────────────────────
    footerStack: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        flexWrap: 'wrap',
        gap: 8,
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
        color: 'rgba(33,24,50,0.55)',
        fontSize: 13,
        textTransform: 'uppercase',
        fontStyle: 'italic',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
    // Legacy — kept so any residual refs compile; superseded by footerBtnWorkoutTogether
    footerBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 10,
        paddingHorizontal: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(242,89,18,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(242,89,18,0.28)',
    },
    footerBtnText: {
        color: '#F25912',
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
    // ── New unified footer buttons ─────────────────────────────────────────
    footerBtnWorkoutTogether: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 20,
        backgroundColor: '#F25912',
    },
    footerBtnWorkoutTogetherText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
    },
    footerBtnStartNow: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 11,
        paddingHorizontal: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(242,89,18,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(242,89,18,0.28)',
    },
    footerBtnStartNowText: {
        color: '#F25912',
        fontSize: 12,
        fontWeight: '700',
    },
    // ── LIVE viewer pill ──────────────────────────────────────────────────────
    footerBtnLive: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 5,
        paddingHorizontal: 11,
        borderRadius: 20,
        backgroundColor: 'rgba(34,197,94,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.35)',
    },
    footerBtnLiveLabel: {
        color: '#1E9E4A',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    footerBtnLiveCount: {
        color: '#211832',
        fontSize: 11,
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
        backgroundColor: '#F25912',
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
    errorOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        zIndex: 100,
    },
    errorText: {
        color: '#ff4444',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
        textAlign: 'center',
    },
    errorSubtext: {
        color: 'rgba(33,24,50, 0.6)',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
    },
    retryBtn: {
        backgroundColor: '#F25912',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    retryBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99,
    },
    loadingText: {
        color: 'white',
        fontSize: 14,
        marginTop: 12,
        fontWeight: '600',
    },
});
