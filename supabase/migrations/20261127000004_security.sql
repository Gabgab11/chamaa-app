-- Row-level security and the only allowed ways to change money data.
-- Clients can READ what they're entitled to; every WRITE that touches money goes through
-- the security-definer functions below, which check the caller and the rules.

-- ---------- membership helpers ----------
create function app.is_member(p_chama uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chama_members m where m.chama_id = p_chama and m.user_id = auth.uid() and m.state in ('active', 'suspended'));
$$;
create function app.is_official(p_chama uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chama_members m where m.chama_id = p_chama and m.user_id = auth.uid() and m.state = 'active' and m.role in ('treasurer', 'chair'));
$$;
grant usage on schema app to authenticated;
grant execute on function app.is_member(uuid), app.is_official(uuid) to authenticated;

-- ---------- turn RLS on everywhere ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','kyc_records','chamas','chama_members','invites','cycles','contributions','notices','goals',
                           'ledger_accounts','journal_entries','ledger_lines','payout_accounts','payouts','payout_allowed_transitions',
                           'payout_transitions','payout_approvals','disputes','money_alerts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- Writes clients may do directly (their own, non-money rows only).
grant update (first_name, last_name, city) on public.profiles to authenticated;
grant update (read_at) on public.notices to authenticated;
grant insert, update, delete on public.goals to authenticated;

-- ---------- read policies ----------
create policy own_profile_read on public.profiles for select to authenticated using (id = auth.uid());
create policy own_profile_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy own_kyc on public.kyc_records for select to authenticated using (user_id = auth.uid());
create policy member_chamas on public.chamas for select to authenticated using (app.is_member(id));
create policy member_roster on public.chama_members for select to authenticated using (app.is_member(chama_id));
create policy invites_read on public.invites for select to authenticated using (invited_by = auth.uid() or app.is_official(chama_id));
create policy member_cycles on public.cycles for select to authenticated using (app.is_member(chama_id));
-- Everyone in the chama sees who has and hasn't paid (rule 8: never hide outstanding contributions).
create policy member_contributions on public.contributions for select to authenticated using (app.is_member(chama_id));
create policy own_notices on public.notices for select to authenticated using (user_id = auth.uid());
create policy own_notices_read on public.notices for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_goals on public.goals for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy member_ledger_accounts on public.ledger_accounts for select to authenticated using (app.is_member(chama_id));
create policy member_journal on public.journal_entries for select to authenticated using (app.is_member(chama_id));
create policy member_lines on public.ledger_lines for select to authenticated
  using (exists (select 1 from public.journal_entries e where e.id = entry_id and app.is_member(e.chama_id)));
create policy own_payout_accounts on public.payout_accounts for select to authenticated using (user_id = auth.uid());
create policy member_payouts on public.payouts for select to authenticated using (app.is_member(chama_id));
create policy transitions_table on public.payout_allowed_transitions for select to authenticated using (true);
create policy member_payout_log on public.payout_transitions for select to authenticated
  using (exists (select 1 from public.payouts p where p.id = payout_id and app.is_member(p.chama_id)));
create policy member_approvals on public.payout_approvals for select to authenticated
  using (exists (select 1 from public.payouts p where p.id = payout_id and app.is_member(p.chama_id)));
create policy member_disputes on public.disputes for select to authenticated using (app.is_member(chama_id));
create policy official_alerts on public.money_alerts for select to authenticated using (app.is_official(chama_id));

-- Fellow members' names only (no phone or email).
create function public.chama_roster(p_chama uuid)
returns table (user_id uuid, first_name text, last_name text, role public.member_role, state public.member_state, rotation_pos int)
language sql stable security definer set search_path = '' as $$
  select m.user_id, p.first_name, p.last_name, m.role, m.state, m.rotation_pos
    from public.chama_members m join public.profiles p on p.id = m.user_id
   where m.chama_id = p_chama and app.is_member(p_chama)
   order by m.rotation_pos;
$$;

-- ---------- new users: profile + KYC row from sign-up details ----------
create function app.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare md jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, first_name, last_name, phone, city, country)
  values (new.id, coalesce(md->>'first_name', ''), coalesce(md->>'last_name', ''), coalesce(md->>'phone', ''),
          coalesce(md->>'city', ''), upper(coalesce(md->>'country', 'KE')));
  insert into public.kyc_records (user_id) values (new.id);
  insert into public.notices (user_id, kind, body)
  values (new.id, 'join', 'Welcome to MyChamaa, ' || coalesce(md->>'first_name', '') || '! Create or join a chama to get started.');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function app.handle_new_user();

-- ---------- contribution status chain ----------
create function app.guard_contribution() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'append_only: contributions cannot be deleted' using errcode = 'P0001'; end if;
  if (new.amount_minor, new.member_id, new.cycle_id, new.chama_id, new.reference, new.currency)
     is distinct from (old.amount_minor, old.member_id, old.cycle_id, old.chama_id, old.reference, old.currency) then
    raise exception 'contribution_immutable_fields' using errcode = 'P0001';
  end if;
  if new.status is distinct from old.status and not (
       (old.status = 'initiated'  and new.status in ('successful', 'failed')) or
       (old.status = 'successful' and new.status in ('settled', 'reversed')) or
       (old.status = 'settled'    and new.status in ('available', 'reversed')) or
       (old.status = 'available'  and new.status = 'reversed')) then
    raise exception 'illegal_payment_status: % -> %', old.status, new.status using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger contributions_guard before update or delete on public.contributions for each row execute function app.guard_contribution();
