import React, { useEffect, useRef } from 'react';
import {
    Animated,
    TouchableOpacity,
    Text,
    StyleSheet,
    View,
    Platform,
} from 'react-native';
import { Bell } from 'lucide-react-native';

interface Props {
    visible: boolean;
    videoTitle: string;
    countdown: string;
    onPress: () => void;
    onDismiss: () => void;
}

const AUTO_DISMISS_MS = 5000;

export function WorkoutReminderBanner({ visible, videoTitle, countdown, onPress, onDismiss }: Props) {
    const slideY = useRef(new Animated.Value(-120)).current;
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (visible) {
            Animated.spring(slideY, {
                toValue: 0,
                useNativeDriver: Platform.OS !== 'web',
                tension: 80,
                friction: 12,
            }).start();

            dismissTimer.current = setTimeout(() => {
                hide();
            }, AUTO_DISMISS_MS);
        } else {
            hide(false);
        }

        return () => {
            if (dismissTimer.current) clearTimeout(dismissTimer.current);
        };
    }, [visible]);

    const hide = (callDismiss = true) => {
        if (dismissTimer.current) {
            clearTimeout(dismissTimer.current);
            dismissTimer.current = null;
        }
        Animated.timing(slideY, {
            toValue: -120,
            duration: 250,
            useNativeDriver: Platform.OS !== 'web',
        }).start(() => {
            if (callDismiss) onDismiss();
        });
    };

    if (!visible) return null;

    return (
        <Animated.View
            style={[styles.container, { transform: [{ translateY: slideY }] }]}
            pointerEvents="box-none"
        >
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => {
                    hide();
                    onPress();
                }}
            >
                <View style={styles.iconWrap}>
                    <Bell size={20} color="#FF6B00" />
                </View>
                <View style={styles.textWrap}>
                    <Text style={styles.title} numberOfLines={1}>
                        Workout Reminder
                    </Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                        {videoTitle}
                    </Text>
                    <Text style={styles.countdown}>{countdown}</Text>
                </View>
                <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={() => hide()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Text style={styles.dismissText}>✕</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 52 : 40,
        left: 16,
        right: 16,
        zIndex: 9999,
    },
    card: {
        backgroundColor: '#1A1A1A',
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#FF6B0040',
        boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
        elevation: 8,
    },
    iconWrap: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#FF6B0020',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textWrap: {
        flex: 1,
    },
    title: {
        color: '#FF6B00',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    subtitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 1,
    },
    countdown: {
        color: '#999',
        fontSize: 12,
        marginTop: 1,
    },
    dismissBtn: {
        paddingLeft: 10,
    },
    dismissText: {
        color: '#666',
        fontSize: 14,
    },
});
