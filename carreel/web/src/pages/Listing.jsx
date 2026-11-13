import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import MediaPlayer from '../components/MediaPlayer.jsx';
import Avatar from '../components/Avatar.jsx';
import Grid from '../components/Grid.jsx';
import { api, useAuth, useMeta } from '../lib/api.js';
import { usd, km, ago, CONDITION_LABEL, useCountdown } from '../lib/format.js';

const SPEC_LABELS = {
  powertrain: 'Powertrain', rangeKm: 'Range (CLTC)', batteryKWh: 'Battery', drive: 'Drive', seats: 'Seats', steering: 'Steering',
  color: 'Color', batterySOH: 'Battery health', fitment: 'Fits', warrantyMonths: 'Warranty', weightKg: 'Weight', payloadKg: 'Payload',
  runtimeH: 'Runtime', sdk: 'SDK',
};
const SPEC_FMT = { rangeKm: (v) => `${v} km`, batteryKWh: (v) => `${v} kWh`, batterySOH: (v) => `${v}%`, warrantyMonths: (v) => `${v} months`, weightKg: (v) => `${v} kg`, payloadKg: (v) => `${v} kg`, runtimeH: (v) => `${v} h` };

function AuctionPanel({ l, onUpdate, toast }) {
  const { requireAuth, user } = useAuth();
  const { text, urgent, ms } = useCountdown(l.lot?.endsAt);
  const [amount, setAmount] = useState(l.auction.minNextBidUSD);
  useEffect(() => setAmount(l.auction.minNextBidUSD), [l.auction.minNextBidUSD]);
  const bid = requireAuth(async () => {
    try {
      await api(`/api/listings/${l.id}/bids`, { method: 'POST', body: { amountUSD: Number(amount) } });
      await onUpdate();
      toast(`Bid placed: ${usd(amount)}. You're the high bidder.`);
    } catch (e2) { toast(e2.message); }
  });
  const ended = ms === 0;
  return (
    <div className="panel">
      <div className="panel-row">
        <div><small className="muted">{l.auction.currentBidUSD ? 'Current bid' : 'Starting bid'}</small><div className="big">{usd(l.auction.currentBidUSD ?? l.startingBidUSD)}</div><small className="muted">{l.auction.bidCount} bids</small></div>
        <div className={`timer ${urgent ? 'hot' : ''}`}><small>Lot closes in</small><b>{text}</b></div>
      </div>
      {l.auction.leading && <p className="good">✔ You are the high bidder</p>}
      {ended ? <p className="muted">This lot has closed.</p> : user?.id === l.dealer.id ? <p className="muted">You're the seller of this item.</p> : (
        <form className="bid-form" onSubmit={(e) => { e.preventDefault(); bid(); }}>
          <div className="quick">
            {[0, 500, 1000].map((x) => <button type="button" key={x} onClick={() => setAmount(l.auction.minNextBidUSD + x)}>{usd(l.auction.minNextBidUSD + x)}</button>)}
          </div>
          <div className="bid-input"><span>$</span><input type="number" min={l.auction.minNextBidUSD} step="100" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Bid amount in USD" /></div>
          <button className="btn-primary">Place bid</button>
          <small className="muted">Minimum {usd(l.auction.minNextBidUSD)} · Bids in the last 2 min extend the lot · Buyer's premium & deposit apply</small>
        </form>
      )}
      {l.bids?.length > 0 && (
        <details className="bid-history"><summary>Bid history</summary>
          <ul>{l.bids.map((b, i) => <li key={i}><span>{b.bidder}</span><b>{usd(b.amountUSD)}</b><span className="muted">{ago(b.at)}</span></li>)}</ul>
        </details>
      )}
    </div>
  );
}

function BuyPanel({ l, toast }) {
  const meta = useMeta();
  const { requireAuth, user } = useAuth();
  const nav = useNavigate();
  const [country, setCountry] = useState('');
  const [quote, setQuote] = useState(null);
  const [method, setMethod] = useState('');
  // Pre-fill the buyer's own country when it is a supported export destination.
  useEffect(() => { if (!country && meta?.countries.includes(user?.country)) setCountry(user.country); }, [user, meta, country]);
  useEffect(() => {
    if (!country) { setQuote(null); return; }
    api(`/api/listings/${l.id}/shipping?country=${country}`).then((q) => { setQuote(q); setMethod(q.options[0].method); }).catch((e) => { setQuote(null); toast(e.message); });
  }, [country, l.id, toast]);
  const opt = quote?.options.find((o) => o.method === method);
  const order = requireAuth(async () => {
    try {
      const o = await api('/api/orders', { method: 'POST', body: { listingId: l.id, country, method } });
      toast(`Reserved! Pay ${usd(o.depositUSD)} deposit to lock it in.`);
      nav('/me?tab=orders');
    } catch (e) { toast(e.message); }
  });
  return (
    <div className="panel">
      {l.sale === 'buy_now' && <div className="big">{usd(l.priceUSD)} <small className="muted">FOB China</small></div>}
      <label className="field">Ship to
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="">Choose destination country…</option>
          {meta?.countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      {quote && (
        <>
          <div className="ship-opts">
            {quote.options.map((o) => (
              <label key={o.method} className={`ship-opt ${method === o.method ? 'on' : ''}`}>
                <input type="radio" name="ship" checked={method === o.method} onChange={() => setMethod(o.method)} />
                <span><b>{o.label}</b><small>{o.days[0]}–{o.days[1]} days to {quote.region}</small></span><b>{usd(o.costUSD)}</b>
              </label>
            ))}
          </div>
          {l.sale === 'buy_now' && opt && <div className="total"><span>Estimated total (excl. duties)</span><b>{usd(l.priceUSD + opt.costUSD)}</b></div>}
          <ul className="notes">{quote.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </>
      )}
      {l.sale === 'buy_now' && user?.id !== l.dealer.id && (
        <button className="btn-primary" disabled={!opt} onClick={order}>{opt ? `Reserve with 10% deposit (${usd(Math.round((l.priceUSD + opt.costUSD) * 0.1))})` : 'Choose destination to buy'}</button>
      )}
    </div>
  );
}

export default function Listing({ toast }) {
  const { id } = useParams();
  const { requireAuth, user } = useAuth();
  const nav = useNavigate();
  const [l, setL] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  useEffect(() => { setL(null); window.scrollTo(0, 0); api(`/api/listings/${id}`).then(setL).catch((e) => setErr(e.message)); }, [id, user?.id]);

  const inquire = requireAuth(async () => {
    try { await api(`/api/listings/${id}/inquiries`, { method: 'POST', body: { text: msg } }); setMsg(''); toast('Message sent to the dealer'); } catch (e) { toast(e.message); }
  });
  const remove = async () => {
    if (!confirm('Delete this listing?')) return;
    try { await api(`/api/listings/${id}`, { method: 'DELETE' }); toast('Listing deleted'); nav('/me'); } catch (e) { toast(e.message); }
  };

  if (err) return <div className="page"><p className="error">{err}</p></div>;
  if (!l) return <div className="page"><p className="muted center pad">Loading…</p></div>;
  const specs = Object.entries(l.specs || {}).filter(([, v]) => v != null && v !== '');
  return (
    <div className="page detail">
      <button className="back" onClick={() => nav(-1)} aria-label="Back">‹</button>
      <div className="detail-media"><MediaPlayer media={l.media} active muted /></div>
      <div className="detail-body">
        <div className="chips">
          <span className={`chip chip-${l.condition}`}>{CONDITION_LABEL[l.condition]}</span>
          {l.lot && <Link className="chip chip-dark" to={`/lots/${l.lot.id}`}>Lot {l.lot.number}</Link>}
          {l.brand && <Link className="chip chip-dark" to={`/explore?category=cars&brand=${l.brand}`}>{l.brand.toUpperCase()}</Link>}
        </div>
        <h1>{l.title}</h1>
        <p className="muted">📍 {l.location}{l.mileageKm != null && ` · ${km(l.mileageKm)}`}{l.vin && ` · VIN ${l.vin}`}</p>

        {l.sale === 'auction' && <AuctionPanel l={l} onUpdate={() => api(`/api/listings/${id}`).then(setL)} toast={toast} />}
        <BuyPanel l={l} toast={toast} />

        <Link to={`/u/${l.dealer.handle}`} className="dealer-card">
          <Avatar user={l.dealer} size={44} />
          <span><b>{l.dealer.name} {l.dealer.verified && <span className="verified">✔</span>}</b><small>@{l.dealer.handle} · {l.dealer.city}</small></span>
          <span className="muted">›</span>
        </Link>

        <p className="desc-full">{l.description}</p>
        {specs.length > 0 && (
          <dl className="specs">{specs.map(([k, v]) => <div key={k}><dt>{SPEC_LABELS[k] || k}</dt><dd>{SPEC_FMT[k] ? SPEC_FMT[k](v) : String(v)}</dd></div>)}</dl>
        )}

        {user?.id === l.dealer.id ? <button className="btn-ghost wide danger" onClick={remove}>Delete listing</button> : (
          <form className="inquiry" onSubmit={(e) => { e.preventDefault(); inquire(); }}>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message the dealer: inspection video, RHD, bulk pricing, documents…" rows={3} maxLength={2000} />
            <button className="btn-ghost" disabled={!msg.trim()}>Send message</button>
          </form>
        )}

        {l.related?.length > 0 && <><h3 className="section-h">More like this</h3><Grid items={l.related} /></>}
      </div>
    </div>
  );
}
