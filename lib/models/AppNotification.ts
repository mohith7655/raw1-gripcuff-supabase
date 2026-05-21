export type AppNotificationType =
  | 'workout_invite'
  | 'friend_request'
  | 'chat_message'
  | 'message'
  | 'stranger_invite'
  | 'workout_reminder'
  | 'recurring_workout'
  | 'social_notification'
  | 'workout_start'
  | 'video_invite'
  | 'system';

export interface AppNotification {
  id: string;
  type: AppNotificationType;
  title: string;
  body: string;
  toUid: string;
  fromUid: string;
  fromName: string;
  createdAt: Date;
  read: boolean;
  chatId?: string;
  messageId?: string;
  requestId?: string;
  sessionId?: string;
}
