import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRANDS, CATEGORIES, CONDITIONS } from './seed.js';
import { createStore } from './store.js';
import { quote, COUNTRIES } from './shipping.js';
import { posterSvg } from './poster.js';

const MIN_INCREMENT = 100;

export function createApp({ dataFile, uploadDir = path.join(process.cwd(), 'uploads'), webDist } = {}) {
  const { db, save, id } = createStore(dataFile);
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // ---- auth (DEMO ONLY: bearer token is the user id; replace with real auth/KYC) ----
  app.use((req, _res, next) => {
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    req.user = db.users.find((u) => u.id === token) || null;
    next();
  });
  const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: 'Sign in required' }));

  // ---- helpers ----
  const userById = (uid) => db.users.find((u) => u.id === uid);
  const publicUser = (u, me) =>
    u && {
      id: u.id, handle: u.handle, name: u.name, type: u.type, verified: u.verified, city: u.city, country: u.country, bio: u.bio,
      followers: u.followers + db.follows.filter((f) => f.followeeId === u.id).length,
      following: db.follows.filter((f) => f.followerId === u.id).length,
      listings: db.listings.filter((l) => l.dealerId === u.id).length,
      isFollowing: !!me && db.follows.some((f) => f.followerId === me.id && f.followeeId === u.id),
    };
  const bidsFor = (lid) => db.bids.filter((b) => b.listingId === lid).sort((a, b) => b.amountUSD - a.amountUSD);
  const lotById = (lid) => db.lots.find((l) => l.id === lid);

  const view = (l, me) => {
    const bids = bidsFor(l.id);
    const lot = l.lotId ? lotById(l.lotId) : null;
    return {
      ...l,
      dealer: publicUser(userById(l.dealerId), me),
      lot: lot && { id: lot.id, number: lot.number, title: lot.title, endsAt: lot.endsAt, ended: lot.endsAt < Date.now() },
      auction: l.sale === 'auction' ? {
        currentBidUSD: bids[0]?.amountUSD ?? null,
        bidCount: bids.length,
        minNextBidUSD: bids[0] ? bids[0].amountUSD + MIN_INCREMENT : l.startingBidUSD,
        leading: !!me && bids[0]?.userId === me.id,
      } : null,
      liked: !!me && db.likes.some((x) => x.userId === me.id && x.listingId === l.id),
      saved: !!me && db.saves.some((x) => x.userId === me.id && x.listingId === l.id),
    };
  };

  const filterListings = (q) => {
    let list = db.listings;
    if (q.category) list = list.filter((l) => l.category === q.category);
    if (q.condition) list = list.filter((l) => l.condition === q.condition);
    if (q.brand) list = list.filter((l) => l.brand === q.brand);
    if (q.lot) list = list.filter((l) => l.lotId === q.lot);
    if (q.dealer) list = list.filter((l) => l.dealerId === q.dealer || userById(l.dealerId)?.handle === q.dealer);
    if (q.sale) list = list.filter((l) => l.sale === q.sale);
    if (q.maxPrice) list = list.filter((l) => l.priceUSD <= Number(q.maxPrice));
    if (q.q) {
      const terms = String(q.q).toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter((l) => {
        const hay = `${l.title} ${l.description} ${l.tags.join(' ')} ${l.brand ?? ''} ${l.category} ${userById(l.dealerId)?.name ?? ''}`.toLowerCase();
        return terms.every((t) => hay.includes(t));
      });
    }
    const sorts = {
      newest: (a, b) => b.createdAt - a.createdAt,
      price_asc: (a, b) => a.priceUSD - b.priceUSD,
      price_desc: (a, b) => b.priceUSD - a.priceUSD,
      popular: (a, b) => b.stats.views - a.stats.views,
    };
    return [...list].sort(sorts[q.sort] || sorts.newest);
  };

  const page = (arr, q, me, size = 12) => {
    const offset = Math.max(0, Number(q.cursor) || 0);
    const limit = Math.min(50, Number(q.limit) || size);
    const items = arr.slice(offset, offset + limit).map((l) => view(l, me));
    return { items, nextCursor: offset + limit < arr.length ? String(offset + limit) : null, total: arr.length };
  };

  // ---- catalog meta ----
  app.get('/api/meta', (_req, res) => {
    res.json({
      categories: CATEGORIES.map((c) => ({ ...c, count: db.listings.filter((l) => l.category === c.slug).length })),
      conditions: CONDITIONS,
      brands: BRANDS.map(({ slug, name, color }) => ({ slug, name, color, count: db.listings.filter((l) => l.brand === slug && l.category === 'cars').length })),
      countries: COUNTRIES,
    });
  });

  // ---- auth ----
  app.get('/api/auth/demo-users', (_req, res) => res.json(db.users.map((u) => publicUser(u))));
  app.post('/api/auth/login', (req, res) => {
    const u = db.users.find((x) => x.handle === req.body?.handle);
    if (!u) return res.status(404).json({ error: 'Unknown user' });
    res.json({ token: u.id, user: publicUser(u, u) });
  });
  app.post('/api/auth/register', (req, res) => {
    const { handle, name, type = 'buyer', country = '', city = '' } = req.body || {};
    if (!/^[a-z0-9_]{3,30}$/.test(handle || '')) return res.status(400).json({ error: 'Handle must be 3–30 chars: a-z, 0-9, _' });
    if (!name || String(name).length > 60) return res.status(400).json({ error: 'Name is required (max 60 chars)' });
    if (!['buyer', 'dealer'].includes(type)) return res.status(400).json({ error: 'Invalid account type' });
    if (db.users.some((u) => u.handle === handle)) return res.status(409).json({ error: 'Handle taken' });
    const u = { id: id('u'), handle, name: String(name), type, verified: false, country: String(country).slice(0, 2).toUpperCase(), city: String(city).slice(0, 60), bio: '', followers: 0 };
    db.users.push(u);
    save();
    res.status(201).json({ token: u.id, user: publicUser(u, u) });
  });
  app.get('/api/me', requireUser, (req, res) => res.json(publicUser(req.user, req.user)));

  // ---- feed (TikTok-style ranked, infinite) ----
  app.get('/api/feed', (req, res) => {
    const me = req.user;
    const base = filterListings({ category: req.query.category, condition: req.query.condition });
    let list = base;
    if (req.query.tab === 'following') {
      if (!me) return res.json({ items: [], nextCursor: null, total: 0 });
      const ids = new Set(db.follows.filter((f) => f.followerId === me.id).map((f) => f.followeeId));
      list = base.filter((l) => ids.has(l.dealerId)).sort((a, b) => b.createdAt - a.createdAt);
    } else if (req.query.tab === 'auctions') {
      list = base.filter((l) => l.sale === 'auction' && lotById(l.lotId)?.endsAt > Date.now())
        .sort((a, b) => lotById(a.lotId).endsAt - lotById(b.lotId).endsAt);
    } else {
      // For You: engagement + freshness, with a boost for dealers you follow and brands you liked.
      const followed = new Set(me ? db.follows.filter((f) => f.followerId === me.id).map((f) => f.followeeId) : []);
      const likedBrands = new Set(me ? db.likes.filter((x) => x.userId === me.id).map((x) => db.listings.find((l) => l.id === x.listingId)?.brand).filter(Boolean) : []);
      const score = (l) => {
        const engagement = Math.log10(1 + l.stats.likes + 3 * l.stats.comments + 4 * l.stats.saves + 5 * l.stats.shares);
        const ageH = (Date.now() - l.createdAt) / 3600e3;
        return engagement - ageH / 48 + (followed.has(l.dealerId) ? 1.5 : 0) + (likedBrands.has(l.brand) ? 0.8 : 0);
      };
      list = [...base].sort((a, b) => score(b) - score(a));
    }
    res.json(page(list, req.query, me, 6));
  });

  // ---- listings ----
  app.get('/api/listings', (req, res) => res.json(page(filterListings(req.query), req.query, req.user, 24)));

  app.get('/api/listings/:id', (req, res) => {
    const l = db.listings.find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Not found' });
    l.stats.views++;
    save();
    res.json({
      ...view(l, req.user),
      bids: bidsFor(l.id).slice(0, 10).map((b) => ({ amountUSD: b.amountUSD, at: b.at, bidder: `${userById(b.userId)?.handle.slice(0, 2)}***` })),
      related: db.listings.filter((x) => x.id !== l.id && (x.brand ? x.brand === l.brand : x.category === l.category)).slice(0, 6).map((x) => view(x, req.user)),
    });
  });

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => { fs.mkdirSync(uploadDir, { recursive: true }); cb(null, uploadDir); },
      filename: (_req, file, cb) => cb(null, `${id('m')}${path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '')}`),
    }),
    limits: { fileSize: 200 * 1024 * 1024, files: 10 },
    fileFilter: (_req, file, cb) => cb(null, /^(image|video)\//.test(file.mimetype)),
  });

  app.post('/api/listings', requireUser, upload.array('media', 10), (req, res) => {
    if (req.user.type !== 'dealer') return res.status(403).json({ error: 'Only dealer accounts can post listings' });
    const b = req.body || {};
    const errors = [];
    if (!b.title || b.title.length > 120) errors.push('title (1–120 chars)');
    if (!CATEGORIES.some((c) => c.slug === b.category)) errors.push('category');
    if (!CONDITIONS.includes(b.condition)) errors.push('condition');
    if (!(Number(b.priceUSD) > 0)) errors.push('priceUSD');
    if (b.brand && !BRANDS.some((x) => x.slug === b.brand)) errors.push('brand');
    if (b.lotId && !lotById(b.lotId)) errors.push('lotId');
    if (errors.length) return res.status(400).json({ error: `Invalid: ${errors.join(', ')}` });

    const l = {
      id: id('l'), category: b.category, condition: b.condition, brand: b.brand || null, model: b.model || null,
      year: b.year ? Number(b.year) : null, title: String(b.title), description: String(b.description || '').slice(0, 4000),
      dealerId: req.user.id, lotId: b.lotId || null, sale: b.lotId ? 'auction' : 'buy_now',
      priceUSD: Math.round(Number(b.priceUSD)), startingBidUSD: b.lotId ? Math.round(Number(b.startingBidUSD) || Number(b.priceUSD) * 0.6) : null,
      mileageKm: b.mileageKm ? Number(b.mileageKm) : null, location: `${req.user.city || ''}, ${req.user.country || 'CN'}`, vin: b.vin || null,
      specs: {}, media: [], tags: String(b.tags || '').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      stats: { likes: 0, comments: 0, saves: 0, shares: 0, views: 0 }, createdAt: Date.now(),
    };
    l.media = (req.files || []).map((f) => ({ type: f.mimetype.startsWith('video/') ? 'video' : 'image', url: `/uploads/${f.filename}` }));
    if (!l.media.length) l.media = [{ type: 'image', url: `/media/poster/${l.id}.svg` }];
    db.listings.push(l);
    save();
    res.status(201).json(view(l, req.user));
  });

  app.delete('/api/listings/:id', requireUser, (req, res) => {
    const i = db.listings.findIndex((x) => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Not found' });
    if (db.listings[i].dealerId !== req.user.id) return res.status(403).json({ error: 'Not your listing' });
    db.listings.splice(i, 1);
    save();
    res.status(204).end();
  });

  // ---- engagement ----
  const toggle = (coll, stat) => (req, res) => {
    const l = db.listings.find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Not found' });
    const arr = db[coll];
    const i = arr.findIndex((x) => x.userId === req.user.id && x.listingId === l.id);
    const on = i < 0;
    if (on) arr.push({ userId: req.user.id, listingId: l.id, at: Date.now() });
    else arr.splice(i, 1);
    l.stats[stat] += on ? 1 : -1;
    save();
    res.json({ on, count: l.stats[stat] });
  };
  app.post('/api/listings/:id/like', requireUser, toggle('likes', 'likes'));
  app.post('/api/listings/:id/save', requireUser, toggle('saves', 'saves'));
  app.post('/api/listings/:id/share', (req, res) => {
    const l = db.listings.find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Not found' });
    l.stats.shares++;
    save();
    res.json({ count: l.stats.shares });
  });

  app.get('/api/listings/:id/comments', (req, res) => {
    res.json(db.comments.filter((c) => c.listingId === req.params.id).sort((a, b) => b.at - a.at)
      .map((c) => ({ ...c, user: publicUser(userById(c.userId)) })));
  });
  app.post('/api/listings/:id/comments', requireUser, (req, res) => {
    const l = db.listings.find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Not found' });
    const text = String(req.body?.text || '').trim();
    if (!text || text.length > 500) return res.status(400).json({ error: 'Comment must be 1–500 chars' });
    const c = { id: id('c'), listingId: l.id, userId: req.user.id, text, at: Date.now() };
    db.comments.push(c);
    l.stats.comments++;
    save();
    res.status(201).json({ ...c, user: publicUser(req.user) });
  });

  // ---- auctions (Copart-style lots) ----
  app.get('/api/lots', (req, res) => {
    res.json(db.lots.map((lot) => {
      const items = db.listings.filter((l) => l.lotId === lot.id);
      return { ...lot, dealer: publicUser(userById(lot.dealerId), req.user), itemCount: items.length, ended: lot.endsAt < Date.now(), cover: items[0]?.media[0]?.url ?? null };
    }).sort((a, b) => a.endsAt - b.endsAt));
  });
  app.get('/api/lots/:id', (req, res) => {
    const lot = lotById(req.params.id);
    if (!lot) return res.status(404).json({ error: 'Not found' });
    res.json({ ...lot, dealer: publicUser(userById(lot.dealerId), req.user), ended: lot.endsAt < Date.now(), items: db.listings.filter((l) => l.lotId === lot.id).map((l) => view(l, req.user)) });
  });

  app.post('/api/listings/:id/bids', requireUser, (req, res) => {
    const l = db.listings.find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Not found' });
    if (l.sale !== 'auction') return res.status(400).json({ error: 'This item is not in an auction' });
    const lot = lotById(l.lotId);
    if (!lot || lot.endsAt < Date.now()) return res.status(400).json({ error: 'Auction has ended' });
    if (l.dealerId === req.user.id) return res.status(403).json({ error: 'You cannot bid on your own item' });
    const amount = Math.round(Number(req.body?.amountUSD));
    const top = bidsFor(l.id)[0];
    const min = top ? top.amountUSD + MIN_INCREMENT : l.startingBidUSD;
    if (!(amount >= min)) return res.status(400).json({ error: `Minimum bid is $${min.toLocaleString('en-US')}` });
    db.bids.push({ id: id('b'), listingId: l.id, userId: req.user.id, amountUSD: amount, at: Date.now() });
    // Anti-sniping: a bid in the final 2 minutes extends the lot by 2 minutes.
    if (lot.endsAt - Date.now() < 120000) lot.endsAt = Date.now() + 120000;
    save();
    res.status(201).json(view(l, req.user));
  });

  // ---- shipping & orders ----
  app.get('/api/listings/:id/shipping', (req, res) => {
    const l = db.listings.find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Not found' });
    const q = quote(l, String(req.query.country || '').toUpperCase());
    if (!q) return res.status(400).json({ error: 'Unsupported destination country' });
    res.json(q);
  });

  app.post('/api/orders', requireUser, (req, res) => {
    const { listingId, country, method } = req.body || {};
    const l = db.listings.find((x) => x.id === listingId);
    if (!l) return res.status(404).json({ error: 'Listing not found' });
    if (l.sale !== 'buy_now') return res.status(400).json({ error: 'Auction items are purchased by winning the lot' });
    if (l.dealerId === req.user.id) return res.status(403).json({ error: 'You cannot buy your own listing' });
    const q = quote(l, String(country || '').toUpperCase());
    const opt = q?.options.find((o) => o.method === method);
    if (!opt) return res.status(400).json({ error: 'Choose a valid destination and shipping method' });
    // Deposit-to-reserve model: 10% held in escrow, balance due before loading.
    const total = l.priceUSD + opt.costUSD;
    const o = {
      id: id('o'), listingId: l.id, buyerId: req.user.id, dealerId: l.dealerId, country: q.country, shipping: opt,
      itemUSD: l.priceUSD, totalUSD: total, depositUSD: Math.round(total * 0.1), status: 'deposit_pending', at: Date.now(),
    };
    db.orders.push(o);
    save();
    res.status(201).json(o);
  });
  app.get('/api/orders', requireUser, (req, res) => {
    res.json(db.orders.filter((o) => o.buyerId === req.user.id || o.dealerId === req.user.id).sort((a, b) => b.at - a.at)
      .map((o) => ({ ...o, listing: view(db.listings.find((l) => l.id === o.listingId) || { id: o.listingId, title: '(removed)', media: [], stats: {}, tags: [] }, req.user) })));
  });

  app.post('/api/listings/:id/inquiries', requireUser, (req, res) => {
    const l = db.listings.find((x) => x.id === req.params.id);
    if (!l) return res.status(404).json({ error: 'Not found' });
    const text = String(req.body?.text || '').trim();
    if (!text || text.length > 2000) return res.status(400).json({ error: 'Message must be 1–2000 chars' });
    const q = { id: id('q'), listingId: l.id, fromId: req.user.id, toId: l.dealerId, text, at: Date.now() };
    db.inquiries.push(q);
    save();
    res.status(201).json(q);
  });
  app.get('/api/inquiries', requireUser, (req, res) => {
    res.json(db.inquiries.filter((q) => q.toId === req.user.id || q.fromId === req.user.id).sort((a, b) => b.at - a.at)
      .map((q) => ({ ...q, from: publicUser(userById(q.fromId)), to: publicUser(userById(q.toId)), listing: { id: q.listingId, title: db.listings.find((l) => l.id === q.listingId)?.title } })));
  });

  // ---- profiles (Instagram-style) ----
  app.get('/api/dealers', (req, res) => {
    res.json(db.users.filter((u) => u.type === 'dealer').map((u) => ({ ...publicUser(u, req.user), cover: db.listings.find((l) => l.dealerId === u.id)?.media[0]?.url ?? null })));
  });
  app.get('/api/users/:handle', (req, res) => {
    const u = db.users.find((x) => x.handle === req.params.handle);
    if (!u) return res.status(404).json({ error: 'Not found' });
    res.json(publicUser(u, req.user));
  });
  app.get('/api/users/:handle/saved', requireUser, (req, res) => {
    if (req.user.handle !== req.params.handle) return res.status(403).json({ error: 'Private' });
    const ids = db.saves.filter((s) => s.userId === req.user.id).map((s) => s.listingId);
    res.json(db.listings.filter((l) => ids.includes(l.id)).map((l) => view(l, req.user)));
  });
  app.post('/api/users/:handle/follow', requireUser, (req, res) => {
    const u = db.users.find((x) => x.handle === req.params.handle);
    if (!u) return res.status(404).json({ error: 'Not found' });
    if (u.id === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself' });
    const i = db.follows.findIndex((f) => f.followerId === req.user.id && f.followeeId === u.id);
    if (i < 0) db.follows.push({ followerId: req.user.id, followeeId: u.id, at: Date.now() });
    else db.follows.splice(i, 1);
    save();
    res.json(publicUser(u, req.user));
  });

  // ---- media ----
  app.get('/media/poster/:id.svg', (req, res) => {
    const l = db.listings.find((x) => x.id === req.params.id);
    if (!l) return res.status(404).end();
    res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(posterSvg(l));
  });
  if (uploadDir) app.use('/uploads', express.static(uploadDir, { maxAge: '7d' }));
  app.use('/sample-media', express.static(fileURLToPath(new URL('../sample-media', import.meta.url)), { maxAge: '7d' }));

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  if (webDist && fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 200 MB)' : 'Server error' });
  });

  return app;
}
