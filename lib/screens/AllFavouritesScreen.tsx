import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    LayoutAnimation,
    Platform,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Pin, Heart, Dumbbell, LayoutGrid, Play } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFavorites } from '../hooks/useFavorites';
import { useFavouritedVideos } from '../hooks/useFavouritedVideos';
import { useLibrary } from '../providers/LibraryContext';
import {
    ViewMode,
    VIEW_MODE_OPTIONS,
    VIEW_MODE_COLS,
    ViewModeIcon,
    MultiColVideoCard,
    ListVideoCard,
} from '../components/LibraryViewCards';
import { AppTheme } from '../core/theme/app_theme';
import { DifficultyDot, ThumbnailCategory } from '../components/VideoCardBits';
import { SCREEN_PADDING } from '../constants/theme';
import { getAllPrograms, getProgramCategoryKey, PreRecordedProgram } from '../data/preRecordedPrograms';

const PROGRAM_COLORS = ['#8B7355', '#7A8A8A', '#4A5568', '#6B4226', '#2A2A3E', '#0D2137'];

// Human-readable section labels for the workout/exercise categories. Anything
// not listed falls back to a spaced-out version of its key (e.g. "FooBar" → "Foo Bar").
const CATEGORY_LABELS: Record<string, string> = {
    MuscleGrowth: 'Muscle Growth',
    Stretching: 'Stretching',
    AthleticPerformance: 'Athletic Performance',
    InjuryRehab: 'Injury Rehab',
    Gripcuff: 'Gripcuff',
    Strength: 'Strength',
    Recovery: 'Recovery',
    HIIT: 'HIIT',
    Mobility: 'Mobility',
    Tutorial: 'Tutorial',
};

const labelForCategory = (cat?: string): string => {
    if (!cat) return 'Other';
    return CATEGORY_LABELS[cat] ?? cat.replace(/([a-z])([A-Z])/g, '$1 $2');
};

// Group items by category, preserving first-seen order so sections stay stable.
function groupByCategory<T>(items: T[], getCat: (item: T) => string | undefined): [string, T[]][] {
    const map = new Map<string, T[]>();
    for (const it of items) {
        const key = getCat(it) || 'Other';
        const bucket = map.get(key);
        if (bucket) bucket.push(it);
        else map.set(key, [it]);
    }
    return Array.from(map.entries());
}

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
                    <Play color="rgba(255,255,255,0.12)" size={30} fill="rgba(255,255,255,0.12)" />
                </View>
                <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{program.videos.length} videos</Text>
                </View>
            </View>
            <View style={{ paddingHorizontal: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 }}>
                    <Text style={{ flex: 1, color: '#211832', fontSize: 12, lineHeight: 16 }} numberOfLines={2}>
                        {program.title}
                    </Text>
                    <DifficultyDot difficulty={program.level} style={{ marginTop: 4 }} />
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
                <ThumbnailCategory category={getProgramCategoryKey(program.id)} difficulty={program.level} />
            </View>
        </TouchableOpacity>
    );
}

// Pin overlay shown on every favourite card across all view modes.
function PinButton({ pinned, onPress }: { pinned: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.pinBtn, pinned && styles.pinBtnActive]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <Pin size={13} color={pinned ? '#fff' : AppTheme.primaryColor} fill={pinned ? AppTheme.primaryColor : 'transparent'} />
        </TouchableOpacity>
    );
}

// List-view row for a workout program — mirrors ListVideoCard's layout so the
// Workouts tab matches the Exercises tab in list mode.
function WorkoutListRow({
    program,
    index,
    onPress,
}: {
    program: PreRecordedProgram;
    index: number;
    onPress: () => void;
}) {
    const bgColor = PROGRAM_COLORS[index % PROGRAM_COLORS.length];
    return (
        <TouchableOpacity style={styles.listRow} onPress={onPress} activeOpacity={0.82}>
            <View style={[styles.listThumb, { backgroundColor: bgColor }]}>
                <Play color="rgba(255,255,255,0.12)" size={22} fill="rgba(255,255,255,0.12)" />
                <View style={styles.listThumbBadge}>
                    <Text style={styles.durationText}>{program.videos.length} videos</Text>
                </View>
            </View>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                    <Text style={styles.listTitle} numberOfLines={2}>{program.title}</Text>
                    <DifficultyDot difficulty={program.level} style={{ marginTop: 5 }} />
                </View>
                <ThumbnailCategory category={getProgramCategoryKey(program.id)} difficulty={program.level} />
                <Text style={styles.listSub}>{program.videos.length} videos</Text>
            </View>
        </TouchableOpacity>
    );
}

type RouteParams = {
    type?: 'exercises' | 'workouts' | 'all';
};

type ActiveTab = 'all' | 'exercises' | 'workouts';

export function AllFavouritesScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { type = 'all' } = (route.params as RouteParams) ?? {};
    const { isPinned, pinFavorite } = useFavorites();
    const { allVideos, gripCuffVideos, trainerVideos, bodyPartVideos, setSubTab: setLibSubTab } = useLibrary();

    const [activeTab, setActiveTab] = useState<ActiveTab>(
        type === 'workouts' ? 'workouts' : type === 'exercises' ? 'exercises' : 'all'
    );

    // Layout density toggle — same modes as the Library/Exercises screen,
    // persisted so the user's choice sticks across visits.
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    useEffect(() => {
        AsyncStorage.getItem('favouritesViewMode')
            .then(m => { if (m) setViewMode(m as ViewMode); })
            .catch(() => {});
    }, []);
    const handleViewModeChange = (mode: ViewMode) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setViewMode(mode);
        AsyncStorage.setItem('favouritesViewMode', mode).catch(() => {});
    };

    // Column math shared by the exercise and workout grids.
    const isList = viewMode === 'list';
    const cols = VIEW_MODE_COLS[viewMode];
    const colGap = cols >= 4 ? 6 : cols === 3 ? 8 : 12;
    const screenW = Dimensions.get('window').width;
    const cardWidth = (screenW - SCREEN_PADDING * 2 - colGap * (cols - 1)) / cols;

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

    // Bucket favourites into category sections (e.g. "Muscle Growth Exercises").
    const exerciseGroups = groupByCategory(exerciseFavorites, (v: any) => v.category);
    const workoutGroups = groupByCategory(uniqueWorkoutFavorites, (p) => getProgramCategoryKey(p.id) ?? undefined);

    const currentCount =
        activeTab === 'workouts' ? totalWorkouts :
        activeTab === 'exercises' ? totalExercises :
        totalExercises + totalWorkouts;

    const goToProgram = (program: PreRecordedProgram) => {
        const firstVideo = program.videos?.[0];
        navigation.navigate('VideoPlayer', {
            videoId: firstVideo?.id,
            title: program.title,
            videoUrl: firstVideo?.videoUrl,
            workoutTitle: program.title,
            videoType: 'premade_workout',
        });
    };

    // Render one category's exercise favourites honouring the active view mode.
    const renderExerciseItems = (items: any[]) => {
        if (isList) {
            return (
                <View>
                    {items.map((video: any, index: number) => (
                        <View key={video.id} style={styles.listItemWrap}>
                            <ListVideoCard
                                video={video}
                                index={index}
                                onPress={() => navigation.navigate('VideoPlayer', {
                                    title: video.title,
                                    videoId: video.id,
                                    videoUrl: video.videoUrl,
                                    videoType: 'exercise_library',
                                })}
                            />
                            <PinButton pinned={isPinned(video.id)} onPress={() => pinFavorite(video.id)} />
                        </View>
                    ))}
                </View>
            );
        }
        return (
            <View style={[styles.flexGrid, { gap: colGap }]}>
                {items.map((video: any, index: number) => (
                    <View key={video.id} style={{ width: cardWidth, position: 'relative' }}>
                        <MultiColVideoCard
                            video={video}
                            index={index}
                            cardWidth={cardWidth}
                            onPress={() => navigation.navigate('VideoPlayer', {
                                title: video.title,
                                videoId: video.id,
                                videoUrl: video.videoUrl,
                                videoType: 'exercise_library',
                            })}
                        />
                        <PinButton pinned={isPinned(video.id)} onPress={() => pinFavorite(video.id)} />
                    </View>
                ))}
            </View>
        );
    };

    // Render one category's workout favourites honouring the active view mode.
    const renderWorkoutItems = (items: PreRecordedProgram[]) => {
        if (isList) {
            return (
                <View>
                    {items.map((program, index) => (
                        <View key={program.id} style={styles.listItemWrap}>
                            <WorkoutListRow program={program} index={index} onPress={() => goToProgram(program)} />
                            <PinButton pinned={isPinned(program.id)} onPress={() => pinFavorite(program.id)} />
                        </View>
                    ))}
                </View>
            );
        }
        return (
            <View style={[styles.flexGrid, { gap: colGap }]}>
                {items.map((program, index) => {
                    const isFavourited = favWorkoutIds.has(program.id) || program.videos.some(v => favWorkoutIds.has(v.id));
                    return (
                        <View key={program.id} style={{ width: cardWidth, position: 'relative' }}>
                            <WorkoutCard
                                program={program}
                                index={index}
                                onPress={() => goToProgram(program)}
                                isFavourited={isFavourited}
                                isPinned={isPinned(program.id)}
                                onToggleFavourite={() => goToProgram(program)}
                                onTogglePin={() => pinFavorite(program.id)}
                            />
                            <PinButton pinned={isPinned(program.id)} onPress={() => pinFavorite(program.id)} />
                        </View>
                    );
                })}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.backBtn}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Favorites</Text>
                <View style={{ width: 56 }} />
            </View>

            {/* Tab toggle */}
            <View style={styles.tabRow}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('all')}
                    activeOpacity={0.8}
                >
                    <Heart size={13} color={activeTab === 'all' ? '#fff' : '#7A7C90'} />
                    <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                        All {totalExercises + totalWorkouts > 0 ? `(${totalExercises + totalWorkouts})` : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'exercises' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('exercises')}
                    activeOpacity={0.8}
                >
                    <LayoutGrid size={13} color={activeTab === 'exercises' ? '#fff' : '#7A7C90'} />
                    <Text style={[styles.tabText, activeTab === 'exercises' && styles.tabTextActive]}>
                        Exercises {totalExercises > 0 ? `(${totalExercises})` : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'workouts' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('workouts')}
                    activeOpacity={0.8}
                >
                    <Dumbbell size={13} color={activeTab === 'workouts' ? '#fff' : '#7A7C90'} />
                    <Text style={[styles.tabText, activeTab === 'workouts' && styles.tabTextActive]}>
                        Workouts {totalWorkouts > 0 ? `(${totalWorkouts})` : ''}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* View density toggle — same modes as the Exercises/Library screen */}
            {currentCount > 0 && (
                <View style={styles.viewToolbar}>
                    <Text style={styles.viewToolbarCount}>{currentCount} items</Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                        {VIEW_MODE_OPTIONS.map(({ key }) => {
                            const active = viewMode === key;
                            return (
                                <TouchableOpacity
                                    key={key}
                                    onPress={() => handleViewModeChange(key)}
                                    activeOpacity={0.8}
                                    style={[styles.viewModeBtn, active && styles.viewModeBtnActive]}
                                >
                                    <ViewModeIcon mode={key} color={active ? '#fff' : '#7A7C90'} size={15} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}

            <View style={{ flex: 1 }}>
                {((activeTab !== 'workouts' ? totalExercises : 0) + (activeTab !== 'exercises' ? totalWorkouts : 0)) === 0 ? (
                    <View style={styles.emptyState}>
                        <Heart color="#7A7C90" size={48} style={{ marginBottom: 16 }} />
                        <Text style={styles.emptyText}>No favorites yet.{'\n'}Tap ♡ on any video or workout to save it.</Text>
                    </View>
                ) : (
                    <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN_PADDING, paddingTop: 20, paddingBottom: 100 }}>
                        {/* Exercises */}
                        {activeTab !== 'workouts' && exerciseGroups.map(([cat, items]) => (
                            <View key={`ex-${cat}`} style={styles.categorySection}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>{labelForCategory(cat)}</Text>
                                    <Text style={styles.sectionCount}>{items.length}</Text>
                                </View>
                                {renderExerciseItems(items)}
                            </View>
                        ))}
                        {activeTab !== 'workouts' && totalExercises > 0 && (
                            <TouchableOpacity
                                style={styles.allBtn}
                                onPress={() => { setLibSubTab('all'); navigation.navigate('HomeTabs', { screen: 'LibraryTab' }); }}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.allBtnText}>All Exercises →</Text>
                            </TouchableOpacity>
                        )}

                        {/* Workouts */}
                        {activeTab !== 'exercises' && workoutGroups.map(([cat, items]) => (
                            <View key={`wk-${cat}`} style={styles.categorySection}>
                                <View style={styles.sectionHeader}>
                                    <Text style={styles.sectionTitle}>{labelForCategory(cat)}</Text>
                                    <Text style={styles.sectionCount}>{items.length}</Text>
                                </View>
                                {renderWorkoutItems(items)}
                            </View>
                        ))}
                        {activeTab !== 'exercises' && totalWorkouts > 0 && (
                            <TouchableOpacity
                                style={styles.allBtn}
                                onPress={() => { setLibSubTab('workouts'); navigation.navigate('HomeTabs', { screen: 'LibraryTab' }); }}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.allBtnText}>All Workouts →</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
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
        borderBottomColor: 'rgba(33,24,50,0.06)',
    },
    backBtn: {
        color: '#F25912',
        fontSize: 17,
        fontWeight: '600',
        width: 56,
    },
    headerTitle: {
        color: '#211832',
        fontSize: 17,
        fontWeight: '700',
        textAlign: 'center',
        flex: 1,
    },
    // Segmented control — matches the app's standard toggle (Social Feed/Chat):
    // pill-shaped track on the canvas tint with a deep-indigo active segment.
    tabRow: {
        flexDirection: 'row',
        backgroundColor: '#EEEEF2',
        borderRadius: 100,
        borderWidth: 1,
        borderColor: '#D8D8E4',
        padding: 3,
        marginHorizontal: 16,
        marginVertical: 12,
    },
    tabBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        borderRadius: 100,
    },
    tabBtnActive: {
        backgroundColor: '#211832',
    },
    tabText: {
        color: '#7A7C90',
        fontSize: 12,
        fontWeight: '500',
    },
    tabTextActive: {
        color: '#fff',
        fontWeight: '700',
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyText: {
        color: '#7A7C90',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    categorySection: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        gap: 8,
    },
    sectionTitle: {
        color: '#211832',
        fontSize: 18,
        fontWeight: '700',
    },
    sectionCount: {
        color: '#7A7C90',
        fontSize: 13,
        fontWeight: '500',
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
    viewToolbar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginHorizontal: 16,
        marginBottom: 8,
    },
    viewToolbarCount: {
        color: '#7A7C90',
        fontSize: 13,
        fontWeight: '600',
    },
    viewModeBtn: {
        width: 34,
        height: 34,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EEEEF2',
        borderWidth: 1,
        borderColor: '#D8D8E4',
    },
    viewModeBtnActive: {
        backgroundColor: '#211832',
        borderColor: '#211832',
    },
    flexGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    listItemWrap: {
        position: 'relative',
    },
    listRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 9,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F8F8FC',
    },
    listThumb: {
        width: 78,
        height: 54,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        flexShrink: 0,
    },
    listThumbBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        paddingHorizontal: 4,
        paddingVertical: 2,
    },
    listTitle: {
        flex: 1,
        color: '#211832',
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
    listSub: {
        color: '#7A7C90',
        fontSize: 11,
        marginTop: 2,
    },
    allBtn: {
        marginTop: 20,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.14)',
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
    },
    allBtnText: {
        color: '#211832',
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    durationBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        paddingHorizontal: 5,
        paddingVertical: 2,
    },
    durationText: {
        color: '#D8D8E4',
        fontSize: 10,
        fontWeight: '700',
    },
});
