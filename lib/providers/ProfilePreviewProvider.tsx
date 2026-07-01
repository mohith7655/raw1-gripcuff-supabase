/**
 * ProfilePreviewProvider — app-level helper for opening another user's profile.
 *
 * Tapping a user anywhere (avatars, feed rows, friend hub, challenge / workout
 * partners …) opens their FULL profile directly. Components call
 * `useProfilePreview()?.open({ uid })` and this provider navigates to
 * SocialProfileScreen via the global navigationRef, so no screen needs to wire
 * navigation itself. (Previously this showed a compact preview sheet; that
 * intermediate "medium" view has been removed in favour of going straight in.)
 */
import React, { createContext, useCallback, useContext } from 'react';
import { PreviewUser } from '../components/social/ProfilePreviewSheet';
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
  const open = useCallback((u: PreviewUser) => {
    if (u?.uid && navigationRef.isReady()) {
      (navigationRef as any).navigate('SocialProfileScreen', { uid: u.uid });
    }
  }, []);
  const close = useCallback(() => {}, []);

  return (
    <ProfilePreviewContext.Provider value={{ open, close }}>
      {children}
    </ProfilePreviewContext.Provider>
  );
}

export default ProfilePreviewProvider;
