import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAccess } from '../providers/AccessContext';

const ORANGE = '#FF6B00';
const GREEN  = '#22C55E';

interface AccessBadgeProps {
  onPressInactive?: () => void;
}

export const AccessBadge = ({ onPressInactive }: AccessBadgeProps) => {
  const { accessType, hasAccess, loading, showPaywall } = useAccess();
  const handleInactive = onPressInactive ?? showPaywall;

  // Don't render anything while access is still being determined —
  // prevents a "Not Activated" flash for paid users on cold boot.
  if (loading) return null;

  if (hasAccess && accessType === 'subscription') {
    return (
      <View style={{ backgroundColor: GREEN, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>⭐ Subscribed ✓</Text>
      </View>
    );
  }

  if (hasAccess && accessType === 'gripcuff') {
    return (
      <View style={{ backgroundColor: GREEN, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>🔧 Gripcuff Active ✓</Text>
      </View>
    );
  }

  // No access — tappable badge that opens paywall
  return (
    <TouchableOpacity onPress={handleInactive} activeOpacity={0.75}>
      <View style={{ backgroundColor: ORANGE, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>🔒 Not Activated</Text>
      </View>
    </TouchableOpacity>
  );
};
