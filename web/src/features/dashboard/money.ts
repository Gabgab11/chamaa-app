import { useApp } from '../../app/app-state';
import { convert, formatMoney, type Minor } from '../../lib/money';

/** Formats an amount held in `from` currency in the member's display currency. */
export function useMoney() {
  const { displayCurrency, lang } = useApp();
  const locale = lang === 'sw' ? 'sw-KE' : 'en-GB';
  return {
    currency: displayCurrency,
    show: (minor: Minor, from: string) => formatMoney(convert(minor, from, displayCurrency), displayCurrency, locale),
    raw: (minorInDisplay: Minor) => formatMoney(Math.round(minorInDisplay), displayCurrency, locale),
    toDisplay: (minor: Minor, from: string) => convert(minor, from, displayCurrency),
    locale,
  };
}
