// Deterministic demo catalog. Replace with real dealer/auction feeds in production.

export const BRANDS = [
  { slug: 'byd', name: 'BYD', color: '#c8102e', models: ['Seal', 'Han EV', 'Atto 3', 'Dolphin', 'Song Plus', 'Tang DM-i'] },
  { slug: 'nio', name: 'NIO', color: '#1f6feb', models: ['ET5', 'ET7', 'ES6', 'EC6', 'ES8'] },
  { slug: 'xpeng', name: 'XPeng', color: '#00a389', models: ['G6', 'P7i', 'G9', 'X9', 'Mona M03'] },
  { slug: 'li-auto', name: 'Li Auto', color: '#3a3a3a', models: ['L6', 'L7', 'L8', 'L9', 'MEGA'] },
  { slug: 'zeekr', name: 'Zeekr', color: '#5b5bd6', models: ['001', '007', '009', 'X', '7X'] },
  { slug: 'xiaomi', name: 'Xiaomi', color: '#ff6900', models: ['SU7', 'SU7 Max', 'YU7'] },
  { slug: 'geely', name: 'Geely', color: '#2b5797', models: ['Galaxy E5', 'Monjaro', 'Coolray', 'Preface'] },
  { slug: 'chery', name: 'Chery', color: '#b5121b', models: ['Tiggo 8 Pro', 'Tiggo 7', 'Arrizo 8', 'Omoda 5'] },
  { slug: 'great-wall', name: 'Great Wall', color: '#7a1f1f', models: ['Tank 300', 'Tank 500', 'Haval H6', 'Poer'] },
  { slug: 'changan', name: 'Changan', color: '#00539b', models: ['UNI-V', 'UNI-K', 'Deepal S7', 'CS75 Plus'] },
  { slug: 'hongqi', name: 'Hongqi', color: '#8b0000', models: ['H9', 'E-HS9', 'HS5'] },
  { slug: 'mg', name: 'MG (SAIC)', color: '#a51c30', models: ['MG4', 'Cyberster', 'MG7', 'ZS EV'] },
];

export const CATEGORIES = [
  { slug: 'cars', name: 'Cars', icon: '🚗' },
  { slug: 'parts', name: 'Parts', icon: '⚙️' },
  { slug: 'robotics', name: 'Robotics', icon: '🤖' },
  { slug: 'automotive-tech', name: 'Auto Tech', icon: '🔋' },
];

export const CONDITIONS = ['new', 'refurbished', 'used'];

const SAMPLE_VIDEOS = ['byd', 'xiaomi', 'zeekr', 'great-wall', 'robotics', 'automotive-tech'];

const DEALERS = [
  { handle: 'shenzhen_ev_hub', name: 'Shenzhen EV Hub', city: 'Shenzhen', bio: 'Factory-direct NEVs. Export docs, RoRo & container from Shekou.' },
  { handle: 'shanghai_motors_export', name: 'Shanghai Motors Export', city: 'Shanghai', bio: 'Licensed exporter. Brand new & zero-km cars, CIF worldwide.' },
  { handle: 'guangzhou_refurb', name: 'Guangzhou Refurb Works', city: 'Guangzhou', bio: 'Certified refurbished EVs. 168-point inspection, battery SOH report.' },
  { handle: 'tianjin_port_auto', name: 'Tianjin Port Auto', city: 'Tianjin', bio: 'Auction lots every week. Parallel import specialists.' },
  { handle: 'ningbo_parts_depot', name: 'Ningbo Parts Depot', city: 'Ningbo', bio: 'OEM & aftermarket parts for Chinese brands. Ship by air or sea.' },
  { handle: 'hangzhou_robotics', name: 'Hangzhou Robotics Lab', city: 'Hangzhou', bio: 'Quadrupeds, humanoids, AGVs and garage automation.' },
  { handle: 'chongqing_autotech', name: 'Chongqing AutoTech', city: 'Chongqing', bio: 'Battery packs, chargers, ADAS kits and infotainment upgrades.' },
];

const BUYERS = [
  { handle: 'amina_lagos', name: 'Amina O.', city: 'Lagos', country: 'NG' },
  { handle: 'carlos_mx', name: 'Carlos R.', city: 'Monterrey', country: 'MX' },
  { handle: 'dubai_fleet', name: 'Dubai Fleet Co.', city: 'Dubai', country: 'AE' },
];

const PARTS = [
  ['LED headlight assembly', 'byd', 'Seal', 420],
  ['Front bumper kit (OEM)', 'xpeng', 'G6', 380],
  ['Blade battery module 3.2 kWh', 'byd', 'Han EV', 1450],
  ['Air suspension strut', 'nio', 'ET7', 690],
  ['Central touchscreen 15.6"', 'li-auto', 'L9', 820],
  ['Carbon brake pads set', 'zeekr', '001', 160],
  ['Side mirror w/ camera', 'xiaomi', 'SU7', 310],
  ['Wheel set 20" forged', 'geely', 'Galaxy E5', 1100],
  ['Tow hook + bash plate', 'great-wall', 'Tank 300', 240],
];

const ROBOTICS = [
  ['Quadruped robot dog – inspection edition', 6900],
  ['Humanoid service robot (dev kit)', 38000],
  ['Autonomous parking AGV', 15500],
  ['6-axis welding arm (refurbished)', 9200],
  ['EV charging robot arm', 12800],
];

const AUTOTECH = [
  ['Portable 7 kW EV charger (GB/T + Type 2)', 340],
  ['60 kW DC fast charger', 7400],
  ['LiDAR ADAS retrofit kit', 2100],
  ['V2L outdoor power adapter', 95],
  ['LFP home storage 15 kWh', 3900],
];

// Small deterministic PRNG so seeds are stable between runs.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildSeed() {
  const r = rng(42);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const int = (min, max) => Math.floor(min + r() * (max - min + 1));
  const now = Date.now();
  const DAY = 86400000;

  const users = [
    ...DEALERS.map((d, i) => ({
      id: `u_d${i + 1}`,
      type: 'dealer',
      verified: i !== 3,
      country: 'CN',
      followers: int(2000, 250000),
      ...d,
    })),
    ...BUYERS.map((b, i) => ({ id: `u_b${i + 1}`, type: 'buyer', verified: false, followers: int(5, 400), bio: '', ...b })),
  ];
  const dealer = (handle) => users.find((u) => u.handle === handle);

  const lots = [
    { id: 'lot_2401', number: 'L-2401', title: 'Tianjin weekly – Zero-km NEVs', dealerId: dealer('tianjin_port_auto').id, location: 'Tianjin Port', endsAt: now + 2 * DAY + 3 * 3600e3 },
    { id: 'lot_2402', number: 'L-2402', title: 'Refurbished EV clearance', dealerId: dealer('guangzhou_refurb').id, location: 'Guangzhou Nansha', endsAt: now + 5 * DAY },
    { id: 'lot_2403', number: 'L-2403', title: 'Fleet return – ride-hailing sedans', dealerId: dealer('tianjin_port_auto').id, location: 'Tianjin Port', endsAt: now + 9 * 3600e3 },
    { id: 'lot_2404', number: 'L-2404', title: 'Robotics & factory automation', dealerId: dealer('hangzhou_robotics').id, location: 'Hangzhou', endsAt: now + 4 * DAY },
  ];

  const listings = [];
  let n = 1;
  const carDealers = ['shenzhen_ev_hub', 'shanghai_motors_export', 'guangzhou_refurb', 'tianjin_port_auto'];

  for (const brand of BRANDS) {
    for (let k = 0; k < 3; k++) {
      const handle = pick(carDealers);
      const condition = handle === 'guangzhou_refurb' ? 'refurbished' : handle === 'tianjin_port_auto' ? pick(['used', 'new']) : pick(['new', 'new', 'refurbished']);
      const model = pick(brand.models);
      const year = condition === 'new' ? 2026 : int(2021, 2025);
      const price = int(14, 72) * 1000 + int(0, 9) * 100;
      const inLot = handle === 'tianjin_port_auto' || (handle === 'guangzhou_refurb' && r() > 0.4);
      const lot = inLot ? (handle === 'guangzhou_refurb' ? lots[1] : pick([lots[0], lots[2]])) : null;
      listings.push({
        id: `l_${n++}`,
        category: 'cars',
        condition,
        brand: brand.slug,
        model,
        year,
        title: `${year} ${brand.name} ${model}`,
        description: `${condition === 'new' ? 'Zero-km, export-ready' : condition === 'refurbished' ? 'Certified refurbished with battery health report' : 'Clean title, inspected'} ${brand.name} ${model}. Left-hand drive. Export paperwork, deregistration certificate and COC available.`,
        dealerId: dealer(handle).id,
        lotId: lot ? lot.id : null,
        sale: lot ? 'auction' : 'buy_now',
        priceUSD: price,
        startingBidUSD: lot ? Math.round(price * 0.6 / 100) * 100 : null,
        mileageKm: condition === 'new' ? int(0, 30) : int(4000, 85000),
        location: `${dealer(handle).city}, CN`,
        vin: `LGX${String(100000 + n * 7919).slice(-6)}${brand.slug.slice(0, 2).toUpperCase()}${year}`,
        specs: {
          powertrain: pick(['BEV', 'BEV', 'PHEV', 'EREV']),
          rangeKm: int(420, 820),
          batteryKWh: int(50, 110),
          drive: pick(['RWD', 'AWD', 'FWD']),
          seats: pick([5, 5, 6, 7]),
          steering: 'LHD',
          color: pick(['Pearl White', 'Graphite', 'Midnight Blue', 'Aurora Green', 'Racing Red']),
          batterySOH: condition === 'new' ? 100 : int(88, 99),
        },
        media: [],
        tags: [brand.name.toLowerCase(), model.toLowerCase(), condition],
        stats: { likes: int(80, 9000), comments: 0, saves: int(10, 900), shares: int(5, 400), views: int(1000, 250000) },
        createdAt: now - int(1, 40) * 3600e3,
      });
    }
  }

  for (const [title, brandSlug, model, price] of PARTS) {
    listings.push({
      id: `l_${n++}`, category: 'parts', condition: pick(['new', 'new', 'refurbished']), brand: brandSlug, model, year: null,
      title, description: `Fits ${BRANDS.find((b) => b.slug === brandSlug).name} ${model}. OEM part number on request. Air freight 5–8 days.`,
      dealerId: dealer('ningbo_parts_depot').id, lotId: null, sale: 'buy_now', priceUSD: price, startingBidUSD: null,
      location: 'Ningbo, CN', specs: { fitment: `${model}`, warrantyMonths: 12, weightKg: int(1, 40) }, media: [],
      tags: ['parts', model.toLowerCase()], stats: { likes: int(10, 900), comments: 0, saves: int(5, 200), shares: int(1, 60), views: int(300, 20000) },
      createdAt: now - int(1, 90) * 3600e3,
    });
  }

  for (const [title, price] of ROBOTICS) {
    const auction = r() > 0.5;
    listings.push({
      id: `l_${n++}`, category: 'robotics', condition: title.includes('refurbished') ? 'refurbished' : 'new', brand: null, model: null, year: 2026,
      title, description: 'Ships with CE documentation, SDK access and remote commissioning support.',
      dealerId: dealer('hangzhou_robotics').id, lotId: auction ? 'lot_2404' : null, sale: auction ? 'auction' : 'buy_now',
      priceUSD: price, startingBidUSD: auction ? Math.round(price * 0.55) : null, location: 'Hangzhou, CN',
      specs: { payloadKg: int(5, 60), runtimeH: int(2, 10), sdk: 'ROS 2' }, media: [], tags: ['robotics'],
      stats: { likes: int(200, 20000), comments: 0, saves: int(20, 2000), shares: int(10, 900), views: int(5000, 400000) },
      createdAt: now - int(1, 60) * 3600e3,
    });
  }

  for (const [title, price] of AUTOTECH) {
    listings.push({
      id: `l_${n++}`, category: 'automotive-tech', condition: 'new', brand: null, model: null, year: 2026,
      title, description: 'CE/UKCA certified. Multi-voltage. Installer guides in English, Spanish, French, Arabic.',
      dealerId: dealer('chongqing_autotech').id, lotId: null, sale: 'buy_now', priceUSD: price, startingBidUSD: null,
      location: 'Chongqing, CN', specs: { warrantyMonths: 24 }, media: [], tags: ['tech', 'charging'],
      stats: { likes: int(50, 4000), comments: 0, saves: int(10, 600), shares: int(5, 300), views: int(1000, 60000) },
      createdAt: now - int(1, 60) * 3600e3,
    });
  }

  // Every seeded listing gets generated poster art (served by /media/poster/:id.svg).
  for (const l of listings) l.media = [{ type: 'image', url: `/media/poster/${l.id}.svg` }];

  // A few listings lead with a short sample video reel (server/sample-media) so the feed exercises real video playback.
  const withVideo = new Set();
  for (const l of listings) {
    const key = l.category === 'cars' ? l.brand : l.category;
    if (SAMPLE_VIDEOS.includes(key) && !withVideo.has(key)) {
      withVideo.add(key);
      l.media.unshift({ type: 'video', url: `/sample-media/${key}.mp4`, poster: `/media/poster/${l.id}.svg` });
    }
  }

  const bids = [];
  for (const l of listings.filter((x) => x.sale === 'auction')) {
    const count = int(0, 5);
    let amount = l.startingBidUSD;
    for (let i = 0; i < count; i++) {
      amount += int(2, 10) * 100;
      bids.push({ id: `b_${bids.length + 1}`, listingId: l.id, userId: pick(users.filter((u) => u.type === 'buyer')).id, amountUSD: amount, at: now - int(1, 30) * 3600e3 });
    }
  }

  const sampleComments = [
    'Can you ship this to Lagos? RoRo or container?',
    'What is the battery SOH?',
    'Is a right-hand-drive version available?',
    'Price for 5 units?',
    'Does it come with a CCS2 adapter?',
  ];
  const comments = [];
  for (const l of listings.slice(0, 30)) {
    const count = int(0, 3);
    for (let i = 0; i < count; i++) {
      comments.push({ id: `c_${comments.length + 1}`, listingId: l.id, userId: pick(users.filter((u) => u.type === 'buyer')).id, text: pick(sampleComments), at: now - int(1, 20) * 3600e3 });
      l.stats.comments++;
    }
  }

  return { users, lots, listings, bids, comments, likes: [], saves: [], follows: [], orders: [], inquiries: [] };
}
