# CarReel

A TikTok/Instagram-style marketplace for **cars, parts, robotics and automotive tech sourced from China**, built for buyers outside China.
Think Copart-style auction lots plus factory-direct "buy now", delivered as a vertical swipe feed.

## What's in this prototype

| Area | What it does |
|---|---|
| **Feed** (`/`) | Full-screen vertical swipe feed, autoplay video, double-tap to like, mute toggle, infinite scroll. Tabs: **Following / For You / Live Auctions**. Category chips: Cars, Parts, Robotics, Auto Tech. |
| **Engagement** | Like, comment sheet, save to "garage", share (native share sheet or copy link), follow dealers. |
| **Explore** (`/explore`) | Browse by **brand** (BYD, NIO, XPeng, Li Auto, Zeekr, Xiaomi, Geely, Chery, Great Wall, Changan, Hongqi, MG), **category**, **dealer**. Filters for condition (new / refurbished / used), sale type, and sort. Plus search. Instagram-style 3-column grid. |
| **Auctions** (`/lots`) | Copart-style lots with live countdowns, bid with a minimum increment, bid history, and anti-sniping (a bid in the last 2 minutes extends the lot). |
| **Listing** (`/listing/:id`) | Media, specs (range, battery, SOH, VIN…), dealer card, message-the-dealer, and a **shipping calculator** to 60+ countries (RoRo/container for cars, air/LCL for parts) with transit times. **Reserve with a 10% deposit** for buy-now items. |
| **Profiles** (`/u/:handle`, `/me`) | Instagram-style header with stats, follow, and a grid. "Me" tabs: Listings, Saved, Orders, Inbox. |
| **Sell** (`/create`) | Dealers post listings with video/photo upload, brand/model/VIN, and choose buy-now or an auction lot. |

## Run it

```bash
cd carreel
npm install
npm run dev        # API on :4000, web app on :5173 (open this one)
```

Production-style: `npm run build && npm start`, then open http://localhost:4000.

**Android app**: `android/` is a fork of [REX Player](https://github.com/mpvRex/REX-Player) (libmpv) with a new **Cars** tab, which is this same feed running natively. Build and run steps are in `android/CARREEL.md`.

Tests: `npm test` (API: feed paging, filters, likes, bidding rules, shipping and orders, dealer posting, following feed, comments).

Sign in with any **demo account** from the sign-in sheet. Dealers (e.g. *Shenzhen EV Hub*) can post. Buyers (e.g. *Amina O., Lagos*) can bid and buy.
Demo data lives in `server/data/db.json`. Delete it to reset.

## Layout

```
carreel/
  server/   Express API, JSON store, seed catalog, shipping model, generated poster art
  web/      React + Vite mobile-first PWA (the TikTok/Instagram UI)
  android/  Android app: REX Player fork + CarReel feed (see android/CARREEL.md)
  docs/     ARCHITECTURE.md (production roadmap), VIDEO.md (playback on web/Android/iOS)
```

See **docs/ARCHITECTURE.md** for what has to change before real money and real cars move through this.
