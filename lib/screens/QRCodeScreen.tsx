/**
 * QRCodeScreen — QR + full profile preview card.
 *
 * Route params: uid, username, displayName, email, age, gender, avatarUrl,
 *   streak, workouts, prs, bio, whatIDo, lookingToMeet, connectionGoals,
 *   hobbies, gymName, gymAddress, houseName, houseAddress, parkName,
 *   parkAddress, openToMentor, helpingBeginners, communityNote
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Clipboard,
  Image,
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
  Briefcase,
  Copy,
  Download,
  Dumbbell,
  Flame,
  HeartHandshake,
  Home,
  MapPin,
  QrCode,
  RefreshCw,
  Share2,
  Trees,
  Trophy,
  Users,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { SocialProfileService } from '../services/socialProfile.service';
import { HOBBY_META } from '../models/SocialProfile';
import { ALL_BADGES, Badge } from '../services/rewards.service';

// ── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:           '#0d1520',
  bgCard:       'rgba(255,255,255,0.04)',
  bgInner:      'rgba(255,255,255,0.06)',
  border:       'rgba(255,255,255,0.06)',
  orange:       '#ff7a00',
  accentSoft:   'rgba(255,122,0,0.12)',
  accentBorder: 'rgba(255,122,0,0.28)',
  green:        '#22c55e',
  greenSoft:    'rgba(34,197,94,0.12)',
  greenBorder:  'rgba(34,197,94,0.28)',
  blue:         '#3b82f6',
  blueSoft:     'rgba(59,130,246,0.12)',
  blueBorder:   'rgba(59,130,246,0.28)',
  purple:       '#a78bfa',
  purpleSoft:   'rgba(167,139,250,0.12)',
  purpleBorder: 'rgba(167,139,250,0.28)',
  text:         '#ffffff',
  muted:        '#9ca3af',
  dim:          '#64748b',
};

const APP_WEB_BASE_URL = (process.env.EXPO_PUBLIC_APP_WEB_URL || 'https://raw1.app').replace(/\/+$/, '');

// ── Sub-components ─────────────────────────────────────────────────────────────

function Avatar({ uri, size }: { uri?: string | null; size: number }) {
  const [err, setErr] = useState(false);
  if (uri && !err) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: '#0f2030',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.38 }}>👤</Text>
    </View>
  );
}

function ActionBtn({
  icon: Icon, label, onPress, done = false,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  label: string;
  onPress: () => void;
  done?: boolean;
}) {
  return (
    <TouchableOpacity style={[s.actionBtn, done && s.actionBtnDone]} onPress={onPress} activeOpacity={0.8}>
      <Icon size={20} color={done ? C.green : C.text} strokeWidth={2} />
      <Text style={[s.actionLabel, done && { color: C.green }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Capsule({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <View style={[s.capsule, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[s.capsuleText, { color }]}>{label}</Text>
    </View>
  );
}

function LocationRow({ icon: Icon, title, name, address }: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  title: string;
  name?: string | null;
  address?: string | null;
}) {
  const primary = (name ?? '').trim();
  const secondary = (address ?? '').trim();
  if (!primary && !secondary) return null;
  return (
    <View style={s.locRow}>
      <View style={s.locIcon}>
        <Icon size={15} color={C.orange} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.locLabel}>{title}</Text>
        <Text style={s.locName} numberOfLines={1}>{primary || secondary}</Text>
        {primary && secondary && primary.toLowerCase() !== secondary.toLowerCase() ? (
          <Text style={s.locAddr} numberOfLines={1}>{secondary}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────
export function QRCodeScreen() {
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();

  const {
    uid, username, displayName, email, age, gender, dateOfBirth, phone, hasAccess, accessType, avatarUrl,
    streak, workouts, prs, earnedBadges,
    bio, whatIDo, lookingToMeet, connectionGoals, hobbies,
    gymName, gymAddress, houseName, houseAddress, parkName, parkAddress,
    openToMentor, helpingBeginners, communityNote,
  } = route.params ?? {};

  const [qrKey,     setQrKey]     = useState(0);
  const [copied,    setCopied]    = useState(false);
  const [qrSlug,    setQrSlug]    = useState<string>('');
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

  const slugValue    = qrSlug || (username || uid || '').trim();
  const nativeLink   = slugValue ? `raw1://profile/${encodeURIComponent(slugValue)}` : '';
  const webProfileUrl = slugValue ? `${APP_WEB_BASE_URL}/u/${encodeURIComponent(slugValue)}?slug=${encodeURIComponent(slugValue)}` : '';
  const qrValue      = webProfileUrl || nativeLink || APP_WEB_BASE_URL;
  const shareLink    = webProfileUrl || APP_WEB_BASE_URL;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Connect with ${displayName || 'me'} on Raw1 → ${shareLink}`,
        url: shareLink,
      });
    } catch {}
  };

  const handleSave = () => Alert.alert('Save QR', 'Take a screenshot to save your QR code.');

  const handleCopy = () => {
    Clipboard.setString(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleRefresh = () => setQrKey(k => k + 1);

  // Derived
  const meetItems: string[] = lookingToMeet
    ? lookingToMeet.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];
  const goalItems: string[] = Array.isArray(connectionGoals) ? connectionGoals : [];
  const hobbyItems: string[] = Array.isArray(hobbies) ? hobbies : [];
  const hasLocations = !!(gymName || houseName || parkName);
  const hasCommunity = !!(openToMentor || helpingBeginners || communityNote);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* ── HEADER ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.iconBtn}>
          <ArrowLeft size={22} color={C.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My QR Code</Text>
        <View style={s.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── HERO TEXT ── */}
        <Text style={s.heroTitle}>Share your profile</Text>
        <Text style={s.heroSub}>Scan to view full profile & connect</Text>

        {/* ── QR FRAME ── */}
        <View style={s.qrOuter}>
          <View style={s.qrInner}>
            <View style={s.qrCodeWrap}>
              <QRCode
                key={qrKey}
                value={qrValue}
                size={200}
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

        <Text style={s.caption}>
          {slugReady
            ? 'Your unique profile opens instantly when scanned'
            : 'Preparing your unique QR identity...'}
        </Text>

        {/* ── 4 ACTION BUTTONS ── */}
        <View style={s.actionsRow}>
          <ActionBtn icon={Share2}    label="Share"             onPress={handleShare} />
          <ActionBtn icon={Download}  label="Save"              onPress={handleSave}  />
          <ActionBtn icon={Copy}      label={copied ? 'Copied!' : 'Copy'} onPress={handleCopy} done={copied} />
          <ActionBtn icon={RefreshCw} label="Refresh"           onPress={handleRefresh} />
        </View>

        {/* ── PROFILE PREVIEW CARD ── */}
        <View style={s.profileCard}>

          {/* Identity */}
          <View style={s.identityRow}>
            <View style={s.avatarRing}>
              <Avatar uri={avatarUrl} size={64} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.identityName} numberOfLines={1}>{displayName || 'Athlete'}</Text>
              {username ? <Text style={s.identityHandle}>@{username}</Text> : null}
            </View>
          </View>

          {/* Basic Info List */}
          <View style={s.basicInfoContainer}>
            {/* Age */}
            <View style={s.basicInfoItem}>
              <Text style={s.basicInfoLabel}>Age</Text>
              <View style={s.basicInfoValueRow}>
                <Text style={s.basicInfoValue}>{age ? `${age} yrs` : '—'}</Text>
              </View>
            </View>

            {/* Gender */}
            <View style={s.basicInfoItem}>
              <Text style={s.basicInfoLabel}>Gender</Text>
              <View style={s.basicInfoValueRow}>
                <Text style={s.basicInfoValue}>{gender || '—'}</Text>
              </View>
            </View>

            {/* DOB */}
            <View style={s.basicInfoItem}>
              <Text style={s.basicInfoLabel}>DOB</Text>
              <View style={s.basicInfoValueRow}>
                <Text style={s.basicInfoValue}>{dateOfBirth || '—'}</Text>
              </View>
            </View>

            {/* Phone */}
            <View style={s.basicInfoItem}>
              <Text style={s.basicInfoLabel}>Phone</Text>
              <View style={s.basicInfoValueRow}>
                <Text style={s.basicInfoValue}>{phone || '—'}</Text>
              </View>
            </View>

            {/* Access */}
            <View style={s.basicInfoItem}>
              <Text style={s.basicInfoLabel}>Gripcuff Access</Text>
              <View style={s.basicInfoValueRow}>
                {hasAccess ? (
                  <View style={s.accessPill}>
                    <Text style={s.accessPillText}>
                      {accessType === 'subscription' ? 'Subscription' : 'Product'}
                    </Text>
                  </View>
                ) : (
                  <Text style={s.accessInactive}>Inactive</Text>
                )}
              </View>
            </View>
          </View>

          {/* Stats strip */}
          <View style={s.statsStrip}>
            <View style={s.statCell}>
              <Flame size={16} color={C.orange} strokeWidth={2} />
              <Text style={s.statVal}>{streak ?? 0}</Text>
              <Text style={s.statLbl}>Streak</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCell}>
              <Dumbbell size={16} color={C.orange} strokeWidth={2} />
              <Text style={s.statVal}>{workouts ?? 0}</Text>
              <Text style={s.statLbl}>Workouts</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCell}>
              <Trophy size={16} color={C.orange} strokeWidth={2} />
              <Text style={s.statVal}>{prs ?? 0}</Text>
              <Text style={s.statLbl}>PRs</Text>
            </View>
          </View>

          {/* Bio */}
          {!!bio && (
            <SectionCard title="About me">
              <Text style={s.bioText}>{bio}</Text>
            </SectionCard>
          )}

          {/* What I do */}
          {!!whatIDo && (
            <SectionCard title="What I do">
              <View style={s.inlineIconRow}>
                <View style={s.inlineIconBox}>
                  <Briefcase size={15} color={C.purple} strokeWidth={2} />
                </View>
                <Text style={s.whatIDoText} numberOfLines={2}>{whatIDo}</Text>
              </View>
            </SectionCard>
          )}

          {/* Looking to meet */}
          {(meetItems.length > 0 || goalItems.length > 0) && (
            <SectionCard title="Looking to meet">
              {meetItems.length > 0 && (
                <View style={s.pillsRow}>
                  {meetItems.map((item, i) => (
                    <Capsule key={i} label={item} color={C.orange} bg={C.accentSoft} border={C.accentBorder} />
                  ))}
                </View>
              )}
              {goalItems.length > 0 && (
                <View style={[s.pillsRow, meetItems.length > 0 && { marginTop: 6 }]}>
                  {goalItems.map((g: string, i: number) => (
                    <Capsule key={i} label={g.replace(/_/g, ' ')} color={C.blue} bg={C.blueSoft} border={C.blueBorder} />
                  ))}
                </View>
              )}
            </SectionCard>
          )}

          {/* Hobbies */}
          {hobbyItems.length > 0 && (
            <SectionCard title="Hobbies">
              <View style={s.pillsRow}>
                {hobbyItems.map((h: string, i: number) => {
                  const meta = HOBBY_META[h as keyof typeof HOBBY_META];
                  return (
                    <View key={i} style={s.hobbyCapsule}>
                      {meta?.emoji ? <Text style={s.hobbyEmoji}>{meta.emoji}</Text> : null}
                      <Text style={s.hobbyCapsuleText}>{meta?.label ?? h}</Text>
                    </View>
                  );
                })}
              </View>
            </SectionCard>
          )}

          {/* Locations */}
          {hasLocations && (
            <SectionCard title="Locations">
              <View style={{ gap: 10 }}>
                <LocationRow icon={MapPin} title="Gym" name={gymName} address={gymAddress} />
                <LocationRow icon={Home}   title="Home area" name={houseName} address={houseAddress} />
                <LocationRow icon={Trees}  title="Local park" name={parkName} address={parkAddress} />
              </View>
            </SectionCard>
          )}

          {/* Community */}
          {hasCommunity && (
            <SectionCard title="Community">
              <View style={{ gap: 8 }}>
                {!!communityNote && <Text style={s.bioText}>{communityNote}</Text>}
                {helpingBeginners && (
                  <View style={s.communityRow}>
                    <Users size={14} color={C.green} strokeWidth={2} />
                    <Text style={s.communityText}>Helping Beginners</Text>
                  </View>
                )}
                {openToMentor && (
                  <View style={s.communityRow}>
                    <HeartHandshake size={14} color={C.orange} strokeWidth={2} />
                    <Text style={s.communityText}>Open to Mentor</Text>
                  </View>
                )}
              </View>
            </SectionCard>
          )}

          {/* Badges */}
          <SectionCard title="Badges">
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              contentContainerStyle={s.badgesScroll}
            >
              {ALL_BADGES.slice(0, 8).map((badge, i) => {
                const isEarned = (earnedBadges ?? []).includes(badge.id);
                return (
                  <View key={badge.id} style={s.badgeItemContainer}>
                    <View 
                      style={[
                        s.badgeShape, 
                        i % 2 === 1 && s.badgeShapeAlt,
                        !isEarned && s.badgeShapeLocked
                      ]}
                    >
                      <Text style={[s.badgeEmoji, !isEarned && s.badgeEmojiLocked]}>
                        {badge.emoji}
                      </Text>
                    </View>
                    <Text style={[s.badgeLabel, !isEarned && s.badgeLabelLocked]} numberOfLines={1}>
                      {badge.label}
                    </Text>
                  </View>
                );
              })}
              {Math.max(0, ALL_BADGES.length - 8) > 0 && (
                <View style={s.moreBadgeContainer}>
                  <View style={s.moreBadge}>
                    <Text style={s.moreBadgeText}>+{Math.max(0, ALL_BADGES.length - 8)}</Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </SectionCard>

        </View>

        {/* ── SCAN INFO ── */}
        <View style={s.infoCard}>
          <View style={s.infoIconCircle}>
            <QrCode size={18} color={C.orange} strokeWidth={2} />
          </View>
          <View style={s.infoTextBlock}>
            <Text style={s.infoBold}>Scan to connect</Text>
            <Text style={s.infoMuted}>
              People can scan your QR code to view your full profile and connect.
            </Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  iconBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1, textAlign: 'center',
    fontSize: 17, fontWeight: '700', color: C.text,
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 60,
    alignItems: 'center',
    gap: 16,
  },

  heroTitle: {
    fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center',
  },
  heroSub: {
    fontSize: 13, color: C.muted, textAlign: 'center', marginTop: -8,
  },

  qrOuter: {
    borderWidth: 3, borderColor: C.orange, borderRadius: 24, padding: 14,
    backgroundColor: '#ffffff',
    ...(Platform.OS !== 'web' ? {} : { boxShadow: '0 0 24px rgba(255,122,0,0.22)' } as any),
  },
  qrInner: { backgroundColor: '#ffffff' },
  qrCodeWrap: {
    position: 'relative', alignItems: 'center', justifyContent: 'center',
  },
  qrLogo: {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: [{ translateX: -40 }, { translateY: -22 }],
    backgroundColor: '#0d1520',
    borderRadius: 999,
    paddingVertical: 6, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  qrLogoRaw: { color: '#ffffff', fontWeight: '800', fontSize: 18, letterSpacing: 1 },
  qrLogoOne: { color: '#ff7a00', fontWeight: '800', fontSize: 18, letterSpacing: 1 },

  caption: {
    fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19,
    maxWidth: 280, marginTop: -4,
  },

  actionsRow: { flexDirection: 'row', gap: 8, width: '100%' },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 12,
    backgroundColor: C.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: C.border,
  },
  actionBtnDone: {
    borderColor: 'rgba(34,197,94,0.3)',
    backgroundColor: 'rgba(34,197,94,0.07)',
  },
  actionLabel: { color: C.text, fontSize: 10, fontWeight: '700' },

  // Profile preview card
  profileCard: {
    width: '100%',
    backgroundColor: C.bgCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
    ...(Platform.OS !== 'web' ? {
      shadowColor: '#3867D6', shadowOpacity: 0.14,
      shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5,
    } : { boxShadow: '0 8px 24px rgba(56,103,214,0.14)' } as any),
  },

  identityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 16, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  avatarRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2.5, borderColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  identityName: { fontSize: 17, fontWeight: '800', color: C.text },
  identityHandle: { fontSize: 13, color: C.muted, marginTop: 1 },
  identityMeta: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  metaChip: {
    fontSize: 11, color: C.muted, fontWeight: '600',
    backgroundColor: C.bgInner,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: C.border,
  },

  statsStrip: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  statCell: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 3, paddingVertical: 14,
  },
  statDivider: { width: 1, height: 36, backgroundColor: C.border },
  statVal: { fontSize: 18, fontWeight: '800', color: C.text },
  statLbl: {
    fontSize: 9, fontWeight: '700', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },

  // Section card inside profile
  card: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  cardTitle: {
    fontSize: 11, fontWeight: '700', color: C.dim,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 10,
  },

  bioText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },

  inlineIconRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineIconBox: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: C.purpleSoft,
    borderWidth: 1, borderColor: C.purpleBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  whatIDoText: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  capsule: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, borderWidth: 1,
  },
  capsuleText: { fontSize: 12, fontWeight: '600' },

  hobbyCapsule: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, borderWidth: 1,
    borderColor: C.accentBorder, backgroundColor: C.accentSoft,
  },
  hobbyEmoji: { fontSize: 14 },
  hobbyCapsuleText: { fontSize: 12, fontWeight: '600', color: C.orange },

  locRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  locIcon: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentBorder,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  locLabel: { fontSize: 10, color: C.dim, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  locName: { fontSize: 14, fontWeight: '700', color: C.text, marginTop: 1 },
  locAddr: { fontSize: 11, color: C.muted, marginTop: 1 },

  communityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  communityText: { fontSize: 13, fontWeight: '600', color: C.text },

  // Scan info card
  infoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    width: '100%',
    backgroundColor: C.bgCard,
    borderRadius: 16, borderWidth: 1, borderColor: C.accentBorder,
    padding: 14,
  },
  infoIconCircle: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.accentSoft, borderWidth: 1, borderColor: C.accentBorder,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  infoTextBlock: { flex: 1 },
  infoBold: { color: C.text, fontSize: 13, fontWeight: '700' },
  infoMuted: { color: C.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },

  // Basic Info
  basicInfoContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  basicInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  basicInfoLabel: {
    color: C.dim,
    fontSize: 13,
    fontWeight: '600',
  },
  basicInfoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  basicInfoValue: {
    color: C.text,
    fontSize: 13,
    fontWeight: '600',
  },
  accessInactive: {
    color: C.orange,
    fontWeight: '700',
    fontSize: 13,
  },
  accessPill: {
    backgroundColor: C.orange,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  accessPillText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },

  // Badges
  badgesScroll: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 4,
    paddingBottom: 4,
    alignItems: 'flex-start',
  },
  badgeItemContainer: {
    alignItems: 'center',
    width: 60,
    gap: 6,
  },
  badgeShape: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: 'rgba(255,122,0,0.1)',
    borderWidth: 1.5, borderColor: C.orange,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeShapeAlt: {
    backgroundColor: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.7)',
    transform: [{ rotate: '-4deg' }],
  },
  badgeShapeLocked: {
    backgroundColor: C.bgCard,
    borderColor: 'rgba(255,255,255,0.06)',
    opacity: 0.5,
  },
  badgeEmoji: { fontSize: 24 },
  badgeEmojiLocked: { opacity: 0.4 },
  badgeLabel: { color: C.text, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  badgeLabelLocked: { color: C.muted },
  moreBadgeContainer: {
    width: 52,
    alignItems: 'center',
    paddingTop: 4,
  },
  moreBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  moreBadgeText: { color: C.muted, fontSize: 12, fontWeight: '700' },
});
