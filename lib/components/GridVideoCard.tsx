import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Image, Platform } from 'react-native';
import { Play } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { Raw1Logo } from '../raw1_logo';
import { AppTheme, FontSizes, FontWeights } from '../core/theme/app_theme';
import { ThumbnailCategory, VideoEngagementIcons } from './VideoCardBits';
import { useFavorites, FavoriteVideo } from '../hooks/useFavorites';
import { useVideoViews, formatViews } from '../services/videoViews.service';
import { SCREEN_PADDING, CARD_BORDER_RADIUS } from '../constants/theme';

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
    const views = useVideoViews(video.id != null ? String(video.id) : null);

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
            <View style={styles.thumbnail}>
                {(video as any).youtubeId && (
                    <Image
                        source={{ uri: `https://img.youtube.com/vi/${(video as any).youtubeId}/hqdefault.jpg` }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                    />
                )}
                <View style={{ position: 'absolute', top: 6, left: 6 }}>
                    <Raw1Logo fontSize={12} />
                </View>
                <View style={styles.playIconContainer}>
                    <Play color="rgba(33,24,50,0.14)" size={28} fill="rgba(33,24,50,0.14)" />
                </View>
                <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{video.duration}</Text>
                </View>
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                    {video.title}
                </Text>
                <ThumbnailCategory category={(video as any).category} difficulty={(video as any).difficulty} />
                {!!views && (
                    <Text style={styles.videoViews}>{formatViews(views)} views</Text>
                )}
                <VideoEngagementIcons videoId={video.id != null ? String(video.id) : null} />
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    // Glassy card wrapping the whole tile (thumbnail + details), matching the
    // Home screen's Recently Watched / Favorites cards.
    cardContainer: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.62)',
    },
    thumbnail: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
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
        color: '#7A7C90',
        fontSize: 10,
        fontWeight: '700',
    },
    infoContainer: {
        padding: 8,
    },
    videoTitle: {
        color: '#211832',
        fontSize: 11,
        fontWeight: '600',
        lineHeight: 15,
    },
    videoViews: {
        color: '#7A7C90',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 3,
    },
});
