import React, { useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ── Gripcuff membership comparison (Excel-style: frozen feature column + frozen
//    tier header; tier columns scroll horizontally, benefits build to the right).
const CMP_TIERS = [
  { name: 'STARTER',    price: 'Free', color: '#7dd3fc' },
  { name: 'LIFTER',     price: 'Paid', color: '#1d4ed8' },
  { name: 'TRAINER',    price: 'Paid', color: '#F25912' },
  { name: 'INFLUENCER', price: 'Paid', color: '#F25912' },
];
type CmpRow = { section: string } | { label: string; cells: boolean[] };
// Cells align to CMP_TIERS order. Earning starts at Lifter (referral rewards)
// and climbs to Influencer brand partnerships.
const CMP_ROWS: CmpRow[] = [
  { section: 'Training & Content' },
  { label: 'Intro video',           cells: [true,  true,  true,  true ] },
  { label: 'Full video library',    cells: [false, true,  true,  true ] },
  { label: 'Structured programs',   cells: [false, true,  true,  true ] },
  { label: 'Live workout sessions', cells: [false, true,  true,  true ] },
  { label: 'Progress tracking',     cells: [true,  true,  true,  true ] },
  { label: 'Advanced analytics',    cells: [false, true,  true,  true ] },
  { label: 'Community access',      cells: [true,  true,  true,  true ] },
  { section: 'Creator Tools' },
  { label: 'Upload your videos',    cells: [false, false, true,  true ] },
  { label: 'Client management',     cells: [false, false, true,  true ] },
  { label: 'Creator profile badge', cells: [false, false, true,  true ] },
  { label: 'Featured on homepage',  cells: [false, false, false, true ] },
  { label: 'Custom profile banner', cells: [false, false, false, true ] },
  { label: 'Priority support',      cells: [false, false, false, true ] },
  { section: 'Earn Money' },
  { label: 'Referral rewards',      cells: [false, true,  true,  true ] },
  { label: 'Revenue share',         cells: [false, false, true,  true ] },
  { label: 'Affiliate commission',  cells: [false, false, false, true ] },
  { label: 'Brand partnerships',    cells: [false, false, false, true ] },
];
const CMP_LEFT_W = 150;
const CMP_COL_W  = 96;
const CMP_ROW_H  = 44;
const CMP_SEC_H  = 34;
const CMP_HEAD_H = 62;
const CMP_WIN_H  = Dimensions.get('window').height;

/**
 * Gripcuff membership comparison modal — the "Upgrade" tiers table shared by the
 * Home screen profile card and the Social profile page.
 */
export function GripcuffTiersModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const cmpHeaderRef = useRef<ScrollView>(null);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#EEEEF2', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingBottom: 36, maxHeight: '88%' }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingHorizontal: 20 }}>
            <View>
              <Text style={{ color: '#211832', fontSize: 20, fontWeight: '800' }}>Gripcuff Memberships</Text>
              <Text style={{ color: '#7A7C90', fontSize: 12, marginTop: 2 }}>Scroll to compare tiers →</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close-circle" size={28} color="#444" />
            </TouchableOpacity>
          </View>

          {/* Excel-style comparison — frozen feature column + frozen tier
              header; the tier columns scroll horizontally. */}
          <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
            <View style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(33,24,50,0.10)', overflow: 'hidden', backgroundColor: '#FFFFFF' }}>
              {/* Frozen top: corner + horizontally-synced tier header */}
              <View style={{ flexDirection: 'row' }}>
                <View style={{ width: CMP_LEFT_W, height: CMP_HEAD_H, justifyContent: 'flex-end', paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#F8F8FC', borderRightWidth: 1, borderRightColor: 'rgba(33,24,50,0.12)' }}>
                  <Text style={{ color: '#7A7C90', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 }}>What you get</Text>
                </View>
                <ScrollView ref={cmpHeaderRef} horizontal scrollEnabled={false} showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                  {CMP_TIERS.map(t => (
                    <View key={t.name} style={{ width: CMP_COL_W, height: CMP_HEAD_H, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F8FC', borderLeftWidth: 1, borderLeftColor: 'rgba(33,24,50,0.06)' }}>
                      <View style={{ backgroundColor: t.color, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 }}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>{t.name}</Text>
                      </View>
                      <Text style={{ color: '#7A7C90', fontSize: 10, fontWeight: '700', marginTop: 5 }}>{t.price}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Body: vertical scroll; left labels frozen, cells scroll horizontally */}
              <ScrollView style={{ maxHeight: CMP_WIN_H * 0.44 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                <View style={{ flexDirection: 'row' }}>
                  {/* Frozen left feature column */}
                  <View style={{ width: CMP_LEFT_W }}>
                    {CMP_ROWS.map((r, i) => (
                      'section' in r ? (
                        <View key={i} style={{ height: CMP_SEC_H, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#E7E7F0', borderRightWidth: 1, borderRightColor: 'rgba(33,24,50,0.12)' }}>
                          <Text style={{ color: '#4C4E78', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{r.section}</Text>
                        </View>
                      ) : (
                        <View key={i} style={{ height: CMP_ROW_H, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#F8F8FC', borderTopWidth: 1, borderTopColor: 'rgba(33,24,50,0.06)', borderRightWidth: 1, borderRightColor: 'rgba(33,24,50,0.12)' }}>
                          <Text numberOfLines={2} style={{ color: '#211832', fontSize: 12.5, fontWeight: '600' }}>{r.label}</Text>
                        </View>
                      )
                    ))}
                  </View>

                  {/* Scrollable tier cells (drives the header scroll) */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    scrollEventThrottle={16}
                    style={{ flex: 1 }}
                    onScroll={e => cmpHeaderRef.current?.scrollTo({ x: e.nativeEvent.contentOffset.x, animated: false })}
                  >
                    <View>
                      {CMP_ROWS.map((r, i) => (
                        'section' in r ? (
                          <View key={i} style={{ width: CMP_COL_W * CMP_TIERS.length, height: CMP_SEC_H, backgroundColor: '#E7E7F0' }} />
                        ) : (
                          <View key={i} style={{ flexDirection: 'row' }}>
                            {r.cells.map((on, ci) => (
                              <View
                                key={ci}
                                style={[
                                  { width: CMP_COL_W, height: CMP_ROW_H, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: 'rgba(33,24,50,0.06)', borderLeftWidth: 1, borderLeftColor: 'rgba(33,24,50,0.06)' },
                                  ci === CMP_TIERS.length - 1 && { backgroundColor: 'rgba(242,89,18,0.06)' },
                                ]}
                              >
                                {on
                                  ? <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
                                  : <Text style={{ color: '#C4C6D4', fontSize: 16, fontWeight: '700' }}>–</Text>}
                              </View>
                            ))}
                          </View>
                        )
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </ScrollView>
            </View>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={{ backgroundColor: '#F25912', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginHorizontal: 20 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Got It</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
