/**
 * FeatureInfoModal — a single-screen explainer popup shown when a user taps a
 * feature card (e.g. Challenge Lobby, Workout with Friends). Explains what the
 * feature does, then a primary button continues into it.
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { X, ChevronRight } from 'lucide-react-native';

const CANVAS = '#F8F8FC';
const TEXT = '#211832';
const MUTED = '#7A7C90';
const INDIGO = '#4C4E78';
const ORANGE = '#F25912';

interface Props {
  visible: boolean;
  Icon: any;
  title: string;
  body: string;
  bullets?: string[];
  ctaLabel?: string;
  onContinue: () => void;
  onClose: () => void;
}

export function FeatureInfoModal({
  visible,
  Icon,
  title,
  body,
  bullets = [],
  ctaLabel = 'Continue',
  onContinue,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        <View style={s.card}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={20} color={MUTED} strokeWidth={2.2} />
          </TouchableOpacity>

          <View style={s.iconWrap}>
            <Icon size={32} color={INDIGO} strokeWidth={2} />
          </View>

          <Text style={s.title}>{title}</Text>
          <Text style={s.body}>{body}</Text>

          {bullets.length > 0 && (
            <View style={s.bullets}>
              {bullets.map((b, i) => (
                <View key={i} style={s.bulletRow}>
                  <View style={s.bulletDot} />
                  <Text style={s.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity style={s.cta} onPress={onContinue} activeOpacity={0.85}>
            <Text style={s.ctaText}>{ctaLabel}</Text>
            <ChevronRight size={18} color="#fff" strokeWidth={2.4} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: CANVAS,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 5,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(76,78,120,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(76,78,120,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  body: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
  },
  bullets: {
    marginTop: 16,
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: INDIGO,
    marginTop: 6,
  },
  bulletText: {
    flex: 1,
    color: TEXT,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 14,
    backgroundColor: ORANGE,
    marginTop: 22,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
