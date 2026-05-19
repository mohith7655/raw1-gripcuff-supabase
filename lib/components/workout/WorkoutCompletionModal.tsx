import React, { useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Platform,
    ActivityIndicator,
} from 'react-native';

type Props = {
    visible: boolean;
    videoTitle?: string;
    currentPositionMs: number;
    onDone: () => void;
    onKeepGoing: () => void;
    onClose: () => void;
};

type ReminderState = 'idle' | 'picking' | 'scheduled';

const REMINDER_OPTIONS = [
    { label: '1hr', seconds: 3600 },
    { label: '3hr', seconds: 10800 },
    { label: 'Schedule for Later', seconds: 57600 },
];

async function requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return true;
    try {
        const Notifications = await import('expo-notifications');
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
    } catch {
        return false;
    }
}

async function scheduleReminder(seconds: number, title: string, positionMs: number): Promise<void> {
    if (Platform.OS === 'web') {
        // Web: no push notifications — just log as confirmation
        console.log(`[Reminder] "${title}" scheduled in ${seconds}s (position: ${Math.floor(positionMs / 1000)}s)`);
        return;
    }
    const Notifications = await import('expo-notifications');
    const positionLabel = formatTime(positionMs);
    await Notifications.scheduleNotificationAsync({
        content: {
            title: 'Time to finish your workout! 💪',
            body: `You left off at ${positionLabel}. Pick up where you left off.`,
            data: { videoTitle: title },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, repeats: false },
    });
}

function formatTime(ms: number): string {
    if (!ms || !isFinite(ms)) return '0:00';
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

export function WorkoutCompletionModal({
    visible,
    videoTitle = 'this workout',
    currentPositionMs,
    onDone,
    onKeepGoing,
    onClose,
}: Props) {
    const [reminderState, setReminderState] = useState<ReminderState>('idle');
    const [scheduling, setScheduling] = useState(false);

    const handleSetReminder = () => setReminderState('picking');

    const handlePickReminder = async (seconds: number) => {
        setScheduling(true);
        const granted = await requestNotificationPermission();
        if (granted) {
            await scheduleReminder(seconds, videoTitle, currentPositionMs);
            setReminderState('scheduled');
        }
        setScheduling(false);
        if (granted) {
            setTimeout(() => {
                setReminderState('idle');
                onClose();
            }, 1500);
        }
    };

    const handleClose = () => {
        setReminderState('idle');
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={handleClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={handleClose}
            >
                <TouchableOpacity
                    style={styles.card}
                    activeOpacity={1}
                    onPress={() => {}} // absorb taps so card doesn't close
                >
                    {reminderState === 'scheduled' ? (
                        <View style={styles.confirmedWrap}>
                            <Text style={styles.confirmedText}>Reminder set! ✓</Text>
                        </View>
                    ) : reminderState === 'picking' ? (
                        <>
                            <Text style={styles.title}>When should we remind you?</Text>
                            {scheduling ? (
                                <ActivityIndicator color="#F97316" style={{ marginTop: 20 }} />
                            ) : (
                                <>
                                    {REMINDER_OPTIONS.map((opt) => (
                                        <TouchableOpacity
                                            key={opt.label}
                                            style={styles.primaryBtn}
                                            onPress={() => handlePickReminder(opt.seconds)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.primaryBtnText}>{opt.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                    <TouchableOpacity
                                        style={styles.secondaryBtn}
                                        onPress={() => setReminderState('idle')}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={styles.secondaryBtnText}>Cancel</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <Text style={styles.title}>Did you finish the workout?</Text>
                            <Text style={styles.subtitle}>
                                Great job! Log your progress below.
                            </Text>

                            <TouchableOpacity
                                style={styles.primaryBtn}
                                onPress={onDone}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.primaryBtnText}>Yes, I'm done! 💪</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.secondaryBtn}
                                onPress={onKeepGoing}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.secondaryBtnText}>No, keep going</Text>
                            </TouchableOpacity>

                            <View style={styles.divider} />

                            <TouchableOpacity
                                style={styles.ghostBtn}
                                onPress={handleSetReminder}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.ghostBtnText}>🔔  Set a reminder to finish later</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: '100%',
        backgroundColor: '#1F2937',
        borderRadius: 16,
        padding: 24,
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        color: '#9CA3AF',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20,
    },
    primaryBtn: {
        backgroundColor: '#F97316',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryBtn: {
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#374151',
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 10,
    },
    secondaryBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        backgroundColor: '#374151',
        marginTop: 16,
        marginBottom: 4,
    },
    ghostBtn: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    ghostBtnText: {
        color: '#F97316',
        fontSize: 14,
        fontWeight: '500',
    },
    confirmedWrap: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    confirmedText: {
        color: '#F97316',
        fontSize: 18,
        fontWeight: '700',
    },
});
