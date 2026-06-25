/**
 * ProfilePreviewSheet — compact "short profile" bottom sheet shown when tapping a
 * connection. Surfaces, at a glance:
 *   • avatar with tier ring + numbered tier badge  (level)
 *   • gender icon
 *   • how active they are on the app (last_active_at)
 *   • social (high-five) + workout (dumbbell) heat — hot ↔ cold
 * with a "View full profile" action into the full SocialProfileScreen.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { ChevronRight, MessageCircle } from 'lucide-react-native';
import { TierAvatar } from '../profile/TierAvatar';
import { HeatPills } from './HeatPills';
import { supabase } from '../../core/config/supabase';
import { loadActivityMap } from '../../services/activityMap.service';
import { computeHeats, genderMeta, lastActiveLabel, appActiveLabel, ActivityHeats } from '../../utils/activityHeat';

const TEXT = '#211832';
const MUTED = '#7A7C90';
const CARD = '#F8F8FC';
const BORDER = 'rgba(33,24,50,0.10)';
const ACCENT = '#4C4E78';

export interface PreviewUser {
  uid: string;
  fullName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
}

export function ProfilePreviewSheet({
  user, visible, onClose, onViewProfile, onMessage,
}: {
  user: PreviewUser | null;
  visible: boolean;
  onClose: () => void;
  onViewProfile: (uid: string) => void;
  onMessage?: (u: PreviewUser) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [heats, setHeats] = useState<ActivityHeats | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !user?.uid) return;
    let alive = true;
    setLoading(true);
    setHeats(null);
    setGender(user.gender ?? null);
    setLastActiveAt(null);

    Promise.all([
      loadActivityMap(user.uid).catch(() => null),
      supabase.from('users').select('gender, last_active_at').eq('id', user.uid).maybeSingle(),
    ])
      .then(([map, { data } = { data: null } as any]) => {
        if (!alive) return;
        if (map) setHeats(computeHeats(map));
        if (data?.gender) setGender(data.gender);
        setLastActiveAt(data?.last_active_at ?? null);
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
  }, [visible, user?.uid]);

  if (!user) return null;

  const gm = genderMeta(gender);
  const active = appActiveLabel(lastActiveAt);
  const name = user.fullName || user.username || 'Athlete';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />

          {/* Identity */}
          <View style={s.identity}>
            <TierAvatar uri={user.avatarUrl} size={72} uid={user.uid} name={name} showBadge />
            <View style={s.idText}>
              <View style={s.nameRow}>
                <Text style={s.name} numberOfLines={1}>{name}</Text>
                {gm && (
                  <View style={[s.genderPill, { backgroundColor: gm.bg, borderColor: gm.border }]}>
                    <Text style={[s.genderIcon, { color: gm.color }]}>{gm.icon}</Text>
                  </View>
                )}
              </View>
              {!!user.username && <Text style={s.handleText} numberOfLines={1}>@{user.username}</Text>}
              <View style={s.activityRow}>
                <View style={[s.dot, { backgroundColor: active.color }]} />
                <Text style={[s.activityText, { color: active.color }]}>{active.text}</Text>
              </View>
            </View>
          </View>

          {/* Heat */}
          <Text style={s.sectionLabel}>Recent activity</Text>
          {loading ? (
            <View style={s.loader}><ActivityIndicator color={ACCENT} /></View>
          ) : heats ? (
            <HeatPills social={heats.social} workout={heats.workout} />
          ) : (
            <Text style={s.muted}>No recent activity</Text>
          )}
          {heats && (
            <Text style={s.subtle}>{lastActiveLabel(heats.lastActiveDay)}</Text>
          )}

          {/* Actions */}
          <View style={s.actions}>
            {onMessage && (
              <TouchableOpacity style={s.msgBtn} onPress={() => onMessage(user)} activeOpacity={0.85}>
                <MessageCircle size={16} color={ACCENT} />
                <Text style={s.msgBtnText}>Message</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.viewBtn}
              onPress={() => onViewProfile(user.uid)}
              activeOpacity={0.85}
            >
              <Text style={s.viewBtnText}>View full profile</Text>
              <ChevronRight size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D8D8E4', marginBottom: 16 },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  idText: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: TEXT, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  genderPill: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  genderIcon: { fontSize: 14, fontWeight: '900', lineHeight: 16 },
  handleText: { color: MUTED, fontSize: 13, fontWeight: '600', marginTop: 2 },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  activityText: { fontSize: 12, fontWeight: '700' },

  sectionLabel: {
    color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 0.5,
    textTransform: 'uppercase', marginTop: 20, marginBottom: 10,
  },
  loader: { paddingVertical: 8, alignItems: 'flex-start' },
  muted: { color: MUTED, fontSize: 13 },
  subtle: { color: MUTED, fontSize: 12, marginTop: 8 },

  actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  msgBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 16, height: 48, borderRadius: 14,
    backgroundColor: CARD, borderWidth: 1, borderColor: BORDER,
  },
  msgBtnText: { color: ACCENT, fontSize: 14, fontWeight: '700' },
  viewBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    height: 48, borderRadius: 14, backgroundColor: ACCENT,
  },
  viewBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
