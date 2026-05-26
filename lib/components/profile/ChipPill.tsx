/**
 * ChipPill — solid-fill pill for "Looking to meet" section.
 * tone='orange' → #ff7a00 background
 * tone='green'  → #22c55e background
 * Text and icon are always black for contrast.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

export type ChipTone = 'orange' | 'green';

interface Props {
  icon: IconComp;
  label: string;
  tone: ChipTone;
}

export function ChipPill({ icon: Icon, label, tone }: Props) {
  const bg = tone === 'orange' ? '#ff7a00' : '#22c55e';
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <Icon size={16} color="#000" strokeWidth={2.3} />
      <Text style={s.text}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 100,
  },
  text: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});
