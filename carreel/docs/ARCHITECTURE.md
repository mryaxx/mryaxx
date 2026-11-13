# Architecture & production roadmap

## Today (prototype)

- **API**: Express (`server/src/app.js`) with a JSON-file store (`server/src/store.js`) seeded from `seed.js`.
- **Web**: React 18 + Vite PWA. Mobile-first, centered phone column on desktop.
- **Auth**: DEMO ONLY. The bearer token *is* the user id. Anyone can impersonate anyone.
- **Media**: uploads go to local disk (`server/uploads`). Seed listings use generated SVG poster art.
- **Payments**: orders are recorded as `deposit_pending`. No money moves.

## Must-do before real users

| Area | Change |
|---|---|
| Auth & identity | Real auth (OAuth/passkeys + sessions or JWT). **Dealer KYC/KYB**: business licence, export licence. Buyer verification before bidding. |
| Database | Postgres. Tables mirror the JSON collections: users, listings, media, lots, bids, comments, likes, saves, follows, orders, inquiries. Bids need a transaction/row lock on the listing to avoid race conditions. |
| Media | Object storage (S3/OSS) + CDN. Transcoding to HLS (see REDPLAYER.md). Content moderation on uploads. |
| Payments | Escrow deposits via a provider that supports cross-border payouts to CN merchants. Buyer's premium, deposit refunds, and settlement on lot close. |
| Auctions | Lot-close job that marks winners and creates orders. Proxy (max) bidding. Real-time bid updates over WebSocket/SSE. |
| Feed ranking | Replace the heuristic in `/api/feed` with a ranking service fed by watch-time, completion rate, saves and inquiries. Personalise by destination country and budget. |
| Logistics | Forwarder integrations for live freight quotes, inspection booking, and shipment tracking (container/vessel). |
| Compliance | Export licensing for vehicles from China, destination import rules (age limits, LHD/RHD, homologation), sanctions screening, and **US/Canada restrictions on Chinese connected vehicles**. Robotics may need dual-use export checks. |
| i18n | English, French, Spanish, Arabic, Portuguese, Russian. Prices shown in local currency. |
| Abuse | Rate limiting, spam/fraud detection on comments and inquiries, and dealer ratings/reviews. |
