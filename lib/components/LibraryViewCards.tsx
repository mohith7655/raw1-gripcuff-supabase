import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { Play } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme } from '../core/theme/app_theme';
import { useFavorites } from '../hooks/useFavorites';
import { Video } from '../models/Video';
import { getProgramByVideoId } from '../data/preRecordedPrograms';

export type ViewMode = 'large' | 'grid' | 'compact' | 'dense' | 'list';

export const VIEW_MODE_COLS: Record<ViewMode, number> = {
    large: 1,
    grid: 2,
    compact: 3,
    dense: 4,
    list: 1,
};

export const VIEW_MODE_OPTIONS: { key: ViewMode; label: string; icon: string }[] = [
    { key: 'large', label: 'Large', icon: '▤' },
    { key: 'grid', label: 'Grid', icon: '⊞' },
    { key: 'compact', label: 'Compact', icon: '⊟' },
    { key: 'dense', label: 'Dense', icon: '⊡' },
    { key: 'list', label: 'List', icon: '☰' },
];

const GRADIENTS: [string, string][] = [
    ['#FF6B35', '#E84100'],
    ['#7C3AED', '#4F46E5'],
    ['#059669', '#047857'],
    ['#DB2777', '#9D174D'],
    ['#2563EB', '#1D4ED8'],
    ['#D97706', '#B45309'],
    ['#0891B2', '#0E7490'],
    ['#E11D48', '#BE185D'],
    ['#16A34A', '#15803D'],
    ['#8B5CF6', '#6D28D9'],
];

function parseDurationLabel(value: unknown): string {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
    }
    if (typeof value === 'string') {
        const t = value.trim();
        if (/^\d+$/.test(t)) {
            const s = Number(t);
            return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        }
        return t;
    }
    return '0:00';
}

function getDisplayTitle(video: Video): string {
    const program = getProgramByVideoId(video.id);
    return /^Day\s+\d+$/i.test(video.title) && program
        ? `${program.title} - ${video.title}`
        : video.title;
}

function getColors(video: Video, index: number): [string, string] {
    return video.color ? [video.color, video.color] : GRADIENTS[index % GRADIENTS.length];
}

// Multi-column card for grid / compact / dense views
export function MultiColVideoCard({
    video,
    index,
    cardWidth,
    onPress,
}: {
    video: Video;
    index: number;
    cardWidth: number;
    onPress: () => void;
}) {
    const { isFavorite, toggleFavorite } = useFavorites();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fav = isFavorite(video.id);
    const colors = getColors(video, index);
    const durationLabel = parseDurationLabel((video as any).duration);
    const displayTitle = getDisplayTitle(video);

    const handleFav = () => {
        Animated.sequence([
            Animated.spring(scaleAnim, { toValue: 1.25, useNativeDriver: Platform.OS !== 'web' }),
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();
        toggleFavorite({ id: video.id, title: displayTitle, duration: durationLabel, category: video.category, difficulty: video.difficulty, videoUrl: video.videoUrl });
    };

    const iconSize = cardWidth < 90 ? 10 : 12;
    const playSize = cardWidth < 90 ? 20 : 26;

    return (
        <TouchableOpacity style={{ width: cardWidth, marginBottom: 10 }} onPress={onPress} activeOpacity={0.82}>
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 9, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}
            >
                <View style={{ width: playSize, height: playSize, borderRadius: playSize / 2, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
                    <Play color="#fff" size={iconSize} fill="#fff" />
                </View>
                <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{durationLabel}</Text>
                </View>
            </LinearGradient>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingTop: 4, paddingHorizontal: 1 }}>
                <Text style={{ flex: 1, color: '#fff', fontSize: 11, fontWeight: '600', lineHeight: 15 }} numberOfLines={2}>
                    {displayTitle}
                </Text>
                <TouchableOpacity onPress={handleFav} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                        <Ionicons name={fav ? 'heart' : 'heart-outline'} size={13} color={fav ? AppTheme.primaryColor : '#607a94'} />
                    </Animated.View>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
}

// List-view row card
export function ListVideoCard({
    video,
    index,
    onPress,
}: {
    video: Video;
    index: number;
    onPress: () => void;
}) {
    const { isFavorite, toggleFavorite } = useFavorites();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fav = isFavorite(video.id);
    const colors = getColors(video, index);
    const durationLabel = parseDurationLabel((video as any).duration);
    const displayTitle = getDisplayTitle(video);

    const handleFav = () => {
        Animated.sequence([
            Animated.spring(scaleAnim, { toValue: 1.25, useNativeDriver: Platform.OS !== 'web' }),
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: Platform.OS !== 'web' }),
        ]).start();
        toggleFavorite({ id: video.id, title: displayTitle, duration: durationLabel, category: video.category, difficulty: video.difficulty, videoUrl: video.videoUrl });
    };

    return (
        <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#1a2d42', gap: 12 }}
            onPress={onPress}
            activeOpacity={0.82}
        >
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 78, height: 54, borderRadius: 8, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}
            >
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' }}>
                    <Play color="#fff" size={10} fill="#fff" />
                </View>
                <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{durationLabel}</Text>
                </View>
            </LinearGradient>

            <View style={{ flex: 1 }}>
                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600', lineHeight: 18 }} numberOfLines={2}>
                    {displayTitle}
                </Text>
                <Text style={{ color: '#607a94', fontSize: 11, marginTop: 2 }}>
                    {video.category} · {durationLabel}
                </Text>
            </View>

            <TouchableOpacity onPress={handleFav} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <Ionicons name={fav ? 'heart' : 'heart-outline'} size={20} color={fav ? AppTheme.primaryColor : '#607a94'} />
                </Animated.View>
            </TouchableOpacity>
        </TouchableOpacity>
    );
}
