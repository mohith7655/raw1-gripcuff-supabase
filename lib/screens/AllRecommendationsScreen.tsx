import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Play, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUser } from '../providers/UserContext';
import { useLibrary } from '../providers/LibraryContext';
import { useBodyInsights } from '../hooks/useBodyInsights';
import { ThumbnailCategory } from '../components/VideoCardBits';
import BodyVisualizer from '../components/profile/BodyVisualizer';
import { BodyCondition, BodyConditionType, GoalType } from '../models/User';
import { Raw1Logo } from '../raw1_logo';

// Muted earthy / slate thumbnail gradients — matches the library cards.
const GRADIENTS: [string, string][] = [
    ['#8B7355', '#6B5B45'],
    ['#7A8A8A', '#5A6A6A'],
    ['#4A5568', '#2D3748'],
    ['#6B4226', '#4A2E1A'],
    ['#2A2A3E', '#1A1A2E'],
    ['#0D2137', '#1A3A5C'],
    ['#C4B8A8', '#A09488'],
    ['#3B1F0B', '#5C3319'],
];

// AI reco category → EXERCISE_DATA category (opens exercise videos, not programs).
const RECO_CAT: Record<string, { key: string; label: string }> = {
    muscle_growth: { key: 'MuscleGrowth', label: 'Muscle Growth' },
    stretching: { key: 'Stretching', label: 'Stretching' },
    injury_rehab: { key: 'InjuryRehab', label: 'Injury Rehab' },
    athletic: { key: 'AthleticPerformance', label: 'Athletic Performance' },
};

const DIFFS = ['Beginner', 'Intermediate', 'Advanced'] as const;

// ── Body-condition → readable label + the category to recommend from ──────────
const TYPE_LABEL: Record<BodyConditionType, string> = {
    tightness: 'Tightness', pain: 'Pain', injury: 'Injury',
};
// Tightness → stretching work; pain / injury → rehab work.
const TYPE_CAT: Record<BodyConditionType, { key: string; label: string }> = {
    tightness: { key: 'Stretching', label: 'Stretching' },
    pain: { key: 'InjuryRehab', label: 'Injury Rehab' },
    injury: { key: 'InjuryRehab', label: 'Injury Rehab' },
};
const PART_LABEL: Record<string, string> = {
    neck: 'Neck', shoulders: 'Shoulders', chest: 'Chest', elbow: 'Elbow', abs: 'Abs',
    hip: 'Hip', wrist: 'Wrist', quads: 'Quads', knee: 'Knee', calves: 'Calves',
    ankle: 'Ankle', upper_back: 'Upper Back', lower_back: 'Lower Back', glutes: 'Glutes',
};
// Keywords used to match a body part against video titles.
const PART_KEYWORDS: Record<string, string[]> = {
    neck: ['neck'],
    shoulders: ['shoulder', 'scapular', 'rotator'],
    chest: ['chest', 'pec', 'bench'],
    elbow: ['elbow', 'tricep', 'curl'],
    abs: ['ab', 'core', 'plank', 'dead bug', 'stabil'],
    hip: ['hip', 'glute', 'clamshell', 'bridge', 'hinge'],
    wrist: ['wrist', 'grip', 'forearm'],
    quads: ['quad', 'squat', 'leg', 'lunge'],
    knee: ['knee', 'squat', 'tracking'],
    calves: ['calf', 'calve', 'ankle'],
    ankle: ['ankle', 'balance', 'calf'],
    upper_back: ['back', 'row', 'scapular', 'posture'],
    lower_back: ['back', 'spine', 'hinge', 'bird dog', 'hip'],
    glutes: ['glute', 'bridge', 'hip', 'clamshell'],
};
const sideText = (s?: string) => (s === 'left' ? 'Left ' : s === 'right' ? 'Right ' : '');
const partLabel = (c: BodyCondition) => `${sideText(c.side)}${PART_LABEL[c.part] ?? c.part}`;

// ── Body-goal → readable label + the workout category to recommend from ───────
// Weight loss is categorized into General Health (balance / posture / everyday
// wellness), since it isn't a body-part-specific goal.
const GOAL_LABEL: Record<GoalType, string> = {
    muscle_growth: 'Muscle Growth', weight_loss: 'Weight Loss', injury_rehab: 'Injury Rehab', stretching: 'Stretching',
};
const GOAL_CAT: Record<GoalType, { key: string; label: string }> = {
    muscle_growth: { key: 'MuscleGrowth', label: 'Muscle Growth' },
    weight_loss: { key: 'GeneralHealth', label: 'General Health' },
    injury_rehab: { key: 'InjuryRehab', label: 'Injury Rehab' },
    stretching: { key: 'Stretching', label: 'Stretching' },
};

type Item = {
    id: string;
    title: string;
    category?: string;
    difficulty?: string;
    onPress: () => void;
};

export function AllRecommendationsScreen() {
    const navigation = useNavigation<any>();
    const { profile } = useUser();
    const { allVideos, gripCuffVideos, trainerVideos, bodyPartVideos } = useLibrary();

    const { insights } = useBodyInsights({
        gender: profile?.gender,
        age: profile?.age,
        heightCm: profile?.heightCm,
        weightKg: profile?.weightKg,
        conditions: profile?.bodyConditions,
        goals: profile?.goals,
    });
    const aiRecos = insights?.recommendations ?? [];
    const firstName = (profile?.fullName ?? '').trim().split(/\s+/)[0] || 'Your';

    const openReco = (category: string) => {
        if (category === 'gripcuff') { navigation.navigate('GripCuffVideos'); return; }
        const c = RECO_CAT[category] ?? RECO_CAT.muscle_growth;
        navigation.navigate('CategoryVideos', { categoryKey: c.key, categoryLabel: c.label });
    };

    const allVids = [...allVideos, ...gripCuffVideos, ...trainerVideos, ...bodyPartVideos];

    const recoItem = (r: { title: string; category: string }, i: number): Item => ({
        id: `reco-${r.category}-${i}`,
        title: r.title,
        category: RECO_CAT[r.category]?.key,
        difficulty: DIFFS[i % DIFFS.length],
        onPress: () => openReco(r.category),
    });
    const videoItem = (v: any): Item => ({
        id: `vid-${v.id}`,
        title: v.title,
        category: v.category,
        difficulty: v.difficulty,
        onPress: () => navigation.navigate('VideoPlayer', { videoId: v.id, title: v.title, videoUrl: v.videoUrl }),
    });

    // ── Build the grouped sections ────────────────────────────────────────────
    // Each body condition (injury / tightness / pain) becomes its own section
    // titled e.g. "Recommended for Chest Tightness", pulling the AI picks + real
    // library videos that match that body part. A running `shown` set dedupes a
    // video across sections; leftover AI picks and category videos fall into
    // trailing "Picked by AI" / "More to explore" sections.
    const shown = new Set<string>();
    const pushUnique = (arr: Item[], it: Item) => {
        const t = it.title.toLowerCase();
        if (!shown.has(t)) { shown.add(t); arr.push(it); }
    };

    const sections: { title: string; items: Item[] }[] = [];
    const conditions = profile?.bodyConditions ?? [];

    for (const c of conditions) {
        const cat = TYPE_CAT[c.type];
        const keywords = PART_KEYWORDS[c.part] ?? [c.part];
        const items: Item[] = [];

        // AI picks in the matching category that mention the body part.
        aiRecos.forEach((r, i) => {
            if (RECO_CAT[r.category]?.key === cat.key && keywords.some(k => r.title.toLowerCase().includes(k))) {
                pushUnique(items, recoItem(r as any, i));
            }
        });
        // Library videos in the category — prefer titles matching the body part,
        // else fall back to the first few in that category.
        const libInCat = allVids.filter(v => (v as any).category === cat.key);
        const matched = libInCat.filter(v => keywords.some(k => ((v as any).title ?? '').toLowerCase().includes(k)));
        (matched.length ? matched : libInCat.slice(0, 4)).forEach(v => pushUnique(items, videoItem(v)));

        if (items.length) {
            sections.push({ title: `Recommended for ${partLabel(c)} ${TYPE_LABEL[c.type]}`, items });
        }
    }

    // Goal-driven sections — e.g. a Weight Loss goal recommends General Health
    // videos. De-duped against condition sections via the shared `shown` set.
    const goals = profile?.goals ?? [];
    for (const g of goals) {
        const cat = GOAL_CAT[g.type];
        if (!cat) continue;
        const items: Item[] = [];
        allVids
            .filter(v => (v as any).category === cat.key)
            .forEach(v => pushUnique(items, videoItem(v)));
        if (items.length) {
            sections.push({ title: `Recommended for ${GOAL_LABEL[g.type]}`, items });
        }
    }

    // Remaining AI picks that weren't tied to a condition.
    const restReco: Item[] = [];
    aiRecos.forEach((r, i) => {
        if (!shown.has(r.title.toLowerCase())) pushUnique(restReco, recoItem(r as any, i));
    });
    if (restReco.length) {
        sections.push({ title: sections.length ? 'Picked by AI for you' : `${firstName}'s Recommended`, items: restReco });
    }

    // More real videos from the recommended categories, so the list runs deep.
    const recCatKeys = new Set(aiRecos.map(r => RECO_CAT[r.category]?.key).filter(Boolean) as string[]);
    const moreItems: Item[] = [];
    allVids
        .filter(v => recCatKeys.size === 0 || ((v as any).category && recCatKeys.has((v as any).category)))
        .forEach(v => { if (!shown.has(((v as any).title ?? '').toLowerCase())) pushUnique(moreItems, videoItem(v)); });
    if (moreItems.length) sections.push({ title: 'More to explore', items: moreItems });

    const renderCard = (it: Item, idx: number) => {
        const colors = GRADIENTS[idx % GRADIENTS.length];
        return (
            <TouchableOpacity key={it.id} style={s.card} activeOpacity={0.85} onPress={it.onPress}>
                <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.thumb}>
                    <View style={s.logoWrap}><Raw1Logo fontSize={12} transparent /></View>
                    <Play color="rgba(255,255,255,0.12)" size={30} fill="rgba(255,255,255,0.12)" />
                </LinearGradient>
                <View style={s.info}>
                    <Text numberOfLines={2} style={s.cardTitle}>{it.title}</Text>
                    <ThumbnailCategory category={it.category} difficulty={it.difficulty} />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <ChevronLeft color="#211832" size={24} />
                </TouchableOpacity>
                <View style={s.titleRow}>
                    <View style={s.iconBadge}>
                        <Sparkles size={14} color="#F25912" />
                    </View>
                    <Text style={s.title}>{firstName}'s Recommended</Text>
                </View>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* 3D body model — read-only preview, seeded from the saved body
                    profile. Edit / tap opens the full-screen "How I look now" editor. */}
                <View style={s.modelCard}>
                    <View style={s.modelHeader}>
                        <Text style={s.modelTitle}>How I look now</Text>
                        <TouchableOpacity onPress={() => navigation.navigate('HowILookNow')} activeOpacity={0.75} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={s.editBtn}>Edit</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('HowILookNow')}>
                        <BodyVisualizer
                            name={firstName}
                            gender={profile?.gender}
                            heightCm={profile?.heightCm}
                            weightKg={profile?.weightKg}
                            age={profile?.age}
                            conditions={profile?.bodyConditions}
                            editable={false}
                            canvasHeight={300}
                        />
                    </TouchableOpacity>
                </View>

                <Text style={s.subtitle}>Picked by AI from your goals, injuries &amp; body</Text>

                {sections.map(sec => (
                    <View key={sec.title} style={{ marginBottom: 4 }}>
                        <Text style={s.sectionTitle}>{sec.title}</Text>
                        <View style={s.grid}>
                            {sec.items.map((it, idx) => renderCard(it, idx))}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: 'transparent' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(33,24,50,0.06)',
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBadge: {
        width: 26, height: 26, borderRadius: 7,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#000000',
    },
    title: { color: '#211832', fontSize: 17, fontWeight: '700' },
    modelCard: {
        margin: 12,
        padding: 12,
        borderRadius: 16,
        backgroundColor: '#F8F8FC',
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.08)',
    },
    modelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    modelTitle: { color: '#211832', fontSize: 15, fontWeight: '700' },
    editBtn: { color: '#F25912', fontSize: 13, fontWeight: '600' },
    subtitle: { color: '#7A7C90', fontSize: 12.5, fontWeight: '500', paddingHorizontal: 16, marginBottom: 4 },
    sectionTitle: { color: '#211832', fontSize: 15, fontWeight: '700', paddingHorizontal: 16, marginTop: 14, marginBottom: 4 },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        gap: 12,
    },
    card: {
        width: '47%',
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(33,24,50,0.05)',
    },
    thumb: {
        width: '100%',
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoWrap: { position: 'absolute', top: 6, left: 6 },
    info: { padding: 10 },
    cardTitle: { color: '#211832', fontSize: 12, fontWeight: '600', lineHeight: 16 },
});
