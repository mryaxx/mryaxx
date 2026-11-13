import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import Grid from '../components/Grid.jsx';
import { api, useAuth } from '../lib/api.js';
import { compact, usd, ago } from '../lib/format.js';

function Header({ u, onFollow, self, onLogout }) {
  return (
    <div className="profile-head">
      <Avatar user={u} size={84} />
      <div className="profile-stats">
        <div><b>{u.listings}</b><small>listings</small></div>
        <div><b>{compact(u.followers)}</b><small>followers</small></div>
        <div><b>{u.following}</b><small>following</small></div>
      </div>
      <div className="profile-bio">
        <b>{u.name} {u.verified && <span className="verified" title="Verified exporter">✔</span>}</b>
        <small className="muted">@{u.handle} · {u.type === 'dealer' ? 'Dealer / exporter' : 'Buyer'}{u.city && ` · ${u.city}`}{u.country && `, ${u.country}`}</small>
        {u.bio && <p>{u.bio}</p>}
      </div>
      {self ? (
        <div className="profile-actions">
          {u.type === 'dealer' && <Link className="btn-primary" to="/create">+ New listing</Link>}
          <button className="btn-ghost" onClick={onLogout}>Sign out</button>
        </div>
      ) : (
        <div className="profile-actions">
          <button className={u.isFollowing ? 'btn-ghost' : 'btn-primary'} onClick={onFollow}>{u.isFollowing ? 'Following' : 'Follow'}</button>
        </div>
      )}
    </div>
  );
}

export function Profile({ toast }) {
  const { handle } = useParams();
  const { requireAuth, user } = useAuth();
  const [u, setU] = useState(null);
  const [items, setItems] = useState(null);
  useEffect(() => {
    setU(null); setItems(null);
    api(`/api/users/${handle}`).then(setU).catch((e) => toast(e.message));
    api(`/api/listings?dealer=${handle}&limit=50`).then((r) => setItems(r.items)).catch(() => setItems([]));
  }, [handle, user?.id, toast]);
  const follow = requireAuth(async () => { try { setU(await api(`/api/users/${handle}/follow`, { method: 'POST' })); } catch (e) { toast(e.message); } });
  if (!u) return <div className="page"><p className="muted center pad">Loading…</p></div>;
  return (
    <div className="page">
      <Header u={u} onFollow={follow} self={user?.id === u.id} />
      <Grid items={items} empty={u.type === 'dealer' ? 'No listings yet.' : 'Buyers don\'t post listings.'} />
    </div>
  );
}

export function Me({ toast }) {
  const { user, logout, setPrompt } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || (user?.type === 'dealer' ? 'listings' : 'saved');
  const [data, setData] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!user) return;
    setData(null);
    const load = {
      listings: () => api(`/api/listings?dealer=${user.handle}&limit=50`).then((r) => r.items),
      saved: () => api(`/api/users/${user.handle}/saved`),
      orders: () => api('/api/orders'),
      inbox: () => api('/api/inquiries'),
    }[tab];
    load?.().then(setData).catch((e) => toast(e.message));
  }, [tab, user, toast]);

  if (!user) {
    return (
      <div className="page center pad">
        <h1 className="page-h">Your garage</h1>
        <p className="muted">Sign in to save cars, bid in auctions, track orders and message dealers.</p>
        <button className="btn-primary" onClick={() => setPrompt(true)}>Sign in</button>
      </div>
    );
  }
  const tabs = [...(user.type === 'dealer' ? [['listings', 'Listings']] : []), ['saved', 'Saved'], ['orders', 'Orders'], ['inbox', 'Inbox']];
  return (
    <div className="page">
      <Header u={user} self onLogout={() => { logout(); nav('/'); }} />
      <div className="seg">{tabs.map(([k, label]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setParams({ tab: k })}>{label}</button>)}</div>
      {(tab === 'listings' || tab === 'saved') && <Grid items={data} empty={tab === 'saved' ? 'Tap 📑 on any reel to save it here.' : 'Post your first listing.'} />}
      {tab === 'orders' && (!data ? <p className="muted center pad">Loading…</p> : data.length === 0 ? <p className="muted center pad">No orders yet.</p> : (
        <ul className="orders">
          {data.map((o) => (
            <li key={o.id}>
              <Link to={`/listing/${o.listingId}`}><b>{o.listing.title}</b></Link>
              <small className="muted">{o.buyerId === user.id ? 'Purchase' : 'Sale'} · to {o.country} by {o.shipping.label} · {ago(o.at)} ago</small>
              <div className="order-row"><span>Total {usd(o.totalUSD)}</span><span className="chip chip-dark">{o.status.replace('_', ' ')}</span><span>Deposit {usd(o.depositUSD)}</span></div>
            </li>
          ))}
        </ul>
      ))}
      {tab === 'inbox' && (!data ? <p className="muted center pad">Loading…</p> : data.length === 0 ? <p className="muted center pad">No messages yet.</p> : (
        <ul className="orders">
          {data.map((q) => (
            <li key={q.id}>
              <small className="muted">{q.fromId === user.id ? `To @${q.to?.handle}` : `From @${q.from?.handle}`} · re: <Link to={`/listing/${q.listingId}`}>{q.listing.title}</Link> · {ago(q.at)}</small>
              <p>{q.text}</p>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
