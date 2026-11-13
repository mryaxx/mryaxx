import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth, useMeta } from '../lib/api.js';
import { CONDITION_LABEL } from '../lib/format.js';

export default function Create({ toast }) {
  const { user, setPrompt } = useAuth();
  const meta = useMeta();
  const nav = useNavigate();
  const [lots, setLots] = useState([]);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: '', category: 'cars', condition: 'new', brand: '', model: '', year: '2026', priceUSD: '', mileageKm: '', vin: '', lotId: '', startingBidUSD: '', description: '', tags: '' });
  useEffect(() => { api('/api/lots').then((l) => setLots(l.filter((x) => !x.ended))).catch(() => {}); }, []);
  useEffect(() => {
    const urls = files.map((x) => ({ url: URL.createObjectURL(x), video: x.type.startsWith('video/') }));
    setPreviews(urls);
    return () => urls.forEach((p) => URL.revokeObjectURL(p.url));
  }, [files]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  if (!user) return <div className="page center pad"><p className="muted">Sign in with a dealer account to post.</p><button className="btn-primary" onClick={() => setPrompt(true)}>Sign in</button></div>;
  if (user.type !== 'dealer') return <div className="page center pad"><h1 className="page-h">Sell on CarReel</h1><p className="muted">Posting is for verified dealers and exporters. Create a dealer account to start listing.</p></div>;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const form = new FormData();
    Object.entries(f).forEach(([k, v]) => v !== '' && form.append(k, v));
    files.forEach((file) => form.append('media', file));
    try {
      const l = await api('/api/listings', { method: 'POST', form });
      toast('Posted! Your listing is live in the feed.');
      nav(`/listing/${l.id}`);
    } catch (e2) { toast(e2.message); } finally { setBusy(false); }
  };
  const isCar = f.category === 'cars';
  return (
    <div className="page">
      <h1 className="page-h">New listing</h1>
      <form className="form" onSubmit={submit}>
        <label className="drop">
          <input type="file" accept="video/*,image/*" multiple onChange={(e) => setFiles([...e.target.files].slice(0, 10))} />
          {previews.length ? (
            <div className="previews">{previews.map((p) => (p.video ? <video key={p.url} src={p.url} muted /> : <img key={p.url} src={p.url} alt="" />))}</div>
          ) : <span>🎬 Add a walk-around video or photos<small>Vertical 9:16 video works best · up to 10 files, 200 MB each</small></span>}
        </label>
        <label>Title<input value={f.title} onChange={set('title')} required maxLength={120} placeholder="2026 BYD Seal AWD Performance" /></label>
        <div className="row2">
          <label>Category<select value={f.category} onChange={set('category')}>{meta?.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
          <label>Condition<select value={f.condition} onChange={set('condition')}>{meta?.conditions.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}</select></label>
        </div>
        {(isCar || f.category === 'parts') && (
          <div className="row2">
            <label>Brand<select value={f.brand} onChange={set('brand')}><option value="">—</option>{meta?.brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}</select></label>
            <label>Model<input value={f.model} onChange={set('model')} /></label>
          </div>
        )}
        {isCar && (
          <div className="row2">
            <label>Year<input type="number" value={f.year} onChange={set('year')} min="1990" max="2030" /></label>
            <label>Mileage (km)<input type="number" value={f.mileageKm} onChange={set('mileageKm')} min="0" /></label>
          </div>
        )}
        {isCar && <label>VIN<input value={f.vin} onChange={set('vin')} maxLength={17} /></label>}
        <div className="row2">
          <label>Price USD (FOB)<input type="number" value={f.priceUSD} onChange={set('priceUSD')} required min="1" /></label>
          <label>Sell via<select value={f.lotId} onChange={set('lotId')}><option value="">Buy now</option>{lots.map((l) => <option key={l.id} value={l.id}>Auction {l.number}</option>)}</select></label>
        </div>
        {f.lotId && <label>Starting bid USD<input type="number" value={f.startingBidUSD} onChange={set('startingBidUSD')} min="1" placeholder="Defaults to 60% of price" /></label>}
        <label>Description<textarea value={f.description} onChange={set('description')} rows={4} maxLength={4000} placeholder="Condition, export documents, inspection report, shipping port…" /></label>
        <label>Tags<input value={f.tags} onChange={set('tags')} placeholder="ev, awd, export-ready" /></label>
        <button className="btn-primary" disabled={busy}>{busy ? 'Uploading…' : 'Post listing'}</button>
      </form>
    </div>
  );
}
