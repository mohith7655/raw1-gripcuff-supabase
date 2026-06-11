import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoPurpose } from '../models/Video';

const GREEN = '#4CAF50';
const GREEN_SOFT = 'rgba(76,175,80,0.10)';
const GREEN_BORDER = 'rgba(76,175,80,0.25)';

type Props = { purpose?: VideoPurpose };

export function PurposeSection({ purpose }: Props) {
  if (!purpose) return null;

  return (
    <View style={{
      backgroundColor: GREEN_SOFT,
      borderWidth: 1,
      borderColor: GREEN_BORDER,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Ionicons name="shield-checkmark-outline" size={17} color={GREEN} />
        <Text style={{ color: GREEN, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>PURPOSE</Text>
      </View>

      <Text style={{ color: 'rgba(33,24,50,0.85)', fontSize: 13, lineHeight: 20, marginBottom: 10 }}>
        {purpose.summary}
      </Text>

      {purpose.benefits.map((benefit, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 5 }}>
          <View style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: GREEN, marginTop: 7, flexShrink: 0,
          }} />
          <Text style={{ color: 'rgba(33,24,50,0.72)', fontSize: 13, lineHeight: 20, flex: 1 }}>
            {benefit}
          </Text>
        </View>
      ))}
    </View>
  );
}
