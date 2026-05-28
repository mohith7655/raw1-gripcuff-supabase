// run: npx expo start --clear  after this change
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { Plus, Pencil, Image as ImageIcon, Video } from 'lucide-react-native';

const ORANGE = '#FF6B00';
const PILL_BG = '#1A2332';
const FAB_SIZE = 54;
const PILL_STEP = 70;

export type SpeedDialAction = 'tweet' | 'post' | 'video';

interface Option {
  key: SpeedDialAction;
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  delay: number;
}

const OPTIONS: Option[] = [
  { key: 'tweet', label: 'Tweet', Icon: Pencil,    delay: 0   },
  { key: 'post',  label: 'Post',  Icon: ImageIcon, delay: 60  },
  { key: 'video', label: 'Video', Icon: Video,     delay: 120 },
];

interface SpeedDialProps {
  onSelect: (action: SpeedDialAction) => void;
}

export function SpeedDial({ onSelect }: SpeedDialProps) {
  // isOpen drives pointerEvents — must be React state, not just a ref,
  // so the overlay re-renders with the correct pointerEvents value.
  const [isOpen, setIsOpen] = useState(false);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const fabRotation    = useRef(new Animated.Value(0)).current;
  const pillAnims      = useRef(OPTIONS.map(() => ({
    translateY: new Animated.Value(40),
    opacity:    new Animated.Value(0),
  }))).current;

  const runOpen = useCallback(() => {
    setIsOpen(true);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.timing(fabRotation,    { toValue: 1, duration: 250, useNativeDriver: false }),
      ...pillAnims.flatMap(({ translateY, opacity }, i) => [
        Animated.delay(OPTIONS[i].delay),
        Animated.parallel([
          Animated.timing(translateY, { toValue: 0,  duration: 220, useNativeDriver: false }),
          Animated.timing(opacity,    { toValue: 1,  duration: 200, useNativeDriver: false }),
        ]),
      ]),
    ]).start();
  }, [overlayOpacity, fabRotation, pillAnims]);

  const runClose = useCallback((then?: () => void) => {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: false }),
      Animated.timing(fabRotation,    { toValue: 0, duration: 220, useNativeDriver: false }),
      ...pillAnims.flatMap(({ translateY, opacity }) => [
        Animated.parallel([
          Animated.timing(translateY, { toValue: 40, duration: 180, useNativeDriver: false }),
          Animated.timing(opacity,    { toValue: 0,  duration: 160, useNativeDriver: false }),
        ]),
      ]),
    ]).start(() => {
      setIsOpen(false);
      then?.();
    });
  }, [overlayOpacity, fabRotation, pillAnims]);

  const handleFabPress = useCallback(() => {
    if (isOpen) runClose();
    else runOpen();
  }, [isOpen, runOpen, runClose]);

  const handleSelect = useCallback((action: SpeedDialAction) => {
    runClose(() => onSelect(action));
  }, [runClose, onSelect]);

  const rotate = fabRotation.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <>
      {/* Overlay — pointerEvents='none' when closed so touches pass through */}
      <Animated.View
        pointerEvents={isOpen ? 'auto' : 'none'}
        style={[styles.overlay, { opacity: overlayOpacity }]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={() => runClose()}
          activeOpacity={1}
        />
      </Animated.View>

      {/* FAB + pills container — box-none so the View itself never eats touches */}
      <View style={styles.container} pointerEvents="box-none">
        {/* Pills */}
        <View
          pointerEvents={isOpen ? 'auto' : 'none'}
          style={styles.pillsContainer}
        >
          {[...OPTIONS].reverse().map((opt, reversedIndex) => {
            const originalIndex = OPTIONS.length - 1 - reversedIndex;
            const { translateY, opacity } = pillAnims[originalIndex];
            const bottomOffset = FAB_SIZE + 12 + (OPTIONS.length - 1 - originalIndex) * PILL_STEP;
            return (
              <Animated.View
                key={opt.key}
                style={[
                  styles.pillWrapper,
                  { bottom: bottomOffset, opacity, transform: [{ translateY }] },
                ]}
              >
                <TouchableOpacity
                  style={styles.pill}
                  onPress={() => handleSelect(opt.key)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.pillLabel}>{opt.label}</Text>
                  <View style={styles.iconCircle}>
                    <opt.Icon size={18} color="#fff" />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>

        {/* FAB */}
        <TouchableOpacity style={styles.fab} onPress={handleFabPress} activeOpacity={0.88}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Plus size={26} color="#fff" />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 998,
  },
  container: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    alignItems: 'flex-end',
    zIndex: 999,
  },
  pillsContainer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
  },
  pillWrapper: {
    position: 'absolute',
    right: 0,
    alignItems: 'flex-end',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PILL_BG,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  pillLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
