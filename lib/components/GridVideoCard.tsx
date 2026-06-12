import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Image, Platform } from 'react-native';
import { Play } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Raw1Logo } from '../raw1_logo';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { formatDifficulty } from '../core/difficulty';
import { useFavorites, FavoriteVideo } from '../hooks/useFavorites';
import { SCREEN_PADDING, CARD_BORDER_RADIUS } from '../constants/theme';

const THUMBNAIL_COLORS = ['#8B7355', '#7A8A8A', '#4A5568', '#6B4226', '#2A2A3E', '#0D2137'];

export const GridVideoCard = ({
    video,
    index,
    onPress,
}: {
    video: FavoriteVideo;
    index: number;
    onPress?: () => void;
}) => {
    const { isFavorite, toggleFavorite } = useFavorites();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fav = isFavorite(video.id);
    const bgColor = THUMBNAIL_COLORS[index % THUMBNAIL_COLORS.length];

    const handleFavoritePress = () => {
        Animated.sequence([
            Animated.spring(scaleAnim, { toValue: 1.2, useNativeDriver: Platform.OS !== 'web' }),
            Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: Platform.OS !== 'web' })
        ]).start();
        toggleFavorite({
            id: String(video.id),
            title: video.title,
            duration: video.duration,
            category: (video as any).category,
            difficulty: (video as any).difficulty,
            videoUrl: (video as any).videoUrl,
            thumbnail: (video as any).thumbnail,
            type: 'video',
        });
    };

    return (
        <TouchableOpacity
            style={styles.cardContainer}
            activeOpacity={0.8}
            onPress={onPress}
        >
            <View style={[styles.thumbnail, { backgroundColor: bgColor }]}>
                {(video as any).youtubeId && (
                    <Image
                        source={{ uri: `https://img.youtube.com/vi/${(video as any).youtubeId}/hqdefault.jpg` }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                    />
                )}
                <View style={{ position: 'absolute', top: 6, left: 6 }}>
                    <Raw1Logo fontSize={12} transparent />
                </View>
                <View style={styles.playIconContainer}>
                    <Play color="rgba(255,255,255,0.12)" size={28} fill="rgba(255,255,255,0.12)" />
                </View>
                <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{video.duration}</Text>
                </View>
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                    {video.title}
                </Text>
                {!!formatDifficulty((video as any).difficulty) && (
                    <Text style={styles.videoDifficulty}>{formatDifficulty((video as any).difficulty)}</Text>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        flex: 1,
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
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4,
    },
    durationText: {
        color: '#fff',
        fontSize: 10,
    },
    infoContainer: {
        paddingHorizontal: 4,
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
    },
    videoTitle: {
        flex: 1,
        color: '#211832',
        fontSize: 12,
        marginTop: 8,
    },
    videoDifficulty: {
        color: '#7A7C90',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 3,
    },
});
