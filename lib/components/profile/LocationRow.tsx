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
          <Icon size={20} color="#ff7a00" strokeWidth={2.2} />
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
    borderColor: 'rgba(255,255,255,0.06)',
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
