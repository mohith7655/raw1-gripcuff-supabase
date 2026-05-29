# Raw1 App — Design Reference

## Theme Modes

The app supports two visual themes toggled via `appMode`:

| Mode | Purpose | Primary Color |
|------|---------|---------------|
| **Default** | Standard user experience | Orange `#F97316` |
| **Coaching** | Premium coach experience | Steel blue `#4E87A0` |

Theme definitions live in [lib/core/theme/app_theme.ts](lib/core/theme/app_theme.ts). Screen-level layout constants are in [lib/constants/theme.ts](lib/constants/theme.ts).

---

## Color Palette

### Base (Default Mode)

| Token | Value | Usage |
|-------|-------|-------|
| `background` | `#0F172A` | Screen backgrounds |
| `cardColor` | `#1E293B` | Card surfaces |
| `primaryColor` | `#F97316` | Buttons, icons, active states |
| `textWhite` | `#FFFFFF` | Primary text |
| `textGrey` | `#94A3B8` | Secondary / muted text |
| `inactiveColor` | `#334155` | Inactive tabs, borders |
| `metalGray` | `#465060` | Mid-tone elements |
| `silver` | `#a6afc2` | Subtle labels |

### Base (Coaching Mode)

| Token | Value |
|-------|-------|
| `background` | `#020509` |
| `cardColor` | `#0a1628` |
| `primaryColor` | `#4E87A0` |
| `textWhite` | `#f0f8ff` |
| `textGrey` | `#4a7a9b` |
| `border` | `rgba(78,135,160,0.1)` |

### Accent Colors (used across the app)

| Name | Value | Usage |
|------|-------|-------|
| Orange primary | `#FF6B00` | Buttons, badges, active tabs |
| Orange warm | `#FF7A00` | Profile ring, icons |
| Orange dark | `#D4622A` | Credits screen buttons |
| Green | `#22c55e` | Success, completed states |
| Green soft bg | `rgba(34,197,94,0.12)` | Chip backgrounds |
| Blue | `#3b82f6` | "Looking to meet" chips |
| Blue soft bg | `rgba(59,130,246,0.12)` | Blue chip backgrounds |
| Purple | `#8B5CF6` | Lifter badge tier |
| Gold | `#D4AF37` | Influencer badge tier |
| Red | `#ef4444` | Destructive actions |
| Cyan | `#4FC3F7` | Info notifications |
| Emerald | `#34d399` | Positive feedback |

### Surface Overlays

| Value | Usage |
|-------|-------|
| `rgba(255,255,255,0.04)` | Card background |
| `rgba(255,255,255,0.06)` | Card border, dividers |
| `rgba(255,255,255,0.08)–0.12` | Elevated surfaces |
| `rgba(0,0,0,0.55)–0.80` | Modal overlays |
| `rgba(255,122,0,0.12)` | Orange soft background |
| `rgba(255,122,0,0.28)` | Orange soft border |

---

## Typography

Defined in [lib/core/theme/app_theme.ts](lib/core/theme/app_theme.ts).

### Font Sizes

| Token | Size |
|-------|------|
| `h1` | 28px |
| `h2` | 24px |
| `h3` | 20px |
| `h4` | 18px |
| `h5` | 16px |
| `body` | 14px |
| `small` | 12px |

### Font Weights

| Token | Weight |
|-------|--------|
| `light` | 300 |
| `regular` | 400 |
| `medium` | 500 |
| `semibold` | 600 |
| `bold` | 700 |
| extra-bold | 800 |

### Common Text Combinations

| Style | Size | Weight | Color |
|-------|------|--------|-------|
| `titleLarge` | 24px | 700 | white |
| `titleMedium` | 18px | 600 | white |
| `subtitle` | 14px | 400 | grey |
| `bodyMedium` | 14px | 500 | white |
| `chipText` | 12px | 600 | white |
| `buttonText` | 14px | 700 | white |
| `bodySmall` | 12px | 400 | grey |

---

## Spacing & Layout

Defined in [lib/constants/theme.ts](lib/constants/theme.ts).

### Spacing Scale

| Token | Value |
|-------|-------|
| `xs` | 4px |
| `sm` | 8px |
| `md` | 16px |
| `lg` | 24px |
| `xl` | 32px |
| `xxl` | 48px |

### Key Constants

| Constant | Value | Usage |
|----------|-------|-------|
| `SCREEN_PADDING` | 20px | Horizontal padding on all screens |
| Card gap | 12px | Gap between cards/grid items |
| Tab bar height | 60px | Bottom navigation bar |
| Tab bar padding bottom | 8px | Tab bar inner padding |

### Border Radius

| Context | Value |
|---------|-------|
| Small elements (inputs, tags) | 8px |
| Standard cards | 12px |
| Large cards / balance card | 16px |
| Bottom sheets | 20–24px |
| Pill buttons | 100 (fully rounded) |
| Avatars | 50% (size / 2) |
| Icon boxes | 12px |
| Day streak dots | 20px (40px circle) |

---

## Navigation Structure

Defined in [App.tsx](App.tsx).

### Auth vs App

```
NavigationContainer
├── AuthStack  (unauthenticated)
│   ├── ScannedProfileScreen  (deep link entry)
│   ├── WelcomeScreen
│   ├── LoginScreen
│   └── SignUpScreen
└── AppStack  (authenticated)
    ├── HomeTabs  (bottom tab navigator)
    │   ├── Home → HomeScreen
    │   ├── Library/Coaches → LibraryScreen / ExploreCoaches
    │   └── Profile → ProfileScreen
    └── [Modal / Stack Screens]
```

### Tab Bar

| Tab | Screen | Icon |
|-----|--------|------|
| Home | HomeScreen | `Home` |
| Workouts / Coaches | LibraryScreen / ExploreCoaches | `Dumbbell` / `Users` |
| Profile | ProfileScreen | (user icon) |

Tab bar styles: dark background matching theme, orange active tint, 11px / 600-weight labels.

### Stack Screens (selected)

| Screen | Route Name |
|--------|------------|
| VideoPlayerScreen | `VideoPlayer` |
| ProfileScreen | `ProfileScreen` |
| CreditsScreen | `CreditsScreen` |
| AllFavouritesScreen | `AllFavourites` |
| BadgesScreen | `BadgesScreen` |
| ChatRoomScreen | `ChatRoom` |
| AgoraVideoRoom | `AgoraVideoRoom` |
| ClubDetailScreen | `ClubDetailScreen` |
| EditSocialProfileScreen | `EditSocialProfileScreen` |

Deep link prefixes: `raw1://`, `https://raw1.app`, `https://www.raw1.app`  
Profile route format: `/u/:slug`, `/p/:uid`

---

## Component Library

### Profile Components — [lib/components/profile/](lib/components/profile/)

| Component | Description |
|-----------|-------------|
| `StatPill` | 3-column row: Day Streak · Workouts · PRs |
| `ProfileCard` | Shared card wrapper (rgba bg + border, 16px radius) |
| `ChipPill` | Solid-fill pill (orange / green / blue) |
| `HobbyCircle` | 56px orange-outlined circle with icon + label |
| `LocationRow` | Icon box + place name + address |
| `BottomActionBar` | Fixed footer: outlined "Message" + orange "Connect" |
| `LocationMapPreview` | Map preview (native + web variants) |
| `LocationPickerField` | Location text input (native + web) |
| `CityPickerField` | City picker (native + web) |

### Core UI Components — [lib/components/](lib/components/)

| Component | Description |
|-----------|-------------|
| `GridVideoCard` | Video thumbnail with play icon, duration, heart icon |
| `TodaysChallengeCard` | Daily challenge card with refresh countdown |
| `DailyReminderCard` | Reminder card with enable/disable toggle |
| `AccessBadge` | Status pill: Subscribed / Gripcuff Active / Not Activated |
| `WebSafeAvatar` | Cross-platform avatar image with fallback |
| `NotificationBell` | Bell icon with badge count overlay |
| `ProgramLibraryView` | Program grid layout |
| `LibraryViewCards` | Library card variants |
| `WorkoutReminderBanner` | Banner notification for reminders |
| `UnifiedProgressLeaderboard` | Leaderboard with progress bars |
| `ExerciseTimerSheet` | Exercise timer bottom sheet |
| `IntervalAlertsConfig` | Interval alert configuration |
| `TimeArrowPicker` | Time picker with arrow navigation |
| `MovementEquivalenceCard` | Movement comparison card |
| `IntensityComparisonCard` | Intensity visualization card |

### Streak & Rewards — [lib/components/streak/](lib/components/streak/), [lib/components/rewards/](lib/components/rewards/)

| Component | Description |
|-----------|-------------|
| `StreakCard` | Animated flame + 7-day dot row + weekly progress bar |
| `RewardUnlockModal` | Badge display with confetti animation + credit pill |

### Modals

| Component | Trigger |
|-----------|---------|
| `WorkoutStartModal` | 10s countdown before workout begins |
| `DailyReminderModal` | Configure daily reminder time |
| `IncomingStrangerInvitePopup` | Incoming workout invite from stranger |
| `StrangerInviteSenderModal` | Send workout invite |
| `WorkoutCompletionModal` | Post-workout results |
| `GripcuffSurveyModal` | Grip cuff onboarding survey |

### Feed — [lib/components/feed/](lib/components/feed/)

| Component | Description |
|-----------|-------------|
| `PostCard` | Social post with reactions |
| `CreatePostModal` | New post composer |
| `CommentsSheet` | Comments bottom sheet |
| `SpeedDial` | Floating action button with actions |
| `MentionTextInput` | Text input with @mention dropdown |

### Cast — [lib/components/cast/](lib/components/cast/)

| Component | Description |
|-----------|-------------|
| `CastButton` | Chromecast trigger button |
| `CastStatusBanner` | Active cast indicator |
| `RemoteControlBar` | Remote playback controls |

---

## Screen Inventory

### Main Screens

| Screen | File |
|--------|------|
| Home dashboard | [lib/screens/HomeScreen.tsx](lib/screens/HomeScreen.tsx) |
| Profile | [lib/screens/ProfileScreen.tsx](lib/screens/ProfileScreen.tsx) |
| Credits | [lib/screens/CreditsScreen.tsx](lib/screens/CreditsScreen.tsx) |
| Library | [lib/screens/LibraryScreen.tsx](lib/screens/LibraryScreen.tsx) |
| Social feed | [lib/screens/FeedScreen.tsx](lib/screens/FeedScreen.tsx) |
| Community | [lib/screens/CommunityScreen.tsx](lib/screens/CommunityScreen.tsx) |
| Badges | [lib/screens/BadgesScreen.tsx](lib/screens/BadgesScreen.tsx) |
| Leaderboard | [lib/screens/LeaderboardScreen.tsx](lib/screens/LeaderboardScreen.tsx) |

### Content & Video

| Screen | File |
|--------|------|
| Video player | [lib/screens/VideoPlayerScreen.tsx](lib/screens/VideoPlayerScreen.tsx) |
| Video detail | [lib/screens/VideoDetailScreen.tsx](lib/screens/VideoDetailScreen.tsx) |
| Synced video player | [lib/screens/SyncedVideoPlayerScreen.tsx](lib/screens/SyncedVideoPlayerScreen.tsx) |
| Video dashboard | [lib/screens/VideoDashboard.tsx](lib/screens/VideoDashboard.tsx) |
| Category videos | [lib/screens/CategoryVideosScreen.tsx](lib/screens/CategoryVideosScreen.tsx) |
| Body part videos | [lib/screens/BodyPartVideosScreen.tsx](lib/screens/BodyPartVideosScreen.tsx) |
| Pre-recorded programs | [lib/screens/PreRecordedProgramsScreen.tsx](lib/screens/PreRecordedProgramsScreen.tsx) |
| All favourites | [lib/screens/AllFavouritesScreen.tsx](lib/screens/AllFavouritesScreen.tsx) |

### Training

| Screen | File |
|--------|------|
| Workout step 1 | [lib/screens/WorkoutStep1Screen.tsx](lib/screens/WorkoutStep1Screen.tsx) |
| Workout step 2 | [lib/screens/WorkoutStep2Screen.tsx](lib/screens/WorkoutStep2Screen.tsx) |
| Workout result | [lib/screens/WorkoutResultScreen.tsx](lib/screens/WorkoutResultScreen.tsx) |
| GripCuff training | [lib/screens/GripCuffTrainingScreen.tsx](lib/screens/GripCuffTrainingScreen.tsx) |
| GripCuff videos | [lib/screens/GripCuffVideosScreen.tsx](lib/screens/GripCuffVideosScreen.tsx) |
| Muscle growth | [lib/screens/MuscleGrowthScreen.tsx](lib/screens/MuscleGrowthScreen.tsx) |
| Stretching | [lib/screens/StretchingScreen.tsx](lib/screens/StretchingScreen.tsx) |
| Athletic performance | [lib/screens/AthleticPerformanceScreen.tsx](lib/screens/AthleticPerformanceScreen.tsx) |
| Injury rehab | [lib/screens/InjuryRehabScreen.tsx](lib/screens/InjuryRehabScreen.tsx) |

### Social & Profile

| Screen | File |
|--------|------|
| Edit social profile | [lib/screens/EditSocialProfileScreen.tsx](lib/screens/EditSocialProfileScreen.tsx) |
| Social profile | [lib/screens/SocialProfileScreen.tsx](lib/screens/SocialProfileScreen.tsx) |
| Scanned profile | [lib/screens/ScannedProfileScreen.tsx](lib/screens/ScannedProfileScreen.tsx) |
| QR profile | [lib/screens/QRProfileScreen.tsx](lib/screens/QRProfileScreen.tsx) |
| Friends | [lib/screens/FriendsScreen.tsx](lib/screens/FriendsScreen.tsx) |
| Chat inbox | [lib/screens/ChatInboxScreen.tsx](lib/screens/ChatInboxScreen.tsx) |
| Chat room | [lib/screens/ChatRoomScreen.tsx](lib/screens/ChatRoomScreen.tsx) |
| Clubs | [lib/screens/ClubsScreen.tsx](lib/screens/ClubsScreen.tsx) |
| Club detail | [lib/screens/ClubDetailScreen.tsx](lib/screens/ClubDetailScreen.tsx) |
| Club chat | [lib/screens/ClubChatScreen.tsx](lib/screens/ClubChatScreen.tsx) |

### Coaching & AI

| Screen | File |
|--------|------|
| Personal trainer | [lib/screens/PersonalTrainerScreen.tsx](lib/screens/PersonalTrainerScreen.tsx) |
| AI trainer | [lib/screens/AITrainerScreen.tsx](lib/screens/AITrainerScreen.tsx) |
| Explore coaches | [lib/screens/ExploreCoaches.tsx](lib/screens/ExploreCoaches.tsx) |
| Recommendation | [lib/screens/RecommendationScreen.tsx](lib/screens/RecommendationScreen.tsx) |
| Live room | [lib/screens/AgoraVideoRoom.web.tsx](lib/screens/AgoraVideoRoom.web.tsx) |

### Auth & Onboarding

| Screen | File |
|--------|------|
| Welcome | [lib/screens/WelcomeScreen.tsx](lib/screens/WelcomeScreen.tsx) |
| Login | [lib/screens/LoginScreen.tsx](lib/screens/LoginScreen.tsx) |
| Sign up | [lib/screens/SignUpScreen.tsx](lib/screens/SignUpScreen.tsx) |
| Onboarding | [lib/screens/OnboardingScreen.tsx](lib/screens/OnboardingScreen.tsx) |
| Splash | [lib/screens/SplashScreen.tsx](lib/screens/SplashScreen.tsx) |

### Monetization

| Screen | File |
|--------|------|
| Credits | [lib/screens/CreditsScreen.tsx](lib/screens/CreditsScreen.tsx) |
| Earn credits | [lib/screens/EarnCreditsScreen.tsx](lib/screens/EarnCreditsScreen.tsx) |
| Paywall | [lib/screens/PaywallScreen.tsx](lib/screens/PaywallScreen.tsx) |

---

## UI Patterns

### Cards

Standard card: `rgba(255,255,255,0.04)` background, `1px rgba(255,255,255,0.06)` border, 12–16px radius, 14–24px padding. Used by `ProfileCard` and inline `View` wrappers throughout.

### Buttons

**Primary (orange fill)**
- Background: `#FF6B00`
- Text: black or white, 700–800 weight, 14px
- Radius: 12px (square) or 100 (pill)
- Padding: ~12px horizontal, 10–11px vertical

**Secondary (outlined)**
- Border: `1px rgba(255,255,255,0.2)`
- Background: transparent
- Text: white

**Completed / disabled state**
- Background: `#1a4a2a` (dark green)
- Text: `#4CAF50`

### Pills / Chips

Fully rounded (`borderRadius: 100`), 8–14px horizontal padding. Color families:
- Orange: `rgba(255,122,0,0.12)` bg + `rgba(255,122,0,0.28)` border + `#ff7a00` text
- Green: `rgba(34,197,94,0.12)` bg + `rgba(34,197,94,0.28)` border + `#22c55e` text
- Blue: `rgba(59,130,246,0.12)` bg + `rgba(59,130,246,0.28)` border + `#3b82f6` text
- Privacy pill (active): solid orange bg + black text

### Modals / Bottom Sheets

- Overlay: `rgba(0,0,0,0.7–0.8)` full-screen backdrop
- Sheet: `#0d1520` or `#131f2e` background, 20–24px top radius, `paddingBottom: 40`
- Max height: ~85% of screen
- Animation: `slide` or `fade`

### Avatars

Circular images (`borderRadius: size/2`). Fallback: colored circle with `CircleUserRound` icon in orange. Common sizes: 42px (friend list), 52px (compact), 80px (social cards), 134px (own profile hero).

Profile ring: 3px solid orange border, slightly larger than avatar.

### Streak / Progress Indicators

- Day dots: 40px circles, active = solid orange with glow shadow, inactive = `rgba` surface
- Progress bar: 4px height, 2px radius, orange fill
- Flame emoji: 1.14× pulse animation, 1400ms cycle

### Badge Tiers

| Tier | Color |
|------|-------|
| Locked | `rgba(255,255,255,0.04)` (grey) |
| Starter | `#1E3A5F` (dark blue) |
| Lifter | `#7C3AED` (purple) |
| Trainer | `#F97316` (orange) |
| Influencer | `#D4AF37` (gold) |

Badge shape: 64px rounded square (18px radius), 1.5px border in tier color, emoji centered.

### Notification Dots

8–36px circles depending on context. Common colors: cyan `#4FC3F7`, orange `#FF6B00`, purple `#a78bfa`, emerald `#34d399`. Background at 0.12 opacity, solid dot with white count text.

### Animations

| Element | Animation |
|---------|-----------|
| Streak flame | 1.14× scale pulse, 1400ms loop |
| Confetti (reward unlock) | Spring, radiating outward |
| Progress bar fill | 700ms timing, cubic easing |
| Heart favorite | 1.2× spring bounce on toggle |
| Workout countdown | 10s linear, color + opacity transition |
| Skeleton loading | Opacity 0.45 → 1 → 0.45, 850ms per direction |

---

## Badge & Access Status Badges

| Status | Background | Text Color | Label |
|--------|------------|------------|-------|
| Subscribed | Green | White | ⭐ Subscribed |
| Gripcuff Active | Green | White | 🔧 Gripcuff Active |
| Not Activated | Orange | White | 🔒 Not Activated |

Style: 11px, weight 700, 12px horizontal padding, 4px vertical, 20px radius.

---

## Key Files Reference

| File | Purpose |
|------|---------|
| [lib/core/theme/app_theme.ts](lib/core/theme/app_theme.ts) | AppTheme + CoachingTheme tokens, font scale, spacing, text styles |
| [lib/constants/theme.ts](lib/constants/theme.ts) | SCREEN_PADDING, card constants |
| [App.tsx](App.tsx) | Navigation tree, theme switching, deep links |
| [lib/screens/ProfileScreen.tsx](lib/screens/ProfileScreen.tsx) | Local `C` token object (lines 61–76) |
| [lib/components/profile/ProfileCard.tsx](lib/components/profile/ProfileCard.tsx) | Shared card wrapper |
| [lib/components/profile/StatPill.tsx](lib/components/profile/StatPill.tsx) | Streak / workout / PR stat row |
| [lib/services/badge.types.ts](lib/services/badge.types.ts) | Badge families, tier colors, tier names |
| [lib/services/rewards.service.ts](lib/services/rewards.service.ts) | ALL_BADGES definitions |
