import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StyleSheet,
    StatusBar,
    TextInput,
    ActivityIndicator,
    Alert,
    ScrollView,
    LayoutAnimation,
    Platform,
    UIManager,
    KeyboardAvoidingView,
    Dimensions,
    Animated,
    Easing,
    PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoInviteModal } from '../components/VideoInviteModal';
import { InviteTypeSelectorModal } from '../components/InviteTypeSelectorModal';
import { ScheduleSessionModal } from '../components/ScheduleSessionModal';
import { SelfScheduleModal } from '../components/SelfScheduleModal';
import { WorkoutTogetherModal } from '../components/WorkoutTogetherModal';
import { SharedVideoPlayer, SharedVideoPlayerRef, InviteFooter } from '../components/SharedVideoPlayer';
import { WorkoutStartModal } from '../components/WorkoutStartModal';
import { VideoModeModal } from '../components/VideoModeModal';
import MuscleVisualizer from '../components/MuscleVisualizer';
import { PurposeSection } from '../components/PurposeSection';
import { WorkoutCompletionModal } from '../components/workout/WorkoutCompletionModal';
import { SquatCountModal } from '../components/workout/SquatCountModal';
import { UserService } from '../services/user.service';
import { ExerciseListTab } from '../components/workout/ExerciseListTab';
import { InviteStrangerModal } from '../components/workout/InviteStrangerModal';
import { StrangerInviteSenderModal } from '../components/StrangerInviteSenderModal';
import { useSocialInvite } from '../hooks/useStrangerInvite';
import { useVideoPlayerNotificationParams } from '../hooks/useVideoPlayerNotificationParams';
import { useMiniPlayer } from '../providers/MiniPlayerContext';
import { getProgramByVideoId } from '../data/preRecordedPrograms';
import { useWorkoutWatchers } from '../hooks/useWorkoutWatchers';
import { useWorkoutSocialHub } from '../hooks/useWorkoutSocialHub';
import { useLibrary } from '../providers/LibraryContext';
import { useFavorites } from '../hooks/useFavorites';
import { useAccess } from '../providers/AccessContext';
import { useUser } from '../providers/UserContext';
import { useAuth } from '../providers/AuthContext';
import { FriendService } from '../services/friend.service';
import { LiveSessionService } from '../services/liveSession.service';
import { StreakService } from '../services/streak.service';
import { recordUniversalWorkoutCompletion, WorkoutSourceType } from '../services/workoutCompletion.service';
import { RewardUnlockModal } from '../components/rewards/RewardUnlockModal';
import { addWorkoutMinutes } from '../services/leaderboard.service';
import { useVideoEngagement } from '../hooks/useVideoEngagement';
import { useVideoGlobalCounts, formatCount } from '../services/videoEngagement.service';
import { useVideoViews, incrementVideoView, formatViews } from '../services/videoViews.service';
import { getSimilarPrograms, RecommendedProgram } from '../services/recommendation.service';
import { useFocusEffect } from '@react-navigation/native';
import { AgoraVoice } from '../services/agora/AgoraVoice';
import { fetchAgoraToken } from '../services/agora/AgoraTokenService';
import { deriveAgoraUid } from '../utils/agoraUid';
import { CoWorkoutCameraTiles } from '../components/CoWorkoutCameraTiles';
import { PlaybackSyncService } from '../services/playbackSync.service';
import { useVideoInteractions } from '../hooks/useVideoInteractions';
import { recordVideoWatch } from '../hooks/useRecentlyWatched';
import { getCueTrack, resolveActiveCue } from '../data/workoutCues';
import { LiveViewersModal } from '../components/LiveViewersModal';
import { TierAvatar } from '../components/profile/TierAvatar';
import Svg, { Circle } from 'react-native-svg';
import { supabase } from '../core/config/supabase';
import { formatDifficulty, difficultyEmoji } from '../core/difficulty';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Engagement action bar ─────────────────────────────────────────────────────

interface EngagementBarProps {
    engagement: ReturnType<typeof useVideoEngagement>;
    isFavorite: boolean;
    totalLikes: number;
    totalDislikes: number;
    onLike: () => void;
    onDislike: () => void;
    onTryIntent: () => void;
    onFavorite: () => void;
    modeType: 'workout' | 'watch';
    onSwitchMode: (mode: 'workout' | 'watch') => void;
    allowInvite?: boolean;
    onInviteFriend?: () => void;
}

// ── Workout / Watch mode toggle — YouTube-style collapsing control ────────────
// Like YouTube's play/pause control: only the *active* segment shows its label;
// the inactive one collapses to an icon-only chip. Switching morphs the widths
// with a layout spring, plus a subtle press-scale bounce on tap.
function ModeSegment({
    mode,
    label,
    icon,
    active,
    onPress,
}: {
    mode: 'workout' | 'watch';
    label: string;
    icon: 'barbell' | 'eye';
    active: boolean;
    onPress: (mode: 'workout' | 'watch') => void;
}) {
    return (
        <TouchableOpacity
            style={[engagementStyles.modeBtn, active && engagementStyles.modeBtnActive]}
            onPress={() => onPress(mode)}
            activeOpacity={0.85}
        >
            <Ionicons
                name={active ? icon : (`${icon}-outline` as const)}
                size={14}
                color={active ? '#fff' : '#7A7C90'}
            />
            {/* Only the selected segment shows its word. */}
            {active && (
                <Text style={[engagementStyles.modeText, engagementStyles.modeTextActive]}>
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );
}

function ModeToggle({
    modeType,
    onSwitchMode,
}: {
    modeType: 'workout' | 'watch';
    onSwitchMode: (mode: 'workout' | 'watch') => void;
}) {
    const scale = useRef(new Animated.Value(1)).current;

    const press = (mode: 'workout' | 'watch') => {
        if (mode === modeType) return;
        // Smoothly morph the segment widths as one collapses and the other expands.
        LayoutAnimation.configureNext(
            LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
        );
        // Quick "pop" like the YouTube control reacting to a tap.
        Animated.sequence([
            Animated.timing(scale, { toValue: 0.92, duration: 70, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
            Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }),
        ]).start();
        onSwitchMode(mode);
    };

    return (
        <Animated.View style={[engagementStyles.modeGroup, { transform: [{ scale }] }]}>
            <ModeSegment mode="workout" label="Workout" icon="barbell" active={modeType === 'workout'} onPress={press} />
            <ModeSegment mode="watch" label="Watch" icon="eye" active={modeType === 'watch'} onPress={press} />
        </Animated.View>
    );
}

function EngagementBar({
    engagement,
    isFavorite,
    totalLikes,
    totalDislikes,
    onLike,
    onDislike,
    onTryIntent,
    onFavorite,
    modeType,
    onSwitchMode,
    allowInvite,
    onInviteFriend,
}: EngagementBarProps) {
    const { state } = engagement;

    const buttons = [
        { key: 'fav', label: isFavorite ? 'Favorited' : 'Favorite', icon: '❤️', active: isFavorite, onPress: onFavorite },
        { key: 'try', label: state.tryIntent ? 'Trying' : 'Try it', icon: '🔥', active: state.tryIntent, onPress: onTryIntent },
        {
            key: 'dislike',
            label: totalDislikes > 0 ? formatCount(totalDislikes) : 'Skip',
            icon: '👎',
            active: state.disliked,
            onPress: onDislike,
        },
    ];

    return (
        <View style={engagementStyles.container}>
            {/* Workout / Watch — pinned to the left */}
            <ModeToggle modeType={modeType} onSwitchMode={onSwitchMode} />

            {/* Invite Friend — sits between the mode toggle and the reaction pills */}
            {allowInvite && !!onInviteFriend && (
                <TouchableOpacity
                    style={engagementStyles.inviteBtn}
                    onPress={onInviteFriend}
                    activeOpacity={0.85}
                >
                    <Ionicons name="person-add-outline" size={14} color="#fff" />
                    <Text style={engagementStyles.inviteText}>Invite Friend</Text>
                </TouchableOpacity>
            )}

            {/* Favorite / Try it / Dislike — hidden in workout mode to keep focus on the timer */}
            {modeType !== 'workout' && (
                <View style={engagementStyles.pillRow}>
                    {buttons.map((btn) => (
                        <TouchableOpacity
                            key={btn.key}
                            style={[engagementStyles.pill, btn.active && engagementStyles.pillActive]}
                            onPress={btn.onPress}
                            activeOpacity={0.7}
                        >
                            <Text style={engagementStyles.pillIcon}>{btn.icon}</Text>
                            {/* Label only appears once active/pressed; otherwise icon-only */}
                            {btn.active && (
                                <Text numberOfLines={1} style={engagementStyles.pillLabel}>
                                    {btn.label}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
}

const engagementStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 10,
        gap: 6,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(33,24,50,0.06)',
        justifyContent: 'space-between',
    },
    pillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.1)',
    },
    pillActive: {
        backgroundColor: 'rgba(242,89,18,0.15)',
        borderColor: '#F25912',
    },
    pillIcon: {
        fontSize: 13,
    },
    pillLabel: {
        // Neutral text — labels are not color-coded for fav / try / dislike.
        color: '#211832',
        fontSize: 12,
        fontWeight: '600',
    },
    modeGroup: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#4C4E78',
        padding: 3,
        gap: 3,
    },
    modeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 17,
    },
    // Only the active segment gets the filled pill + label.
    modeBtnActive: {
        backgroundColor: '#4C4E78',
    },
    modeText: {
        color: '#7A7C90',
        fontSize: 12,
        fontWeight: '600',
    },
    modeTextActive: {
        color: '#fff',
    },
    inviteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#F25912',
    },
    inviteText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
});

const ACCENT = '#F25912';
// Brand indigo — used for non-CTA accents (selected chips, toggle outlines).
// CTA orange (ACCENT) stays reserved for primary-action buttons only.
const INDIGO = '#4C4E78';
const INDIGO_SOFT = 'rgba(76,78,120,0.15)';
const PANEL_BG = '#D8D8E4'; // clearly grey panel (was near-white #F8F8FC)
// Dark surface for the workout-mode timer panel (deep brand indigo).
const PANEL_DARK = '#211832';

const FAQ_ITEMS = [
    {
        question: 'How long should I wear Gripcuff?',
        answer: 'We recommend 20\u201330 minutes per session, 3\u20134 times a week for best results.',
    },
    {
        question: 'Is Gripcuff suitable for beginners?',
        answer: 'Yes! Start with lighter resistance and increase gradually.',
    },
    {
        question: 'How do I clean my Gripcuff?',
        answer: 'Wipe with a damp cloth after each use. Do not submerge in water.',
    },
    {
        question: 'Can I use it during any workout?',
        answer: 'Best for strength and resistance training. Avoid high-impact cardio.',
    },
    {
        question: 'What if I feel discomfort?',
        answer: 'Stop immediately. Consult a professional if discomfort persists.',
    },
];

type Tab = 'social' | 'requirements' | 'faq-qa';

const EQUIPMENT_BY_CATEGORY: Record<string, { equipment: string; description: string }[]> = {
    Gripcuff: [
        { equipment: 'Gripcuff Device', description: 'Adjustable resistance cuff for grip training' },
        { equipment: 'Wrist Wraps', description: 'Optional support for heavy grip sessions' },
    ],
    MuscleGrowth: [
        { equipment: 'Dumbbells', description: 'Adjustable or fixed weight dumbbells' },
        { equipment: 'Barbell & Plates', description: 'Standard or Olympic barbell with weight plates' },
        { equipment: 'Bench', description: 'Flat/incline adjustable bench' },
        { equipment: 'Cable Machine', description: 'For isolation and burnout sets' },
    ],
    Stretching: [
        { equipment: 'Yoga Mat', description: 'Non-slip mat for floor stretches' },
        { equipment: 'Resistance Band', description: 'Light band for assisted stretching' },
        { equipment: 'Foam Roller', description: 'For myofascial release and deep stretches' },
    ],
    AthleticPerformance: [
        { equipment: 'Agility Ladder', description: 'For footwork and speed drills' },
        { equipment: 'Plyo Box', description: 'For box jumps and explosive movements' },
        { equipment: 'Resistance Bands', description: 'For sprint resistance and warm-ups' },
        { equipment: 'Cones', description: 'For marking drill patterns' },
    ],
    InjuryRehab: [
        { equipment: 'Resistance Band (Light)', description: 'Low resistance for rehab exercises' },
        { equipment: 'Stability Ball', description: 'For balance and core activation' },
        { equipment: 'Foam Roller', description: 'For soft tissue recovery' },
        { equipment: 'Yoga Mat', description: 'For floor-based rehab movements' },
    ],
    default: [
        { equipment: 'Comfortable Clothing', description: 'Wear clothes that allow full range of motion' },
        { equipment: 'Water Bottle', description: 'Stay hydrated throughout the workout' },
        { equipment: 'Towel', description: 'For wiping down equipment and sweat' },
    ],
};

// Estimated time to set up / assemble the equipment before starting, keyed by
// category. Shown in the requirements tab so users can prep their space ahead.
const SETUP_TIME_BY_CATEGORY: Record<string, { time: string; note: string }> = {
    Gripcuff: { time: '1–2 min', note: 'Strap on the cuff and dial in your resistance.' },
    MuscleGrowth: { time: '8–10 min', note: 'Load the barbell, adjust the bench and set your cable pins.' },
    Stretching: { time: '1 min', note: 'Roll out a mat and grab a band — almost no setup.' },
    AthleticPerformance: { time: '5–7 min', note: 'Lay out the agility ladder, set the plyo box and space your cones.' },
    InjuryRehab: { time: '2–3 min', note: 'Keep a light band, stability ball and mat within reach.' },
    default: { time: '2–3 min', note: 'Get your gear, towel and water within reach before you start.' },
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const WebYouTubePlayer = ({ videoId }: { videoId: string }) => {
    const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;

    if (Platform.OS === 'web') {
        return (
            <View style={{ width: '100%', height: 220 }}>
                <iframe
                    width="100%"
                    height="220"
                    src={embedUrl}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={({ border: 'none' } as any)}
                />
            </View>
        );
    }

    // Native fallback
    return (
        <View style={{ width: SCREEN_WIDTH, height: 220, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#666' }}>YouTube not available on this platform</Text>
        </View>
    );
};

function VideoPlayerScreen({ route, navigation }: any) {
    const { allVideos, gripCuffVideos, trainerVideos, bodyPartVideos } = useLibrary();
    const { hasAccess, loading: accessLoading, showPaywall } = useAccess();
    const { profile } = useUser();
    const { supabaseUserId, email } = useAuth();
    const { openMini, closeMini } = useMiniPlayer();

    const [showWorkoutTogetherModal, setShowWorkoutTogetherModal] = useState(false);
    const [showViewersModal, setShowViewersModal] = useState(false);
    // Requirements tab: collapsed by default (only Experience level shows); the
    // rest of the sections reveal on "More details".
    const [requirementsExpanded, setRequirementsExpanded] = useState(false);
    // Legacy states kept to avoid breaking residual refs; no longer opened from primary flow
    const [showInviteTypeModal, setShowInviteTypeModal] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [showSelfScheduleModal, setShowSelfScheduleModal] = useState(false);
    const [showSocialModal, setShowSocialModal] = useState(false);
    const { state: socialInviteState, sendInvite: sendSocialInvite, cancel: cancelSocialInvite, reset: resetSocialInvite } = useSocialInvite(supabaseUserId ?? null);
    const [socialTargetName, setSocialTargetName] = useState('Someone');
    const [friendUids, setFriendUids] = useState<string[]>([]);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [rewardModal, setRewardModal] = useState<{ badgeIds: string[]; credits: number } | null>(null);
    const [showWorkoutStartModal, setShowWorkoutStartModal] = useState(false);
    const [currentPositionMs, setCurrentPositionMs] = useState(0);
    const sharedPlayerRef = useRef<SharedVideoPlayerRef>(null);

    // ── Pre-start "Workout or Watch?" chooser ─────────────────────────────────
    // Shown on entry for normal video launches. Skipped when the mode is already
    // decided by the flow (auto-start workout, co-workout, or synced session).
    const [showModeModal, setShowModeModal] = useState<boolean>(
        () => !(
            route?.params?.autoStartWorkout === true ||
            !!route?.params?.coWorkoutChannel ||
            !!route?.params?.sessionId ||
            // initialMode is carried when navigating prev/next between videos —
            // the user already chose a mode, so don't re-prompt.
            !!route?.params?.initialMode
        ),
    );

    // ── Realtime playback sync ────────────────────────────────────────────────
    // sessionId + hostUserId are passed from UpcomingSessionsScreen.
    // If absent (solo workout), all sync code is a no-op.
    const syncSessionId: string | null = route?.params?.sessionId ?? null;
    const syncHostUserId: string | null = route?.params?.hostUserId ?? null;
    const isHost = !!(syncHostUserId && syncHostUserId === supabaseUserId);

    // ── Co-workout video call ─────────────────────────────────────────────────
    // coWorkoutChannel is set only when navigating from a scheduled session.
    // remoteUids is populated by Agora onUserJoined / onUserOffline callbacks.
    const friendName: string | undefined = route?.params?.friendName ?? undefined;
    const [remoteUids, setRemoteUids] = useState<number[]>([]);
    const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
    // Tracks last observed position for seek-jump detection (host) and drift correction (guest)
    const lastSyncPositionMsRef = useRef<number>(0);
    // ── End sync refs ─────────────────────────────────────────────────────────

    const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastPaywallBucketRef = useRef(0);
    const watchStartRef = useRef<number | null>(null);
    // Tracks the furthest video position seen — more accurate than wall clock for watch time
    const maxWatchedMsRef = useRef(0);
    const elapsedSecondsRef = useRef(0);
    const completionFiredRef = useRef(false);
    const durationMsRef = useRef(0);          // populated by onDurationChange
    const handleVideoEndRef = useRef<() => Promise<void>>(async () => {});
    // Independent completion timer refs — avoids stale closures in setInterval
    const isVideoPlayingRef = useRef(false);  // true once video has started playing
    const tickElapsedRef = useRef(0);         // wall-clock seconds counted while playing
    // Updated every render so the timer interval always reads current route/profile values
    const completionParamsRef = useRef<{
        uid: string | null;
        workoutId: string;
        workoutTitle: string;
        isChallengeVideo: boolean;
        category: string | undefined;
        timezone: string | undefined;
    } | null>(null);
    const isChallengeVideo = route?.params?.isChallengeVideo ?? false;
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState('');
    const [commentType, setCommentType] = useState<'question' | 'feedback' | null>(null);
    const [commentsLoading, setCommentsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>(
        route?.params?.allowInvite === true ? 'social' : 'requirements'
    );
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const { isFavorite, toggleFavorite } = useFavorites();

    // ── Workout / Watch mode ──────────────────────────────────────────────────
    const [modeType, setModeType] = useState<'watch' | 'workout'>(
        route?.params?.initialMode === 'workout' ? 'workout' : 'watch',
    );
    const [timerState, setTimerState] = useState<'idle' | 'countdown' | 'running'>('idle');
    // Refs updated every render so callbacks can read current values without stale closures
    const modeTypeRef = useRef<'watch' | 'workout'>('watch');
    const timerStateRef = useRef<'idle' | 'countdown' | 'running'>('idle');
    const startWorkoutCallbackRef = useRef<() => void>(() => {});
    // Refs so the (earlier-defined) YouTube message effect can drive the timer
    const startWorkoutTickRef = useRef<() => void>(() => {});
    const pauseWorkoutTickRef = useRef<() => void>(() => {});
    modeTypeRef.current = modeType;
    timerStateRef.current = timerState;
    const [countdownPhase, setCountdownPhase] = useState<'Ready' | 'Steady' | 'Go' | null>(null);
    const [workoutElapsed, setWorkoutElapsed] = useState(0);
    // True while an active workout's timer is paused because the video is paused
    const [workoutPaused, setWorkoutPaused] = useState(false);
    const workoutTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const unflushedWorkoutSecsRef = useRef(0);

    useEffect(() => {
        return () => {
            if (workoutTimerRef.current) clearInterval(workoutTimerRef.current);
            countdownTimeoutsRef.current.forEach(t => clearTimeout(t));
            // Flush any remaining workout seconds on unmount
            if (unflushedWorkoutSecsRef.current > 0 && supabaseUserId) {
                supabase.rpc('increment_workout_time', {
                    p_user_id: supabaseUserId,
                    p_seconds: unflushedWorkoutSecsRef.current,
                }).then(null, () => {});
            }
        };
    // supabaseUserId is stable for screen lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Cleanup completion timer on unmount
    useEffect(() => {
        return () => {
            if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
        };
    }, []);

    // ── Independent 1-second completion timer ────────────────────────────────
    // Reads only refs — no stale closure risk. Starts counting once video is
    // playing (isVideoPlayingRef = true). At 30 s fires completion directly,
    // bypassing handleVideoEnd so there is no intermediate callback chain.
    useEffect(() => {
        console.log('[Timer] tick timer installed');
        const id = setInterval(() => {
            console.log('[Playback Tick]', {
                elapsedSeconds: tickElapsedRef.current,
                isPlaying: isVideoPlayingRef.current,
                completionFired: completionFiredRef.current,
            });

            if (!isVideoPlayingRef.current) return;

            tickElapsedRef.current += 1;
            const newElapsed = tickElapsedRef.current;
            // Keep elapsedSecondsRef in sync for anything else that reads it
            if (newElapsed > elapsedSecondsRef.current) elapsedSecondsRef.current = newElapsed;

            console.log('[Elapsed]', newElapsed);

            if (completionFiredRef.current) return;
            if (newElapsed < 30) return;

            // 30 seconds of actual watch time — fire completion
            completionFiredRef.current = true;
            const params = completionParamsRef.current;
            if (!params?.uid) {
                console.error('[Completion Triggered] no uid available, resetting flag');
                completionFiredRef.current = false;
                return;
            }

            console.log('[Completion Triggered]', { currentSeconds: newElapsed, uid: params.uid });

            const srcType: WorkoutSourceType = params.isChallengeVideo
                ? 'daily_challenge'
                : params.category === 'Gripcuff'
                    ? 'gripcuff'
                    : 'workout_program';

            const watchedMins = Math.max(1, Math.round(newElapsed / 60));

            recordUniversalWorkoutCompletion(params.uid, {
                workoutId: params.workoutId,
                workoutTitle: params.workoutTitle,
                sourceType: srcType,
                category: params.category,
                watchMinutes: watchedMins,
                user: params.timezone ? { timezone: params.timezone } : undefined,
            })
            .then(result => {
                console.log('[Completion Success]', {
                    newStreak: result.newStreak,
                    counted: result.counted,
                    todayKey: result.todayKey,
                });
            })
            .catch(e => {
                console.error('[Completion Failed]', e?.message ?? e);
                completionFiredRef.current = false;
            });
        }, 1000);

        return () => {
            console.log('[Timer] tick timer cleared');
            clearInterval(id);
        };
    }, []); // mount/unmount only — all values read from refs

    // Handle workout start modal from notification params
    const notificationParams = useVideoPlayerNotificationParams();
    useEffect(() => {
        if (notificationParams?.fromNotification && notificationParams?.workoutId) {
            setShowWorkoutStartModal(true);
        }
    }, [notificationParams?.fromNotification, notificationParams?.workoutId]);

    // Report watched minutes to leaderboard on unmount.
    // SharedVideoPlayer handles per-second tracking + Supabase flush automatically.
    useEffect(() => {
        watchStartRef.current = Date.now();
        return () => {
            const uid = supabaseUserId;
            if (!uid) return;
            const videoMinutes = maxWatchedMsRef.current > 0
                ? Math.round(maxWatchedMsRef.current / 60000)
                : Math.floor((Date.now() - (watchStartRef.current ?? Date.now())) / 60000);
            if (videoMinutes > 0) {
                addWorkoutMinutes(uid, videoMinutes).catch(() => {});
            }
        };
    }, []);

    // One-time friend UID fetch so the scheduled section can show Friend badge / Join button
    useEffect(() => {
        if (!supabaseUserId) return;
        FriendService.getFriendUids(supabaseUserId).then(setFriendUids).catch(() => {});
    }, [supabaseUserId]);

    const handleJoinScheduled = async (targetUser: { uid: string; displayName: string }) => {
        if (!supabaseUserId) return;
        const vid = requestedVideoId ?? videoId;
        const myName =
            profile?.fullName ?? profile?.username ?? 'Me';
        const sessionId = `premade_${targetUser.uid}_${vid}`;
        try {
            await LiveSessionService.requestToJoin(sessionId, {
                uid: supabaseUserId,
                name: myName,
                avatarUrl: (profile as any)?.profileImageUrl ?? null,
            });
            setShowSocialModal(false);
            navigation.navigate('SyncedVideoPlayer', {
                sessionId,
                videoId: vid,
                videoTitle: title,
                friendName: targetUser.displayName,
            });
        } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Could not join session');
        }
    };

    const handlePositionChange = useCallback((posMs: number) => {
        setCurrentPositionMs(posMs);
        currentPositionRef.current = posMs;
        // Note: lastSyncPositionMsRef is updated by the playback-sync useEffect (not here)
        // so the seek-detection delta calculation stays accurate across renders.
        if (posMs > maxWatchedMsRef.current) maxWatchedMsRef.current = posMs;
        elapsedSecondsRef.current = Math.floor(posMs / 1000);

        // Signal to the independent tick timer that video is actively playing
        if (posMs > 0 && !isVideoPlayingRef.current) {
            console.log('[Timer] video playing — position update received, elapsed will start counting');
            isVideoPlayingRef.current = true;
        }

        // 80% threshold — fires via handleVideoEnd (which has dedup guard)
        const durMs = durationMsRef.current;
        const pct = durMs > 0 ? maxWatchedMsRef.current / durMs : 0;
        if (!completionFiredRef.current && durMs > 0 && pct >= 0.8) {
            console.log('[Completion Triggered] 80% threshold reached:', (pct * 100).toFixed(1) + '%');
            handleVideoEndRef.current().catch(() => {});
        }

        // Paywall preview: pause once at 5 s for users without access.
        // Guards:
        //   - accessLoading: skip if AccessContext hasn't finished the boot DB read yet
        //     (avoids false-positive pause for paid users whose profile is still loading)
        //   - lastPaywallBucketRef === 0: fire only ONCE per session; the bucket
        //     approach previously re-fired every 5 s (at 10 s, 15 s, etc.)
        if (!accessLoading && !hasAccess) {
            if (posMs >= 5000 && lastPaywallBucketRef.current === 0) {
                lastPaywallBucketRef.current = 1; // mark shown — won't fire again this session
                sharedPlayerRef.current?.pauseVideo();
                showPaywall();
            }
        } else if (hasAccess) {
            lastPaywallBucketRef.current = 0;
        }
    }, [hasAccess, accessLoading, showPaywall]);

    useEffect(() => {
        if (!hasAccess) return;
        // Access just became true (paid, or boot-sync confirmed existing subscription).
        // If we had paused the video for the paywall, resume it now.
        if (lastPaywallBucketRef.current > 0) {
            sharedPlayerRef.current?.resumeVideo();
        }
        lastPaywallBucketRef.current = 0; // reset so the one-shot guard is clean
    }, [hasAccess]);

    useEffect(() => {
        if (socialInviteState.phase === 'accepted') {
            const { sessionId, videoId: sVideoId, videoTitle } = socialInviteState;
            resetSocialInvite();
            navigation.navigate('SyncedVideoPlayer', {
                sessionId,
                videoId: sVideoId,
                videoTitle,
                friendName: socialTargetName,
            });
        }
    }, [socialInviteState.phase]);

    const triggerCompletionCheckRef = useRef<() => void>(() => {});

    const triggerCompletionCheck = useCallback(() => {
        if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
        completionTimerRef.current = setTimeout(() => {
            setShowCompletionModal(true);
            sharedPlayerRef.current?.pauseVideo();
        }, 2000);
    }, []);
    triggerCompletionCheckRef.current = triggerCompletionCheck;

    const handleVideoEnd = async () => {
        const uid = supabaseUserId;
        console.log('[Video] handleVideoEnd called', {
            uid,
            videoId,
            isChallengeVideo,
            completionAlreadyFired: completionFiredRef.current,
            elapsedSec: elapsedSecondsRef.current,
        });
        if (!uid || !videoId) {
            console.warn('[Completion] handleVideoEnd: missing uid or videoId', { uid, videoId });
            return;
        }
        if (completionFiredRef.current) {
            console.log('[Completion] Already recorded, skipping duplicate call');
            return;
        }

        const elapsed = elapsedSecondsRef.current;

        // 5 seconds minimum (was 30s — too strict for testing and short clips)
        const minElapsedSecs = isChallengeVideo ? 0 : 5;
        if (elapsed < minElapsedSecs) {
            console.log('[Completion] Under', minElapsedSecs, 's minimum (got', elapsed, 's) — not recording');
            return;
        }

        completionFiredRef.current = true;

        // Universal completion pipeline — handles dedup, watch history, streak, credits.
        try {
            const watchedMinutes = Math.max(1, Math.round(maxWatchedMsRef.current / 60000));
            const category = sourceVideo?.category as string | undefined;
            const sourceType: WorkoutSourceType = isChallengeVideo
                ? 'daily_challenge'
                : category === 'Gripcuff'
                    ? 'gripcuff'
                    : 'workout_program';

            console.log('[Completion] calling markWorkoutComplete', { uid, watchedMinutes, sourceType, videoId });
            const result = await recordUniversalWorkoutCompletion(uid, {
                workoutId: requestedVideoId ?? videoId,
                workoutTitle: title,
                sourceType,
                category,
                watchMinutes: watchedMinutes,
                user: profile ? { timezone: (profile as any).timezone } : undefined,
            });
            console.log('[Completion] recorded — todayKey:', result.todayKey,
                'streak:', result.newStreak, 'credits:', result.creditsAwarded,
                'counted:', result.counted, 'dupePrevented:', result.duplicatePrevented);
            if (result.milestonesHit.length > 0) {
                setRewardModal({ badgeIds: result.milestonesHit, credits: result.creditsAwarded });
            }
        } catch (e: any) {
            console.error('[Completion] recordUniversalWorkoutCompletion failed:', e?.message ?? e);
            completionFiredRef.current = false;
            return;
        }

    };

    handleVideoEndRef.current = handleVideoEnd;

    const handleCompletionDone = async () => {
        setShowCompletionModal(false);
        await handleVideoEndRef.current();
        navigation.goBack();
    };

    const handleCompletionKeepGoing = () => {
        setShowCompletionModal(false);
        sharedPlayerRef.current?.resumeVideo();
    };

    // Shrink video height when scrolling down in tab content.
    // videoScrollY tracks the scroll position 1:1 (fed by the scroll event).
    // smoothVideoScrollY eases toward it, so the video resizes with a soft,
    // animated motion that settles after the finger stops — instead of snapping
    // crisply to every scroll frame. The wider input range (0→120) also makes
    // the collapse more gradual.
    const videoScrollY = useRef(new Animated.Value(0)).current;
    const smoothVideoScrollY = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const id = videoScrollY.addListener(({ value }) => {
            Animated.timing(smoothVideoScrollY, {
                toValue: value,
                duration: 220,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false,
            }).start();
        });
        return () => videoScrollY.removeListener(id);
    }, [videoScrollY, smoothVideoScrollY]);
    const videoHeight = smoothVideoScrollY.interpolate({
        inputRange: [0, 120],
        outputRange: [SCREEN_HEIGHT * 0.42, 160],
        extrapolate: 'clamp',
    });
    // Tracks whether the panel has been swiped up (scrolled) to read it. While
    // revealed it stays at full colour even if the video keeps playing.
    const panelRevealedRef = useRef(false);
    const panelScrollYRef = useRef(0);
    const reWashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // After interaction stops, let the wash return — but only when the user is at
    // the top (not mid-read) and the video is still playing.
    const scheduleReWash = useCallback(() => {
        if (reWashTimer.current) clearTimeout(reWashTimer.current);
        reWashTimer.current = setTimeout(() => {
            if (!isVideoPlayingRef.current || panelScrollYRef.current > 8) return;
            panelRevealedRef.current = false;
            Animated.timing(panelDimAnim, { toValue: 0.4, duration: 400, useNativeDriver: false }).start();
        }, 2600);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    // Any interaction (scroll-drag or touch) brings the section back to 100% so
    // the text is readable; each interaction also resets the re-wash timer.
    const revealPanel = useCallback(() => {
        if (!panelRevealedRef.current) {
            panelRevealedRef.current = true;
            Animated.timing(panelDimAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
        }
        scheduleReWash();
    }, [scheduleReWash]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => () => { if (reWashTimer.current) clearTimeout(reWashTimer.current); }, []);
    const handleTabScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { y: videoScrollY } } }],
        {
            useNativeDriver: false,
            listener: (e: any) => {
                const y = e?.nativeEvent?.contentOffset?.y ?? 0;
                panelScrollYRef.current = y;
                if (y > 24 && !panelRevealedRef.current) {
                    // Swiped up → bring the section back to its full colour.
                    panelRevealedRef.current = true;
                    if (reWashTimer.current) clearTimeout(reWashTimer.current);
                    Animated.timing(panelDimAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
                } else if (y <= 4 && panelRevealedRef.current) {
                    // Back at the top → re-wash if the video is still playing.
                    panelRevealedRef.current = false;
                    if (isVideoPlayingRef.current) {
                        Animated.timing(panelDimAnim, { toValue: 0.4, duration: 200, useNativeDriver: false }).start();
                    }
                }
            },
        }
    );
    // Single shared scroll container — the ONE element that scrolls all tab
    // content. Switching tabs resets both the scroll position and the animated
    // video height so every tab starts from a full-size player at the top.
    const sharedScrollRef = useRef<ScrollView>(null);
    const switchTab = useCallback((tab: Tab) => {
        setActiveTab(tab);
        videoScrollY.setValue(0);
        smoothVideoScrollY.setValue(0);
        sharedScrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [videoScrollY, smoothVideoScrollY]);

    // ── Swipe-down-to-dismiss (YouTube-style) ──────────────────────────────────
    // Dragging the video down translates the whole screen with it; releasing past
    // a threshold (or a fast flick) animates it the rest of the way out and pops
    // back to the previous screen. The responder only claims clear *downward*
    // drags that start on the video, so taps / horizontal seeks on the player and
    // vertical scrolling of the content below still work.
    const dismissDragY = useRef(new Animated.Value(0)).current;
    // JS driver (not native): we also animate borderRadius, which the native
    // driver can't handle.
    const useNative = false;
    // Drag distance over which the screen fully shrinks into the bottom-right
    // corner (matching where the mini-player docks), YouTube-minimize style.
    const DISMISS_SHRINK = 300;
    const MINI_W = 210;
    const sMin = Math.min(0.62, Math.max(0.34, MINI_W / SCREEN_WIDTH));
    const cornerTX = (SCREEN_WIDTH * (1 - sMin)) / 2 - 12;   // → right edge (12px margin)
    const cornerTY = (SCREEN_HEIGHT * (1 - sMin)) / 2 - 96;  // → bottom (clear tab bar)
    // Live values read by the (once-created) pan responder at gesture time.
    const currentPositionRef = useRef(0);
    const miniHandoffRef = useRef<{ videoUrl?: string; title?: string; params?: any; eligible?: boolean; allowDismiss?: boolean }>({});
    const openMiniRef = useRef<((p: any) => void) | null>(null);
    const dismissPan = useRef(
        PanResponder.create({
            // Web uses a DOM pointer-event handler instead (PanResponder doesn't
            // reliably fire over the <video> element in a touch PWA).
            onMoveShouldSetPanResponder: (_, g) =>
                Platform.OS !== 'web' && miniHandoffRef.current.allowDismiss !== false &&
                g.dy > 14 && g.dy > Math.abs(g.dx) * 1.8,
            onPanResponderMove: (_, g) => { if (g.dy > 0) dismissDragY.setValue(g.dy); },
            onPanResponderRelease: (_, g) => {
                if (g.dy > 130 || g.vy > 0.85) {
                    Animated.timing(dismissDragY, {
                        toValue: DISMISS_SHRINK,
                        duration: 200,
                        easing: Easing.out(Easing.cubic),
                        useNativeDriver: useNative,
                    }).start(() => {
                        // Hand off to the floating mini-player (normal videos only),
                        // then pop this screen so the user lands on the previous one.
                        const h = miniHandoffRef.current;
                        if (h.eligible && h.videoUrl && openMiniRef.current) {
                            openMiniRef.current({
                                videoUrl: h.videoUrl,
                                title: h.title ?? '',
                                positionMs: currentPositionRef.current,
                                expandParams: { ...(h.params ?? {}) },
                            });
                        }
                        navigation.goBack();
                    });
                } else {
                    Animated.spring(dismissDragY, { toValue: 0, bounciness: 2, useNativeDriver: useNative }).start();
                }
            },
            onPanResponderTerminate: () => {
                Animated.spring(dismissDragY, { toValue: 0, useNativeDriver: useNative }).start();
            },
        })
    ).current;
    const dismissScale = dismissDragY.interpolate({
        inputRange: [0, DISMISS_SHRINK], outputRange: [1, sMin], extrapolate: 'clamp',
    });
    const dismissTranslateX = dismissDragY.interpolate({
        inputRange: [0, DISMISS_SHRINK], outputRange: [0, cornerTX], extrapolate: 'clamp',
    });
    const dismissTranslateY = dismissDragY.interpolate({
        inputRange: [0, DISMISS_SHRINK], outputRange: [0, cornerTY], extrapolate: 'clamp',
    });
    const dismissRadius = dismissDragY.interpolate({
        inputRange: [0, DISMISS_SHRINK], outputRange: [0, 14], extrapolate: 'clamp',
    });
    const dismissOpacity = dismissDragY.interpolate({
        inputRange: [0, DISMISS_SHRINK], outputRange: [1, 0.92], extrapolate: 'clamp',
    });

    // ── Web/PWA swipe-down handler ─────────────────────────────────────────────
    // PanResponder's responder negotiation is unreliable over the <video> element
    // in a touch browser, and the browser itself may swallow the vertical swipe
    // (scroll / pull-to-refresh). So on web we bind raw pointer events to the
    // player node (which also carries `touchAction: 'none'`) and run the same
    // shrink-to-corner → mini-player hand-off.
    const webGestureRef = useRef<any>(null);
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const node: any = webGestureRef.current;
        if (!node || typeof node.addEventListener !== 'function') return;

        let active = false, claimed = false, startX = 0, startY = 0, startT = 0, lastY = 0;
        const onDown = (e: any) => {
            if (miniHandoffRef.current.allowDismiss === false) return;
            active = true; claimed = false;
            startX = e.clientX; startY = e.clientY; startT = Date.now(); lastY = e.clientY;
        };
        const onMove = (e: any) => {
            if (!active) return;
            const dy = e.clientY - startY, dx = e.clientX - startX;
            lastY = e.clientY;
            if (!claimed && dy > 10 && dy > Math.abs(dx) * 1.5) claimed = true;
            if (claimed) {
                e.preventDefault();
                if (dy > 0) dismissDragY.setValue(dy);
            }
        };
        const onUp = (e: any) => {
            if (!active) return;
            active = false;
            if (!claimed) return;
            const dy = (e.clientY || lastY) - startY;
            const vy = dy / Math.max(1, Date.now() - startT);
            if (dy > 130 || vy > 0.85) {
                Animated.timing(dismissDragY, {
                    toValue: DISMISS_SHRINK, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: false,
                }).start(() => {
                    const h = miniHandoffRef.current;
                    if (h.eligible && h.videoUrl && openMiniRef.current) {
                        openMiniRef.current({
                            videoUrl: h.videoUrl, title: h.title ?? '',
                            positionMs: currentPositionRef.current, expandParams: { ...(h.params ?? {}) },
                        });
                    }
                    navigation.goBack();
                });
            } else {
                Animated.spring(dismissDragY, { toValue: 0, bounciness: 2, useNativeDriver: false }).start();
            }
        };

        node.addEventListener('pointerdown', onDown);
        window.addEventListener('pointermove', onMove, { passive: false });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            node.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [navigation]); // eslint-disable-line react-hooks/exhaustive-deps

    // Opening the full player removes any floating mini-player still on screen.
    useEffect(() => { closeMini(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Resume from the mini-player hand-off position once, after the player loads.
    const resumePositionMs = route?.params?.resumePositionMs;
    const didResumeRef = useRef(false);
    useEffect(() => {
        if (!resumePositionMs || didResumeRef.current) return;
        const t = setTimeout(() => {
            try { sharedPlayerRef.current?.seekTo(resumePositionMs); } catch {}
            didResumeRef.current = true;
        }, 900);
        return () => clearTimeout(t);
    }, [resumePositionMs]);

    // Lights-out: while the video plays we wash the whole bottom section with a
    // muted colour (not opacity) so the info recedes. 1 = revealed/paused → clear,
    // 0.4 = playing → tinted. A touch/swipe brings it back to the present colour.
    const panelDimAnim = useRef(new Animated.Value(1)).current;
    const panelScrimColor = panelDimAnim.interpolate({
        inputRange: [0.4, 1],
        outputRange: ['rgba(33,24,50,0.55)', 'rgba(33,24,50,0)'],
    });
    const setLightsOut = useCallback((playing: boolean) => {
        // Skip dimming while the panel is scrolled up (user is reading it).
        if (playing && panelRevealedRef.current) return;
        Animated.timing(panelDimAnim, {
            toValue: playing ? 0.4 : 1,
            duration: 400,
            useNativeDriver: false, // JS-driven so the scroll listener can also drive it
        }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // HOST: wrap setLightsOut to also emit play/pause sync events.
    // If not a session host (or no sessionId), this is identical to setLightsOut.
    const hasRecordedWatchRef = useRef(false);

    // Intercepts the play *intent* from the player's Play button BEFORE the video
    // actually plays. In workout mode (timer not yet running) we suppress playback
    // and kick off the Ready/Steady/Go countdown instead; the video is started
    // imperatively when the countdown finishes. Returning false = "don't play".
    const handlePlayRequest = useCallback((): boolean => {
        if (modeTypeRef.current === 'workout' && timerStateRef.current !== 'running') {
            if (timerStateRef.current === 'idle') {
                startWorkoutCallbackRef.current();
            }
            // If already counting down, just ignore the extra press.
            return false;
        }
        return true;
    // refs are stable; startWorkout is invoked via ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePlayStateChange = useCallback((playing: boolean) => {
        // Safety net: if the video somehow starts playing in workout mode before
        // the timer is running (e.g. autoplay), pause it back. The Play button is
        // already handled earlier by handlePlayRequest, so this rarely fires.
        if (playing && modeTypeRef.current === 'workout' && timerStateRef.current !== 'running') {
            sharedPlayerRef.current?.pauseVideo();
            if (timerStateRef.current === 'idle') {
                startWorkoutCallbackRef.current();
            }
            return;
        }

        // During an active workout, keep the timer in lockstep with the video:
        // pausing the video pauses the timer, resuming the video resumes it.
        if (modeTypeRef.current === 'workout' && timerStateRef.current === 'running') {
            if (playing) {
                startWorkoutTick();
            } else {
                pauseWorkoutTick();
            }
        }

        // Keep the play-state ref accurate (progress ticks set it true but never
        // clear it on pause) so the colour-wash / re-wash logic is correct.
        isVideoPlayingRef.current = playing;
        setLightsOut(playing);

        // Record watch on first play
        if (playing && !hasRecordedWatchRef.current && videoId && videoId !== 'default-video') {
            hasRecordedWatchRef.current = true;
            const vType = allowInvite ? 'premade_workout' : 'exercise_library';
            const watchVideoId = requestedVideoId ?? videoId;
            if (supabaseUserId) {
                recordVideoWatch(supabaseUserId, videoId, vType).catch(() => {});
            }
            // Global YouTube-style view count — one bump per visit, any viewer.
            incrementVideoView(watchVideoId, vType).catch(() => {});
        }

        if (!isHost || !syncSessionId || !supabaseUserId) return;

        const currentSec = lastSyncPositionMsRef.current / 1000;
        const durationSec = durationMsRef.current / 1000;
        console.log('[PlaybackSync] host action', { playing, currentSec: currentSec.toFixed(2) });
        PlaybackSyncService.emit(syncSessionId, playing, currentSec, durationSec, supabaseUserId)
            .catch(() => {});
    // isHost / syncSessionId / supabaseUserId are stable for this screen's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setLightsOut]);

    const handleBack = useCallback(() => navigation.goBack(), [navigation]);

    // Down-chevron in the player header → minimize to the floating mini-player
    // (YouTube style). Falls back to a plain back when the video isn't eligible
    // (e.g. YouTube embeds).
    const handleMinimize = useCallback(() => {
        const h = miniHandoffRef.current;
        if (h.eligible && h.videoUrl && openMiniRef.current) {
            openMiniRef.current({
                videoUrl: h.videoUrl,
                title: h.title ?? '',
                positionMs: currentPositionRef.current,
                expandParams: { ...(h.params ?? {}) },
            });
        }
        navigation.goBack();
    }, [navigation]);

    // Co-workout: channel name passed when another user accepted an invite.
    // Declared before useFocusEffect so it's in scope for the join/leave logic.
    const coWorkoutChannel: string | null = route?.params?.coWorkoutChannel ?? null;
    const isCoWorkout = !!coWorkoutChannel;

    // End-session handler — leaves Agora (cleanup also runs on unmount) and pops back.
    const handleEndCoWorkout = useCallback(() => {
        if (coWorkoutChannel) {
            AgoraVoice.leaveChannel().catch(() => {});
        }
        navigation.goBack();
    }, [coWorkoutChannel, navigation]);

    // Pause video when navigating away, resume when returning.
    // Watch tracking is handled by SharedVideoPlayer's playingChange listener.
    useFocusEffect(useCallback(() => {
        sharedPlayerRef.current?.resumeVideo();

        // Co-workout: fetch token then join with video + UID tracking.
        // cancelled flag guards against cleanup racing the async token fetch.
        let cancelled = false;
        if (coWorkoutChannel && supabaseUserId) {
            const uid = deriveAgoraUid(supabaseUserId);
            fetchAgoraToken(coWorkoutChannel, uid).then(token => {
                if (cancelled) return;
                console.log('[VideoPlayerScreen] joining co-workout channel:', coWorkoutChannel, 'uid:', uid);
                return AgoraVoice.joinChannelWithToken(
                    token,
                    coWorkoutChannel,
                    uid,
                    (isLocal, isRemote) => {
                        console.log('[VideoPlayerScreen] speaker — local:', isLocal, 'remote:', isRemote);
                    },
                    (remoteUid) => {
                        console.log('[VideoPlayerScreen] remote joined:', remoteUid);
                        setRemoteUids(prev => [...prev, remoteUid]);
                    },
                    (remoteUid) => {
                        console.log('[VideoPlayerScreen] remote left:', remoteUid);
                        setRemoteUids(prev => prev.filter(u => u !== remoteUid));
                    },
                );
            }).catch((err: unknown) => {
                console.warn('[VideoPlayerScreen] Agora join failed:', err);
                const msg = (err as Error)?.message ?? '';
                if (/denied|permission|NotAllowed/i.test(msg)) {
                    setCameraPermissionDenied(true);
                }
            });
        }

        return () => {
            cancelled = true;
            sharedPlayerRef.current?.pauseVideo();
            if (completionTimerRef.current) {
                clearTimeout(completionTimerRef.current);
                completionTimerRef.current = null;
            }
            if (coWorkoutChannel) {
                console.log('[VideoPlayerScreen] leaving co-workout Agora channel');
                AgoraVoice.leaveChannel();
                setRemoteUids([]);
            }
        };
    // coWorkoutChannel / supabaseUserId are stable for this screen's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coWorkoutChannel]));

    // ── Playback Sync: HOST — detect seek jumps and emit ─────────────────────
    // Watches currentPositionMs state (updated by handlePositionChange every ~250 ms).
    // If the position jumps more than 3 s between consecutive ticks it's a manual seek.
    // lastSyncPositionMsRef is intentionally updated HERE (not in handlePositionChange) so
    // we can always compare "what the ref stored last render" vs "what just came in".
    useEffect(() => {
        // Always advance the ref so guest-side drift checks stay current
        const lastMs = lastSyncPositionMsRef.current;
        lastSyncPositionMsRef.current = currentPositionMs;

        if (!isHost || !syncSessionId || !supabaseUserId) return;

        const delta = Math.abs(currentPositionMs - lastMs);

        // Skip the very first tick (lastMs === 0, position just starting)
        if (lastMs === 0) return;

        if (delta > 3000) {
            const currentSec = currentPositionMs / 1000;
            const durationSec = durationMsRef.current / 1000;
            console.log('[PlaybackSync] host action seek', currentSec.toFixed(2));
            PlaybackSyncService.emit(
                syncSessionId,
                isVideoPlayingRef.current,
                currentSec,
                durationSec,
                supabaseUserId
            ).catch(() => {});
        }
    // currentPositionMs is the reactive trigger — the rest are stable refs/consts
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPositionMs]);

    // ── Playback Sync: GUEST — subscribe and mirror host state ───────────────
    // Only active when the current user is NOT the host and a sessionId is present.
    useEffect(() => {
        if (isHost || !syncSessionId) return;

        console.log('[PlaybackSync] guest subscribing to session', syncSessionId);

        const unsub = PlaybackSyncService.subscribe(syncSessionId, (state) => {
            // Mirror position — seek if we're more than 1 second off
            const localSec = lastSyncPositionMsRef.current / 1000;
            const remoteSec = state.current_time_seconds;

            if (Math.abs(localSec - remoteSec) > 1) {
                console.log('[PlaybackSync] remote seek to', remoteSec.toFixed(2));
                sharedPlayerRef.current?.seekTo(remoteSec * 1000);
            }

            // Mirror play / pause
            if (state.is_playing) {
                sharedPlayerRef.current?.resumeVideo();
            } else {
                sharedPlayerRef.current?.pauseVideo();
            }
        });

        return () => {
            console.log('[PlaybackSync] guest unsubscribing');
            unsub();
        };
    // syncSessionId and isHost are stable for the lifetime of this screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [syncSessionId, isHost]);

    // ── Playback Sync: HOST — emit on play / pause ────────────────────────────
    // Intercepts setLightsOut (the existing onPlayStateChange handler) to also
    // push a sync event whenever the host's play state changes.
    // ─────────────────────────────────────────────────────────────────────────

    const handleVideoEndCallback = useCallback(() => {
        handleVideoEndRef.current();
        triggerCompletionCheckRef.current();
    }, []);

    const handleDurationChange = useCallback((durMs: number) => {
        durationMsRef.current = durMs;
    }, []);

    const requestedVideoId = route?.params?.videoId;
    const fallbackTitle = route?.params?.title ?? 'z.mohisharma';
    const allowInvite = route?.params?.allowInvite === true;
    const routeYoutubeId = route?.params?.youtubeId || '';
    const routeVideoUrl = route?.params?.videoUrl || '';

    const sourceVideo = useMemo(() => {
        const fallbackUrl = gripCuffVideos.find((video) => video.videoUrl)?.videoUrl;
        const foundVideo = [...gripCuffVideos, ...trainerVideos, ...allVideos, ...bodyPartVideos].find(
            (video) => video.id === requestedVideoId
        );

        if (foundVideo) {
            // Use youtubeId from route params if available, otherwise from context
            const ytId = routeYoutubeId || (foundVideo as any).youtubeId || '';
            return {
                ...foundVideo,
                youtubeId: ytId,
                videoUrl: ytId ? foundVideo.videoUrl : (routeVideoUrl || foundVideo.videoUrl || fallbackUrl),
            };
        }

        if (routeVideoUrl || fallbackUrl) {
            return {
                id: requestedVideoId ?? fallbackTitle,
                title: fallbackTitle,
                videoUrl: routeVideoUrl || fallbackUrl,
                youtubeId: routeYoutubeId,
                duration: route?.params?.duration ?? '',
                category: route?.params?.category,
                thumbnail: route?.params?.thumbnail ?? '',
            };
        }

        return null;
    }, [allVideos, bodyPartVideos, fallbackTitle, gripCuffVideos, requestedVideoId, route, routeVideoUrl, routeYoutubeId, trainerVideos]);

    const youtubeId = routeYoutubeId || sourceVideo?.youtubeId || '';
    const isYT = !!youtubeId && youtubeId.length === 11 && !youtubeId.includes('http');

    // Render-time logs removed — use useEffect below for one-shot debug logging

    const title = sourceVideo?.title ?? fallbackTitle;
    const videoId = (requestedVideoId ?? title ?? 'default-video')
        .toString()
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .toLowerCase();

    // Keep the swipe-down → mini-player hand-off data fresh each render. Only
    // plain (non-YouTube, non-co-workout) videos can pop into the mini player.
    openMiniRef.current = openMini;
    miniHandoffRef.current = {
        videoUrl: sourceVideo?.videoUrl,
        title,
        params: route?.params,
        eligible: !isYT && !isCoWorkout && !!sourceVideo?.videoUrl,
        // Co-workout sessions must exit via the End button (cleanup), not swipe.
        allowDismiss: !isCoWorkout,
    };

    // ── Previous / next video in the current list (for workout-mode nav) ──────
    const playlist = useMemo(() => {
        const lists = [gripCuffVideos, trainerVideos, bodyPartVideos, allVideos];
        for (const list of lists) {
            if (list.some((v) => v.id === requestedVideoId)) return list;
        }
        return allVideos;
    }, [gripCuffVideos, trainerVideos, bodyPartVideos, allVideos, requestedVideoId]);

    const playlistIndex = useMemo(
        () => playlist.findIndex((v) => v.id === requestedVideoId),
        [playlist, requestedVideoId],
    );
    const prevVideo = playlistIndex > 0 ? playlist[playlistIndex - 1] : null;
    const nextVideo =
        playlistIndex >= 0 && playlistIndex < playlist.length - 1
            ? playlist[playlistIndex + 1]
            : null;

    const goToVideo = useCallback(
        (v: any) => {
            if (!v) return;
            navigation.push('VideoPlayer', {
                videoId: v.id,
                title: v.title,
                videoUrl: v.videoUrl,
                youtubeId: (v as any).youtubeId,
                category: (v as any).category,
                thumbnail: v.thumbnail,
                duration: v.duration,
                allowInvite,
                initialMode: modeTypeRef.current,
            });
        },
        [navigation, allowInvite],
    );

    // ── Live coaching cue, synced to the workout timer ────────────────────────
    // Prefer an authored per-video cue track (real reps/weight/time the
    // instructor uses); fall back to a generic work/rest cycle when none exists.
    const cueTrack = useMemo(
        () => getCueTrack(sourceVideo?.id ?? requestedVideoId),
        [sourceVideo?.id, requestedVideoId],
    );

    const { activeCue, cueSegmentElapsed } = useMemo(() => {
        // Authored track takes priority.
        if (cueTrack && cueTrack.length > 0) {
            const resolved = resolveActiveCue(cueTrack, workoutElapsed);
            if (resolved) {
                const { cue, segmentElapsed } = resolved;
                return {
                    activeCue: {
                        label: cue.label,
                        reps: cue.reps != null ? `${cue.reps}` : '—',
                        weight: cue.weight ?? '—',
                        tip: cue.tip ?? '',
                    },
                    cueSegmentElapsed: segmentElapsed,
                };
            }
        }

        // Generic fallback: 45s work / 15s rest cycle.
        const WORK_SECS = 45;
        const REST_SECS = 15;
        const CYCLE = WORK_SECS + REST_SECS;

        const inCycle = workoutElapsed % CYCLE;
        const setNum = Math.floor(workoutElapsed / CYCLE) + 1;

        if (inCycle < WORK_SECS) {
            const reps = Math.min(15, Math.floor(inCycle / 3) + 1); // ~1 rep / 3s
            return {
                activeCue: {
                    label: `Set ${setNum}`,
                    reps: `${reps}`,
                    weight: 'Bodyweight',
                    tip: 'Match the instructor — controlled tempo, full range of motion.',
                },
                cueSegmentElapsed: inCycle,
            };
        }
        return {
            activeCue: {
                label: 'Rest',
                reps: '—',
                weight: '—',
                tip: 'Breathe and recover before the next set.',
            },
            cueSegmentElapsed: inCycle - WORK_SECS,
        };
    }, [cueTrack, workoutElapsed]);

    // Keep completionParamsRef current every render so the tick timer ([] deps)
    // always reads up-to-date uid, workoutId, title, etc. without stale closure.
    completionParamsRef.current = {
        uid: supabaseUserId ?? null,
        workoutId: requestedVideoId ?? videoId,
        workoutTitle: title,
        isChallengeVideo,
        category: (sourceVideo as any)?.category as string | undefined,
        timezone: (profile as any)?.timezone as string | undefined,
    };

    // Live viewer presence via Firestore — only active for pre-made workout videos.
    // Pass null for videoId/userId when not applicable to skip writes but stay hook-safe.
    const viewerDisplayName =
        profile?.fullName ?? profile?.username ?? email?.split('@')[0] ?? 'Viewer';
    const watcherProfile = allowInvite && supabaseUserId ? {
        displayName: viewerDisplayName,
        username: profile?.username ?? viewerDisplayName,
        profilePhoto: profile?.profileImageUrl ?? null,
        gender: (profile as any)?.gender ?? null,
        age: (profile as any)?.age ?? null,
    } : null;
    const { count: viewerCount, viewers: liveViewers } = useWorkoutWatchers(
        allowInvite && videoId !== 'default-video' ? videoId : null,
        allowInvite ? (supabaseUserId ?? null) : null,
        watcherProfile,
    );
    const socialHub = useWorkoutSocialHub({
        videoId: allowInvite && videoId !== 'default-video' ? (requestedVideoId ?? videoId) : null,
        currentUid: allowInvite ? (supabaseUserId ?? null) : null,
        activeLiveCount: viewerCount,
    });

    const engagement = useVideoEngagement(
        supabaseUserId ?? null,
        videoId !== 'default-video' ? videoId : null,
        {
            title,
            category: (sourceVideo as any)?.category ?? route?.params?.category,
            difficulty: (sourceVideo as any)?.difficulty ?? (sourceVideo as any)?.experienceLevel,
            thumbnail: sourceVideo?.thumbnail,
            youtubeId: sourceVideo?.youtubeId,
            videoUrl: sourceVideo?.videoUrl,
        },
    );
    const globalCounts = useVideoGlobalCounts(videoId !== 'default-video' ? videoId : null);
    const viewCount = useVideoViews(videoId !== 'default-video' ? (requestedVideoId ?? videoId) : null);

    // Supabase-backed per-user interactions (Like / Dislike / Want to Try / Favourite)
    const interactionVideoId =
        videoId !== 'default-video' ? (requestedVideoId ?? videoId) : null;
    const interactionVideoType =
        (route?.params?.videoType as 'exercise_library' | 'premade_workout' | undefined)
            ?? (allowInvite ? 'premade_workout' : 'exercise_library');
    const interactions = useVideoInteractions(interactionVideoId, interactionVideoType);

    // Drives EngagementBar's `engagement.state` reads from Supabase so the
    // active/inactive visuals survive app restarts and refreshes.
    const engagementWithPersistedState = useMemo(() => ({
        ...engagement,
        state: {
            liked: interactions.liked,
            disliked: interactions.disliked,
            tryIntent: interactions.wantToTry,
        },
    }), [engagement, interactions.liked, interactions.disliked, interactions.wantToTry]);

    // Similar programs (sync — uses in-memory program data)
    const similarPrograms = useMemo(
        () => getSimilarPrograms(requestedVideoId ?? videoId, 6),
        [requestedVideoId, videoId],
    );


    useEffect(() => {
        setComments([]);
        setCommentsLoading(false);
    }, [videoId]);

    // YouTube player state via postMessage (state 0 = ended, 1 = playing, 3 = buffering)
    useEffect(() => {
        if (!isYT || Platform.OS !== 'web') return;
        const handler = (e: MessageEvent) => {
            try {
                const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                const info = data?.info;
                if (!info || typeof info !== 'object') return;

                // Track position from YouTube infoDelivery events (when available)
                if (typeof info.currentTime === 'number' && info.currentTime > 0) {
                    const posMs = info.currentTime * 1000;
                    elapsedSecondsRef.current = Math.floor(info.currentTime);
                    if (posMs > maxWatchedMsRef.current) maxWatchedMsRef.current = posMs;
                }
                if (typeof info.duration === 'number' && info.duration > 0 && durationMsRef.current === 0) {
                    durationMsRef.current = info.duration * 1000;
                    console.log('[Completion] YouTube duration received:', info.duration, 's');
                }

                const state = info?.playerState;
                if (typeof state === 'number') {
                    setLightsOut(state === 1 || state === 3);
                    if (state === 1) {
                        // Playing — signal tick timer to start counting
                        if (!isVideoPlayingRef.current) {
                            console.log('[Timer] video playing — YouTube playerState=1, elapsed will start counting');
                            isVideoPlayingRef.current = true;
                        }
                        // Global YouTube-style view count — one bump per visit.
                        if (!hasRecordedWatchRef.current && videoId && videoId !== 'default-video') {
                            hasRecordedWatchRef.current = true;
                            const vType = allowInvite ? 'premade_workout' : 'exercise_library';
                            if (supabaseUserId) recordVideoWatch(supabaseUserId, videoId, vType).catch(() => {});
                            incrementVideoView(requestedVideoId ?? videoId, vType).catch(() => {});
                        }
                        // Resume the workout clock alongside the video
                        if (modeTypeRef.current === 'workout' && timerStateRef.current === 'running') {
                            startWorkoutTickRef.current();
                        }
                    } else if (state === 2) {
                        // Paused — stop counting wall-clock seconds
                        isVideoPlayingRef.current = false;
                        // Pausing the video pauses the workout clock
                        if (modeTypeRef.current === 'workout' && timerStateRef.current === 'running') {
                            pauseWorkoutTickRef.current();
                        }
                    } else if (state === 0) {
                        // Natural video end
                        isVideoPlayingRef.current = false;
                        if (modeTypeRef.current === 'workout' && timerStateRef.current === 'running') {
                            pauseWorkoutTickRef.current();
                        }
                        if (elapsedSecondsRef.current < 5) elapsedSecondsRef.current = 5;
                        console.log('[Completion] YouTube ended, elapsed:', elapsedSecondsRef.current, 's');
                        handleVideoEndRef.current();
                        triggerCompletionCheck();
                    }
                }
            } catch { /* non-YT postMessages */ }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, [isYT, isChallengeVideo]);

    const postComment = async () => {
        if (!newComment.trim() || !commentType) return;
        if (!supabaseUserId) {
            Alert.alert('Login required', 'Please login to post');
            return;
        }
        setNewComment('');
        setCommentType(null);
    };

    const toggleLike = async (_commentId: string, _likedBy: string[], _likes: number) => {
        // no-op
    };

    const formatTimeAgo = (date: Date) => {
        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    };

    const getAvatarColor = (name: string) => {
        const colors = ['#F25912', '#8B5CF6', '#10B981', '#3B82F6', '#F25912'];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const toggleFaqItem = useCallback((index: number) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpandedFaq((prev) => (prev === index ? null : index));
    }, []);

    const formatWorkoutTime = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const stopWorkoutTimer = useCallback(() => {
        if (workoutTimerRef.current) {
            clearInterval(workoutTimerRef.current);
            workoutTimerRef.current = null;
        }
        countdownTimeoutsRef.current.forEach(t => clearTimeout(t));
        countdownTimeoutsRef.current = [];
    }, []);

    // Start the 1-second tick that advances the workout clock. Guarded so calling
    // it twice (e.g. play event + countdown finish) never double-counts.
    const startWorkoutTick = useCallback(() => {
        if (workoutTimerRef.current) return;
        setWorkoutPaused(false);
        workoutTimerRef.current = setInterval(() => {
            unflushedWorkoutSecsRef.current += 1;
            setWorkoutElapsed(prev => prev + 1);
        }, 1000);
    }, []);

    // Pause the tick (video paused) without losing elapsed time.
    const pauseWorkoutTick = useCallback(() => {
        if (workoutTimerRef.current) {
            clearInterval(workoutTimerRef.current);
            workoutTimerRef.current = null;
        }
        setWorkoutPaused(true);
    }, []);

    const flushWorkoutSeconds = useCallback(() => {
        const secs = unflushedWorkoutSecsRef.current;
        if (secs <= 0 || !supabaseUserId) return;
        unflushedWorkoutSecsRef.current = 0;
        supabase.rpc('increment_workout_time', {
            p_user_id: supabaseUserId,
            p_seconds: secs,
        }).then(null, () => {
            unflushedWorkoutSecsRef.current += secs;
        });
    }, [supabaseUserId]);

    const startWorkout = useCallback(() => {
        stopWorkoutTimer();
        setWorkoutElapsed(0);
        setWorkoutPaused(false);
        unflushedWorkoutSecsRef.current = 0;
        setTimerState('countdown');
        setCountdownPhase('Ready');

        const t1 = setTimeout(() => {
            setCountdownPhase('Steady');
            const t2 = setTimeout(() => {
                setCountdownPhase('Go');
                const t3 = setTimeout(() => {
                    setCountdownPhase(null);
                    setTimerState('running');
                    timerStateRef.current = 'running'; // update ref immediately so handlePlayStateChange sees it before next render
                    sharedPlayerRef.current?.resumeVideo();
                    startWorkoutTick();
                }, 1000);
                countdownTimeoutsRef.current.push(t3);
            }, 1000);
            countdownTimeoutsRef.current.push(t2);
        }, 1000);
        countdownTimeoutsRef.current.push(t1);
    }, [stopWorkoutTimer, startWorkoutTick]);

    const resetWorkout = useCallback(() => {
        stopWorkoutTimer();
        flushWorkoutSeconds();
        setTimerState('idle');
        setCountdownPhase(null);
        setWorkoutElapsed(0);
        setWorkoutPaused(false);
        sharedPlayerRef.current?.pauseVideo();
    }, [stopWorkoutTimer, flushWorkoutSeconds]);

    // Manual pause / resume — keeps the workout clock and the video in sync.
    const toggleWorkoutPause = useCallback(() => {
        if (timerStateRef.current !== 'running') return;
        if (workoutPaused) {
            sharedPlayerRef.current?.resumeVideo();
            startWorkoutTick();
        } else {
            sharedPlayerRef.current?.pauseVideo();
            pauseWorkoutTick();
        }
    }, [workoutPaused, startWorkoutTick, pauseWorkoutTick]);

    // Keep the ref current so handlePlayStateChange can call startWorkout without stale closure
    startWorkoutCallbackRef.current = startWorkout;
    startWorkoutTickRef.current = startWorkoutTick;
    pauseWorkoutTickRef.current = pauseWorkoutTick;

    // ── Auto-start workout (e.g. "Reminder to Move" → 1-min squat) ───────────
    const autoStartWorkout = route?.params?.autoStartWorkout === true;
    const targetDurationSec: number | null = route?.params?.targetDurationSec ?? null;
    const autoStartedRef = useRef(false);
    useEffect(() => {
        if (autoStartWorkout && modeType === 'workout' && timerState === 'idle' && !autoStartedRef.current) {
            autoStartedRef.current = true;
            const t = setTimeout(() => startWorkout(), 600); // let the player mount first
            return () => clearTimeout(t);
        }
    }, [autoStartWorkout, modeType, timerState, startWorkout]);

    // Move-reminder squat prompt (asks the rep count after the timer).
    const isSquatReminder = requestedVideoId === 'move-squat';
    const [showSquatPrompt, setShowSquatPrompt] = useState(false);
    const [squatSaving, setSquatSaving] = useState(false);
    const squatPromptedRef = useRef(false);

    // Auto-stop when the target duration (e.g. 60s squat set) is reached.
    useEffect(() => {
        if (targetDurationSec && timerState === 'running' && !workoutPaused && workoutElapsed >= targetDurationSec) {
            sharedPlayerRef.current?.pauseVideo();
            pauseWorkoutTick();
            flushWorkoutSeconds();
            // After a move-reminder squat set, ask how many they did.
            if (isSquatReminder && !squatPromptedRef.current) {
                squatPromptedRef.current = true;
                setShowSquatPrompt(true);
            }
        }
    }, [targetDurationSec, timerState, workoutPaused, workoutElapsed, pauseWorkoutTick, flushWorkoutSeconds, isSquatReminder]);

    const handleLogSquats = async (count: number) => {
        setSquatSaving(true);
        if (supabaseUserId && count > 0) {
            await UserService.addSquats(supabaseUserId, count);
        }
        setSquatSaving(false);
        setShowSquatPrompt(false);
    };

    const switchViewMode = useCallback((mode: 'watch' | 'workout') => {
        if (mode === 'watch') {
            resetWorkout();
        } else {
            // Entering workout mode — pause video and reset timer to idle
            sharedPlayerRef.current?.pauseVideo();
            stopWorkoutTimer();
            setTimerState('idle');
            setCountdownPhase(null);
            setWorkoutElapsed(0);
            setWorkoutPaused(false);
        }
        setModeType(mode);
    }, [resetWorkout, stopWorkoutTimer]);

    // Pre-start chooser: apply the picked mode, then dismiss.
    const handleChooseMode = useCallback((mode: 'watch' | 'workout') => {
        setShowModeModal(false);
        if (mode === 'workout') {
            // switchViewMode pauses the video and drops to idle; user taps Start to begin.
            switchViewMode('workout');
        } else {
            setModeType('watch');
            sharedPlayerRef.current?.resumeVideo();
        }
    }, [switchViewMode]);

    // While the chooser is open, hold the autoplaying video paused until they pick.
    useEffect(() => {
        if (!showModeModal) return;
        const t = setTimeout(() => { try { sharedPlayerRef.current?.pauseVideo(); } catch {} }, 500);
        return () => clearTimeout(t);
    }, [showModeModal]);

    const activeProgram = useMemo(() => {
        if (!allowInvite) return undefined;
        return getProgramByVideoId(requestedVideoId ?? videoId);
    }, [allowInvite, requestedVideoId, videoId]);

    const reqData = useMemo(() => {
        const v = sourceVideo as any;
        const category = v?.category as string | undefined;
        const categoryKey = category?.replace(/\s+/g, '');
        const equipmentList = categoryKey && EQUIPMENT_BY_CATEGORY[categoryKey]
            ? EQUIPMENT_BY_CATEGORY[categoryKey]
            : EQUIPMENT_BY_CATEGORY.default;
        const setup = categoryKey && SETUP_TIME_BY_CATEGORY[categoryKey]
            ? SETUP_TIME_BY_CATEGORY[categoryKey]
            : SETUP_TIME_BY_CATEGORY.default;
        const programMuscles = activeProgram?.exercises
            .flatMap((exercise) => exercise.muscleGroup.split(','))
            .map((muscle) => muscle.trim())
            .filter(Boolean) ?? [];
        const uniqueProgramMuscles = Array.from(new Set(programMuscles));

        return {
            equipment: v?.equipment || equipmentList.map((e: any) => e.equipment).join(', '),
            muscles: v?.muscles || (uniqueProgramMuscles.length > 0 ? uniqueProgramMuscles.join(', ') : 'Forearms, Grip Strength'),
            exerciseType: v?.exerciseType || 'General',
            experienceLevel: v?.experienceLevel || v?.difficulty || 'Beginner',
            setupTime: v?.setupTime || setup.time,
            setupNote: v?.setupNote || setup.note,
        };
    }, [activeProgram, sourceVideo]);

    const featuredExercises = useMemo(() => {
        return activeProgram?.exercises ?? [];
    }, [activeProgram]);

    const targetedMuscles = useMemo(() => {
        if (typeof reqData.muscles === 'string') {
            return reqData.muscles.split(',').map((s: string) => s.trim()).filter(Boolean);
        }

        return Array.isArray(reqData.muscles) ? reqData.muscles : [];
    }, [reqData.muscles]);

    const renderSocialContent = () => {
        const otherViewers = liveViewers.filter(v => v.uid !== supabaseUserId);
        const avatarPalette = ['#F25912', '#8B5CF6', '#10B981', '#3B82F6'];
        const avatarColor = (name: string) => {
            let hash = 0;
            for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
            return avatarPalette[Math.abs(hash) % avatarPalette.length];
        };
        const formatScheduledTime = (ts: any): string => {
            try {
                const d: Date = ts?.toDate ? ts.toDate() : new Date(ts);
                const now = new Date();
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                if (d.toDateString() === now.toDateString()) return `Today, ${timeStr}`;
                if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${timeStr}`;
                return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + `, ${timeStr}`;
            } catch { return ''; }
        };

        return (
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}>
                {/* Scheduled Today */}
                <View style={socialStyles.sectionCard}>
                    <Text style={socialStyles.sectionLabel}>SCHEDULED TODAY</Text>
                    {socialHub.scheduled.length === 0 ? (
                        <Text style={socialStyles.emptyText}>No upcoming public schedules yet.</Text>
                    ) : (
                        socialHub.scheduled.map((entry, i) => {
                            const programLine = entry.programTitle || null;
                            const workoutLine = entry.combinedTitle || entry.workoutTitle || entry.videoTitle;
                            const videoLine = entry.videoTitle;
                            const isMine = entry.userId === supabaseUserId;
                            const isFriend = !isMine && friendUids.includes(entry.userId);
                            return (
                                <View key={entry.id} style={[socialStyles.row, i < socialHub.scheduled.length - 1 && socialStyles.rowBorder]}>
                                    <TierAvatar
                                        size={36}
                                        uid={entry.userId}
                                        name={entry.displayName}
                                        showBadge={false}
                                        fallback={
                                            <View style={[socialStyles.avatar, { backgroundColor: avatarColor(entry.displayName || '?') }]}>
                                                <Text style={socialStyles.avatarText}>{(entry.displayName || '?')[0].toUpperCase()}</Text>
                                            </View>
                                        }
                                    />
                                    <View style={{ flex: 1 }}>
                                        <Text style={socialStyles.name}>{entry.displayName}</Text>
                                        <Text style={socialStyles.sub}>{formatScheduledTime(entry.scheduledFor)}</Text>
                                        {programLine ? <Text style={socialStyles.scheduleTop}>{programLine}</Text> : null}
                                        <Text style={socialStyles.scheduleTop}>{workoutLine}</Text>
                                        {videoLine !== workoutLine ? <Text style={socialStyles.sub}>{videoLine}</Text> : null}
                                    </View>
                                    {isMine ? (
                                        <View style={socialStyles.scheduledBadge}>
                                            <Text style={socialStyles.scheduledBadgeText}>Scheduled</Text>
                                        </View>
                                    ) : isFriend ? (
                                        <TouchableOpacity
                                            style={socialStyles.joinBtn}
                                            onPress={() => handleJoinScheduled({ uid: entry.userId, displayName: entry.displayName })}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={socialStyles.joinBtnText}>Join</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={socialStyles.ctaBtn}
                                            onPress={() => {
                                                setSocialTargetName(entry.displayName);
                                                sendSocialInvite({ targetUserId: entry.userId, workoutId: requestedVideoId ?? videoId, workoutTitle: title, workoutThumbnail: sourceVideo?.thumbnail ?? null });
                                            }}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={socialStyles.ctaBtnText}>Invite</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })
                    )}
                </View>

                {/* Community Sessions */}
                <View style={socialStyles.sectionCard}>
                    <Text style={socialStyles.sectionLabel}>COMMUNITY SESSIONS</Text>
                    {socialHub.open.length === 0 ? (
                        <Text style={socialStyles.emptyText}>No open sessions right now.</Text>
                    ) : (
                        socialHub.open.map((entry, i) => (
                            <View key={entry.id} style={[socialStyles.row, i < socialHub.open.length - 1 && socialStyles.rowBorder]}>
                                <TierAvatar
                                    size={36}
                                    uid={(entry as any).hostUid}
                                    name={entry.hostName}
                                    showBadge={false}
                                    fallback={
                                        <View style={[socialStyles.avatar, { backgroundColor: avatarColor(entry.hostName || '?') }]}>
                                            <Text style={socialStyles.avatarText}>{(entry.hostName || '?')[0].toUpperCase()}</Text>
                                        </View>
                                    }
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={socialStyles.name}>{entry.title}</Text>
                                    <Text style={socialStyles.sub}>
                                        {entry.subtitle}{entry.startsAt ? ` • ${formatScheduledTime(entry.startsAt)}` : ''}
                                    </Text>
                                </View>
                                <TouchableOpacity
                                    style={socialStyles.joinBtn}
                                    onPress={() => entry.hostUid && handleJoinScheduled({ uid: entry.hostUid, displayName: entry.hostName ?? 'Athlete' })}
                                    disabled={!entry.hostUid}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="calendar-outline" size={13} color="#211832" />
                                    <Text style={socialStyles.joinBtnText}>Join</Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>
            </View>
        );
    };

    const renderRequirementsContent = () => (
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
            {/* Experience & Setup — always visible, combined */}
            <View style={reqStyles.sectionCard}>
                <View style={reqStyles.iconRow}>
                    <Ionicons name="trophy-outline" size={18} color={ACCENT} />
                    <Text style={reqStyles.metaLabel}>Experience & Setup</Text>
                </View>
                <Text style={reqStyles.metaValue}>
                    How challenging this session is and how much prep you need before you start.
                </Text>

                {/* Exercise difficulty */}
                <Text style={reqStyles.subLabel}>Exercise difficulty</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => {
                        const active = reqData.experienceLevel === lvl;
                        // Only the highlighted level shows its word; the others show
                        // just their colored icon (🟢 / 🟡 / 🔴).
                        const label = active ? formatDifficulty(lvl) : difficultyEmoji(lvl);
                        return (
                            <View key={lvl} style={{
                                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                                borderColor: active ? INDIGO : 'rgba(33,24,50,0.12)',
                                backgroundColor: active ? INDIGO_SOFT : 'transparent',
                            }}>
                                <Text style={{ color: active ? INDIGO : '#7A7C90', fontSize: 12, fontWeight: '600' }}>
                                    {label}
                                </Text>
                            </View>
                        );
                    })}
                </View>

                {/* Setup time — how long to get the equipment ready before starting */}
                <Text style={reqStyles.subLabel}>Setup time</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <View style={{
                        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                        borderColor: INDIGO, backgroundColor: INDIGO_SOFT,
                    }}>
                        <Text style={{ color: INDIGO, fontSize: 12, fontWeight: '700' }}>{reqData.setupTime}</Text>
                    </View>
                </View>
                <Text style={[reqStyles.metaValue, { marginTop: 8 }]}>{reqData.setupNote}</Text>
            </View>

            {/* More details toggle — reveals the rest of the sections */}
            <TouchableOpacity
                style={reqStyles.moreBtn}
                onPress={() => setRequirementsExpanded(v => !v)}
                activeOpacity={0.8}
            >
                <Text style={reqStyles.moreBtnText}>
                    {requirementsExpanded ? 'Show less' : 'More details'}
                </Text>
                <Ionicons
                    name={requirementsExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={INDIGO}
                />
            </TouchableOpacity>

            {!requirementsExpanded ? null : (
            <>
            {/* Purpose */}
            <PurposeSection purpose={(sourceVideo as any)?.purpose ?? activeProgram?.purpose} />

            {/* Muscles Targeted & Exercise Type — one combined section */}
            <View style={reqStyles.sectionCard}>
                <View style={reqStyles.iconRow}>
                    <Ionicons name="body-outline" size={18} color={ACCENT} />
                    <Text style={reqStyles.metaLabel}>Muscles Targeted</Text>
                </View>
                <Text style={reqStyles.metaValue}>{reqData.muscles}</Text>

                {/* Exercise type */}
                <Text style={reqStyles.subLabel}>Exercise type</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    {(['General', 'Strength', 'Stretching', 'Injury', 'Athletic'] as const).map((type) => {
                        const active = reqData.exerciseType === type;
                        return (
                            <View key={type} style={{
                                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                                borderColor: active ? INDIGO : 'rgba(33,24,50,0.12)',
                                backgroundColor: active ? INDIGO_SOFT : 'transparent',
                            }}>
                                <Text style={{ color: active ? INDIGO : '#7A7C90', fontSize: 12, fontWeight: '600' }}>
                                    {type}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Exercises */}
            {featuredExercises.length > 0 && (
                <View style={reqStyles.sectionCard}>
                    <View style={reqStyles.iconRow}>
                        <Ionicons name="list-outline" size={18} color={ACCENT} />
                        <Text style={reqStyles.metaLabel}>Exercises</Text>
                    </View>
                    <View style={{ marginTop: 8 }}>
                        {featuredExercises.map((ex, i) => {
                            const label = ex.sets && ex.reps
                                ? `${ex.sets} × ${ex.reps} reps`
                                : ex.sets && ex.duration
                                    ? `${ex.sets} × ${ex.duration}`
                                    : ex.reps ? `${ex.reps} reps`
                                    : ex.duration ?? '';
                            return (
                                <View
                                    key={i}
                                    style={[
                                        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
                                        i < featuredExercises.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(33,24,50,0.06)' },
                                    ]}
                                >
                                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: ACCENT, flexShrink: 0 }} />
                                    <Text style={{ color: '#211832', fontSize: 14, fontWeight: '500', flex: 1 }}>{ex.name}</Text>
                                    {!!label && <Text style={{ color: ACCENT, fontSize: 12, fontWeight: '600', flexShrink: 0 }}>{label}</Text>}
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                <MuscleVisualizer targetedMuscles={targetedMuscles} />
            </View>

            {/* Equipment Needed */}
            <View style={reqStyles.sectionCard}>
                <View style={reqStyles.iconRow}>
                    <Ionicons name="barbell-outline" size={18} color={ACCENT} />
                    <Text style={reqStyles.metaLabel}>Equipment Needed</Text>
                </View>
                <Text style={[reqStyles.metaValue, { marginTop: 6 }]}>{reqData.equipment}</Text>
            </View>

            {/* Similar Workouts */}
            {similarPrograms.length > 0 && (
                <View style={{ marginTop: 16, paddingBottom: 8 }}>
                    <Text style={{ color: 'rgba(33,24,50,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 0 }}>
                        Similar Workouts
                    </Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingTop: 8 }}
                    >
                        {similarPrograms.map((item: RecommendedProgram) => (
                            <TouchableOpacity
                                key={item.programId}
                                onPress={() =>
                                    navigation.push('VideoPlayer', {
                                        videoId: item.firstVideoId,
                                        title: item.title,
                                        videoUrl: item.firstVideoUrl,
                                        category: item.categoryLabel,
                                        workoutTitle: item.title,
                                    })
                                }
                                style={{
                                    width: 140,
                                    borderRadius: 10,
                                    overflow: 'hidden',
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    borderWidth: 1,
                                    borderColor: 'rgba(33,24,50,0.08)',
                                }}
                                activeOpacity={0.8}
                            >
                                <View
                                    style={{
                                        width: '100%',
                                        height: 72,
                                        backgroundColor: item.categoryColor,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Text style={{ fontSize: 28 }}>{item.categoryEmoji}</Text>
                                </View>
                                <View style={{ padding: 7 }}>
                                    <Text
                                        numberOfLines={2}
                                        style={{ color: '#211832', fontSize: 11, fontWeight: '700', lineHeight: 15 }}
                                    >
                                        {item.title}
                                    </Text>
                                    {!!formatDifficulty(item.level) && (
                                        <Text style={{ color: '#7A7C90', fontSize: 9, fontWeight: '600', marginTop: 3 }}>
                                            {formatDifficulty(item.level)}
                                        </Text>
                                    )}
                                    <Text style={{ color: ACCENT, fontSize: 9, marginTop: 3 }}>
                                        {item.totalVideos} videos
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
            </>
            )}
        </View>
    );

    const canPost = newComment.trim().length > 0 && commentType !== null;

    const renderFaqQaContent = () => (
        <View style={{ paddingBottom: 24 }}>
            {/* \u2500\u2500 Q&A Section \u2500\u2500 */}
            <Text style={panelStyles.sectionHeading}>Q & A</Text>

            {/* Comment input */}
            <View style={commentStyles.inputRow}>
                <View style={commentStyles.myAvatar}>
                    <Text style={commentStyles.myAvatarText}>
                        {(profile?.fullName ?? 'U')[0].toUpperCase()}
                    </Text>
                </View>

                <TextInput
                    style={commentStyles.input}
                    placeholder="Ask a question or leave feedback..."
                    placeholderTextColor="#D8D8E4"
                    value={newComment}
                    onChangeText={setNewComment}
                    multiline
                    maxLength={300}
                />

                <TouchableOpacity
                    style={[commentStyles.postBtn, !canPost && { opacity: 0.4 }]}
                    onPress={postComment}
                    disabled={!canPost}
                >
                    <Text style={commentStyles.postBtnText}>Post</Text>
                </TouchableOpacity>
            </View>

            {/* Type selector — visible when user has typed something */}
            {newComment.trim().length > 0 && (
                <View style={commentStyles.typeRow}>
                    <Text style={commentStyles.typeLabel}>Post as:</Text>
                    <TouchableOpacity
                        style={[
                            commentStyles.typeChip,
                            commentType === 'question' && commentStyles.typeChipActive,
                        ]}
                        onPress={() => setCommentType('question')}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={[
                                commentStyles.typeChipText,
                                commentType === 'question' && commentStyles.typeChipTextActive,
                            ]}
                        >
                            Question
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            commentStyles.typeChip,
                            commentType === 'feedback' && commentStyles.typeChipActive,
                        ]}
                        onPress={() => setCommentType('feedback')}
                        activeOpacity={0.7}
                    >
                        <Text
                            style={[
                                commentStyles.typeChipText,
                                commentType === 'feedback' && commentStyles.typeChipTextActive,
                            ]}
                        >
                            Feedback
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Comments list */}
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                {commentsLoading ? (
                    <ActivityIndicator color={ACCENT} style={{ marginTop: 20 }} />
                ) : comments.length === 0 ? (
                    <Text style={commentStyles.empty}>No comments yet. Be the first!</Text>
                ) : (
                    comments.map((comment) => (
                        <View key={comment.id} style={commentStyles.commentCard}>
                            <View
                                style={[
                                    commentStyles.avatar,
                                    { backgroundColor: getAvatarColor(comment.username) },
                                ]}
                            >
                                <Text style={commentStyles.avatarText}>{comment.userAvatar}</Text>
                            </View>

                            <View style={commentStyles.commentContent}>
                                <View style={commentStyles.commentHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={commentStyles.username}>{comment.username}</Text>
                                        {comment.type && (
                                            <View style={[
                                                commentStyles.typeBadge,
                                                comment.type === 'question'
                                                    ? { backgroundColor: 'rgba(59,130,246,0.15)' }
                                                    : { backgroundColor: 'rgba(16,185,129,0.15)' },
                                            ]}>
                                                <Text style={[
                                                    commentStyles.typeBadgeText,
                                                    comment.type === 'question'
                                                        ? { color: '#60A5FA' }
                                                        : { color: '#34D399' },
                                                ]}>
                                                    {comment.type === 'question' ? 'Question' : 'Feedback'}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={commentStyles.timestamp}>
                                        {comment.createdAt?.toDate
                                            ? formatTimeAgo(comment.createdAt.toDate())
                                            : 'just now'}
                                    </Text>
                                </View>

                                <Text style={commentStyles.commentText}>{comment.text}</Text>

                                <TouchableOpacity
                                    style={commentStyles.likeRow}
                                    onPress={() =>
                                        toggleLike(
                                            comment.id,
                                            comment.likedBy,
                                            comment.likes ?? 0
                                        )
                                    }
                                >
                                    <Text
                                        style={{
                                            color: comment.likedBy?.includes(supabaseUserId)
                                                ? ACCENT
                                                : '#7A7C90',
                                            fontSize: 13,
                                        }}
                                    >
                                        {comment.likedBy?.includes(supabaseUserId) ? '\u2764\uFE0F' : '\u{1F90D}'}
                                        {' '}
                                        {(comment.likes ?? 0) > 0 ? comment.likes : ''}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* ── Divider ── */}
            <View style={panelStyles.sectionDivider} />

            {/* ── FAQ Section ── */}
            <Text style={panelStyles.sectionHeading}>Frequently Asked Questions</Text>
            <View style={{ paddingHorizontal: 16 }}>
                {FAQ_ITEMS.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        activeOpacity={0.7}
                        onPress={() => toggleFaqItem(index)}
                        style={panelStyles.faqItem}
                    >
                        <View style={panelStyles.faqQuestionRow}>
                            <Text style={panelStyles.faqQuestion}>{item.question}</Text>
                            <Text style={panelStyles.faqChevron}>
                                {expandedFaq === index ? '▲' : '▼'}
                            </Text>
                        </View>
                        {expandedFaq === index && (
                            <Text style={panelStyles.faqAnswer}>{item.answer}</Text>
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    // ── Workout overlay shown ONLY in fullscreen (timer below video + Start,
    //    Ready/Steady/Go on start, prev/next exercise in the top corners). ──
    // Prev/Next titles sit faint, then jump to full opacity in the last 5s.
    const fsRemainingSec = durationMsRef.current > 0
        ? (durationMsRef.current - currentPositionMs) / 1000
        : Infinity;
    const fsNavOpacity = fsRemainingSec <= 5 ? 1 : 0.4;
    // Prev/Next — shown on the video in BOTH normal and fullscreen, both modes.
    const fsNavExtras = (
        <>
            {prevVideo && (
                <TouchableOpacity
                    style={[fsStyles.navBtn, fsStyles.navLeft, { opacity: fsNavOpacity }]}
                    onPress={() => goToVideo(prevVideo)}
                    activeOpacity={0.85}
                >
                    <Text style={fsStyles.navHint}>‹ Prev</Text>
                    <Text style={fsStyles.navText} numberOfLines={1}>{prevVideo.title}</Text>
                </TouchableOpacity>
            )}
            {nextVideo && (
                <TouchableOpacity
                    style={[fsStyles.navBtn, fsStyles.navRight, { opacity: fsNavOpacity }]}
                    onPress={() => goToVideo(nextVideo)}
                    activeOpacity={0.85}
                >
                    <Text style={[fsStyles.navHint, fsStyles.navHintRight]}>Next ›</Text>
                    <Text style={[fsStyles.navText, fsStyles.navTextRight]} numberOfLines={1}>{nextVideo.title}</Text>
                </TouchableOpacity>
            )}
        </>
    );

    // Timer + Start/countdown — fullscreen workout only.
    const fsWorkoutExtras = (
        <>
            {timerState === 'countdown' && countdownPhase && (
                <View style={fsStyles.countdownWrap} pointerEvents="none">
                    <Text style={fsStyles.countdownText}>{countdownPhase}</Text>
                </View>
            )}
            <View style={fsStyles.bottomBar}>
                <Text style={fsStyles.timerText}>{formatWorkoutTime(workoutElapsed)}</Text>
                {timerState === 'idle' ? (
                    <TouchableOpacity style={fsStyles.startBtn} onPress={startWorkout} activeOpacity={0.85}>
                        <Text style={fsStyles.startBtnText}>Start</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={fsStyles.controlsRow}>
                        <TouchableOpacity style={fsStyles.pauseBtn} onPress={toggleWorkoutPause} activeOpacity={0.85} disabled={timerState !== 'running'}>
                            <Text style={fsStyles.pauseBtnText}>{workoutPaused ? 'Resume' : 'Pause'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={fsStyles.stopBtn} onPress={resetWorkout} activeOpacity={0.85}>
                            <Text style={fsStyles.stopBtnText}>Stop</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </>
    );

    return (
        <KeyboardAvoidingView
            style={s.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* Swipe-down-to-minimize wrapper — shrinks toward the bottom-right
                corner (where the mini-player docks) as the drag progresses. */}
            <Animated.View
                style={{
                    flex: 1,
                    overflow: 'hidden',
                    borderRadius: dismissRadius,
                    opacity: dismissOpacity,
                    transform: [
                        { translateX: dismissTranslateX },
                        { translateY: dismissTranslateY },
                        { scale: dismissScale },
                    ],
                }}
            >

            {/* Video player — shrinks when tab content is scrolled */}
            <Animated.View
                style={[s.playerSection, { height: videoHeight }]}
                {...dismissPan.panHandlers}
            >
              <View
                ref={webGestureRef}
                style={Platform.OS === 'web'
                    ? ({ flex: 1, width: '100%', touchAction: 'none' } as any)
                    : { flex: 1, width: '100%' }}
              >
                {isYT ? (
                    <View style={{ width: '100%', height: 220, backgroundColor: '#000' }}>
                        <WebYouTubePlayer videoId={youtubeId} />
                        <TouchableOpacity
                            style={s.ytBackBtn}
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="arrow-back" size={22} color="#211832" />
                        </TouchableOpacity>
                    </View>
                ) : sourceVideo?.videoUrl ? (
                    <SharedVideoPlayer
                        ref={sharedPlayerRef}
                        title={isCoWorkout ? (friendName ?? title) : title}
                        videoUri={sourceVideo.videoUrl}
                        onBack={isCoWorkout ? handleEndCoWorkout : handleMinimize}
                        actionLabel={isCoWorkout ? 'End' : undefined}
                        actionVariant={isCoWorkout ? 'danger' : 'default'}
                        onActionPress={isCoWorkout ? handleEndCoWorkout : undefined}
                        headerTitleSuffix={isCoWorkout ? (
                            <View style={s.liveIndicatorContainer}>
                                <View style={s.liveDot} />
                                <Text style={s.liveText}>Live</Text>
                            </View>
                        ) : undefined}
                        onPlayStateChange={handlePlayStateChange}
                        onPlayRequest={handlePlayRequest}
                        userId={supabaseUserId ?? undefined}
                        onSeekForward={triggerCompletionCheck}
                        onVideoEnd={handleVideoEndCallback}
                        onCurrentPositionChange={handlePositionChange}
                        onDurationChange={handleDurationChange}
                        videoNavExtras={fsNavExtras}
                        fullscreenExtras={modeType === 'workout' ? fsWorkoutExtras : undefined}
                    />
                ) : (
                    <View style={s.missingVideo}>
                        <Text style={s.missingVideoText}>Video not found.</Text>
                        <TouchableOpacity
                            style={s.missingVideoAction}
                            onPress={() => navigation.goBack()}
                        >
                            <Text style={s.missingVideoActionText}>Go Back</Text>
                        </TouchableOpacity>
                    </View>
                )}
              </View>
            </Animated.View>

            {allowInvite && (() => {
                const ytId = sourceVideo?.youtubeId;
                const thumbUrl = ytId
                    ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
                    : sourceVideo?.thumbnail ?? '';
                const workoutCategory = (sourceVideo as any)?.category ?? route?.params?.category;
                const workoutProgram =
                    route?.params?.programName ??
                    route?.params?.workoutTitle ??
                    (sourceVideo as any)?.programName ??
                    activeProgram?.title ??
                    undefined;
                const workoutId =
                    route?.params?.workoutId ??
                    (sourceVideo as any)?.workoutId ??
                    activeProgram?.id ??
                    undefined;
                const workoutTitle =
                    route?.params?.workoutTitle ??
                    route?.params?.programName ??
                    (sourceVideo as any)?.workoutTitle ??
                    (sourceVideo as any)?.programName ??
                    activeProgram?.title ??
                    undefined;
                const selectedWorkout = {
                    id: workoutId,
                    title: workoutTitle,
                };
                const selectedProgram = {
                    id: route?.params?.programId ?? (sourceVideo as any)?.programId ?? activeProgram?.id ?? undefined,
                    title: workoutProgram,
                };
                const selectedCategory = {
                    id: route?.params?.categoryId ?? (sourceVideo as any)?.categoryId ?? undefined,
                    title: workoutCategory,
                };
                const vid = requestedVideoId ?? videoId;

                return (
                    <>
                        {/* ── Live Viewers Modal — who's watching this video right now ── */}
                        <LiveViewersModal
                            visible={showViewersModal}
                            viewers={liveViewers}
                            currentUid={supabaseUserId ?? null}
                            friendUids={friendUids}
                            onClose={() => setShowViewersModal(false)}
                        />

                        {/* ── Unified "Workout Together" — self-contained multi-step sheet ── */}
                        <WorkoutTogetherModal
                            visible={showWorkoutTogetherModal}
                            videoId={vid}
                            videoTitle={title}
                            workoutId={workoutId}
                            workoutTitle={workoutTitle}
                            category={workoutCategory}
                            programName={workoutProgram}
                            thumbnail={thumbUrl || undefined}
                            onClose={() => setShowWorkoutTogetherModal(false)}
                        />

                        {/* ── Legacy InviteTypeSelectorModal (kept for other entry points) ── */}
                        <InviteTypeSelectorModal
                            visible={showInviteTypeModal}
                            videoTitle={title}
                            category={workoutCategory}
                            programName={workoutProgram}
                            thumbnail={thumbUrl || undefined}
                            onStartNow={() => {
                                setShowInviteTypeModal(false);
                                setShowInviteModal(true);
                            }}
                            onSchedule={() => {
                                setShowInviteTypeModal(false);
                                setShowScheduleModal(true);
                            }}
                            onClose={() => setShowInviteTypeModal(false)}
                        />

                        {/* ── Instant invite (Start Now) ── */}
                        <VideoInviteModal
                            visible={showInviteModal}
                            videoId={vid}
                            videoTitle={title}
                            category={workoutCategory}
                            programName={workoutProgram}
                            thumbnail={thumbUrl || undefined}
                            onClose={() => setShowInviteModal(false)}
                        />

                        {/* ── Invite Friend (Scheduled) — pre-fills date when coming from WorkoutTogetherModal ── */}
                        <ScheduleSessionModal
                            visible={showScheduleModal}
                            videoId={vid}
                            videoTitle={title}
                            category={workoutCategory}
                            programName={workoutProgram}
                            selectedWorkout={selectedWorkout}
                            selectedProgram={selectedProgram}
                            selectedCategory={selectedCategory}
                            thumbnail={thumbUrl || undefined}
                            onClose={() => setShowScheduleModal(false)}
                        />

                        <SelfScheduleModal
                            visible={showSelfScheduleModal}
                            videoId={vid}
                            videoTitle={title}
                            workoutId={workoutId}
                            workoutTitle={workoutTitle}
                            category={workoutCategory}
                            programName={workoutProgram}
                            selectedWorkout={selectedWorkout}
                            selectedProgram={selectedProgram}
                            selectedCategory={selectedCategory}
                            thumbnail={thumbUrl || undefined}
                            onClose={() => setShowSelfScheduleModal(false)}
                        />
                    </>
                );
            })()}

            <WorkoutCompletionModal
                visible={showCompletionModal}
                videoTitle={title}
                currentPositionMs={currentPositionMs}
                onDone={handleCompletionDone}
                onKeepGoing={handleCompletionKeepGoing}
                onClose={handleCompletionKeepGoing}
            />

            {/* Move-reminder: ask how many squats they did → add to lifetime total */}
            <SquatCountModal
                visible={showSquatPrompt}
                saving={squatSaving}
                onSubmit={handleLogSquats}
                onSkip={() => setShowSquatPrompt(false)}
            />

            {rewardModal && (
                <RewardUnlockModal
                    visible={true}
                    badgeIds={rewardModal.badgeIds}
                    creditsAwarded={rewardModal.credits}
                    onDismiss={() => setRewardModal(null)}
                />
            )}

            <InviteStrangerModal
                visible={showSocialModal}
                onClose={() => setShowSocialModal(false)}
                onInvite={(targetUser) => {
                    setShowSocialModal(false);
                    setSocialTargetName(targetUser.displayName);
                    sendSocialInvite({
                        targetUserId: targetUser.uid,
                        workoutId: requestedVideoId ?? videoId,
                        workoutTitle: title,
                        workoutThumbnail: sourceVideo?.thumbnail ?? null,
                    });
                }}
                onAddFriend={(user) => {
                    setShowSocialModal(false);
                    Alert.alert('Friend Request Sent', `Request sent to ${user.displayName}`);
                }}
                viewers={liveViewers
                    .filter(v => v.uid !== supabaseUserId)
                    .map(v => ({
                        uid: v.uid,
                        displayName: v.displayName,
                        username: v.username || ('@' + String(v.displayName ?? '').toLowerCase().replace(/\s+/g, 'user')),
                        age: v.age,
                        gender: v.gender,
                    }))
                }
                videoId={requestedVideoId ?? videoId}
                currentUid={supabaseUserId ?? undefined}
                friendUids={friendUids}
                socialHub={socialHub}
                onJoin={handleJoinScheduled}
            />

            <StrangerInviteSenderModal
                visible={socialInviteState.phase !== 'idle'}
                phase={socialInviteState.phase as any}
                targetName={socialTargetName}
                workoutTitle={title}
                secondsLeft={socialInviteState.phase === 'waiting' ? socialInviteState.secondsLeft : 0}
                errorMessage={socialInviteState.phase === 'error' ? socialInviteState.message : undefined}
                onCancel={cancelSocialInvite}
                onDismiss={resetSocialInvite}
            />

            {/* Workout start modal — shows when arriving via notification */}
            <WorkoutStartModal
                visible={showWorkoutStartModal}
                workoutTitle={title}
                thumbnail={sourceVideo?.thumbnail ?? null}
                onDismiss={() => setShowWorkoutStartModal(false)}
                onStartNow={() => {
                    setShowWorkoutStartModal(false);
                    sharedPlayerRef.current?.resumeVideo();
                }}
            />

            {/* Pre-start chooser — Workout vs Watch */}
            <VideoModeModal
                visible={showModeModal}
                title={title}
                onSelect={handleChooseMode}
                onClose={() => handleChooseMode('watch')}
            />

            {/* Co-workout: replace the workout panel with camera tiles */}
            {isCoWorkout ? (
                <CoWorkoutCameraTiles
                    friendName={friendName}
                    remoteUids={remoteUids}
                    cameraPermissionDenied={cameraPermissionDenied}
                />
            ) : (
            <View
                style={[panelStyles.panel, { flex: 1 }, modeType === 'workout' && { backgroundColor: PANEL_DARK }]}
                // A touch anywhere on the section brings the colour back to 100%.
                onTouchStart={modeType === 'watch' ? revealPanel : undefined}
            >

                {/* Title + view count — YouTube-style, hidden in workout mode.
                    Small Workout with Friend + LIVE buttons pinned top-right. */}
                {modeType !== 'workout' && (
                    <View style={[viewsStyles.titleBlock, { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={viewsStyles.titleText} numberOfLines={2}>{title}</Text>
                            <View style={viewsStyles.metaRow}>
                                <Ionicons name="eye-outline" size={14} color="#7A7C90" />
                                <Text style={viewsStyles.metaText}>
                                    {viewCount == null
                                        ? '—'
                                        : `${formatViews(viewCount)} ${viewCount === 1 ? 'view' : 'views'}`}
                                </Text>
                            </View>
                        </View>

                        {allowInvite && (
                            <InviteFooter cta={{
                                title: 'Workout with Friends',
                                subtitle: <Text>Schedule a workout with a friend or yourself <Text style={{ color: '#F25912' }}>your way.</Text></Text>,
                                onWorkoutTogether: () => setShowWorkoutTogetherModal(true),
                                onStartNow: () => setShowInviteModal(true),
                                viewerCount: (() => {
                                    const exactCount = liveViewers.filter(v => v.uid !== supabaseUserId).length;
                                    return exactCount > 0 ? exactCount : undefined;
                                })(),
                                viewers: liveViewers,
                                currentUid: supabaseUserId ?? null,
                                onViewersPress: () => setShowViewersModal(true),
                                onInviteSocial: () => setShowSocialModal(true),
                            }} />
                        )}
                    </View>
                )}

                {/* Reaction buttons — always full opacity, never dims during playback.
                    Active state and persistence are driven by useVideoInteractions
                    (Supabase video_interactions table). Original engagement / favourites
                    side effects (global counts, in-memory favourites list) are preserved. */}
                <EngagementBar
                    engagement={engagementWithPersistedState}
                    isFavorite={interactions.favourited}
                    totalLikes={globalCounts.totalLikes}
                    totalDislikes={globalCounts.totalDislikes}
                    onLike={() => {
                        engagement.toggleLike();
                        interactions.toggleInteraction('liked');
                    }}
                    onDislike={() => {
                        engagement.toggleDislike();
                        interactions.toggleInteraction('disliked');
                    }}
                    onTryIntent={() => {
                        engagement.toggleTryIntent();
                        interactions.toggleInteraction('want_to_try');
                    }}
                    onFavorite={() => {
                        toggleFavorite({
                            id: videoId,
                            title,
                            duration: sourceVideo?.duration ?? '',
                            category: (sourceVideo as any)?.category,
                            videoUrl: sourceVideo?.videoUrl,
                            thumbnail: sourceVideo?.thumbnail,
                            type: 'video',
                        });
                        interactions.toggleInteraction('favourited');
                    }}
                    modeType={modeType}
                    onSwitchMode={switchViewMode}
                    allowInvite={allowInvite}
                    onInviteFriend={() => setShowWorkoutTogetherModal(true)}
                />

                {/* Prev / Next video nav — workout mode only */}
                {modeType === 'workout' && (prevVideo || nextVideo) && (
                    <View style={navStyles.row}>
                        {prevVideo ? (
                            <TouchableOpacity
                                style={[navStyles.card, navStyles.cardLeft]}
                                onPress={() => goToVideo(prevVideo)}
                                activeOpacity={0.8}
                            >
                                <Text style={navStyles.arrow}>‹</Text>
                                {prevVideo.thumbnail ? (
                                    <Image source={{ uri: prevVideo.thumbnail }} style={navStyles.thumb} />
                                ) : (
                                    <View style={[navStyles.thumb, navStyles.thumbFallback]} />
                                )}
                                <View style={navStyles.textCol}>
                                    <Text style={navStyles.label}>Previous</Text>
                                    <Text style={navStyles.titleText} numberOfLines={1}>{prevVideo.title}</Text>
                                </View>
                            </TouchableOpacity>
                        ) : (
                            <View style={navStyles.card} />
                        )}

                        {nextVideo ? (
                            <TouchableOpacity
                                style={[navStyles.card, navStyles.cardRight]}
                                onPress={() => goToVideo(nextVideo)}
                                activeOpacity={0.8}
                            >
                                <View style={[navStyles.textCol, { alignItems: 'flex-end' }]}>
                                    <Text style={navStyles.label}>Up next</Text>
                                    <Text style={navStyles.titleText} numberOfLines={1}>{nextVideo.title}</Text>
                                </View>
                                {nextVideo.thumbnail ? (
                                    <Image source={{ uri: nextVideo.thumbnail }} style={navStyles.thumb} />
                                ) : (
                                    <View style={[navStyles.thumb, navStyles.thumbFallback]} />
                                )}
                                <Text style={navStyles.arrow}>›</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={navStyles.card} />
                        )}
                    </View>
                )}

                {modeType === 'watch' ? (
                    /* Content stays fully opaque — the colour wash (scrim) below
                       is what makes the section recede during playback. */
                    <View style={{ flex: 1 }}>

                        {/* The ONE shared scroll container — drives the video resize
                            for every tab. Each tab renders plain content (no inner
                            ScrollView), so scroll position + video height stay in sync
                            regardless of which tab is active. */}
                        <ScrollView
                            ref={sharedScrollRef}
                            style={panelStyles.scrollArea}
                            contentContainerStyle={{ minHeight: SCREEN_HEIGHT }}
                            showsVerticalScrollIndicator={false}
                            onScroll={handleTabScroll}
                            onScrollBeginDrag={revealPanel}
                            onTouchStart={revealPanel}
                            scrollEventThrottle={16}
                            keyboardShouldPersistTaps="handled"
                        >
                            {activeTab === 'social' ? renderSocialContent()
                                : activeTab === 'requirements' ? renderRequirementsContent()
                                : renderFaqQaContent()}
                        </ScrollView>

                        {/* Tab order: Social → Requirements → FAQ & Q&A */}
                        <View style={panelStyles.tabRow}>
                            {allowInvite && (
                                <TouchableOpacity
                                    style={[panelStyles.tab, activeTab === 'social' && panelStyles.tabActive]}
                                    onPress={() => switchTab('social')}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Text style={[panelStyles.tabText, activeTab === 'social' && panelStyles.tabTextActive]}>Community</Text>
                                        {(() => {
                                            const exactCount = liveViewers.filter(v => v.uid !== supabaseUserId).length;
                                            const fallback = Math.max(0, (viewerCount || 1) - 1);
                                            const n = liveViewers.length > 0 ? exactCount : fallback;
                                            return n > 0 ? (
                                                <View style={panelStyles.socialLiveChip}>
                                                    <View style={panelStyles.socialLiveDot} />
                                                    <Text style={panelStyles.socialLiveChipText}>{n}</Text>
                                                </View>
                                            ) : null;
                                        })()}
                                    </View>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[panelStyles.tab, activeTab === 'requirements' && panelStyles.tabActive]}
                                onPress={() => switchTab('requirements')}
                            >
                                <Text style={[panelStyles.tabText, activeTab === 'requirements' && panelStyles.tabTextActive]}>
                                    Requirements
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[panelStyles.tab, activeTab === 'faq-qa' && panelStyles.tabActive]}
                                onPress={() => switchTab('faq-qa')}
                            >
                                <Text style={[panelStyles.tabText, activeTab === 'faq-qa' && panelStyles.tabTextActive]}>
                                    FAQ & Q&A
                                </Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                ) : (
                    /* Workout Mode panel */
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={panelStyles.workoutPanel}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {timerState === 'countdown' && countdownPhase ? (
                            <Text style={panelStyles.countdownText}>{countdownPhase}</Text>
                        ) : (
                            <>
                                {(() => {
                                    const RING_SIZE = 220;
                                    const STROKE = 8;
                                    const RADIUS = (RING_SIZE - STROKE) / 2;
                                    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
                                    // One full rotation every 60 s, repeating
                                    const progress = timerState === 'running'
                                        ? (workoutElapsed % 60) / 60
                                        : 0;
                                    const dashOffset = CIRCUMFERENCE * (1 - progress);
                                    return (
                                        <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                                            <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: 'absolute' }}>
                                                {/* Track */}
                                                <Circle
                                                    cx={RING_SIZE / 2}
                                                    cy={RING_SIZE / 2}
                                                    r={RADIUS}
                                                    stroke="rgba(255,255,255,0.08)"
                                                    strokeWidth={STROKE}
                                                    fill="none"
                                                />
                                                {/* Progress arc */}
                                                <Circle
                                                    cx={RING_SIZE / 2}
                                                    cy={RING_SIZE / 2}
                                                    r={RADIUS}
                                                    stroke="#F25912"
                                                    strokeWidth={STROKE}
                                                    fill="none"
                                                    strokeDasharray={CIRCUMFERENCE}
                                                    strokeDashoffset={dashOffset}
                                                    strokeLinecap="round"
                                                    rotation="-90"
                                                    origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                                                />
                                            </Svg>
                                            <Text style={panelStyles.timerText}>{formatWorkoutTime(workoutElapsed)}</Text>
                                            <Text style={panelStyles.timerLabel}>
                                                {timerState === 'running'
                                                    ? (workoutPaused ? 'paused' : 'in progress')
                                                    : 'ready'}
                                            </Text>
                                        </View>
                                    );
                                })()}
                                {timerState === 'idle' ? (
                                    <TouchableOpacity style={panelStyles.startBtn} onPress={startWorkout} activeOpacity={0.8}>
                                        <Text style={panelStyles.startBtnText}>Start</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View style={panelStyles.timerControls}>
                                        <TouchableOpacity
                                            style={panelStyles.pauseBtn}
                                            onPress={toggleWorkoutPause}
                                            activeOpacity={0.8}
                                            disabled={timerState !== 'running'}
                                        >
                                            <Text style={panelStyles.pauseBtnText}>
                                                {workoutPaused ? 'Resume' : 'Pause'}
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={panelStyles.resetBtn} onPress={resetWorkout} activeOpacity={0.8}>
                                            <Text style={panelStyles.resetBtnText}>Stop</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Live coaching cue — always visible, values synced to the timer */}
                                {activeCue && (
                                    <View style={panelStyles.cueCard}>
                                        <Text style={panelStyles.cuePhase}>{activeCue.label}</Text>
                                        <View style={panelStyles.cueStatsRow}>
                                            <View style={panelStyles.cueStat}>
                                                <Text style={panelStyles.cueStatValue} numberOfLines={1} adjustsFontSizeToFit>{activeCue.reps}</Text>
                                                <Text style={panelStyles.cueStatLabel}>reps</Text>
                                            </View>
                                            <View style={panelStyles.cueDivider} />
                                            <View style={[panelStyles.cueStat, panelStyles.cueStatWide]}>
                                                <Text style={panelStyles.cueStatValue} numberOfLines={1}>{activeCue.weight}</Text>
                                                <Text style={panelStyles.cueStatLabel}>load</Text>
                                            </View>
                                            <View style={panelStyles.cueDivider} />
                                            <View style={panelStyles.cueStat}>
                                                <Text style={panelStyles.cueStatValue} numberOfLines={1} adjustsFontSizeToFit>{formatWorkoutTime(cueSegmentElapsed)}</Text>
                                                <Text style={panelStyles.cueStatLabel}>in set</Text>
                                            </View>
                                        </View>
                                        {activeCue.tip ? <Text style={panelStyles.cueTip}>{activeCue.tip}</Text> : null}
                                    </View>
                                )}
                            </>
                        )}
                    </ScrollView>
                )}

                {/* Colour wash over the whole section while the video plays.
                    pointerEvents="none" so controls underneath stay tappable. */}
                {modeType === 'watch' && (
                    <Animated.View
                        pointerEvents="none"
                        style={[StyleSheet.absoluteFillObject, { backgroundColor: panelScrimColor }]}
                    />
                )}
            </View>
            )}
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const navStyles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 10,
    },
    card: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    cardLeft: { justifyContent: 'flex-start' },
    cardRight: { justifyContent: 'flex-end' },
    arrow: { color: '#F25912', fontSize: 22, fontWeight: '800' },
    thumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.08)' },
    thumbFallback: { backgroundColor: 'rgba(242,89,18,0.18)' },
    textCol: { flex: 1, minWidth: 0 },
    label: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    titleText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

const viewsStyles = StyleSheet.create({
    titleBlock: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 6,
    },
    titleText: {
        color: '#211832',
        fontSize: 16,
        fontWeight: '700',
        lineHeight: 21,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    metaText: {
        color: '#7A7C90',
        fontSize: 12,
        fontWeight: '600',
    },
});

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    playerSection: {
        width: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
    },
    missingVideo: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        backgroundColor: '#000',
    },
    missingVideoText: {
        color: '#fff',
        fontSize: 18,
        marginBottom: 16,
    },
    missingVideoAction: {
        backgroundColor: '#F25912',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
    },
    missingVideoActionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    ytBackBtn: {
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Co-workout LIVE pill — rendered inside SharedVideoPlayer's headerTitleContainer
    liveIndicatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#00ff88',
        marginRight: 4,
    },
    liveText: {
        color: '#00ff88',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
});

// Fullscreen workout overlay (rendered on top of the video in fullscreen only).
const fsStyles = StyleSheet.create({
    navBtn: {
        position: 'absolute',
        top: 16,
        maxWidth: '38%',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    navLeft: { left: 16, alignItems: 'flex-start' },
    navRight: { right: 16, alignItems: 'flex-end' },
    navHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
    navHintRight: { textAlign: 'right' },
    navText: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 1 },
    navTextRight: { textAlign: 'right' },
    countdownWrap: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countdownText: {
        color: '#fff',
        fontSize: 72,
        fontWeight: '900',
        letterSpacing: 1,
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowRadius: 12,
    },
    bottomBar: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 28,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    timerText: {
        color: '#fff',
        fontSize: 30,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
        textShadowColor: 'rgba(0,0,0,0.6)',
        textShadowRadius: 8,
    },
    controlsRow: { flexDirection: 'row', gap: 12 },
    startBtn: {
        backgroundColor: '#F25912',
        paddingHorizontal: 40,
        paddingVertical: 12,
        borderRadius: 26,
    },
    startBtnText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
    pauseBtn: {
        backgroundColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 26,
    },
    pauseBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    stopBtn: {
        backgroundColor: 'rgba(239,68,68,0.85)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 26,
    },
    stopBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

const panelStyles = StyleSheet.create({
    panel: {
        flex: 1,
        backgroundColor: PANEL_BG,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
        elevation: 12,
        overflow: 'hidden',
    },
    scrollArea: {
        flex: 1,
    },
    tabRow: {
        flexDirection: 'row',
        marginHorizontal: 16,
        marginBottom: 24,
        marginTop: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        padding: 3,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 10,
    },
    tabActive: {
        backgroundColor: '#4C4E78',
    },
    tabText: {
        color: '#7A7C90',
        fontSize: 14,
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#fff',
    },
    socialLiveChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(76,78,120,0.2)',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 6,
    },
    socialLiveDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#22c55e',
    },
    socialLiveChipText: {
        color: '#4C4E78',
        fontSize: 10,
        fontWeight: '700',
    },
    sectionHeading: {
        fontSize: 13,
        fontWeight: '700',
        color: '#4C4E78',
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#F8F8FC',
        marginHorizontal: 16,
        marginVertical: 8,
    },
    faqItem: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 8,
    },
    faqQuestionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    faqQuestion: {
        color: '#211832',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
        marginRight: 8,
    },
    faqChevron: {
        color: ACCENT,
        fontSize: 10,
    },
    faqAnswer: {
        color: '#7A7C90',
        fontSize: 13,
        lineHeight: 20,
        marginTop: 10,
    },
    workoutPanel: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 32,
        gap: 12,
    },
    timerText: {
        color: '#F25912',
        fontSize: 56,
        fontWeight: '900',
        letterSpacing: 2,
    },
    timerLabel: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    countdownText: {
        color: '#fff',
        fontSize: 80,
        fontWeight: '900',
        letterSpacing: 2,
    },
    startBtn: {
        backgroundColor: '#F25912',
        paddingHorizontal: 56,
        paddingVertical: 16,
        borderRadius: 30,
        marginTop: 12,
    },
    startBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    timerControls: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 12,
        alignSelf: 'stretch',
        paddingHorizontal: 16,
    },
    pauseBtn: {
        flex: 1,
        backgroundColor: '#F25912',
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
    },
    pauseBtnText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    resetBtn: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingVertical: 16,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        alignItems: 'center',
    },
    resetBtnText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 18,
        fontWeight: '700',
    },
    cueCard: {
        alignSelf: 'stretch',
        marginTop: 16,
        // Pull outward past the panel's 24px horizontal padding so the card is
        // wide enough to show full stat values (e.g. "Bodyweight").
        marginHorizontal: -16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(242,89,18,0.25)',
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 14,
    },
    cuePhase: {
        color: '#F25912',
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: 12,
    },
    cueStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    cueStat: { flex: 1, alignItems: 'center', paddingHorizontal: 4, minWidth: 0 },
    cueStatWide: { flex: 1.5 },
    cueStatValue: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' },
    cueStatLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 4,
    },
    cueDivider: { width: 1, height: 34, backgroundColor: 'rgba(255,255,255,0.1)' },
    cueTip: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 17,
    },
});

const commentStyles = StyleSheet.create({
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(33,24,50,0.08)',
    },
    myAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: ACCENT,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    myAvatarText: {
        color: '#211832',
        fontSize: 14,
        fontWeight: '700',
    },
    input: {
        flex: 1,
        backgroundColor: '#F8F8FC',
        color: '#211832',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        minHeight: 42,
        maxHeight: 80,
        fontSize: 14,
    },
    postBtn: {
        backgroundColor: '#F25912',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    postBtnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    empty: {
        color: '#7A7C90',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 14,
    },
    commentCard: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    avatarText: {
        color: '#211832',
        fontSize: 14,
        fontWeight: '700',
    },
    commentContent: {
        flex: 1,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 2,
    },
    username: {
        color: '#211832',
        fontSize: 14,
        fontWeight: '600',
    },
    timestamp: {
        color: '#7A7C90',
        fontSize: 12,
    },
    commentText: {
        color: '#211832',
        fontSize: 14,
        lineHeight: 20,
        opacity: 0.9,
    },
    likeRow: {
        marginTop: 6,
        alignSelf: 'flex-start',
        padding: 4,
    },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(33,24,50,0.08)',
    },
    typeLabel: {
        color: '#7A7C90',
        fontSize: 13,
        fontWeight: '500',
    },
    typeChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.1)',
    },
    typeChipActive: {
        backgroundColor: 'rgba(242,89,18,0.15)',
        borderColor: ACCENT,
    },
    typeChipText: {
        color: '#7A7C90',
        fontSize: 13,
        fontWeight: '600',
    },
    typeChipTextActive: {
        color: ACCENT,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
    },
    typeBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
});

const socialStyles = StyleSheet.create({
    sectionCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.06)',
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 14,
    },
    sectionLabel: {
        color: '#C7D2FE',
        fontSize: 12,
        fontWeight: '800',
        marginBottom: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        gap: 10,
    },
    rowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(33,24,50,0.06)',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { color: '#211832', fontSize: 14, fontWeight: '700' },
    name: { color: '#211832', fontSize: 14, fontWeight: '700' },
    sub: { color: '#7A7C90', fontSize: 12, marginTop: 1 },
    scheduleTop: { color: '#211832', fontSize: 12, fontWeight: '700', marginTop: 2 },
    emptyText: { color: '#7A7C90', fontSize: 13, paddingVertical: 4 },
    softBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(242,89,18,0.4)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    softBtnText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
    ctaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F25912',
        borderRadius: 8,
        paddingHorizontal: 9,
        paddingVertical: 6,
    },
    ctaBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    joinBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#0ea5a3',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    joinBtnText: { color: '#211832', fontSize: 12, fontWeight: '700' },
    scheduledBadge: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.12)',
    },
    scheduledBtnText: { color: '#7A7C90', fontSize: 11, fontWeight: '600' },
    scheduledBadgeText: { color: '#7A7C90', fontSize: 11, fontWeight: '600' },
});

const reqStyles = StyleSheet.create({
    sectionCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.06)',
    },
    sectionRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12,
    },
    metaCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.06)',
    },
    metaLabel: {
        color: 'rgba(33,24,50,0.45)',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginLeft: 6,
        textTransform: 'uppercase',
    },
    metaValue: {
        color: '#211832',
        fontSize: 13,
        marginTop: 6,
        lineHeight: 18,
    },
    subLabel: {
        color: '#211832',
        fontSize: 13,
        fontWeight: '700',
        marginTop: 16,
    },
    moreBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        alignSelf: 'center',
        paddingVertical: 10,
        paddingHorizontal: 18,
        marginBottom: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(76,78,120,0.3)',
        backgroundColor: 'rgba(76,78,120,0.08)',
    },
    moreBtnText: {
        color: '#4C4E78',
        fontSize: 13,
        fontWeight: '700',
    },
    iconRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default React.memo(VideoPlayerScreen);

