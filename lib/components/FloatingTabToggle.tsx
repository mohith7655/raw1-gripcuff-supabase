import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { LayoutGrid, Dumbbell } from 'lucide-react-native';
import { AppTheme } from '../core/theme/app_theme';
import { SubTab } from '../models/Video';

const TOP_TOGGLE_THRESHOLD = 110;

export function useFloatingToggle() {
  const translateY = useRef(new Animated.Value(120)).current;
  const scrollY = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isVisible = useRef(false);

  const show = useCallback(() => {
    if (isVisible.current) return;
    isVisible.current = true;
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 10,
      speed: 14,
    }).start();
  }, [translateY]);

  const hide = useCallback(() => {
    if (!isVisible.current) return;
    isVisible.current = false;
    Animated.timing(translateY, {
      toValue: 120,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const onScroll = useCallback((e: any) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    hide();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (scrollY.current > TOP_TOGGLE_THRESHOLD) {
        show();
      }
    }, 300);
  }, [hide, show]);

  return { translateY, onScroll };
}

type Props = {
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
  translateY: Animated.Value;
};

export function FloatingTabToggle({ activeTab, onTabChange, translateY }: Props) {
  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 20,
        left: 40,
        right: 40,
        transform: [{ translateY }],
        zIndex: 100,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
        elevation: 12,
      }}
    >
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#131f2e',
        borderRadius: 30,
        padding: 4,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
      }}>
        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: 26,
            backgroundColor: activeTab === 'all' ? '#000000' : 'transparent',
          }}
          onPress={() => onTabChange('all')}
          activeOpacity={0.8}
        >
          <LayoutGrid size={13} color={activeTab === 'all' ? AppTheme.primaryColor : '#607a94'} />
          <Text style={{ color: activeTab === 'all' ? '#fff' : '#607a94', fontSize: 12, fontWeight: activeTab === 'all' ? '700' : '500' }}>
            Exercises
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 10,
            borderRadius: 26,
            backgroundColor: activeTab === 'workouts' ? '#000000' : 'transparent',
          }}
          onPress={() => onTabChange('workouts')}
          activeOpacity={0.8}
        >
          <Dumbbell size={13} color={activeTab === 'workouts' ? AppTheme.primaryColor : '#607a94'} />
          <Text style={{ color: activeTab === 'workouts' ? '#fff' : '#607a94', fontSize: 12, fontWeight: activeTab === 'workouts' ? '700' : '500' }}>
            Workouts
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
