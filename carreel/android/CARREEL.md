# CarReel Android (based on REX Player)

This directory is a fork of **[REX Player](https://github.com/mpvRex/REX-Player)** (Apache-2.0),
imported at upstream commit `84ca9ad561b187f2242b297a3b86c888db130ff0` (2026-11-05).
REX Player is a libmpv-based Android video player with a Jetpack Compose UI and a vertical **Shorts** mode.
CarReel reuses its playback engine and Shorts mechanics for a TikTok-style car marketplace feed.

## What CarReel changed

| File | Change |
|---|---|
| `app/src/main/kotlin/xyz/mpv/rex/carreel/` (new) | `CarReelApi` (OkHttp + kotlinx-serialization client for `carreel/server`), `CarReelViewModel` (feed paging, likes/saves/follows, bids, orders, demo sign-in), `CarReelScreen` (the feed). |
| `ui/browser/MainScreen.kt` | Adds a **Cars** tab, always first, that hosts `CarReelScreen`. All REX tabs (Home, Shorts, Network, You…) are unchanged. |
| `app/build.gradle.kts` | `applicationId` → `com.carreel.app`, so it installs alongside REX Player. The Kotlin namespace stays `xyz.mpv.rex` to keep the upstream diff small and easy to rebase. |
| `res/values/strings.xml`, `src/debug/res/values/strings.xml` | `app_name` → CarReel / CarReel (Debug). |
| `app/src/test/kotlin/xyz/mpv/rex/carreel/CarReelApiTest.kt` (new) | Contract tests: serves JSON captured from the real server (`src/test/resources/carreel/`) to `CarReelApi` and checks requests and decoding. |

## How the feed uses REX's player

`CarReelScreen` follows REX's `ShortsScreen` design:

- One shared libmpv surface (`ShortsPlayerHost` → `MPVView`) sits **behind** a Compose `VerticalPager` and is translated with the scroll offset, so the video moves with its page.
- When a page settles, the screen calls `MPVLib.command("loadfile", <url>)` for that listing's clip (HTTP/HLS/MP4 all work, since mpv streams them directly). It loops the clip, and it pauses on lifecycle pause or tap.
- Photo/poster listings are drawn natively in Compose. The server's SVG posters are re-drawn from the brand colour, because Android can't decode SVG.
- Before it starts, the feed stops REX's headless/mini player, because only one libmpv session can exist.

Feed features: For You / Following / Live Auctions tabs, category chips, like (and double-tap like), comments, save, share (system share sheet), and follow dealer. The listing sheet has specs, an auction countdown with one-tap bids, a shipping quote by destination country, and reserve-with-deposit.

## Build & run

```bash
# 1. Start the API from carreel/
npm install && npm run dev            # API on :4000

# 2. Build the app (JDK 21 + Android SDK 36; set sdk.dir in android/local.properties)
cd android && ./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-universal-debug.apk   # or the ABI-specific APK for your device
```

On the emulator the app talks to `http://10.0.2.2:4000` (your computer's localhost). On a real phone, tap ⚙ in the feed and enter your computer's LAN address, e.g. `http://192.168.1.20:4000`.

## Testing

`./gradlew :app:testDebugUnitTest` runs REX Player's 616 existing tests plus the 9 CarReel API contract tests.
If you change the server's JSON, re-capture the fixtures with `curl` from a running server (see the test file).

The feed UI (pager, mpv hand-off, sheets) has been compiled but **not yet run on a device or emulator**. Test it on real hardware before relying on it.

## Licence

REX Player is Apache-2.0 (see `LICENSE`). Its upstream credits (mpvEx, mpv-android, mpvKt…) are in `README.md`.
CarReel's modifications are listed above. libmpv/FFmpeg are pulled in as prebuilt binaries via `mpvRex-libmpv` and carry their own (LGPL/GPL) licences. Review them before you distribute the app.
