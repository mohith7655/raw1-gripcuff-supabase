-- challenge_feedback: post-challenge questionnaire answers.
-- One row per participant per session (each side fills out their own).
--   feeling / friendliness / reps  → 1–5 star ratings
--   winner_id                      → which participant the submitter says won
CREATE TABLE IF NOT EXISTS public.challenge_feedback (
    id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id    uuid        NOT NULL REFERENCES public.challenge_sessions(id) ON DELETE CASCADE,
    user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    feeling       smallint    CHECK (feeling      BETWEEN 1 AND 5),
    friendliness  smallint    CHECK (friendliness BETWEEN 1 AND 5),
    reps          smallint    CHECK (reps         BETWEEN 1 AND 5),
    winner_id     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now(),
    UNIQUE (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_feedback_session ON public.challenge_feedback (session_id);

ALTER TABLE public.challenge_feedback ENABLE ROW LEVEL SECURITY;

-- Each user can create and read/update their own feedback rows.
CREATE POLICY "Users manage their own challenge feedback"
    ON public.challenge_feedback
    FOR ALL
    USING      (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
