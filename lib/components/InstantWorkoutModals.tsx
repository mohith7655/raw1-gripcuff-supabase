/**
 * InstantWorkoutModals — the two live-countdown surfaces for an INSTANT
 * "workout with a friend" invite (Phase 1):
 *
 *   • InviteWaitingModal   — shown to the SENDER right after they fire an instant
 *                            invite. Counts down 30s while waiting for the friend
 *                            to accept; auto-closes (and cancels) on timeout.
 *   • IncomingInviteModal  — pops on the RECEIVER's screen the moment an instant
 *                            invite lands. Counts down 30s; Accept / Decline, and
 *                            auto-declines if they don't act in time.
 *
 * Both are pure/presentational — all timing + session logic lives in
 * WorkoutSessionContext, which owns the countdown state and renders these.
 */
import React from 'react';
import { Modal, View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Dumbbell, Check, X } from 'lucide-react-native';

const TEXT = '#211832';
const MUTED = '#7A7C90';
const ORANGE = '#F25912';
const GREEN = '#16a34a';
const CARD = '#F8F8FC';

// Circular-ish countdown badge (just the number in a ring — no SVG needed).
function CountRing({ seconds, color }: { seconds: number; color: string }) {
  return (
    <View style={[s.ring, { borderColor: color }]}>
      <Text style={[s.ringNum, { color }]}>{seconds}</Text>
      <Text style={s.ringUnit}>sec</Text>
    </View>
  );
}

function Avatar({ uri, name, size = 64 }: { uri?: string | null; name?: string | null; size?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[s.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[s.avatarLetter, { fontSize: size * 0.4 }]}>{(name || '?').charAt(0).toUpperCase()}</Text>
    </View>
  );
}

// ── Sender: waiting for the friend to accept ────────────────────────────────
export function InviteWaitingModal({
  visible, friendName, friendAvatar, videoTitle, seconds, onCancel,
}: {
  visible: boolean;
  friendName: string;
  friendAvatar?: string | null;
  videoTitle: string;
  seconds: number;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.iconBadge}>
            <Dumbbell size={22} color={ORANGE} />
          </View>
          <Avatar uri={friendAvatar} name={friendName} />
          <ActivityIndicator color={ORANGE} style={{ marginTop: 14 }} />
          <Text style={s.title}>Waiting for {friendName}…</Text>
          <Text style={s.sub} numberOfLines={2}>Instant workout invite sent · {videoTitle}</Text>
          <CountRing seconds={seconds} color={ORANGE} />
          <Text style={s.hint}>They have {seconds}s to accept before it expires.</Text>
          <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.85}>
            <Text style={s.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Receiver: an instant invite just landed ─────────────────────────────────
export function IncomingInviteModal({
  visible, hostName, hostAvatar, videoTitle, seconds, onAccept, onDecline, busy,
}: {
  visible: boolean;
  hostName: string;
  hostAvatar?: string | null;
  videoTitle: string;
  seconds: number;
  onAccept: () => void;
  onDecline: () => void;
  busy?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDecline}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.iconBadge}>
            <Dumbbell size={22} color={ORANGE} />
          </View>
          <Avatar uri={hostAvatar} name={hostName} />
          <Text style={s.title}>{hostName} wants to work out now!</Text>
          <Text style={s.sub} numberOfLines={2}>{videoTitle}</Text>
          <CountRing seconds={seconds} color={seconds <= 10 ? '#dc2626' : ORANGE} />
          <Text style={s.hint}>Auto-declines in {seconds}s</Text>

          {busy ? (
            <ActivityIndicator color={ORANGE} style={{ marginTop: 18 }} />
          ) : (
            <View style={s.actionRow}>
              <TouchableOpacity style={[s.actionBtn, s.declineBtn]} onPress={onDecline} activeOpacity={0.85}>
                <X size={18} color={MUTED} />
                <Text style={[s.actionText, { color: MUTED }]}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.actionBtn, s.acceptBtn]} onPress={onAccept} activeOpacity={0.85}>
                <Check size={18} color="#fff" />
                <Text style={[s.actionText, { color: '#fff' }]}>Accept</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 24,
    alignItems: 'center', paddingTop: 22, paddingBottom: 20, paddingHorizontal: 22,
  },
  iconBadge: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(242,89,18,0.12)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarFallback: { backgroundColor: '#E2E2EC', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { color: '#4C4E78', fontWeight: '800' },
  title: { color: TEXT, fontSize: 18, fontWeight: '800', textAlign: 'center', marginTop: 12 },
  sub: { color: MUTED, fontSize: 13, fontWeight: '500', textAlign: 'center', marginTop: 4 },
  ring: {
    width: 78, height: 78, borderRadius: 39, borderWidth: 4,
    alignItems: 'center', justifyContent: 'center', marginTop: 16,
  },
  ringNum: { fontSize: 28, fontWeight: '800', lineHeight: 30 },
  ringUnit: { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  hint: { color: MUTED, fontSize: 12, fontWeight: '500', marginTop: 10, textAlign: 'center' },

  cancelBtn: {
    marginTop: 16, paddingVertical: 12, paddingHorizontal: 30, borderRadius: 14,
    backgroundColor: CARD, borderWidth: 1, borderColor: '#D8D8E4', alignSelf: 'stretch', alignItems: 'center',
  },
  cancelText: { color: MUTED, fontSize: 15, fontWeight: '700' },

  actionRow: { flexDirection: 'row', gap: 12, marginTop: 18, alignSelf: 'stretch' },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  declineBtn: { backgroundColor: CARD, borderWidth: 1, borderColor: '#D8D8E4' },
  acceptBtn: { backgroundColor: GREEN },
  actionText: { fontSize: 15, fontWeight: '800' },
});
