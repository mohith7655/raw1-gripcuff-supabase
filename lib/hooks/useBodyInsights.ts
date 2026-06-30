/**
 * useBodyInsights — fetches the AI body insight + recommendations for the given
 * body profile, served from cache when inputs are unchanged (see bodyAI.service).
 */
import { useEffect, useState } from 'react';
import { BodyAIInput, BodyInsights, getBodyInsights } from '../services/bodyAI.service';

export function useBodyInsights(input: BodyAIInput) {
  const [insights, setInsights] = useState<BodyInsights | null>(null);
  const [loading, setLoading] = useState(false);

  // Re-run only when the meaningful inputs change.
  const dep = JSON.stringify({
    g: input.gender, a: input.age, h: input.heightCm, w: input.weightKg,
    c: input.conditions, go: input.goals,
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getBodyInsights(input)
      .then((r) => { if (alive) setInsights(r); })
      .catch(() => { if (alive) setInsights(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep]);

  return { insights, loading };
}
