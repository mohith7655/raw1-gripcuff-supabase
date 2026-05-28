/**
 * BadgesScreen — shows earned + locked badges for the logged-in user.
 * Tapping "View all" in the Badges card in ProfileScreen navigates here.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, Lock, Trophy } from 'lucide-react-native';
import { useAuth } from '../providers/AuthContext';
import { supabase } from '../core/config/supabase';
import { ALL_BADGES, Badge } from '../services/rewards.service';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:           '#0d1520',
  bgCard:       'rgba(255,255,255,0.04)',
  border:       'rgba(255,255,255,0.06)',
  orange:       '#ff7a00',
  accentSoft:   'rgba(255,122,0,0.12)',
  accentBorder: 'rgba(255,122,0,0.28)',
  purple:       '#8b5cf6',
  purpleSoft:   'rgba(139,92,246,0.12)',
  purpleBorder: 'rgba(139,92,246,0.35)',
  text:         '#ffffff',
  muted:        '#9ca3af',
};

type DisplayBadge = Badge & { earned: boolean; earnedAt?: string };

// ── Badge card ─────────────────────────────────────────────────────────────────
function BadgeCard({ item }: { item: DisplayBadge }) {
  return (
    <View style={[
      s.card,
      item.earned ? (parseInt(item.id) % 2 === 0 ? s.cardOrange : s.cardPurple) : s.cardLocked,
    ]}>
      {item.earned ? (
        <Text style={s.badgeEmoji}>{item.emoji}</Text>
      ) : (
        <View style={s.lockBox}>
          <Lock size={22} color={C.muted} strokeWidth={2} />
        </View>
      )}
      <Text
        style={[s.badgeName, !item.earned && s.badgeNameLocked]}
        numberOfLines={2}
      >
        {item.label}
      </Text>
      <Text style={s.badgeDesc} numberOfLines={2}>{item.description}</Text>
      {item.earned && item.earnedAt ? (
        <Text style={s.badgeDate}>
          {new Date(item.earnedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </Text>
      ) : !item.earned ? (
        <Text style={s.lockedLabel}>Locked</Text>
      ) : null}
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export function BadgesScreen() {
  const navigation = useNavigation<any>();
  const { supabaseUserId } = useAuth();

  const [badges,  setBadges]  = useState<DisplayBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supabaseUserId) return;
    setLoading(true);
    try {
      // Try fetching from user_badges — gracefully handle missing table
      const { data: userBadgeRows } = await supabase
        .from('user_badges')
        .select('badge_id, earned_at')
        .eq('user_id', supabaseUserId)
        .maybeSingle()
        .then(() => supabase
          .from('user_badges')
          .select('badge_id, earned_at')
          .eq('user_id', supabaseUserId)
        );

      const earnedMap = new Map<string, string>();
      (userBadgeRows ?? []).forEach((row: any) => {
        earnedMap.set(row.badge_id, row.earned_at);
      });

      // Merge ALL_BADGES with earned status — earned first, then locked
      const earned: DisplayBadge[] = [];
      const locked: DisplayBadge[] = [];

      for (const b of ALL_BADGES) {
        if (earnedMap.has(b.id)) {
          earned.push({ ...b, earned: true, earnedAt: earnedMap.get(b.id) });
        } else {
          locked.push({ ...b, earned: false });
        }
      }

      setBadges([...earned, ...locked]);
    } catch {
      // Fallback: show all badges as locked
      setBadges(ALL_BADGES.map(b => ({ ...b, earned: false })));
    } finally {
      setLoading(false);
    }
  }, [supabaseUserId]);

  useEffect(() => { load(); }, [load]);

  // ── Empty state ──────────────────────────────────────────────────────────
  const EmptyState = () => (
    <View style={s.empty}>
      <View style={s.emptyIconBox}>
        <Trophy size={40} color={C.orange} strokeWidth={1.8} />
      </View>
      <Text style={s.emptyTitle}>No badges yet</Text>
      <Text style={s.emptyDesc}>
        Complete workouts and challenges to earn badges.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('ProfileScreen'))} style={s.iconBtn}>
          <ArrowLeft size={22} color={C.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Badges</Text>
        <View style={s.iconBtn} />
      </View>

      {/* Subtitle */}
      <Text style={s.subtitle}>Earned badges and achievements</Text>

      {/* ── CONTENT ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <ActivityIndicator color={C.orange} style={s.loader} />
      ) : badges.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={badges}
          keyExtractor={item => item.id}
          numColumns={2}
          renderItem={({ item }) => <BadgeCard item={item} />}
          columnWrapperStyle={s.columnWrapper}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '700', color: C.text,
  },

  subtitle: {
    color: C.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },

  loader: { marginTop: 60 },

  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 12,
  },
  columnWrapper: { gap: 12 },

  // Badge card — 2 columns
  card: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: C.bgCard,
    borderWidth: 1.5,
    borderColor: C.border,
    gap: 6,
  },
  cardOrange: {
    backgroundColor: C.accentSoft,
    borderColor: C.accentBorder,
  },
  cardPurple: {
    backgroundColor: C.purpleSoft,
    borderColor: C.purpleBorder,
  },
  cardLocked: {
    opacity: 0.5,
  },

  badgeEmoji: { fontSize: 36, marginBottom: 4 },
  lockBox: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  badgeName: {
    color: C.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  badgeNameLocked: { color: C.muted },
  badgeDesc: {
    color: C.muted,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },
  badgeDate: {
    color: C.orange,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  lockedLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },

  // Empty
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.accentSoft,
    borderWidth: 1, borderColor: C.accentBorder,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { color: C.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  emptyDesc: {
    color: C.muted, fontSize: 14, textAlign: 'center',
    lineHeight: 20, marginTop: 10,
  },
});
