// Indicative freight model from Chinese ports. Real quotes come from forwarders.
const REGIONS = {
  africa_west: { name: 'West Africa', countries: ['NG', 'GH', 'CI', 'SN', 'BJ', 'TG', 'CM'], roro: 1900, container: 2900, days: [32, 45] },
  africa_east: { name: 'East & Southern Africa', countries: ['KE', 'TZ', 'UG', 'ZA', 'MZ', 'ET', 'ZM'], roro: 1700, container: 2600, days: [25, 38] },
  middle_east: { name: 'Middle East', countries: ['AE', 'SA', 'QA', 'OM', 'KW', 'BH', 'JO', 'IQ'], roro: 1200, container: 1900, days: [18, 26] },
  europe: { name: 'Europe', countries: ['GB', 'DE', 'FR', 'NL', 'BE', 'ES', 'IT', 'PL', 'NO', 'SE', 'IE', 'PT'], roro: 2100, container: 3200, days: [35, 48] },
  latam: { name: 'Latin America', countries: ['MX', 'BR', 'CL', 'PE', 'CO', 'AR', 'EC', 'PA', 'DO'], roro: 2300, container: 3400, days: [30, 45] },
  oceania: { name: 'Oceania', countries: ['AU', 'NZ', 'FJ', 'PG'], roro: 1600, container: 2500, days: [18, 28] },
  asia: { name: 'Asia', countries: ['TH', 'MY', 'PH', 'ID', 'VN', 'KH', 'PK', 'BD', 'LK', 'KZ', 'UZ', 'MN'], roro: 900, container: 1500, days: [8, 20] },
  north_america: { name: 'North America', countries: ['CA', 'US'], roro: 2600, container: 3800, days: [25, 40] },
};

export const COUNTRIES = Object.values(REGIONS).flatMap((r) => r.countries).sort();

export function regionFor(country) {
  return Object.entries(REGIONS).find(([, r]) => r.countries.includes(country));
}

export function quote(listing, country) {
  const match = regionFor(country);
  if (!match) return null;
  const [key, region] = match;
  const options = [];
  if (listing.category === 'cars') {
    options.push({ method: 'roro', label: 'RoRo (roll-on/roll-off)', costUSD: region.roro, days: region.days });
    options.push({ method: 'container', label: 'Shared 40ft container', costUSD: region.container, days: [region.days[0] + 4, region.days[1] + 6] });
  } else {
    const kg = listing.specs?.weightKg ?? (listing.category === 'robotics' ? 80 : 20);
    options.push({ method: 'air', label: 'Air freight', costUSD: Math.round(40 + kg * 9.5), days: [5, 9] });
    options.push({ method: 'sea_lcl', label: 'Sea freight (LCL)', costUSD: Math.round(180 + kg * 2.2), days: [region.days[0], region.days[1] + 5] });
  }
  const restricted = key === 'north_america' && listing.category === 'cars';
  return {
    country,
    region: region.name,
    options,
    notes: [
      'Indicative only. Final freight, insurance and port fees are confirmed by the forwarder.',
      'Import duties, VAT and homologation are the buyer\'s responsibility and vary by country.',
      ...(restricted ? ['Chinese-built passenger vehicles face heavy tariffs/restrictions in the US & Canada. Check local rules before bidding.'] : []),
    ],
  };
}
