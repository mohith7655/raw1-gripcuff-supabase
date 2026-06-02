import React, { useRef, useState } from 'react';
import {
    Animated,
    Platform,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Pin, Heart, Dumbbell, LayoutGrid, Play } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFavorites } from '../hooks/useFavorites';
import { useFavouritedVideos } from '../hooks/useFavouritedVideos';
import { useLibrary } from '../providers/LibraryContext';
import { GridVideoCard } from '../components/GridVideoCard';
import { AppTheme } from '../core/theme/app_theme';
import { SCREEN_PADDING } from '../constants/theme';
import { getAllPrograms, PreRecordedProgram } from '../data/preRecordedPrograms';

const PROGRAM_COLORS = ['#F97316', '#8B5CF6', '#3B82F6', '#10B981', '#EC4899', '#F59E0B'];

function WorkoutCard({
    program,
    index,
    onPress,
    isFavourited,
    isPinned,
    onToggleFavourite,
    onTogglePin,
}: {
    program: PreRecordedProgram;
    index: number;
    onPress: () => void;
    isFavourited: boolean;
    isPinned: boolean;
    onToggleFavourite: () => void;
    onTogglePin: () => void;
}) {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const bgColor = PROGRAM_COLORS[index % PROGRAM_COLORS.length];

    const handleHeart = () => {
        Animated.sequence([
            Animated.spring(scaleAnim, { toValue: 1.25, useNativeDriver: Platform.OS !== 'web' }),
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();
        onToggleFavourite();
    };

    return (
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.85} onPress={onPress}>
            <View style={[styles.thumbnail, { backgroundColor: bgColor }]}>
                <View style={styles.playIconContainer}>
                    <Play color="#fff" size={16} fill="#fff" />
                </View>
                <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{program.videos.length} videos</Text>
                </View>
            </View>
            <View style={{ paddingHorizontal: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={{ flex: 1, color: '#fff', fontSize: 12, marginTop: 8 }} numberOfLines={2}>
                        {program.title}
                    </Text>
                    <TouchableOpacity onPress={handleHeart} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                            <Ionicons
                                name={isFavourited ? 'heart' : 'heart-outline'}
                                size={20}
                                color={isFavourited ? AppTheme.primaryColor : AppTheme.textGrey}
                            />
                        </Animated.View>
                    </TouchableOpacity>
                </View>
                <Text style={{ color: '#607a94', fontSize: 10, marginTop: 2 }}>
                    {program.level}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

type RouteParams = {
    type?: 'exercises' | 'workouts' | 'all';
};

type ActiveTab = 'exercises' | 'workouts';

export function AllFavouritesScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { type = 'all' } = (route.params as RouteParams) ?? {};
    const { isPinned, pinFavorite } = useFavorites();
    const { allVideos, gripCuffVideos, trainerVideos, bodyPartVideos, setSubTab: setLibSubTab } = useLibrary();

    const [activeTab, setActiveTab] = useState<ActiveTab>(
        type === 'workouts' ? 'workouts' : 'exercises'
    );

    // Supabase-backed favourites
    const { exerciseIds: favExerciseIds, workoutIds: favWorkoutIds } = useFavouritedVideos();

    // Exercise favourites — match IDs against full local catalog
    const exerciseCatalog = [...allVideos, ...gripCuffVideos, ...trainerVideos, ...bodyPartVideos];
    const exerciseFavorites = exerciseCatalog.filter((v) => favExerciseIds.has(v.id));

    // Workout favourites — a favourited video_id may be a program ID or a video
    // ID inside a program (e.g. "mg-lean-bulk_d1"). Match both.
    const allPrograms = getAllPrograms();
    const workoutFavorites = allPrograms.filter((p) =>
        favWorkoutIds.has(p.id) ||
        p.videos.some((v) => favWorkoutIds.has(v.id))
    );
    // Deduplicate in case multiple videos from the same program are favourited
    const uniqueWorkoutFavorites = Array.from(new Map(workoutFavorites.map(p => [p.id, p])).values());

    const totalExercises = exerciseFavorites.length;
    const totalWorkouts = uniqueWorkoutFavorites.length;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.backBtn}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Favourites</Text>
                <View style={{ width: 56 }} />
            </View>

            {/* Tab toggle */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'exercises' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('exercises')}
                    activeOpacity={0.8}
                >
                    <LayoutGrid size={13} color={activeTab === 'exercises' ? AppTheme.primaryColor : '#607a94'} />
                    <Text style={[styles.tabText, activeTab === 'exercises' && styles.tabTextActive]}>
                        Exercises {totalExercises > 0 ? `(${totalExercises})` : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'workouts' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('workouts')}
                    activeOpacity={0.8}
                >
                    <Dumbbell size={13} color={activeTab === 'workouts' ? AppTheme.primaryColor : '#607a94'} />
                    <Text style={[styles.tabText, activeTab === 'workouts' && styles.tabTextActive]}>
                        Workouts {totalWorkouts > 0 ? `(${totalWorkouts})` : ''}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
                {activeTab === 'exercises' ? (
                    exerciseFavorites.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Heart color="#607a94" size={48} style={{ marginBottom: 16 }} />
                            <Text style={styles.emptyText}>No favourite exercises yet.{'\n'}Tap ♡ on any video to save it.</Text>
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingTop: 20, paddingBottom: 100 }}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Exercises</Text>
                                <Text style={styles.sectionCount}>{exerciseFavorites.length}</Text>
                            </View>
                            <View style={styles.grid}>
                                {exerciseFavorites.map((video: any, index: number) => {
                                    const pinned = isPinned(video.id);
                                    const isLastOdd = exerciseFavorites.length % 2 !== 0 && index === exerciseFavorites.length - 1;
                                    return (
                                        <View key={video.id} style={[styles.gridItem, isLastOdd && styles.gridItemLastOdd]}>
                                            <GridVideoCard
                                                video={video}
                                                index={index}
                                                onPress={() => navigation.navigate('VideoPlayer', {
                                                    title: video.title,
                                                    videoId: video.id,
                                                    videoUrl: video.videoUrl,
                                                    videoType: 'exercise_library',
                                                })}
                                            />
                                            <TouchableOpacity
                                                onPress={() => pinFavorite(video.id)}
                                                style={[styles.pinBtn, pinned && styles.pinBtnActive]}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Pin size={13} color={pinned ? '#fff' : AppTheme.primaryColor} fill={pinned ? AppTheme.primaryColor : 'transparent'} />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                            <TouchableOpacity
                                style={styles.allBtn}
                                onPress={() => { setLibSubTab('all'); navigation.navigate('HomeTabs', { screen: 'LibraryTab' }); }}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.allBtnText}>All Exercises →</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )
                ) : (
                    uniqueWorkoutFavorites.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Heart color="#607a94" size={48} style={{ marginBottom: 16 }} />
                            <Text style={styles.emptyText}>No favourite workouts yet.{'\n'}Tap ♡ on any workout to save it.</Text>
                        </View>
                    ) : (
                        <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingTop: 20, paddingBottom: 100 }}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Workouts</Text>
                                <Text style={styles.sectionCount}>{uniqueWorkoutFavorites.length}</Text>
                            </View>
                            <View style={styles.grid}>
                                {uniqueWorkoutFavorites.map((program, index) => {
                                    const firstVideo = program.videos?.[0];
                                    const isLastOdd = uniqueWorkoutFavorites.length % 2 !== 0 && index === uniqueWorkoutFavorites.length - 1;
                                    const pinned = isPinned(program.id);
                                    // A program is favourited if any of its video IDs is in favWorkoutIds
                                    const isFavourited = favWorkoutIds.has(program.id) || program.videos.some(v => favWorkoutIds.has(v.id));
                                    return (
                                        <View key={program.id} style={[styles.gridItem, isLastOdd && styles.gridItemLastOdd]}>
                                            <WorkoutCard
                                                program={program}
                                                index={index}
                                                onPress={() => navigation.navigate('VideoPlayer', {
                                                    videoId: firstVideo?.id,
                                                    title: program.title,
                                                    videoUrl: firstVideo?.videoUrl,
                                                    workoutTitle: program.title,
                                                    videoType: 'premade_workout',
                                                })}
                                                isFavourited={isFavourited}
                                                isPinned={pinned}
                                                onToggleFavourite={() => {
                                                    // Toggle the first matched video interaction to unfavourite
                                                    const matchedVideoId = program.videos.find(v => favWorkoutIds.has(v.id))?.id ?? program.id;
                                                    navigation.navigate('VideoPlayer', {
                                                        videoId: firstVideo?.id,
                                                        title: program.title,
                                                        videoUrl: firstVideo?.videoUrl,
                                                        workoutTitle: program.title,
                                                        videoType: 'premade_workout',
                                                    });
                                                }}
                                                onTogglePin={() => pinFavorite(program.id)}
                                            />
                                            <TouchableOpacity
                                                onPress={() => pinFavorite(program.id)}
                                                style={[styles.pinBtn, pinned && styles.pinBtnActive]}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Pin size={13} color={pinned ? '#fff' : AppTheme.primaryColor} fill={pinned ? AppTheme.primaryColor : 'transparent'} />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                            <TouchableOpacity
                                style={styles.allBtn}
                                onPress={() => { setLibSubTab('workouts'); navigation.navigate('HomeTabs', { screen: 'LibraryTab' }); }}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.allBtnText}>All Workouts →</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )
                )}
            </View>
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
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    backBtn: {
        color: '#E89951',
        fontSize: 17,
        fontWeight: '600',
        width: 56,
    },
    headerTitle: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: '700',
        textAlign: 'center',
        flex: 1,
    },
    tabRow: {
        flexDirection: 'row',
        backgroundColor: '#131f2e',
        borderRadius: 12,
        padding: 4,
        marginHorizontal: 16,
        marginVertical: 12,
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10,
    },
    tabBtnActive: {
        backgroundColor: '#000000',
    },
    tabText: {
        color: '#607a94',
        fontSize: 12,
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#ffffff',
        fontWeight: '700',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyText: {
        color: '#607a94',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        gap: 8,
    },
    sectionTitle: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
    },
    sectionCount: {
        color: '#607a94',
        fontSize: 13,
        fontWeight: '500',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    gridItem: {
        flex: 1,
        minWidth: '45%',
        position: 'relative',
    },
    gridItemLastOdd: {
        maxWidth: '50%',
        paddingRight: 6,
    },
    pinBtn: {
        position: 'absolute',
        top: 6,
        left: 6,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(0,0,0,0.55)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pinBtnActive: {
        backgroundColor: AppTheme.primaryColor,
    },
    allBtn: {
        marginTop: 20,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: AppTheme.primaryColor,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    allBtnText: {
        color: AppTheme.primaryColor,
        fontSize: 14,
        fontWeight: '700',
    },
    thumbnail: {
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
        overflow: 'hidden',
    },
    playIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
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
});
