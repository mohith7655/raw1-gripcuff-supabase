import React, { useState } from 'react';
import {
    Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, TextInput,
} from 'react-native';
import { Star } from 'lucide-react-native';

const ORANGE = '#F25912';
const ACCENT = '#F25912';
const INDIGO = '#4C4E78';        // brand — used for the CTA + selection highlight
const TEXT = '#211832';          // primary text on the light sheet
const MUTED = 'rgba(33,24,50,0.5)';   // secondary text
const HAIRLINE = 'rgba(33,24,50,0.12)';

export interface PostChallengeAnswers {
    feeling: number;       // 1–5
    friendliness: number;  // 1–5
    reps: number;          // actual rep count
    winner: 'me' | 'opponent';
}

interface Props {
    visible: boolean;
    opponentName: string;
    exerciseName?: string;
    submitting?: boolean;
    onSubmit: (answers: PostChallengeAnswers) => void;
    onSkip: () => void;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <View style={st.starRow}>
            {[1, 2, 3, 4, 5].map((n) => {
                const active = n <= value;
                return (
                    <TouchableOpacity key={n} onPress={() => onChange(n)} activeOpacity={0.7} style={st.starBtn}>
                        <Star
                            size={30}
                            color={active ? ORANGE : 'rgba(33,24,50,0.22)'}
                            fill={active ? ORANGE : 'transparent'}
                        />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export function PostChallengeQuestionnaire({
    visible, opponentName, exerciseName, submitting, onSubmit, onSkip,
}: Props) {
    const [feeling, setFeeling] = useState(0);
    const [friendliness, setFriendliness] = useState(0);
    const [repsText, setRepsText] = useState('');
    const [winner, setWinner] = useState<'me' | 'opponent' | null>(null);

    const reps = parseInt(repsText, 10);
    const repsValid = Number.isFinite(reps) && reps > 0;
    const complete = feeling > 0 && friendliness > 0 && repsValid && winner !== null;

    const handleSubmit = () => {
        if (!complete || submitting) return;
        onSubmit({ feeling, friendliness, reps, winner: winner as 'me' | 'opponent' });
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
            <View style={st.backdrop}>
                <View style={st.sheet}>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                        <Text style={st.kicker}>CHALLENGE COMPLETE</Text>
                        <Text style={st.title}>How did it go?</Text>
                        {exerciseName ? <Text style={st.subtitle}>{exerciseName}</Text> : null}

                        {/* Q1 */}
                        <View style={st.qBlock}>
                            <Text style={st.qLabel}>1. How do you feel?</Text>
                            <StarRating value={feeling} onChange={setFeeling} />
                        </View>

                        {/* Q2 */}
                        <View style={st.qBlock}>
                            <Text style={st.qLabel}>2. Was {opponentName} friendly?</Text>
                            <StarRating value={friendliness} onChange={setFriendliness} />
                        </View>

                        {/* Q3 */}
                        <View style={st.qBlock}>
                            <Text style={st.qLabel}>3. How many reps did you do?</Text>
                            <TextInput
                                style={st.repsInput}
                                value={repsText}
                                onChangeText={(t) => setRepsText(t.replace(/[^0-9]/g, '').slice(0, 4))}
                                keyboardType="number-pad"
                                placeholder="e.g. 20"
                                placeholderTextColor="rgba(33,24,50,0.35)"
                                maxLength={4}
                            />
                        </View>

                        {/* Q4 */}
                        <View style={st.qBlock}>
                            <Text style={st.qLabel}>4. Who won the challenge?</Text>
                            <View style={st.winnerRow}>
                                <TouchableOpacity
                                    style={[st.winnerPill, winner === 'me' && st.winnerPillActive]}
                                    onPress={() => setWinner('me')}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[st.winnerText, winner === 'me' && st.winnerTextActive]}>You</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[st.winnerPill, winner === 'opponent' && st.winnerPillActive]}
                                    onPress={() => setWinner('opponent')}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[st.winnerText, winner === 'opponent' && st.winnerTextActive]} numberOfLines={1}>
                                        {opponentName}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[st.submitBtn, (!complete || submitting) && st.submitBtnDisabled]}
                            onPress={handleSubmit}
                            activeOpacity={0.85}
                            disabled={!complete || submitting}
                        >
                            {submitting
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Text style={st.submitText}>Submit</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={st.skipBtn} onPress={onSkip} activeOpacity={0.7} disabled={submitting}>
                            <Text style={st.skipText}>Skip</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const st = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    sheet: {
        maxHeight: '90%',
        backgroundColor: '#EEEEF2',
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        paddingHorizontal: 24, paddingTop: 22, paddingBottom: 28,
        borderTopWidth: 1, borderTopColor: 'rgba(242,89,18,0.25)',
    },
    kicker: { color: ORANGE, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
    title: { color: TEXT, fontSize: 24, fontWeight: '800', marginTop: 4 },
    subtitle: { color: MUTED, fontSize: 13, marginTop: 2, marginBottom: 4 },

    qBlock: { marginTop: 22 },
    qLabel: { color: TEXT, fontSize: 15, fontWeight: '600', marginBottom: 12 },

    starRow: { flexDirection: 'row', gap: 8 },
    starBtn: { padding: 2 },

    repsInput: {
        backgroundColor: '#fff',
        borderWidth: 1, borderColor: HAIRLINE,
        borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
        color: TEXT, fontSize: 18, fontWeight: '700',
        // web only (ignored on native): keep the focus ring on-brand instead of
        // inheriting the OS accent colour (which renders orange on some systems).
        outlineColor: INDIGO, outlineWidth: 1,
    } as any,

    winnerRow: { flexDirection: 'row', gap: 12 },
    winnerPill: {
        flex: 1, paddingVertical: 14, borderRadius: 14,
        backgroundColor: '#fff',
        borderWidth: 1, borderColor: HAIRLINE,
        alignItems: 'center',
    },
    winnerPillActive: { backgroundColor: 'rgba(76,78,120,0.12)', borderColor: INDIGO },
    winnerText: { color: MUTED, fontSize: 15, fontWeight: '700' },
    winnerTextActive: { color: INDIGO },

    submitBtn: {
        marginTop: 28, backgroundColor: INDIGO, borderRadius: 16,
        paddingVertical: 16, alignItems: 'center',
    },
    submitBtnDisabled: { backgroundColor: 'rgba(76,78,120,0.35)' },
    submitText: { color: '#fff', fontSize: 17, fontWeight: '800' },

    skipBtn: { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
    skipText: { color: MUTED, fontSize: 14, fontWeight: '600' },
});
