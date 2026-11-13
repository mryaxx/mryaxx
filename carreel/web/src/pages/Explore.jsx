import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Grid from '../components/Grid.jsx';
import Avatar from '../components/Avatar.jsx';
import { api, useMeta } from '../lib/api.js';
import { compact, CONDITION_LABEL } from '../lib/format.js';

const VIEWS = [['brands', 'Brands'], ['all', 'Listings'], ['dealers', 'Dealers']];

export default function Explore({ toast }) {
  const meta = useMeta();
  const [params, setParams] = useSearchParams();
  const q = Object.fromEntries(params);
  const view = q.view || (q.brand || q.category || q.q || q.condition ? 'all' : 'brands');
  const [items, setItems] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [dealers, setDealers] = useState(null);
  const [search, setSearch] = useState(q.q || '');

  const set = (patch) => {
    const next = { ...q, ...patch };
    Object.keys(next).forEach((k) => (next[k] === '' || next[k] == null) && delete next[k]);
    setParams(next);
  };

  useEffect(() => {
    if (view !== 'all') return;
    setItems(null);
    const { view: _v, ...filters } = q;
    api(`/api/listings?${new URLSearchParams(filters)}`).then((r) => { setItems(r.items); setCursor(r.nextCursor); }).catch((e) => toast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);
  useEffect(() => { if (view === 'dealers' && !dealers) api('/api/dealers').then(setDealers).catch((e) => toast(e.message)); }, [view, dealers, toast]);

  const more = async () => {
    const { view: _v, ...filters } = q;
    const r = await api(`/api/listings?${new URLSearchParams({ ...filters, cursor })}`);
    setItems((p) => [...p, ...r.items]); setCursor(r.nextCursor);
  };
  const brand = meta?.brands.find((b) => b.slug === q.brand);

  return (
    <div className="page">
      <form className="search" onSubmit={(e) => { e.preventDefault(); set({ q: search, view: 'all' }); }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search BYD Seal, Tank 300, robot dog, chargers…" aria-label="Search" />
      </form>

      <div className="seg">
        {VIEWS.map(([k, label]) => <button key={k} className={view === k ? 'on' : ''} onClick={() => set({ view: k })}>{label}</button>)}
      </div>

      {view === 'brands' && (
        <>
          <h3 className="section-h">Shop by category</h3>
          <div className="cat-row">
            {meta?.categories.map((c) => (
              <button key={c.slug} className="cat-card" onClick={() => set({ view: 'all', category: c.slug })}>
                <span className="cat-icon">{c.icon}</span><b>{c.name}</b><small>{c.count} listings</small>
              </button>
            ))}
          </div>
          <h3 className="section-h">Chinese brands</h3>
          <div className="brand-grid">
            {meta?.brands.map((b) => (
              <button key={b.slug} className="brand-card" style={{ '--brand': b.color }} onClick={() => set({ view: 'all', category: 'cars', brand: b.slug })}>
                <b>{b.name}</b><small>{b.count} cars</small>
              </button>
            ))}
          </div>
          <Link to="/lots" className="banner">🔨 Weekly auction lots: bid on zero-km & refurbished cars ›</Link>
        </>
      )}

      {view === 'all' && (
        <>
          {brand && <div className="brand-hero" style={{ '--brand': brand.color }}><h2>{brand.name}</h2><span>{brand.count} cars from verified exporters</span></div>}
          <div className="filters">
            <select value={q.category || ''} onChange={(e) => set({ category: e.target.value })} aria-label="Category">
              <option value="">All categories</option>
              {meta?.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select value={q.brand || ''} onChange={(e) => set({ brand: e.target.value })} aria-label="Brand">
              <option value="">All brands</option>
              {meta?.brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select>
            <select value={q.condition || ''} onChange={(e) => set({ condition: e.target.value })} aria-label="Condition">
              <option value="">Any condition</option>
              {meta?.conditions.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
            </select>
            <select value={q.sale || ''} onChange={(e) => set({ sale: e.target.value })} aria-label="Sale type">
              <option value="">Buy now & auction</option><option value="buy_now">Buy now</option><option value="auction">Auction</option>
            </select>
            <select value={q.sort || ''} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort">
              <option value="">Newest</option><option value="popular">Most viewed</option><option value="price_asc">Price ↑</option><option value="price_desc">Price ↓</option>
            </select>
          </div>
          <Grid items={items} empty="No listings match. Try removing a filter." />
          {cursor && <button className="btn-ghost wide" onClick={more}>Load more</button>}
        </>
      )}

      {view === 'dealers' && (
        <ul className="dealer-list">
          {(dealers || []).map((d) => (
            <li key={d.id}><Link to={`/u/${d.handle}`}>
              <Avatar user={d} size={52} />
              <span><b>{d.name} {d.verified && <span className="verified">✔</span>}</b><small>@{d.handle} · {d.city} · {compact(d.followers)} followers · {d.listings} listings</small><small className="muted">{d.bio}</small></span>
            </Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}
