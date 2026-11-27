-- My Chaama core schema: members, chamas, cycles, contributions.
-- Rules: money is bigint minor units; every table has RLS; clients never write money rows directly.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;          -- internal helpers, not exposed by the API
revoke all on schema app from public;

-- ---------- profiles (one per auth user) ----------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null check (char_length(first_name) between 1 and 60),
  last_name   text not null check (char_length(last_name) between 1 and 60),
  phone       text not null check (phone ~ '^\+[1-9][0-9]{6,15}$'),
  city        text not null check (char_length(city) between 1 and 60),
  country     char(2) not null check (country ~ '^[A-Z]{2}$'),
  created_at  timestamptz not null default now()
);

-- ---------- KYC (status only; documents live with the provider) ----------
create type public.kyc_status as enum ('none', 'pending', 'verified', 'rejected');
create table public.kyc_records (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  status       public.kyc_status not null default 'none',
  countries    char(2)[] not null default '{}',
  provider_ref text,
  updated_at   timestamptz not null default now()
);

-- ---------- chamas ----------
create type public.money_mode as enum ('record_only', 'managed_pool');
create type public.approval_policy as enum ('auto', 'one', 'two');
create type public.frequency as enum ('weekly', 'fortnightly', 'monthly');

create table public.chamas (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 1 and 40),
  code               text not null unique check (code ~ '^CH-[A-Z0-9]{4,8}$'),
  country            char(2) not null,
  currency           char(3) not null check (currency ~ '^[A-Z]{3}$'),
  contribution_minor bigint not null check (contribution_minor > 0),
  penalty_minor      bigint not null default 0 check (penalty_minor >= 0),
  frequency          public.frequency not null default 'weekly',
  money_mode         public.money_mode not null default 'record_only',
  approval_policy    public.approval_policy not null default 'auto',
  review_threshold_minor bigint,                 -- amounts above this always need manual review
  active             boolean not null default true,
  created_by         uuid not null references public.profiles (id),
  created_at         timestamptz not null default now(),
  -- Managed pool stays off until a licensed partner and legal advice are in place.
  constraint managed_pool_not_yet check (money_mode = 'record_only')
);

create type public.member_role as enum ('member', 'treasurer', 'chair');
create type public.member_state as enum ('invited', 'active', 'suspended', 'left');

create table public.chama_members (
  chama_id     uuid not null references public.chamas (id) on delete restrict,
  user_id      uuid not null references public.profiles (id) on delete restrict,
  role         public.member_role not null default 'member',
  state        public.member_state not null default 'active',
  rotation_pos int not null check (rotation_pos >= 1),
  joined_at    timestamptz not null default now(),
  primary key (chama_id, user_id),
  unique (chama_id, rotation_pos)
);
create index on public.chama_members (user_id);

create table public.invites (
  id         uuid primary key default gen_random_uuid(),
  chama_id   uuid not null references public.chamas (id),
  contact    text not null check (char_length(contact) between 5 and 120),
  invited_by uuid not null references public.profiles (id),
  accepted_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ---------- cycles ----------
create table public.cycles (
  id           uuid primary key default gen_random_uuid(),
  chama_id     uuid not null references public.chamas (id),
  number       int not null check (number >= 1),
  due_at       timestamptz not null,
  recipient_id uuid not null references public.profiles (id),
  opened_at    timestamptz not null default now(),
  closed_at    timestamptz,
  unique (chama_id, number)
);

-- ---------- contributions (payment status chain) ----------
create type public.payment_status as enum ('initiated', 'successful', 'settled', 'available', 'failed', 'reversed');

create table public.contributions (
  id            uuid primary key default gen_random_uuid(),
  chama_id      uuid not null references public.chamas (id),
  cycle_id      uuid not null references public.cycles (id),
  member_id     uuid not null references public.profiles (id),
  amount_minor  bigint not null check (amount_minor > 0),
  currency      char(3) not null,
  method        text not null check (method in ('mpesa', 'card', 'bank', 'cash', 'other')),
  reference     text not null check (char_length(reference) between 4 and 40),
  status        public.payment_status not null default 'initiated',
  recorded_by   uuid not null references public.profiles (id),
  idempotency_key text not null unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (chama_id, reference)                     -- same M-Pesa code can't be used twice in a chama
);
create index on public.contributions (cycle_id, member_id);

-- ---------- notifications ----------
create table public.notices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('pay','remind','payout','join','goal','swap','late','alert')),
  body       text not null check (char_length(body) <= 240),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notices (user_id, created_at desc);

-- ---------- personal goals ----------
create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  currency     char(3) not null,
  target_minor bigint not null check (target_minor > 0),
  target_date  date not null,
  created_at   timestamptz not null default now()
);
