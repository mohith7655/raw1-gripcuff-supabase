// Uses Google Maps Static API — no native module required, renders as an Image.
// IMPORTANT: Enable "Maps Static API" in Google Cloud Console (same key as Places API).

import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? '';

type Props = {
    lat: number;
    lng: number;
    address: string;
    label: string;
    isGym: boolean;
};

export function LocationMapPreview({ lat, lng, label, isGym }: Props) {
    const markerColor = 'red';
    const staticUrl =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${lat},${lng}` +
        `&zoom=15` +
        `&size=600x180` +
        `&scale=2` +
        `&markers=color:${markerColor}%7C${lat},${lng}` +
        `&key=${API_KEY}`;

    const gymName = isGym ? label : null;

    return (
        <View style={styles.container}>
            {gymName && (
                <Text style={styles.gymName}>📍 {gymName}</Text>
            )}
            <Image
                source={{ uri: staticUrl }}
                style={styles.map}
                resizeMode="cover"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: 12,
        marginBottom: 8,
    },
    gymName: {
        color: '#F97316',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 6,
    },
    map: {
        height: 180,
        borderRadius: 12,
        width: '100%',
    },
});
