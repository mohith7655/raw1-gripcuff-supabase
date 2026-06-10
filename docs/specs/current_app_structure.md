# RAW1 — Current State & Screen Map

> **Audience:** Web-based UX architect
> **Generated:** 2026-06-10 · against `main` @ commit `1802dac`
> **Scope:** Structural, functional, and layout reference only. No code logic included.

RAW1 is a cross-platform fitness app (one codebase ships native iOS/Android **and** the web PWA at `raw1.app`). It blends on-demand workout video, live "workout-together" video rooms, real-time challenges, a social graph (friends/chat/feed/clubs), QR-shareable social profiles, scheduling/reminders, and a credits/paywall monetization layer.

---

## Git Delta (What changed in the recent push)

The most recent work centers on a new **Social hub**, a **sectioned profile** system with per-section privacy, and **presence** (online/last-active). Listed newest → oldest:

| Commit | Date | Theme | What it touched (layout/functional impact) |
|---|---|---|---|
| `1802dac` | 06-10 | **Social cleanup** | Hid the **Daily Feed** post list and the **Clubs** section inside the Social tab (both still exist in code but are not rendered). Restored the previous Home profile card layout. |
| `1315bde` | 06-09 | Copy | Standardized American spelling "**Favorite(s)**" across all user-facing text (Home, Credits, All-Favorites). |
| `96858cc` | 06-09 | Social fixes | Fixed a friend-accept **403**, added a **public Activity section** to the viewed social profile, corrected the Favorites label. |
| `df24ad0` | 06-09 | **Profile privacy** | Introduced **per-section profile visibility** (Public/Private toggle per card) and a smaller "**Open to connect**" pill. Added `section_visibility` (jsonb) migration. |
| `a67844c` | 06-09 | **Social hub + presence** | New **Social tab** with a Feed · Friends · Chat segmented control (`FriendsHub`, `ChatHub` components). Sectioned Home profile card. **Presence heartbeat** (`last_active_at`) stamped on login/foreground. |
| `82bb163` | 06-06 | Profile maps | Restored the **locations map** on self/other/preview profile views. |
| `b570223` | 06-06 | Profile system | **Tier-dot avatars** app-wide, tap-to-profile, location privacy, and **AI-generated profile summary** (new Netlify function + migration). |

**Net effect for design:** the app now has a dedicated **Social** destination in the bottom tab bar, profiles are broken into independently toggleable cards, every avatar carries a tier ring, and users show an online/last-active state.

---

## Complete Architecture & Directory Map

### Tech stack

| Layer | Technology |
|---|---|
| Framework | **React Native 0.81 + Expo SDK 54** (managed, with dev-client) · React **19** |
| Web target | **react-native-web** — same components render the PWA (`web/index.html`, `public/manifest.json`, `public/sw.js` service worker) |
| Language | TypeScript (~5.9), strict-ish |
| Navigation | **React Navigation v7** — `native-stack` (root) + `bottom-tabs` (Home shell); deep-linking + URL parsing for shareable profiles |
| Backend | **Supabase** (`@supabase/supabase-js` v2) — Postgres, Auth, Realtime channels, Storage. SQL migrations in `supabase/migrations/`. |
| Serverless | **Netlify Functions** (`netlify/functions/`) for secrets-bound work: Agora tokens, Stripe checkout, Google Places, AI profile/exercise summaries |
| Real-time video/voice | **Agora** (`react-native-agora` native, `agora-rtc-sdk-ng` web) for live workout rooms & challenges |
| AI | **OpenAI** SDK (profile summaries, exercise purpose, AI trainer) |
| Payments | **Stripe** (subscriptions paywall + credits) |
| Casting | **Google Cast** (`react-native-google-cast`) — cast workout video to TV, with a custom receiver in `cast-receiver/` |
| 3D / anatomy | **three.js + @react-three/fiber/drei** — muscle visualizer (`.glb` body models) |
| Icons | **lucide-react-native** |
| State | React Context providers (no Redux). Async storage for persistence. |
| Misc | QR codes, Google Places autocomplete, expo-notifications (push/local), expo-speech (TTS cues), tz-lookup (timezones) |

### Directory map (`lib/` is the app root; root `App.tsx` → `lib/App.tsx`)

```
lib/
├── App.tsx                  # Root: providers, navigators, linking, global overlays
├── main.tsx                 # Web entry
├── screens/        (90+)    # Full-page views — see Screen Breakdown below
├── components/              # Reusable UI, grouped by domain
│   ├── feed/                # PostCard, CreatePost/Tweet/Video modals, Comments, SpeedDial
│   ├── social/              # ChatHub, FriendsHub  (new Social-tab panels)
│   ├── profile/             # ProfileCard, TierAvatar(+Ring), LocationsMap, City/Location pickers, chips
│   ├── workout/             # ExerciseListTab, WorkoutCompletionModal, InviteStrangerModal
│   ├── clubs/, credits/, rewards/, streak/, cast/   # domain modals & cards
│   └── (root)               # Challenge/Invite/Reminder/Video modals, NotificationBell, toggles
├── providers/      (12)     # Context: Auth, User, Friend, Library, Workout, WorkoutSession,
│                            #   Favorites, Notification, StrangerInvite, Access, Tier
├── services/       (60+)    # Data/business layer talking to Supabase, Agora, Stripe, OpenAI
│   ├── agora/, cast/        # video/voice & casting helpers (platform-split files)
├── hooks/          (25+)    # useFeed, useFavorites, useNotifications, useCast, useWorkoutTimer, …
├── models/                  # TS types: User, SocialProfile, Friend, Chat, Video, WorkoutSession…
├── core/
│   ├── config/              # supabase.ts, api_keys.ts
│   ├── theme/app_theme.ts   # AppTheme + CoachingTheme + type/spacing tokens (PRIMARY design system)
│   └── navigation.ts        # navigationRef singleton
├── constants/               # theme.ts (spacing), videoUrls.ts
├── data/                    # preRecordedPrograms, workoutCues (static content)
└── utils/                   # locality, timezone, cropImage, parseMentions, date helpers
```

### Provider nesting (top → bottom in `App.tsx`)

```
ErrorBoundary
└─ AuthProvider          (Supabase session, supabaseUserId)
   └─ FavoritesProvider
      └─ UserProvider    (profile, appMode: ai | coaching)
         └─ FriendProvider   (friends, incoming/outgoing requests, search)
            └─ LibraryProvider
               └─ WorkoutProvider
                  └─ WorkoutSessionProvider   (live invites, unread invite count)
                     └─ NotificationProvider
                        └─ AccessProvider      (paywall/entitlement gate)
                           └─ TierProvider     (uid-keyed tier-ring cache)
                              └─ MainApp        (navigators + global overlays)
```

### Navigation topology

- **Root = native stack.** Branches on auth:
  - **Signed-out → `AuthStack`:** `Welcome` · `Login` · `SignUp` (+ `ScannedProfileScreen` as deep-link landing).
  - **Signed-in → `AppStack`:** `HomeTabs` (default) or `Onboarding`, plus ~40 pushed screens in a modal group.
- **`HomeTabs` = bottom tab bar with 3 tabs:**
  1. **Home** (`HomeScreen`)
  2. **Social** (`FeedScreen`) — Users icon
  3. **Workouts / Explore Coaches** (`LibraryScreen`) — label & icon swap with `appMode`
- **Deep linking:** shareable public profiles resolve via multiple URL shapes — `/u/:slug`, `/profile/:slug`, `/p/:uid`, `raw1://profile/...`, and query/hash variants — all routing to `ScannedProfileScreen`.
- **Global overlays mounted above navigation:** `GripcuffSurveyModal`, `PaywallScreen`, in-app **Challenge invite** accept/decline prompt, and the fullscreen **WorkoutReminder** alarm modal. A `WorkoutInviteModal` sits inside the signed-in stack.

---

## Screen-by-Screen Breakdown

Grouped by functional area. "Tab" = reachable from the bottom bar; everything else is pushed onto the stack.

### 1. Auth & Onboarding
| Screen | Function & layout |
|---|---|
| `SplashScreen` | Brand splash / boot loader. |
| `WelcomeScreen` | Entry CTA → Login / SignUp. |
| `LoginScreen` / `SignUpScreen` | Supabase auth forms. |
| `OnboardingScreen` | First-run profile completion; gesture-locked. Shown when local onboarding flag absent and no full name. |

### 2. Home Tab
| Screen | Function & layout |
|---|---|
| **`HomeScreen`** (Tab) | Personalized dashboard. Top: **sectioned profile card** (restored layout), streak, "Open to connect" pill. An **app-mode toggle** switches between standard, **AI** trainer, and **coaching** experiences (drives theme + Library tab label). Surfaces Favorites, recently-watched, recommended workouts, today's challenge, and reminder prompts. Hosts a `NotificationBell`. |

### 3. Social Tab (the recently-rebuilt hub)
| Screen / Component | Function & layout |
|---|---|
| **`FeedScreen`** (Tab, titled "**Social**") | Header (back + "Social" title) over a **segmented control: Feed · Friends · Chat**, each with a count badge (friend requests, unread chats). Body swaps by segment. **Feed** segment currently shows two entry cards — **Enter Challenge Lobby** and **Invite a Friend to Workout** — plus a SpeedDial to create Post/Tweet/Video. *(The Daily Feed post list and the Clubs section are built but hidden as of `1802dac`.)* |
| `FriendsHub` (component) | Single scroll: search field, **incoming/outgoing requests**, current **friends**, and **suggestions** (with streak + workout counts). Per-row actions: add / accept / decline, message, tier avatar → profile. |
| `ChatHub` (component) | Conversation list of friends ordered by last-message recency, unread counts, tier avatars → chat room. |
| `CommunityScreen` | Broader community view. |
| `LeaderboardScreen` | Ranked progress board. |
| `FriendsScreen` | Standalone friends management (legacy/secondary to FriendsHub). |
| `ChatInboxScreen` · `ChatRoomScreen` · `ChatFriendProfileScreen` | DM inbox, 1:1 chat thread, and friend profile from chat. |
| `InviteFriendsFlow` | Contact-based invite flow. |

### 4. Social Profile System
| Screen | Function & layout |
|---|---|
| `SocialProfileScreen` | Public-facing profile of **another** user: avatar with tier ring, bio / "what I do", **connection goals**, **hobbies**, **locations map**, **AI summary**, and a **public Activity section**. Honors per-section privacy. |
| `ProfileScreen` | The owner's own profile, broken into **independently toggleable cards** (`ProfileCard` with a Public/Private footer toggle), AI summary, locations map. |
| `EditSocialProfileScreen` | Edit bio, what-I-do, goals, hobbies, places (Google Places pickers), privacy. |
| `ScannedProfileScreen` | Deep-link landing for a shared profile (QR / URL), works signed-in or out. |
| `QRCodeScreen` · `QRProfileScreen` | Show own QR / view a scanned profile by slug. |
| `LookingToMeetEditScreen` | Edit "looking to meet" connection preferences. |
| `AccountSettingsScreen` | Account/settings management. |
| `BadgesScreen` | Earned badges/achievements grid. |

### 5. Workout Library & Playback (Workouts / Explore-Coaches Tab)
| Screen | Function & layout |
|---|---|
| **`LibraryScreen`** (Tab) | Catalog hub; label/icon morph to "Explore Coaches" in coaching mode. |
| `WorkoutsScreen` · `VideoDashboard` | Browsable workout/video collections. |
| `CategoryVideosScreen` · `BodyPartVideosScreen` · `GripCuffVideosScreen` | Filtered video lists by category / body part / program. |
| `MuscleGrowthScreen` · `StretchingScreen` · `AthleticPerformanceScreen` · `InjuryRehabScreen` · `GripCuffTrainingScreen` | Themed program landing pages. |
| `PreRecordedProgramsScreen` · `RecommendationScreen` · `RecommendationScreen` | Curated/recommended programs. |
| `VideoDetailScreen` · `FacePullDetailsPage` | Exercise/video detail with purpose, muscle visualizer. |
| `VideoPlayerScreen` | Core player: workout/timer modes, TTS cues, casting, invite-to-watch, engagement tracking. |
| `AllFavouritesScreen` · `AllRecentlyWatchedScreen` | "See all" lists for Favorites & history. |
| `ExploreCoaches` · `PersonalTrainerScreen` · `AITrainerScreen` | Coaching-mode browse + AI/personal trainer experiences. |
| `WorkoutStep1Screen` · `WorkoutStep2Screen` · `WorkoutResultScreen` | Guided multi-step workout flow → results. |

### 6. Live / Together / Challenges
| Screen | Function & layout |
|---|---|
| `WorkoutWithFriendFlow` | Pick a workout + schedule/invite a friend to train together. |
| `SyncedVideoPlayerScreen` | Synchronized co-watching playback. |
| `AgoraVideoRoom` (+ `.web`) | Live multi-party video workout room (gesture-locked). |
| `ChallengeVideoRoom` | 1:1 timed **exercise challenge** room: intro call, live video stage, rep input, post-challenge questionnaire. |
| `UpcomingSessionsScreen` | Scheduled/invited sessions list; join, see Q&A history. |

### 7. Reminders & Scheduling
| Screen | Function & layout |
|---|---|
| `MoveReminderScreen` | Configure "reminder to move" alarms (intervals, recurrence). |
| (Global) `WorkoutReminderModal` | Fullscreen alarm overlay fired by a persistent foreground reminder clock; "Start now" jumps into a workout. |

### 8. Clubs (built, partially surfaced)
| Screen | Function & layout |
|---|---|
| `ClubsScreen` · `ClubDetailScreen` · `ClubChatScreen` | Club discovery, detail, and group chat. *(Clubs entry currently hidden inside the Social feed segment.)* |

### 9. Monetization
| Screen | Function & layout |
|---|---|
| `PaywallScreen` | Global subscription paywall overlay (Stripe). |
| `CreditsScreen` · `EarnCreditsScreen` | Credit balance, buy credits, earn-credit tasks. |
| `GripcuffSurveyModal` | Gating survey overlay. |

---

## Present Design Tokens & Theme Constraints

The design system is centralized in **`lib/core/theme/app_theme.ts`** (primary) with spacing helpers in `lib/constants/theme.ts`. There is **no Tailwind / no global stylesheet** — styling is per-component `StyleSheet.create`, so these tokens are the shared contract.

### Brand accent system (strict two-tier orange)
> Documented in code and in persistent memory — **must be respected**.

| Token | Value | Usage rule |
|---|---|---|
| `BRAND_ACCENT` | `#E89951` (warm orange) | General brand accent — secondary buttons, selected pills/chips, toggles, sliders, text/number accents, icons, borders, glows. |
| `CTA_ORANGE` | `#FF6B00` (bright orange) | **Reserved only** for primary commit actions: Save, Update, Post, Buy, Start Workout, Send Invite, Challenge, Join, Schedule. |
| `accentAlpha(a)` | `rgba(232,153,81,a)` | Translucent accent for soft backgrounds, borders, glows. |

### Core palette — `AppTheme` (standard / AI mode)
| Token | Value | Role |
|---|---|---|
| `background` | `#0F172A` | App background (slate-950). *Note: navigation containers also use `#0d1520`.* |
| `cardColor` | `#1E293B` | Card surface (slate-800). |
| `primaryColor` | `#F97316` | Orange primary (legacy/nav). |
| `textWhite` | `#FFFFFF` | Primary text. |
| `textGrey` | `#94A3B8` | Secondary/muted text (slate-400) — the app-wide "muted" color. |
| `inactiveColor` | `#334155` | Inactive/disabled. |
| `metalGray` `silver` `orange` `darkBackground` | `#465060` `#a6afc2` `#e46600` `#1d2337` | Accent/metallic UI accents. |

### `CoachingTheme` (premium coaching mode — steel-blue, replaces orange)
Deep black-blue backgrounds (`#020509` / `#0a1628` cards), **steel-blue primary `#4E87A0`** (with `primaryLight #6BA3B8`, glows & borders at low alpha), soft white-blue text `#f0f8ff`, muted blue-grey text `#4a7a9b`. Selected by `appMode === 'coaching'` and swaps the tab bar tint, Library tab label/icon, and surface colors.

### Common ad-hoc colors seen across components
`#94A3B8` (muted text), `#0d1520` (deep nav background), `#22C55E` (success/online green), `#EF4444` (danger/decline red), `#FF6B00` (CTA), `#E89951` (accent). The challenge/invite overlays use translucent accent borders `rgba(232,153,81,0.35)` and shadows.

### Typography
| Scale | Sizes |
|---|---|
| `FontSizes` | h1 28 · h2 24 · h3 20 · h4 18 · h5 16 · body 14 · small 12 |
| `FontWeights` | light 300 · regular 400 · medium 500 · semibold 600 · bold 700 |
| `TextStyles` presets | titleLarge, titleMedium, subtitle, bodyMedium, chipText, buttonText, bodySmall (composed from the above; default text white, muted = `#94A3B8`). |

System default font family (no custom font loaded).

### Spacing, radius & layout constants
| Token set | Values |
|---|---|
| `Spacing` / `SPACING` | xs 4 · sm 8 · md 16 · lg 24 · xl 32 · xxl 48 |
| `SCREEN_PADDING` | 20 |
| `BorderRadius` | small 8 · medium 12 · large 16 · rounded 24 |
| `CARD_BORDER_RADIUS` | 12 · `CARD_GAP` 12 |
| Profile cards (`ProfileCard`) | bg `rgba(255,255,255,0.04)`, border `rgba(255,255,255,0.06)`, **radius 16**, default padding 16. |
| Tab bar | height 60, paddingBottom 8, label 11px/600; active tint = theme primary, inactive = muted. |

### Avatar / tier system (app-wide)
Every profile picture renders through **`TierAvatar` / `TierAvatarRing`**, drawing a tier-colored ring around the avatar. Tier data is cached per-uid in **`TierContext`**. Avatars are tappable → navigate to the corresponding social profile. This is a global visual convention any new profile-bearing surface should reuse rather than re-implement.

### Design constraints summary for the UX architect
1. **Two-tier orange is law** — never use `#FF6B00` for non-commit UI; use `#E89951` for accents.
2. **Two visual modes** — standard/AI (slate + orange) vs coaching (black-blue + steel-blue). New screens should read `appMode` and pull the right theme object.
3. **No utility-CSS framework** — tokens are imported constants; keep new components consuming `AppTheme`/`CoachingTheme` + the spacing/radius/type scales rather than hardcoding.
4. **Cards** standardize on `rgba(255,255,255,0.04)` surfaces, 16-radius, hairline white borders.
5. **Cross-platform parity** — every layout must hold on web (react-native-web PWA) and native; several components are platform-split (`.web.tsx` / `.native.tsx`) for maps, video, casting, and camera tiles.
6. **Privacy is per-section** — profile surfaces carry a Public/Private toggle and must respect `sectionVisibility`.
