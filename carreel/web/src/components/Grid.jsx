import { Link } from 'react-router-dom';
import { compact, usd } from '../lib/format.js';

export default function Grid({ items, empty = 'Nothing here yet.' }) {
  if (!items) return <p className="muted center pad">Loading…</p>;
  if (!items.length) return <p className="muted center pad">{empty}</p>;
  return (
    <div className="grid">
      {items.map((l) => (
        <Link key={l.id} to={`/listing/${l.id}`} className="tile">
          {l.media[0]?.type === 'video' ? <video src={l.media[0].url} muted playsInline preload="metadata" /> : <img src={l.media[0]?.url} alt="" loading="lazy" />}
          {l.media[0]?.type === 'video' && <span className="tile-badge">▶</span>}
          {l.sale === 'auction' && <span className="tile-badge left">BID</span>}
          <div className="tile-meta">
            <b>{l.sale === 'auction' ? usd(l.auction?.currentBidUSD ?? l.startingBidUSD) : usd(l.priceUSD)}</b>
            <span>▶ {compact(l.stats.views)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
