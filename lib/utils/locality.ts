// Derive a coarse "locality / area" string from a full address — used when a
// profile is viewed by OTHERS so we never reveal the exact place name, building
// or street number, only the broad area (e.g. "Hanamkonda, Telangana").
export function coarseLocality(address?: string | null, name?: string | null): string {
    if (!address) return '';
    const lowerName = (name ?? '').trim().toLowerCase();
    const parts = address
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
        // drop the exact place name
        .filter(p => p.toLowerCase() !== lowerName)
        // strip postal codes within a segment ("Telangana 506001" -> "Telangana")
        .map(p => p.replace(/\b\d{4,6}\b/g, '').trim())
        .filter(Boolean)
        // drop building / street-number-only segments ("9-5", "66/3", "20-3-13", "#12")
        .filter(p => !/^[#\d][\d\s\-\/.]*$/.test(p))
        // drop street / building-level segments so only locality & broader remain
        .filter(p => !/\b(road|rd|street|st|lane|ln|marg|cross|block|sector|phase|plot|flat|floor|door|h\.?\s?no)\b/i.test(p));
    if (parts.length === 0) return '';
    // Prefer city + state (3rd & 2nd from the end) to keep it to a broad area.
    if (parts.length >= 3) return `${parts[parts.length - 3]}, ${parts[parts.length - 2]}`;
    if (parts.length === 2) return parts.join(', ');
    return parts[0];
}
