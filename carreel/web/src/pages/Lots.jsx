import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Grid from '../components/Grid.jsx';
import Avatar from '../components/Avatar.jsx';
import { api } from '../lib/api.js';
import { useCountdown } from '../lib/format.js';

function Timer({ endsAt }) {
  const { text, urgent } = useCountdown(endsAt);
  return <span className={`timer-pill ${urgent ? 'hot' : ''}`}>⏱ {text}</span>;
}

export function Lots({ toast }) {
  const [lots, setLots] = useState(null);
  useEffect(() => { api('/api/lots').then(setLots).catch((e) => toast(e.message)); }, [toast]);
  return (
    <div className="page">
      <h1 className="page-h">Auction lots</h1>
      <p className="muted">Weekly online auctions from Chinese ports and dealers. Bid from anywhere and ship worldwide.</p>
      {!lots ? <p className="muted center pad">Loading…</p> : (
        <ul className="lot-list">
          {lots.map((lot) => (
            <li key={lot.id}>
              <Link to={`/lots/${lot.id}`} className="lot-card">
                {lot.cover && <img src={lot.cover} alt="" />}
                <div className="lot-info">
                  <small className="muted">{lot.number} · {lot.location}</small>
                  <b>{lot.title}</b>
                  <span>{lot.itemCount} items · <Timer endsAt={lot.endsAt} /></span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Lot({ toast }) {
  const { id } = useParams();
  const [lot, setLot] = useState(null);
  useEffect(() => { api(`/api/lots/${id}`).then(setLot).catch((e) => toast(e.message)); }, [id, toast]);
  if (!lot) return <div className="page"><p className="muted center pad">Loading…</p></div>;
  return (
    <div className="page">
      <small className="muted">{lot.number} · {lot.location}</small>
      <h1 className="page-h">{lot.title}</h1>
      <div className="lot-head">
        <Link to={`/u/${lot.dealer.handle}`} className="inline-user"><Avatar user={lot.dealer} size={28} /> {lot.dealer.name}</Link>
        <Timer endsAt={lot.endsAt} />
      </div>
      <Grid items={lot.items} />
    </div>
  );
}
