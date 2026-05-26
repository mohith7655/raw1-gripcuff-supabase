/**
 * ScheduledSessionService
 *
 * Source of truth for scheduled workout sessions stored in Supabase.
 *
 * Tables:
 *   scheduled_sessions        — one row per planned session (host owns it)
 *   scheduled_session_invites — one row per (session, invited_user) pair
 *
 * All IDs are Supabase UUIDs (auth.uid()).
 * Notifications are written via NotificationService so push + in-app
 * banners work automatically.
 */

import { supabase } from '../core/config/supabase';
import { NotificationService } from './notification.service';
import { WorkoutSession } from '../models/WorkoutSession';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CreateSessionParams {
  hostUid: string;
  hostName: string;
  hostAvatarUrl?: string | null;
  guestUid: string;
  guestName: string;
  guestAvatarUrl?: string | null;
  videoId: string;
  videoTitle: string;
  scheduledAt: Date;
  thumbnail?: string | null;
  category?: string | null;
  programName?: string | null;
}

// Raw row shape returned from Supabase joins
interface SessionRow {
  id: string;
  host_user_id: string;
  workout_id: string;
  workout_title: string;
  workout_video_url: string | null;
  thumbnail_url: string | null;
  category: string | null;
  program_name: string | null;
  scheduled_for: string;
  status: string;
  co_workout_channel: string | null;
  resend_count: number | null;
  last_activity_at: string;
  created_at: string;
  // joined from scheduled_session_invites
  invite_status?: string | null;
  invited_user_id?: string | null;
  // host profile (joined)
  host_full_name?: string | null;
  host_username?: string | null;
  host_avatar?: string | null;
  // guest profile (joined)
  guest_full_name?: string | null;
  guest_username?: string | null;
  guest_avatar?: string | null;
}

// ─── Row mapper ─────────────────────────────────────────────────────────────

function rowToSession(
  row: SessionRow,
  currentUid: string,
  inviteRow?: { status: string; invited_user_id: string } | null,
): WorkoutSession {
  const inviteStatus = inviteRow?.status ?? row.invite_status ?? 'pending';
  const guestUid = inviteRow?.invited_user_id ?? row.invited_user_id ?? '';

  // Map invite + session status → WorkoutSession.status
  let status: WorkoutSession['status'];
  if (row.status === 'cancelled') {
    status = 'cancelled';
  } else if (row.status === 'live' || row.status === 'completed') {
    status = inviteStatus === 'accepted' ? 'accepted' : 'pending';
  } else if (inviteStatus === 'accepted') {
    status = 'accepted';
  } else if (inviteStatus === 'declined') {
    status = 'declined';
  } else {
    status = 'pending';
  }

  // A session with no guest invite is a self-scheduled (solo) session.
  const isSelf = !guestUid;

  return {
    id: row.id,
    hostUid: row.host_user_id,
    guestUid,
    hostName: row.host_full_name ?? row.host_username ?? 'User',
    guestName: isSelf ? 'Private Workout' : (row.guest_full_name ?? row.guest_username ?? 'Friend'),
    hostAvatarUrl: row.host_avatar ?? undefined,
    guestAvatarUrl: row.guest_avatar ?? undefined,
    videoId: row.workout_id,
    videoTitle: row.workout_title,
    thumbnail: row.thumbnail_url ?? undefined,
    category: row.category ?? undefined,
    programName: row.program_name ?? undefined,
    scheduledAt: new Date(row.scheduled_for),
    status,
    sessionType: isSelf ? 'self' : 'friend',
    inviteType: 'scheduled',
    resendCount: row.resend_count ?? 0,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.last_activity_at),
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ScheduledSessionService {

  // ── Create ────────────────────────────────────────────────────────────────
  // 1. INSERT scheduled_sessions
  // 2. INSERT scheduled_session_invites for the guest
  // 3. INSERT notification so guest gets in-app banner + push

  static async create(params: CreateSessionParams): Promise<string> {
    const {
      hostUid, hostName, hostAvatarUrl,
      guestUid, guestName, guestAvatarUrl,
      videoId, videoTitle, scheduledAt,
      thumbnail, category, programName,
    } = params;

    // 1 — session row
    const { data: sessionRow, error: sessionErr } = await supabase
      .from('scheduled_sessions')
      .insert({
        host_user_id:     hostUid,
        workout_id:       videoId,
        workout_title:    videoTitle,
        thumbnail_url:    thumbnail   ?? null,
        category:         category    ?? null,
        program_name:     programName ?? null,
        scheduled_for:    scheduledAt.toISOString(),
        status:           'scheduled',
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (sessionErr || !sessionRow) {
      throw new Error(sessionErr?.message ?? 'Failed to create session');
    }

    const sessionId: string = sessionRow.id;

    // 2 — invite row
    const { error: inviteErr } = await supabase
      .from('scheduled_session_invites')
      .insert({
        session_id:      sessionId,
        invited_user_id: guestUid,
        invited_by:      hostUid,
        status:          'pending',
      });

    if (inviteErr) {
      // Non-fatal — session exists, invite write failed (duplicate guard)
      console.warn('[ScheduledSessionService] invite insert error:', inviteErr.message);
    }

    // 3 — notification
    const isToday = scheduledAt.toDateString() === new Date().toDateString();
    const dateStr = isToday
      ? 'Today'
      : scheduledAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    await NotificationService.insert({
      toUid:     guestUid,
      fromUid:   hostUid,
      fromName:  hostName,
      type:      'workout_invite',
      title:     'Workout Invite',
      body:      `${hostName} invited you to work out ${dateStr} at ${timeStr}`,
      sessionId,
    });

    console.log('[ScheduledSessionService] created session', sessionId, {
      hostUid, guestUid, videoId, scheduledAt,
    });

    return sessionId;
  }

  // ── Create self-scheduled session (no guest, no invite, no notification) ──
  // Used by WorkoutTogetherModal when the user picks "Self Schedule".

  static async createSelfSession(params: {
    hostUid: string;
    videoId: string;
    videoTitle: string;
    scheduledAt: Date;
    thumbnail?: string | null;
    category?: string | null;
    programName?: string | null;
  }): Promise<string> {
    const { hostUid, videoId, videoTitle, scheduledAt, thumbnail, category, programName } = params;

    const { data: sessionRow, error: sessionErr } = await supabase
      .from('scheduled_sessions')
      .insert({
        host_user_id:     hostUid,
        workout_id:       videoId,
        workout_title:    videoTitle,
        thumbnail_url:    thumbnail   ?? null,
        category:         category    ?? null,
        program_name:     programName ?? null,
        scheduled_for:    scheduledAt.toISOString(),
        status:           'scheduled',
        last_activity_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (sessionErr || !sessionRow) {
      throw new Error(sessionErr?.message ?? 'Failed to create self session');
    }

    console.log('[ScheduledSessionService] created self session', sessionRow.id, {
      hostUid, videoId, scheduledAt,
    });

    return sessionRow.id as string;
  }

  // ── Fetch all sessions for a user ─────────────────────────────────────────
  // Returns both hosted sessions (host_user_id = uid) and
  // invited sessions (invited_user_id = uid in invites table).

  static async getAllForUser(uid: string): Promise<WorkoutSession[]> {
    // ── 1. Sessions the user HOSTS ──────────────────────────────────────────
    const { data: hostedRaw, error: hostedErr } = await supabase
      .from('scheduled_sessions')
      .select(`
        id, host_user_id, workout_id, workout_title, workout_video_url,
        thumbnail_url, category, program_name, scheduled_for, status,
        co_workout_channel, resend_count, last_activity_at, created_at,
        scheduled_session_invites (
          id, invited_user_id, status,
          guest:users!invited_user_id (
            full_name, username, avatar_url
          )
        ),
        host:users!host_user_id (
          full_name, username, avatar_url
        )
      `)
      .eq('host_user_id', uid)
      .neq('status', 'cancelled')
      .order('scheduled_for', { ascending: true });

    if (hostedErr) {
      console.warn('[ScheduledSessionService] hosted fetch error:', hostedErr.message);
    }

    console.log('[Sessions] hosted', hostedRaw?.length ?? 0);

    // ── 2a. Invite rows for this user (known-working query) ───────────────
    const { data: myInvites, error: inviteErr } = await supabase
      .from('scheduled_session_invites')
      .select('id, session_id, invited_user_id, status')
      .eq('invited_user_id', uid)
      .neq('status', 'declined');

    if (inviteErr) {
      console.warn('[ScheduledSessionService] invite rows fetch error:', inviteErr.message);
    }

    const myInvitesList = myInvites ?? [];
    console.log('[Sessions] incoming raw', myInvitesList.length);

    // Build lookup: session_id → invite row
    const inviteBySessionId = new Map(myInvitesList.map(inv => [inv.session_id, inv]));
    const invitedSessionIds = [...inviteBySessionId.keys()];

    // ── 2b. Fetch the actual session rows by ID — no join, bypasses RLS join issue ──
    let invitedSessionRows: any[] = [];
    if (invitedSessionIds.length > 0) {
      const { data: sessData, error: sessErr } = await supabase
        .from('scheduled_sessions')
        .select(`
          id, host_user_id, workout_id, workout_title, workout_video_url,
          thumbnail_url, category, program_name, scheduled_for, status,
          co_workout_channel, resend_count, last_activity_at, created_at,
          host:users (
            full_name, username, avatar_url
          )
        `)
        .in('id', invitedSessionIds)
        .neq('status', 'cancelled');

      if (sessErr) {
        console.warn('[ScheduledSessionService] invited sessions fetch error:', sessErr.message);
      }

      invitedSessionRows = sessData ?? [];
      console.log('[Sessions] invited sessions fetched', invitedSessionRows.length);
    }

    const sessions: WorkoutSession[] = [];
    const seenIds = new Set<string>();

    // Map hosted
    for (const row of (hostedRaw ?? [])) {
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);

      const invites: any[] = (row as any).scheduled_session_invites ?? [];
      const invite = invites[0];  // first invitee (single-guest model for now)
      const hostProfile: any = (row as any).host;
      const guestProfile: any = invite?.guest;

      sessions.push(rowToSession({
        id:                row.id,
        host_user_id:      row.host_user_id,
        workout_id:        row.workout_id,
        workout_title:     row.workout_title,
        workout_video_url: row.workout_video_url,
        thumbnail_url:     row.thumbnail_url,
        category:          row.category,
        program_name:      row.program_name,
        scheduled_for:     row.scheduled_for,
        status:            row.status,
        co_workout_channel: row.co_workout_channel,
        resend_count:      (row as any).resend_count ?? 0,
        last_activity_at:  row.last_activity_at,
        created_at:        row.created_at,
        invite_status:     invite?.status ?? null,
        invited_user_id:   invite?.invited_user_id ?? null,
        host_full_name:    hostProfile?.full_name ?? null,
        host_username:     hostProfile?.username ?? null,
        host_avatar:       hostProfile?.avatar_url ?? null,
        guest_full_name:   guestProfile?.full_name ?? null,
        guest_username:    guestProfile?.username ?? null,
        guest_avatar:      guestProfile?.avatar_url ?? null,
      }, uid, invite ? { status: invite.status, invited_user_id: invite.invited_user_id } : null));
    }

    // Map invited — iterate over the directly-fetched session rows
    for (const session of invitedSessionRows) {
      if (seenIds.has(session.id)) continue;
      seenIds.add(session.id);

      const inviteRow = inviteBySessionId.get(session.id);
      if (!inviteRow) continue;   // shouldn't happen but guard anyway

      console.log('[Sessions] joined session OK', {
        inviteId: inviteRow.id,
        sessionId: session.id,
      });

      const hostProfile: any = (session as any).host;

      sessions.push(rowToSession({
        id:                session.id,
        host_user_id:      session.host_user_id,
        workout_id:        session.workout_id,
        workout_title:     session.workout_title,
        workout_video_url: session.workout_video_url,
        thumbnail_url:     session.thumbnail_url,
        category:          session.category,
        program_name:      session.program_name,
        scheduled_for:     session.scheduled_for,
        status:            session.status,
        co_workout_channel: session.co_workout_channel,
        resend_count:      (session as any).resend_count ?? 0,
        last_activity_at:  session.last_activity_at,
        created_at:        session.created_at,
        invite_status:     inviteRow.status,
        invited_user_id:   inviteRow.invited_user_id,
        host_full_name:    hostProfile?.full_name ?? null,
        host_username:     hostProfile?.username ?? null,
        host_avatar:       hostProfile?.avatar_url ?? null,
        guest_full_name:   null,
        guest_username:    null,
        guest_avatar:      null,
      }, uid, { status: inviteRow.status, invited_user_id: inviteRow.invited_user_id }));
    }

    console.log('[Sessions] total mapped', sessions.length, '(hosted + incoming)');
    return sessions;
  }

  // ── Accept invite ─────────────────────────────────────────────────────────

  static async acceptInvite(sessionId: string, uid: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_session_invites')
      .update({ status: 'accepted' })
      .eq('session_id', sessionId)
      .eq('invited_user_id', uid);

    if (error) throw new Error(error.message);

    // Touch last_activity_at on the parent session
    await supabase
      .from('scheduled_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', sessionId);

    // Mark the invite notification read for this user
    NotificationService.markReadBySession(sessionId, uid).catch(() => {});

    console.log('[ScheduledSessionService] invite accepted', { sessionId, uid });
  }

  // ── Decline invite ────────────────────────────────────────────────────────

  static async declineInvite(sessionId: string, uid: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_session_invites')
      .update({ status: 'declined' })
      .eq('session_id', sessionId)
      .eq('invited_user_id', uid);

    if (error) throw new Error(error.message);

    NotificationService.markReadBySession(sessionId, uid).catch(() => {});

    console.log('[ScheduledSessionService] invite declined', { sessionId, uid });
  }

  // ── Cancel session (host) ─────────────────────────────────────────────────

  static async cancelSession(sessionId: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_sessions')
      .update({ status: 'cancelled', last_activity_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw new Error(error.message);

    NotificationService.markReadBySessionAll(sessionId).catch(() => {});

    console.log('[ScheduledSessionService] session cancelled', sessionId);
  }

  // ── Mark session live (host starts early or on time) ──────────────────────
  // Sends a notification to all pending/accepted invitees.

  static async markLive(sessionId: string, hostName: string, videoTitle: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_sessions')
      .update({ status: 'live', last_activity_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) throw new Error(error.message);

    // Notify all accepted/pending invitees
    const { data: invites } = await supabase
      .from('scheduled_session_invites')
      .select('invited_user_id')
      .eq('session_id', sessionId)
      .neq('status', 'declined');

    for (const row of invites ?? []) {
      NotificationService.insert({
        toUid:    row.invited_user_id,
        fromName: hostName,
        type:     'workout_invite',
        title:    'Session is Live!',
        body:     `${hostName} started the "${videoTitle}" session. Join now!`,
        sessionId,
      }).catch(() => {});
    }

    console.log('[ScheduledSessionService] session marked live', sessionId);
  }

  // ── Resend invite (host) ──────────────────────────────────────────────────
  // Atomically increments resend_count via the try_increment_resend RPC and
  // re-inserts the workout_invite notification to every invitee whose status
  // is not 'declined'. Throws Error('max_resends_reached') when the cap is hit
  // (UI in UpcomingSessionsScreen catches this exact string).

  static async resendSessionInvite(sessionId: string, hostName: string): Promise<void> {
    // 1 — Atomic cap-check + increment in one round-trip
    const { data: newCount, error: rpcErr } = await supabase
      .rpc('try_increment_resend', { p_session_id: sessionId });

    if (rpcErr) throw new Error(rpcErr.message);
    if (newCount === null || newCount === undefined) {
      throw new Error('max_resends_reached');
    }

    // 2 — Pull the session's workout title + invitees so we can address the notification
    const { data: session, error: sessErr } = await supabase
      .from('scheduled_sessions')
      .select('workout_title')
      .eq('id', sessionId)
      .single();
    if (sessErr) throw new Error(sessErr.message);

    const { data: invitees, error: inviteeErr } = await supabase
      .from('scheduled_session_invites')
      .select('invited_user_id')
      .eq('session_id', sessionId)
      .neq('status', 'declined');
    if (inviteeErr) throw new Error(inviteeErr.message);

    const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    for (const row of invitees ?? []) {
      NotificationService.insert({
        toUid:    row.invited_user_id,
        fromName: hostName,
        type:     'workout_invite',
        title:    'Workout Invite',
        body:     `${hostName} re-invited you to "${session.workout_title}" — ${timeStr}`,
        sessionId,
      }).catch((e) =>
        console.warn('[ScheduledSessionService] resend notification failed:', e?.message ?? e),
      );
    }

    console.log('[ScheduledSessionService] invite resent', { sessionId, newCount });
  }

  // ── Realtime: subscribe to changes for a user ─────────────────────────────
  // channel 1: scheduled_sessions WHERE host_user_id = uid
  // channel 2: scheduled_session_invites WHERE invited_user_id = uid
  // Both fire onChange() on any event so the context can re-fetch.

  static subscribeForUser(uid: string, onChange: () => void): () => void {
    const ch1 = supabase
      .channel(`sched-sessions-host-${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_sessions',
          filter: `host_user_id=eq.${uid}`,
        },
        () => {
          console.log('[ScheduledSessionService] realtime: session change (host)');
          onChange();
        },
      )
      .subscribe();

    const ch2 = supabase
      .channel(`sched-invites-invited-${uid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_session_invites',
          filter: `invited_user_id=eq.${uid}`,
        },
        () => {
          console.log('[ScheduledSessionService] realtime: invite change (guest)');
          onChange();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
    };
  }
}
