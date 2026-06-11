import React, { useRef, useCallback } from 'react';
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
import { X, Video } from 'lucide-react-native';

const { height: SH } = Dimensions.get('window');
const ORANGE = '#F25912';
const CARD_BG = '#F8F8FC';
const TEXT_SECONDARY = '#7A7C90';

interface VideoModalProps {
  visible: boolean;
  onClose: () => void;
}

export function VideoModal({ visible, onClose }: VideoModalProps) {
  const slideAnim = useRef(new Animated.Value(SH)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: false,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SH,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleClose = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: SH,
      duration: 250,
      useNativeDriver: false,
    }).start(() => onClose());
  }, [slideAnim, onClose]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
          <X size={20} color={TEXT_SECONDARY} />
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Video size={48} color={ORANGE} />
          </View>
          <Text style={styles.title}>Video Posts</Text>
          <Text style={styles.sub}>
            Coming soon — share workout videos with your community
          </Text>
        </View>
      </Animated.View>
    </Modal>
  );
}

const SHEET_HEIGHT = SH * 0.4;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 20,
    right: 20,
    padding: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 14,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(242,89,18,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#211832',
    fontSize: 20,
    fontWeight: '800',
  },
  sub: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
