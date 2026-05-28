export type MentionSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string };

export function parseMentions(text: string): MentionSegment[] {
  if (!text) return [{ type: 'text', value: '' }];
  const parts = text.split(/(@\w+)/g);
  return parts
    .filter(p => p.length > 0)
    .map(p => (/^@\w+$/.test(p) ? { type: 'mention', value: p } : { type: 'text', value: p }));
}
