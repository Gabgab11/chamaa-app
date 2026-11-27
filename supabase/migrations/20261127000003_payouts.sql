-- Payout engine: accounts, state machine, transitions log, approvals, disputes, money alerts.

create table public.payout_accounts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id),
  country     char(2) not null,
  kind        text not null check (kind in ('mpesa', 'bank')),
  holder_name text not null,
  masked      text not null,                       -- e.g. 'Equity •••• 6789'; full number stays with the provider
  verified    boolean not null default false,
  is_default  boolean not null default false,
  added_at    timestamptz not null default now(),
  changed_at  timestamptz not null default now()
);
create unique index one_default_account on public.payout_accounts (user_id) where is_default;

create type public.payout_state as enum (
  'scheduled', 'eligibility_check', 'awaiting_contributions', 'awaiting_settlement', 'reconciliation',
  'awaiting_authorisation', 'authorised', 'processing', 'awaiting_recipient', 'successful',
  'failed', 'suspended', 'under_review', 'reversed', 'cancelled');

create table public.payouts (
  id                 uuid primary key default gen_random_uuid(),
  chama_id           uuid not null references public.chamas (id),
  cycle_id           uuid not null references public.cycles (id),
  recipient_id       uuid not null references public.profiles (id),
  payout_account_id  uuid references public.payout_accounts (id),
  gross_minor        bigint not null check (gross_minor > 0),
  fee_minor          bigint not null default 0 check (fee_minor >= 0),
  net_minor          bigint generated always as (gross_minor - fee_minor) stored,
  reference          text not null unique,
  idempotency_key    text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  state              public.payout_state not null default 'scheduled',
  eligibility        jsonb,                         -- last check snapshot
  attempts           int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (chama_id, cycle_id, recipient_id),       -- never pay the same obligation twice
  check (fee_minor < gross_minor)
);

create table public.payout_allowed_transitions (
  from_state public.payout_state not null,
  to_state   public.payout_state not null,
  primary key (from_state, to_state)
);

insert into public.payout_allowed_transitions values
  ('scheduled','eligibility_check'),
  ('eligibility_check','awaiting_contributions'), ('eligibility_check','awaiting_settlement'), ('eligibility_check','reconciliation'),
  ('awaiting_contributions','awaiting_settlement'), ('awaiting_contributions','eligibility_check'),
  ('awaiting_settlement','reconciliation'), ('awaiting_settlement','awaiting_contributions'),
  ('reconciliation','awaiting_authorisation'), ('reconciliation','awaiting_contributions'),
  ('awaiting_authorisation','authorised'), ('awaiting_authorisation','under_review'), ('awaiting_authorisation','reconciliation'),
  ('authorised','processing'), ('authorised','under_review'),
  ('processing','awaiting_recipient'), ('processing','successful'), ('processing','failed'),
  ('awaiting_recipient','successful'), ('awaiting_recipient','under_review'),
  ('failed','processing'), ('failed','cancelled'),
  ('under_review','eligibility_check'), ('under_review','cancelled'), ('under_review','suspended'),
  ('suspended','eligibility_check'), ('suspended','cancelled'),
  ('successful','reversed');

create table public.payout_transitions (
  id         bigint generated always as identity primary key,
  payout_id  uuid not null references public.payouts (id),
  from_state public.payout_state not null,
  to_state   public.payout_state not null,
  actor_id   uuid references public.profiles (id),
  reason     text,
  evidence   jsonb,
  at         timestamptz not null default now()
);
create trigger payout_transitions_append_only before update or delete on public.payout_transitions for each row execute function app.forbid_change();

-- Refuse any state jump that isn't in the table, and log every move.
create function app.guard_payout_state() returns trigger language plpgsql as $$
begin
  if new.state is distinct from old.state then
    if not exists (select 1 from public.payout_allowed_transitions where from_state = old.state and to_state = new.state) then
      raise exception 'illegal_transition: % -> %', old.state, new.state using errcode = 'P0001';
    end if;
    insert into public.payout_transitions (payout_id, from_state, to_state, actor_id, reason, evidence)
      values (new.id, old.state, new.state, nullif(current_setting('app.actor', true), '')::uuid,
              nullif(current_setting('app.reason', true), ''), new.eligibility);
  end if;
  if new.gross_minor <> old.gross_minor or new.recipient_id <> old.recipient_id or new.cycle_id <> old.cycle_id or new.reference <> old.reference then
    raise exception 'payout_immutable_fields' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger payouts_state_guard before update on public.payouts for each row execute function app.guard_payout_state();
create trigger payouts_no_delete before delete on public.payouts for each row execute function app.forbid_change();

create table public.payout_approvals (
  payout_id   uuid not null references public.payouts (id),
  approver_id uuid not null references public.profiles (id),
  at          timestamptz not null default now(),
  primary key (payout_id, approver_id)
);
create function app.no_self_approval() returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.payouts where id = new.payout_id and recipient_id = new.approver_id) then
    raise exception 'self_approval: the recipient cannot approve their own payout' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger payout_approvals_no_self before insert on public.payout_approvals for each row execute function app.no_self_approval();
create trigger payout_approvals_append_only before update or delete on public.payout_approvals for each row execute function app.forbid_change();

-- Disputes
create table public.disputes (
  id              uuid primary key default gen_random_uuid(),
  chama_id        uuid not null references public.chamas (id),
  raised_by       uuid not null references public.profiles (id),
  contribution_id uuid references public.contributions (id),
  payout_id       uuid references public.payouts (id),
  reason          text not null check (char_length(reason) between 5 and 500),
  status          text not null default 'open' check (status in ('open', 'resolved')),
  resolution      text,
  resolved_by     uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  check (contribution_id is not null or payout_id is not null)
);

-- Money alerts (resolved with a note, never deleted)
create table public.money_alerts (
  id          uuid primary key default gen_random_uuid(),
  chama_id    uuid not null references public.chamas (id),
  kind        text not null,
  severity    text not null check (severity in ('low', 'medium', 'high')),
  subject_id  uuid,
  detail      text not null,
  dedupe_key  text not null unique,                -- one open alert per problem
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id),
  resolution  text
);
create function app.alerts_resolve_only() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'append_only: alerts cannot be deleted' using errcode = 'P0001'; end if;
  if (new.chama_id, new.kind, new.severity, new.subject_id, new.detail, new.dedupe_key, new.created_at)
     is distinct from (old.chama_id, old.kind, old.severity, old.subject_id, old.detail, old.dedupe_key, old.created_at)
     or old.resolved_at is not null then
    raise exception 'alerts_resolve_only' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger money_alerts_guard before update or delete on public.money_alerts for each row execute function app.alerts_resolve_only();
