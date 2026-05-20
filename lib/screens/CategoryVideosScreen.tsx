import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, BookOpen, Lock } from 'lucide-react-native';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { GridVideoCard } from '../components/GridVideoCard';
import { SCREEN_PADDING } from '../constants/theme';

type DummyVideo = {
    id: string;
    title: string;
    duration: string;
    difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
    videoUrl?: string;
};

import { getWorkoutVideoUrl } from '../constants/videoUrls';

// These are exercise how-to videos — each title is a specific movement/exercise
const EXERCISE_LIBRARY_VIDEO_URL = getWorkoutVideoUrl('exercise');

const EXERCISE_DATA_RAW: Record<string, DummyVideo[]> = {
    GripCuff: [
        { id: 'gc1', title: 'Introduction to GripCuff', duration: '3:45' },
        { id: 'gc2', title: 'Reverse Wrist Curl', duration: '5:00' },
        { id: 'gc3', title: 'Proper Strap Placement', duration: '5:12' },
        { id: 'gc4', title: 'Finger Extension Drill', duration: '4:30' },
        { id: 'gc5', title: 'Wrist Curl Technique', duration: '4:30' },
        { id: 'gc6', title: 'Grip Squeeze Hold', duration: '6:00' },
        { id: 'gc7', title: 'Forearm Activation', duration: '7:15' },
        { id: 'gc8', title: 'Cuff Resistance Setup', duration: '8:00' },
    ],
    MuscleGrowth: [
        { id: 'mg1', title: 'Barbell Bench Press', duration: '6:00' },
        { id: 'mg2', title: 'Barbell Back Squat', duration: '7:00' },
        { id: 'mg3', title: 'Pull-Up Technique', duration: '5:30' },
        { id: 'mg4', title: 'Overhead Press Form', duration: '6:00' },
        { id: 'mg5', title: 'Barbell Row Tutorial', duration: '5:45' },
        { id: 'mg6', title: 'Incline Dumbbell Press', duration: '5:00' },
        { id: 'mg7', title: 'Romanian Deadlift', duration: '6:30' },
        { id: 'mg8', title: 'Cable Fly Technique', duration: '4:45' },
        { id: 'mg9', title: 'Dumbbell Curl Form', duration: '4:30' },
        { id: 'mg10', title: 'Tricep Pushdown', duration: '4:00' },
        { id: 'mg11', title: 'Lateral Raise', duration: '4:15' },
        { id: 'mg12', title: 'Leg Press Mechanics', duration: '5:30' },
    ],
    Stretching: [
        { id: 'st1', title: 'Standing Quad Stretch', duration: '3:00' },
        { id: 'st2', title: 'Doorway Chest Stretch', duration: '3:30' },
        { id: 'st3', title: 'Hip Flexor Lunge Stretch', duration: '4:00' },
        { id: 'st4', title: 'Seated Hamstring Stretch', duration: '3:45' },
        { id: 'st5', title: 'Cat-Cow Spinal Mobility', duration: '3:30' },
        { id: 'st6', title: 'Seated Spinal Twist', duration: '3:00' },
        { id: 'st7', title: "Child's Pose Hold", duration: '3:30' },
        { id: 'st8', title: 'Figure-4 Glute Stretch', duration: '4:00' },
        { id: 'st9', title: 'Neck Side Bend', duration: '2:30' },
        { id: 'st10', title: 'Pigeon Pose Tutorial', duration: '5:00' },
        { id: 'st11', title: 'Thoracic Foam Roll', duration: '4:30' },
        { id: 'st12', title: 'Calf Stretch — Wall', duration: '3:00' },
    ],
    AthleticPerformance: [
        { id: 'ap1', title: 'Box Jump Technique', duration: '5:00' },
        { id: 'ap2', title: 'Agility Ladder Basics', duration: '4:30' },
        { id: 'ap3', title: 'Sprint Start Position', duration: '4:00' },
        { id: 'ap4', title: 'Lateral Shuffle Drill', duration: '4:30' },
        { id: 'ap5', title: 'Single Leg Hop', duration: '4:00' },
        { id: 'ap6', title: 'Medicine Ball Slam', duration: '3:45' },
        { id: 'ap7', title: 'Resistance Band Sprint', duration: '4:15' },
        { id: 'ap8', title: 'Plyometric Push-Up', duration: '3:30' },
        { id: 'ap9', title: 'Depth Drop Jump', duration: '4:00' },
        { id: 'ap10', title: 'Broad Jump Form', duration: '3:45' },
        { id: 'ap11', title: 'T-Drill Agility Run', duration: '4:30' },
        { id: 'ap12', title: 'Power Clean Basics', duration: '6:00', videoUrl: EXERCISE_LIBRARY_VIDEO_URL },
    ],
    InjuryRehab: [
        { id: 'ir1', title: 'Glute Bridge Activation', duration: '4:00', videoUrl: EXERCISE_LIBRARY_VIDEO_URL },
        { id: 'ir2', title: 'Bird Dog Movement', duration: '3:30' },
        { id: 'ir3', title: 'Shoulder External Rotation', duration: '4:00' },
        { id: 'ir4', title: 'Clamshell Exercise', duration: '3:45' },
        { id: 'ir5', title: 'Hip Hinge Pattern', duration: '4:30' },
        { id: 'ir6', title: 'Scapular Retraction', duration: '3:30' },
        { id: 'ir7', title: 'Dead Bug Core Drill', duration: '4:00' },
        { id: 'ir8', title: 'Knee Tracking Squat', duration: '4:15' },
        { id: 'ir9', title: 'Wall Slide Shoulder', duration: '3:30' },
        { id: 'ir10', title: 'Banded Monster Walk', duration: '3:45' },
        { id: 'ir11', title: 'Prone Hip Extension', duration: '4:00' },
        { id: 'ir12', title: 'Pallof Press Core', duration: '3:30' },
    ],
};

const EXERCISE_DATA: Record<string, DummyVideo[]> = Object.fromEntries(
    Object.entries(EXERCISE_DATA_RAW).map(([key, videos]) => [
        key,
        videos.map((video) => ({ ...video, videoUrl: EXERCISE_LIBRARY_VIDEO_URL })),
    ])
) as Record<string, DummyVideo[]>;

export const CategoryVideosScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const {
        categoryKey = 'MuscleGrowth',
        categoryLabel = 'Category',
        coachName,
        weeks,
        videos: routeVideos,
        allowInvite = false,
        mode,
        inviteTarget = 'WorkoutWithFriendFlow',
        inviteCategory = 'MuscleGrowth',
        inviteFlowState,
    } = route.params || {};

    // If custom videos are passed (program day videos), prepend mandatory intro
    const baseVideos: DummyVideo[] = routeVideos || EXERCISE_DATA[categoryKey] || [];
    const videos: DummyVideo[] = routeVideos
        ? [{ id: `${categoryKey}_intro`, title: 'Introduction', duration: '5:00' }, ...baseVideos]
        : baseVideos;

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color={AppTheme.textWhite} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{categoryLabel}</Text>
                <View style={{ width: 40 }} />
            </View>

            {/* Program subtitle — shown only for program-detail views */}
            {!!coachName && (
                <View style={styles.subtitle}>
                    <Text style={styles.subtitleText}>
                        by {coachName}{weeks ? `  ·  ${weeks} weeks` : ''}  ·  {videos.length} sessions
                    </Text>
                </View>
            )}

            <FlatList
                data={videos}
                numColumns={2}
                keyExtractor={(item, index) => item.id ?? index.toString()}
                columnWrapperStyle={{ paddingHorizontal: 20, gap: 12, marginBottom: 12 }}
                contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
                renderItem={({ item, index }) => {
                    const isIntro = item.id.endsWith('_intro');
                    if (isIntro) {
                        return (
                            <TouchableOpacity
                                style={{ flex: 1 }}
                                activeOpacity={0.8}
                                onPress={() => {
                                    if (mode === 'invite_select') {
                                        navigation.navigate({
                                            name: inviteTarget,
                                            params: {
                                                selectedInviteVideo: {
                                                    id: item.id,
                                                    title: `${categoryLabel} - ${item.title}`,
                                                    category: inviteCategory,
                                                    duration: 300,
                                                    difficulty: 'Beginner',
                                                    thumbnail: '',
                                                    description: '',
                                                    videoType: 'All',
                                                    videoUrl: routeVideos?.[0]?.videoUrl,
                                                },
                                                selectedInviteCategory: inviteCategory,
                                                inviteFlowState,
                                            },
                                            merge: true,
                                        });
                                        return;
                                    }
                                    navigation.navigate('VideoPlayer', {
                                        title: item.title,
                                        videoId: item.id,
                                        videoUrl: routeVideos?.[0]?.videoUrl,
                                        workoutId: categoryKey,
                                        workoutTitle: categoryLabel,
                                        programName: categoryLabel,
                                        category: inviteCategory || categoryKey,
                                        allowInvite,
                                    });
                                }}
                            >
                                <View style={introStyles.thumbnail}>
                                    <BookOpen color="#F97316" size={26} />
                                    <View style={introStyles.badge}>
                                        <Lock color="#F97316" size={9} />
                                        <Text style={introStyles.badgeText}>MANDATORY</Text>
                                    </View>
                                    <View style={introStyles.durationBadge}>
                                        <Text style={introStyles.durationText}>{item.duration}</Text>
                                    </View>
                                </View>
                                <Text style={introStyles.label}>{item.title}</Text>
                            </TouchableOpacity>
                        );
                    }
                    return (
                        <View style={{ flex: 1 }}>
                            <GridVideoCard
                                video={item as any}
                                index={index - 1}
                                onPress={() => {
                                    if (mode === 'invite_select') {
                                        navigation.navigate({
                                            name: inviteTarget,
                                            params: {
                                                selectedInviteVideo: {
                                                    id: item.id,
                                                    title: item.title,
                                                    category: inviteCategory,
                                                    duration: Number(item.duration?.split?.(':')?.[0] ?? 10) * 60,
                                                    difficulty: item.difficulty ?? 'Beginner',
                                                    thumbnail: '',
                                                    description: '',
                                                    videoType: 'All',
                                                    videoUrl: item.videoUrl,
                                                },
                                                selectedInviteCategory: inviteCategory,
                                                inviteFlowState,
                                            },
                                            merge: true,
                                        });
                                        return;
                                    }
                                    navigation.navigate('VideoPlayer', {
                                        title: item.title,
                                        videoId: item.id,
                                        videoUrl: item.videoUrl,
                                        youtubeId: null,
                                        workoutId: categoryKey,
                                        workoutTitle: categoryLabel,
                                        programName: categoryLabel,
                                        category: inviteCategory || categoryKey,
                                        allowInvite,
                                    });
                                }}
                            />
                        </View>
                    );
                }}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: AppTheme.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: 16,
        marginBottom: 4,
    },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    headerTitle: { fontSize: FontSizes.h4, fontWeight: FontWeights.bold as any, color: AppTheme.textWhite },
    subtitle: {
        paddingHorizontal: SCREEN_PADDING,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        marginBottom: 4,
    },
    subtitleText: { color: AppTheme.textGrey, fontSize: 13 },
});

const introStyles = StyleSheet.create({
    thumbnail: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        backgroundColor: '#1a1a2e',
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
        overflow: 'hidden',
    },
    badge: {
        position: 'absolute',
        top: 6,
        right: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(249,115,22,0.15)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.4)',
    },
    badgeText: {
        fontSize: 9,
        color: '#F97316',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    durationBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
    },
    durationText: {
        color: '#fff',
        fontSize: 10,
    },
    label: {
        color: '#F97316',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 8,
        paddingHorizontal: 4,
    },
});
