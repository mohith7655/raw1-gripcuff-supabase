/**
 * BottomActionBar — fixed-bottom "Message" (outlined) + "Connect" (orange fill).
 * Used on ProfileScreen and ScannedProfileScreen.
 */
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  onMessage: () => void;
  onConnect: () => void;
  connectLabel?: string;
  connectDisabled?: boolean;
}

export function BottomActionBar({
  onMessage,
  onConnect,
  connectLabel = 'Connect',
  connectDisabled = false,
}: Props) {
  return (
    <View style={s.bar}>
      <TouchableOpacity style={s.messageBtn} onPress={onMessage} activeOpacity={0.86}>
        <Text style={s.messageText}>Message</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[s.connectBtn, connectDisabled && { opacity: 0.55 }]}
        onPress={onConnect}
        disabled={connectDisabled}
        activeOpacity={0.86}
      >
        <Text style={s.connectText}>{connectLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    backgroundColor: '#0d1520',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  messageBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  connectBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ff7a00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
