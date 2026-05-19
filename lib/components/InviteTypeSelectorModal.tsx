import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Image,
} from 'react-native';
import { X, PlayCircle } from 'lucide-react-native';

const ACCENT = '#FF6B00';

interface Props {
    visible: boolean;
    videoTitle: string;
    category?: string;
    programName?: string;
    thumbnail?: string;
    onStartNow: () => void;
    onSchedule: () => void;
    onClose: () => void;
}

export function InviteTypeSelectorModal({
    visible,
    videoTitle,
    category,
    programName,
    thumbnail,
    onStartNow,
    onSchedule,
    onClose,
}: Props) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

            <View style={s.sheet}>
                <View style={s.handle} />

                {/* Header */}
                <View style={s.header}>
                    <Text style={s.title}>Workout Together</Text>
                    <TouchableOpacity onPress={onClose} style={s.closeBtn}>
                        <X color="#aaa" size={20} />
                    </TouchableOpacity>
                </View>

                {/* Workout context banner */}
                <View style={s.workoutBanner}>
                    {thumbnail ? (
                        <Image source={{ uri: thumbnail }} style={s.thumb} />
                    ) : (
                        <View style={s.thumbPlaceholder}>
                            <PlayCircle color={ACCENT} size={20} />
                        </View>
                    )}
                    <View style={s.bannerText}>
                        {(category || programName) ? (
                            <Text style={s.bannerMeta} numberOfLines={1}>
                                {[category, programName].filter(Boolean).join(' · ')}
                            </Text>
                        ) : null}
                        <Text style={s.bannerTitle} numberOfLines={2}>{videoTitle}</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                    <TouchableOpacity
                        style={[s.compactBtn, { backgroundColor: 'rgba(249,115,22,0.15)', borderColor: 'rgba(249,115,22,0.4)' }]}
                        onPress={onStartNow}
                        activeOpacity={0.82}
                    >
                        <Text style={s.compactBtnText}>⚡  Start Now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.compactBtn, { backgroundColor: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.4)' }]}
                        onPress={onSchedule}
                        activeOpacity={0.82}
                    >
                        <Text style={s.compactBtnText}>📅  Schedule Later</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const s = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    sheet: {
        backgroundColor: '#0f1923',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    closeBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    workoutBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,107,0,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,107,0,0.2)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 20,
        gap: 12,
    },
    thumb: {
        width: 48,
        height: 48,
        borderRadius: 8,
        flexShrink: 0,
    },
    thumbPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 8,
        backgroundColor: 'rgba(255,107,0,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    bannerText: { flex: 1 },
    bannerMeta: {
        color: 'rgba(255,107,0,0.7)',
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        marginBottom: 2,
    },
    bannerTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    optionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    optionText: { flex: 1 },
    optionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    optionSub: {
        color: '#94A3B8',
        fontSize: 13,
        lineHeight: 18,
    },
    arrowDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: ACCENT,
        flexShrink: 0,
    },
    compactBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    compactBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
});
