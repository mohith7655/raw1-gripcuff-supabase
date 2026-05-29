import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Lock } from 'lucide-react-native';
import { useAuth } from '../providers/AuthContext';
import { useUser } from '../providers/UserContext';
import {
  BADGE_FAMILIES,
  BadgeFamilyDef,
  TIER_COLORS,
  getTierName,
  tierProgress,
  getNextThreshold,
} from '../services/badge.types';
import {
  BadgeService,
  deriveBadgeStates,
  UserBadgeStats,
} from '../services/badge.service';
import { UserBadgeState } from '../services/badge.types';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:     '#0d1520',
  card:   '#111d2e',
  border: 'rgba(255,255,255,0.07)',
  text:   '#ffffff',
  muted:  '#607a94',
};

const MYTHIC_COLORS = ['#FF6B00', '#8B5CF6', '#3B82F6', '#10B981', '#FF6B00'];

// ── Mythic animated glow ──────────────────────────────────────────────────────
function MythicGlow({ size }: { size: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.9] });
  const scale   = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FF6B00',
        opacity,
        transform: [{ scale }],
      }}
    />
  );
}

// ── Tier progress bar ─────────────────────────────────────────────────────────
function TierBar({ pct, color }: { pct: number; color: string }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: pct, duration: 600, useNativeDriver: false }).start();
  }, [pct]);
  return (
    <View style={s.barBg}>
      <Animated.View
        style={[
          s.barFill,
          { backgroundColor: color, width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
    </View>
  );
}

// ── Tier pip row ──────────────────────────────────────────────────────────────
function TierPips({ currentTier, family }: { currentTier: number; family: BadgeFamilyDef }) {
  return (
    <View style={s.pipsRow}>
      {family.tiers.map(t => {
        const earned = currentTier >= t.tier;
        const color  = earned ? TIER_COLORS[t.tier - 1] : 'rgba(255,255,255,0.1)';
        return (
          <View key={t.tier} style={[s.pip, { backgroundColor: color }]}>
            {t.tier === 5 && earned && (
              <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 4, backgroundColor: '#FF6B00', opacity: 0.4 }]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Badge family card ─────────────────────────────────────────────────────────
function BadgeFamilyCard({
  family,
  state,
  onPress,
}: {
  family: BadgeFamilyDef;
  state: UserBadgeState;
  onPress: () => void;
}) {
  const { currentTier, currentProgress, nextThreshold } = state;
  const hasAny  = currentTier > 0;
  const isMaxed = currentTier === 5;
  const isMythic = currentTier === 5;
  const color   = hasAny ? TIER_COLORS[currentTier - 1] : C.muted;
  const tierName = getTierName(family, currentTier);
  const pct = hasAny
    ? tierProgress(family, currentProgress, currentTier)
    : 0;

  const nextTierName = !isMaxed ? getTierName(family, currentTier + 1) : null;

  return (
    <TouchableOpacity
      style={[s.familyCard, { borderColor: hasAny ? color + '55' : C.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Emoji + glow */}
      <View style={s.emojiWrap}>
        {isMythic && <MythicGlow size={52} />}
        <View style={[s.emojiCircle, { borderColor: color, backgroundColor: color + '22' }]}>
          <Text style={s.familyEmoji}>{family.emoji}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={{ flex: 1, marginLeft: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Text style={s.familyLabel}>{family.label}</Text>
          {hasAny && (
            <View style={[s.tierBadge, { backgroundColor: color + '22', borderColor: color + '66' }]}>
              <Text style={[s.tierBadgeText, { color }]}>{tierName}</Text>
            </View>
          )}
        </View>

        {/* Progress info */}
        {!hasAny ? (
          <Text style={s.lockedText}>
            {family.tiers[0].threshold > 0
              ? `Reach ${family.tiers[0].threshold} ${family.unit} to unlock`
              : 'Admin granted'}
          </Text>
        ) : isMaxed ? (
          <Text style={[s.lockedText, { color }]}>Max tier reached — Mythic 🏅</Text>
        ) : (
          <Text style={s.lockedText}>
            {nextTierName} at {nextThreshold ?? '?'} {family.unit}
            {'  '}
            <Text style={{ color: C.muted }}>({currentProgress} / {nextThreshold})</Text>
          </Text>
        )}

        {/* Progress bar */}
        {hasAny && !isMaxed && (
          <TierBar pct={pct} color={color} />
        )}

        {/* Tier pips */}
        <TierPips currentTier={currentTier} family={family} />
      </View>
    </TouchableOpacity>
  );
}

// ── Detail modal ──────────────────────────────────────────────────────────────
function BadgeDetailModal({
  family,
  state,
  onClose,
}: {
  family: BadgeFamilyDef;
  state: UserBadgeState;
  onClose: () => void;
}) {
  const { currentTier, currentProgress } = state;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalSheet}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 32 }}>{family.emoji}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.modalTitle}>{family.label}</Text>
              <Text style={s.modalSub}>{family.description}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: C.muted, fontSize: 22 }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* All tiers */}
          {family.tiers.map(t => {
            const earned  = currentTier >= t.tier;
            const active  = currentTier === t.tier;
            const color   = earned ? TIER_COLORS[t.tier - 1] : 'rgba(255,255,255,0.1)';
            const isNext  = t.tier === currentTier + 1;
            return (
              <View key={t.tier} style={[s.tierRow, active && { borderColor: color + '88', backgroundColor: color + '11' }]}>
                {/* Pip */}
                <View style={[s.tierPipBig, { backgroundColor: color }]}>
                  {earned ? (
                    <Text style={{ color: '#000', fontSize: 11, fontWeight: '800' }}>{t.tier}</Text>
                  ) : (
                    <Lock size={12} color={C.muted} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.tierRowName, { color: earned ? '#fff' : C.muted }]}>
                    {t.name}
                    {active && <Text style={{ color, fontSize: 10 }}>  ← Current</Text>}
                  </Text>
                  {t.threshold > 0 && (
                    <Text style={s.tierRowThreshold}>
                      {t.threshold} {family.unit}
                      {isNext && currentTier > 0 && (
                        <Text style={{ color }}>{`  (${Math.max(0, t.threshold - currentProgress)} to go)`}</Text>
                      )}
                    </Text>
                  )}
                </View>
                {earned && (
                  <View style={[s.earnedDot, { backgroundColor: color }]} />
                )}
              </View>
            );
          })}

          <TouchableOpacity style={s.modalDismiss} onPress={onClose}>
            <Text style={s.modalDismissText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function BadgesScreen() {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();
  const { profile } = useUser();

  const [states,   setStates]   = useState<UserBadgeState[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selected, setSelected] = useState<{ family: BadgeFamilyDef; state: UserBadgeState } | null>(null);

  const load = useCallback(async () => {
    if (!supabaseUserId) return;
    setLoading(true);
    try {
      // Build stats from profile (what we have locally)
      const stats: UserBadgeStats = {
        bestStreak:        profile?.bestStreak ?? 0,
        totalWorkouts:     profile?.completedWorkouts ?? 0,
        totalLiveSessions: profile?.totalLiveSessions ?? 0,
        totalViewers:      0,
        coachSessions:     0,
        totalWatchMinutes: Math.floor((profile?.watchedSeconds ?? 0) / 60),
        founderTier:       0,
      };

      // Merge local derivation with any DB-persisted data
      const derived = deriveBadgeStates(stats);
      const fromDb  = await BadgeService.fetchUserBadges(supabaseUserId);

      // DB wins on tier (in case of manual grants like founder)
      const merged = derived.map(d => {
        const db = fromDb.find(b => b.familyKey === d.familyKey);
        if (!db) return d;
        // Take whichever tier is higher
        return db.currentTier > d.currentTier ? db : d;
      });

      setStates(merged);

      // Persist derived states back to DB
      await BadgeService.upsertBadges(supabaseUserId, merged);
    } catch {
      setStates(BADGE_FAMILIES.map(f => ({
        familyKey: f.key,
        currentTier: 0,
        currentProgress: 0,
        nextThreshold: f.tiers[0].threshold,
      })));
    } finally {
      setLoading(false);
    }
  }, [supabaseUserId, profile]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ProfileScreen')}
          style={s.iconBtn}
        >
          <ArrowLeft size={22} color={C.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Badges</Text>
        <View style={s.iconBtn} />
      </View>
      <Text style={s.subtitle}>Evolve your badges by training harder</Text>

      {loading ? (
        <ActivityIndicator color="#FF6B00" style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {BADGE_FAMILIES.map(family => {
            const state = states.find(s => s.familyKey === family.key) ?? {
              familyKey: family.key,
              currentTier: 0,
              currentProgress: 0,
              nextThreshold: family.tiers[0].threshold,
            };
            return (
              <BadgeFamilyCard
                key={family.key}
                family={family}
                state={state}
                onPress={() => setSelected({ family, state })}
              />
            );
          })}
        </ScrollView>
      )}

      {selected && (
        <BadgeDetailModal
          family={selected.family}
          state={selected.state}
          onClose={() => setSelected(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  iconBtn:     { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: C.text },
  subtitle:    { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 8, marginBottom: 4 },

  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 12 },

  familyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
  },
  emojiWrap:   { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  emojiCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  familyEmoji: { fontSize: 24 },
  familyLabel: { color: C.text, fontSize: 15, fontWeight: '700' },
  tierBadge:   { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  tierBadgeText: { fontSize: 10, fontWeight: '700' },
  lockedText:  { color: C.muted, fontSize: 11, marginTop: 2, marginBottom: 5 },

  barBg:   { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginTop: 6, marginBottom: 8, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  pipsRow: { flexDirection: 'row', gap: 5 },
  pip:     { width: 18, height: 6, borderRadius: 3 },

  // Detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet:   {
    backgroundColor: C.card,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40,
    borderTopWidth: 1, borderColor: C.border,
  },
  modalTitle:   { color: C.text, fontSize: 18, fontWeight: '800' },
  modalSub:     { color: C.muted, fontSize: 12, marginTop: 2 },

  tierRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 12,
    marginBottom: 6, borderRadius: 12,
    borderWidth: 1, borderColor: 'transparent',
  },
  tierPipBig: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  tierRowName:      { color: C.text, fontSize: 14, fontWeight: '700' },
  tierRowThreshold: { color: C.muted, fontSize: 11, marginTop: 2 },
  earnedDot: { width: 8, height: 8, borderRadius: 4 },

  modalDismiss: {
    marginTop: 20, backgroundColor: '#FF6B00',
    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
  },
  modalDismissText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
