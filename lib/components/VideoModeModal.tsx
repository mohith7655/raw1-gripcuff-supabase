/**
 * VideoModeModal — bottom-sheet shown before an exercise/workout video starts,
 * letting the user choose how they want to engage:
 *   • Workout — tracks time, counts toward streaks & badges (primary action)
 *   • Watch   — just play the video, no tracking
 *
 * Styled after the familiar "switch mode" bottom sheets (e.g. YouTube Premium).
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Dumbbell, Eye, X } from 'lucide-react-native';

const CANVAS = '#F8F8FC';
const TEXT   = '#211832';
const MUTED  = '#7A7C90';
const ORANGE = '#F25912'; // CTA orange — reserved for the primary action button
const NEUTRAL = '#E6E6EE';

interface Props {
  visible: boolean;
  title?: string;
  onSelect: (mode: 'watch' | 'workout') => void;
  onClose: () => void;
}

export function VideoModeModal({ visible, title, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={s.sheet}>
          <View style={s.handle} />

          <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} color={MUTED} strokeWidth={2.2} />
          </TouchableOpacity>

          {!!title && <Text style={s.eyebrow} numberOfLines={1}>{title}</Text>}
          <Text style={s.title}>How do you want to do this?</Text>
          <Text style={s.desc}>
            Workout mode tracks your time and counts toward your streak, minutes and badges.
            Watch mode just plays the video.
          </Text>

          <View style={s.btnRow}>
            <TouchableOpacity
              style={[s.btn, s.watchBtn]}
              onPress={() => onSelect('watch')}
              activeOpacity={0.85}
            >
              <Eye size={18} color={TEXT} strokeWidth={2.2} />
              <Text style={[s.btnText, { color: TEXT }]}>Just watch</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btn, s.workoutBtn]}
              onPress={() => onSelect('workout')}
              activeOpacity={0.85}
            >
              <Dumbbell size={18} color="#fff" strokeWidth={2.2} />
              <Text style={[s.btnText, { color: '#fff' }]}>Workout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: CANVAS,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 34,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(33,24,50,0.16)',
    marginBottom: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 5,
  },
  eyebrow: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  title: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  desc: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 20,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  watchBtn: {
    backgroundColor: NEUTRAL,
  },
  workoutBtn: {
    backgroundColor: ORANGE,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
