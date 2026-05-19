# Cast to TV — Manual Test Checklist

Run through these scenarios after every EAS build that touches cast logic.

**Prerequisites**
- [ ] Chromecast device on the same Wi-Fi as the test phone
- [ ] Chromecast registered as a test device in the Cast SDK console
      (required while your Cast App ID is unpublished)
- [ ] `EXPO_PUBLIC_CAST_APP_ID` set in `.env.local`
- [ ] EAS dev build installed on device (`eas build --profile development`)

---

## A · Firebase video cast on Android (Chromecast)

1. Open the app → navigate to Library → tap any video
2. Confirm the `CastButton` (TV icon) appears in the player header
   - **Expected:** button visible when Chromecast is on the network; hidden when not
3. Tap the `CastButton` → select your Chromecast from the picker
   - **Expected:** picker opens and shows the device name; selecting connects
4. Observe the player screen:
   - **Expected:** video stage replaced by "Playing on TV" placeholder
   - **Expected:** `CastStatusBanner` reads "Casting to [Device Name]"
   - **Expected:** `RemoteControlBar` (video mode) visible at bottom
5. Press **Pause** on `RemoteControlBar`
   - **Expected:** TV pauses within ~0.5 s; play button changes state
6. Press **+10s** then **-10s** skip buttons
   - **Expected:** TV seeks accordingly; position counter updates
7. Press **Stop Cast** button
   - **Expected:** cast session ends; local video resumes from cast position
8. Kill Wi-Fi on the phone mid-cast
   - **Expected:** session drops gracefully; normal player UI restores without crash

---

## B · Firebase video cast on iOS (AirPlay)

1. Open the app → navigate to Library → tap any video
2. Swipe down to open iOS Control Center → tap **Screen Mirroring**
   - Select your AirPlay device
   - **Expected:** video plays fullscreen on TV
   - **Expected:** iPhone shows "Playing on TV" system UI (black screen on the Video component)
   - **Expected:** `CastStatusBanner` shows "Casting to AirPlay" on the phone
3. Use seek bar and play/pause on the phone
   - **Expected:** controls work; position syncs between phone and TV
4. Tap `X` on `CastStatusBanner`
   - **Expected:** AirPlay disconnects; video continues locally on phone

---

## C · Agora live call cast (custom receiver)

**Setup:**
- [ ] `cast-receiver/index.html` deployed (`bash cast-receiver/deploy.sh`)
- [ ] Custom Cast App ID registered and set in `EXPO_PUBLIC_CAST_APP_ID`
- [ ] Both participants in an active Agora video call

1. During a live call, tap the `CastButton` (TV icon, top-right of call screen)
   - **Expected:** Cast device picker opens
2. Select your Chromecast
   - **Expected:** the Cast receiver page loads on the TV (Raw1 logo + "Waiting" state)
3. Observe:
   - **Expected:** TV shows remote participant's video fullscreen within ~3 s
   - **Expected:** phone shows "Live call on TV" placeholder (no remote video tile)
   - **Expected:** `RemoteControlBar` (Agora mode) visible: Mute / End / Camera buttons
4. Tap **Mute** on phone
   - **Expected:** your audio mutes for the remote participant (and on TV)
5. Tap **Camera** (turn off) on phone
   - **Expected:** your camera stops; remote participant sees your black tile
6. Remote participant leaves the call
   - **Expected:** TV shows "Call ended" state; phone shows normal end-call flow
7. Tap **End** on `RemoteControlBar`
   - **Expected:** Agora channel left; cast session ends; navigation goes back

---

## D · Session drop recovery

1. Start a cast session (video or call)
2. Unplug the Chromecast power (or turn off TV via HDMI-CEC)
3. Observe the phone:
   - **Expected:** cast session ends within ~5 s
   - **Expected:** `CastStatusBanner` disappears
   - **Expected:** player reverts to local playback (video) or normal call UI (Agora)
   - **Expected:** no crash; no stuck "Casting" UI
4. Reconnect power → tap `CastButton` again
   - **Expected:** can re-establish a new cast session

---

## E · No cast devices available (CastButton hidden)

1. Disconnect phone from Wi-Fi (airplane mode)
   - **Expected:** `CastButton` disappears from player header and call screen
2. Reconnect to Wi-Fi (same network as Chromecast)
   - **Expected:** `CastButton` reappears within ~5 s (discovery polling)
3. On a device with no Chromecast on the network (e.g. cellular only)
   - **Expected:** `CastButton` never appears; no error thrown
4. Attempt `CastManager.showPicker()` programmatically with no devices
   - **Expected:** picker opens with "No devices found" state (native system UI)

---

## Notes

- **AirPlay availability detection**: `isAvailable` for AirPlay is always `true` on iOS
  when on Wi-Fi; the system-level route picker handles device discovery.
- **Agora cast lag**: expect 1–3 s for the receiver to join the Agora channel and
  subscribe to the remote track. This is normal WebRTC join latency.
- **Custom App ID not set**: if `EXPO_PUBLIC_CAST_APP_ID=CC1AD845` (default receiver),
  Agora credentials will be silently ignored by the default receiver.
  You will see the fallback warning in the console. Update the App ID.
