import { useEffect, useRef, useState } from 'react';

/**
 * Player abstraction for feed media.
 *
 * Web: HTML5 <video> (MP4 everywhere, HLS natively on Safari/iOS). Images get a slow
 * "Ken Burns" pan so photo listings still feel like reels.
 *
 * The Android app does the same job with REX Player's libmpv surface (android/.../carreel/CarReelScreen.kt).
 * See docs/VIDEO.md.
 */
export default function MediaPlayer({ media, active, muted, onToggleMute, onDoubleTap, preload = false }) {
  const ref = useRef(null);
  const lastTap = useRef(0);
  const tapTimer = useRef(null);
  const [paused, setPaused] = useState(false);
  const [index, setIndex] = useState(0);
  const item = media[index] || media[0];

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (active && !paused) v.play().catch(() => {});
    else v.pause();
    if (!active) { v.currentTime = 0; setPaused(false); }
  }, [active, paused, item]);

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      clearTimeout(tapTimer.current);
      onDoubleTap?.();
    } else {
      tapTimer.current = setTimeout(() => {
        if (item?.type === 'video') setPaused((p) => !p);
      }, 290);
    }
    lastTap.current = now;
  };

  if (!item) return <div className="media" />;
  return (
    <div className="media" onClick={onTap}>
      {item.type === 'video' ? (
        <video ref={ref} src={item.url} poster={item.poster} muted={muted} loop playsInline preload={active || preload ? 'auto' : 'metadata'} />
      ) : (
        <img src={item.url} alt="" className={active ? 'kenburns' : ''} loading={active || preload ? 'eager' : 'lazy'} draggable={false} />
      )}
      {item.type === 'video' && paused && <div className="play-glyph" aria-hidden>▶</div>}
      {item.type === 'video' && (
        <button className="mute" onClick={(e) => { e.stopPropagation(); onToggleMute?.(); }} aria-label={muted ? 'Unmute' : 'Mute'}>
          {muted ? '🔇' : '🔊'}
        </button>
      )}
      {media.length > 1 && (
        <div className="dots" onClick={(e) => e.stopPropagation()}>
          {media.map((_, i) => <button key={i} className={i === index ? 'on' : ''} onClick={() => setIndex(i)} aria-label={`Media ${i + 1}`} />)}
        </div>
      )}
    </div>
  );
}
