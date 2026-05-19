import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { GridVideoCard } from '../components/GridVideoCard';
import { SCREEN_PADDING } from '../constants/theme';
import { useLibrary } from '../providers/LibraryContext';
import { getProgramById, ProgramCategoryKey } from '../data/preRecordedPrograms';

const EXERCISE_LIBRARY_VIDEO_URL = 'https://firebasestorage.googleapis.com/v0/b/wazy-6c4a9.firebasestorage.app/o/Exercise%20Tutorial%20-%20Squat.mp4?alt=media&token=48cf44d1-0a5f-4ff5-b1d4-62e19c46dfc6';

const YOUTUBE_IDS = [
    'AdqrTg_hpEQ',
    'czkGj5vJEFQ',
    'Ag7Dui9Plys',
    'cbKkB3POqaY',
    'edIK5SZYMZo',
    'o_AhdsD03qo',
    'IXBt541mHL4',
    'sTzodL_7iB8',
    'tU0t5JoVWxA',
    '8uUawnM-FD8',
];

export const BodyPartVideosScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const {
        bodyPart = 'Chest',
        category = 'Muscle Growth',
        categoryKey,
        programId,
        allowInvite = false,
        mode,
        inviteTarget = 'WorkoutWithFriendFlow',
        inviteCategory = 'MuscleGrowth',
        inviteFlowState,
    } = route.params || {};
    const { bodyPartVideos } = useLibrary();

    const program = categoryKey && programId
        ? getProgramById(categoryKey as ProgramCategoryKey, programId)
        : undefined;
    const videos: any[] = program?.videos ?? bodyPartVideos.filter(v => v.bodyPart === bodyPart) ?? [];

    const formatDuration = (duration: number | string) => {
        if (typeof duration === 'string') return duration;
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        return `${mins}:${String(secs).padStart(2, '0')}`;
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {/* Breadcrumb Row 1 - Go back to all videos */}
            <TouchableOpacity
                onPress={() => navigation.popToTop()}
                style={styles.breadcrumbRow}
            >
                <Ionicons name="chevron-back" size={16} color="#888888" />
                <Text style={styles.breadcrumbText1}>Go back to all videos</Text>
            </TouchableOpacity>

            {/* Breadcrumb Row 2 - Category */}
            <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.breadcrumbRow2}
            >
                <Ionicons name="chevron-back" size={16} color={AppTheme.primaryColor} />
                <Text style={styles.breadcrumbText2}>{category}</Text>
            </TouchableOpacity>

            {/* Title and Subtitle */}
            <Text style={styles.titleText}>{bodyPart}</Text>
            <Text style={styles.subtitleText}>
                {program ? `${program.durationWeeks} Week Series by ${program.coachName}` : category}
            </Text>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Grid Content */}
            {videos.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No videos found for {bodyPart}</Text>
                </View>
            ) : (
                <FlatList
                    data={videos}
                    numColumns={2}
                    keyExtractor={(item) => item.id}
                    columnWrapperStyle={{
                        paddingHorizontal: 20,
                        gap: 12,
                        marginBottom: 12
                    }}
                    contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
                    renderItem={({ item, index }) => (
                        <View style={{ flex: 1 }}>
                            <GridVideoCard
                                video={{ ...item, duration: formatDuration(item.duration) } as any}
                                index={index}
                                onPress={() => {
                                    if (mode === 'invite_select') {
                                        navigation.navigate({
                                            name: inviteTarget,
                                            params: {
                                                selectedInviteVideo: {
                                                    id: item.id,
                                                    title: item.title,
                                                    category: inviteCategory,
                                                    duration: typeof item.duration === 'number' ? item.duration : 600,
                                                    difficulty: item.difficulty ?? 'Beginner',
                                                    thumbnail: item.thumbnail ?? '',
                                                    description: item.description ?? '',
                                                    videoType: 'All',
                                                    videoUrl: (item as any).videoUrl || '',
                                                },
                                                selectedInviteCategory: inviteCategory,
                                                inviteFlowState,
                                            },
                                            merge: true,
                                        });
                                        return;
                                    }
                                    const globalIndex = item.id.startsWith('bp-')
                                        ? parseInt(item.id.replace('bp-', '')) - 1
                                        : index;
                                                                    navigation.navigate('VideoPlayer', {
                                        title: item.title,
                                        videoId: item.id,
                                        youtubeId: null,
                                        videoUrl: (item as any).videoUrl || EXERCISE_LIBRARY_VIDEO_URL,
                                        allowInvite,
                                    });
                                }}
                            />
                        </View>
                    )}
                />
            )}
        </SafeAreaView>
    );
};

const { width } = Dimensions.get('window');
const gap = 16;
const padding = 16;
const cardWidth = (width - padding * 2 - gap) / 2;

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: AppTheme.background,
    },
    breadcrumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: 16,
        gap: 6,
    },
    breadcrumbRow2: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SCREEN_PADDING,
        paddingTop: 6,
        paddingBottom: 12,
        gap: 6,
    },
    breadcrumbText1: {
        fontSize: 13,
        color: '#888888',
        fontWeight: '400',
    },
    breadcrumbText2: {
        fontSize: 13,
        color: AppTheme.primaryColor,
        fontWeight: '600',
    },
    titleText: {
        fontSize: 24,
        fontWeight: FontWeights.bold as any,
        color: AppTheme.textWhite,
        textAlign: 'center',
        marginBottom: 4,
    },
    subtitleText: {
        fontSize: 13,
        color: AppTheme.primaryColor,
        textAlign: 'center',
        marginBottom: 20,
        fontWeight: FontWeights.semibold as any,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginHorizontal: SCREEN_PADDING,
        marginBottom: 16,
    },
    contentContainer: {
        paddingBottom: 40,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyStateText: {
        color: AppTheme.textGrey,
        fontSize: FontSizes.body,
    },
});
