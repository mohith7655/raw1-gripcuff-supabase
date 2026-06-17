import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, Heart, BookOpen, Lock } from 'lucide-react-native';
import { Raw1Logo } from '../raw1_logo';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { SCREEN_PADDING } from '../constants/theme';
import { useFavorites } from '../hooks/useFavorites';
import { VideoViewsLabel } from './VideoViewsLabel';
import { useLibrary } from '../providers/LibraryContext';
import {
    getProgramsByCategory,
    PreRecordedProgram,
    ProgramCategoryKey,
    ProgramVideo,
} from '../data/preRecordedPrograms';
import { useFloatingToggle, FloatingTabToggle } from './FloatingTabToggle';
import { SubTab } from '../models/Video';

const THUMBNAIL_COLORS = ['#8B7355', '#7A8A8A', '#4A5568', '#6B4226', '#2A2A3E', '#0D2137'];

type Props = {
    categoryKey: ProgramCategoryKey;
    title: string;
};

export function ProgramLibraryView({ categoryKey, title }: Props) {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { favorites, toggleFavorite } = useFavorites();
    const { setSubTab } = useLibrary();
    const { translateY: floatTranslateY, onScroll: onFloatScroll } = useFloatingToggle();
    const allowInvite = route?.params?.allowInvite === true;
    const mode = route?.params?.mode;
    const inviteTarget = route?.params?.inviteTarget ?? 'WorkoutWithFriendFlow';
    const inviteCategory = route?.params?.inviteCategory ?? categoryKey;
    const inviteFlowState = route?.params?.inviteFlowState;
    const programs = getProgramsByCategory(categoryKey);

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const openVideo = (video: ProgramVideo, program?: PreRecordedProgram) => {
        if (mode === 'invite_select') {
            navigation.navigate({
                name: inviteTarget,
                params: {
                    selectedInviteVideo: {
                        id: video.id,
                        title: program ? `${program.title} - ${video.title}` : video.title,
                        category: inviteCategory,
                        duration: video.duration,
                        difficulty: video.difficulty,
                        thumbnail: '',
                        description: '',
                        videoType: 'All',
                        videoUrl: video.videoUrl,
                    },
                    selectedInviteCategory: inviteCategory,
                    inviteFlowState,
                },
                merge: true,
            });
            return;
        }
        navigation.navigate('VideoPlayer', {
            title: video.title,
            videoId: video.id,
            videoUrl: video.videoUrl,
            workoutId: program?.id ?? categoryKey,
            workoutTitle: program?.title ?? title,
            programName: program?.title ?? title,
            category: categoryKey,
            allowInvite,
        });
    };

    const openProgram = (program: PreRecordedProgram) => {
        navigation.navigate('CategoryVideos', {
            categoryKey: program.id,
            categoryLabel: program.title,
            coachName: program.coachName,
            weeks: program.durationWeeks,
            videos: program.videos.map((v) => ({
                id: v.id,
                title: v.title,
                duration: formatDuration(v.duration),
                category: categoryKey,
                difficulty: v.difficulty,
                videoUrl: v.videoUrl,
            })),
            allowInvite,
            mode,
            inviteTarget,
            inviteCategory,
            inviteFlowState,
        });
    };

    const renderIntroCard = (program: PreRecordedProgram) => (
        <TouchableOpacity
            key={`${program.id}_intro`}
            onPress={() => {
                if (mode === 'invite_select') {
                    navigation.navigate({
                        name: inviteTarget,
                        params: {
                            selectedInviteVideo: {
                                id: `${program.id}_intro`,
                                title: `${program.title} - Introduction`,
                                category: inviteCategory,
                                duration: 300,
                                difficulty: program.level,
                                thumbnail: '',
                                description: '',
                                videoType: 'All',
                                videoUrl: program.videos[0]?.videoUrl,
                            },
                            selectedInviteCategory: inviteCategory,
                            inviteFlowState,
                        },
                        merge: true,
                    });
                    return;
                }
                navigation.navigate('VideoPlayer', {
                    title: 'Introduction',
                    videoId: `${program.id}_intro`,
                    videoUrl: program.videos[0]?.videoUrl,
                    workoutId: program.id,
                    workoutTitle: program.title,
                    programName: program.title,
                    category: categoryKey,
                    allowInvite,
                });
            }}
            activeOpacity={0.8}
        >
            <View style={styles.videoCard}>
                <LinearGradient
                    colors={['#F8F8FC', '#F8F8FC']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.videoThumbnail}
                >
                    <View style={styles.introBadge}>
                        <Lock color="#F25912" size={10} />
                        <Text style={styles.introBadgeText}>MANDATORY</Text>
                    </View>
                    <View style={styles.introIconWrap}>
                        <BookOpen color="#F25912" size={28} />
                    </View>
                    <View style={{ position: 'absolute', top: 6, left: 6 }}>
                        <Raw1Logo fontSize={12} transparent />
                    </View>
                </LinearGradient>
                <View style={styles.videoInfo}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.videoTitle, { color: '#F25912' }]} numberOfLines={1}>
                            Introduction
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderVideoCard = (video: ProgramVideo, index: number) => {
        const isFavorite = favorites.some((fav) => fav.id === video.id);
        const baseColor = THUMBNAIL_COLORS[index % THUMBNAIL_COLORS.length];

        return (
            <View style={styles.videoCard}>
                <LinearGradient
                    colors={[baseColor, baseColor]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.videoThumbnail}
                >
                    <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>{formatDuration(video.duration)}</Text>
                    </View>
                    <View style={{ position: 'absolute', top: 6, left: 6 }}>
                        <Raw1Logo fontSize={12} transparent />
                    </View>
                </LinearGradient>

                <View style={styles.videoInfo}>
                    <Text style={styles.videoTitle} numberOfLines={1}>
                        {video.title}
                    </Text>
                    <VideoViewsLabel videoId={video.id} />
                </View>
            </View>
        );
    };

    const renderProgramSection = (program: PreRecordedProgram) => (
        <View key={program.id} style={styles.programSection}>
            <View style={styles.programHeader}>
                <View style={styles.programTitleBlock}>
                    <Text style={styles.programTitle}>{program.title}</Text>
                    <Text style={styles.programMeta}>
                        {program.durationWeeks} Week Series by {program.coachName}
                    </Text>
                    <Text style={styles.programDescription} numberOfLines={2}>
                        {program.focus} - {program.description}
                    </Text>
                </View>
                <TouchableOpacity onPress={() => openProgram(program)}>
                    <Text style={styles.seeAllText}>See All &gt;</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.videoScroll}
                scrollEventThrottle={16}
            >
                {renderIntroCard(program)}
                {program.videos.slice(0, 4).map((video, index) => (
                    <TouchableOpacity
                        key={`${program.id}|${video.id}`}
                        onPress={() => openVideo(video, program)}
                        activeOpacity={0.8}
                    >
                        {renderVideoCard(video, index)}
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );

    const handleFloatTabChange = (tab: SubTab) => {
        setSubTab(tab);
        navigation.navigate('HomeTabs', { screen: 'LibraryTab' });
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <ArrowLeft color={AppTheme.textWhite} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                onScroll={onFloatScroll}
                scrollEventThrottle={16}
            >
                {programs.map(renderProgramSection)}
            </ScrollView>

            <FloatingTabToggle
                activeTab="workouts"
                onTabChange={handleFloatTabChange}
                translateY={floatTranslateY}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: AppTheme.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SCREEN_PADDING,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: AppTheme.cardColor,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    headerTitle: {
        fontSize: FontSizes.h4,
        fontWeight: FontWeights.bold as any,
        color: AppTheme.textWhite,
    },
    contentContainer: {
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: 16,
        paddingBottom: 40,
    },
    programSection: {
        marginBottom: 28,
    },
    programHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 12,
    },
    programTitleBlock: {
        flex: 1,
    },
    programTitle: {
        fontSize: 16,
        fontWeight: FontWeights.bold as any,
        color: AppTheme.textWhite,
        marginBottom: 3,
    },
    programMeta: {
        fontSize: 12,
        color: AppTheme.primaryColor,
        fontWeight: FontWeights.semibold as any,
        marginBottom: 4,
    },
    programDescription: {
        fontSize: 12,
        color: AppTheme.textGrey,
        lineHeight: 17,
    },
    seeAllText: {
        fontSize: 13,
        color: AppTheme.primaryColor,
        fontWeight: FontWeights.semibold as any,
        paddingTop: 2,
    },
    videoScroll: {
        paddingRight: SCREEN_PADDING,
        gap: 12,
    },
    videoCard: {
        width: 160,
    },
    videoThumbnail: {
        width: 160,
        height: 110,
        borderRadius: 10,
        justifyContent: 'flex-end',
        padding: 8,
    },
    introBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        alignSelf: 'flex-end',
        backgroundColor: 'rgba(242,89,18,0.18)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(242,89,18,0.4)',
    },
    introBadgeText: {
        fontSize: 9,
        color: '#F25912',
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    introIconWrap: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    durationBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    durationText: {
        fontSize: 11,
        color: '#D8D8E4',
        fontWeight: '700' as any,
    },
    videoInfo: {
        marginTop: 6,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 4,
    },
    videoTitle: {
        fontSize: 12,
        color: AppTheme.textWhite,
        fontWeight: FontWeights.medium as any,
        flex: 1,
    },
    heartIcon: {
        padding: 4,
    },
});
