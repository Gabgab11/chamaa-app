// Country list: [ISO code, name, dialling code, currency]. Kept small and local so sign-up works offline.
export type Country = readonly [code: string, name: string, dial: string, currency: string];

export const COUNTRIES: readonly Country[] = [
  ['KE', "Kenya", '254', 'KES'],
  ['UG', "Uganda", '256', 'UGX'],
  ['TZ', "Tanzania", '255', 'TZS'],
  ['RW', "Rwanda", '250', 'RWF'],
  ['ET', "Ethiopia", '251', 'ETB'],
  ['NG', "Nigeria", '234', 'NGN'],
  ['GH', "Ghana", '233', 'GHS'],
  ['ZA', "South Africa", '27', 'ZAR'],
  ['ZM', "Zambia", '260', 'ZMW'],
  ['ZW', "Zimbabwe", '263', 'USD'],
  ['CM', "Cameroon", '237', 'XAF'],
  ['SN', "Senegal", '221', 'XOF'],
  ['EG', "Egypt", '20', 'EGP'],
  ['MA', "Morocco", '212', 'MAD'],
  ['AE', "United Arab Emirates", '971', 'AED'],
  ['SA', "Saudi Arabia", '966', 'SAR'],
  ['QA', "Qatar", '974', 'QAR'],
  ['IN', "India", '91', 'INR'],
  ['PK', "Pakistan", '92', 'PKR'],
  ['PH', "Philippines", '63', 'PHP'],
  ['GB', "United Kingdom", '44', 'GBP'],
  ['IE', "Ireland", '353', 'EUR'],
  ['DE', "Germany", '49', 'EUR'],
  ['FR', "France", '33', 'EUR'],
  ['NL', "Netherlands", '31', 'EUR'],
  ['IT', "Italy", '39', 'EUR'],
  ['ES', "Spain", '34', 'EUR'],
  ['SE', "Sweden", '46', 'SEK'],
  ['US', "United States", '1', 'USD'],
  ['CA', "Canada", '1', 'CAD'],
  ['JM', "Jamaica", '1', 'JMD'],
  ['BR', "Brazil", '55', 'BRL'],
  ['MX', "Mexico", '52', 'MXN'],
  ['AU', "Australia", '61', 'AUD'],
  ['NZ', "New Zealand", '64', 'NZD'],
];

const byCode = new Map(COUNTRIES.map((c) => [c[0], c]));

export function country(code: string | null | undefined): Country {
  return byCode.get((code || '').toUpperCase()) ?? byCode.get('KE')!;
}

export function isKnownCountry(code: string | null | undefined): boolean {
  return byCode.has((code || '').toUpperCase());
}

export function searchCountries(q: string): readonly Country[] {
  const s = q.trim().toLowerCase();
  if (!s) return COUNTRIES;
  return COUNTRIES.filter((c) => c[1].toLowerCase().includes(s) || c[0].toLowerCase() === s || c[2].startsWith(s.replace('+', '')));
}
