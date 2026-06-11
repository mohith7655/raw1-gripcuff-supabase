import React, { useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { LayoutGrid, Dumbbell } from 'lucide-react-native';
import { AppTheme } from '../core/theme/app_theme';
import { SubTab } from '../models/Video';


export function useFloatingToggle() {
  const translateY = useRef(new Animated.Value(0)).current;
  const isVisible = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (isVisible.current) return;
    isVisible.current = true;
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 8,
      speed: 14,
    }).start();
  }, [translateY]);

  const hide = useCallback(() => {
    if (!isVisible.current) return;
    isVisible.current = false;
    // Toggle sits at the top, so hide it by sliding up & out of view.
    Animated.timing(translateY, {
      toValue: -120,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const onScroll = useCallback(() => {
    hide();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => show(), 600);
  }, [hide, show]);

  return { translateY, onScroll };
}

type Props = {
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
  translateY: Animated.Value;
  /** Distance from the top of the (already safe-area-insetted) container. */
  topOffset?: number;
};

export function FloatingTabToggle({ activeTab, onTabChange, translateY, topOffset = 56 }: Props) {
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: topOffset,
        left: 0,
        right: 0,
        alignItems: 'center',
        transform: [{ translateY }],
        zIndex: 100,
      }}
    >
      {/* Compact pill — matches the Library Exercises/Workouts toggle */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: '#EEEEF2',
        borderRadius: 100,
        padding: 2,
        borderWidth: 1,
        borderColor: '#D8D8E4',
        shadowColor: '#211832',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 6,
      }}>
        <TouchableOpacity
          style={{
            paddingHorizontal: 22,
            paddingVertical: 6,
            borderRadius: 100,
            backgroundColor: activeTab === 'all' ? '#211832' : 'transparent',
          }}
          onPress={() => onTabChange('all')}
          activeOpacity={0.8}
        >
          <Text style={{ color: activeTab === 'all' ? '#fff' : '#7A7C90', fontSize: 12, fontWeight: '600' }}>
            Exercises
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            paddingHorizontal: 22,
            paddingVertical: 6,
            borderRadius: 100,
            backgroundColor: activeTab === 'workouts' ? '#211832' : 'transparent',
          }}
          onPress={() => onTabChange('workouts')}
          activeOpacity={0.8}
        >
          <Text style={{ color: activeTab === 'workouts' ? '#fff' : '#7A7C90', fontSize: 12, fontWeight: '600' }}>
            Workouts
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
