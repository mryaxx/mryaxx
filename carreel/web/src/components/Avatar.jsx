const PALETTE = ['#ff2d55', '#5856d6', '#34c759', '#ff9500', '#0a84ff', '#af52de', '#00c7be'];

export default function Avatar({ user, size = 40 }) {
  const name = user?.name || '?';
  const initials = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const color = PALETTE[[...(user?.handle || name)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: size * 0.38 }} aria-label={name}>
      {initials}
    </span>
  );
}
