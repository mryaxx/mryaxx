import { useEffect, useState } from 'react';
import { api, useAuth } from '../lib/api.js';
import { ago } from '../lib/format.js';
import Avatar from './Avatar.jsx';

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head"><span>{title}</span><button onClick={onClose} aria-label="Close">✕</button></header>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function CommentsSheet({ listing, onClose, onCount }) {
  const [items, setItems] = useState(null);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const { requireAuth } = useAuth();
  useEffect(() => { api(`/api/listings/${listing.id}/comments`).then(setItems).catch((e) => setErr(e.message)); }, [listing.id]);
  const send = requireAuth(async () => {
    if (!text.trim()) return;
    try {
      const c = await api(`/api/listings/${listing.id}/comments`, { method: 'POST', body: { text } });
      const next = [c, ...(items || [])];
      setItems(next); setText(''); onCount?.(next.length);
    } catch (e2) { setErr(e2.message); }
  });
  return (
    <Sheet title={`${items?.length ?? ''} comments`} onClose={onClose}>
      {err && <p className="error">{err}</p>}
      {!items ? <p className="muted">Loading…</p> : items.length === 0 ? <p className="muted center">Be the first to ask the dealer something.</p> : (
        <ul className="comments">
          {items.map((c) => (
            <li key={c.id}><Avatar user={c.user} size={32} /><div><b>@{c.user?.handle}</b> <span className="muted">{ago(c.at)}</span><p>{c.text}</p></div></li>
          ))}
        </ul>
      )}
      <form className="comment-form" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about shipping, specs, RHD…" maxLength={500} />
        <button disabled={!text.trim()}>Post</button>
      </form>
    </Sheet>
  );
}

export function SignInSheet() {
  const { login, register, setPrompt } = useAuth();
  const [users, setUsers] = useState([]);
  const [mode, setMode] = useState('demo');
  const [form, setForm] = useState({ handle: '', name: '', type: 'buyer', country: '', city: '' });
  const [err, setErr] = useState('');
  useEffect(() => { api('/api/auth/demo-users').then(setUsers).catch(() => {}); }, []);
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    try { await register(form); } catch (e2) { setErr(e2.message); }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Sheet title="Sign in to CarReel" onClose={() => setPrompt(false)}>
      <div className="seg">
        <button className={mode === 'demo' ? 'on' : ''} onClick={() => setMode('demo')}>Demo accounts</button>
        <button className={mode === 'new' ? 'on' : ''} onClick={() => setMode('new')}>Create account</button>
      </div>
      {err && <p className="error">{err}</p>}
      {mode === 'demo' ? (
        <ul className="user-list">
          {users.map((u) => (
            <li key={u.id}><button onClick={() => login(u.handle).catch((e) => setErr(e.message))}>
              <Avatar user={u} size={36} /><span><b>{u.name}</b><small>@{u.handle} · {u.type === 'dealer' ? 'Dealer' : 'Buyer'} · {u.city}</small></span>
            </button></li>
          ))}
        </ul>
      ) : (
        <form className="form" onSubmit={submit}>
          <label>Handle<input value={form.handle} onChange={set('handle')} placeholder="lowercase_handle" required /></label>
          <label>Display name<input value={form.name} onChange={set('name')} required /></label>
          <label>Account type<select value={form.type} onChange={set('type')}><option value="buyer">Buyer</option><option value="dealer">Dealer / exporter</option></select></label>
          <div className="row2">
            <label>Country (ISO)<input value={form.country} onChange={set('country')} maxLength={2} placeholder="NG" /></label>
            <label>City<input value={form.city} onChange={set('city')} /></label>
          </div>
          <button className="btn-primary">Create account</button>
          <p className="muted small">Prototype only: no password or KYC yet. See docs/ARCHITECTURE.md.</p>
        </form>
      )}
    </Sheet>
  );
}
