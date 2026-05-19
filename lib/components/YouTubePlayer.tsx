import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface YouTubePlayerProps {
    videoId: string;
    height?: number;
    startTime?: number;
}

export const YouTubePlayer = ({
    videoId,
    height = 260,
    startTime = 0,
}: YouTubePlayerProps) => {
    if (!videoId) {
        return (
            <View style={[styles.container, { height }]}>
                <Text style={styles.noVideoText}>No video ID</Text>
            </View>
        );
    }

    const src = `https://www.youtube.com/embed/${videoId}?autoplay=1&start=${Math.floor(startTime)}&modestbranding=1&rel=0`;

    return (
        <View style={[styles.container, { height }]}>
            <iframe
                src={src}
                style={({
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                } as any)}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%' as any,
        backgroundColor: '#000',
        position: 'relative',
        overflow: 'hidden',
    },
    noVideoText: {
        color: '#666',
        textAlign: 'center',
        marginTop: 100,
    },
});
