import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useRecentlyWatched } from '../hooks/useRecentlyWatched';
import { useLibrary } from '../providers/LibraryContext';
import { getAllPrograms } from '../data/preRecordedPrograms';
import { AppTheme } from '../core/theme/app_theme';
import { Raw1Logo } from '../raw1_logo';

const COLORS = ['#FF6B35', '#7C3AED', '#059669', '#DB2777', '#2563EB', '#D97706'];

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
                    <ChevronLeft color="#fff" size={24} />
                </TouchableOpacity>
                <Text style={s.title}>Recently Watched</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
                {videos.map((item, idx) => {
                    const localVideo = allVids.find(v => v.id === item.videoId);
                    const program = allProgs.find(p => p.id === item.videoId || p.videos.some(v => v.id === item.videoId));
                    const title = localVideo?.title ?? program?.title ?? item.videoId;
                    const color = COLORS[idx % COLORS.length];
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
                            <View style={[s.thumb, { backgroundColor: color }]}>
                                <View style={s.logoWrap}>
                                    <Raw1Logo fontSize={8} />
                                </View>
                                <View style={s.playBtn}>
                                    <Text style={s.playIcon}>▶</Text>
                                </View>
                            </View>
                            <View style={s.info}>
                                <Text numberOfLines={2} style={s.cardTitle}>{title}</Text>
                                <Text style={s.cardSub}>Continue →</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0d1520' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    title: { color: '#fff', fontSize: 17, fontWeight: '700' },
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
        backgroundColor: AppTheme.cardColor,
    },
    thumb: {
        width: '100%',
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoWrap: { position: 'absolute', top: 6, left: 6 },
    playBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playIcon: { color: '#fff', fontSize: 13, marginLeft: 2 },
    info: { padding: 10 },
    cardTitle: { color: '#fff', fontSize: 12, fontWeight: '600', lineHeight: 16 },
    cardSub: { color: '#C26A2D', fontSize: 10, marginTop: 4 },
});
