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
import { Pin } from 'lucide-react-native';
import { useFavorites } from '../hooks/useFavorites';
import { GridVideoCard } from '../components/GridVideoCard';
import { AppTheme } from '../core/theme/app_theme';

type RouteParams = {
    type: 'exercises' | 'workouts';
};

const isExercise = (video: any): boolean => {
    const idStr = String(video.id);
    return idStr.startsWith('bp-') || idStr.startsWith('all-') || idStr.startsWith('gc_');
};



export function AllFavouritesScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute();
    const { type } = (route.params as RouteParams) ?? { type: 'exercises' };
    const { favorites, isPinned, pinFavorite } = useFavorites();

    const filtered = favorites.filter((v: any) =>
        type === 'exercises' ? isExercise(v) : !isExercise(v)
    );

    const title = type === 'exercises' ? 'Favourite Exercises' : 'Favourite Workouts';

    const isEmpty = filtered.length === 0;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Text style={styles.backBtn}>‹ Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={{ width: 56 }} />
            </View>

            {isEmpty ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                        No {type === 'exercises' ? 'exercises' : 'pre-made workouts'} saved yet.{'\n'}
                        Tap ♡ on any video to save it.
                    </Text>
                </View>
            ) : (
                // 2-column grid for both exercises and workouts
                <FlatList
                    data={filtered}
                    numColumns={2}
                    keyExtractor={(item: any) => String(item.id)}
                    columnWrapperStyle={{ paddingHorizontal: 20, gap: 12, marginBottom: 12 }}
                    contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}
                    renderItem={({ item, index }: { item: any; index: number }) => {
                        const isLastOdd = filtered.length % 2 !== 0 && index === filtered.length - 1;
                        const pinned = isPinned(item.id);
                        return (
                            <View style={isLastOdd ? { flex: 1, maxWidth: '50%', paddingRight: 6 } : { flex: 1 }}>
                                <View style={{ position: 'relative' }}>
                                    <GridVideoCard
                                        video={item}
                                        index={index}
                                        onPress={() =>
                                            navigation.navigate('VideoPlayer', {
                                                title: item.title,
                                                videoId: item.id,
                                                videoUrl: item.videoUrl,
                                            })
                                        }
                                    />
                                    <TouchableOpacity
                                        onPress={() => pinFavorite(item.id)}
                                        style={[styles.pinBtn, pinned && styles.pinBtnActive]}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Pin size={13} color={pinned ? '#fff' : AppTheme.primaryColor} fill={pinned ? AppTheme.primaryColor : 'transparent'} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    }}
                />
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
