import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { X, Check } from 'lucide-react-native';
import { useUser } from '../../providers/UserContext';
import { supabase } from '../../core/config/supabase';

const ORANGE = '#FF6B00';
const BG = '#0F1923';
const CARD_BG = '#1A2332';
const TEXT_SECONDARY = '#94A3B8';
const GREEN = '#22c55e';

const TIERS = [
  { id: 't5',   label: 'Starter', credits: 5,   price: 5,  bonus: 0  },
  { id: 't10',  label: 'Basic',   credits: 10,  price: 10, bonus: 0  },
  { id: 't30',  label: 'Value',   credits: 30,  price: 22, bonus: 27 },
  { id: 't65',  label: 'Pro',     credits: 65,  price: 45, bonus: 30 },
  { id: 't140', label: 'Elite',   credits: 140, price: 85, bonus: 40 },
];
const POPULAR_ID = 't30';

function RBadge({ size = 24 }: { size?: number }) {
  return (
    <View style={[styles.rBadge, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.rText, { fontSize: size * 0.54 }]}>R</Text>
    </View>
  );
}

interface BuyCreditsModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchased?: (newBalance: number) => void;
}

export function BuyCreditsModal({ visible, onClose, onPurchased }: BuyCreditsModalProps) {
  const { profile } = useUser();
  const [selectedId, setSelectedId] = useState(POPULAR_ID);
  const [buying, setBuying] = useState(false);

  const selected = TIERS.find(t => t.id === selectedId)!;
  const credits = profile?.credits ?? 0;

  const handleBuy = useCallback(async () => {
    if (buying) return;
    setBuying(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not logged in');

      const res = await fetch(
        `${process.env.EXPO_PUBLIC_APP_WEB_URL}/.netlify/functions/create-credits-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            priceInCents: selected.price * 100,
            credits: selected.credits,
            userId: session.user.id,
          }),
        },
      );

      const json = await res.json();
      if (json.error) throw new Error(json.error);

      // Open Stripe's hosted checkout in a new tab
      if (typeof window !== 'undefined' && json.checkoutUrl) {
        window.open(json.checkoutUrl, '_blank');
      }

      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not start checkout. Please try again.');
    } finally {
      setBuying(false);
    }
  }, [buying, selected, onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ width: 36 }} />
          <Text style={styles.headerTitle}>Get Credits</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={22} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>

        {/* Balance row */}
        <View style={styles.balanceRow}>
          <RBadge />
          <Text style={styles.balanceText}>
            You have <Text style={styles.balanceCount}>{credits}</Text> credits
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {TIERS.map(tier => {
            const isSelected = selectedId === tier.id;
            const isPopular = tier.id === POPULAR_ID;
            return (
              <TouchableOpacity
                key={tier.id}
                style={[
                  styles.tierCard,
                  isPopular && styles.tierCardPopular,
                  isSelected && styles.tierCardSelected,
                ]}
                onPress={() => setSelectedId(tier.id)}
                activeOpacity={0.85}
              >
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Check size={12} color="#fff" />
                  </View>
                )}
                {isPopular && !isSelected && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Popular</Text>
                  </View>
                )}
                <View style={styles.tierLeft}>
                  <RBadge size={28} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.tierCredits}>{tier.credits} credits</Text>
                    <Text style={styles.tierLabel}>{tier.label}</Text>
                  </View>
                </View>
                <View style={styles.tierRight}>
                  <Text style={styles.tierPrice}>${tier.price}</Text>
                  {tier.bonus > 0 && (
                    <View style={styles.bonusBadge}>
                      <Text style={styles.bonusText}>+{tier.bonus}% free</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Buy button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.buyBtn, buying && styles.buyBtnDisabled]}
            onPress={handleBuy}
            disabled={buying}
            activeOpacity={0.88}
          >
            {buying
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buyBtnText}>
                  Buy {selected.credits} Credits for ${selected.price}
                </Text>
            }
          </TouchableOpacity>
        </View>

      </View>

    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  closeBtn: { padding: 4 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: CARD_BG,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  balanceText: { color: TEXT_SECONDARY, fontSize: 14 },
  balanceCount: { color: '#fff', fontWeight: '700' },
  scrollContent: { padding: 16, gap: 10 },
  tierCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    position: 'relative',
    marginBottom: 8,
  },
  tierCardPopular: { borderColor: ORANGE },
  tierCardSelected: { borderColor: ORANGE, borderWidth: 2 },
  checkBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  popularBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  tierLeft: { flexDirection: 'row', alignItems: 'center' },
  tierCredits: { color: '#fff', fontSize: 15, fontWeight: '700' },
  tierLabel: { color: TEXT_SECONDARY, fontSize: 12, marginTop: 2 },
  tierRight: { alignItems: 'flex-end', gap: 4 },
  tierPrice: { color: '#fff', fontSize: 16, fontWeight: '800' },
  bonusBadge: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.4)',
  },
  bonusText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  buyBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyBtnDisabled: { opacity: 0.5 },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  toast: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,25,35,0.95)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.3)',
  },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  rBadge: {
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rText: { color: '#fff', fontWeight: '700' },
});
