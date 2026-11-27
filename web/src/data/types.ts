import type { Minor } from '../lib/money';

export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string; // E.164-ish: +254712345678
  city: string;
  country: string; // ISO code picked at sign-up
  createdAt: number;
}

export type MemberStatus = 'paid' | 'due' | 'late' | 'invited';

export interface ChamaSummary {
  id: string;
  name: string;
  initials: string;
  currency: string;
  contribution: Minor;
  dueAt: string; // ISO
  myStatus: MemberStatus;
}

export interface Goal {
  id: string;
  name: string;
  currency: string;
  saved: Minor;
  target: Minor;
  date: string; // ISO date
}

export interface Notice {
  id: string;
  kind: 'pay' | 'remind' | 'payout' | 'join' | 'goal' | 'swap' | 'late';
  text: string;
  at: number;
  read: boolean;
}

export interface Payment {
  id: string;
  chamaId: string;
  amount: Minor;
  currency: string;
  at: number;
  mine: boolean;
}

/** What the dashboard needs for the signed-in member. Server-side this comes from RLS-protected views. */
export interface Dashboard {
  chamas: ChamaSummary[];
  goals: Goal[];
  notices: Notice[];
  payments: Payment[];
  payouts: Payment[];
}

export type AuthError = 'invalid_credentials' | 'email_exists' | 'email_not_verified' | 'network' | 'unknown';

export interface SignUpInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  password: string;
  inviteCode?: string;
}
