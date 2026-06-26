/**
 * ProfilePreviewProvider — one app-level "short profile" sheet for the whole app.
 *
 * Tapping a user anywhere (avatars, feed rows, friend hub, challenge / workout
 * partners …) should open the compact ProfilePreviewSheet — which shows the
 * hot/cold heat stats + online status — instead of jumping straight to the full
 * profile. Rather than wiring a sheet + state into every screen, components call
 * `useProfilePreview()?.open({ uid })` and this provider renders the single
 * shared sheet. The sheet self-fetches name / handle / picture from the uid, so
 * callers can pass just `{ uid }`.
 *
 * Navigation (View full profile / Message) goes through the global navigationRef
 * so the sheet doesn't need to live inside a navigator.
 */
import React, { createContext, useCallback, useContext, useState } from 'react';
import { ProfilePreviewSheet, PreviewUser } from '../components/social/ProfilePreviewSheet';
import { navigationRef } from '../core/navigation';

type ProfilePreviewContextValue = {
  open: (user: PreviewUser) => void;
  close: () => void;
};

const ProfilePreviewContext = createContext<ProfilePreviewContextValue | null>(null);

/** Safe accessor — returns null when used outside the provider (callers fall back). */
export function useProfilePreview(): ProfilePreviewContextValue | null {
  return useContext(ProfilePreviewContext);
}

export function ProfilePreviewProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PreviewUser | null>(null);

  const open = useCallback((u: PreviewUser) => { if (u?.uid) setUser(u); }, []);
  const close = useCallback(() => setUser(null), []);

  return (
    <ProfilePreviewContext.Provider value={{ open, close }}>
      {children}
      <ProfilePreviewSheet
        user={user}
        visible={!!user}
        onClose={close}
        onViewProfile={(uid) => {
          close();
          if (navigationRef.isReady()) (navigationRef as any).navigate('SocialProfileScreen', { uid });
        }}
        onMessage={(u) => {
          close();
          if (navigationRef.isReady()) {
            (navigationRef as any).navigate('ChatRoom', {
              friendUid: u.uid,
              friendName: u.fullName || u.username,
              friendAvatar: u.avatarUrl,
            });
          }
        }}
      />
    </ProfilePreviewContext.Provider>
  );
}

export default ProfilePreviewProvider;
