import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    Image,
    Alert,
    Platform,
    Modal,
    ActivityIndicator,
    TextInput,
    KeyboardAvoidingView,
    FlatList,
    ScrollView
} from 'react-native';
import { Clipboard, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, UserPlus, Calendar, Clock, PlayCircle, Check, CircleUserRound, Zap, Users, Bell, ChevronRight, Search, Contact, Flame, PersonStanding, HeartPulse } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { useFriend } from '../providers/FriendContext';
import { useLibrary } from '../providers/LibraryContext';
import { useWorkoutSession } from '../providers/WorkoutSessionContext';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import { useInvite } from '../hooks/useInvite';
import { User as FriendUser } from '../models/User';
import { Video } from '../models/Video';
import { getProgramByVideoId, getProgramsByCategory, PreRecordedProgram, ProgramVideo } from '../data/preRecordedPrograms';

type ProgramCategoryKey = 'MuscleGrowth' | 'Stretching' | 'AthleticPerformance' | 'InjuryRehab';
const CATEGORY_OPTIONS: {
    key: ProgramCategoryKey;
    title: string;
    subtitle: string;
    IconName: any;
    color: string;
}[] = [
        { key: 'MuscleGrowth', title: 'Muscle Growth', subtitle: 'Hypertrophy focused programs', IconName: Flame, color: '#f44336' },
        { key: 'Stretching', title: 'Stretching', subtitle: 'Improve flexibility & range of motion', IconName: PersonStanding, color: '#4FC3F7' },
        { key: 'AthleticPerformance', title: 'Athletic Performance', subtitle: 'Speed, power & agility training', IconName: Zap, color: '#FFD600' },
        { key: 'InjuryRehab', title: 'Injury Rehab', subtitle: 'Safe recovery & rehabilitation', IconName: HeartPulse, color: '#66BB6A' },
    ];

export const WorkoutWithFriendFlow = ({ route }: any) => {
    const navigation = useNavigation<any>();

    // Mock array of registered phone numbers to check against, provided via route params
    const registeredPhoneNumbers: string[] = route?.params?.registeredPhoneNumbers || [];

    // Contexts
    const { friends } = useFriend();
    const { allVideos, gripCuffVideos } = useLibrary();
    const { createSession, upcomingSessions, pendingInvites } = useWorkoutSession();
    const { sendInvite, loading: inviteLoading } = useInvite();
    const { supabaseUserId } = useAuth();
    const { profile } = useUser();
    const userCredits = profile?.credits ?? 5;

    // State
    const [step, setStep] = useState(0);
    const [selectedFriend, setSelectedFriend] = useState<FriendUser | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ hour: number, min: number } | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<ProgramCategoryKey | null>(null);
    const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

    // When coming from a programme video (VideoPlayerScreen "Invite a Friend")
    const preselectedVideoId: string | undefined = route?.params?.preselectedVideoId;
    const preselectedVideoTitle: string | undefined = route?.params?.preselectedVideoTitle;
    const isFromProgramme = !!route?.params?.fromProgramme;
    const selectedInviteVideo = route?.params?.selectedInviteVideo as Video | undefined;
    const selectedInviteCategory = route?.params?.selectedInviteCategory as ProgramCategoryKey | undefined;
    const inviteFlowState = route?.params?.inviteFlowState as any;

    // When coming from a programme, category/video steps must never show.
    useEffect(() => {
        if (isFromProgramme && (step === 2 || step === 3)) setStep(4);
    }, [step, isFromProgramme]);

    // Auto-select video only when it is explicitly pre-selected from route.
    useEffect(() => {
        if (!selectedVideo && preselectedVideoId) {
            const preselected = [...gripCuffVideos, ...allVideos].find(v => v.id === preselectedVideoId);
            if (preselected) {
                setSelectedVideo(preselected);
            }
        }
    }, [preselectedVideoId, gripCuffVideos, allVideos, selectedVideo]);
    useEffect(() => {
        if (!selectedInviteVideo) return;
        setSelectedVideo(selectedInviteVideo);
        if (selectedInviteCategory) setSelectedCategory(selectedInviteCategory);
        setStep(4);
        navigation.setParams?.({ selectedInviteVideo: undefined, selectedInviteCategory: undefined });
    }, [selectedInviteVideo?.id]);
    useEffect(() => {
        if (!inviteFlowState) return;
        if (!selectedFriend && inviteFlowState.selectedFriend) setSelectedFriend(inviteFlowState.selectedFriend);
        if (!selectedDate && inviteFlowState.selectedDate) setSelectedDate(new Date(inviteFlowState.selectedDate));
        if (!selectedTimeSlot && inviteFlowState.selectedTimeSlot) setSelectedTimeSlot(inviteFlowState.selectedTimeSlot);
        if (!selectedCategory && inviteFlowState.selectedCategory) setSelectedCategory(inviteFlowState.selectedCategory);
        if (!selectedVideo && inviteFlowState.selectedVideo) setSelectedVideo(inviteFlowState.selectedVideo);
        if (betAmount === 0 && inviteFlowState.betAmount) setBetAmount(inviteFlowState.betAmount);
    }, [inviteFlowState]);
    useEffect(() => {
        if (!selectedCategory) return;
        if (selectedVideo && selectedVideo.category !== selectedCategory && !preselectedVideoId) {
            setSelectedVideo(null);
        }
    }, [selectedCategory, selectedVideo, preselectedVideoId]);
    const [isNow, setIsNow] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [sessionDate, setSessionDate] = useState<Date | null>(null);

    const [betAmount, setBetAmount] = useState(0);
    const MAX_BET = 50;
    const MIN_BET = 0;
    const INCREMENT = 5;

    // Helpers
    const dates = Array.from({ length: 14 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
    });

    const timeSlots = Array.from({ length: 33 }).map((_, i) => {
        const hour = Math.floor(i / 2) + 6; // Starts at 6 AM
        const min = (i % 2) === 0 ? 0 : 30;
        return { hour, min };
    });

    const formatTime = (hour: number, min: number) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const m = min === 0 ? '00' : '30';
        return `${h}:${m} ${period}`;
    };

    const handleNext = () => {
        if (step === 0 && !selectedFriend) { Alert.alert('Error', 'Please select a friend to work out with first.'); return; }
        if (step === 1 && (!selectedDate || !selectedTimeSlot)) { Alert.alert('Error', 'Please select a date and time for the workout.'); return; }
        if (step === 2 && !selectedCategory) { Alert.alert('Select a category', 'Tap a category to browse workouts.'); return; }
        if (step === 3 && !selectedVideo) { Alert.alert('Select a workout', 'Tap a workout video to continue.'); return; }

        setIsNow(false);
        // Skip category/video selection when video is pre-selected from a programme
        setStep(p => (isFromProgramme && p === 1) ? 4 : p + 1);
    };

    const handleStartNow = () => {
        setIsNow(true);
        const now = new Date();
        setSelectedDate(now);
        setSelectedTimeSlot({ hour: now.getHours(), min: now.getMinutes() });
        // Skip category/video selection when video is pre-selected from a programme
        setStep(isFromProgramme ? 4 : 2);
    };

    const openInviteCategory = (category: ProgramCategoryKey) => {
        setSelectedCategory(category);
        setStep(3);
    };

    const handleSubmit = async () => {
        if (!selectedFriend) { Alert.alert('Error', 'No friend selected!'); return; }
        if (!selectedDate) { Alert.alert('Error', 'No date selected!'); return; }
        if (!selectedTimeSlot) { Alert.alert('Error', 'No time slot selected!'); return; }
        if (!selectedVideo) { Alert.alert('Error', 'No video available. Please try again.'); return; }

        if (betAmount > userCredits) {
            Alert.alert(
                'Not enough credits',
                `You only have ${userCredits} credits. Lower your bet to continue.`
            );
            return;
        }

        setIsSubmitting(true);
        try {
            const finalDate = isNow ? new Date() : new Date(selectedDate);
            if (!isNow) {
                finalDate.setHours(selectedTimeSlot.hour, selectedTimeSlot.min, 0, 0);
            }

            const res = await sendInvite({
                type: 'workout',
                toUid: selectedFriend.uid,
                toName: selectedFriend.fullName || selectedFriend.username,
                toAvatarUrl: selectedFriend.profileImageUrl,
                videoId: selectedVideo.id,
                videoTitle: selectedVideo.title,
                scheduledAt: finalDate,
                betCredits: betAmount,
            });

            if (res.success) {
                setSessionDate(finalDate);
                setIsSuccess(true);
                setShowShareModal(true);
            } else {
                Alert.alert('Error', res.error || 'Failed to send invite');
            }
        } catch (e: any) {
            Alert.alert('Error sending invite', e.message || 'Unknown error');
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (!__DEV__) return;
        console.log('[WorkoutWithFriendFlow] confirm-state', {
            step,
            friend: selectedFriend?.uid,
            date: selectedDate?.toISOString?.(),
            time: selectedTimeSlot ? `${selectedTimeSlot.hour}:${selectedTimeSlot.min}` : null,
            category: selectedCategory,
            selectedVideo: selectedVideo?.id,
        });
    }, [step, selectedFriend?.uid, selectedDate, selectedTimeSlot, selectedCategory, selectedVideo?.id]);

    const selectedProgram = selectedVideo?.id ? getProgramByVideoId(selectedVideo.id) : undefined;
    const summaryFriend = selectedFriend?.fullName || selectedFriend?.username || 'No friend selected yet';
    const summaryTime = selectedDate
        ? `${selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • ${isNow ? 'Now' : selectedTimeSlot ? formatTime(selectedTimeSlot.hour, selectedTimeSlot.min) : 'Time not selected'}`
        : 'No schedule selected yet';
    const summaryCategory = CATEGORY_OPTIONS.find(c => c.key === selectedCategory)?.title ?? 'No category selected yet';
    const summaryProgram = selectedProgram?.title ?? (selectedVideo?.title?.split(' - ')?.[0] || 'No program selected yet');
    const summaryWorkout = selectedVideo?.title || 'No workout selected yet';
    const summaryDuration = selectedVideo ? `${Math.max(1, Math.round((selectedVideo.duration ?? 600) / 60))} min` : '-';
    const summaryDifficulty = selectedVideo?.difficulty || selectedProgram?.level || '-';

    const buildShareMessage = () => {
        const dayStr = sessionDate
            ? sessionDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
            : '';
        const timeStr = sessionDate
            ? sessionDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
            : '';
        const workoutName = selectedVideo?.title ?? 'a workout';
        return `Hey, i have just started using raw1 for my fitness. self coaching ,personal coaching and workout coachig and self coaching all in one place. I'm planning to crush ${workoutName} on ${dayStr} at ${timeStr}. Download it and we can train together! https://apps.apple.com`;
    };

    // --- Renders ---

    if (isSuccess) {
        const shareMessage = buildShareMessage();
        const smsUrl = `sms:?body=${encodeURIComponent(shareMessage)}`;

        const handleSendSMS = async () => {
            try {
                if (Platform.OS === 'web') {
                    window.open(smsUrl, '_blank');
                } else {
                    await Linking.openURL(smsUrl);
                }
            } catch {
                Alert.alert('Could not open SMS app.');
            }
            setShowShareModal(false);
        };

        const handleCopyLink = () => {
            Clipboard.setString(shareMessage);
            Alert.alert('Copied!', 'Message copied to clipboard.');
            setShowShareModal(false);
        };

        return (
            <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
                <View style={styles.successIcon}>
                    <Check color="white" size={48} />
                </View>
                <Text style={styles.successTitle}>Invite Sent!</Text>
                <Text style={styles.successSubtitle}>We'll let you know when {selectedFriend?.username} responds.</Text>

                <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => {
                        navigation.popToTop(); // pop out of this flow
                        navigation.navigate('UpcomingSessionsScreen'); // open the sessions screen
                    }}
                >
                    <Text style={styles.doneBtnText}>View Sessions</Text>
                </TouchableOpacity>

                {/* Share Modal */}
                <Modal
                    visible={showShareModal}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowShareModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.shareSheet}>
                            {/* Handle bar */}
                            <View style={styles.sheetHandle} />

                            <Text style={styles.shareTitle}>Invite your friend!</Text>
                            <Text style={styles.shareSubtitle}>Share this message so they can join your session</Text>

                            {/* Message preview */}
                            <View style={styles.messagePreview}>
                                <Text style={styles.messagePreviewText}>{shareMessage}</Text>
                            </View>

                            {/* Send SMS */}
                            <TouchableOpacity style={styles.sendSmsBtn} onPress={handleSendSMS} activeOpacity={0.8}>
                                <Text style={styles.sendSmsBtnText}>Send SMS</Text>
                            </TouchableOpacity>

                            {/* Copy Link - web fallback always shown, native only shows on web */}
                            {Platform.OS === 'web' && (
                                <TouchableOpacity style={styles.copyLinkBtn} onPress={handleCopyLink} activeOpacity={0.8}>
                                    <Text style={styles.copyLinkBtnText}>Copy Message</Text>
                                </TouchableOpacity>
                            )}

                            {/* Skip */}
                            <TouchableOpacity onPress={() => setShowShareModal(false)} style={{ marginTop: 8, paddingVertical: 12 }}>
                                <Text style={styles.skipText}>Skip</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        if (step === 0) {
                            navigation.goBack();
                            return;
                        }
                        if (step === 4 && !isFromProgramme) {
                            setStep(3);
                            return;
                        }
                        setStep(p => p - 1);
                    }}
                    style={styles.backButton}
                >
                    <ArrowLeft color="#fff" size={24} />
                </TouchableOpacity>
                {step > 0 ? (
                    <View style={styles.stepsIndicator}>
                        {[1, 2, 3, 4].map(i => (
                            <View key={i} style={[styles.stepDot, step >= i && styles.stepDotActive]} />
                        ))}
                    </View>
                ) : (
                    <Text style={styles.headerTitle}>Workout with a Friend</Text>
                )}
                <View style={{ width: 40 }} />
            </View>

            {/* Programme video banner - shown throughout the flow when coming from a programme */}
            {isFromProgramme && (
                <View style={styles.programmeBanner}>
                    <PlayCircle color="#FF6B00" size={16} />
                    <Text style={styles.programmeBannerText} numberOfLines={1}>
                        {preselectedVideoTitle ?? selectedVideo?.title ?? 'Selected workout'}
                    </Text>
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* ---------- STEP 0: LANDING (Friends & Upcoming Sessions) ---------- */}
                {step === 0 && (
                    <View>
                        <Text style={styles.title}>Select your workout partner</Text>

                        {friends.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <UserPlus color={AppTheme.textGrey} size={32} style={{ marginBottom: 12 }} />
                                <Text style={styles.emptyText}>You haven't added any friends yet.</Text>
                                <TouchableOpacity
                                    style={styles.goAddFriendBtn}
                                    onPress={() => navigation.navigate('FriendsScreen')}
                                >
                                    <Text style={{ color: AppTheme.primaryColor, fontWeight: 'bold' }}>Go Add Friends</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            friends.map(f => {
                                const isSelected = selectedFriend?.uid === f.uid;
                                return (
                                    <TouchableOpacity
                                        key={f.uid}
                                        style={[styles.friendCard, isSelected && styles.friendCardSelected]}
                                        onPress={() => {
                                            setSelectedFriend(f);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        {f.profileImageUrl ? (
                                            <Image key={f.profileImageUrl} source={{ uri: f.profileImageUrl }} style={styles.avatar} />
                                        ) : (
                                            <CircleUserRound color={AppTheme.primaryColor} size={40} />
                                        )}
                                        <View style={{ marginLeft: 12 }}>
                                            <Text style={styles.friendName}>{f.fullName}</Text>
                                            <Text style={styles.friendUsername}>@{f.username}</Text>
                                        </View>
                                        {isSelected && <Check color={AppTheme.primaryColor} size={20} style={{ marginLeft: 'auto' }} />}
                                    </TouchableOpacity>
                                );
                            })
                        )}

                        <TouchableOpacity
                            style={styles.inviteContactsBtn}
                            onPress={() => navigation.navigate('InviteFriendsFlow', {
                                registeredPhones: registeredPhoneNumbers
                            })}
                        >
                            <Contact color="white" size={20} />
                            <Text style={styles.inviteContactsText}>Invite Friends from Contacts</Text>
                        </TouchableOpacity>

                        {/* Pending Invites Badge */}
                        {pendingInvites.length > 0 && (
                            <TouchableOpacity
                                style={[styles.pendingBadge, { marginTop: 24 }]}
                                onPress={() => navigation.navigate('UpcomingSessionsScreen')}
                            >
                                <Bell color={AppTheme.primaryColor} size={20} style={{ marginRight: 12 }} />
                                <Text style={styles.pendingBadgeText}>You have {pendingInvites.length} workout invite(s)!</Text>
                                <ChevronRight color={AppTheme.primaryColor} size={16} />
                            </TouchableOpacity>
                        )}

                        {/* Upcoming Sessions */}
                        <Text style={[styles.sectionTitle, { marginTop: pendingInvites.length > 0 ? 12 : 32, marginBottom: 12 }]}>Upcoming Sessions</Text>

                        {upcomingSessions.length === 0 ? (
                            <View style={styles.emptySessionsCard}>
                                <Text style={styles.emptySessionsText}>No upcoming sessions yet</Text>
                            </View>
                        ) : (
                            upcomingSessions.slice(0, 5).map((session) => {
                                const isHost = session.hostUid === supabaseUserId;
                                const partnerName = isHost ? session.guestName : session.hostName;
                                const partnerAvatar = isHost ? session.guestAvatarUrl : session.hostAvatarUrl;

                                const diffMs = session.scheduledAt.toDate().getTime() - new Date().getTime();
                                const inHours = Math.floor(diffMs / 3600000);
                                const inMins = Math.floor((diffMs % 3600000) / 60000);
                                const countdownStr = diffMs < 0
                                    ? 'Starting now'
                                    : inHours >= 24
                                        ? session.scheduledAt.toDate().toLocaleDateString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })
                                        : `in ${inHours}h ${inMins}m`;

                                const isStartingNow = diffMs < 10 * 60 * 1000;

                                return (
                                    <View key={session.id} style={styles.sessionCard}>
                                        <View style={styles.sessionCardRow}>
                                            {partnerAvatar ? (
                                                <Image source={{ uri: partnerAvatar }} style={styles.sessionAvatar} />
                                            ) : (
                                                <CircleUserRound color={AppTheme.primaryColor} size={32} style={{ marginRight: 12 }} />
                                            )}
                                            <Text style={styles.sessionPartner}>{partnerName}</Text>
                                        </View>
                                        <View style={styles.sessionCardBottom}>
                                            <Text style={styles.sessionVideo} numberOfLines={1}>{session.videoTitle}</Text>
                                            <Text style={styles.sessionCountdown}>{countdownStr}</Text>
                                        </View>
                                        {session.status === 'accepted' && isStartingNow && (
                                            <TouchableOpacity
                                                style={styles.joinNowButton}
                                                onPress={() => navigation.navigate('SyncedVideoPlayer', {
                                                    sessionId: session.id,
                                                    videoId: session.videoId,
                                                    videoTitle: session.videoTitle,
                                                    friendName: partnerName,
                                                })}
                                            >
                                                <Text style={styles.joinNowText}>Join Now</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}

                {/* ---------- STEP 1: PICK DATE & TIME ---------- */}
                {step === 1 && (
                    <View>
                        <Text style={styles.title}>When do you want to work out?</Text>

                        {/* Start Now Button */}
                        <TouchableOpacity
                            style={styles.startNowButton}
                            onPress={handleStartNow}
                        >
                            <Zap size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                            <Text style={styles.startNowText}>Start Now</Text>
                        </TouchableOpacity>

                        {/* Divider */}
                        <Text style={styles.orDivider}>-- or schedule for later --</Text>

                        <Text style={styles.sectionLabel}>Date</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll}>
                            {dates.map((d, i) => {
                                const isSelected = selectedDate?.toDateString() === d.toDateString();
                                const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        style={[styles.dateBubble, isSelected && styles.dateBubbleSelected]}
                                        onPress={() => setSelectedDate(d)}
                                    >
                                        <Text style={[styles.dateText, isSelected && styles.dateTextSelected]}>{label}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Time</Text>
                        <View style={styles.timeGrid}>
                            {timeSlots.map((t, i) => {
                                const isSelected = selectedTimeSlot?.hour === t.hour && selectedTimeSlot?.min === t.min;
                                return (
                                    <TouchableOpacity
                                        key={i}
                                        style={[styles.timeBubble, isSelected && styles.timeBubbleSelected]}
                                        onPress={() => setSelectedTimeSlot(t)}
                                    >
                                        <Text style={[styles.timeText, isSelected && styles.timeTextSelected]}>
                                            {formatTime(t.hour, t.min)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* ---------- STEP 2: SELECT CATEGORY ---------- */}
                {step === 2 && (
                    <View>
                        <Text style={styles.title}>Select workout category</Text>
                        <Text style={{ color: AppTheme.textGrey, marginBottom: 16 }}>
                            Pick a training style, then choose the exact workout.
                        </Text>
                        <View style={{ gap: 12 }}>
                            {CATEGORY_OPTIONS.map((category) => {
                                const isSelected = selectedCategory === category.key;
                                return (
                                    <TouchableOpacity
                                        key={category.key}
                                        style={[
                                            styles.friendCard,
                                            {
                                                marginBottom: 0,
                                                borderColor: isSelected ? AppTheme.primaryColor : 'rgba(255,255,255,0.06)',
                                                backgroundColor: isSelected ? 'rgba(255,107,0,0.08)' : AppTheme.cardColor,
                                            }
                                        ]}
                                        onPress={() => openInviteCategory(category.key)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.iconContainerMini, { backgroundColor: `${category.color}22` }]}>
                                            <category.IconName color={category.color} size={20} />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={styles.friendName}>{category.title}</Text>
                                            <Text style={styles.friendUsername}>{category.subtitle}</Text>
                                        </View>
                                        <ChevronRight color={AppTheme.primaryColor} size={18} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* ---------- STEP 3: INLINE PROGRAM VIDEO BROWSER ---------- */}
                {step === 3 && (() => {
                    const programs = getProgramsByCategory(selectedCategory!);
                    const catInfo = CATEGORY_OPTIONS.find(c => c.key === selectedCategory);
                    const fmtDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
                    const COLORS = ['#FF6B00', '#7C3AED', '#3B82F6', '#10B981'];

                    const handlePickVideo = (video: ProgramVideo, program: PreRecordedProgram) => {
                        setSelectedVideo({
                            id: video.id,
                            title: `${program.title} - ${video.title}`,
                            category: selectedCategory!,
                            duration: video.duration,
                            difficulty: video.difficulty,
                            thumbnail: '',
                            description: '',
                            videoType: 'All' as any,
                            videoUrl: video.videoUrl,
                        } as any);
                        setStep(4);
                    };

                    return (
                        <View>
                            <Text style={styles.title}>{catInfo?.title ?? 'Select Workout'}</Text>
                            <Text style={{ color: AppTheme.textGrey, marginBottom: 20, fontSize: 14 }}>
                                Tap a workout to select it, then confirm on the next screen.
                            </Text>
                            {programs.map((program) => (
                                <View key={program.id} style={{ marginBottom: 32 }}>
                                    {/* Program header */}
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 }}>{program.title}</Text>
                                            <Text style={{ color: AppTheme.primaryColor, fontSize: 12, fontWeight: '600' }}>
                                                {program.durationWeeks} Week Series · {program.coachName}
                                            </Text>
                                            <Text style={{ color: AppTheme.textGrey, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                                                {program.focus}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => navigation.navigate('CategoryVideos', {
                                                categoryKey: program.id,
                                                categoryLabel: program.title,
                                                coachName: program.coachName,
                                                weeks: program.durationWeeks,
                                                videos: program.videos.map(v => ({
                                                    id: v.id, title: v.title,
                                                    duration: fmtDur(v.duration),
                                                    difficulty: v.difficulty, videoUrl: v.videoUrl,
                                                })),
                                                mode: 'invite_select',
                                                inviteTarget: 'WorkoutWithFriendFlow',
                                                inviteCategory: selectedCategory,
                                                inviteFlowState: {
                                                    selectedFriend,
                                                    selectedDate: selectedDate?.toISOString() ?? null,
                                                    selectedTimeSlot, selectedCategory,
                                                    selectedVideo, betAmount,
                                                },
                                            })}
                                        >
                                            <Text style={{ color: AppTheme.primaryColor, fontSize: 13, fontWeight: '600', paddingTop: 2 }}>See All &gt;</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Horizontal video scroll */}
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
                                        {program.videos.slice(0, 6).map((video, idx) => {
                                            const bg = COLORS[idx % COLORS.length];
                                            const isSelected = selectedVideo?.id === video.id;
                                            return (
                                                <TouchableOpacity
                                                    key={video.id}
                                                    onPress={() => handlePickVideo(video, program)}
                                                    activeOpacity={0.8}
                                                >
                                                    <View style={{ width: 160 }}>
                                                        <LinearGradient
                                                            colors={[bg, bg]}
                                                            style={{
                                                                width: 160, height: 110, borderRadius: 10,
                                                                justifyContent: 'flex-end', padding: 8,
                                                                borderWidth: isSelected ? 2.5 : 0,
                                                                borderColor: isSelected ? '#fff' : 'transparent',
                                                            }}
                                                        >
                                                            {isSelected && (
                                                                <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: AppTheme.primaryColor, borderRadius: 10, padding: 3 }}>
                                                                    <Check color="white" size={12} />
                                                                </View>
                                                            )}
                                                            <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-end' }}>
                                                                <Text style={{ fontSize: 11, color: '#fff', fontWeight: '600' }}>{fmtDur(video.duration)}</Text>
                                                            </View>
                                                        </LinearGradient>
                                                        <Text style={{ fontSize: 12, color: '#fff', fontWeight: '500', marginTop: 6 }} numberOfLines={2}>{video.title}</Text>
                                                        <Text style={{ fontSize: 11, color: AppTheme.textGrey, marginTop: 2 }}>{video.difficulty}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            ))}
                        </View>
                    );
                })()}

                {step === 4 && (
                    <View>
                        <Text style={styles.title}>Confirm your session</Text>

                        {/* Default video card */}
                        {selectedVideo && (
                            <View style={[styles.videoCard, styles.videoCardSelected, { width: '100%', marginBottom: 24, flexDirection: 'row', alignItems: 'center', padding: 12 }]}>
                                {selectedVideo.thumbnail ? (
                                    <Image source={{ uri: selectedVideo.thumbnail }} style={[styles.videoThumb, { width: 90, height: 70, borderRadius: 8 }]} />
                                ) : null}
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={{ color: AppTheme.textGrey, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 }}>Today's Workout</Text>
                                    <Text style={styles.videoTitle} numberOfLines={2}>{selectedVideo.title}</Text>
                                    {selectedVideo.difficulty && (
                                        <Text style={{ color: AppTheme.primaryColor, fontSize: 12, marginTop: 4 }}>{selectedVideo.difficulty}</Text>
                                    )}
                                </View>
                                <View style={[styles.videoCheck, { position: 'relative', top: undefined, right: undefined, backgroundColor: AppTheme.primaryColor }]}>
                                    <Check color="white" size={16} />
                                </View>
                            </View>
                        )}

                        {/* Summary Card */}
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryTitle}>Workout Session Summary</Text>
                            <View style={styles.summaryRow}>
                                <UserPlus color={AppTheme.textGrey} size={16} />
                                <Text style={styles.summaryText}>{summaryFriend}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Calendar color={AppTheme.textGrey} size={16} />
                                <Text style={styles.summaryText}>{summaryTime}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <HeartPulse color={AppTheme.textGrey} size={16} />
                                <Text style={styles.summaryText}>{summaryCategory}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Users color={AppTheme.textGrey} size={16} />
                                <Text style={styles.summaryText}>{summaryProgram}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <PlayCircle color={AppTheme.textGrey} size={16} />
                                <Text style={styles.summaryText}>{summaryWorkout}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Clock color={AppTheme.textGrey} size={16} />
                                <Text style={styles.summaryText}>{summaryDuration} • {summaryDifficulty}</Text>
                            </View>
                        </View>

                        {/* Bet Credits Section */}
                        {selectedFriend && selectedDate && selectedTimeSlot && (
                            <View style={{
                                backgroundColor: '#1a2235',
                                borderRadius: 16,
                                padding: 20,
                                marginTop: 24,
                                borderWidth: 1.5,
                                borderColor: betAmount > 0
                                    ? 'rgba(249,115,22,0.4)'
                                    : 'rgba(255,255,255,0.07)',
                            }}>

                                {/* Header */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700' }}>
                                        🏆 Bet Credits
                                    </Text>
                                    <View style={{
                                        backgroundColor: 'rgba(249,115,22,0.15)',
                                        borderRadius: 20,
                                        paddingHorizontal: 10,
                                        paddingVertical: 3,
                                    }}>
                                        <Text style={{ color: '#F97316', fontSize: 11, fontWeight: '700' }}>OPTIONAL</Text>
                                    </View>
                                </View>

                                <Text style={{ color: '#4a6a8a', fontSize: 13, marginBottom: 20, lineHeight: 18 }}>
                                    Hold your workout partner accountable!
                                </Text>

                                {/* Increment/Decrement control */}
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: '#0d1520',
                                    borderRadius: 14,
                                    padding: 6,
                                }}>
                                    {/* Minus button */}
                                    <TouchableOpacity
                                        onPress={() => setBetAmount(Math.max(MIN_BET, betAmount - INCREMENT))}
                                        disabled={betAmount === MIN_BET}
                                        style={{
                                            width: 48, height: 48,
                                            borderRadius: 12,
                                            backgroundColor: betAmount === MIN_BET
                                                ? 'rgba(255,255,255,0.05)'
                                                : 'rgba(249,115,22,0.15)',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Text style={{
                                            color: betAmount === MIN_BET ? '#3a5a7a' : '#F97316',
                                            fontSize: 24, fontWeight: '700', lineHeight: 28,
                                        }}>−</Text>
                                    </TouchableOpacity>

                                    {/* Amount display */}
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={{
                                            color: betAmount > 0 ? '#F97316' : '#ffffff',
                                            fontSize: 32, fontWeight: '800', letterSpacing: -1,
                                        }}>
                                            {betAmount}
                                        </Text>
                                        <Text style={{ color: '#4a6a8a', fontSize: 12, marginTop: 2 }}>credits</Text>
                                    </View>

                                    {/* Plus button */}
                                    <TouchableOpacity
                                        onPress={() => setBetAmount(Math.min(MAX_BET, betAmount + INCREMENT))}
                                        disabled={betAmount === MAX_BET}
                                        style={{
                                            width: 48, height: 48,
                                            borderRadius: 12,
                                            backgroundColor: betAmount === MAX_BET
                                                ? 'rgba(255,255,255,0.05)'
                                                : 'rgba(249,115,22,0.15)',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Text style={{
                                            color: betAmount === MAX_BET ? '#3a5a7a' : '#F97316',
                                            fontSize: 24, fontWeight: '700', lineHeight: 28,
                                        }}>+</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Quick select pills */}
                                <View style={{
                                    flexDirection: 'row',
                                    gap: 8,
                                    marginTop: 14,
                                    flexWrap: 'wrap',
                                }}>
                                    {[0, 5, 10, 20, 50].map(amount => (
                                        <TouchableOpacity
                                            key={amount}
                                            onPress={() => setBetAmount(amount)}
                                            style={{
                                                paddingHorizontal: 14,
                                                paddingVertical: 7,
                                                borderRadius: 20,
                                                backgroundColor: betAmount === amount
                                                    ? '#F97316'
                                                    : 'rgba(255,255,255,0.06)',
                                                borderWidth: 1,
                                                borderColor: betAmount === amount
                                                    ? '#F97316'
                                                    : 'rgba(255,255,255,0.08)',
                                            }}
                                        >
                                            <Text style={{
                                                color: betAmount === amount ? '#ffffff' : '#607a94',
                                                fontSize: 12,
                                                fontWeight: '600',
                                            }}>
                                                {amount === 0 ? 'No bet' : `${amount}`}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Warning if bet > 0 */}
                                {betAmount > 0 && (
                                    <View style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 8,
                                        marginTop: 14,
                                        backgroundColor: 'rgba(239,68,68,0.08)',
                                        borderRadius: 10,
                                        padding: 10,
                                        borderWidth: 1,
                                        borderColor: 'rgba(239,68,68,0.2)',
                                    }}>
                                        <Text style={{ fontSize: 14 }}>!</Text>
                                        <Text style={{
                                            color: '#f87171',
                                            fontSize: 12,
                                            flex: 1,
                                            lineHeight: 16,
                                        }}>
                                            You will lose {betAmount} credits if you miss
                                            this workout. Only bet what you can afford!
                                        </Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            {/* Bottom Floating Area */}
            {friends.length > 0 && (
                <View style={styles.bottomBar}>
                    {step === 4 ? (
                        <TouchableOpacity
                            onPress={handleSubmit}
                            disabled={isSubmitting || !selectedFriend || !selectedDate || !selectedTimeSlot || !selectedVideo}
                            style={{
                                backgroundColor: (selectedFriend && selectedDate && selectedTimeSlot && selectedVideo) ? '#F97316' : '#7c7c7c',
                                borderRadius: 30,
                                padding: 18,
                                alignItems: 'center',
                                flexDirection: 'row',
                                justifyContent: 'center',
                                gap: 8,
                            }}
                        >
                            {isSubmitting ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={{
                                    color: '#ffffff',
                                    fontSize: 16,
                                    fontWeight: '700',
                                }}>
                                    {betAmount > 0
                                        ? `Send Invite - ${betAmount} credits`
                                        : 'Send Invite'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={styles.nextBtn}
                            disabled={isSubmitting}
                            activeOpacity={0.8}
                            onPress={handleNext}
                        >
                            <LinearGradient
                                colors={[AppTheme.primaryColor, '#ff8534']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={styles.nextGradient}
                            >
                                <Text style={styles.nextText}>Next</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                </View>
            )}


        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: AppTheme.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16 },
    backButton: { width: 40, height: 40, justifyContent: 'center' },
    stepsIndicator: { flexDirection: 'row', gap: 8 },
    stepDot: { width: 32, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
    stepDotActive: { backgroundColor: AppTheme.primaryColor },

    scrollContent: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 24 },

    // Step 1
    emptyContainer: { alignItems: 'center', padding: 40, backgroundColor: AppTheme.cardColor, borderRadius: 16 },
    emptyText: { color: AppTheme.textGrey, marginBottom: 16 },
    goAddFriendBtn: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: 'rgba(255,107,0,0.1)', borderRadius: 20 },

    friendCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: AppTheme.cardColor, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'transparent' },
    friendCardSelected: { borderColor: AppTheme.primaryColor, backgroundColor: 'rgba(255,107,0,0.05)' },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    friendName: { color: 'white', fontSize: 16, fontWeight: '600' },
    friendUsername: { color: AppTheme.textGrey, fontSize: 13, marginTop: 2 },
    iconContainerMini: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    categoryVideoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: AppTheme.cardColor,
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    categoryVideoRowSelected: {
        borderColor: AppTheme.primaryColor,
        backgroundColor: 'rgba(255,107,0,0.08)',
    },
    categoryVideoThumb: {
        width: 90,
        height: 64,
        borderRadius: 10,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Step 2
    startNowButton: {
        backgroundColor: '#FF6B00',
        borderRadius: 12,
        paddingVertical: 16,
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    startNowText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 16,
    },
    orDivider: {
        color: '#888888',
        textAlign: 'center',
        marginVertical: 12,
        fontSize: 13,
    },
    sectionLabel: { color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 12 },
    dateScroll: { marginHorizontal: -20, paddingHorizontal: 20, marginBottom: 8 },
    dateBubble: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: AppTheme.cardColor, borderRadius: 24, marginRight: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    dateBubbleSelected: { backgroundColor: AppTheme.primaryColor, borderColor: AppTheme.primaryColor },
    dateText: { color: AppTheme.textGrey, fontWeight: '600' },
    dateTextSelected: { color: 'white' },

    timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    timeBubble: { width: '31%', paddingVertical: 14, backgroundColor: AppTheme.cardColor, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    timeBubbleSelected: { backgroundColor: AppTheme.primaryColor, borderColor: AppTheme.primaryColor },
    timeText: { color: AppTheme.textGrey, fontWeight: '600' },
    timeTextSelected: { color: 'white' },

    // Video cards - library-style
    videoCard: {
        width: 160,
        borderRadius: 12,
        backgroundColor: AppTheme.cardColor,
        borderWidth: 2,
        borderColor: 'transparent',
        padding: 0,
        overflow: 'hidden',
    },
    videoCardSelected: { borderColor: AppTheme.primaryColor },
    videoThumb: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    videoPlayBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoDifficultyBadge: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        backgroundColor: 'rgba(0,0,0,0.65)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    videoDifficultyText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '600',
    },
    videoTitle: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 8,
        paddingHorizontal: 8,
        paddingBottom: 10,
        lineHeight: 16,
    },
    videoCheck: {
        position: 'absolute',
        top: 6,
        right: 6,
        backgroundColor: AppTheme.primaryColor,
        borderRadius: 10,
        padding: 3,
    },

    summaryCard: { backgroundColor: AppTheme.cardColor, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    summaryTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    summaryText: { color: 'white', fontSize: 15 },

    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: AppTheme.background, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    nextBtn: { borderRadius: 16, overflow: 'hidden' },
    nextGradient: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
    nextText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: AppTheme.primaryColor, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    successTitle: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
    successSubtitle: { color: AppTheme.textGrey, fontSize: 16, textAlign: 'center', paddingHorizontal: 40, marginBottom: 40 },
    doneBtn: { paddingVertical: 16, paddingHorizontal: 32, backgroundColor: AppTheme.cardColor, borderRadius: 100 },
    doneBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    // Step 0 - Landing page styles
    headerTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    programmeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,107,0,0.12)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,107,0,0.25)',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    programmeBannerText: {
        flex: 1,
        color: '#FF6B00',
        fontSize: 13,
        fontWeight: '600',
    },
    inviteCta: { borderRadius: 16, overflow: 'hidden', marginBottom: 20 },
    inviteCtaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 56, borderRadius: 16 },
    inviteCtaText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    pendingBadge: { backgroundColor: 'rgba(255, 107, 0, 0.15)', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: AppTheme.primaryColor },
    pendingBadgeText: { color: 'white', fontWeight: 'bold', flex: 1 },

    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: 'white' },
    viewAll: { color: AppTheme.primaryColor, fontWeight: '600', fontSize: 14 },

    emptySessionsCard: { backgroundColor: AppTheme.cardColor, borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    emptySessionsText: { color: AppTheme.textGrey },

    sessionCard: { backgroundColor: AppTheme.cardColor, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    sessionCardRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    sessionAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 12 },
    sessionPartner: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    sessionCardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sessionVideo: { color: AppTheme.textGrey, flex: 1, marginRight: 12, fontSize: 13 },
    sessionCountdown: { color: AppTheme.primaryColor, fontWeight: 'bold', fontSize: 13 },

    joinNowButton: { marginTop: 12, backgroundColor: AppTheme.primaryColor, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    joinNowText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

    // Share modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    shareSheet: {
        backgroundColor: '#1e2537',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 36,
    },
    sheetHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
    shareTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
    shareSubtitle: { color: AppTheme.textGrey, fontSize: 14, marginBottom: 16 },
    messagePreview: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    messagePreviewText: { color: '#ccc', fontSize: 13, lineHeight: 20 },
    sendSmsBtn: {
        backgroundColor: AppTheme.primaryColor,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 10,
    },
    sendSmsBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    copyLinkBtn: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        marginBottom: 10,
    },
    copyLinkBtnText: { color: 'white', fontWeight: '600', fontSize: 15 },
    skipText: { color: AppTheme.textGrey, fontSize: 14, textAlign: 'center' },

    // Contacts UI
    inviteContactsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1a1a1a',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginTop: 8,
    },
    inviteContactsText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 15,
    },
    modalSafeArea: { flex: 1, backgroundColor: AppTheme.background },
    contactsModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        paddingTop: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    contactsModalHeaderTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    modalCloseBtn: { paddingVertical: 4, paddingLeft: 12 },
    modalCloseText: { color: AppTheme.primaryColor, fontWeight: '600', fontSize: 16 },
    contactsSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: AppTheme.cardColor,
        margin: 20,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    contactsSearchInput: { flex: 1, color: 'white', fontSize: 16 },
    contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    contactInitialCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(249,115,22,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    contactInitialText: { color: AppTheme.primaryColor, fontSize: 18, fontWeight: 'bold' },
    contactInfo: { flex: 1, justifyContent: 'center' },
    contactName: { color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 4 },
    contactPhone: { color: AppTheme.textGrey, fontSize: 13 },
    contactInviteBtn: {
        backgroundColor: AppTheme.cardColor,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    contactInviteText: { color: 'white', fontWeight: '600', fontSize: 13 },
    webFallbackContainer: { flex: 1, padding: 20, paddingTop: 40 },
    webFallbackText: { color: AppTheme.textGrey, fontSize: 15, marginBottom: 20 },
    webFallbackInput: {
        backgroundColor: AppTheme.cardColor,
        color: 'white',
        borderRadius: 10,
        padding: 16,
        fontSize: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    webFallbackBtn: {
        backgroundColor: AppTheme.primaryColor,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    webFallbackBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});


