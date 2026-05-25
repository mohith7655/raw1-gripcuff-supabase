/**
 * Derives a stable numeric Agora UID from a Supabase UUID string.
 * Both sides of a session must use the same derivation so UIDs are consistent.
 *
 * Range: 0–99999. Collision probability is negligible for the 2-user sessions
 * this app creates, but callers should not assume uniqueness across all users.
 */
export function deriveAgoraUid(supabaseUid: string): number {
    const hex = supabaseUid.replace(/-/g, '').slice(0, 8);
    return parseInt(hex, 16) % 100000;
}
