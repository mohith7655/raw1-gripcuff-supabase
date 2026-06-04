/**
 * ChallengeVideoStage.tsx — shared type + fallback.
 *
 * Metro selects ChallengeVideoStage.native.tsx on iOS/Android and
 * ChallengeVideoStage.web.tsx on web. This base file is the type source for
 * imports and a no-op fallback for any other platform.
 */

import React from 'react';

export interface ChallengeVideoStageProps {
    /** Remote participant uid, or undefined while waiting for them to join. */
    remoteUid?: number;
    /** Hide the local camera PiP when the user turns their camera off. */
    isCameraOff: boolean;
    opponentName: string;
}

export const ChallengeVideoStage: React.FC<ChallengeVideoStageProps> = () => null;
