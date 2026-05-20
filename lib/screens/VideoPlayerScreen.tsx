import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoInviteModal } from '../components/VideoInviteModal';
import { InviteTypeSelectorModal } from '../components/InviteTypeSelectorModal';
import { ScheduleSessionModal } from '../components/ScheduleSessionModal';
import { SelfScheduleModal } from '../components/SelfScheduleModal';
import { SharedVideoPlayer, SharedVideoPlayerRef } from '../components/SharedVideoPlayer';
import { WorkoutStartModal } from '../components/WorkoutStartModal';
import MuscleVisualizer from '../components/MuscleVisualizer';
import { WorkoutCompletionModal } from '../components/workout/WorkoutCompletionModal';
import { ExerciseListTab } from '../components/workout/ExerciseListTab';
import { InviteStrangerModal } from '../components/workout/InviteStrangerModal';
import { StrangerInviteSenderModal } from '../components/StrangerInviteSenderModal';
import { useSocialInvite } from '../hooks/useStrangerInvite';
import { useVideoPlayerNotificationParams } from '../hooks/useVideoPlayerNotificationParams';
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
import { WatchTrackingService } from '../services/watchTracking.service';
import { useVideoEngagement } from '../hooks/useVideoEngagement';
import { useVideoGlobalCounts, formatCount } from '../services/videoEngagement.service';
import { getSimilarPrograms, RecommendedProgram } from '../services/recommendation.service';
import { useFocusEffect } from '@react-navigation/native';

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
}: EngagementBarProps) {
    const { state } = engagement;

    const buttons = [
        {
            key: 'like',
            label: totalLikes > 0 ? formatCount(totalLikes) : 'Like',
            icon: '👍',
            active: state.liked,
            onPress: onLike,
        },
        {
            key: 'dislike',
            label: totalDislikes > 0 ? formatCount(totalDislikes) : 'Dislike',
            icon: '👎',
            active: state.disliked,
            onPress: onDislike,
        },
        { key: 'try', label: state.tryIntent ? 'Trying' : 'Want to try it', icon: '🔥', active: state.tryIntent, onPress: onTryIntent },
        { key: 'fav', label: isFavorite ? 'Favorited' : 'Favorite',          icon: '❤️', active: isFavorite,      onPress: onFavorite },
    ];

    return (
        <View style={engagementStyles.container}>
            {buttons.map((btn) => (
                <TouchableOpacity
                    key={btn.key}
                    style={[engagementStyles.pill, btn.active && engagementStyles.pillActive]}
                    onPress={btn.onPress}
                    activeOpacity={0.7}
                >
                    <Text style={engagementStyles.pillIcon}>{btn.icon}</Text>
                    <Text style={[engagementStyles.pillLabel, btn.active && engagementStyles.pillLabelActive]}>
                        {btn.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const engagementStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        flexWrap: 'wrap',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    pillActive: {
        backgroundColor: 'rgba(249,115,22,0.15)',
        borderColor: '#F97316',
    },
    pillIcon: {
        fontSize: 13,
    },
    pillLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '600',
    },
    pillLabelActive: {
        color: '#F97316',
    },
});

const ACCENT = '#F97316';
const PANEL_BG = '#1a1a2e';

const FAQ_ITEMS = [
    {
        question: 'How long should I wear GripCuff?',
        answer: 'We recommend 20\u201330 minutes per session, 3\u20134 times a week for best results.',
    },
    {
        question: 'Is GripCuff suitable for beginners?',
        answer: 'Yes! Start with lighter resistance and increase gradually.',
    },
    {
        question: 'How do I clean my GripCuff?',
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
    GripCuff: [
        { equipment: 'GripCuff Device', description: 'Adjustable resistance cuff for grip training' },
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    const { hasAccess, showPaywall } = useAccess();
    const { profile } = useUser();
    const { supabaseUserId, email } = useAuth();

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
    const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastPaywallBucketRef = useRef(0);
    const watchStartRef = useRef<number | null>(null);
    // Tracks the furthest video position seen — more accurate than wall clock for watch time
    const maxWatchedMsRef = useRef(0);
    const elapsedSecondsRef = useRef(0);
    const completionFiredRef = useRef(false);
    const durationMsRef = useRef(0);          // populated by onDurationChange
    const handleVideoEndRef = useRef<() => Promise<void>>(async () => {});
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

    // Cleanup completion timer on unmount
    useEffect(() => {
        return () => {
            if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
        };
    }, []);

    // Handle workout start modal from notification params
    const notificationParams = useVideoPlayerNotificationParams();
    useEffect(() => {
        if (notificationParams?.fromNotification && notificationParams?.workoutId) {
            setShowWorkoutStartModal(true);
        }
    }, [notificationParams?.fromNotification, notificationParams?.workoutId]);

    // Track watch time and report to leaderboard on unmount.
    // Use actual video position (maxWatchedMsRef) — falls back to wall clock if player never reported.
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
            // Flush any remaining tracked seconds that haven't been persisted yet
            WatchTrackingService.stopSession();
            WatchTrackingService.flushNow().catch(() => {});
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
        if (posMs > maxWatchedMsRef.current) maxWatchedMsRef.current = posMs;
        elapsedSecondsRef.current = Math.floor(posMs / 1000);

        // 80% threshold check — fire completion as soon as enough has been watched
        // (guards against users who skip/close before the video fully ends)
        const durMs = durationMsRef.current;
        if (
            !completionFiredRef.current &&
            durMs > 0 &&
            maxWatchedMsRef.current / durMs >= 0.8
        ) {
            console.log('[Completion] 80% threshold reached — recording');
            handleVideoEndRef.current().catch(() => {});
        }

        if (!hasAccess) {
            const currentBucket = Math.floor(posMs / 5000);
            if (currentBucket > 0 && currentBucket > lastPaywallBucketRef.current) {
                lastPaywallBucketRef.current = currentBucket;
                sharedPlayerRef.current?.pauseVideo();
                showPaywall();
            }
        } else {
            lastPaywallBucketRef.current = 0;
        }
    }, [hasAccess, showPaywall]);

    useEffect(() => {
        if (!hasAccess) return;
        lastPaywallBucketRef.current = 0;
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
        if (!uid || !videoId) return;
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
                : category === 'GripCuff'
                    ? 'gripcuff'
                    : 'workout_program';

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

    // Lights-out: dim the panel when the video is actively playing
    const panelDimAnim = useRef(new Animated.Value(1)).current;
    const setLightsOut = useCallback((playing: boolean) => {
        Animated.timing(panelDimAnim, {
            toValue: playing ? 0.15 : 1,
            duration: 400,
            useNativeDriver: Platform.OS !== 'web',
        }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Watch tracking: start/stop per play state, stable uid ref so callback is stable
    const supabaseUserIdRef = useRef(supabaseUserId);
    supabaseUserIdRef.current = supabaseUserId;
    const handlePlayStateChange = useCallback((playing: boolean) => {
        setLightsOut(playing);
        const uid = supabaseUserIdRef.current;
        if (!uid) return;
        if (playing) {
            WatchTrackingService.startSession(uid);
        } else {
            WatchTrackingService.stopSession();
        }
    }, [setLightsOut]);

    const handleBack = useCallback(() => navigation.goBack(), [navigation]);

    // Pause video when navigating away, resume when returning.
    // Also stop watch tracking on blur and flush any pending seconds.
    useFocusEffect(useCallback(() => {
        sharedPlayerRef.current?.resumeVideo();
        return () => {
            sharedPlayerRef.current?.pauseVideo();
            WatchTrackingService.stopSession();
            WatchTrackingService.flushNow().catch(() => {});
            if (completionTimerRef.current) {
                clearTimeout(completionTimerRef.current);
                completionTimerRef.current = null;
            }
        };
    }, []));

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
                const state = data?.info?.playerState ?? data?.info;
                if (typeof state === 'number') {
                    setLightsOut(state === 1 || state === 3);
                    if (state === 0) {
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
        const colors = ['#D4622A', '#8B5CF6', '#10B981', '#3B82F6', '#E8732A'];
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
        const avatarPalette = ['#D4622A', '#8B5CF6', '#10B981', '#3B82F6'];
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
            <ScrollView
                style={panelStyles.scrollArea}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Live Now */}
                <View style={socialStyles.sectionCard}>
                    <Text style={socialStyles.sectionLabel}>LIVE NOW</Text>
                    {otherViewers.length === 0 ? (
                        <Text style={socialStyles.emptyText}>You're the only one here.</Text>
                    ) : (
                        otherViewers.map((v, i) => (
                            <View key={v.uid} style={[socialStyles.row, i < otherViewers.length - 1 && socialStyles.rowBorder]}>
                                <View style={[socialStyles.avatar, { backgroundColor: avatarColor(v.displayName || '?') }]}>
                                    <Text style={socialStyles.avatarText}>{(v.displayName || '?')[0].toUpperCase()}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={socialStyles.name}>{v.displayName}</Text>
                                    {v.username ? <Text style={socialStyles.sub}>@{v.username}</Text> : null}
                                </View>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    <TouchableOpacity
                                        style={socialStyles.softBtn}
                                        onPress={() => Alert.alert('Friend Request Sent', `Request sent to ${v.displayName}`)}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="person-add-outline" size={13} color={ACCENT} />
                                        <Text style={socialStyles.softBtnText}>Add</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={socialStyles.ctaBtn}
                                        onPress={() => {
                                            setSocialTargetName(v.displayName);
                                            sendSocialInvite({ targetUserId: v.uid, workoutId: requestedVideoId ?? videoId, workoutTitle: title, workoutThumbnail: sourceVideo?.thumbnail ?? null });
                                        }}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="barbell-outline" size={13} color="#fff" />
                                        <Text style={socialStyles.ctaBtnText}>Invite</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>

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
                                    <View style={[socialStyles.avatar, { backgroundColor: avatarColor(entry.displayName || '?') }]}>
                                        <Text style={socialStyles.avatarText}>{(entry.displayName || '?')[0].toUpperCase()}</Text>
                                    </View>
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

                {/* Open Stranger Sessions */}
                <View style={socialStyles.sectionCard}>
                    <Text style={socialStyles.sectionLabel}>OPEN STRANGER SESSIONS</Text>
                    {socialHub.open.length === 0 ? (
                        <Text style={socialStyles.emptyText}>No open sessions right now.</Text>
                    ) : (
                        socialHub.open.map((entry, i) => (
                            <View key={entry.id} style={[socialStyles.row, i < socialHub.open.length - 1 && socialStyles.rowBorder]}>
                                <View style={[socialStyles.avatar, { backgroundColor: avatarColor(entry.hostName || '?') }]}>
                                    <Text style={socialStyles.avatarText}>{(entry.hostName || '?')[0].toUpperCase()}</Text>
                                </View>
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
                                    <Ionicons name="calendar-outline" size={13} color="#fff" />
                                    <Text style={socialStyles.joinBtnText}>Join</Text>
                                </TouchableOpacity>
                            </View>
                        ))
                    )}
                </View>
            </ScrollView>
        );
    };

    const renderRequirementsContent = () => (
        <ScrollView
            style={panelStyles.scrollArea}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
        >
            {/* Equipment & Muscles */}
            <View style={reqStyles.sectionRow}>
                <View style={reqStyles.metaCard}>
                    <View style={reqStyles.iconRow}>
                        <Ionicons name="barbell-outline" size={18} color={ACCENT} />
                        <Text style={reqStyles.metaLabel}>Equipment</Text>
                    </View>
                    <Text style={reqStyles.metaValue}>{reqData.equipment}</Text>
                </View>
                <View style={reqStyles.metaCard}>
                    <View style={reqStyles.iconRow}>
                        <Ionicons name="body-outline" size={18} color={ACCENT} />
                        <Text style={reqStyles.metaLabel}>Muscles Targeted</Text>
                    </View>
                    <Text style={reqStyles.metaValue}>{reqData.muscles}</Text>
                </View>
            </View>

            {/* Exercise Type */}
            <View style={reqStyles.sectionCard}>
                <View style={reqStyles.iconRow}>
                    <Ionicons name="git-branch-outline" size={18} color={ACCENT} />
                    <Text style={reqStyles.metaLabel}>Exercise Type</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    {(['General', 'Strength', 'Stretching', 'Injury', 'Athletic'] as const).map((type) => {
                        const active = reqData.exerciseType === type;
                        return (
                            <View key={type} style={{
                                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                                borderColor: active ? ACCENT : 'rgba(255,255,255,0.1)',
                                backgroundColor: active ? 'rgba(249,115,22,0.15)' : 'transparent',
                            }}>
                                <Text style={{ color: active ? ACCENT : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' }}>
                                    {type}
                                </Text>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Experience Level */}
            <View style={reqStyles.sectionCard}>
                <View style={reqStyles.iconRow}>
                    <Ionicons name="trophy-outline" size={18} color={ACCENT} />
                    <Text style={reqStyles.metaLabel}>Experience Level</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    {(['Beginner', 'Intermediate', 'Advanced'] as const).map((lvl) => {
                        const active = reqData.experienceLevel === lvl;
                        return (
                            <View key={lvl} style={{
                                paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
                                borderColor: active ? ACCENT : 'rgba(255,255,255,0.1)',
                                backgroundColor: active ? 'rgba(249,115,22,0.15)' : 'transparent',
                            }}>
                                <Text style={{ color: active ? ACCENT : 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600' }}>
                                    {lvl}
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
                                        i < featuredExercises.length - 1 && { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
                                    ]}
                                >
                                    <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: ACCENT, flexShrink: 0 }} />
                                    <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500', flex: 1 }}>{ex.name}</Text>
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

            {/* Similar Workouts */}
            {similarPrograms.length > 0 && (
                <View style={{ marginTop: 16, paddingBottom: 8 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 16, marginBottom: 0 }}>
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
                                    navigation.navigate('VideoPlayer', {
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
                                    borderColor: 'rgba(255,255,255,0.08)',
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
                                    <View
                                        style={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            backgroundColor: 'rgba(0,0,0,0.6)',
                                            borderRadius: 5,
                                            paddingHorizontal: 5,
                                            paddingVertical: 2,
                                        }}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>
                                            {item.level.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ padding: 7 }}>
                                    <Text
                                        numberOfLines={2}
                                        style={{ color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 15 }}
                                    >
                                        {item.title}
                                    </Text>
                                    <Text style={{ color: ACCENT, fontSize: 9, marginTop: 3 }}>
                                        {item.totalVideos} videos
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </ScrollView>
    );

    const canPost = newComment.trim().length > 0 && commentType !== null;

    const renderFaqQaContent = () => (
        <ScrollView
            style={panelStyles.scrollArea}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
        >
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
                    placeholderTextColor="#3a5a7a"
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
                                                : '#607a94',
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
        </ScrollView>
    );

    return (
        <KeyboardAvoidingView
            style={s.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* Video player — top half */}
            <View style={s.playerSection}>
                {isYT ? (
                    <View style={{ width: '100%', height: 220, backgroundColor: '#000' }}>
                        <WebYouTubePlayer videoId={youtubeId} />
                        <TouchableOpacity
                            style={s.ytBackBtn}
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="arrow-back" size={22} color="#fff" />
                        </TouchableOpacity>
                    </View>
                ) : sourceVideo?.videoUrl ? (
                    <SharedVideoPlayer
                        ref={sharedPlayerRef}
                        title={title}
                        videoUri={sourceVideo.videoUrl}
                        onBack={handleBack}
                        actionLabel="Done"
                        onActionPress={triggerCompletionCheck}
                        onPlayStateChange={handlePlayStateChange}
                        onSeekForward={triggerCompletionCheck}
                        onVideoEnd={handleVideoEndCallback}
                        onCurrentPositionChange={handlePositionChange}
                        onDurationChange={handleDurationChange}
                        inviteCta={allowInvite ? {
                            title: 'Invite a Friend',
                            subtitle: <Text>Instantly workout with a friend <Text style={{ color: '#F97316' }}>right now.</Text></Text>,
                            onPress: () => setShowInviteTypeModal(true),
                            viewerCount: (() => {
                                const count = Math.max(0, (viewerCount || 1) - 1);
                                const exactCount = liveViewers.filter(v => v.uid !== supabaseUserId).length;
                                const finalCount = liveViewers.length > 0 ? exactCount : count;
                                return finalCount > 0 ? finalCount : undefined;
                            })(),
                            onInviteSocial: () => setShowSocialModal(true),
                            onScheduleSelf: () => setShowSelfScheduleModal(true),
                        } : undefined}
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

                        <VideoInviteModal
                            visible={showInviteModal}
                            videoId={vid}
                            videoTitle={title}
                            category={workoutCategory}
                            programName={workoutProgram}
                            thumbnail={thumbUrl || undefined}
                            onClose={() => setShowInviteModal(false)}
                        />

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

            {/* Panel — bottom half, dims when video is playing (lights-out mode) */}
            <Animated.View style={[panelStyles.panel, { opacity: panelDimAnim }]}>
                {/* Engagement action bar */}
                <EngagementBar
                    engagement={engagement}
                    isFavorite={isFavorite(videoId)}
                    totalLikes={globalCounts.totalLikes}
                    totalDislikes={globalCounts.totalDislikes}
                    onLike={engagement.toggleLike}
                    onDislike={engagement.toggleDislike}
                    onTryIntent={engagement.toggleTryIntent}
                    onFavorite={() => toggleFavorite({
                        id: videoId,
                        title,
                        duration: sourceVideo?.duration ?? '',
                        category: (sourceVideo as any)?.category,
                        videoUrl: sourceVideo?.videoUrl,
                        thumbnail: sourceVideo?.thumbnail,
                        type: 'video',
                    })}
                />

                {/* Scrollable content area */}
                {activeTab === 'social' ? renderSocialContent()
                    : activeTab === 'requirements' ? renderRequirementsContent()
                    : renderFaqQaContent()}

                {/* Tab order: Social → Requirements → FAQ & Q&A */}
                <View style={panelStyles.tabRow}>
                    {allowInvite && (
                        <TouchableOpacity
                            style={[panelStyles.tab, activeTab === 'social' && panelStyles.tabActive]}
                            onPress={() => setActiveTab('social')}
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
                        onPress={() => setActiveTab('requirements')}
                    >
                        <Text style={[panelStyles.tabText, activeTab === 'requirements' && panelStyles.tabTextActive]}>
                            Requirements
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[panelStyles.tab, activeTab === 'faq-qa' && panelStyles.tabActive]}
                        onPress={() => setActiveTab('faq-qa')}
                    >
                        <Text style={[panelStyles.tabText, activeTab === 'faq-qa' && panelStyles.tabTextActive]}>
                            FAQ & Q&A
                        </Text>
                    </TouchableOpacity>
                </View>
            </Animated.View>
        </KeyboardAvoidingView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    playerSection: {
        flex: 1,
        minHeight: 260,
        backgroundColor: '#000',
    },
    missingVideo: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        backgroundColor: '#000',
    },
    missingVideoText: {
        color: 'white',
        fontSize: 18,
        marginBottom: 16,
    },
    missingVideoAction: {
        backgroundColor: '#FF6B00',
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
    },
    missingVideoActionText: {
        color: 'white',
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
        backgroundColor: ACCENT,
    },
    tabText: {
        color: '#94A3B8',
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
        backgroundColor: 'rgba(255,107,0,0.2)',
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
        color: '#FF6B00',
        fontSize: 10,
        fontWeight: '700',
    },
    sectionHeading: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FF6B00',
        textTransform: 'uppercase',
        letterSpacing: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    sectionDivider: {
        height: 1,
        backgroundColor: '#1e2d3d',
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
        color: '#fff',
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
        color: '#94A3B8',
        fontSize: 13,
        lineHeight: 20,
        marginTop: 10,
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
        borderBottomColor: 'rgba(255,255,255,0.08)',
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
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    input: {
        flex: 1,
        backgroundColor: '#1c3a56',
        color: '#ffffff',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 12,
        minHeight: 42,
        maxHeight: 80,
        fontSize: 14,
    },
    postBtn: {
        backgroundColor: ACCENT,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    postBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    empty: {
        color: '#607a94',
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
        color: '#fff',
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
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    timestamp: {
        color: '#607a94',
        fontSize: 12,
    },
    commentText: {
        color: '#ffffff',
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
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    typeLabel: {
        color: '#607a94',
        fontSize: 13,
        fontWeight: '500',
    },
    typeChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    typeChipActive: {
        backgroundColor: 'rgba(249,115,22,0.15)',
        borderColor: ACCENT,
    },
    typeChipText: {
        color: '#94A3B8',
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
        borderColor: 'rgba(255,255,255,0.06)',
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
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    name: { color: '#fff', fontSize: 14, fontWeight: '700' },
    sub: { color: '#9CA3AF', fontSize: 12, marginTop: 1 },
    scheduleTop: { color: '#F3F4F6', fontSize: 12, fontWeight: '700', marginTop: 2 },
    emptyText: { color: '#9CA3AF', fontSize: 13, paddingVertical: 4 },
    softBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.4)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    softBtnText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
    ctaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: ACCENT,
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
    joinBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    scheduledBadge: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    scheduledBtnText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600' },
    scheduledBadgeText: { color: '#9CA3AF', fontSize: 11, fontWeight: '600' },
});

const reqStyles = StyleSheet.create({
    sectionCard: {
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
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
        borderColor: 'rgba(255,255,255,0.06)',
    },
    metaLabel: {
        color: 'rgba(255,255,255,0.45)',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginLeft: 6,
        textTransform: 'uppercase',
    },
    metaValue: {
        color: '#fff',
        fontSize: 13,
        marginTop: 6,
        lineHeight: 18,
    },
    iconRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default React.memo(VideoPlayerScreen);

