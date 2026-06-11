/**
 * LocationRow — card with: [orange icon box] [label / place name / address]
 * Optionally renders a LocationMapPreview below when lat/lng are provided.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { LocationMapPreview } from './LocationMapPreview';

type IconComp = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

interface Props {
  cardTitle: string;
  name: string;
  address: string;
  iconComponent?: IconComp;
  lat?: number | null;
  lng?: number | null;
  onMapTouchStart?: () => void;
  onMapTouchEnd?: () => void;
}

export function LocationRow({
  cardTitle, name, address, iconComponent: Icon = MapPin,
  lat, lng, onMapTouchStart, onMapTouchEnd,
}: Props) {
  const showMap = !!lat && !!lng;

  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={s.iconBox}>
          <Icon size={20} color="#F25912" strokeWidth={2.2} />
        </View>
        <View style={s.textBlock}>
          <Text style={s.cardTitle}>{cardTitle}</Text>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          <Text style={s.address} numberOfLines={1}>{address}</Text>
        </View>
      </View>

      {showMap && (
        <LocationMapPreview
          lat={lat!}
          lng={lng!}
          address={address}
          label=""
          isGym={false}
          onMapTouchStart={onMapTouchStart}
          onMapTouchEnd={onMapTouchEnd}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(33,24,50,0.06)',
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(242,89,18,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242,89,18,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
  },
  cardTitle: {
    color: '#7A7C90',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  name: {
    color: '#211832',
    fontSize: 15,
    fontWeight: '700',
  },
  address: {
    color: '#7A7C90',
    fontSize: 13,
    marginTop: 2,
  },
});
