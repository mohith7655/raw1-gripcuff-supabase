/**
 * SquatCountModal — asks "How many squats did you do?" after a move-reminder
 * timer (or any squat set) and reports the number back to the caller.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';

const ORANGE = '#F25912';
const TEXT = '#211832';
const MUTED = '#7A7C90';

interface Props {
  visible: boolean;
  initial?: number;
  saving?: boolean;
  onSubmit: (count: number) => void;
  onSkip: () => void;
}

export function SquatCountModal({ visible, initial = 10, saving = false, onSubmit, onSkip }: Props) {
  const [count, setCount] = useState(initial);

  const bump = (d: number) => setCount(c => Math.max(0, c + d));

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onSkip}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>How many squats did you do?</Text>
          <Text style={s.subtitle}>Nice work — log them to your total.</Text>

          <View style={s.stepperRow}>
            <TouchableOpacity style={s.stepBtn} onPress={() => bump(-1)} activeOpacity={0.8}>
              <Minus color={TEXT} size={22} />
            </TouchableOpacity>
            <View style={s.countWrap}>
              <Text style={s.count}>{count}</Text>
              <Text style={s.countLabel}>squats</Text>
            </View>
            <TouchableOpacity style={s.stepBtn} onPress={() => bump(1)} activeOpacity={0.8}>
              <Plus color={TEXT} size={22} />
            </TouchableOpacity>
          </View>

          <View style={s.quickRow}>
            {[5, 10, 15, 20].map(n => (
              <TouchableOpacity key={n} style={s.quickChip} onPress={() => setCount(n)} activeOpacity={0.8}>
                <Text style={s.quickChipText}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[s.primaryBtn, saving && { opacity: 0.6 }]}
            onPress={() => onSubmit(count)}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Log {count} squats 💪</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.skipBtn} onPress={onSkip} activeOpacity={0.7}>
            <Text style={s.skipBtnText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  card: { width: '100%', backgroundColor: '#F8F8FC', borderRadius: 16, padding: 24 },
  title: { color: TEXT, fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  subtitle: { color: MUTED, fontSize: 14, textAlign: 'center', marginBottom: 20 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22 },
  stepBtn: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEEEF2',
    borderWidth: 1, borderColor: 'rgba(33,24,50,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  countWrap: { alignItems: 'center', minWidth: 90 },
  count: { color: ORANGE, fontSize: 44, fontWeight: '900', lineHeight: 48 },
  countLabel: { color: MUTED, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  quickRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 18 },
  quickChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EEEEF2',
    borderWidth: 1, borderColor: 'rgba(33,24,50,0.1)',
  },
  quickChipText: { color: TEXT, fontSize: 14, fontWeight: '700' },
  primaryBtn: { marginTop: 22, backgroundColor: ORANGE, borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  skipBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  skipBtnText: { color: MUTED, fontSize: 14, fontWeight: '600' },
});

export default SquatCountModal;
