// IMPORTANT: Enable "Maps Embed API" in Google Cloud Console
// Same API key, same restrictions as Places API

import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

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
    lat, lng, address, label, onMapTouchStart, onMapTouchEnd,
}: Props) {
    const hasCoords = lat !== 0 && lng !== 0;
    const embedUrl =
        `https://www.google.com/maps/embed/v1/place` +
        `?key=${API_KEY}` +
        `&q=${hasCoords ? `${lat},${lng}` : encodeURIComponent(address)}` +
        `&zoom=16`;

    // Open in Google Maps when the fallback is tapped
    const mapsUrl = hasCoords
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

    const [blocked, setBlocked] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Detect if the iframe was blocked (net::ERR_BLOCKED_BY_CLIENT fires as an error event)
    const handleError = () => setBlocked(true);

    // Also detect via load timeout — if iframe hasn't navigated after 4s, assume blocked
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handleLoad = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
    };
    const startTimer = () => {
        timerRef.current = setTimeout(() => {
            // Check if iframe is still on about:blank (blocked)
            try {
                if (!iframeRef.current?.contentWindow?.location?.href?.includes('google')) {
                    setBlocked(true);
                }
            } catch {
                // cross-origin — means it loaded fine, Google blocked cross-origin access
            }
        }, 4000);
    };

    const trimmed = label?.trim();

    return (
        <View style={styles.container}>
            {trimmed ? <Text style={styles.placeLabel}>📍 {trimmed}</Text> : null}

            <View
                style={styles.mapWrap}
                onTouchStart={onMapTouchStart}
                onTouchEnd={onMapTouchEnd}
                onTouchCancel={onMapTouchEnd}
            >
                {blocked ? (
                    /* Fallback — shown when tracking-prevention / ad-blocker blocks the iframe */
                    <TouchableOpacity
                        style={styles.fallback}
                        onPress={() => Linking.openURL(mapsUrl)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.fallbackIcon}>🗺️</Text>
                        <Text style={styles.fallbackTitle}>
                            {(label?.trim()) || (address?.split(',')[0]) || 'View on map'}
                        </Text>
                        <Text style={styles.fallbackSub}>{address}</Text>
                        <View style={styles.fallbackBtn}>
                            <Text style={styles.fallbackBtnText}>Open in Google Maps →</Text>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <iframe
                        ref={iframeRef as any}
                        src={embedUrl}
                        width="100%"
                        height="180"
                        style={({ border: 0, borderRadius: 12, display: 'block', touchAction: 'pan-x pan-y' } as any)}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        onError={handleError}
                        onLoad={handleLoad}
                        onMouseOver={startTimer as any}
                    />
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 12,
        marginBottom: 8,
    },
    placeLabel: {
        color: '#E89951',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 6,
    },
    mapWrap: {
        height: 180,
        borderRadius: 12,
        overflow: 'hidden',
    } as any,
    fallback: {
        flex: 1,
        backgroundColor: '#0d1825',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(232,153,81,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        gap: 4,
    },
    fallbackIcon: {
        fontSize: 28,
        marginBottom: 4,
    },
    fallbackTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    fallbackSub: {
        color: 'rgba(150,180,210,0.6)',
        fontSize: 11,
        textAlign: 'center',
        numberOfLines: 2,
    } as any,
    fallbackBtn: {
        marginTop: 8,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: 'rgba(232,153,81,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(232,153,81,0.4)',
    },
    fallbackBtnText: {
        color: '#E89951',
        fontSize: 12,
        fontWeight: '700',
    },
});
