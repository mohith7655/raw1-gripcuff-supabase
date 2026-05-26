/**
 * SessionReminderService
 *
 * Schedules a local push notification that fires at the EXACT scheduled time
 * of a workout session.  Works for both self-scheduled and friend sessions.
 *
 * Features:
 *   • Fires at exact scheduled time with sound + vibration
 *   • Action buttons: Snooze (+5 min) and Dismiss
 *   • Persists sessionId → notificationId mapping via AsyncStorage so we can
 *     cancel or replace the notification when a session is cancelled/declined
 *   • Android MAX importance channel for lock-screen + heads-up display
 *
 * NOTE: Notification IDs are device-local; they are NOT stored in Supabase
 * because local notification IDs have no meaning on other devices.
 */

import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────────

export const SESSION_CHANNEL_ID  = 'workout-sessions';
export const SESSION_CATEGORY_ID = 'WORKOUT_REMINDER';

/** AsyncStorage key: JSON map of { [sessionId]: notificationId } */
const STORAGE_KEY = '@session_notification_ids';

// ─── Service ──────────────────────────────────────────────────────────────────

export class SessionReminderService {

  // ── Android notification channel (MAX importance) ─────────────────────────
  // Must be created before any notification on Android 8+.

  static async setupChannel(): Promise<void> {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(SESSION_CHANNEL_ID, {
      name: 'Workout Sessions',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
    });
    console.log('[SessionReminderService] Android channel set up');
  }

  // ── Notification categories (Snooze / Dismiss action buttons) ─────────────
  // Call once at app start (lib/main.tsx) so categories are ready before any
  // notification fires.

  static async setupCategories(): Promise<void> {
    if (Platform.OS === 'web') return;
    await Notifications.setNotificationCategoryAsync(SESSION_CATEGORY_ID, [
      {
        identifier: 'SNOOZE',
        buttonTitle: 'Snooze',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'DISMISS',
        buttonTitle: 'Dismiss',
        options: { isDestructive: true, opensAppToForeground: false },
      },
    ]);
    console.log('[SessionReminderService] notification categories registered');
  }

  // ── AsyncStorage: persist sessionId → notificationId ──────────────────────

  private static async saveNotificationId(sessionId: string, notificationId: string): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const map: Record<string, string> = raw ? JSON.parse(raw) : {};
      map[sessionId] = notificationId;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn('[SessionReminderService] saveNotificationId failed:', e);
    }
  }

  static async getNotificationId(sessionId: string): Promise<string | null> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const map: Record<string, string> = JSON.parse(raw);
      return map[sessionId] ?? null;
    } catch {
      return null;
    }
  }

  private static async removeNotificationId(sessionId: string): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const map: Record<string, string> = JSON.parse(raw);
      delete map[sessionId];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch {}
  }

  // ── Schedule a notification at the exact session start time ───────────────
  //
  // isSelf=true  → title: "Workout Time 💪"       body: "[title] starts now."
  // isSelf=false → title: "Workout Together Time 💪"  body: "Your workout with [friend] starts now."

  static async scheduleSessionReminder(params: {
    sessionId: string;
    videoTitle: string;
    /** Null for self sessions. For friend sessions: guest name (host view) or host name (guest view). */
    friendName?: string | null;
    scheduledAt: Date;
    isSelf: boolean;
  }): Promise<void> {
    if (Platform.OS === 'web') return;

    const { sessionId, videoTitle, friendName, scheduledAt, isSelf } = params;

    const secondsFromNow = Math.floor((scheduledAt.getTime() - Date.now()) / 1000);
    if (secondsFromNow < 5) {
      console.warn('[SessionReminderService] scheduledAt is too soon or in the past — skipping', {
        sessionId,
        secondsFromNow,
      });
      return;
    }

    // Cancel any previous reminder for this session (e.g. rescheduled)
    await SessionReminderService.cancelSessionReminder(sessionId);

    await SessionReminderService.setupChannel();

    const title = isSelf ? 'Workout Time 💪' : 'Workout Together Time 💪';
    const body  = isSelf
      ? `${videoTitle} starts now.`
      : `Your workout with ${friendName ?? 'a friend'} starts now.`;

    try {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          categoryIdentifier: SESSION_CATEGORY_ID,
          data: {
            type: 'session_reminder',
            sessionId,
            isSelf,
            videoTitle,
          },
          ...(Platform.OS === 'android' ? { channelId: SESSION_CHANNEL_ID } : {}),
        },
        trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsFromNow },
      });

      await SessionReminderService.saveNotificationId(sessionId, notificationId);

      console.log('[SessionReminderService] scheduled', {
        sessionId,
        notificationId,
        at: scheduledAt.toISOString(),
        isSelf,
        secondsFromNow,
      });
    } catch (e) {
      console.warn('[SessionReminderService] schedule failed:', e);
    }
  }

  // ── Cancel notification for a session (cancel / decline / reschedule) ──────

  static async cancelSessionReminder(sessionId: string): Promise<void> {
    if (Platform.OS === 'web') return;
    const notificationId = await SessionReminderService.getNotificationId(sessionId);
    if (!notificationId) return;

    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {}

    await SessionReminderService.removeNotificationId(sessionId);
    console.log('[SessionReminderService] cancelled', { sessionId, notificationId });
  }

  // ── Snooze: fire a reminder 5 minutes from now ────────────────────────────
  // Called from the notification response listener when user taps "Snooze".

  static async snooze(content: Notifications.NotificationContent): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Workout Reminder 💪',
          body: "Don't forget — your workout starts now!",
          sound: true,
          categoryIdentifier: SESSION_CATEGORY_ID,
          data: content.data ?? {},
          ...(Platform.OS === 'android' ? { channelId: SESSION_CHANNEL_ID } : {}),
        },
        trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 300 }, // +5 minutes
      });
      console.log('[SessionReminderService] snoozed +5 min');
    } catch (e) {
      console.warn('[SessionReminderService] snooze failed:', e);
    }
  }
}
