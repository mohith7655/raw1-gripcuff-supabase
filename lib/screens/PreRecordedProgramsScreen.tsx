import React, { useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRE_RECORDED_PROGRAMS, ProgramCategoryKey, PreRecordedProgram } from '../data/preRecordedPrograms';
import { SharedVideoPlayer } from '../components/SharedVideoPlayer';
import { useAuth } from '../providers/AuthContext';
import { recordUniversalWorkoutCompletion } from '../services/workoutCompletion.service';

const CATEGORY_KEYS: ProgramCategoryKey[] = Object.keys(PRE_RECORDED_PROGRAMS) as ProgramCategoryKey[];

export default function PreRecordedProgramsScreen() {
    const { supabaseUserId } = useAuth();
    const [category, setCategory] = useState<ProgramCategoryKey>(CATEGORY_KEYS[0]);
    const [expandedProgram, setExpandedProgram] = useState<PreRecordedProgram | null>(null);
    const [playing, setPlaying] = useState<{ title: string; uri: string } | null>(null);

    // Per-video completion tracking (prevent double-fire for the same session)
    const completionFiredRef = useRef(false);
    const durationMsRef = useRef(0);
    const maxWatchedMsRef = useRef(0);

    const programs = useMemo(() => PRE_RECORDED_PROGRAMS[category] ?? [], [category]);

    const handleStartVideo = (title: string, uri: string) => {
        // Reset tracking state for the new video
        completionFiredRef.current = false;
        durationMsRef.current = 0;
        maxWatchedMsRef.current = 0;
        setPlaying({ title, uri });
    };

    const handlePositionChange = (posMs: number) => {
        if (posMs > maxWatchedMsRef.current) {
            maxWatchedMsRef.current = posMs;
        }
        // Check 80% completion threshold using highest watched position
        const durMs = durationMsRef.current;
        if (!completionFiredRef.current && durMs > 0 && maxWatchedMsRef.current / durMs >= 0.8) {
            completionFiredRef.current = true;
            fireCompletion();
        }
    };

    const handleDurationChange = (durMs: number) => {
        if (durMs > 0) durationMsRef.current = durMs;
    };

    const handleVideoEnd = () => {
        if (!completionFiredRef.current) {
            completionFiredRef.current = true;
            fireCompletion();
        }
    };

    const fireCompletion = () => {
        const uid = supabaseUserId;
        if (!uid || !playing) return;
        const watchMinutes = Math.max(1, Math.round(maxWatchedMsRef.current / 60000));
        console.log('[PreRecorded] Firing completion for:', playing.title, 'watched:', watchMinutes, 'min');
        recordUniversalWorkoutCompletion(uid, {
            workoutId: playing.uri,
            workoutTitle: playing.title,
            sourceType: 'workout_program',
            watchMinutes,
        })
            .then(r => console.log('[PreRecorded] completion recorded — streak:', r.newStreak))
            .catch(e => console.warn('[PreRecorded] completion failed:', e?.message ?? e));
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.title}>Pre-made Workouts</Text>
            </View>

            <View style={styles.categoriesRow}>
                <FlatList
                    horizontal
                    data={CATEGORY_KEYS}
                    keyExtractor={(c) => c}
                    showsHorizontalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            onPress={() => { setCategory(item); setExpandedProgram(null); }}
                            style={[styles.catBtn, item === category && styles.catBtnActive]}
                        >
                            <Text style={[styles.catBtnText, item === category && styles.catBtnTextActive]}>
                                {item}
                            </Text>
                        </TouchableOpacity>
                    )}
                />
            </View>

            <FlatList
                data={programs}
                style={styles.list}
                keyExtractor={(p) => p.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => setExpandedProgram(prev => prev?.id === item.id ? null : item)}
                    >
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardMeta}>{item.videos.length} videos · {item.focus}</Text>
                        {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
                    </TouchableOpacity>
                )}
            />

            {expandedProgram && (
                <View style={styles.detailPane}>
                    <View style={styles.detailHeader}>
                        <Text style={styles.detailTitle}>{expandedProgram.title}</Text>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setExpandedProgram(null)}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                    {expandedProgram.description ? (
                        <Text style={styles.detailDesc}>{expandedProgram.description}</Text>
                    ) : null}
                    <FlatList
                        data={expandedProgram.videos}
                        keyExtractor={(v) => v.id}
                        style={styles.videoList}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.videoRow}
                                onPress={() => handleStartVideo(`${expandedProgram.title} — ${item.title}`, item.videoUrl)}
                            >
                                <Text style={styles.videoTitle}>{item.title}</Text>
                                <Text style={styles.videoMeta}>{Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            )}

            {playing && (
                <SharedVideoPlayer
                    title={playing.title}
                    videoUri={playing.uri}
                    onBack={() => setPlaying(null)}
                    onCurrentPositionChange={handlePositionChange}
                    onDurationChange={handleDurationChange}
                    onVideoEnd={handleVideoEnd}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
    title: { fontSize: 20, fontWeight: '700' },
    categoriesRow: { paddingVertical: 12 },
    catBtn: { marginHorizontal: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.04)' },
    catBtnActive: { backgroundColor: '#FF6B00' },
    catBtnText: { color: '#111', fontWeight: '600' },
    catBtnTextActive: { color: '#fff' },
    list: { paddingHorizontal: 12, paddingBottom: 120 } as any,
    card: { marginVertical: 8, padding: 12, borderRadius: 12, backgroundColor: '#fff', elevation: 2, boxShadow: '0px 4px 8px rgba(0,0,0,0.06)' as any },
    cardTitle: { fontSize: 16, fontWeight: '700' },
    cardMeta: { fontSize: 12, color: 'rgba(0,0,0,0.6)', marginTop: 6 },
    cardDesc: { fontSize: 13, color: 'rgba(0,0,0,0.7)', marginTop: 8 },
    detailPane: { position: 'absolute', left: 0, right: 0, top: 80, bottom: 0, backgroundColor: '#fff', padding: 16 },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailTitle: { fontSize: 18, fontWeight: '800' },
    closeBtn: { padding: 8 },
    closeText: { color: '#FF6B00', fontWeight: '700' },
    detailDesc: { marginTop: 8, color: 'rgba(0,0,0,0.7)' },
    videoList: { marginTop: 12 },
    videoRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.04)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    videoTitle: { fontSize: 15, fontWeight: '600' },
    videoMeta: { fontSize: 12, color: 'rgba(0,0,0,0.55)' },
});
