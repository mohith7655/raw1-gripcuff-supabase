/**
 * HobbyCircle — 56px orange-outlined circle with icon + label below.
 * Used in the Hobbies card on ProfileScreen.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

interface Props {
  icon: IconComp;
  label: string;
}

export function HobbyCircle({ icon: Icon, label }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.circle}>
        <Icon size={24} color="#F25912" strokeWidth={2} />
      </View>
      <Text style={s.label} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(242,89,18,0.5)',
    backgroundColor: 'rgba(242,89,18,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#7A7C90',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 68,
  },
});
