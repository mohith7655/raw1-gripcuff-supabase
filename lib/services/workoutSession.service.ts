/**
 * WorkoutSessionService
 *
 * Thin adapter that delegates all persistence to ScheduledSessionService.
 * The context and hooks call these methods; the service is responsible for
 * writing to Supabase (scheduled_sessions + scheduled_session_invites) and
 * sending notifications.
 */

import { WorkoutSession } from '../models/WorkoutSession';
import { ScheduledSessionService } from './scheduledSession.service';
import { NotificationService } from './notification.service';

export class WorkoutSessionService {
  /**
   * Creates a new scheduled workout session and sends an invite notification
   * to the guest.  Returns the new session ID.
   */
  static async createSession(
    hostUid: string,
    hostName: string,
    hostAvatarUrl: string | undefined,
    guestUid: string,
    guestName: string,
    guestAvatarUrl: string | undefined,
    videoId: string,
    videoTitle: string,
    scheduledAt: Date,
    _betCredits: number,
    extras?: {
      inviteType?: 'instant' | 'scheduled';
      category?: string;
      programName?: string;
      thumbnail?: string;
    }
  ): Promise<string> {
    console.log('[WorkoutSessionService] createSession', { hostUid, guestUid, videoId, scheduledAt });

    return ScheduledSessionService.create({
      hostUid,
      hostName,
      hostAvatarUrl,
      guestUid,
      guestName,
      guestAvatarUrl,
      videoId,
      videoTitle,
      scheduledAt,
      thumbnail:   extras?.thumbnail,
      category:    extras?.category,
      programName: extras?.programName,
    });
  }

  /**
   * Fetches ALL sessions where the user is host or guest.
   * Delegates to ScheduledSessionService which queries the real DB.
   */
  static async getAllUserSessions(uid: string): Promise<WorkoutSession[]> {
    return ScheduledSessionService.getAllForUser(uid);
  }

  /**
   * Accepts a pending invite: updates invite row to 'accepted',
   * marks the notification as read.
   */
  static async acceptSession(sessionId: string, uid: string): Promise<void> {
    await ScheduledSessionService.acceptInvite(sessionId, uid);
  }

  /**
   * Declines a pending invite.
   */
  static async declineSession(sessionId: string, uid: string): Promise<void> {
    await ScheduledSessionService.declineInvite(sessionId, uid);
  }

  /**
   * Cancels a session (host action — soft-deletes so history stays visible).
   */
  static async cancelSession(sessionId: string): Promise<void> {
    await ScheduledSessionService.cancelSession(sessionId);
  }

  /**
   * Marks an instant invite as expired after the sender's countdown runs out.
   */
  static async expireSession(sessionId: string): Promise<void> {
    // Treat like a cancel for the scheduled-sessions model
    NotificationService.markReadBySessionAll(sessionId).catch((e) =>
      console.warn('[WorkoutSessionService] expireSession markRead failed:', e),
    );
  }

  static readonly MAX_RESENDS = 3;

  /**
   * Resends a previous invite by re-inserting the notification.
   * Does NOT create a new session row — same sessionId, updated body.
   */
  static async resendSession(sessionId: string, hostName: string, _hostAvatarUrl?: string): Promise<void> {
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    // Re-insert notification (dedup key is time-windowed — 60-second bucket
    // means this only sends once per minute, which is the expected behaviour).
    NotificationService.insert({
      toUid:    '',  // caller (WorkoutSessionContext) must pass guestUid — left as '' here
      fromUid:  '',
      fromName: hostName,
      type:     'workout_invite',
      title:    'Workout Invite',
      body:     `${hostName} re-invited you to work out Today at ${timeStr}`,
      sessionId,
    }).catch((e) =>
      console.warn('[WorkoutSessionService] resendSession notification failed:', e),
    );
  }

  /**
   * Helper: mark notification read for a specific session + user.
   */
  static async markNotificationsRead(sessionId: string, toUid: string): Promise<void> {
    NotificationService.markReadBySession(sessionId, toUid).catch((e) =>
      console.warn('[WorkoutSessionService] markNotificationsRead failed:', e),
    );
  }
}
