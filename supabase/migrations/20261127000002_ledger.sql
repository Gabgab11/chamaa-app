-- Append-only double-entry ledger. Balances are always computed from lines.

create type public.account_kind as enum ('member_receivable', 'pool_commitments', 'treasurer_held', 'partner_clearing', 'pool_settled', 'payout_payable', 'fees', 'penalties');

create table public.ledger_accounts (
  id        uuid primary key default gen_random_uuid(),
  chama_id  uuid not null references public.chamas (id),
  kind      public.account_kind not null,
  member_id uuid references public.profiles (id),
  currency  char(3) not null,
  unique nulls not distinct (chama_id, kind, member_id),
  check ((kind in ('member_receivable', 'payout_payable')) = (member_id is not null))
);

create table public.journal_entries (
  id                uuid primary key default gen_random_uuid(),
  chama_id          uuid not null references public.chamas (id),
  currency          char(3) not null,
  kind              text not null,
  source_table      text,
  source_id         uuid,
  idempotency_key   text not null unique,
  reverses_entry_id uuid references public.journal_entries (id),
  created_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now()
);
create unique index one_reversal_per_entry on public.journal_entries (reverses_entry_id) where reverses_entry_id is not null;

create table public.ledger_lines (
  id           bigint generated always as identity primary key,
  entry_id     uuid not null references public.journal_entries (id),
  account_id   uuid not null references public.ledger_accounts (id),
  debit_minor  bigint not null default 0 check (debit_minor >= 0),
  credit_minor bigint not null default 0 check (credit_minor >= 0),
  check ((debit_minor > 0) <> (credit_minor > 0))   -- exactly one side
);
create index on public.ledger_lines (entry_id);
create index on public.ledger_lines (account_id);

-- History can't be edited or deleted, by anyone.
create function app.forbid_change() returns trigger language plpgsql as $$
begin
  raise exception 'append_only: % rows cannot be %d', tg_table_name, lower(tg_op) using errcode = 'P0001';
end $$;

create trigger journal_entries_append_only before update or delete on public.journal_entries for each row execute function app.forbid_change();
create trigger ledger_lines_append_only before update or delete on public.ledger_lines for each row execute function app.forbid_change();
create trigger ledger_no_truncate before truncate on public.ledger_lines for each statement execute function app.forbid_change();
create trigger journal_no_truncate before truncate on public.journal_entries for each statement execute function app.forbid_change();

-- Every entry must balance and use the chama's own accounts in one currency (checked at commit).
create function app.check_entry_balanced() returns trigger language plpgsql as $$
declare d bigint; c bigint; n int; bad int; e public.journal_entries;
begin
  select * into e from public.journal_entries where id = new.entry_id;
  select coalesce(sum(debit_minor),0), coalesce(sum(credit_minor),0), count(*) into d, c, n
    from public.ledger_lines where entry_id = new.entry_id;
  select count(*) into bad from public.ledger_lines l join public.ledger_accounts a on a.id = l.account_id
    where l.entry_id = new.entry_id and (a.chama_id <> e.chama_id or a.currency <> e.currency);
  if n < 2 or d <> c then
    raise exception 'unbalanced_entry: entry % debits % credits % lines %', new.entry_id, d, c, n using errcode = 'P0001';
  end if;
  if bad > 0 then
    raise exception 'cross_chama_or_currency: entry % touches another chama or currency', new.entry_id using errcode = 'P0001';
  end if;
  return null;
end $$;

create constraint trigger ledger_entry_balanced after insert on public.ledger_lines
  deferrable initially deferred for each row execute function app.check_entry_balanced();

-- Balances (views read through RLS of the base tables).
create view public.account_balances with (security_invoker = true) as
  select a.id as account_id, a.chama_id, a.kind, a.member_id, a.currency,
         coalesce(sum(l.debit_minor), 0)::bigint as debit_minor,
         coalesce(sum(l.credit_minor), 0)::bigint as credit_minor,
         (coalesce(sum(l.debit_minor), 0) - coalesce(sum(l.credit_minor), 0))::bigint as balance_minor
    from public.ledger_accounts a left join public.ledger_lines l on l.account_id = a.id
   group by a.id;

-- Internal: get (or create) a chama account.
create function app.account(p_chama uuid, p_kind public.account_kind, p_member uuid default null) returns uuid
language plpgsql as $$
declare v uuid; cur char(3);
begin
  select id into v from public.ledger_accounts where chama_id = p_chama and kind = p_kind and member_id is not distinct from p_member;
  if v is null then
    select currency into cur from public.chamas where id = p_chama;
    insert into public.ledger_accounts (chama_id, kind, member_id, currency) values (p_chama, p_kind, p_member, cur)
      on conflict (chama_id, kind, member_id) do nothing returning id into v;
    if v is null then
      select id into v from public.ledger_accounts where chama_id = p_chama and kind = p_kind and member_id is not distinct from p_member;
    end if;
  end if;
  return v;
end $$;

-- Internal: post a two-line entry once (idempotent on key). Returns the entry id.
create function app.post(p_chama uuid, p_kind text, p_key text, p_debit uuid, p_credit uuid, p_amount bigint,
                         p_source_table text default null, p_source_id uuid default null, p_actor uuid default null,
                         p_reverses uuid default null) returns uuid
language plpgsql as $$
declare v uuid; cur char(3);
begin
  if p_amount is null or p_amount <= 0 then raise exception 'bad_amount' using errcode = 'P0001'; end if;
  select id into v from public.journal_entries where idempotency_key = p_key;
  if v is not null then return v; end if;
  select currency into cur from public.chamas where id = p_chama;
  insert into public.journal_entries (chama_id, currency, kind, source_table, source_id, idempotency_key, reverses_entry_id, created_by)
    values (p_chama, cur, p_kind, p_source_table, p_source_id, p_key, p_reverses, p_actor) returning id into v;
  insert into public.ledger_lines (entry_id, account_id, debit_minor) values (v, p_debit, p_amount);
  insert into public.ledger_lines (entry_id, account_id, credit_minor) values (v, p_credit, p_amount);
  return v;
end $$;

-- Internal: reverse an entry with a compensating entry (never edits the original).
create function app.reverse(p_entry uuid, p_actor uuid, p_reason text) returns uuid
language plpgsql as $$
declare e public.journal_entries; v uuid;
begin
  select * into e from public.journal_entries where id = p_entry;
  if e.id is null then raise exception 'no_entry' using errcode = 'P0001'; end if;
  select id into v from public.journal_entries where reverses_entry_id = p_entry;
  if v is not null then return v; end if;
  insert into public.journal_entries (chama_id, currency, kind, source_table, source_id, idempotency_key, reverses_entry_id, created_by)
    values (e.chama_id, e.currency, 'reversal:' || left(p_reason, 60), e.source_table, e.source_id, 'rev:' || e.id, e.id, p_actor) returning id into v;
  insert into public.ledger_lines (entry_id, account_id, debit_minor, credit_minor)
    select v, account_id, credit_minor, debit_minor from public.ledger_lines where entry_id = p_entry;
  return v;
end $$;
