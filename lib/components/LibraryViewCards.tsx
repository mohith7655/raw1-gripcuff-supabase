import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { Play } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Raw1Logo } from '../raw1_logo';
import { LinearGradient } from 'expo-linear-gradient';
import { AppTheme } from '../core/theme/app_theme';
import { formatDifficulty } from '../core/difficulty';
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

// Muted earthy / slate thumbnail gradients (Ash & Midnight)
const GRADIENTS: [string, string][] = [
    ['#8B7355', '#6B5B45'],   // tan / brown
    ['#7A8A8A', '#5A6A6A'],   // slate green-grey
    ['#4A5568', '#2D3748'],   // slate-blue
    ['#6B4226', '#4A2E1A'],   // brown
    ['#2A2A3E', '#1A1A2E'],   // dark navy
    ['#0D2137', '#1A3A5C'],   // deep blue
    ['#C4B8A8', '#A09488'],   // beige
    ['#3B1F0B', '#5C3319'],   // dark amber
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
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <Play color="rgba(255,255,255,0.12)" size={playSize} fill="rgba(255,255,255,0.12)" />
                </View>
                <View style={{ position: 'absolute', top: 4, left: 4 }}>
                    <Raw1Logo fontSize={10} transparent />
                </View>
                <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{durationLabel}</Text>
                </View>
            </LinearGradient>

            <View style={{ paddingTop: 4, paddingHorizontal: 1 }}>
                <Text style={{ color: '#211832', fontSize: 11, fontWeight: '600', lineHeight: 15 }} numberOfLines={2}>
                    {displayTitle}
                </Text>
                {!!formatDifficulty(video.difficulty) && (
                    <Text style={{ color: '#7A7C90', fontSize: 10, fontWeight: '600', marginTop: 2 }}>{formatDifficulty(video.difficulty)}</Text>
                )}
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
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F8F8FC', gap: 12 }}
            onPress={onPress}
            activeOpacity={0.82}
        >
            <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ width: 78, height: 54, borderRadius: 8, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}
            >
                <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <Play color="rgba(255,255,255,0.12)" size={22} fill="rgba(255,255,255,0.12)" />
                </View>
                <View style={{ position: 'absolute', top: 3, left: 3 }}>
                    <Raw1Logo fontSize={9} transparent />
                </View>
                <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>{durationLabel}</Text>
                </View>
            </LinearGradient>

            <View style={{ flex: 1 }}>
                <Text style={{ color: '#211832', fontSize: 13, fontWeight: '600', lineHeight: 18 }} numberOfLines={2}>
                    {displayTitle}
                </Text>
                <Text style={{ color: '#7A7C90', fontSize: 11, marginTop: 2 }}>
                    {[formatDifficulty(video.difficulty), video.category, durationLabel].filter(Boolean).join(' · ')}
                </Text>
            </View>

        </TouchableOpacity>
    );
}
