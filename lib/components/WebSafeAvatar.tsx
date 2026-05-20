import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, View } from 'react-native';

interface WebSafeAvatarProps {
    uri: string | null | undefined;
    size: number;
    fallback: React.ReactNode;
    style?: object;
    timeoutMs?: number;
}

/**
 * Renders a circular avatar image safely on both native and web.
 *
 * On web, React Native Image can hang indefinitely on Firebase Storage URLs
 * due to CORS/caching quirks, so we use a native <img> tag instead.
 * On native, we use the standard Image component with onLoad/onError handlers.
 *
 * Falls back to `fallback` prop if:
 *   - uri is empty
 *   - image fails to load
 *   - image hasn't loaded within `timeoutMs` (default 10 s)
 */
export function WebSafeAvatar({
    uri,
    size,
    fallback,
    style,
    timeoutMs = 10000,
}: WebSafeAvatarProps) {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        setLoaded(false);
        setError(false);
    }, [uri]);

    useEffect(() => {
        if (!uri || loaded || error) return;
        const t = setTimeout(() => setError(true), timeoutMs);
        return () => clearTimeout(t);
    }, [uri, loaded, error, timeoutMs]);

    const radius = size / 2;
    const containerStyle = [styles.container, { width: size, height: size, borderRadius: radius }, style];

    if (!uri || error) {
        return <View style={containerStyle}>{fallback}</View>;
    }

    if (Platform.OS === 'web') {
        return (
            <View style={containerStyle}>
                {!loaded && (
                    <View style={[StyleSheet.absoluteFillObject, styles.loadingOverlay, { borderRadius: radius }]}>
                        <ActivityIndicator color="#FF6B00" size="small" />
                    </View>
                )}
                {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                {/* @ts-ignore — native <img> on web via React Native Web */}
                <img
                    src={uri}
                    style={{
                        width: size,
                        height: size,
                        borderRadius: radius,
                        objectFit: 'cover',
                        display: loaded ? 'block' : 'none',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                    }}
                    onLoad={() => setLoaded(true)}
                    onError={() => setError(true)}
                />
            </View>
        );
    }

    return (
        <View style={containerStyle}>
            {!loaded && (
                <View style={[StyleSheet.absoluteFillObject, styles.loadingOverlay, { borderRadius: radius }]}>
                    <ActivityIndicator color="#FF6B00" size="small" />
                </View>
            )}
            <Image
                key={uri}
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: radius, opacity: loaded ? 1 : 0 }}
                onLoad={() => setLoaded(true)}
                onError={() => setError(true)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    loadingOverlay: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
