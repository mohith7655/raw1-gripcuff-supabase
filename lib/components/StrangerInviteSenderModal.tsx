import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Animated,
    Easing,
    Platform,
} from 'react-native';
import { X, Clock, CheckCircle, XCircle } from 'lucide-react-native';

const ACCENT = '#F97316';
const TIMEOUT_SEC = 10;

type Phase = 'sending' | 'waiting' | 'accepted' | 'declined' | 'expired' | 'error';

type Props = {
    visible: boolean;
    phase: Phase;
    targetName: string;
    workoutTitle: string;
    secondsLeft: number;
    errorMessage?: string;
    onCancel: () => void;
    onDismiss: () => void;
};

function PulsingRing() {
    const scale = useRef(new Animated.Value(1)).current;
    const opacity = useRef(new Animated.Value(0.6)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(scale, { toValue: 1.4, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
                    Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.in(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
                ]),
                Animated.sequence([
                    Animated.timing(opacity, { toValue: 0.1, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
                    Animated.timing(opacity, { toValue: 0.6, duration: 900, useNativeDriver: Platform.OS !== 'web' }),
                ]),
            ]),
        );
        anim.start();
        return () => anim.stop();
    }, [scale, opacity]);

    return (
        <Animated.View
            style={[
                styles.pulseRing,
                { transform: [{ scale }], opacity },
            ]}
        />
    );
}

function CountdownRing({ secondsLeft }: { secondsLeft: number }) {
    const pct = secondsLeft / TIMEOUT_SEC;
    return (
        <View style={styles.countdownWrap}>
            <PulsingRing />
            <View style={styles.countdownInner}>
                <Text style={styles.countdownNum}>{secondsLeft}</Text>
                <Text style={styles.countdownLabel}>sec</Text>
            </View>
        </View>
    );
}

export function StrangerInviteSenderModal({
    visible,
    phase,
    targetName,
    workoutTitle,
    secondsLeft,
    errorMessage,
    onCancel,
    onDismiss,
}: Props) {
    const isDone = phase === 'accepted' || phase === 'declined' || phase === 'expired' || phase === 'error';

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>
                            {phase === 'waiting' || phase === 'sending' ? 'Inviting Gym Partner' :
                             phase === 'accepted' ? 'Invite Accepted!' :
                             phase === 'declined' ? 'Invite Declined' :
                             phase === 'expired' ? 'Invite Expired' : 'Something went wrong'}
                        </Text>
                        {!isDone && (
                            <TouchableOpacity onPress={onCancel} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <X color="#6B7280" size={20} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Body */}
                    {(phase === 'sending' || phase === 'waiting') && (
                        <View style={styles.body}>
                            <CountdownRing secondsLeft={secondsLeft} />
                            <Text style={styles.bodyTitle}>
                                Waiting for <Text style={styles.accentText}>{targetName}</Text>
                            </Text>
                            <Text style={styles.bodySubtitle}>
                                {workoutTitle}
                            </Text>
                            <Text style={styles.bodyHint}>
                                They have {TIMEOUT_SEC} seconds to accept
                            </Text>
                        </View>
                    )}

                    {phase === 'accepted' && (
                        <View style={styles.body}>
                            <View style={styles.resultIcon}>
                                <CheckCircle color="#22c55e" size={56} />
                            </View>
                            <Text style={styles.bodyTitle}>
                                <Text style={styles.accentText}>{targetName}</Text> accepted!
                            </Text>
                            <Text style={styles.bodySubtitle}>Joining workout session…</Text>
                        </View>
                    )}

                    {phase === 'declined' && (
                        <View style={styles.body}>
                            <View style={styles.resultIcon}>
                                <XCircle color="#ef4444" size={56} />
                            </View>
                            <Text style={styles.bodyTitle}>Invite Declined</Text>
                            <Text style={styles.bodySubtitle}>
                                <Text style={styles.accentText}>{targetName}</Text> declined your invite.
                            </Text>
                            <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
                                <Text style={styles.dismissBtnText}>Dismiss</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {(phase === 'expired' || phase === 'error') && (
                        <View style={styles.body}>
                            <View style={styles.resultIcon}>
                                <Clock color="#6B7280" size={56} />
                            </View>
                            <Text style={styles.bodyTitle}>
                                {phase === 'error' ? 'Something went wrong' : 'Invite Expired'}
                            </Text>
                            <Text style={styles.bodySubtitle}>
                                {phase === 'error'
                                    ? (errorMessage ?? 'Please try again.')
                                    : `${targetName} didn't respond in time.`}
                            </Text>
                            <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
                                <Text style={styles.dismissBtnText}>Dismiss</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Cancel button while waiting */}
                    {(phase === 'waiting' || phase === 'sending') && (
                        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.8}>
                            <Text style={styles.cancelBtnText}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#111827',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(249,115,22,0.2)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
        flex: 1,
    },
    closeBtn: {
        padding: 4,
    },
    body: {
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
        gap: 10,
    },
    countdownWrap: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 4,
    },
    pulseRing: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 3,
        borderColor: ACCENT,
    },
    countdownInner: {
        alignItems: 'center',
    },
    countdownNum: {
        color: ACCENT,
        fontSize: 36,
        fontWeight: '800',
        lineHeight: 40,
    },
    countdownLabel: {
        color: '#6B7280',
        fontSize: 12,
        fontWeight: '600',
    },
    bodyTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    bodySubtitle: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
    },
    bodyHint: {
        color: '#4B5563',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
    },
    accentText: {
        color: ACCENT,
    },
    resultIcon: {
        marginBottom: 4,
    },
    dismissBtn: {
        marginTop: 8,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 32,
    },
    dismissBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    cancelBtn: {
        margin: 20,
        marginTop: 0,
        backgroundColor: 'rgba(239,68,68,0.12)',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.3)',
    },
    cancelBtnText: {
        color: '#ef4444',
        fontSize: 15,
        fontWeight: '700',
    },
});
