import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Bell, Edit2, Zap } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { MoveReminder, MoveReminderService, formatMoveTime12h } from '../services/moveReminder.service';
import { useFocusEffect } from '@react-navigation/native';
import { reminderWatcherService } from '../services/reminderWatcher.service';
import { GlassSheen } from './theme';

const ACCENT = '#F25912';
const CARD_BG = 'transparent'; // GlassSheen (blur) supplies the surface
const BORDER_ON  = 'rgba(34,197,94,0.18)';
const BORDER_OFF = 'rgba(239,68,68,0.18)';

interface Props {
    userId?: string;
}

export function DailyReminderCard({ userId }: Props) {
    const navigation = useNavigation<any>();
    const [settings, setSettings] = useState<MoveReminder | null>(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);

    const load = useCallback(() => {
        if (!userId) return;
        MoveReminderService.loadDefault(userId).then(s => {
            setSettings(s);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [userId]);

    // Reload whenever the screen comes back into focus (returning from MoveReminderScreen)
    useFocusEffect(useCallback(() => { load(); }, [load]));

    const handleToggle = async () => {
        if (!userId || !settings || toggling) return;
        setToggling(true);
        const next: MoveReminder = { ...settings, enabled: !settings.enabled };
        await MoveReminderService.save(userId, next).catch(() => {});
        setSettings(next);
        setToggling(false);
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
        <View style={[s.card, { borderColor: enabled ? BORDER_ON : BORDER_OFF }]}>
                <GlassSheen radius={16} />
                <View style={s.left}>
                    <View style={[s.iconWrap, enabled && s.iconWrapOn]}>
                        <Bell color={enabled ? '#22c55e' : '#7A7C90'} size={18} />
                    </View>
                    <View style={s.textBlock}>
                        <Text style={s.cardTitle}>Stay Active All Day</Text>
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
                        <Zap color="#4C4E78" size={13} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={s.editBtn}
                        onPress={() => navigation.navigate('MoveReminderScreen', { userId })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.75}
                    >
                        <Edit2 color="#4C4E78" size={15} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.togglePill, enabled && s.togglePillOn]}
                        onPress={handleToggle}
                        disabled={toggling || loading}
                        activeOpacity={0.8}
                    >
                        {toggling
                            ? <ActivityIndicator color="#211832" size="small" style={{ width: 22, height: 22 }} />
                            : <View style={[s.toggleThumb, enabled && s.toggleThumbOn]} />
                        }
                    </TouchableOpacity>
                </View>
        </View>
    );
}

const s = StyleSheet.create({
    card: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        borderWidth: 1,
        marginHorizontal: 4,
        marginBottom: 12,
        paddingHorizontal: 14,
        paddingVertical: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#211832',
        shadowOpacity: 0.12,
        shadowRadius: 34,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
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
        borderColor: 'rgba(33,24,50,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    iconWrapOn: {
        backgroundColor: 'rgba(34,197,94,0.12)',
        borderColor: 'rgba(34,197,94,0.35)',
    },
    textBlock: { flex: 1 },
    cardTitle: {
        color: '#211832',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    summaryText: {
        color: '#7A7C90',
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
        backgroundColor: 'rgba(76,78,120,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(76,78,120,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    editBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(76,78,120,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(76,78,120,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    togglePill: {
        width: 48,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#F8F8FC',
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.1)',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    togglePillOn: {
        backgroundColor: '#22c55e',
        borderColor: '#22c55e',
    },
    toggleThumb: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#7A7C90',
    },
    toggleThumbOn: {
        backgroundColor: '#fff',
        alignSelf: 'flex-end',
    },
});
