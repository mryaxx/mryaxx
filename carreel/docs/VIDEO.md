# Video playback

| Client | Player |
|---|---|
| Web / PWA (`web/`) | HTML5 `<video>` in `web/src/components/MediaPlayer.jsx`. MP4 everywhere, HLS natively on Safari/iOS (add `hls.js` for Chrome). |
| Android (`android/`) | **[REX Player](https://github.com/mpvRex/REX-Player)** (libmpv). The feed reuses REX's Shorts engine. See `android/CARREEL.md`. |
| iOS | Not started. REX Player is Android-only. Options: AVPlayer (native), or MPVKit (libmpv for Apple) to match Android's behaviour. |

Both clients use the same API contract: each listing has `media[]` entries of `{ type: 'video' | 'image', url, poster? }`.
The seed data includes six short MP4 reels (`server/sample-media/`) so the video path gets exercised.

## Production media pipeline

Transcode uploads to HLS (360p/720p/1080p ladder, 2-second segments) plus a poster frame, store them in object storage behind a CDN,
and put the `master.m3u8` URL in `media[].url`. mpv and Safari play HLS natively, so no client changes are needed.
