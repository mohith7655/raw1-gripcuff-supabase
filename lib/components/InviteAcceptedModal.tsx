import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Dimensions,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ORANGE = '#F97316';

type Props = {
    guestName: string;
    videoTitle: string;
    onClose: () => void;
    onJoin?: () => void;
};

export function InviteAcceptedModal({ guestName, videoTitle, onClose, onJoin }: Props) {
    const translateY = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Slide down in
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: Platform.OS !== 'web',
                tension: 80,
                friction: 10,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 250,
                useNativeDriver: Platform.OS !== 'web',
            }),
        ]).start();

        // Auto-dismiss after 10 seconds — longer than the old 5 so the host
        // has time to tap "Join Now" before it slides away.
        const timer = setTimeout(() => dismiss(), 10000);
        return () => clearTimeout(timer);
    }, []);

    const dismiss = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -120,
                duration: 300,
                useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: Platform.OS !== 'web',
            }),
        ]).start(() => onClose());
    };

    return (
        <Animated.View
            style={[
                styles.container,
                { transform: [{ translateY }], opacity },
            ]}
            pointerEvents="box-none"
        >
            <View style={styles.card}>
                <View style={styles.iconWrap}>
                    <Ionicons name="checkmark-circle" size={32} color={ORANGE} />
                </View>
                <View style={styles.textBlock}>
                    <Text style={styles.title}>Invite Accepted! 🎉</Text>
                    <Text style={styles.body} numberOfLines={2}>
                        <Text style={styles.name}>{guestName}</Text>
                        {' is in for '}
                        <Text style={styles.video}>{videoTitle}</Text>
                    </Text>
                </View>
                {onJoin && (
                    <TouchableOpacity
                        onPress={() => { onJoin(); dismiss(); }}
                        style={styles.joinBtn}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.joinBtnText}>Join Now</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={dismiss} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close" size={18} color="#6B7280" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 56 : 16,
        left: 16,
        right: 16,
        zIndex: 9999,
        elevation: 9999,
        alignItems: 'center',
    } as any,
    card: {
        width: '100%',
        maxWidth: 420,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a2740',
        borderRadius: 16,
        paddingVertical: 14,
        paddingHorizontal: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.3)',
        boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
        elevation: 12,
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(249,115,22,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    textBlock: {
        flex: 1,
    },
    title: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 2,
    },
    body: {
        color: '#9CA3AF',
        fontSize: 13,
        lineHeight: 18,
    },
    name: {
        color: ORANGE,
        fontWeight: '600',
    },
    video: {
        color: '#fff',
        fontWeight: '500',
    },
    joinBtn: {
        flexShrink: 0,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: ORANGE,
    },
    joinBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    closeBtn: {
        flexShrink: 0,
        padding: 2,
    },
});
