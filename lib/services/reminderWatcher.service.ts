import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../core/config/firebase';
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
  // true = exact workout start time popup (sound + vibration)
  // false = early reminder popup (silent)
  isStartTime: boolean;
}

type AlarmCallback = (alarm: ForegroundAlarm) => void;

function asDate(value: any): Date | null {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function localTimeStr(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function buildRecurringLabel(data: any): string | undefined {
  const mode = data?.recurrence?.mode;
  if (mode === 'daily') return 'Daily';
  if (mode === 'weekdays') return 'Weekdays';
  const intervalValue = Number(data?.recurrence?.intervalValue ?? data?.intervalValue ?? 0);
  const intervalUnit = String(data?.recurrence?.intervalUnit ?? data?.intervalUnit ?? 'minutes');
  if (intervalValue > 0) return `Every ${intervalValue} ${intervalUnit}`;
  return undefined;
}

function computeNextRecurringTime(data: any, current: Date): Date | null {
  const mode = data?.recurrence?.mode ?? 'custom_interval';
  if (mode === 'daily') return new Date(current.getTime() + 24 * 60 * 60 * 1000);
  if (mode === 'weekdays') {
    let next = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    while (next.getDay() === 0 || next.getDay() === 6) {
      next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
    }
    return next;
  }
  const unit = String(data?.recurrence?.intervalUnit ?? data?.intervalUnit ?? 'minutes');
  const value = Number(data?.recurrence?.intervalValue ?? data?.intervalValue ?? 0);
  const minutes = unit === 'hours' ? value * 60 : value;
  if (!minutes || minutes <= 0) return null;
  return new Date(current.getTime() + minutes * 60 * 1000);
}

let tickCount = 0;

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
  private remindersUnsub: (() => void) | null = null;
  private recurringUnsub: (() => void) | null = null;
  private dueCheckTimer: ReturnType<typeof setInterval> | null = null;
  private workoutDocs: Array<{ id: string; data: any }> = [];
  private recurringDocs: Array<{ id: string; data: any }> = [];
  private firedKeys = new Set<string>();

  // User timezone (IANA string) — loaded async on start(), defaults to device TZ
  private timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Move reminder state
  private moveReminders: MoveReminder[] = [];
  private moveRemindersLoadedAt = 0;
  // Tracks which HH:MM slots have already fired today (keyed by YYYY-MM-DD:HH:MM)
  private moveFiredSlots = new Set<string>();

  /** True while the 1-second clock loop is active. Used by App.tsx to avoid
   *  stopping/restarting the clock unnecessarily on tab switches or re-renders. */
  get isRunning(): boolean {
    return this.initialized && this.dueCheckTimer !== null;
  }

  start(uid: string, onAlarm: AlarmCallback) {
    this.stop();
    this.uid = uid;
    this.onAlarm = onAlarm;
    this.initialized = true;
    tickCount = 0;
    console.log('[MoveReminder] ── SERVICE STARTED ──', { uid });

    // Load user timezone asynchronously; ticks use this.timezone which defaults to device TZ
    TimezoneService.getForUser(uid).then(tz => {
      this.timezone = tz;
      console.log('[MoveReminder] timezone loaded:', tz);
    }).catch(() => {});

    // ── Snapshot: one-time scheduled workouts ────────────────────────────────
    const workoutQuery = query(
      collection(db, 'scheduledWorkouts'),
      where('userId', '==', uid),
      where('status', 'in', ['scheduled', 'active'])
    );
    this.remindersUnsub = onSnapshot(
      workoutQuery,
      (snap) => {
        this.workoutDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        console.log('[MoveReminder] scheduledWorkouts loaded', {
          count: this.workoutDocs.length,
          docs: this.workoutDocs.map((w) => ({
            id: w.id,
            reminderScheduledFor: asDate(w.data.reminderScheduledFor)
              ? localTimeStr(asDate(w.data.reminderScheduledFor)!)
              : 'none',
            scheduledAt: asDate(w.data.scheduledAt)
              ? localTimeStr(asDate(w.data.scheduledAt)!)
              : 'none',
            reminderSent: w.data.reminderSent,
            startPopupShown: w.data.startPopupShown,
          })),
        });
      },
      (err) => {
        console.error(
          '[MoveReminder] scheduledWorkouts snapshot ERROR — add composite index (userId ASC + status ASC) in Firebase Console:',
          err.message
        );
      }
    );

    // ── Snapshot: recurring reminders ────────────────────────────────────────
    const recurringQuery = query(
      collection(db, 'reminders'),
      where('userId', '==', uid),
      where('status', '==', 'active')
    );
    this.recurringUnsub = onSnapshot(
      recurringQuery,
      (snap) => {
        this.recurringDocs = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
        console.log('[MoveReminder] recurring reminders loaded', {
          count: this.recurringDocs.length,
          ids: this.recurringDocs.map((r) => r.id),
        });
      },
      (err) => {
        console.error('[MoveReminder] reminders snapshot ERROR:', err.message);
      }
    );

    // ── Real-time device-clock loop (1 second) ───────────────────────────────
    this.dueCheckTimer = setInterval(() => {
      this.checkDueReminders().catch((err) => {
        console.warn('[MoveReminder] tick error:', err?.message ?? err);
      });
    }, 1000);

    console.log('[MoveReminder] real-time 1-second loop started');
  }

  stop() {
    if (this.remindersUnsub) this.remindersUnsub();
    if (this.recurringUnsub) this.recurringUnsub();
    if (this.dueCheckTimer) clearInterval(this.dueCheckTimer);
    this.remindersUnsub = null;
    this.recurringUnsub = null;
    this.dueCheckTimer = null;
    this.workoutDocs = [];
    this.recurringDocs = [];
    this.firedKeys.clear();
    this.moveFiredSlots.clear();
    this.moveReminders = [];
    this.moveRemindersLoadedAt = 0;
    this.uid = null;
    this.onAlarm = null;
    this.initialized = false;
    console.log('[MoveReminder] ── SERVICE STOPPED ──');
  }

  /** Force the next tick to reload move reminders from Firestore.
   *  Call this whenever the user saves or toggles a reminder so the
   *  clock picks up the change immediately instead of waiting up to 5 minutes. */
  invalidateMoveCache() {
    this.moveRemindersLoadedAt = 0;
    console.log('[MoveReminder] reminder cache invalidated — will reload on next tick');
  }

  /** Immediately fire a test alarm popup. Useful for verifying the full
   *  foreground notification pipeline without waiting for a scheduled time. */
  testFireAlarm(message = 'Test reminder — system working! 🔥') {
    if (!this.onAlarm || !this.uid) {
      console.warn('[MoveReminder] testFireAlarm: watcher not running (no uid or callback)');
      return;
    }
    const now = new Date();
    console.log('[MoveReminder] 🧪 TEST ALARM fired', { message, deviceTime: localTimeStr(now) });
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

  /**
   * Force-reload user timezone and update this.timezone.
   * Call this from ProfileScreen after the user changes their workout location.
   */
  async reloadTimezone(): Promise<void> {
    if (!this.uid) return;
    TimezoneService.invalidateCache(this.uid);
    const tz = await TimezoneService.getForUser(this.uid);
    this.timezone = tz;
    console.log('[MoveReminder] timezone reloaded:', tz);
  }

  /** Reload move reminders from Firestore (cached for 5 minutes). */
  private async reloadMoveReminders() {
    if (!this.uid) return;
    const now = Date.now();
    // Also refresh timezone every 5 minutes so location changes propagate without restart
    if (this.moveRemindersLoadedAt > 0 && now - this.moveRemindersLoadedAt < 5 * 60 * 1000) return;
    // Reload timezone alongside reminders
    TimezoneService.getForUser(this.uid).then(tz => {
      if (tz !== this.timezone) {
        console.log('[MoveReminder] timezone updated on reload:', this.timezone, '→', tz);
        this.timezone = tz;
      }
    }).catch(() => {});
    try {
      this.moveReminders = await MoveReminderService.loadAll(this.uid);
      this.moveRemindersLoadedAt = now;
      const enabled = this.moveReminders.filter(r => r.enabled);
      console.log('[MoveReminder] reminders loaded', {
        total: this.moveReminders.length,
        enabled: enabled.length,
        times: enabled.flatMap(r => r.generatedTimes),
      });
    } catch (e) {
      console.warn('[MoveReminder] failed to load reminders:', e);
    }
  }

  private async checkDueReminders() {
    if (!this.initialized || !this.uid || !this.onAlarm) return;

    // LOCAL device clock — never UTC
    const nowMs = Date.now();
    const nowDate = new Date(nowMs);
    tickCount++;
    const isVerboseTick = tickCount % 10 === 1;  // full detail every 10 sec
    const isHeartbeat   = tickCount % 60 === 0;  // heartbeat every 60 sec

    const totalDocs = this.workoutDocs.length + this.recurringDocs.length;

    if (isHeartbeat) {
      console.log(
        `[MoveReminder] ♥ ALIVE tick #${tickCount} | ${localTimeStr(nowDate)} | ${totalDocs} reminder(s) active`
      );
    } else if (isVerboseTick) {
      console.log(
        `[MoveReminder] tick #${tickCount} | device time: ${localTimeStr(nowDate)} | watching ${totalDocs} reminder(s) (${this.workoutDocs.length} scheduled, ${this.recurringDocs.length} recurring)`
      );
    }

    // ── One-time scheduled workouts: TWO independent triggers ────────────────
    //
    // TRIGGER A — Early reminder popup (silent, no sound/vibration)
    //   Fires at: reminderScheduledFor = scheduledAt - leadMinutes
    //   Guard:    reminderSent !== true
    //   After:    sets reminderSent=true ONLY — status stays 'scheduled'
    //             so the doc stays in the snapshot for Trigger B
    //
    // TRIGGER B — Exact workout start popup (sound + vibration + 10s dismiss lock)
    //   Fires at: scheduledAt (exact workout start time)
    //   Guard:    startPopupShown !== true
    //   After:    sets startPopupShown=true + status='triggered'
    //             doc leaves snapshot — no more triggers
    //
    for (const item of this.workoutDocs) {
      const data = item.data;

      const scheduledAt = asDate(data.scheduledAt) ?? asDate(data.scheduledFor);
      const reminderTime = asDate(data.reminderScheduledFor);

      const baseAlarm = {
        source: 'scheduledWorkout' as const,
        id: item.id,
        userId: String(data.userId || this.uid),
        workoutId: String(data.workoutId || data.videoId || ''),
        videoId: String(data.videoId || data.workoutId || ''),
        workoutTitle: String(data.videoTitle || data.workoutName || 'Workout'),
        thumbnail: data.thumbnail ?? null,
      };

      // ── TRIGGER A: early reminder (silent) ──────────────────────────────────
      if (data.reminderSent !== true && reminderTime) {
        const msUntilReminder = reminderTime.getTime() - nowMs;
        const msUntilWorkout = scheduledAt ? scheduledAt.getTime() - nowMs : Infinity;

        if (isVerboseTick) {
          console.log(
            `[MoveReminder]   [A] ${item.id} | reminderTime=${localTimeStr(reminderTime)} | msUntilReminder=${msUntilReminder} | msUntilWorkout=${msUntilWorkout}`
          );
        }

        if (msUntilReminder <= 0 && msUntilWorkout > 0) {
          const fireKey = `reminder:${item.id}:${reminderTime.getTime()}`;
          if (!this.firedKeys.has(fireKey)) {
            this.firedKeys.add(fireKey);

            console.log('[MoveReminder] ✅ REMINDER TRIGGER A fired (early/silent)', {
              id: item.id,
              deviceTime: localTimeStr(nowDate),
              reminderTime: localTimeStr(reminderTime),
              workoutAt: scheduledAt ? localTimeStr(scheduledAt) : 'unknown',
              msOverdue: Math.abs(msUntilReminder),
              workout: data.videoTitle || data.workoutName,
            });

            await updateDoc(doc(db, 'scheduledWorkouts', item.id), {
              reminderSent: true,
              updatedAt: serverTimestamp(),
            }).catch((err) => {
              console.warn('[MoveReminder] Trigger A mark-sent failed:', err?.message ?? err);
            });

            this.onAlarm({
              ...baseAlarm,
              scheduledAt: scheduledAt ?? reminderTime,
              isStartTime: false,
            });
            console.log('[MoveReminder] 🔔 popup opened (early reminder, silent)', { id: item.id });
          }
        }
      }

      // ── TRIGGER B: exact workout start (sound + vibration) ──────────────────
      if (data.startPopupShown !== true && scheduledAt) {
        const msUntilStart = scheduledAt.getTime() - nowMs;

        if (isVerboseTick) {
          console.log(
            `[MoveReminder]   [B] ${item.id} | scheduledAt=${localTimeStr(scheduledAt)} | msUntilStart=${msUntilStart}`
          );
        }

        if (msUntilStart <= 0) {
          const fireKey = `start:${item.id}:${scheduledAt.getTime()}`;
          if (!this.firedKeys.has(fireKey)) {
            this.firedKeys.add(fireKey);

            console.log('[MoveReminder] ✅ REMINDER TRIGGER B fired (exact start time)', {
              id: item.id,
              deviceTime: localTimeStr(nowDate),
              scheduledAt: localTimeStr(scheduledAt),
              msOverdue: Math.abs(msUntilStart),
              workout: data.videoTitle || data.workoutName,
            });

            await updateDoc(doc(db, 'scheduledWorkouts', item.id), {
              startPopupShown: true,
              reminderSent: true,
              notificationSent: true,
              status: 'triggered',
              triggeredAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch((err) => {
              console.warn('[MoveReminder] Trigger B mark-triggered failed (will still show popup):', err?.message ?? err);
            });

            this.onAlarm({
              ...baseAlarm,
              scheduledAt,
              isStartTime: true,
            });
            console.log('[MoveReminder] 🔔 popup opened (exact start, sound+vibration)', { id: item.id });
          }
        }
      }

      if (isVerboseTick && !reminderTime && !scheduledAt) {
        console.warn(`[MoveReminder]   skip ${item.id} — no time fields found`, Object.keys(data));
      }
    }

    // ── Recurring reminders (always exact-time, always loud) ─────────────────
    for (const item of this.recurringDocs) {
      const data = item.data;
      const triggerTime = asDate(data.nextTriggerAt);

      if (!triggerTime) {
        if (isVerboseTick) {
          console.warn(`[MoveReminder]   recurring skip ${item.id} — no nextTriggerAt`);
        }
        continue;
      }

      const msRemaining = triggerTime.getTime() - nowMs;

      if (isVerboseTick) {
        console.log(
          `[MoveReminder]   recurring ${item.id} | nextTriggerAt=${localTimeStr(triggerTime)} | msRemaining=${msRemaining}`
        );
      }

      if (msRemaining > 0) continue;

      const fireKey = `recurring:${item.id}:${triggerTime.getTime()}`;
      if (this.firedKeys.has(fireKey)) continue;
      this.firedKeys.add(fireKey);

      console.log('[MoveReminder] ✅ REMINDER MATCHED (recurring)', {
        id: item.id,
        deviceTime: localTimeStr(nowDate),
        triggerTime: localTimeStr(triggerTime),
        msOverdue: Math.abs(msRemaining),
      });

      const alarm: ForegroundAlarm = {
        source: 'recurringReminder',
        id: item.id,
        userId: String(data.userId || this.uid),
        workoutId: String(data.workoutId || data.videoId || ''),
        videoId: String(data.videoId || data.workoutId || ''),
        workoutTitle: String(data.workoutTitle || data.videoTitle || 'Workout'),
        thumbnail: data.thumbnail ?? null,
        scheduledAt: triggerTime,
        recurrenceLabel: buildRecurringLabel(data),
        isStartTime: true,
      };

      const nextTriggerAt = computeNextRecurringTime(data, triggerTime);
      const updatePayload: any = {
        lastTriggeredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (nextTriggerAt) {
        updatePayload.nextTriggerAt = Timestamp.fromDate(nextTriggerAt);
        console.log('[MoveReminder] recurring rescheduled to', localTimeStr(nextTriggerAt));
      }

      await updateDoc(doc(db, 'reminders', item.id), updatePayload).catch((err) => {
        console.warn('[MoveReminder] recurring reschedule failed:', err?.message ?? err);
      });

      this.onAlarm(alarm);
      console.log('[MoveReminder] 🔔 popup opened (recurring)', { id: item.id, title: alarm.workoutTitle });
    }

    // ── Move reminder schedule ────────────────────────────────────────────────
    // Reload every ~5 min. Check if current HH:MM matches any slot in any enabled reminder.
    await this.reloadMoveReminders();
    const enabledReminders = this.moveReminders.filter(r => r.enabled && r.generatedTimes.length > 0);
    if (enabledReminders.length > 0) {
      const currentSlot = getUserTimeSlot(this.timezone, nowDate);
      const dateKey = getUserDateKey(this.timezone, nowDate);
      if (isVerboseTick) {
        console.log(`[MoveReminder]   [Timezone] ${this.timezone} | userLocal: ${getUserLocalString(this.timezone, nowDate)}`);
        const allSlots = enabledReminders.flatMap(r => r.generatedTimes);
        console.log(`[MoveReminder]   move reminder check | slot=${currentSlot} | times=${allSlots.join(', ')}`);
      }

      for (const reminder of enabledReminders) {
        for (const slot of reminder.generatedTimes) {
          if (slot !== currentSlot) continue;
          const fireKey = `movereminder:${reminder.id ?? 'default'}:${dateKey}:${slot}`;
          if (this.moveFiredSlots.has(fireKey)) continue;
          this.moveFiredSlots.add(fireKey);

          const message = pickMoveMessage();
          console.log('[MoveReminder] ✅ REMINDER TO MOVE fired', {
            slot,
            reminderId: reminder.id,
            deviceTime: localTimeStr(nowDate),
            message,
          });

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
          console.log('[MoveReminder] 🔔 popup opened (reminder to move)', { slot, message });
        }
      }
    }
  }
}

export const reminderWatcherService = new ReminderWatcherService();
