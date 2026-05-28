import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';

const CARD_BG = '#1A2332';
const RED = '#FF4444';
const TEXT_SECONDARY = '#94A3B8';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  body,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const scaleAnim  = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim,   { toValue: 1,   useNativeDriver: false, tension: 80, friction: 10 }),
        Animated.timing(opacityAnim, { toValue: 1,   duration: 180, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim,   { toValue: 0.88, duration: 150, useNativeDriver: false }),
        Animated.timing(opacityAnim, { toValue: 0,    duration: 150, useNativeDriver: false }),
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
        <Animated.View style={[styles.dialog, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  dialog: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
