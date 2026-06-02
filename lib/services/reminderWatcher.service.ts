import { MoveReminderService, MoveReminder, AlarmConfig } from './moveReminder.service';
import { TimezoneService } from './timezone.service';
import { getUserTimeSlot, getUserDateKey } from '../utils/userDate';

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
  // For snooze support — the original slot key
  originalSlot?: string;
  reminderId?: string;
}

type AlarmCallback = (alarm: ForegroundAlarm) => void;

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

/** Add N minutes to a HH:MM string, wrapping at 24h. */
function addMinsToSlot(slot: string, mins: number): string {
  const [h, m] = slot.split(':').map(Number);
  const total = (h * 60 + m + mins) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
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

  // Per-alarm snooze overrides: key = `${reminderId}:${originalSlot}:${dateKey}`
  // value = new slot string to fire at instead (or 'skipped' to skip entirely today)
  private snoozeOverrides = new Map<string, string>();

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
    this.snoozeOverrides.clear();
    this.moveRemindersLoadedAt = 0;
    this.uid = null;
    this.onAlarm = null;
    this.initialized = false;
  }

  invalidateMoveCache() {
    this.moveRemindersLoadedAt = 0;
  }

  /**
   * Snooze a specific alarm for today.
   * minutesFromNow = 0  → skip today entirely
   * minutesFromNow > 0  → fire that many minutes later today
   */
  snoozeAlarm(reminderId: string, originalSlot: string, minutesFromNow: number, dateKey: string) {
    const key = `${reminderId}:${originalSlot}:${dateKey}`;
    if (minutesFromNow === 0) {
      this.snoozeOverrides.set(key, 'skipped');
      // Also mark the original slot as fired so it doesn't double-fire
      this.moveFiredSlots.add(`movereminder:${reminderId}:${dateKey}:${originalSlot}`);
    } else {
      const newSlot = addMinsToSlot(originalSlot, minutesFromNow);
      this.snoozeOverrides.set(key, newSlot);
      // Mark original as fired so it won't re-fire
      this.moveFiredSlots.add(`movereminder:${reminderId}:${dateKey}:${originalSlot}`);
    }
  }

  testFireAlarm(message = 'Test reminder — system working! 🔥') {
    if (!this.onAlarm || !this.uid) {
      console.warn('[MoveReminder] testFireAlarm: watcher not running');
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
      recurrenceLabel: 'Reminder to Move',
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

    const enabledReminders = this.moveReminders.filter(r => r.enabled);
    if (enabledReminders.length === 0) return;

    const currentSlot = getUserTimeSlot(this.timezone, nowDate);
    const dateKey = getUserDateKey(this.timezone, nowDate);

    for (const reminder of enabledReminders) {
      // Use alarmConfigs if available; fall back to generatedTimes (all enabled)
      const configs: AlarmConfig[] = reminder.alarmConfigs?.length
        ? reminder.alarmConfigs
        : (reminder.generatedTimes ?? []).map(t => ({ time: t, enabled: true }));

      for (const cfg of configs) {
        if (!cfg.enabled) continue;

        // Determine the effective fire slot (may be snoozed to a different time)
        const snoozeKey = `${reminder.id ?? 'default'}:${cfg.time}:${dateKey}`;
        const snoozeOverride = this.snoozeOverrides.get(snoozeKey);
        if (snoozeOverride === 'skipped') continue;

        const effectiveSlot = snoozeOverride ?? cfg.time;
        if (effectiveSlot !== currentSlot) continue;

        // Use original slot in fire-key so snooze doesn't re-fire the original
        const fireKey = `movereminder:${reminder.id ?? 'default'}:${dateKey}:${cfg.time}`;
        // For snoozed slots, use a distinct fire-key
        const snoozedFireKey = snoozeOverride
          ? `movereminder:${reminder.id ?? 'default'}:${dateKey}:${cfg.time}:snoozed`
          : fireKey;

        if (this.moveFiredSlots.has(snoozeOverride ? snoozedFireKey : fireKey)) continue;
        this.moveFiredSlots.add(snoozeOverride ? snoozedFireKey : fireKey);

        this.onAlarm!({
          source: 'dailyReminder',
          id: `movereminder:${reminder.id ?? 'default'}:${dateKey}:${cfg.time}`,
          userId: this.uid!,
          workoutId: '',
          videoId: '',
          workoutTitle: pickMoveMessage(),
          thumbnail: null,
          scheduledAt: nowDate,
          recurrenceLabel: 'Reminder to Move',
          isStartTime: true,
          originalSlot: cfg.time,
          reminderId: reminder.id ?? 'default',
        });
      }
    }
  }
}

export const reminderWatcherService = new ReminderWatcherService();
