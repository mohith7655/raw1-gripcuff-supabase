import { MoveReminderService, MoveReminder } from './moveReminder.service';
import { TimezoneService } from './timezone.service';
import { getUserTimeSlot, getUserDateKey, getUserLocalString } from '../utils/userDate';

export type AlarmSource = 'scheduledWorkout' | 'recurringReminder' | 'dailyReminder';

export interface ForegroundAlarm {
  source: AlarmSource;
  id: string;
  userId: string;
  workoutId: string;
  videoId: string;
  workoutTitle: string;
  thumbnail?: string | null;
  scheduledAt: Date;
  recurrenceLabel?: string;
  isStartTime: boolean;
}

type AlarmCallback = (alarm: ForegroundAlarm) => void;

function localTimeStr(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

const MOVE_REMINDER_MESSAGES = [
  'Time to move 💪',
  'Quick movement break — let\'s go! 🔥',
  'Stay active and keep your streak alive 🏃',
  'Let\'s move for a few minutes ⚡',
  'Your body needs movement. Time to go! 💥',
  'Small steps, big gains. Move now! 🎯',
  'Champions stay consistent. Your turn! 🏆',
  'No excuses — a few minutes is all it takes! 🔥',
];

function pickMoveMessage(): string {
  return MOVE_REMINDER_MESSAGES[Math.floor(Math.random() * MOVE_REMINDER_MESSAGES.length)];
}

class ReminderWatcherService {
  private initialized = false;
  private uid: string | null = null;
  private onAlarm: AlarmCallback | null = null;
  private dueCheckTimer: ReturnType<typeof setInterval> | null = null;
  private moveReminders: MoveReminder[] = [];
  private moveRemindersLoadedAt = 0;
  private moveFiredSlots = new Set<string>();
  private timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone;

  get isRunning(): boolean {
    return this.initialized && this.dueCheckTimer !== null;
  }

  start(uid: string, onAlarm: AlarmCallback) {
    this.stop();
    this.uid = uid;
    this.onAlarm = onAlarm;
    this.initialized = true;

    TimezoneService.getForUser(uid).then(tz => {
      this.timezone = tz;
    }).catch(() => {});

    this.dueCheckTimer = setInterval(() => {
      this.checkDueReminders().catch((err) => {
        console.warn('[MoveReminder] tick error:', err?.message ?? err);
      });
    }, 1000);
  }

  stop() {
    if (this.dueCheckTimer) clearInterval(this.dueCheckTimer);
    this.dueCheckTimer = null;
    this.moveReminders = [];
    this.moveFiredSlots.clear();
    this.moveRemindersLoadedAt = 0;
    this.uid = null;
    this.onAlarm = null;
    this.initialized = false;
  }

  invalidateMoveCache() {
    this.moveRemindersLoadedAt = 0;
  }

  testFireAlarm(message = 'Test reminder — system working! 🔥') {
    if (!this.onAlarm || !this.uid) {
      console.warn('[MoveReminder] testFireAlarm: watcher not running (no uid or callback)');
      return;
    }
    const now = new Date();
    this.onAlarm({
      source: 'dailyReminder',
      id: `test:${now.getTime()}`,
      userId: this.uid,
      workoutId: '',
      videoId: '',
      workoutTitle: message,
      thumbnail: null,
      scheduledAt: now,
      recurrenceLabel: 'Test Reminder',
      isStartTime: true,
    });
  }

  async reloadTimezone(): Promise<void> {
    if (!this.uid) return;
    TimezoneService.invalidateCache(this.uid);
    const tz = await TimezoneService.getForUser(this.uid);
    this.timezone = tz;
  }

  private async reloadMoveReminders() {
    if (!this.uid) return;
    const now = Date.now();
    if (this.moveRemindersLoadedAt > 0 && now - this.moveRemindersLoadedAt < 5 * 60 * 1000) return;
    TimezoneService.getForUser(this.uid).then(tz => {
      this.timezone = tz;
    }).catch(() => {});
    try {
      this.moveReminders = await MoveReminderService.loadAll(this.uid);
      this.moveRemindersLoadedAt = now;
    } catch (e) {
      console.warn('[MoveReminder] failed to load reminders:', e);
    }
  }

  private async checkDueReminders() {
    if (!this.initialized || !this.uid || !this.onAlarm) return;

    const nowMs = Date.now();
    const nowDate = new Date(nowMs);

    await this.reloadMoveReminders();
    const enabledReminders = this.moveReminders.filter(r => r.enabled && r.generatedTimes.length > 0);
    if (enabledReminders.length > 0) {
      const currentSlot = getUserTimeSlot(this.timezone, nowDate);
      const dateKey = getUserDateKey(this.timezone, nowDate);

      for (const reminder of enabledReminders) {
        for (const slot of reminder.generatedTimes) {
          if (slot !== currentSlot) continue;
          const fireKey = `movereminder:${reminder.id ?? 'default'}:${dateKey}:${slot}`;
          if (this.moveFiredSlots.has(fireKey)) continue;
          this.moveFiredSlots.add(fireKey);

          const message = pickMoveMessage();

          this.onAlarm!({
            source: 'dailyReminder',
            id: `movereminder:${reminder.id ?? 'default'}:${dateKey}:${slot}`,
            userId: this.uid!,
            workoutId: '',
            videoId: '',
            workoutTitle: message,
            thumbnail: null,
            scheduledAt: nowDate,
            recurrenceLabel: 'Reminder to Move',
            isStartTime: true,
          });
        }
      }
    }
  }
}

export const reminderWatcherService = new ReminderWatcherService();
