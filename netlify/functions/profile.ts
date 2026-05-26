/**
 * netlify/functions/profile.ts
 *
 * Handles  GET /u/:slug
 * Fetches the user's public profile from Supabase and returns a
 * styled HTML page — instantly visible without JavaScript, includes
 * OG/Twitter meta tags for social sharing previews.
 */

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const APP_BASE      = 'https://raw1-supabase.netlify.app';

const HOBBY_LABELS: Record<string, string> = {
    gym: '🏋️ Gym', cycling: '🚴 Cycling', photography: '📷 Photography',
    reading: '📖 Reading', running: '🏃 Running', travel: '✈️ Travel',
    cooking: '🍳 Cooking', gaming: '🎮 Gaming', hiking: '🥾 Hiking',
    swimming: '🏊 Swimming', yoga: '🧘 Yoga', football: '⚽ Football',
    basketball: '🏀 Basketball', martial_arts: '🥋 Martial Arts',
    music: '🎵 Music', art: '🎨 Art',
};

async function supaRest(path: string) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: {
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
            Accept: 'application/json',
        },
    });
    if (!res.ok) return null;
    return res.json();
}

async function fetchProfile(slug: string) {
    const profileCols = [
        'id', 'qr_slug', 'bio', 'what_i_do', 'open_to_connect', 'looking_to_meet',
        'gym_name', 'gym_area', 'gym_address',
        'house_name', 'house_address',
        'park_name', 'park_address',
        'hobbies', 'community_note',
    ].join(',');

    const userCols = 'id,full_name,username,avatar_url,bio';

    let uid: string | null = null;
    let profileRow: any = null;
    let userRow:    any = null;

    // 1. Try profiles.qr_slug
    const bySlug = await supaRest(
        `profiles?qr_slug=eq.${encodeURIComponent(slug)}&select=${profileCols}&limit=1`,
    );
    if (Array.isArray(bySlug) && bySlug.length) {
        profileRow = bySlug[0];
        uid = profileRow.id;
    }

    // 2. Try users.username (case-insensitive) — picks up users without a profiles row
    if (!uid) {
        const byUsername = await supaRest(
            `users?username=ilike.${encodeURIComponent(slug)}&select=${userCols}&limit=1`,
        );
        if (Array.isArray(byUsername) && byUsername.length) {
            userRow = byUsername[0];
            uid = userRow.id;
        }
    }

    if (!uid) return null;

    // Fetch the other table if we don't already have it
    if (!profileRow) {
        const p = await supaRest(
            `profiles?id=eq.${encodeURIComponent(uid)}&select=${profileCols}&limit=1`,
        );
        if (Array.isArray(p) && p.length) profileRow = p[0];
    }
    if (!userRow) {
        const u = await supaRest(
            `users?id=eq.${encodeURIComponent(uid)}&select=${userCols}&limit=1`,
        );
        if (Array.isArray(u) && u.length) userRow = u[0];
    }

    if (!userRow && !profileRow) return null;

    return {
        id:               uid,
        full_name:        userRow?.full_name ?? null,
        username:         userRow?.username  ?? null,
        avatar_url:       userRow?.avatar_url ?? null,
        bio:              profileRow?.bio ?? userRow?.bio ?? null,
        what_i_do:        profileRow?.what_i_do ?? null,
        open_to_connect:  profileRow?.open_to_connect ?? true,
        looking_to_meet:  profileRow?.looking_to_meet ?? null,
        gym_name:         profileRow?.gym_name ?? null,
        gym_area:         profileRow?.gym_area ?? null,
        gym_address:      profileRow?.gym_address ?? null,
        house_name:       profileRow?.house_name ?? null,
        house_address:    profileRow?.house_address ?? null,
        park_name:        profileRow?.park_name ?? null,
        park_address:     profileRow?.park_address ?? null,
        hobbies:          profileRow?.hobbies ?? [],
        community_note:   profileRow?.community_note ?? null,
    };
}

const esc = (s: unknown) =>
    String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

function shortAddress(address?: string | null): string {
    if (!address) return '';
    const parts = address.split(',').map(p => p.trim()).filter(Boolean);
    return parts.slice(1, 3).join(', ') || address;
}

function renderProfile(p: Record<string, any>, slug: string): string {
    const name     = esc(p.full_name || 'RAW1 Athlete');
    const username = esc(p.username  || slug);
    const bio      = esc(p.bio       || '');
    const whatIDo  = esc(p.what_i_do || '');
    const avatar   = p.avatar_url ?? '';
    const openToConnect = p.open_to_connect !== false;

    const gymName    = esc(p.gym_name   || '');
    const gymAddr    = esc(shortAddress(p.gym_address || p.gym_area));
    const homeName   = esc(p.house_name || '');
    const homeAddr   = esc(shortAddress(p.house_address));
    const parkName   = esc(p.park_name  || '');
    const parkAddr   = esc(shortAddress(p.park_address));

    const lookingToMeet = p.looking_to_meet || 'both';
    const lookingLabel  =
        lookingToMeet === 'social'       ? 'Social connections & workout buddies'
        : lookingToMeet === 'professional' ? 'Professional connections & networking'
        : 'Social & professional connections';

    const hobbies: string[] = Array.isArray(p.hobbies)
        ? p.hobbies.filter((h: string) => HOBBY_LABELS[h]).slice(0, 6)
        : [];

    const communityNote = esc(p.community_note || '');

    const deepLink  = `raw1://profile/${encodeURIComponent(slug)}`;
    const webAppUrl = `${APP_BASE}/?slug=${encodeURIComponent(slug)}`;

    const ogImg  = avatar ? `<meta property="og:image" content="${esc(avatar)}" />` : '';
    const twImg  = avatar ? `<meta name="twitter:image" content="${esc(avatar)}" />` : '';
    const twCard = avatar ? 'summary_large_image' : 'summary';
    const metaDesc = p.bio || `${p.full_name || 'Someone'}'s fitness profile on RAW1`;

    const avatarHTML = avatar
        ? `<img src="${esc(avatar)}" alt="${name}" class="avatar-img" />`
        : `<div class="avatar-placeholder">👤</div>`;

    const bioSection = bio ? `
        <div class="card">
            <div class="card-label">About me</div>
            <p class="card-body">${bio}</p>
        </div>` : '';

    const whatSection = whatIDo ? `
        <div class="card">
            <div class="card-label">What I do</div>
            <div class="what-row"><span>💪</span><span class="card-value">${whatIDo}</span></div>
        </div>` : '';

    const lookingSection = `
        <div class="card">
            <div class="card-label">Looking to meet</div>
            <p class="card-body" style="margin-bottom:10px">${lookingLabel}</p>
            <div class="chip-row">
                <span class="chip chip-orange">Social</span>
                <span class="chip chip-green">Professional</span>
            </div>
        </div>`;

    const locationSection = [
        gymName  ? `<div class="loc-card"><div class="loc-icon">🏋️</div><div><div class="card-value">${gymName}</div>${gymAddr  ? `<div class="card-body">${gymAddr}</div>`  : ''}</div></div>` : '',
        homeName ? `<div class="loc-card"><div class="loc-icon">🏠</div><div><div class="card-value">${homeName}</div>${homeAddr ? `<div class="card-body">${homeAddr}</div>` : ''}</div></div>` : '',
        parkName ? `<div class="loc-card"><div class="loc-icon">🌳</div><div><div class="card-value">${parkName}</div>${parkAddr ? `<div class="card-body">${parkAddr}</div>` : ''}</div></div>` : '',
    ].filter(Boolean).join('');

    const locationsSection = locationSection ? `
        <div class="card">
            <div class="card-label">Workout spots</div>
            <div class="locs-list">${locationSection}</div>
        </div>` : '';

    const hobbiesSection = hobbies.length ? `
        <div class="card">
            <div class="card-label">Hobbies</div>
            <div class="chip-row">${hobbies.map(h => `<span class="chip chip-muted">${esc(HOBBY_LABELS[h])}</span>`).join('')}</div>
        </div>` : '';

    const communitySection = communityNote ? `
        <div class="card">
            <div class="card-label">Community</div>
            <div class="what-row">
                <span>🤝</span>
                <p class="card-body">${communityNote}</p>
            </div>
        </div>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <title>${name} — RAW1</title>
    <meta name="description" content="${esc(metaDesc)}" />
    <meta property="og:title"       content="${name} on RAW1" />
    <meta property="og:description" content="${esc(metaDesc)}" />
    <meta property="og:url"         content="${APP_BASE}/u/${encodeURIComponent(slug)}" />
    <meta property="og:type"        content="profile" />
    <meta property="og:site_name"   content="RAW1" />
    ${ogImg}
    <meta name="twitter:card"        content="${twCard}" />
    <meta name="twitter:title"       content="${name} on RAW1" />
    <meta name="twitter:description" content="${esc(metaDesc)}" />
    ${twImg}
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: #0d1520; color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            min-height: 100dvh; display: flex; flex-direction: column; align-items: center;
        }
        .topbar {
            width: 100%; padding: 16px 20px;
            display: flex; align-items: center; gap: 2px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .logo-raw { color: #fff;    font-weight: 800; font-size: 22px; letter-spacing: 2px; }
        .logo-one { color: #ff7a00; font-weight: 800; font-size: 22px; letter-spacing: 2px; }
        .container {
            width: 100%; max-width: 480px;
            padding: 0 20px 120px;
            display: flex; flex-direction: column; gap: 14px;
        }
        .hero {
            display: flex; flex-direction: column; align-items: center;
            gap: 10px; padding: 28px 0 18px;
        }
        .avatar-ring {
            width: 114px; height: 114px; border-radius: 57px;
            border: 3px solid #ff7a00;
            display: flex; align-items: center; justify-content: center;
            overflow: hidden; background: #0f2030; flex-shrink: 0;
        }
        .avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-placeholder { font-size: 52px; color: #ff7a00; }
        .hero-name   { font-size: 22px; font-weight: 800; text-align: center; }
        .hero-handle { font-size: 14px; color: #9ca3af; }
        .connect-pill {
            background: #ff7a00; border-radius: 100px;
            padding: 6px 18px; font-size: 12px; font-weight: 700; color: #000; margin-top: 2px;
        }
        .card {
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 16px; padding: 16px;
        }
        .card-label {
            font-size: 11px; font-weight: 800; color: #9ca3af;
            text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px;
        }
        .card-body  { font-size: 14px; color: #9ca3af; line-height: 1.55; }
        .card-value { font-size: 15px; font-weight: 600; color: #fff; }
        .what-row   { display: flex; align-items: center; gap: 8px; }
        .chip-row   { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
        .chip {
            padding: 5px 12px; border-radius: 100px;
            font-size: 12px; font-weight: 700;
        }
        .chip-orange { background: rgba(255,122,0,0.15); color: #ff7a00; border: 1px solid rgba(255,122,0,0.3); }
        .chip-green  { background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
        .chip-muted  { background: rgba(255,255,255,0.06); color: #d1d5db; border: 1px solid rgba(255,255,255,0.1); }
        .locs-list  { display: flex; flex-direction: column; gap: 12px; }
        .loc-card   { display: flex; align-items: center; gap: 12px; }
        .loc-icon   {
            width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
            background: rgba(255,122,0,0.12); border: 1px solid rgba(255,122,0,0.28);
            display: flex; align-items: center; justify-content: center; font-size: 20px;
        }
        .divider    { height: 1px; background: rgba(255,255,255,0.06); }
        .cta-fixed {
            position: fixed; bottom: 0; left: 0; right: 0;
            display: flex; flex-direction: column; gap: 10px;
            padding: 14px 20px 28px;
            background: linear-gradient(to top, #0d1520 70%, transparent);
            max-width: 480px; margin: 0 auto;
        }
        .btn-primary {
            display: block; width: 100%; background: #ff7a00; color: #000;
            font-size: 16px; font-weight: 800; text-align: center;
            padding: 16px; border-radius: 14px; text-decoration: none;
            border: none; cursor: pointer; transition: opacity 0.15s;
        }
        .btn-primary:hover { opacity: 0.88; }
        .btn-secondary {
            display: block; width: 100%;
            background: rgba(255,255,255,0.05); color: #fff;
            font-size: 15px; font-weight: 700; text-align: center;
            padding: 15px; border-radius: 14px; text-decoration: none;
            border: 1px solid rgba(255,255,255,0.12);
            cursor: pointer; transition: opacity 0.15s;
        }
        .btn-secondary:hover { opacity: 0.8; }
    </style>
</head>
<body>
    <div class="topbar">
        <span class="logo-raw">RAW</span><span class="logo-one">1</span>
    </div>
    <div class="container">
        <div class="hero">
            <div class="avatar-ring">${avatarHTML}</div>
            <div class="hero-name">${name}</div>
            ${username ? `<div class="hero-handle">@${username}</div>` : ''}
            <div class="connect-pill">${openToConnect ? 'Open to connect' : 'Connections by Request'}</div>
        </div>
        ${bioSection}
        ${whatSection}
        ${lookingSection}
        ${locationsSection}
        ${hobbiesSection}
        ${communitySection}
        <div class="divider"></div>
    </div>
    <div class="cta-fixed">
        <a href="${deepLink}" class="btn-primary">Open in RAW1 App</a>
        <a href="${webAppUrl}" class="btn-secondary">View Full Profile on Web</a>
    </div>
</body>
</html>`;
}

function renderNotFound(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Profile not found — RAW1</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            background: #0d1520; color: #fff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            min-height: 100dvh; display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 14px; padding: 24px; text-align: center;
        }
        .logo-raw { color: #fff;    font-weight: 800; font-size: 28px; letter-spacing: 2px; }
        .logo-one { color: #ff7a00; font-weight: 800; font-size: 28px; letter-spacing: 2px; }
        h1  { font-size: 20px; margin-top: 8px; }
        p   { color: #9ca3af; font-size: 14px; line-height: 1.5; max-width: 280px; }
        .home {
            margin-top: 8px; padding: 13px 28px;
            background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; color: #fff; text-decoration: none;
            font-size: 14px; font-weight: 700;
        }
    </style>
</head>
<body>
    <div><span class="logo-raw">RAW</span><span class="logo-one">1</span></div>
    <h1>Profile not found</h1>
    <p>This QR code doesn't match an active RAW1 profile.</p>
    <a href="${APP_BASE}" class="home">Go to RAW1</a>
</body>
</html>`;
}

export const handler = async (event: any): Promise<any> => {
    const parts = (event.path || '').split('/').filter(Boolean);
    const uIdx  = parts.indexOf('u');
    const slug  =
        uIdx !== -1 && parts[uIdx + 1]
            ? decodeURIComponent(parts[uIdx + 1])
            : (event.queryStringParameters?.slug ?? '').trim();

    if (!slug) {
        return { statusCode: 302, headers: { Location: APP_BASE }, body: '' };
    }

    try {
        const profile = await fetchProfile(slug);
        if (!profile) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
                body: renderNotFound(),
            };
        }
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
            },
            body: renderProfile(profile, slug),
        };
    } catch (err) {
        console.error('[profile fn] error:', err);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
            body: renderNotFound(),
        };
    }
};
