/**
 * QRCodeScreen — Screen 3 of the social profile system.
 *
 * Layout (matches reference exactly):
 *   Header → "Share your profile" hero text → large QR inside orange border
 *   frame → caption → 4 action buttons (Share, Save, Copy, Refresh) →
 *   info card "Scan to connect"
 *
 * Public web-link: https://raw1-supabase.netlify.app/u/{username}
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Clipboard,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ArrowLeft,
  Copy,
  Download,
  QrCode,
  RefreshCw,
  Share2,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { SocialProfileService } from '../services/socialProfile.service';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:           '#0d1520',
  bgCard:       'rgba(255,255,255,0.04)',
  border:       'rgba(255,255,255,0.06)',
  orange:       '#ff7a00',
  accentSoft:   'rgba(255,122,0,0.12)',
  accentBorder: 'rgba(255,122,0,0.28)',
  green:        '#22c55e',
  text:         '#ffffff',
  muted:        '#9ca3af',
};

const APP_WEB_BASE_URL = (process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://raw1.app').replace(/\/+$/, '');

// ── Action button ──────────────────────────────────────────────────────────────
function ActionBtn({
  icon: Icon,
  label,
  onPress,
  done = false,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  label: string;
  onPress: () => void;
  done?: boolean;
}) {
  return (
    <TouchableOpacity style={[s.actionBtn, done && s.actionBtnDone]} onPress={onPress} activeOpacity={0.8}>
      <Icon size={22} color={done ? C.green : C.text} strokeWidth={2} />
      <Text style={[s.actionLabel, done && { color: C.green }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export function QRCodeScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();

  const { uid, username, displayName } = route.params ?? {};

  const [qrKey,  setQrKey]  = useState(0);
  const [copied, setCopied] = useState(false);
  const [qrSlug, setQrSlug] = useState<string>('');
  const [slugReady, setSlugReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!uid) return;
      setSlugReady(false);
      try {
        const slug = await SocialProfileService.ensureQrSlug(uid, username || displayName || null);
        if (!cancelled) setQrSlug(slug);
      } catch {
        if (!cancelled) setQrSlug((username || uid || '').trim());
      } finally {
        if (!cancelled) setSlugReady(true);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [uid, username, displayName]);

  const slugValue = qrSlug || (username || uid || '').trim();
  const nativeDeepLink = slugValue ? `raw1://profile/${encodeURIComponent(slugValue)}` : '';
  const webProfileUrl = slugValue ? `${APP_WEB_BASE_URL}/u/${encodeURIComponent(slugValue)}?slug=${encodeURIComponent(slugValue)}` : '';
  const qrValue = webProfileUrl || nativeDeepLink || `${APP_WEB_BASE_URL}`;
  const shareLink = webProfileUrl || `${APP_WEB_BASE_URL}`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Connect with ${displayName || 'me'} on Raw1 -> ${shareLink}\nDeep link: ${nativeDeepLink}`,
        url: shareLink,
      });
    } catch {}
  };

  const handleSave = () => {
    // Saving QR to camera roll requires expo-media-library or react-native-view-shot.
    // Graceful fallback for now:
    Alert.alert('Save QR', 'Take a screenshot to save your QR code.');
  };

  const handleCopy = () => {
    Clipboard.setString(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleRefresh = () => setQrKey(k => k + 1);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <ArrowLeft size={22} color={C.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My QR Code</Text>
        <View style={s.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO TEXT ──────────────────────────────────────────────────────── */}
        <Text style={s.heroTitle}>Share your profile</Text>
        <Text style={s.heroSub}>Let others scan to view your profile</Text>

        {/* ── QR FRAME (orange border) ─────────────────────────────────────── */}
        <View style={s.qrOuter}>
          {/* inner white bg with padding */}
          <View style={s.qrInner}>
            <View style={s.qrCodeWrap}>
              <QRCode
                key={qrKey}
                value={qrValue}
                size={220}
                color="#000000"
                backgroundColor="#ffffff"
                quietZone={10}
                ecl="H"
              />
              <View style={s.qrLogo} pointerEvents="none">
                <Text style={s.qrLogoRaw}>RAW</Text>
                <Text style={s.qrLogoOne}>1</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── CAPTION ──────────────────────────────────────────────────────── */}
        <Text style={s.caption}>
          {slugReady
            ? 'Your unique profile opens instantly when others scan this QR code'
            : 'Preparing your unique QR identity...'}
        </Text>

        {/* ── 4 ACTION BUTTONS ─────────────────────────────────────────────── */}
        <View style={s.actionsRow}>
          <ActionBtn icon={Share2}    label="Share"   onPress={handleShare} />
          <ActionBtn icon={Download}  label="Save"    onPress={handleSave}  />
          <ActionBtn icon={Copy}      label={copied ? 'Copied!' : 'Copy'} onPress={handleCopy} done={copied} />
          <ActionBtn icon={RefreshCw} label="Refresh" onPress={handleRefresh} />
        </View>

        {/* ── INFO CARD ────────────────────────────────────────────────────── */}
        <View style={s.infoCard}>
          <View style={s.infoIconCircle}>
            <QrCode size={20} color={C.orange} strokeWidth={2} />
          </View>
          <View style={s.infoTextBlock}>
            <Text style={s.infoBold}>Scan to connect</Text>
            <Text style={s.infoMuted}>
              People can scan your QR code to view your profile and connect.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
  },

  // Scroll
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 60,
    alignItems: 'center',
    gap: 20,
  },

  // Hero text
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginTop: -12,
  },

  // QR frame — orange 3px border, 24px radius
  qrOuter: {
    borderWidth: 3,
    borderColor: C.orange,
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#ffffff',
    // subtle orange glow
    ...(Platform.OS !== 'web' ? {} : { boxShadow: '0 0 24px rgba(255,122,0,0.22)' }),
  },
  qrInner: {
    backgroundColor: '#ffffff',
  },
  qrCodeWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLogo: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -44 }, { translateY: -25 }],
    backgroundColor: '#0d1520',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  qrLogoRaw: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: 1,
  },
  qrLogoOne: {
    color: '#ff7a00',
    fontWeight: '800',
    fontSize: 20,
    letterSpacing: 1,
  },

  // Caption
  caption: {
    fontSize: 14,
    color: C.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginTop: -8,
  },

  // 4 action buttons
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: C.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  actionBtnDone: {
    borderColor: 'rgba(34,197,94,0.3)',
    backgroundColor: 'rgba(34,197,94,0.07)',
  },
  actionLabel: {
    color: C.text,
    fontSize: 11,
    fontWeight: '700',
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    backgroundColor: C.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.accentBorder,
    padding: 16,
  },
  infoIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: C.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoTextBlock: {
    flex: 1,
  },
  infoBold: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
  infoMuted: {
    color: C.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
});
