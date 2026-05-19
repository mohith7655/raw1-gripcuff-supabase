import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAccess } from '../providers/AccessContext';

const ORANGE = '#FF6B00';

interface AccessBadgeProps {
  onPressInactive?: () => void;
}

export const AccessBadge = ({ onPressInactive }: AccessBadgeProps) => {
  const { accessType, showPaywall } = useAccess();
  const handleInactive = onPressInactive ?? showPaywall;

  if (accessType === 'subscription') {
    return (
      <View style={{ backgroundColor: ORANGE, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>⭐ Subscriber</Text>
      </View>
    );
  }

  if (accessType === 'gripcuff') {
    return (
      <View style={{ backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: ORANGE }}>
        <Text style={{ color: ORANGE, fontSize: 11, fontWeight: '600' }}>🔗 GripCuff Activated</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={handleInactive} activeOpacity={0.75}>
      <View style={{ backgroundColor: '#1a1a1a', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: '#666' }}>
        <Text style={{ color: '#888', fontSize: 11 }}>🔒 Not Activated</Text>
      </View>
    </TouchableOpacity>
  );
};
