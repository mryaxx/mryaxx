import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MediaPlayer from './MediaPlayer.jsx';
import Avatar from './Avatar.jsx';
import { api, useAuth } from '../lib/api.js';
import { compact, usd, CONDITION_LABEL, useCountdown, shareListing } from '../lib/format.js';

function LotTimer({ endsAt }) {
  const { text, urgent } = useCountdown(endsAt);
  return <span className={`chip ${urgent ? 'chip-hot' : 'chip-dark'}`}>⏱ {text}</span>;
}

export default function FeedItem({ listing, active, preload, muted, onToggleMute, onComments, toast }) {
  const [l, setL] = useState(listing);
  const [burst, setBurst] = useState(0);
  const { requireAuth, user } = useAuth();
  const nav = useNavigate();

  const like = requireAuth(async (force) => {
    if (force && l.liked) return;
    setL((x) => ({ ...x, liked: !x.liked, stats: { ...x.stats, likes: x.stats.likes + (x.liked ? -1 : 1) } }));
    try {
      const r = await api(`/api/listings/${l.id}/like`, { method: 'POST' });
      setL((x) => ({ ...x, liked: r.on, stats: { ...x.stats, likes: r.count } }));
    } catch (e) { toast(e.message); }
  });
  const save = requireAuth(async () => {
    const r = await api(`/api/listings/${l.id}/save`, { method: 'POST' }).catch((e) => toast(e.message));
    if (r) { setL((x) => ({ ...x, saved: r.on, stats: { ...x.stats, saves: r.count } })); toast(r.on ? 'Saved to your garage' : 'Removed from saved'); }
  });
  const follow = requireAuth(async () => {
    const d = await api(`/api/users/${l.dealer.handle}/follow`, { method: 'POST' }).catch((e) => toast(e.message));
    if (d) setL((x) => ({ ...x, dealer: d }));
  });
  const share = async () => {
    const r = await shareListing(l);
    if (!r) return;
    if (r === 'copied') toast('Link copied');
    api(`/api/listings/${l.id}/share`, { method: 'POST' }).then((s) => setL((x) => ({ ...x, stats: { ...x.stats, shares: s.count } }))).catch(() => {});
  };
  const doubleTap = () => { setBurst((b) => b + 1); like(true); };

  const isAuction = l.sale === 'auction';
  const own = user?.id === l.dealer?.id;

  return (
    <section className="reel">
      <MediaPlayer media={l.media} active={active} preload={preload} muted={muted} onToggleMute={onToggleMute} onDoubleTap={doubleTap} />
      {burst > 0 && <div key={burst} className="heart-burst" aria-hidden>❤</div>}
      <div className="reel-shade" />

      <aside className="rail">
        <div className="rail-avatar">
          <Link to={`/u/${l.dealer.handle}`}><Avatar user={l.dealer} size={48} /></Link>
          {!own && !l.dealer.isFollowing && <button className="follow-plus" onClick={follow} aria-label="Follow dealer">+</button>}
        </div>
        <button className={`rail-btn ${l.liked ? 'on-like' : ''}`} onClick={() => like()} aria-label="Like"><span>{l.liked ? '❤️' : '🤍'}</span>{compact(l.stats.likes)}</button>
        <button className="rail-btn" onClick={() => onComments(l, (n) => setL((x) => ({ ...x, stats: { ...x.stats, comments: n } })))} aria-label="Comments"><span>💬</span>{compact(l.stats.comments)}</button>
        <button className={`rail-btn ${l.saved ? 'on-save' : ''}`} onClick={save} aria-label="Save"><span>{l.saved ? '🔖' : '📑'}</span>{compact(l.stats.saves)}</button>
        <button className="rail-btn" onClick={share} aria-label="Share"><span>↗️</span>{compact(l.stats.shares)}</button>
      </aside>

      <div className="caption">
        <Link to={`/u/${l.dealer.handle}`} className="handle">@{l.dealer.handle} {l.dealer.verified && <span className="verified" title="Verified exporter">✔</span>}</Link>
        <div className="chips">
          <span className={`chip chip-${l.condition}`}>{CONDITION_LABEL[l.condition]}</span>
          {l.lot && <Link to={`/lots/${l.lot.id}`} className="chip chip-dark">Lot {l.lot.number}</Link>}
          {isAuction && l.lot && <LotTimer endsAt={l.lot.endsAt} />}
          <span className="chip chip-dark">📍 {l.location}</span>
        </div>
        <h2 className="title" onClick={() => nav(`/listing/${l.id}`)}>{l.title}</h2>
        <p className="desc">{l.description}</p>
      </div>

      <button className="cta" onClick={() => nav(`/listing/${l.id}`)}>
        {isAuction ? (
          <><span className="cta-label">{l.auction.currentBidUSD ? 'Current bid' : 'Starting bid'}</span><b>{usd(l.auction.currentBidUSD ?? l.auction.minNextBidUSD)}</b><span className="cta-go">Bid ›</span></>
        ) : (
          <><span className="cta-label">Buy now · FOB China</span><b>{usd(l.priceUSD)}</b><span className="cta-go">Buy ›</span></>
        )}
      </button>
    </section>
  );
}
