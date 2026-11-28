// Strings for the screens moved so far. Kiswahili falls back to English where not yet translated.
const en = {
  tag: 'Save together.\nGrow together.',
  sub: 'Contributions, payouts and shared goals, tracked securely in one place.',
  create: 'Create account', login: 'Log in', inv: 'I have an invite code',
  suT: 'Create your account', suS: 'Join your chama in a minute.',
  first: 'First name', last: 'Last name', email: 'Email', phone: 'Phone number', city: 'City', country: 'Country',
  newpw: 'Create a password', pwHint: 'At least 8 characters, with letters and a number.',
  invCode: 'Invite code', optional: '(optional)', terms: 'I agree to the Terms and Privacy Policy',
  have: 'Already have an account?', liT: 'Welcome back', liS: 'Log in with your email and password.',
  pw: 'Password', forgot: 'Forgot password?', newTo: 'New to MyChamaa?',
  fgT: 'Reset your password', fgS: "Enter your email and we'll send you a link to choose a new password.",
  fgBtn: 'Send reset link', fgSent: 'If an account exists for {e}, a reset link is on its way.', backLogin: 'Back to log in',
  vfT: 'Check your email', vfS: "We've sent a verification link to", vfS2: 'Tap the link in the email to activate your account, then log in.',
  vfOk: 'Go to log in', vfResend: 'Resend email in {s}s', vfResendNow: "Didn't get it? Resend email", sent: 'Verification email sent again.',
  eFirst: 'Enter your first name.', eLast: 'Enter your last name.', eEmail: 'Enter a valid email address.', ePhone: 'Enter a valid phone number.',
  eCity: 'Enter your city.', ePw: 'Use at least 8 characters, with letters and a number.', eTerms: 'Please agree to the Terms to continue.',
  eLogin: 'Enter your email and password.', eCreds: "That email and password don't match.", eExists: 'An account with this email already exists. Log in instead.',
  eUnverified: 'Please verify your email first. We can send the link again.',
  showPw: 'Show password', hidePw: 'Hide password', search: 'Search country', pickCountry: 'Choose country',
  hi: 'Habari,', avail: 'Available balance', hideBal: 'Hide balance', showBal: 'Show balance',
  loc: "Amounts shown in {cur} because you're in {country}. Tap the currency to change it.",
  locPick: 'Amounts shown in {cur}. You picked {country}.', curT: 'Show amounts in',
  qa: ['Pay', 'Goals', 'Invite', 'Statement'], nav: ['Home', 'Chamas', 'Goals', 'Me'],
  notifT: 'Notifications', markAll: 'Mark all as read', justNow: 'Just now', minAgo: '{n} min ago', hAgo: '{n} h ago', dAgo: '{n} d ago', newTag: 'NEW',
  noNotes: 'No notifications yet.',
  noChT: "You're not in a chama yet", noChS: 'Create one for your group, or join with the code your treasurer shared.',
  chNew: '+ Create a chama', chJoin: 'Join with a code', allPaid: 'All paid up this cycle', allPaidS: 'Nice. Your next contribution opens with the next cycle.',
  dueIn: 'Due {d}', chamasN: '{n} chamas', chamaN: '1 chama', noChamas: 'No chamas', weekPill: '+ {a} this week',
  noGoalT: 'Set your first goal', noGoalS: 'School fees, rent, land, a business… save for anything.',
  demoNote: 'Everything you add is saved on this phone for now. Real accounts come with the backend.',
  of: 'of', by: 'by', next: 'Next contribution', all: 'See all', pay: 'Pay',
  soonT: 'Moving over next', soon: 'This screen is being moved to the new app. It works in the demo for now.',
  welcomeN: 'Welcome to MyChamaa, {n}! Create or join a chama to get started.',
  back: 'Back', close: 'Close', light: 'Light mode', dark: 'Dark mode', logout: 'Log out',
};

export type Strings = typeof en;
export type Lang = 'en' | 'sw';

const sw: Partial<Strings> = {
  tag: 'Tuweke pamoja.\nTukue pamoja.',
  sub: 'Michango, malipo ya zamu na malengo ya pamoja, yakifuatiliwa kwa usalama mahali pamoja.',
  create: 'Fungua akaunti', login: 'Ingia', inv: 'Nina msimbo wa mwaliko',
  suT: 'Fungua akaunti yako', suS: 'Jiunge na chama chako kwa dakika moja.',
  first: 'Jina la kwanza', last: 'Jina la mwisho', email: 'Barua pepe', phone: 'Nambari ya simu', city: 'Mji',
  newpw: 'Unda nenosiri', invCode: 'Msimbo wa mwaliko', optional: '(si lazima)', terms: 'Nakubali Masharti na Sera ya Faragha',
  have: 'Tayari una akaunti?', liT: 'Karibu tena', liS: 'Ingia kwa barua pepe na nenosiri lako.', pw: 'Nenosiri',
  forgot: 'Umesahau nenosiri?', newTo: 'Mpya kwa MyChamaa?',
  vfT: 'Angalia barua pepe yako', vfS: 'Tumetuma kiungo cha uthibitisho kwa',
  vfS2: 'Gusa kiungo kwenye barua pepe kuwasha akaunti yako, kisha uingie.', vfOk: 'Nenda kuingia',
  vfResend: 'Tuma tena baada ya sekunde {s}', vfResendNow: 'Hukupokea? Tuma tena', sent: 'Barua pepe ya uthibitisho imetumwa tena.',
  eFirst: 'Weka jina lako la kwanza.', eLast: 'Weka jina lako la mwisho.', eEmail: 'Weka barua pepe sahihi.',
  ePhone: 'Weka nambari sahihi ya simu.', eCity: 'Weka mji wako.', eTerms: 'Tafadhali kubali Masharti ili uendelee.',
  eLogin: 'Weka barua pepe na nenosiri lako.',
  hi: 'Habari,', avail: 'Salio linalopatikana',
  loc: 'Kiasi kinaonyeshwa kwa {cur} kwa sababu uko {country}. Gusa sarafu kubadilisha.',
  locPick: 'Kiasi kinaonyeshwa kwa {cur}. Ulichagua {country}.', curT: 'Onyesha kiasi kwa',
  qa: ['Lipa', 'Malengo', 'Alika', 'Taarifa'], nav: ['Nyumbani', 'Chama', 'Malengo', 'Mimi'],
  notifT: 'Arifa', markAll: 'Soma zote', justNow: 'Sasa hivi', minAgo: 'Dakika {n} zilizopita', hAgo: 'Saa {n} zilizopita', newTag: 'MPYA',
  of: 'kati ya', by: 'kufikia', next: 'Mchango unaofuata', all: 'Ona zote', pay: 'Lipa',
};

const table: Record<Lang, Partial<Strings>> = { en, sw };

export function strings(lang: Lang): Strings {
  return { ...en, ...table[lang] } as Strings;
}

export function fill(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}
