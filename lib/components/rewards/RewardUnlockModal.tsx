import React, { useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { ALL_BADGES, Badge } from '../../services/rewards.service';

const ACCENT = '#FF6B00';

type Props = {
    visible: boolean;
    badgeIds: string[];
    creditsAwarded: number;
    onDismiss: () => void;
};

function Particle({ delay, angle }: { delay: number; angle: number }) {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.delay(delay),
            Animated.timing(progress, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        ]).start();
    }, []);

    const rad = (angle * Math.PI) / 180;
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * 70] });
    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * 70] });
    const opacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.8, 0] });
    const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5] });

    const colors = [ACCENT, '#FFB347', '#FFD700', '#FF4500', '#FFA500'];
    const color = colors[Math.floor(angle / 45) % colors.length];

    return (
        <Animated.View
            style={[
                { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: color },
                { transform: [{ translateX }, { translateY }, { scale }], opacity },
            ]}
        />
    );
}

function BadgeDisplay({ badge, creditsAwarded }: { badge: Badge; creditsAwarded: number }) {
    const scaleAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
    }, []);

    const particles = [0, 45, 90, 135, 180, 225, 270, 315];

    return (
        <Animated.View style={[styles.badgeContainer, { transform: [{ scale: scaleAnim }] }]}>
            {/* Confetti particles */}
            <View style={[styles.particleOrigin, { pointerEvents: 'none' } as any]}>
                {particles.map((angle) => (
                    <Particle key={angle} angle={angle} delay={angle * 3} />
                ))}
            </View>

            <View style={styles.badgeCircle}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
            </View>
            <Text style={styles.badgeLabel}>{badge.label}</Text>
            <Text style={styles.badgeDesc}>{badge.description}</Text>

            {creditsAwarded > 0 && (
                <View style={styles.creditPill}>
                    <Text style={styles.creditPillText}>+{creditsAwarded} credits</Text>
                </View>
            )}
        </Animated.View>
    );
}

export function RewardUnlockModal({ visible, badgeIds, creditsAwarded, onDismiss }: Props) {
    const badges = badgeIds.map(id => ALL_BADGES.find(b => b.id === id)).filter(Boolean) as Badge[];
    const primaryBadge = badges[0];

    if (!primaryBadge) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <Text style={styles.headline}>Achievement Unlocked!</Text>

                    <BadgeDisplay badge={primaryBadge} creditsAwarded={creditsAwarded} />

                    {badges.length > 1 && (
                        <Text style={styles.extraBadges}>
                            +{badges.length - 1} more badge{badges.length > 2 ? 's' : ''} unlocked
                        </Text>
                    )}

                    <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
                        <Text style={styles.dismissText}>Awesome!</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    sheet: {
        backgroundColor: '#111d2e',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.3)',
    },
    headline: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 24,
        textAlign: 'center',
    },
    badgeContainer: { alignItems: 'center', marginBottom: 16 },
    particleOrigin: {
        position: 'absolute',
        width: 0,
        height: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(255,107,0,0.15)',
        borderWidth: 2,
        borderColor: ACCENT,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    badgeEmoji: { fontSize: 40 },
    badgeLabel: { color: '#ffffff', fontSize: 18, fontWeight: '800', marginBottom: 6, textAlign: 'center' },
    badgeDesc: { color: '#607a94', fontSize: 13, textAlign: 'center', marginBottom: 12 },
    creditPill: {
        backgroundColor: 'rgba(255,107,0,0.15)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.4)',
    },
    creditPillText: { color: ACCENT, fontSize: 14, fontWeight: '700' },
    extraBadges: { color: '#8aaccc', fontSize: 13, marginBottom: 16 },
    dismissBtn: {
        backgroundColor: ACCENT,
        borderRadius: 14,
        paddingVertical: 14,
        paddingHorizontal: 48,
        marginTop: 8,
    },
    dismissText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
