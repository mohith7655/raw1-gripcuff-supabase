import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { useUser } from '../providers/UserContext';
import { SCREEN_PADDING } from '../constants/theme';
import { AppTheme } from '../core/theme/app_theme';

const EARN_TASKS = [
  {
    id: 'upload-media',
    title: 'Upload a Photo or Video',
    description: 'Share your progress with the community',
    reward: 30,
    icon: '📷',
    actionText: '⬆ Upload',
    completed: false,
  },
  {
    id: 'watch-intro',
    title: 'Watch GripCuff Training Intro',
    description: 'Learn the basics of proper grip training technique',
    reward: 50,
    icon: '🎬',
    actionText: '▶ Watch',
    completed: false,
  },
  {
    id: 'favourite-exercise',
    title: 'Favourite an Exercise',
    description: 'Save your favorite exercise to your library',
    reward: 20,
    icon: '🩷',
    actionText: '✓ Completed',
    completed: true,
  },
];

const SAMPLE_TRANSACTIONS = [
  {
    id: '1',
    description: 'Watched GripCuff Training Intro',
    date: '2026-03-04',
    time: '2:30 PM',
    amount: 50,
  },
  {
    id: '2',
    description: 'Favourited an Exercise',
    date: '2026-03-03',
    time: '11:15 AM',
    amount: 20,
  },
];

export const CreditsScreen = () => {
  const navigation = useNavigation<any>();
  const { profile } = useUser();
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const currentBalance = profile?.credits ?? 5;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <ArrowLeft color="#ffffff" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Credits</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceContent}>
            <Text style={styles.balanceLabel}>Current Balance</Text>
            <Text style={styles.balanceAmount}>💎 {currentBalance} Credits</Text>
          </View>
          <TouchableOpacity
            style={styles.buyButton}
            onPress={() => setShowBuyModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.buyButtonText}>Buy Credits</Text>
          </TouchableOpacity>
        </View>

        {/* How Credits Work Button */}
        <TouchableOpacity
          style={styles.howItWorksButton}
          onPress={() => setShowHowItWorks(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.howItWorksText}>ℹ️ How do credits work?</Text>
        </TouchableOpacity>

        {/* Earn Credits Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earn Credits</Text>
          <Text style={styles.sectionSubtitle}>Complete tasks to earn free credits</Text>

          {EARN_TASKS.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <Text style={styles.taskIcon}>{task.icon}</Text>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskDescription}>{task.description}</Text>
                </View>
                <View style={styles.rewardBadge}>
                  <Text style={styles.rewardText}>+{task.reward}</Text>
                </View>
              </View>

              <View style={styles.taskFooter}>
                <TouchableOpacity
                  style={task.completed ? styles.completedButton : styles.actionButton}
                  activeOpacity={task.completed ? 1 : 0.8}
                >
                  <Text
                    style={task.completed ? styles.completedButtonText : styles.actionButtonText}
                  >
                    {task.actionText}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Transaction History Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          <View style={{ height: 16 }} />

          {SAMPLE_TRANSACTIONS.map((tx) => (
            <View key={tx.id} style={styles.transactionRow}>
              <View style={styles.dot} />
              <View style={styles.txDetails}>
                <Text style={styles.txDesc}>{tx.description}</Text>
                <Text style={styles.txDate}>
                  {tx.date} at {tx.time}
                </Text>
              </View>
              <Text style={styles.txAmount}>+{tx.amount}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* How Credits Work Modal */}
      <Modal
        visible={showHowItWorks}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowHowItWorks(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setShowHowItWorks(false)}
            />

            <View style={styles.hiwModalContent}>
              <View style={styles.hiwHeader}>
                <Text style={styles.hiwTitle}>Credit Economy Explained</Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.hiwScrollContent}>

                {/* SECTION 1: EARN CREDITS */}
                <View style={styles.hiwSection}>
                  <View style={[styles.hiwSectionHeader, { borderLeftColor: '#4CAF50' }]}>
                    <Text style={styles.hiwSectionTitle}>💎 EARN CREDITS</Text>
                  </View>
                  {[
                    { icon: '🎬', label: 'Watch GripCuff Training Intro', amount: '+50 credits' },
                    { icon: '🩷', label: 'Favourite an Exercise', amount: '+20 credits' },
                    { icon: '📷', label: 'Upload a Photo or Video', amount: '+30 credits' },
                    { icon: '👥', label: 'Refer a Friend', amount: '+100 credits' },
                    { icon: '✅', label: 'Complete a Workout', amount: '+10 credits' },
                  ].map((item, idx) => (
                    <View key={idx} style={styles.hiwRow}>
                      <View style={styles.hiwRowLeft}>
                        <Text style={styles.hiwIcon}>{item.icon}</Text>
                        <Text style={styles.hiwLabel}>{item.label}</Text>
                      </View>
                      <Text style={[styles.hiwAmount, { color: '#4CAF50' }]}>{item.amount}</Text>
                    </View>
                  ))}
                </View>

                {/* SECTION 3: CREDIT USAGE */}
                <View style={styles.hiwSection}>
                  <View style={[styles.hiwSectionHeader, { borderLeftColor: '#E53935' }]}>
                    <Text style={styles.hiwSectionTitle}>🔥 CREDIT USAGE</Text>
                  </View>
                  {[
                    { icon: '🎥', label: 'Watch Premium Video', amount: '5 credits' },
                    { icon: '👨‍💼', label: '1 Personal Coaching Session', amount: '50 credits' },
                    { icon: '📋', label: 'Access Workout Plan', amount: '10 credits' },
                    { icon: '🤖', label: 'AI Fitness Analysis', amount: '20 credits' },
                    { icon: '📞', label: 'Live Trainer Call (30 min)', amount: '100 credits' },
                  ].map((item, idx) => (
                    <View key={idx} style={styles.hiwRow}>
                      <View style={styles.hiwRowLeft}>
                        <Text style={styles.hiwIcon}>{item.icon}</Text>
                        <Text style={styles.hiwLabel}>{item.label}</Text>
                      </View>
                      <Text style={[styles.hiwAmount, { color: '#E53935' }]}>{item.amount}</Text>
                    </View>
                  ))}
                </View>

              </ScrollView>

              <View style={styles.hiwFooter}>
                <TouchableOpacity
                  style={styles.hiwBuyButton}
                  onPress={() => {
                    setShowHowItWorks(false);
                    setTimeout(() => setShowBuyModal(true), 300);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.hiwBuyButtonText}>Buy Credits</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.hiwCloseButton}
                  onPress={() => setShowHowItWorks(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.hiwCloseButtonText}>✕ Close</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Buy Credits Modal */}
      <Modal
        visible={showBuyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBuyModal(false)}
      >
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => setShowBuyModal(false)}
            />

            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Buy Credits</Text>
                <TouchableOpacity onPress={() => setShowBuyModal(false)}>
                  <Text style={styles.closeButton}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {[
                  { credits: 100, price: 1.99, perCredit: '0.02', popular: false },
                  { credits: 500, price: 7.99, perCredit: '0.016', popular: true },
                  { credits: 1200, price: 14.99, perCredit: '0.012', popular: false },
                  { credits: 2500, price: 24.99, perCredit: '0.010', popular: false },
                ].map((pkg, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.packageCard, pkg.popular && styles.packageCardPopular]}
                    activeOpacity={0.8}
                  >
                    {pkg.popular && (
                      <View style={styles.popularBadge}>
                        <Text style={styles.popularText}>Most Popular</Text>
                      </View>
                    )}
                    <Text style={styles.packageCredits}>💎 {pkg.credits} Credits</Text>
                    <Text style={styles.packagePrice}>${pkg.price}</Text>
                    <Text style={styles.packageCostPerCredit}>
                      ${pkg.perCredit}/credit
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppTheme.background,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 40,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },

  /* ── Balance Card ── */
  balanceCard: {
    backgroundColor: '#131f2e',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceContent: {
    flex: 1,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#888888',
    fontWeight: '500',
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  buyButton: {
    backgroundColor: '#D4622A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginLeft: 16,
  },
  buyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  howItWorksButton: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: -8, // pull closer to balance card
  },
  howItWorksText: {
    fontSize: 12,
    color: '#607a94',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },

  /* ── Section ── */
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 16,
  },

  /* ── Task Card ── */
  taskCard: {
    backgroundColor: '#131f2e',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  taskIcon: {
    fontSize: 24,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  taskDescription: {
    fontSize: 13,
    color: '#888888',
    lineHeight: 18,
  },
  rewardBadge: {
    backgroundColor: 'rgba(212, 98, 42, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D4622A',
  },
  rewardText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#D4622A',
  },
  taskFooter: {
    alignItems: 'flex-start',
  },
  actionButton: {
    backgroundColor: '#D4622A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  completedButton: {
    backgroundColor: '#1a4a2a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  completedButtonText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: 'bold',
  },

  /* ── Transaction History ── */
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 12,
  },
  txDetails: {
    flex: 1,
  },
  txDesc: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  txDate: {
    fontSize: 12,
    color: '#888888',
  },
  txAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },

  /* ── Buy Credits Modal ── */
  modalSafeArea: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0d1520',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    fontSize: 24,
    color: '#888888',
    fontWeight: 'bold',
  },
  packageCard: {
    backgroundColor: '#131f2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  packageCardPopular: {
    borderColor: '#D4622A',
    backgroundColor: 'rgba(212, 98, 42, 0.08)',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#D4622A',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  packageCredits: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#D4622A',
    marginBottom: 4,
  },
  packageCostPerCredit: {
    fontSize: 11,
    color: '#888888',
    fontWeight: '600',
  },

  /* ── How It Works Modal ── */
  hiwModalContent: {
    backgroundColor: '#131f2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    flex: 1, // Let it fill available space up to max height
  },
  hiwHeader: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  hiwTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  hiwScrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 16,
    paddingBottom: 24,
  },
  hiwSection: {
    marginBottom: 24,
  },
  hiwSectionHeader: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 12,
  },
  hiwSectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
  },
  hiwRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  hiwRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 10,
  },
  hiwIcon: {
    fontSize: 16,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  hiwLabel: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  hiwAmount: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  hiwFooter: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: '#131f2e',
  },
  hiwBuyButton: {
    backgroundColor: '#D4622A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  hiwBuyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hiwCloseButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  hiwCloseButtonText: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '600',
  },
});
