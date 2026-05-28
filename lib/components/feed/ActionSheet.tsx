import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';

const { height: SH } = Dimensions.get('window');
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';
const RED = '#FF4444';
const ORANGE = '#FF6B00';

export interface ActionSheetOption {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
  cancel?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  options: ActionSheetOption[];
  onClose: () => void;
}

export function ActionSheet({ visible, options, onClose }: ActionSheetProps) {
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 70,
        friction: 12,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 220,
        useNativeDriver: false,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!visible) return null;

  const mainOptions = options.filter(o => !o.cancel);
  const cancelOption = options.find(o => o.cancel);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        {mainOptions.map((opt, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.row, i < mainOptions.length - 1 && styles.rowBorder]}
            onPress={() => { onClose(); opt.onPress(); }}
            activeOpacity={0.7}
          >
            {opt.icon && <View style={styles.iconWrap}>{opt.icon}</View>}
            <Text style={[styles.rowLabel, opt.destructive && styles.rowLabelDestructive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}

        {cancelOption && (
          <>
            <View style={styles.cancelSeparator} />
            <TouchableOpacity
              style={styles.row}
              onPress={() => { onClose(); cancelOption.onPress?.(); }}
              activeOpacity={0.7}
            >
              {cancelOption.icon && <View style={styles.iconWrap}>{cancelOption.icon}</View>}
              <Text style={styles.cancelLabel}>{cancelOption.label}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Safe area padding */}
        <View style={{ height: Platform.OS === 'ios' ? 20 : 8 }} />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 16,
    gap: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  iconWrap: { width: 24, alignItems: 'center' },
  rowLabel: { color: '#fff', fontSize: 16, fontWeight: '500' },
  rowLabelDestructive: { color: RED },
  cancelSeparator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 4,
  },
  cancelLabel: { color: TEXT_SECONDARY, fontSize: 16 },
});
