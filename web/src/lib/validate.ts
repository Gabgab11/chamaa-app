export const emailOk = (v: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Local number part only (dial code is picked separately). */
export const phoneDigits = (v: string): string => v.replace(/\D/g, '').replace(/^0+/, '');
export const phoneOk = (v: string): boolean => {
  const d = phoneDigits(v);
  return d.length >= 6 && d.length <= 14;
};

export const passwordOk = (v: string): boolean => v.length >= 8 && /\d/.test(v) && /[A-Za-z]/.test(v);

export const nameOk = (v: string): boolean => v.trim().length >= 1 && v.trim().length <= 60;
