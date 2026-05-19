import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PRE_RECORDED_PROGRAMS, ProgramCategoryKey, PreRecordedProgram } from '../data/preRecordedPrograms';
import { SharedVideoPlayer } from '../components/SharedVideoPlayer';

const CATEGORY_KEYS: ProgramCategoryKey[] = Object.keys(PRE_RECORDED_PROGRAMS) as ProgramCategoryKey[];

export default function PreRecordedProgramsScreen() {
    const [category, setCategory] = useState<ProgramCategoryKey>(CATEGORY_KEYS[0]);
    const [expandedProgram, setExpandedProgram] = useState<PreRecordedProgram | null>(null);
    const [playing, setPlaying] = useState<{ title: string; uri: string } | null>(null);

    const programs = useMemo(() => PRE_RECORDED_PROGRAMS[category] ?? [], [category]);

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
                keyExtractor={(p) => p.id}
                contentContainerStyle={styles.list}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.card}
                        onPress={() => setExpandedProgram(item)}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.cardTitle}>{item.title}</Text>
                        <Text style={styles.cardMeta}>{item.coachName} · {item.durationWeeks} wk · {item.level}</Text>
                        <Text numberOfLines={2} style={styles.cardDesc}>{item.description}</Text>
                    </TouchableOpacity>
                )}
            />

            {expandedProgram && (
                <View style={styles.detailPane} key={expandedProgram.id}>
                    <View style={styles.detailHeader}>
                        <Text style={styles.detailTitle}>{expandedProgram.title}</Text>
                        <TouchableOpacity onPress={() => setExpandedProgram(null)} style={styles.closeBtn}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.detailDesc}>{expandedProgram.description}</Text>

                    <FlatList
                        data={expandedProgram.videos}
                        keyExtractor={(v) => v.id}
                        style={styles.videoList}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.videoRow}
                                onPress={() => setPlaying({ title: `${expandedProgram.title} — ${item.title}`, uri: item.videoUrl })}
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
    list: { paddingHorizontal: 12, paddingBottom: 120 },
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
