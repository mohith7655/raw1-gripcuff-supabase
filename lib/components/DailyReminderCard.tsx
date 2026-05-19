import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Bell, Edit2, Zap } from 'lucide-react-native';
import { MoveReminder, MoveReminderService, formatMoveTime12h } from '../services/moveReminder.service';
import { MoveReminderModal } from './MoveReminderModal';
import { reminderWatcherService } from '../services/reminderWatcher.service';

const ACCENT = '#FF6B00';
const CARD_BG = '#111d2e';
const BORDER = 'rgba(255,107,0,0.18)';

interface Props {
    userId?: string;
}

export function DailyReminderCard({ userId }: Props) {
    const [settings, setSettings] = useState<MoveReminder | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [toggling, setToggling] = useState(false);

    const load = useCallback(() => {
        if (!userId) return;
        MoveReminderService.loadDefault(userId).then(s => {
            setSettings(s);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [userId]);

    useEffect(() => { load(); }, [load]);

    const handleToggle = async () => {
        if (!userId || !settings || toggling) return;
        setToggling(true);
        const next: MoveReminder = { ...settings, enabled: !settings.enabled };
        await MoveReminderService.save(userId, next).catch(() => {});
        setSettings(next);
        setToggling(false);
        reminderWatcherService.invalidateMoveCache();
    };

    const handleSaved = (s: MoveReminder) => {
        setSettings(s);
        reminderWatcherService.invalidateMoveCache();
    };

    if (!userId) return null;

    const enabled = settings?.enabled ?? false;
    const times = settings?.generatedTimes ?? [];
    const count = times.length;
    const firstTime = times[0] ? formatMoveTime12h(times[0]) : null;
    const lastTime = times[times.length - 1] ? formatMoveTime12h(times[times.length - 1]) : null;

    const summaryText = !settings || times.length === 0
        ? 'Stay active throughout the day'
        : enabled
            ? `${count} reminder${count !== 1 ? 's' : ''} · ${firstTime}–${lastTime}`
            : `Paused · ${firstTime}–${lastTime}`;

    return (
        <>
            <View style={s.card}>
                <View style={s.left}>
                    <View style={[s.iconWrap, enabled && s.iconWrapOn]}>
                        <Bell color={enabled ? ACCENT : '#4a6480'} size={18} />
                    </View>
                    <View style={s.textBlock}>
                        <Text style={s.cardTitle}>Reminder to Move</Text>
                        {loading
                            ? <ActivityIndicator color={ACCENT} size="small" />
                            : <Text style={s.summaryText} numberOfLines={1}>{summaryText}</Text>
                        }
                    </View>
                </View>

                <View style={s.right}>
                    <TouchableOpacity
                        style={s.testBtn}
                        onPress={() => reminderWatcherService.testFireAlarm()}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.75}
                    >
                        <Zap color="#f59e0b" size={13} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={s.editBtn}
                        onPress={() => setModalVisible(true)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.75}
                    >
                        <Edit2 color={ACCENT} size={15} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.togglePill, enabled && s.togglePillOn]}
                        onPress={handleToggle}
                        disabled={toggling || loading}
                        activeOpacity={0.8}
                    >
                        {toggling
                            ? <ActivityIndicator color="#fff" size="small" style={{ width: 22, height: 22 }} />
                            : <View style={[s.toggleThumb, enabled && s.toggleThumbOn]} />
                        }
                    </TouchableOpacity>
                </View>
            </View>

            <MoveReminderModal
                visible={modalVisible}
                userId={userId}
                onClose={() => setModalVisible(false)}
                onSaved={handleSaved}
            />
        </>
    );
}

const s = StyleSheet.create({
    card: {
        backgroundColor: CARD_BG,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: BORDER,
        marginHorizontal: 4,
        marginBottom: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    iconWrapOn: {
        backgroundColor: 'rgba(255,107,0,0.12)',
        borderColor: 'rgba(255,107,0,0.35)',
    },
    textBlock: { flex: 1 },
    cardTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    summaryText: {
        color: '#4a6480',
        fontSize: 12,
        fontWeight: '500',
    },
    right: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
    },
    testBtn: {
        width: 28,
        height: 28,
        borderRadius: 7,
        backgroundColor: 'rgba(245,158,11,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    editBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255,107,0,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    togglePill: {
        width: 48,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#1c2e42',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    togglePillOn: {
        backgroundColor: ACCENT,
        borderColor: ACCENT,
    },
    toggleThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#4a6480',
    },
    toggleThumbOn: {
        backgroundColor: '#fff',
        alignSelf: 'flex-end',
    },
});
