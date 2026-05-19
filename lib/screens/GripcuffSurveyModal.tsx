import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GripcuffStatus, useAccess } from '../providers/AccessContext';

const ORANGE = '#FF6B00';

const OPTIONS: { value: NonNullable<GripcuffStatus>; label: string }[] = [
  { value: 'has_gripcuff', label: 'I have the Gripcuff' },
  { value: 'using_at_gym', label: 'I am using the Gripcuff at gym' },
  { value: 'no_gripcuff', label: "I don't have the Gripcuff" },
];

export const GripcuffSurveyModal = () => {
  const { surveyVisible, completeSurvey, hideSurvey } = useAccess();
  const insets = useSafeAreaInsets();
  const { width: winWidth } = useWindowDimensions();
  const screenHeight = Dimensions.get('window').height;

  const [internalVisible, setInternalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const [selected, setSelected] = useState<GripcuffStatus>(null);

  useEffect(() => {
    if (surveyVisible && !internalVisible) {
      setSelected(null);
      setInternalVisible(true);
      slideAnim.setValue(screenHeight);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: Platform.OS !== 'web',
        tension: 58,
        friction: 12,
      }).start();
    }
  }, [surveyVisible, screenHeight]);

  const slideOut = useCallback(
    (onDone: () => void) => {
      Animated.timing(slideAnim, {
        toValue: screenHeight,
        duration: 260,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setInternalVisible(false);
        onDone();
      });
    },
    [screenHeight],
  );

  const handleClose = useCallback(() => {
    slideOut(hideSurvey);
  }, [slideOut, hideSurvey]);

  const handleContinue = useCallback(() => {
    if (!selected) return;
    slideOut(async () => {
      await completeSurvey(selected);
    });
  }, [selected, slideOut, completeSurvey]);

  if (!internalVisible) return null;

  const isWide = winWidth >= 480;

  const sheetContent = (
    <>
      <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
        <Text style={styles.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <View style={styles.brandRow}>
        <Text style={styles.logo}>Raw1</Text>
        <Text style={styles.question}>Tell us about your Gripcuff</Text>
      </View>

      <View style={styles.optionsList}>
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.optionRow, selected === opt.value && styles.optionRowSelected]}
            onPress={() => setSelected(opt.value)}
            activeOpacity={0.8}
          >
            <View style={[styles.radio, selected === opt.value && styles.radioSelected]}>
              {selected === opt.value && <View style={styles.radioDot} />}
            </View>
            <Text style={[styles.optionText, selected === opt.value && styles.optionTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
        onPress={handleContinue}
        disabled={!selected}
        activeOpacity={0.85}
      >
        <Text style={styles.continueBtnText}>Continue</Text>
      </TouchableOpacity>
    </>
  );

  if (Platform.OS === 'web') {
    const appHeight = typeof window !== 'undefined' ? window.innerHeight : screenHeight;
    return (
      <div
        style={({
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: appHeight,
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
        } as any)}
      >
        <div
          onClick={handleClose}
          style={({ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)' } as any)}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              width: isWide ? Math.min(winWidth, 560) : '100%',
              maxHeight: appHeight * 0.85,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
            {sheetContent}
          </View>
        </Animated.View>
      </div>
    );
  }

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        styles.nativeRoot,
        { transform: [{ translateY: slideAnim }] },
      ]}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        onPress={handleClose}
        activeOpacity={1}
      />
      <View style={[styles.sheet, styles.nativeSheet]}>
        <View style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          {sheetContent}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  nativeRoot: {
    zIndex: 101,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    boxShadow: '0px 4px 10px rgba(0,0,0,0.2)',
    elevation: 30,
  },
  nativeSheet: {
    maxHeight: '85%',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  closeBtn: {
    alignSelf: 'flex-end',
    padding: 6,
    marginBottom: 4,
  },
  closeBtnText: {
    color: '#888',
    fontSize: 20,
    fontWeight: '500',
  },

  brandRow: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    fontStyle: 'italic',
    color: ORANGE,
    letterSpacing: 1,
  },
  question: {
    fontSize: 16,
    color: '#ccc',
    marginTop: 6,
    textAlign: 'center',
  },

  optionsList: {
    gap: 12,
    marginBottom: 28,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#242424',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#333',
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  optionRowSelected: {
    borderColor: ORANGE,
    backgroundColor: '#1f1408',
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: ORANGE,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ORANGE,
  },
  optionText: {
    color: '#aaa',
    fontSize: 15,
    flex: 1,
  },
  optionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  continueBtn: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 8,
  },
  continueBtnDisabled: {
    opacity: 0.4,
  },
  continueBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
