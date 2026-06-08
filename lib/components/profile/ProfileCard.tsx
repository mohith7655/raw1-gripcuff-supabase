/**
 * ProfileCard — shared card wrapper for all profile section cards.
 * bg: rgba(255,255,255,0.04)  border: rgba(255,255,255,0.06)  radius: 16
 *
 * When `onToggleVisibility` is provided, a small Public/Private toggle is
 * rendered at the bottom so the owner can hide that section from other viewers.
 */
import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle, Text, TouchableOpacity } from 'react-native';
import { Globe, Lock } from 'lucide-react-native';

const MUTED = '#94A3B8';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  /** True when this section is currently private (hidden from others). */
  isPrivate?: boolean;
  /** When provided, renders the Public/Private toggle footer. */
  onToggleVisibility?: () => void;
}

export function ProfileCard({ children, style, padding = 16, isPrivate, onToggleVisibility }: Props) {
  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
      {onToggleVisibility && (
        <View style={styles.visFooter}>
          <Text style={styles.visLabel}>Who can see this</Text>
          <View style={styles.visSeg}>
            <TouchableOpacity
              style={[styles.segOpt, !isPrivate && styles.segOptPublic]}
              onPress={() => { if (isPrivate) onToggleVisibility(); }}
              activeOpacity={0.8}
            >
              <Globe size={11} color={!isPrivate ? '#fff' : MUTED} />
              <Text style={[styles.segText, { color: !isPrivate ? '#fff' : MUTED }]}>Public</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segOpt, isPrivate && styles.segOptPrivate]}
              onPress={() => { if (!isPrivate) onToggleVisibility(); }}
              activeOpacity={0.8}
            >
              <Lock size={11} color={isPrivate ? '#fff' : MUTED} />
              <Text style={[styles.segText, { color: isPrivate ? '#fff' : MUTED }]}>Private</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  visFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  visLabel: { color: MUTED, fontSize: 11, fontWeight: '600' },
  visSeg: {
    flexDirection: 'row',
    gap: 3,
    padding: 3,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  segOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  segOptPublic: { backgroundColor: '#FF6B00' },
  segOptPrivate: { backgroundColor: '#475569' },
  segText: { fontSize: 11, fontWeight: '700' },
});
