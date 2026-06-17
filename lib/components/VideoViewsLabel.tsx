import React from 'react';
import { Text, View, StyleSheet, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoViews, formatViews } from '../services/videoViews.service';

/**
 * YouTube-style "X views" label for a single video. Self-fetches from the
 * shared, batched view-count cache so it can be dropped into any list card.
 * Renders nothing until a non-zero count is known, to avoid a "0 views" flash.
 */
export function VideoViewsLabel({
    videoId,
    color = '#7A7C90',
    size = 11,
    showIcon = false,
}: {
    videoId: string | null | undefined;
    color?: string;
    size?: number;
    showIcon?: boolean;
}) {
    const views = useVideoViews(videoId);
    if (!views) return null;

    const textStyle: TextStyle = { color, fontSize: size, fontWeight: '600' };

    return (
        <View style={styles.row}>
            {showIcon && <Ionicons name="eye-outline" size={size + 2} color={color} />}
            <Text style={textStyle}>{formatViews(views)} views</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
});
