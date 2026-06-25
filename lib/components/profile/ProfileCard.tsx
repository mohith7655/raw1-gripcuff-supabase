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

const MUTED = '#7A7C90';

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
              style={[styles.segOpt, !isPrivate && styles.segOptActive]}
              onPress={() => { if (isPrivate) onToggleVisibility(); }}
              activeOpacity={0.8}
            >
              <Globe size={12} color={!isPrivate ? '#fff' : MUTED} />
              {!isPrivate && <Text style={styles.segTextActive}>Public</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segOpt, isPrivate && styles.segOptActive]}
              onPress={() => { if (!isPrivate) onToggleVisibility(); }}
              activeOpacity={0.8}
            >
              <Lock size={12} color={isPrivate ? '#fff' : MUTED} />
              {isPrivate && <Text style={styles.segTextActive}>Private</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F8F8FC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.06)',
  },
  visFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(33,24,50,0.06)',
  },
  visLabel: { color: MUTED, fontSize: 11, fontWeight: '600' },
  // Matches the Library Exercises/Workouts capsule toggle: light track,
  // dark active segment. Inactive side collapses to its icon only.
  visSeg: {
    flexDirection: 'row',
    gap: 2,
    padding: 2,
    borderRadius: 100,
    backgroundColor: '#EEEEF2',
    borderWidth: 1,
    borderColor: '#D8D8E4',
  },
  segOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 100,
  },
  segOptActive: { backgroundColor: '#211832' },
  segTextActive: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
