import { useEffect, useState } from 'react';

export const usd = (n) => (n == null ? '—' : `$${Number(n).toLocaleString('en-US')}`);
export const compact = (n) => Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
export const km = (n) => (n == null ? '—' : `${Number(n).toLocaleString('en-US')} km`);
export const ago = (t) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};
export const CONDITION_LABEL = { new: 'Brand new', refurbished: 'Refurbished', used: 'Used' };

export function useCountdown(endsAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, (endsAt || 0) - now);
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
  const pad = (x) => String(x).padStart(2, '0');
  const text = ms === 0 ? 'Ended' : d ? `${d}d ${h}h ${m}m` : `${pad(h)}:${pad(m)}:${pad(s)}`;
  return { ms, text, urgent: ms > 0 && ms < 3600000 };
}

export async function shareListing(l) {
  const url = `${location.origin}/listing/${l.id}`;
  try {
    if (navigator.share) { await navigator.share({ title: l.title, url }); return 'shared'; }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch { return null; }
}
