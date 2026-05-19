import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Timer } from 'lucide-react-native';
import { getDoc, setDoc, doc } from 'firebase/firestore';
import { db } from '../../core/config/firebase';
import { getProgramByVideoId, ProgramExercise } from '../../data/preRecordedPrograms';
import { ExerciseTimerSheet } from '../ExerciseTimerSheet';
import { TimerConfig } from '../../hooks/useWorkoutTimer';

type Props = {
    videoId: string;
    programId?: string;
    /** When provided, these exercises are rendered directly (same as Requirements tab). */
    exercises?: ProgramExercise[];
};

function repLabel(ex: ProgramExercise): string {
    if (ex.sets && ex.reps)     return `${ex.sets} × ${ex.reps} reps`;
    if (ex.sets && ex.duration) return `${ex.sets} × ${ex.duration}`;
    if (ex.reps)                return `${ex.reps} reps`;
    return ex.duration ?? '';
}

export function ExerciseListTab({ videoId, programId, exercises: propExercises }: Props) {
    const [exercises, setExercises] = useState<ProgramExercise[]>(propExercises ?? []);
    const [loading, setLoading]     = useState(!propExercises);

    // Per-exercise timer configs, keyed by index
    const [timerConfigs, setTimerConfigs] = useState<Record<number, TimerConfig>>({});
    // Which exercise sheet is open
    const [sheetIdx, setSheetIdx] = useState<number | null>(null);

    const resolvedProgramId = programId ?? String(videoId ?? '').replace(/_d\d+$/, '');

    useEffect(() => {
        if (propExercises) {
            setExercises(propExercises);
            setLoading(false);
            return;
        }

        let cancelled = false;

        const fetchOrGenerate = async () => {
            try {
                const ref  = doc(db, 'programs', resolvedProgramId, 'days', videoId);
                const snap = await getDoc(ref);
                const data = snap.data();

                if (!cancelled && data?.exercises?.length > 0) {
                    const fromFirestore: ProgramExercise[] = (data.exercises as string[]).map(name => ({
                        name,
                        muscleGroup: '',
                    }));
                    setExercises(fromFirestore);
                    return;
                }

                const program = getProgramByVideoId(videoId);
                const local   = program?.exercises ?? [];
                if (local.length > 0) {
                    setDoc(ref, { exercises: local.map(e => e.name) }, { merge: true }).catch(() => {});
                }
                if (!cancelled) setExercises(local);
            } catch {
                if (!cancelled) setExercises(getProgramByVideoId(videoId)?.exercises ?? []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchOrGenerate();
        return () => { cancelled = true; };
    }, [videoId, resolvedProgramId, propExercises]);

    const saveConfig = (idx: number, config: TimerConfig) => {
        setTimerConfigs(prev => ({ ...prev, [idx]: config }));
    };

    if (loading) {
        return <ActivityIndicator color="#F97316" style={{ marginTop: 24 }} />;
    }

    return (
        <>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {exercises.length === 0 ? (
                    <Text style={styles.empty}>No exercises listed for this workout</Text>
                ) : (
                    exercises.map((ex, i) => {
                        const label = repLabel(ex);
                        const hasTimer = !!timerConfigs[i];
                        return (
                            <View
                                key={i}
                                style={[styles.row, i < exercises.length - 1 && styles.rowBorder]}
                            >
                                <View style={styles.dot} />
                                <View style={styles.info}>
                                    <Text style={styles.name}>{ex.name}</Text>
                                    {hasTimer && (
                                        <Text style={styles.timerBadge}>
                                            {timerConfigs[i].mode === 'rest' ? '💤' : '⏱'}{' '}
                                            {Math.floor(timerConfigs[i].durationSeconds / 60)}:
                                            {String(timerConfigs[i].durationSeconds % 60).padStart(2, '0')}
                                        </Text>
                                    )}
                                </View>
                                {!!label && <Text style={styles.reps}>{label}</Text>}
                                <TouchableOpacity
                                    style={[styles.timerBtn, hasTimer && styles.timerBtnActive]}
                                    onPress={() => setSheetIdx(i)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Timer
                                        size={16}
                                        color={hasTimer ? '#F97316' : '#4B5563'}
                                    />
                                </TouchableOpacity>
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {sheetIdx !== null && (
                <ExerciseTimerSheet
                    visible={sheetIdx !== null}
                    exerciseName={exercises[sheetIdx]?.name ?? ''}
                    initialConfig={timerConfigs[sheetIdx]}
                    onSave={config => saveConfig(sheetIdx, config)}
                    onClose={() => setSheetIdx(null)}
                />
            )}
        </>
    );
}

const styles = StyleSheet.create({
    scroll: { flex: 1 },
    content: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },
    empty: {
        color: '#9CA3AF',
        textAlign: 'center',
        marginTop: 24,
        fontSize: 14,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#F97316',
        flexShrink: 0,
    },
    info: { flex: 1 },
    name: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    timerBadge: {
        color: '#F97316',
        fontSize: 11,
        marginTop: 2,
    },
    reps: {
        color: '#F97316',
        fontSize: 12,
        fontWeight: '600',
        flexShrink: 0,
    },
    timerBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        flexShrink: 0,
    },
    timerBtnActive: {
        backgroundColor: 'rgba(249,115,22,0.12)',
        borderColor: '#F97316',
    },
});
