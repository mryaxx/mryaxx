import { useCallback, useEffect, useRef, useState } from 'react';
import FeedItem from '../components/FeedItem.jsx';
import { CommentsSheet } from '../components/Sheets.jsx';
import { api, useAuth, useMeta } from '../lib/api.js';

const TABS = [['following', 'Following'], ['foryou', 'For You'], ['auctions', 'Live Auctions']];

export default function Feed({ toast }) {
  const meta = useMeta();
  const { user } = useAuth();
  const [tab, setTab] = useState('foryou');
  const [category, setCategory] = useState('');
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState('0');
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [comments, setComments] = useState(null);
  const scroller = useRef(null);
  const reqId = useRef(0);

  const load = useCallback(async (reset) => {
    const c = reset ? '0' : cursor;
    if (c == null) return;
    const my = ++reqId.current;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ tab, cursor: c, ...(category && { category }) });
      const r = await api(`/api/feed?${qs}`);
      if (my !== reqId.current) return; // a newer request superseded this one
      setItems((prev) => (reset ? r.items : [...prev, ...r.items.filter((x) => !prev.some((p) => p.id === x.id))]));
      setCursor(r.nextCursor);
    } catch (e) { toast(e.message); } finally { if (my === reqId.current) setLoading(false); }
  }, [tab, category, cursor, toast]);

  // Reload from the top when the tab, category or signed-in user changes.
  useEffect(() => {
    setItems([]); setActive(0);
    scroller.current?.scrollTo({ top: 0 });
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, category, user?.id]);

  // Track which reel is on screen (drives autoplay) and prefetch the next page.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number(e.target.dataset.index));
    }, { root, threshold: 0.6 });
    root.querySelectorAll('[data-index]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items]);
  useEffect(() => { if (!loading && cursor && active >= items.length - 3) load(false); }, [active, items.length, cursor, loading, load]);

  // Keyboard navigation on desktop.
  useEffect(() => {
    const k = (e) => {
      if (comments || !['ArrowDown', 'ArrowUp'].includes(e.key) || e.target.closest('input,textarea,select')) return;
      e.preventDefault();
      const next = Math.max(0, Math.min(items.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      scroller.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ behavior: 'smooth' });
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [active, items.length, comments]);

  return (
    <div className="feed-wrap">
      <header className="feed-top">
        <nav className="feed-tabs">
          {TABS.map(([k, label]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}
        </nav>
        <div className="feed-cats">
          <button className={!category ? 'on' : ''} onClick={() => setCategory('')}>All</button>
          {meta?.categories.map((c) => <button key={c.slug} className={category === c.slug ? 'on' : ''} onClick={() => setCategory(c.slug)}>{c.icon} {c.name}</button>)}
        </div>
      </header>

      <div className="feed" ref={scroller}>
        {items.map((l, i) => (
          <div key={l.id} data-index={i} className="feed-slot">
            {Math.abs(i - active) <= 2 ? (
              <FeedItem listing={l} active={i === active} preload={i === active + 1} muted={muted} onToggleMute={() => setMuted((m) => !m)}
                onComments={(x, onCount) => setComments({ listing: x, onCount })} toast={toast} />
            ) : <div className="reel" />}
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="feed-empty">
            {tab === 'following' ? (user ? 'Follow dealers to see their new drops here.' : 'Sign in and follow dealers to build your Following feed.') : 'No listings match this filter.'}
          </div>
        )}
        {loading && <div className="feed-loading">Loading…</div>}
      </div>

      {comments && <CommentsSheet listing={comments.listing} onCount={comments.onCount} onClose={() => setComments(null)} />}
    </div>
  );
}
