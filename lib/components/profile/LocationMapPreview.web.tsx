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

    // `view` endpoint centres the map without dropping an exact pin
    const embedUrl = hasCoords
        ? `https://www.google.com/maps/embed/v1/view?key=${API_KEY}&center=${lat},${lng}&zoom=11&maptype=roadmap`
        : `https://www.google.com/maps/embed/v1/place?key=${API_KEY}&q=${encodeURIComponent(address)}&zoom=11`;

    const mapsUrl = hasCoords
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

    const [blocked, setBlocked] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleError = () => setBlocked(true);
    const handleLoad = () => { if (timerRef.current) clearTimeout(timerRef.current); };
    const startTimer = () => {
        timerRef.current = setTimeout(() => {
            try {
                if (!iframeRef.current?.contentWindow?.location?.href?.includes('google')) setBlocked(true);
            } catch { /* cross-origin — loaded fine */ }
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
                    <>
                        <iframe
                            ref={iframeRef as any}
                            src={embedUrl}
                            width="100%"
                            height="180"
                            style={({ border: 0, borderRadius: 12, display: 'block', touchAction: 'pan-x pan-y', filter: 'invert(0.92) hue-rotate(180deg) brightness(0.95) contrast(0.9)' } as any)}
                            allowFullScreen
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            onError={handleError}
                            onLoad={handleLoad}
                            onMouseOver={startTimer as any}
                        />
                        {/* Soft radial blob — Airbnb-style, no exact location */}
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 170,
                            height: 170,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(242,89,18,0.55) 0%, rgba(242,89,18,0.30) 35%, rgba(242,89,18,0.10) 65%, transparent 100%)',
                            filter: 'blur(6px)',
                            pointerEvents: 'none',
                        }} />
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginTop: 12, marginBottom: 8 },
    placeLabel: {
        color: '#F25912', fontSize: 14, fontWeight: '700', marginBottom: 6,
    },
    mapWrap: {
        height: 180,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    } as any,
    fallback: {
        flex: 1, backgroundColor: '#EEEEF2', borderRadius: 12,
        borderWidth: 1, borderColor: 'rgba(242,89,18,0.2)',
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 16, gap: 4,
    },
    fallbackIcon: { fontSize: 28, marginBottom: 4 },
    fallbackTitle: { color: '#211832', fontSize: 14, fontWeight: '700', textAlign: 'center' },
    fallbackSub: {
        color: 'rgba(150,180,210,0.6)', fontSize: 11, textAlign: 'center',
    } as any,
    fallbackBtn: {
        marginTop: 8, paddingHorizontal: 14, paddingVertical: 7,
        borderRadius: 20, backgroundColor: 'rgba(242,89,18,0.15)',
        borderWidth: 1, borderColor: 'rgba(242,89,18,0.4)',
    },
    fallbackBtnText: { color: '#F25912', fontSize: 12, fontWeight: '700' },
});
