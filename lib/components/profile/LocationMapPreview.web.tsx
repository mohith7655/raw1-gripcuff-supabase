// IMPORTANT: Enable "Maps Embed API" in Google Cloud Console
// Same API key, same restrictions as Places API

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

type Props = {
    lat: number;
    lng: number;
    address: string;
    label: string;
    isGym: boolean;
};

export function LocationMapPreview({ lat, lng, address, label, isGym }: Props) {
    // Use lat,lng as the query for exact pin placement; zoom=18 to show the building
    const hasCoords = lat !== 0 && lng !== 0;
    const embedUrl =
        `https://www.google.com/maps/embed/v1/place` +
        `?key=${API_KEY}` +
        `&q=${hasCoords ? `${lat},${lng}` : encodeURIComponent(address)}` +
        `&zoom=18`;

    const trimmed = label?.trim();

    return (
        <View style={styles.container}>
            {trimmed ? (
                <Text style={styles.placeLabel}>📍 {trimmed}</Text>
            ) : null}
            <View style={styles.mapWrap}>
                <iframe
                    src={embedUrl}
                    width="100%"
                    height="180"
                    style={({ border: 0, borderRadius: 12, display: 'block' } as any)}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
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
    placeLabel: {
        color: '#F97316',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 6,
    },
    mapWrap: {
        height: 180,
        borderRadius: 12,
        overflow: 'hidden',
    } as any,
});
