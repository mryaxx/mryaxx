# Video playback & REDPlayer

**REDPlayer** is Xiaohongshu's (RedNote's) open-source short-video player: https://github.com/RTE-Dev/REDPlayer.
It ships native SDKs for **Android and iOS** (HarmonyOS planned) and supports MP4, HLS and FLV. It is tuned for exactly
this use case: fast first frame, preloading the next clip, and smooth vertical swiping.

## Where it fits

REDPlayer is a native SDK. It does not run in a browser. So the plan is:

| Client | Player |
|---|---|
| Web / PWA (this repo today) | HTML5 `<video>`: MP4 everywhere, HLS natively on Safari/iOS. Add `hls.js` for HLS on Chrome/Android web. |
| Android app | REDPlayer Android SDK |
| iOS app | REDPlayer iOS SDK |

All feed playback already goes through one component, `web/src/components/MediaPlayer.jsx`. Its contract is
`{ media[], active, preload, muted, onToggleMute, onDoubleTap }`. The native apps implement the same contract:

1. **App shell**: React Native (reuses the API client, pages and feed logic) or fully native Kotlin/Swift.
2. **Bridge**: wrap REDPlayer as a native view (`RedPlayerView`) exposing `src`, `paused`, `muted`, `loop`, `onFirstFrame`, `onError`.
3. **Feed behaviour** (same as the web feed): only the active item plays; item `active + 1` is preloaded; items further than ±2 are unmounted to save memory.
4. **Media pipeline (server)**: transcode uploads to HLS (e.g. 360p/720p/1080p ladders, 2-second segments) plus a poster frame, and serve them from a CDN.
   The API's `media[]` entries gain `{ type: 'video', url: '.../master.m3u8', poster }`. No client changes are needed.

## Before shipping

- **License**: mirrors list REDPlayer under LGPL-2.1, but one copy shows a custom Xiaohongshu licence. Read the LICENSE in the
  official repo and get legal review before shipping it in a commercial app. LGPL generally requires dynamic linking and letting users replace the library.
- Pin a release tag and vendor the SDK. Don't track `main`.
