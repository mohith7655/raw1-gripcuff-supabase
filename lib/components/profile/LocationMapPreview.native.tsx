import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

// Dark-mode the embed (no native style support) by inverting + hue-rotating the
// whole document — the classic readable-dark-map trick. Applied to <html> so
// dynamically loaded tiles inherit it too.
const DARK_MAP_CSS = `
  (function() {
    var s = document.createElement('style');
    s.innerHTML = 'html{filter:invert(0.92) hue-rotate(180deg) brightness(0.95) contrast(0.9);background:#F8F8FC !important;}';
    document.head.appendChild(s);
  })();
  true;
`;

type Props = {
    lat: number;
    lng: number;
    address: string;
    label: string;
    isGym: boolean;
    onMapTouchStart?: () => void;
    onMapTouchEnd?: () => void;
};

export function LocationMapPreview({
    lat, lng, address, label, isGym, onMapTouchStart, onMapTouchEnd,
}: Props) {
    const hasCoords = lat !== 0 && lng !== 0;

    // `view` endpoint centres the map without dropping an exact pin
    const embedUrl = hasCoords
        ? `https://www.google.com/maps/embed/v1/view?key=${API_KEY}&center=${lat},${lng}&zoom=11&maptype=roadmap`
        : `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${encodeURIComponent(address)}&zoom=11`;

    const gymName = isGym ? label : (label?.trim() || null);

    return (
        <View style={styles.container}>
            {gymName ? <Text style={styles.gymName}>📍 {gymName}</Text> : null}

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
                    injectedJavaScript={DARK_MAP_CSS}
                    {...(Platform.OS === 'ios' ? { allowsInlineMediaPlayback: true } : {})}
                />

                {/* Soft radial blob via concentric circles — simulates Airbnb gradient */}
                {([
                    { size: 180, opacity: 0.06 },
                    { size: 140, opacity: 0.12 },
                    { size: 100, opacity: 0.20 },
                    { size: 60,  opacity: 0.32 },
                ] as const).map(({ size, opacity }, i) => (
                    <View key={i} pointerEvents="none" style={{
                        position: 'absolute',
                        top: 90 - size / 2,
                        left: '50%' as any,
                        marginLeft: -size / 2,
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: `rgba(242,89,18,${opacity})`,
                    }} />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginTop: 12, marginBottom: 8 },
    gymName: {
        color: '#F25912', fontSize: 14, fontWeight: '700', marginBottom: 6,
    },
    mapWrap: {
        height: 180,
        borderRadius: 12,
        overflow: 'hidden',
    },
    map: {
        flex: 1,
        backgroundColor: '#EEEEF2',
    },
});
