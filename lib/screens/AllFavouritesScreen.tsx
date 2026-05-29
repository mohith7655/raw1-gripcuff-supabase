import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Pin, Heart } from 'lucide-react-native';
import { useFavorites } from '../hooks/useFavorites';
import { useFavouritedVideos } from '../hooks/useFavouritedVideos';
import { useLibrary } from '../providers/LibraryContext';
import { GridVideoCard } from '../components/GridVideoCard';
import { AppTheme } from '../core/theme/app_theme';
import { getAllPrograms } from '../data/preRecordedPrograms';
import { SCREEN_PADDING } from '../constants/theme';

type RouteParams = {
    type?: 'exercises' | 'workouts' | 'all';
};

export function AllFavouritesScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { type = 'all' } = (route.params as RouteParams) ?? {};
    const { isPinned, pinFavorite } = useFavorites();

    // Supabase-backed favourites
    const { exerciseIds: favExerciseIds, workoutIds: favWorkoutIds } = useFavouritedVideos();
    const { allVideos, gripCuffVideos, trainerVideos, bodyPartVideos } = useLibrary();

    const exerciseCatalog = [...allVideos, ...gripCuffVideos, ...trainerVideos, ...bodyPartVideos];
    const exerciseFavorites = exerciseCatalog.filter((v) => favExerciseIds.has(v.id));

    const workoutCatalog = getAllPrograms().flatMap((p) => p.videos);
    const workoutFavorites = workoutCatalog.filter((v) => favWorkoutIds.has(v.id));

    const showExercises = type === 'all' || type === 'exercises';
    const showWorkouts = type === 'all' || type === 'workouts';

    const title = type === 'exercises' ? 'Favourite Exercises'
        : type === 'workouts' ? 'Favourite Workouts'
        : 'Favourites';

    const totalCount = (showExercises ? exerciseFavorites.length : 0) + (showWorkouts ? workoutFavorites.length : 0);

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.backBtn}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={{ width: 56 }} />
            </View>

            {totalCount === 0 ? (
                <View style={styles.emptyState}>
                    <Heart color="#607a94" size={48} style={{ marginBottom: 16 }} />
                    <Text style={styles.emptyText}>
                        No favourites yet.{'\n'}Tap ♡ on any video to save it.
                    </Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                    {/* Exercises section */}
                    {showExercises && (
                        <View style={{ marginTop: 20 }}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Exercises</Text>
                                <Text style={styles.sectionCount}>{exerciseFavorites.length}</Text>
                            </View>
                            {exerciseFavorites.length === 0 ? (
                                <Text style={styles.emptySection}>No favourite exercises yet.</Text>
                            ) : (
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
                            )}
                        </View>
                    )}

                    {/* Workouts section */}
                    {showWorkouts && (
                        <View style={{ marginTop: 28 }}>
                            <View style={styles.sectionHeader}>
                                <Text style={styles.sectionTitle}>Workouts</Text>
                                <Text style={styles.sectionCount}>{workoutFavorites.length}</Text>
                            </View>
                            {workoutFavorites.length === 0 ? (
                                <Text style={styles.emptySection}>No favourite workouts yet.</Text>
                            ) : (
                                <View style={styles.grid}>
                                    {workoutFavorites.map((video: any, index: number) => {
                                        const pinned = isPinned(video.id);
                                        const isLastOdd = workoutFavorites.length % 2 !== 0 && index === workoutFavorites.length - 1;
                                        return (
                                            <View key={video.id} style={[styles.gridItem, isLastOdd && styles.gridItemLastOdd]}>
                                                <GridVideoCard
                                                    video={video as any}
                                                    index={index}
                                                    onPress={() => navigation.navigate('VideoPlayer', {
                                                        title: video.title,
                                                        videoId: video.id,
                                                        videoUrl: video.videoUrl,
                                                        videoType: 'premade_workout',
                                                        allowInvite: true,
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
                            )}
                        </View>
                    )}
                </ScrollView>
            )}
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
        color: '#FF6B00',
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
        paddingHorizontal: SCREEN_PADDING,
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
    emptySection: {
        color: '#607a94',
        fontSize: 13,
        paddingHorizontal: SCREEN_PADDING,
        paddingBottom: 8,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: SCREEN_PADDING,
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
});
