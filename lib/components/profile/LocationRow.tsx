/**
 * LocationRow — card with: [orange icon box] [label / place name / address]
 * Used for Gym I go to, Home area, Local park.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

interface Props {
  cardTitle: string; // e.g. "Gym I go to"
  name: string;      // e.g. "PowerHouse Gym"
  address: string;   // e.g. "Koramangala, Bengaluru"
  iconComponent?: IconComp;
}

export function LocationRow({ cardTitle, name, address, iconComponent: Icon = MapPin }: Props) {
  return (
    <View style={s.card}>
      <View style={s.iconBox}>
        <Icon size={20} color="#ff7a00" strokeWidth={2.2} />
      </View>
      <View style={s.textBlock}>
        <Text style={s.cardTitle}>{cardTitle}</Text>
        <Text style={s.name} numberOfLines={1}>{name}</Text>
        <Text style={s.address} numberOfLines={1}>{address}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 16,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,122,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  cardTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  name: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  address: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
});
