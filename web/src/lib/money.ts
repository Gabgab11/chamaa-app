// Money is stored as integer minor units (cents) in the chama's own currency.
// Display conversion uses indicative rates until a live rate source is chosen.
export const FX: Readonly<Record<string, number>> = {
  USD: 1, KES: 129, UGX: 3700, TZS: 2600, RWF: 1400, ETB: 125, NGN: 1550, GHS: 12.5, ZAR: 18, ZMW: 27,
  XAF: 600, XOF: 600, EGP: 49, MAD: 10, AED: 3.67, SAR: 3.75, QAR: 3.64, INR: 85, PKR: 280, PHP: 57,
  GBP: 0.78, EUR: 0.92, SEK: 10.6, CAD: 1.38, JMD: 157, BRL: 5.6, MXN: 18.5, AUD: 1.53, NZD: 1.68,
};

export type Minor = number; // integer minor units

export function toMinor(major: number): Minor {
  return Math.round(major * 100);
}

export function convert(minor: Minor, from: string, to: string): Minor {
  if (from === to) return minor;
  const a = FX[from], b = FX[to];
  if (!a || !b) return minor;
  return Math.round((minor / a) * b);
}

const fmtCache = new Map<string, Intl.NumberFormat>();
function formatter(currency: string, locale: string, decimals: number): Intl.NumberFormat {
  const key = `${currency}|${locale}|${decimals}`;
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } catch {
      f = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
    fmtCache.set(key, f);
  }
  return f;
}

/** Format minor units. Whole amounts drop the decimals, like the demo. */
export function formatMoney(minor: Minor, currency: string, locale = 'en-GB'): string {
  const major = minor / 100;
  const decimals = Number.isInteger(major) ? 0 : 2;
  const s = formatter(currency, locale, decimals).format(major);
  return currency === 'KES' ? s.replace(/^KES\s?|^Ksh\s?/i, 'KSh ') : s;
}
