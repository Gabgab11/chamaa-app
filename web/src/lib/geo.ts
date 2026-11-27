import { isKnownCountry } from './countries';
import { readString, writeString } from './storage';

// Fallback guess from the time zone when the edge lookup is unavailable (local dev, offline).
const TZ: Record<string, string> = {
  'Africa/Nairobi': 'KE', 'Africa/Kampala': 'UG', 'Africa/Dar_es_Salaam': 'TZ', 'Africa/Kigali': 'RW', 'Africa/Addis_Ababa': 'ET',
  'Africa/Lagos': 'NG', 'Africa/Accra': 'GH', 'Africa/Johannesburg': 'ZA', 'Africa/Lusaka': 'ZM', 'Africa/Harare': 'ZW',
  'Africa/Cairo': 'EG', 'Africa/Casablanca': 'MA', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA',
  'Asia/Kolkata': 'IN', 'Asia/Karachi': 'PK', 'Asia/Manila': 'PH', 'Europe/London': 'GB', 'Europe/Stockholm': 'SE',
  'America/Toronto': 'CA', 'America/Jamaica': 'JM', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX',
  'Australia/Sydney': 'AU', 'Pacific/Auckland': 'NZ',
};

export function guessFromTimeZone(): string {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    /* ignore */
  }
  if (TZ[tz]) return TZ[tz];
  if (tz.startsWith('America/')) return 'US';
  if (tz.startsWith('Europe/')) return 'DE';
  return 'KE';
}

/** Visitor country: cached edge answer, else time-zone guess. Refreshes in the background. */
export function initialCountry(): string {
  const c = readString('chamaa-geo');
  return c && isKnownCountry(c) ? c : guessFromTimeZone();
}

export async function refreshCountry(signal?: AbortSignal): Promise<string | null> {
  try {
    const r = await fetch('/api/geo', { signal, cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { country?: string };
    if (j.country && isKnownCountry(j.country)) {
      writeString('chamaa-geo', j.country);
      return j.country;
    }
  } catch {
    /* offline or local dev */
  }
  return null;
}
