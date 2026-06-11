import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildLocationsMapHtml, MapPoint } from './locationsMapHtml';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

type Props = {
    points: MapPoint[];
    onMapTouchStart?: () => void;
    onMapTouchEnd?: () => void;
};

/** One map highlighting every passed location (gym / home / park). */
export function LocationsMap({ points, onMapTouchStart, onMapTouchEnd }: Props) {
    const valid = points.filter((p) => p && p.lat !== 0 && p.lng !== 0);
    if (!valid.length) return null;

    const html = buildLocationsMapHtml(valid, API_KEY);

    return (
        <View
            style={styles.wrap}
            onTouchStart={onMapTouchStart}
            onTouchEnd={onMapTouchEnd}
            onTouchCancel={onMapTouchEnd}
        >
            <WebView
                source={{ html }}
                style={styles.map}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                scrollEnabled={false}
                nestedScrollEnabled
                setBuiltInZoomControls={false}
                androidLayerType="hardware"
                startInLoadingState
                {...(Platform.OS === 'ios' ? { allowsInlineMediaPlayback: true } : {})}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        height: 140,
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 4,
        marginBottom: 12,
    },
    map: {
        flex: 1,
        backgroundColor: '#EEEEF2',
    },
});
