import { read, readString, remove, write, writeString } from '../lib/storage';
import type { Backend, Result } from './backend';
import type { Dashboard, Notice, Profile, SignUpInput } from './types';

// Device-only stand-in for the server. Passwords are salted + hashed (PBKDF2) so the
// raw password is never stored, even on the phone. Replaced by Supabase Auth.
interface StoredAccount extends Profile {
  salt: string;
  hash: string;
  verified: boolean;
}

const ACCOUNTS = 'chamaa-v2-accounts';
const SESSION = 'chamaa-v2-session';
const dataKey = (id: string) => `chamaa-v2-data:${id}`;

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/../g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 120_000 }, key, 256);
  return hex(bits);
}

function newId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

const accounts = () => read<Record<string, StoredAccount>>(ACCOUNTS, {});
const strip = ({ salt: _s, hash: _h, verified: _v, ...p }: StoredAccount): Profile => p;
const emptyDashboard = (): Dashboard => ({ chamas: [], goals: [], notices: [], payments: [], payouts: [] });

const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export function createLocalBackend(welcomeText: (first: string) => string): Backend {
  return {
    mode: 'local',

    async currentUser() {
      const email = readString(SESSION);
      const acc = email ? accounts()[email] : undefined;
      return acc ? strip(acc) : null;
    },

    async signUp(input: SignUpInput) {
      const email = input.email.trim().toLowerCase();
      const all = accounts();
      if (all[email]?.verified) return { ok: false, error: 'email_exists' };
      const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
      const acc: StoredAccount = {
        id: all[email]?.id ?? newId(),
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email,
        phone: input.phone,
        city: input.city.trim(),
        country: input.country,
        createdAt: Date.now(),
        salt,
        hash: await hashPassword(input.password, salt),
        // On this device there is no email server, so the link is treated as tapped.
        verified: true,
      };
      all[email] = acc;
      write(ACCOUNTS, all);
      return ok({ email });
    },

    async resendVerification() {
      return ok(null);
    },

    async logIn(emailRaw, password) {
      const email = emailRaw.trim().toLowerCase();
      const acc = accounts()[email];
      if (!acc || (await hashPassword(password, acc.salt)) !== acc.hash) return { ok: false, error: 'invalid_credentials' };
      if (!acc.verified) return { ok: false, error: 'email_not_verified' };
      writeString(SESSION, email);
      const d = read<Dashboard | null>(dataKey(acc.id), null);
      if (!d) {
        const welcome: Notice = { id: newId(), kind: 'join', text: welcomeText(acc.firstName), at: Date.now(), read: false };
        write(dataKey(acc.id), { ...emptyDashboard(), notices: [welcome] });
      }
      return ok(strip(acc));
    },

    async requestPasswordReset() {
      // Same answer whether or not the account exists, so emails can't be probed.
      return ok(null);
    },

    async logOut() {
      remove(SESSION);
    },

    async dashboard(userId) {
      return read<Dashboard>(dataKey(userId), emptyDashboard());
    },

    async markNoticesRead(userId) {
      const d = read<Dashboard>(dataKey(userId), emptyDashboard());
      d.notices = d.notices.map((n) => ({ ...n, read: true }));
      write(dataKey(userId), d);
    },
  };
}
