'use strict';

const admin = require('firebase-admin');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');

admin.initializeApp();
setGlobalOptions({ region: 'us-central1' });

const db = getFirestore(admin.app(), 'raw1');

async function getUserDoc(uid) {
  if (!uid) {
    console.log('[getUserDoc] Missing uid');
    return null;
  }

  const snap = await db.collection('users').doc(uid).get();
  console.log('[getUserDoc]', { uid, exists: snap.exists });
  return snap.exists ? snap : null;
}

async function getUserTokens(uid) {
  const snap = await getUserDoc(uid);
  if (!snap) {
    console.log('[getUserTokens] No user doc', { uid });
    return [];
  }

  const data = snap.data() || {};
  const tokens = [];

  if (Array.isArray(data.fcmTokens)) {
    tokens.push(...data.fcmTokens.filter(Boolean));
  }

  if (typeof data.fcmToken === 'string' && data.fcmToken) {
    tokens.push(data.fcmToken);
  }

  const uniqueTokens = [...new Set(tokens)];
  console.log('📱 Tokens:', uniqueTokens);
  return uniqueTokens;
}

async function getDisplayName(uid) {
  const snap = await getUserDoc(uid);
  if (!snap) return 'Someone';

  const data = snap.data() || {};
  return (
    data.displayName ||
    data.fullName ||
    data.name ||
    data.username ||
    data.email ||
    'Someone'
  );
}

async function removeStaleTokens(tokens) {
  if (!tokens.length) return;

  console.log('[removeStaleTokens] Removing stale tokens:', tokens);

  for (let i = 0; i < tokens.length; i += 10) {
    const batchTokens = tokens.slice(i, i + 10);
    const snap = await db
      .collection('users')
      .where('fcmTokens', 'array-contains-any', batchTokens)
      .get();

    await Promise.all(
      snap.docs.map((doc) =>
        doc.ref.update({
          fcmTokens: FieldValue.arrayRemove(...batchTokens),
        })
      )
    );
  }
}

async function sendPushToTokens({ tokens, notification, data }) {
  const uniqueTokens = [...new Set((tokens || []).filter(Boolean))];

  console.log('📱 Tokens:', uniqueTokens);

  if (!uniqueTokens.length) {
    console.log('[sendPushToTokens] No tokens found');
    return null;
  }

  const stringData = Object.fromEntries(
    Object.entries(data || {}).map(([key, value]) => [key, String(value ?? '')])
  );

  const response = await admin.messaging().sendEachForMulticast({
    tokens: uniqueTokens,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: stringData,
    android: {
      priority: 'high',
    },
    webpush: {
      headers: {
        Urgency: 'high',
      },
      notification: {
        title: notification.title,
        body: notification.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      },
      fcmOptions: {
        link: '/',
      },
    },
  });

  console.log('[FCM response]', {
    successCount: response.successCount,
    failureCount: response.failureCount,
    responses: response.responses.map((item, index) => ({
      index,
      success: item.success,
      messageId: item.messageId,
      errorCode: item.error?.code,
      errorMessage: item.error?.message,
    })),
  });

  const staleTokens = [];
  response.responses.forEach((item, index) => {
    const code = item.error?.code;
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      staleTokens.push(uniqueTokens[index]);
    }
  });

  if (staleTokens.length) {
    await removeStaleTokens(staleTokens);
  }

  return response;
}

exports.onNewChatMessage = onDocumentCreated(
  {
    document: 'chatRooms/{chatId}/messages/{messageId}',
    database: 'raw1',
  },
  async (event) => {
    console.log('🔥 [onNewChatMessage]');
    console.log('🔥 Trigger fired');
    console.log('[onNewChatMessage] params:', event.params);

    const message = event.data?.data();
    const chatId = event.params.chatId;
    const messageId = event.params.messageId;

    if (!message) {
      console.log('[onNewChatMessage] Missing message data');
      return;
    }

    const chatDoc = await db.collection('chatRooms').doc(chatId).get();
    if (!chatDoc.exists) {
      console.log('[onNewChatMessage] Chat room not found:', chatId);
      return;
    }

    const participants = chatDoc.data().participants || [];
    const receivers = participants.filter((uid) => uid !== message.senderId);

    console.log('👥 Receivers:', receivers);

    let tokens = [];
    for (const uid of receivers) {
      tokens.push(...(await getUserTokens(uid)));
    }

    tokens = [...new Set(tokens)];
    console.log('📱 Tokens:', tokens);

    if (!tokens.length) {
      console.log('[onNewChatMessage] No tokens found');
      return;
    }

    const response = await sendPushToTokens({
      tokens,
      notification: {
        title: 'New Message',
        body: message.text || 'You have a new message',
      },
      data: {
        type: 'message',
        chatId,
        messageId,
      },
    });

    console.log('[onNewChatMessage] FCM response:', response);
  }
);

exports.onFriendRequest = onDocumentCreated(
  {
    document: 'friendRequests/{docId}',
    database: 'raw1',
  },
  async (event) => {
    console.log('🔥 [onFriendRequest]');
    console.log('🔥 Trigger fired');
    console.log('[onFriendRequest] params:', event.params);

    const request = event.data?.data();
    const requestId = event.params.docId;

    if (!request) {
      console.log('[onFriendRequest] Missing request data');
      return;
    }

    const receiverId = request.toUid || request.receiverUid || request.recipientUid;
    const senderId = request.fromUid || request.senderUid;
    const receivers = receiverId ? [receiverId] : [];

    console.log('👥 Receivers:', receivers);

    if (!receiverId) {
      console.log('[onFriendRequest] No receiver ID found');
      return;
    }

    const [tokens, senderName] = await Promise.all([
      getUserTokens(receiverId),
      getDisplayName(senderId),
    ]);

    console.log('📱 Tokens:', tokens);

    if (!tokens.length) {
      console.log('[onFriendRequest] No tokens found');
      return;
    }

    const response = await sendPushToTokens({
      tokens,
      notification: {
        title: 'Friend Request',
        body: `${senderName} sent you a friend request`,
      },
      data: {
        type: 'friend_request',
        requestId,
      },
    });

    console.log('[onFriendRequest] FCM response:', response);
  }
);

exports.onWorkoutInvite = onDocumentCreated(
  {
    document: 'workoutSessions/{sessionId}',
    database: 'raw1',
  },
  async (event) => {
    console.log('🔥 [onWorkoutInvite]');
    console.log('🔥 Trigger fired');
    console.log('[onWorkoutInvite] params:', event.params);

    const session = event.data?.data();
    const sessionId = event.params.sessionId;

    if (!session) {
      console.log('[onWorkoutInvite] Missing session data');
      return;
    }

    const receiverId = session.guestUid || session.toUid;
    const senderId = session.hostUid || session.fromUid;
    const senderName = session.hostName || (await getDisplayName(senderId));
    const videoTitle = session.videoTitle || session.workoutType || '';
    const receivers = receiverId ? [receiverId] : [];

    console.log('👥 Receivers:', receivers);

    if (!receiverId) {
      console.log('[onWorkoutInvite] No receiver ID found');
      return;
    }

    const tokens = await getUserTokens(receiverId);
    console.log('📱 Tokens:', tokens);

    if (!tokens.length) {
      console.log('[onWorkoutInvite] No tokens found');
      return;
    }

    const response = await sendPushToTokens({
      tokens,
      notification: {
        title: 'Workout Invite',
        body: videoTitle
          ? `${senderName} invited you to work out - ${videoTitle}`
          : `${senderName} invited you to work out`,
      },
      data: {
        type: 'workout_invite',
        sessionId,
      },
    });

    console.log('[onWorkoutInvite] FCM response:', response);

    await event.data.ref.update({
      lastNotifiedAt: FieldValue.serverTimestamp(),
    });
  }
);

exports.repeatWorkoutInvites = onSchedule(
  {
    schedule: 'every 30 minutes',
    region: 'us-central1',
  },
  async () => {
    console.log('🔥 Trigger fired');
    console.log('[repeatWorkoutInvites] Running scheduled reminder');

    const cutoff = new Date(Date.now() - 30 * 60 * 1000);
    const snap = await db
      .collection('workoutSessions')
      .where('status', '==', 'pending')
      .get();

    for (const sessionDoc of snap.docs) {
      const session = sessionDoc.data();
      const sessionId = sessionDoc.id;
      const lastNotifiedAt =
        session.lastNotifiedAt?.toDate?.() ||
        session.lastNotifiedAt ||
        null;

      if (lastNotifiedAt && lastNotifiedAt > cutoff) {
        continue;
      }

      const receiverId = session.guestUid || session.toUid;
      const senderId = session.hostUid || session.fromUid;
      const senderName = session.hostName || (await getDisplayName(senderId));
      const videoTitle = session.videoTitle || session.workoutType || '';
      const receivers = receiverId ? [receiverId] : [];

      console.log('👥 Receivers:', receivers);

      if (!receiverId) continue;

      const tokens = await getUserTokens(receiverId);
      console.log('📱 Tokens:', tokens);

      if (!tokens.length) continue;

      const response = await sendPushToTokens({
        tokens,
        notification: {
          title: 'Workout Invite Reminder',
          body: videoTitle
            ? `Reminder: ${senderName} invited you to work out - ${videoTitle}`
            : `Reminder: ${senderName} invited you to work out`,
        },
        data: {
          type: 'workout_invite',
          sessionId,
        },
      });

      console.log('[repeatWorkoutInvites] FCM response:', response);

      await sessionDoc.ref.update({
        lastNotifiedAt: FieldValue.serverTimestamp(),
      });
    }
  }
);

exports.onStrangerInviteCreated = onDocumentCreated(
  {
    document: 'strangerInvites/{inviteId}',
    database: 'raw1',
  },
  async (event) => {
    console.log('🔥 [onStrangerInviteCreated]');

    const invite = event.data?.data();
    const inviteId = event.params.inviteId;

    if (!invite) {
      console.log('[onStrangerInviteCreated] Missing invite data');
      return;
    }

    const { targetUserId, inviterUsername, workoutTitle } = invite;

    if (!targetUserId) {
      console.log('[onStrangerInviteCreated] No target user');
      return;
    }

    const tokens = await getUserTokens(targetUserId);
    console.log('📱 Tokens:', tokens);

    if (!tokens.length) {
      console.log('[onStrangerInviteCreated] No tokens found for target');
      return;
    }

    const senderName = inviterUsername || (await getDisplayName(invite.inviterId));

    await sendPushToTokens({
      tokens,
      notification: {
        title: `${senderName} wants to be your gym partner!`,
        body: workoutTitle
          ? `Join them for: ${workoutTitle}. You have 10 seconds to accept!`
          : 'You have 10 seconds to accept their gym partner invite!',
      },
      data: {
        type: 'stranger_invite',
        inviteId,
      },
    });

    console.log('[onStrangerInviteCreated] Push sent');
  }
);

// ── sendIntervalNotifications (callable) ─────────────────────────────────────
exports.sendIntervalNotifications = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new Error('Unauthenticated');

    const { userId, workoutName, intervalMinutes, totalMinutes, message, startTime, scheduleId } = request.data;

    if (uid !== userId) throw new Error('Unauthorized');

    const maxTicks = Math.floor(totalMinutes / intervalMinutes);
    const trackingRef = db.collection('scheduledWorkouts').doc();
    const trackingId = trackingRef.id;

    await trackingRef.set({
      userId,
      workoutName,
      intervalMinutes,
      totalMinutes,
      message,
      startTime,
      scheduleId: scheduleId ?? null,
      type: 'interval_tracking',
      createdAt: FieldValue.serverTimestamp(),
    });

    const batch = db.batch();
    for (let i = 1; i <= maxTicks; i++) {
      const scheduledFor = new Date(startTime + i * intervalMinutes * 60 * 1000);
      const notifRef = trackingRef.collection('intervalNotifs').doc(String(i));
      batch.set(notifRef, {
        userId,
        workoutName,
        message,
        scheduledFor,
        tick: i,
        sent: false,
      });
    }
    await batch.commit();

    console.log(`[sendIntervalNotifications] Created ${maxTicks} interval notifs for ${uid}`);
    return { trackingId, scheduled: maxTicks };
  }
);

// ── cancelIntervalNotifications (callable) ───────────────────────────────────
exports.cancelIntervalNotifications = onCall(
  { region: 'us-central1' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new Error('Unauthenticated');

    const { trackingId } = request.data;
    const trackingRef = db.collection('scheduledWorkouts').doc(trackingId);
    const trackingSnap = await trackingRef.get();

    if (trackingSnap.exists && trackingSnap.data().userId !== uid) {
      throw new Error('Unauthorized');
    }

    const notifsSnap = await trackingRef.collection('intervalNotifs').get();
    const batch = db.batch();
    notifsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(trackingRef);
    await batch.commit();

    console.log(`[cancelIntervalNotifications] Deleted tracking doc ${trackingId}`);
  }
);

// ── processWorkoutReminders (every 1 min) ────────────────────────────────────
exports.processWorkoutReminders = onSchedule(
  { schedule: 'every 1 minutes', region: 'us-central1' },
  async () => {
    const now = new Date();

    const snap = await db
      .collection('scheduledWorkouts')
      .where('status', '==', 'scheduled')
      .get();

    console.log(`[processWorkoutReminders] Found ${snap.size} scheduled reminders to inspect at ${now.toISOString()}`);

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const userId = data.userId;
      const workoutId = data.workoutId ?? '';
      const title = data.videoTitle || data.workoutName || 'Workout';
      const reminderScheduledFor =
        data.reminderScheduledFor?.toDate?.() ||
        (data.reminderTime?.toDate?.() || (data.reminderScheduledFor ? new Date(data.reminderScheduledFor) : null));
      const scheduledAt =
        data.scheduledAt?.toDate?.() ||
        data.scheduledFor?.toDate?.() ||
        data.triggerTime?.toDate?.() ||
        data.reminderTime?.toDate?.() ||
        (data.scheduledAt ? new Date(data.scheduledAt) : null);
      const reminderSent = data.reminderSent === true;
      const notificationSent = data.notificationSent === true;
      const isDue = scheduledAt && scheduledAt <= now;

      if (!isDue && !reminderScheduledFor) {
        continue;
      }

      if (!userId) {
        console.log('[processWorkoutReminders] Missing userId for', docSnap.id);
        continue;
      }

      const userSnap = await db.collection('users').doc(userId).get();
      const userData = userSnap.exists ? userSnap.data() : null;
      const fcmToken = userData?.fcmToken;
      if (!fcmToken) {
        console.log(`No FCM token for user ${userId}`);
        continue;
      }

      try {
        if (reminderScheduledFor && reminderScheduledFor <= now && !reminderSent) {
          await admin.messaging().send({
            token: String(fcmToken),
            notification: {
              title: '⏰ Workout Reminder',
              body: `${title} starts soon`,
            },
            data: {
              type: 'workout_reminder',
              workoutId,
              scheduleId: docSnap.id,
            },
          });
          await docSnap.ref.update({ reminderSent: true });
          console.log('[Reminder] FCM sent', { scheduleId: docSnap.id, type: 'workout_reminder' });
          console.log(`[processWorkoutReminders] Lead-time reminder sent for ${docSnap.id}`);
        }

        if (isDue && !notificationSent) {
          await admin.messaging().send({
            token: String(fcmToken),
            notification: {
              title: `🎯 ${title}`,
              body: 'Time to start your workout!',
            },
            data: {
              type: 'workout_start',
              workoutId,
              scheduleId: docSnap.id,
            },
          });
          await docSnap.ref.update({
            notificationSent: true,
            status: 'triggered',
          });
          console.log('[Reminder] FCM sent', { scheduleId: docSnap.id, type: 'workout_start' });
          console.log(`[processWorkoutReminders] Exact-time reminder sent for ${docSnap.id}`);
        }
      } catch (err) {
        const code = err?.errorInfo?.code || err?.code || '';
        if (String(code).includes('registration-token-not-registered') || String(code).includes('invalid-registration-token')) {
          try {
            await db.collection('users').doc(userId).update({
              fcmToken: FieldValue.delete(),
              fcmTokenUpdatedAt: FieldValue.serverTimestamp(),
            });
            console.log(`[processWorkoutReminders] Removed stale token for ${userId}`);
          } catch (cleanupErr) {
            console.warn('[processWorkoutReminders] Failed stale token cleanup:', cleanupErr);
          }
        }
        console.error(`[processWorkoutReminders] Error for ${docSnap.id}:`, err);
      }
    }
  }
);

// ── processRecurringReminders (every 1 min) ──────────────────────────────────
exports.processRecurringReminders = onSchedule(
  { schedule: 'every 1 minutes', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    console.log('[processRecurringReminders] Minute check started');

    const remindersSnap = await db
      .collection('reminders')
      .where('status', '==', 'active')
      .get();

    console.log(`[processRecurringReminders] Found ${remindersSnap.size} active reminders`);

    const now = new Date();

    for (const docSnap of remindersSnap.docs) {
      const data = docSnap.data();
      const { userId, workoutTitle, workoutId, videoTitle } = data;
      const title = workoutTitle || videoTitle || 'Workout';

      const nextTs = data.nextTriggerAt?.toDate?.();
      if (!nextTs || nextTs > now) {
        continue;
      }

      let nextTrigger = null;
      const recurrence = data.recurrence || {};
      const mode = recurrence.mode || (data.intervalValue ? 'custom_interval' : null);

      if (mode === 'daily') {
        nextTrigger = new Date(nextTs.getTime() + 24 * 60 * 60 * 1000);
      } else if (mode === 'weekdays') {
        nextTrigger = new Date(nextTs.getTime() + 24 * 60 * 60 * 1000);
        while (nextTrigger.getDay() === 0 || nextTrigger.getDay() === 6) {
          nextTrigger = new Date(nextTrigger.getTime() + 24 * 60 * 60 * 1000);
        }
      } else {
        const unit = recurrence.intervalUnit || data.intervalUnit || 'minutes';
        const value = Number(recurrence.intervalValue || data.intervalValue || 0);
        const intervalMinutes = unit === 'hours' ? value * 60 : value;
        if (!intervalMinutes || intervalMinutes <= 0) {
          console.log(`[processRecurringReminders] Invalid interval for ${docSnap.id}`);
          continue;
        }
        nextTrigger = new Date(nextTs.getTime() + intervalMinutes * 60 * 1000);
      }

      try {
        const tokens = await getUserTokens(userId);
        if (tokens.length) {
          await sendPushToTokens({
            tokens,
            notification: {
              title: '⏰ Workout Reminder',
              body: `${title} — It's time to work out!`,
            },
            data: {
              type: 'recurring_workout',
              reminderId: docSnap.id,
              workoutId: workoutId ?? '',
              workoutTitle: title,
            },
          });
          console.log(`[processRecurringReminders] Sent notification for reminder ${docSnap.id}`);
          console.log('[Reminder] FCM sent', { reminderId: docSnap.id, type: 'recurring_workout' });
        }

        await docSnap.ref.update({
          lastTriggeredAt: FieldValue.serverTimestamp(),
          nextTriggerAt: nextTrigger,
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log('[Reminder] recurring reminder rescheduled', {
          reminderId: docSnap.id,
          nextTriggerAt: nextTrigger.toISOString(),
        });
      } catch (err) {
        console.error(`[processRecurringReminders] Error for ${docSnap.id}:`, err);
      }
    }
  }
);

// ── resetWeeklyLeaderboard (every Monday 00:00 UTC) ──────────────────────────
exports.resetWeeklyLeaderboard = onSchedule(
  { schedule: 'every monday 00:00', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    console.log('[resetWeeklyLeaderboard] Starting weekly reset...');
    const snap = await db.collection('leaderboards').doc('weekly').collection('users').get();
    if (snap.empty) {
      console.log('[resetWeeklyLeaderboard] No users to reset');
      return;
    }

    const batchSize = 400;
    for (let i = 0; i < snap.docs.length; i += batchSize) {
      const batch = db.batch();
      snap.docs.slice(i, i + batchSize).forEach((d) => {
        batch.update(d.ref, {
          score: 0,
          totalMinutes: 0,
          workoutMinutes: 0,
          workoutsCompleted: 0,
          liveSessions: 0,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();
    }

    console.log(`[resetWeeklyLeaderboard] Reset ${snap.docs.length} users`);
  }
);

// ── processIntervalNotifications (every 1 min) ───────────────────────────────
exports.processIntervalNotifications = onSchedule(
  { schedule: 'every 1 minutes', region: 'us-central1' },
  async () => {
    const now = new Date();
    const snap = await db
      .collectionGroup('intervalNotifs')
      .where('sent', '==', false)
      .where('scheduledFor', '<=', now)
      .get();

    console.log(`[processIntervalNotifications] Found ${snap.size} due notifications`);

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const { userId, workoutName, message } = data;

      try {
        const tokens = await getUserTokens(userId);
        if (tokens.length) {
          await sendPushToTokens({
            tokens,
            notification: {
              title: workoutName || 'Workout Alert',
              body: message || 'Keep going! 💪',
            },
            data: {
              type: 'interval_alert',
              workoutName: workoutName ?? '',
            },
          });
        }

        await docSnap.ref.delete();
        console.log(`[processIntervalNotifications] Sent and deleted ${docSnap.ref.path}`);
      } catch (err) {
        console.error(`[processIntervalNotifications] Error for ${docSnap.ref.path}:`, err);
      }
    }
  }
);
