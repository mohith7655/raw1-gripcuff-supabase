import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Play } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRecentlyWatched } from '../hooks/useRecentlyWatched';
import { useLibrary } from '../providers/LibraryContext';
import { getAllPrograms } from '../data/preRecordedPrograms';
import { DifficultyDot, ThumbnailCategory } from '../components/VideoCardBits';
import { VideoViewsLabel } from '../components/VideoViewsLabel';
import { Raw1Logo } from '../raw1_logo';

// Muted earthy / slate thumbnail gradients — matches the library cards (Ash & Midnight).
const GRADIENTS: [string, string][] = [
    ['#8B7355', '#6B5B45'],
    ['#7A8A8A', '#5A6A6A'],
    ['#4A5568', '#2D3748'],
    ['#6B4226', '#4A2E1A'],
    ['#2A2A3E', '#1A1A2E'],
    ['#0D2137', '#1A3A5C'],
    ['#C4B8A8', '#A09488'],
    ['#3B1F0B', '#5C3319'],
];

export function AllRecentlyWatchedScreen() {
    const navigation = useNavigation<any>();
    const { videos } = useRecentlyWatched(50);
    const { allVideos, gripCuffVideos, trainerVideos, bodyPartVideos } = useLibrary();
    const allVids = [...allVideos, ...gripCuffVideos, ...trainerVideos, ...bodyPartVideos];
    const allProgs = getAllPrograms();

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <ChevronLeft color="#211832" size={24} />
                </TouchableOpacity>
                <Text style={s.title}>Recently Watched</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
                {videos.map((item, idx) => {
                    const localVideo = allVids.find(v => v.id === item.videoId);
                    const program = allProgs.find(p => p.id === item.videoId || p.videos.some(v => v.id === item.videoId));
                    const title = localVideo?.title ?? program?.title ?? item.videoId;
                    const difficulty = (localVideo as any)?.difficulty ?? (program as any)?.level;
                    const colors = GRADIENTS[idx % GRADIENTS.length];
                    return (
                        <TouchableOpacity
                            key={item.videoId}
                            style={s.card}
                            activeOpacity={0.85}
                            onPress={() => navigation.navigate('VideoPlayer', {
                                videoId: item.videoId,
                                title,
                                videoUrl: localVideo?.videoUrl ?? program?.videos?.[0]?.videoUrl,
                                videoType: item.videoType,
                            })}
                        >
                            <LinearGradient
                                colors={colors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={s.thumb}
                            >
                                <View style={s.logoWrap}>
                                    <Raw1Logo fontSize={12} transparent />
                                </View>
                                <Play color="rgba(255,255,255,0.12)" size={30} fill="rgba(255,255,255,0.12)" />
                                <ThumbnailCategory category={(localVideo as any)?.category} />
                            </LinearGradient>
                            <View style={s.info}>
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5 }}>
                                    <Text numberOfLines={2} style={[s.cardTitle, { flex: 1 }]}>{title}</Text>
                                    <DifficultyDot difficulty={difficulty} size={8} style={{ marginTop: 3 }} />
                                </View>
                                <VideoViewsLabel videoId={item.videoId} />
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#EEEEF2' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(33,24,50,0.06)',
    },
    title: { color: '#211832', fontSize: 17, fontWeight: '700' },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        gap: 12,
    },
    card: {
        width: '47%',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.05)',
    },
    thumb: {
        width: '100%',
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoWrap: { position: 'absolute', top: 6, left: 6 },
    info: { padding: 10 },
    cardTitle: { color: '#211832', fontSize: 12, fontWeight: '600', lineHeight: 16 },
    cardDifficulty: { color: '#7A7C90', fontSize: 11, fontWeight: '600', marginTop: 4 },
});
