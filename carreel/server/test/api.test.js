import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server, base;
before(async () => {
  server = createApp({}).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const call = async (method, url, { token, body } = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};
const login = async (handle) => (await call('POST', '/api/auth/login', { body: { handle } })).body.token;

test('meta lists categories and brands', async () => {
  const { body } = await call('GET', '/api/meta');
  assert.ok(body.categories.some((c) => c.slug === 'robotics' && c.count > 0));
  assert.ok(body.brands.some((b) => b.slug === 'byd' && b.count > 0));
});

test('feed paginates with a cursor and never repeats items', async () => {
  const a = await call('GET', '/api/feed?limit=5');
  const b = await call('GET', `/api/feed?limit=5&cursor=${a.body.nextCursor}`);
  assert.equal(a.body.items.length, 5);
  const ids = new Set([...a.body.items, ...b.body.items].map((x) => x.id));
  assert.equal(ids.size, 10);
});

test('filters by brand, condition, category, and lot', async () => {
  const byd = await call('GET', '/api/listings?brand=byd&category=cars');
  assert.ok(byd.body.items.length > 0 && byd.body.items.every((l) => l.brand === 'byd'));
  const refurb = await call('GET', '/api/listings?condition=refurbished');
  assert.ok(refurb.body.items.every((l) => l.condition === 'refurbished'));
  const lot = await call('GET', '/api/listings?lot=lot_2404');
  assert.ok(lot.body.items.every((l) => l.lotId === 'lot_2404'));
});

test('like and save toggle and require auth', async () => {
  assert.equal((await call('POST', '/api/listings/l_1/like')).status, 401);
  const token = await login('amina_lagos');
  const on = await call('POST', '/api/listings/l_1/like', { token });
  assert.equal(on.body.on, true);
  const off = await call('POST', '/api/listings/l_1/like', { token });
  assert.equal(off.body.on, false);
  assert.equal(off.body.count, on.body.count - 1);
});

test('bidding enforces minimum increment and blocks the seller', async () => {
  const { body: lot } = await call('GET', '/api/lots/lot_2401');
  const item = lot.items[0];
  const buyer = await login('carlos_mx');
  const low = await call('POST', `/api/listings/${item.id}/bids`, { token: buyer, body: { amountUSD: item.auction.minNextBidUSD - 1 } });
  assert.equal(low.status, 400);
  const ok = await call('POST', `/api/listings/${item.id}/bids`, { token: buyer, body: { amountUSD: item.auction.minNextBidUSD } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.auction.leading, true);
  assert.equal(ok.body.auction.minNextBidUSD, item.auction.minNextBidUSD + 100);
  const seller = await login('tianjin_port_auto');
  const own = await call('POST', `/api/listings/${item.id}/bids`, { token: seller, body: { amountUSD: 10_000_000 } });
  assert.equal(own.status, 403);
});

test('shipping quote and buy-now order with 10% deposit', async () => {
  const { body: list } = await call('GET', '/api/listings?category=cars&sale=buy_now&limit=1');
  const l = list.items[0];
  const q = await call('GET', `/api/listings/${l.id}/shipping?country=NG`);
  assert.equal(q.body.region, 'West Africa');
  const token = await login('amina_lagos');
  const o = await call('POST', '/api/orders', { token, body: { listingId: l.id, country: 'NG', method: 'roro' } });
  assert.equal(o.status, 201);
  assert.equal(o.body.totalUSD, l.priceUSD + q.body.options[0].costUSD);
  assert.equal(o.body.depositUSD, Math.round(o.body.totalUSD * 0.1));
  assert.equal((await call('GET', `/api/listings/${l.id}/shipping?country=ZZ`)).status, 400);
});

test('only dealers can post listings; follow shows up in Following feed', async () => {
  const buyer = await login('dubai_fleet');
  const res = await fetch(`${base}/api/listings`, { method: 'POST', headers: { authorization: `Bearer ${buyer}` }, body: new FormData() });
  assert.equal(res.status, 403);

  const dealer = await login('hangzhou_robotics');
  const fd = new FormData();
  fd.set('title', 'Test humanoid'); fd.set('category', 'robotics'); fd.set('condition', 'new'); fd.set('priceUSD', '1000');
  const created = await fetch(`${base}/api/listings`, { method: 'POST', headers: { authorization: `Bearer ${dealer}` }, body: fd });
  assert.equal(created.status, 201);
  const l = await created.json();

  await call('POST', '/api/users/hangzhou_robotics/follow', { token: buyer });
  const feed = await call('GET', '/api/feed?tab=following&limit=50', { token: buyer });
  assert.ok(feed.body.items.some((x) => x.id === l.id));
  assert.equal(feed.body.items[0].dealer.isFollowing, true);
});

test('comments validate input', async () => {
  const token = await login('amina_lagos');
  assert.equal((await call('POST', '/api/listings/l_2/comments', { token, body: { text: '' } })).status, 400);
  const c = await call('POST', '/api/listings/l_2/comments', { token, body: { text: 'RHD available?' } });
  assert.equal(c.status, 201);
  const list = await call('GET', '/api/listings/l_2/comments');
  assert.equal(list.body[0].text, 'RHD available?');
});

test('sample video reels are seeded and served', async () => {
  const { body } = await call('GET', '/api/listings?limit=50&brand=byd');
  const withVideo = body.items.find((l) => l.media[0].type === 'video');
  assert.ok(withVideo, 'a BYD listing leads with video');
  const res = await fetch(base + withVideo.media[0].url, { method: 'HEAD' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'video/mp4');
});
