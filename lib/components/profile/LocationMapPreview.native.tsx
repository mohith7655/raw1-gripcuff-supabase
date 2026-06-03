// Interactive map preview for native — renders the Google Maps Embed inside a
// WebView so users can hold / drag / swipe to pan and pinch to zoom in-app.
// IMPORTANT: Enable "Maps Embed API" in Google Cloud Console (same key as Places API).

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

type Props = {
    lat: number;
    lng: number;
    address: string;
    label: string;
    isGym: boolean;
    /** Called when a touch begins on the map — parent should pause its ScrollView. */
    onMapTouchStart?: () => void;
    /** Called when the touch ends/cancels — parent should resume its ScrollView. */
    onMapTouchEnd?: () => void;
};

export function LocationMapPreview({
    lat, lng, address, label, isGym, onMapTouchStart, onMapTouchEnd,
}: Props) {
    const hasCoords = lat !== 0 && lng !== 0;
    const embedUrl =
        `https://www.google.com/maps/embed/v1/place` +
        `?key=${API_KEY}` +
        `&q=${hasCoords ? `${lat},${lng}` : encodeURIComponent(address)}` +
        `&zoom=16`;

    const gymName = isGym ? label : (label?.trim() || null);

    return (
        <View style={styles.container}>
            {gymName ? <Text style={styles.gymName}>📍 {gymName}</Text> : null}
            {/* onTouch* fire without claiming the responder, so the WebView still
                receives the gesture while we tell the parent to stop scrolling. */}
            <View
                style={styles.mapWrap}
                onTouchStart={onMapTouchStart}
                onTouchEnd={onMapTouchEnd}
                onTouchCancel={onMapTouchEnd}
            >
                <WebView
                    source={{ uri: embedUrl }}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 12,
        marginBottom: 8,
    },
    gymName: {
        color: '#E89951',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 6,
    },
    mapWrap: {
        height: 180,
        borderRadius: 12,
        overflow: 'hidden',
    },
    map: {
        flex: 1,
        backgroundColor: '#0d1825',
    },
});
