import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppNotification } from '../models/AppNotification';

type Props = {
  notification: AppNotification | null;
  onDismiss: () => void;
};

const TYPE_COLOR: Record<string, string> = {
  workout_invite: '#F97316',
  friend_request: '#4FC3F7',
  chat_message: '#22C55E',
  stranger_invite: '#EAB308',
  system: '#A78BFA',
};

export function TopBannerNotification({ notification, onDismiss }: Props) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!notification) return;

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        tension: 85,
        friction: 11,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();

    const timer = setTimeout(() => dismiss(), 2000);
    return () => clearTimeout(timer);
  }, [notification?.id]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(onDismiss);
  };

  if (!notification) return null;

  const accent = TYPE_COLOR[notification.type] ?? '#F97316';

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]} pointerEvents="box-none">
      <View style={[styles.card, { borderColor: `${accent}66` }]}>
        {notification.avatar ? (
          <Image source={{ uri: notification.avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.iconWrap, { backgroundColor: `${accent}22` }]}>
            <Ionicons name="person" color={accent} size={16} />
          </View>
        )}
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{notification.title}</Text>
          <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
        </View>
        <TouchableOpacity onPress={dismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={16} color="#94A3B8" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: Platform.OS === 'ios' ? 52 : 14,
    zIndex: 9999,
    elevation: 9999,
    alignItems: 'center',
  } as any,
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(20,33,56,0.92)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  body: {
    color: '#A8B6C9',
    fontSize: 12,
    lineHeight: 16,
  },
});
