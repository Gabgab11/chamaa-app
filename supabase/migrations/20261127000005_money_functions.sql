-- The only ways money data changes. Each function checks who is calling and the rules.

create function app.require_user() returns uuid language plpgsql stable as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  return u;
end $$;

create function app.set_actor(p_actor uuid, p_reason text) returns void language sql as $$
  select set_config('app.actor', coalesce(p_actor::text, ''), true), set_config('app.reason', coalesce(p_reason, ''), true);
$$;

-- ---------- create a chama (creator becomes treasurer, position 1) ----------
create function public.create_chama(p_name text, p_country char(2), p_currency char(3), p_contribution_minor bigint,
                                    p_frequency public.frequency, p_first_due timestamptz,
                                    p_approval public.approval_policy default 'auto', p_penalty_minor bigint default 0)
returns uuid language plpgsql security definer set search_path = '' as $$
declare u uuid := app.require_user(); c uuid; v_code text;
begin
  if p_first_due <= now() then raise exception 'first_due_in_past' using errcode = 'P0001'; end if;
  loop
    v_code := 'CH-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
    exit when not exists (select 1 from public.chamas ch where ch.code = v_code);
  end loop;
  insert into public.chamas (name, code, country, currency, contribution_minor, penalty_minor, frequency, approval_policy, created_by)
    values (trim(p_name), v_code, upper(p_country), upper(p_currency), p_contribution_minor, coalesce(p_penalty_minor, 0), p_frequency, p_approval, u)
    returning id into c;
  insert into public.chama_members (chama_id, user_id, role, rotation_pos) values (c, u, 'treasurer', 1);
  return c;
end $$;

-- ---------- open a cycle: every active member owes one contribution ----------
create function public.open_cycle(p_chama uuid, p_due timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := app.require_user(); ch public.chamas; n int; rec uuid; cyc uuid; m record; members int;
begin
  if not app.is_official(p_chama) then raise exception 'officials_only' using errcode = '42501'; end if;
  select * into ch from public.chamas where id = p_chama for update;
  if exists (select 1 from public.cycles where chama_id = p_chama and closed_at is null) then
    raise exception 'cycle_already_open' using errcode = 'P0001';
  end if;
  select coalesce(max(number), 0) + 1 into n from public.cycles where chama_id = p_chama;
  select count(*) into members from public.chama_members where chama_id = p_chama and state = 'active';
  if members < 1 then raise exception 'no_members' using errcode = 'P0001'; end if;
  -- rotation: the (n-1 mod members)+1-th active member in rotation order
  select user_id into rec from public.chama_members where chama_id = p_chama and state = 'active'
    order by rotation_pos offset ((n - 1) % members) limit 1;
  insert into public.cycles (chama_id, number, due_at, recipient_id) values (p_chama, n, p_due, rec) returning id into cyc;
  for m in select user_id from public.chama_members where chama_id = p_chama and state = 'active' loop
    perform app.post(p_chama, 'cycle_open', 'open:' || cyc || ':' || m.user_id,
                     app.account(p_chama, 'member_receivable', m.user_id), app.account(p_chama, 'pool_commitments'),
                     ch.contribution_minor, 'cycles', cyc, u);
  end loop;
  insert into public.payouts (chama_id, cycle_id, recipient_id, gross_minor, reference)
    values (p_chama, cyc, rec, ch.contribution_minor * members,
            'PO-' || upper(left(regexp_replace(ch.name, '[^A-Za-z]', '', 'g') || 'XXX', 3)) || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 2, '0') || '-' || upper(substr(encode(extensions.gen_random_bytes(2), 'hex'), 1, 4)));
  return cyc;
end $$;

-- ---------- record a contribution (record-only: the treasurer confirms money arrived) ----------
create function public.record_contribution(p_cycle uuid, p_member uuid, p_amount_minor bigint, p_method text, p_reference text, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare u uuid := app.require_user(); cy public.cycles; ch public.chamas; v uuid;
begin
  select * into cy from public.cycles where id = p_cycle;
  if cy.id is null or cy.closed_at is not null then raise exception 'cycle_not_open' using errcode = 'P0001'; end if;
  if not app.is_official(cy.chama_id) then raise exception 'officials_only' using errcode = '42501'; end if;
  select * into ch from public.chamas where id = cy.chama_id;
  if not exists (select 1 from public.chama_members where chama_id = cy.chama_id and user_id = p_member and state = 'active') then
    raise exception 'not_a_member' using errcode = 'P0001';
  end if;
  select id into v from public.contributions where idempotency_key = p_idempotency_key;
  if v is not null then return v; end if;                        -- retry-safe
  insert into public.contributions (chama_id, cycle_id, member_id, amount_minor, currency, method, reference, status, recorded_by, idempotency_key)
    values (cy.chama_id, p_cycle, p_member, p_amount_minor, ch.currency, p_method, upper(trim(p_reference)), 'successful', u, p_idempotency_key)
    returning id into v;
  perform app.post(cy.chama_id, 'contribution', 'contrib:' || v, app.account(cy.chama_id, 'treasurer_held'),
                   app.account(cy.chama_id, 'member_receivable', p_member), p_amount_minor, 'contributions', v, u);
  insert into public.notices (user_id, kind, body) values (p_member, 'pay', 'Your contribution to ' || ch.name || ' was recorded.');
  return v;
end $$;

-- ---------- treasurer confirms the money is in the group's account ----------
create function public.confirm_settled(p_contribution uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := app.require_user(); c public.contributions;
begin
  select * into c from public.contributions where id = p_contribution for update;
  if c.id is null or not app.is_official(c.chama_id) then raise exception 'officials_only' using errcode = '42501'; end if;
  if c.status <> 'successful' then return; end if;               -- idempotent
  update public.contributions set status = 'settled' where id = c.id;
  perform app.post(c.chama_id, 'settled', 'settle:' || c.id, app.account(c.chama_id, 'pool_settled'),
                   app.account(c.chama_id, 'treasurer_held'), c.amount_minor, 'contributions', c.id, u);
end $$;

-- ---------- reverse a contribution (mistake / bounced): compensating entries only ----------
create function public.reverse_contribution(p_contribution uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := app.require_user(); c public.contributions; e uuid; po public.payouts;
begin
  select * into c from public.contributions where id = p_contribution for update;
  if c.id is null or not app.is_official(c.chama_id) then raise exception 'officials_only' using errcode = '42501'; end if;
  if c.status = 'reversed' then return; end if;
  select * into po from public.payouts where cycle_id = c.cycle_id;
  if po.state in ('authorised', 'processing', 'awaiting_recipient', 'successful') then
    insert into public.money_alerts (chama_id, kind, severity, subject_id, detail, dedupe_key)
      values (c.chama_id, 'reversal_after_authorisation', 'high', po.id, 'A contribution was reversed after the payout was authorised.', 'revauth:' || c.id)
      on conflict (dedupe_key) do nothing;
  end if;
  update public.contributions set status = 'reversed' where id = c.id;
  for e in select id from public.journal_entries where source_table = 'contributions' and source_id = c.id and reverses_entry_id is null loop
    perform app.reverse(e, u, coalesce(p_reason, 'reversed'));
  end loop;
  if po.state in ('reconciliation', 'awaiting_authorisation') then
    perform app.set_actor(u, 'contribution reversed');
    update public.payouts set state = 'awaiting_contributions' where id = po.id and state = 'reconciliation';
    if po.state = 'awaiting_authorisation' then
      update public.payouts set state = 'reconciliation' where id = po.id;
      update public.payouts set state = 'awaiting_contributions' where id = po.id;
    end if;
  end if;
end $$;

-- ---------- eligibility engine ----------
create function public.payout_eligibility(p_payout uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare po public.payouts; ch public.chamas; cy public.cycles; acc public.payout_accounts; k public.kyc_records;
        members int; paid int; settled int; disputes int; done int; checks jsonb := '[]'::jsonb; ok boolean := true;
begin
  select * into po from public.payouts where id = p_payout;
  if po.id is null then raise exception 'no_payout' using errcode = 'P0001'; end if;
  if auth.uid() is not null and not app.is_member(po.chama_id) then raise exception 'members_only' using errcode = '42501'; end if;
  select * into ch from public.chamas where id = po.chama_id;
  select * into cy from public.cycles where id = po.cycle_id;
  select * into k from public.kyc_records where user_id = po.recipient_id;
  select * into acc from public.payout_accounts where id = po.payout_account_id;
  select count(*) into members from public.chama_members where chama_id = po.chama_id and state = 'active';
  select count(distinct member_id) into paid from public.contributions
    where cycle_id = po.cycle_id and status in ('successful', 'settled', 'available');
  select count(distinct member_id) into settled from public.contributions
    where cycle_id = po.cycle_id and status in ('settled', 'available');
  select count(*) into disputes from public.disputes d
    where d.status = 'open' and (d.payout_id = po.id or d.contribution_id in (select id from public.contributions where cycle_id = po.cycle_id));
  select count(*) into done from public.payouts where cycle_id = po.cycle_id and state = 'successful' and id <> po.id;

  checks := jsonb_build_array(
    jsonb_build_object('key', 'chama_active', 'ok', ch.active),
    jsonb_build_object('key', 'schedule_valid', 'ok', cy.id is not null and cy.closed_at is null),
    jsonb_build_object('key', 'recipient_verified', 'ok',
      exists (select 1 from public.chama_members where chama_id = po.chama_id and user_id = po.recipient_id and state = 'active') and coalesce(k.status = 'verified', false)),
    jsonb_build_object('key', 'recipient_entitled', 'ok', cy.recipient_id = po.recipient_id),
    jsonb_build_object('key', 'account_ok', 'ok',
      acc.id is not null and acc.user_id = po.recipient_id and acc.verified and acc.country = any (coalesce(k.countries, '{}')) and acc.changed_at <= now() - interval '48 hours',
      'detail', case when acc.id is not null and acc.changed_at > now() - interval '48 hours' then 'available_from:' || to_char(acc.changed_at + interval '48 hours', 'YYYY-MM-DD"T"HH24:MI:SSOF') end),
    jsonb_build_object('key', 'contributions_received', 'ok', paid >= members, 'detail', 'waiting:' || greatest(members - paid, 0)),
    jsonb_build_object('key', 'funds_settled', 'ok', settled >= members, 'detail', 'unsettled:' || greatest(members - settled, 0)),
    jsonb_build_object('key', 'no_open_disputes', 'ok', disputes = 0),
    jsonb_build_object('key', 'not_already_paid', 'ok', done = 0 and po.state <> 'successful'),
    jsonb_build_object('key', 'within_entitlement', 'ok', po.gross_minor <= ch.contribution_minor * members)
  );
  select bool_and((x->>'ok')::boolean) into ok from jsonb_array_elements(checks) x;
  return jsonb_build_object('ok', coalesce(ok, false), 'checked_at', now(), 'checks', checks);
end $$;

-- Pool money available for this chama (settled minus reserved), from the ledger.
create function app.pool_available(p_chama uuid) returns bigint language sql stable as $$
  select coalesce(sum(l.debit_minor - l.credit_minor), 0)::bigint
    from public.ledger_lines l join public.ledger_accounts a on a.id = l.account_id
   where a.chama_id = p_chama and a.kind = 'pool_settled';
$$;

-- ---------- move a payout as far as the rules allow ----------
create function public.advance_payout(p_payout uuid) returns public.payout_state
language plpgsql security definer set search_path = '' as $$
declare u uuid := app.require_user(); po public.payouts; el jsonb; ch public.chamas; reserved bigint;
  fails text[];
begin
  select * into po from public.payouts where id = p_payout for update;
  if po.id is null or not app.is_member(po.chama_id) then raise exception 'members_only' using errcode = '42501'; end if;
  select * into ch from public.chamas where id = po.chama_id;
  perform app.set_actor(u, 'advance');
  -- use the recipient's default payout account if none is attached yet (before authorisation only)
  if po.payout_account_id is null and po.state not in ('authorised', 'processing', 'awaiting_recipient', 'successful') then
    update public.payouts set payout_account_id = (select id from public.payout_accounts where user_id = po.recipient_id and is_default)
     where id = po.id;
  end if;
  el := public.payout_eligibility(p_payout);
  select array_agg(x->>'key') into fails from jsonb_array_elements(el->'checks') x where not (x->>'ok')::boolean;
  update public.payouts set eligibility = el where id = po.id;

  if po.state = 'scheduled' then update public.payouts set state = 'eligibility_check' where id = po.id; po.state := 'eligibility_check'; end if;
  if po.state in ('eligibility_check', 'awaiting_contributions', 'awaiting_settlement') then
    if 'contributions_received' = any (coalesce(fails, '{}')) then
      if po.state <> 'awaiting_contributions' then update public.payouts set state = 'awaiting_contributions' where id = po.id; end if;
      return 'awaiting_contributions';
    end if;
    if 'funds_settled' = any (coalesce(fails, '{}')) then
      if po.state <> 'awaiting_settlement' then update public.payouts set state = 'awaiting_settlement' where id = po.id; end if;
      return 'awaiting_settlement';
    end if;
    update public.payouts set state = 'reconciliation' where id = po.id; po.state := 'reconciliation';
  end if;
  if po.state = 'reconciliation' then
    -- money must really be there: settled pool covers the payout (never another chama's funds)
    if app.pool_available(po.chama_id) < po.gross_minor then
      insert into public.money_alerts (chama_id, kind, severity, subject_id, detail, dedupe_key)
        values (po.chama_id, 'unreconciled_balance', 'high', po.id, 'Settled pool does not cover the payout.', 'recon:' || po.id)
        on conflict (dedupe_key) do nothing;
      return 'reconciliation';
    end if;
    -- eligibility must pass before anyone is asked to authorise (recipient KYC, account, disputes...)
    if not coalesce((el->>'ok')::boolean, false) then return 'reconciliation'; end if;
    update public.payouts set state = 'awaiting_authorisation' where id = po.id; po.state := 'awaiting_authorisation';
  end if;
  if po.state = 'awaiting_authorisation' and ch.approval_policy = 'auto' and coalesce(el->>'ok', 'false')::boolean
     and (ch.review_threshold_minor is null or po.gross_minor <= ch.review_threshold_minor) then
    perform app.authorise(po.id, u);
    return 'authorised';
  end if;
  select state into po.state from public.payouts where id = po.id;
  return po.state;
end $$;

-- Internal: authorise = reserve the funds in the ledger, then move the state.
create function app.authorise(p_payout uuid, p_actor uuid) returns void language plpgsql as $$
declare po public.payouts; el jsonb;
begin
  select * into po from public.payouts where id = p_payout for update;
  el := public.payout_eligibility(p_payout);
  if not (el->>'ok')::boolean then raise exception 'not_eligible' using errcode = 'P0001'; end if;
  perform app.post(po.chama_id, 'payout_authorised', 'auth:' || po.id, app.account(po.chama_id, 'pool_commitments'),
                   app.account(po.chama_id, 'payout_payable', po.recipient_id), po.gross_minor, 'payouts', po.id, p_actor);
  perform app.set_actor(p_actor, 'authorised');
  update public.payouts set state = 'authorised', eligibility = el where id = po.id;
end $$;

-- ---------- approvals (1 or 2 officials; never the recipient) ----------
create function public.approve_payout(p_payout uuid) returns public.payout_state
language plpgsql security definer set search_path = '' as $$
declare u uuid := app.require_user(); po public.payouts; ch public.chamas; need int; have int;
begin
  select * into po from public.payouts where id = p_payout for update;
  if po.id is null or not app.is_official(po.chama_id) then raise exception 'officials_only' using errcode = '42501'; end if;
  if po.recipient_id = u then raise exception 'self_approval: the recipient cannot approve their own payout' using errcode = 'P0001'; end if;
  if po.state <> 'awaiting_authorisation' then raise exception 'not_awaiting_authorisation' using errcode = 'P0001'; end if;
  select * into ch from public.chamas where id = po.chama_id;
  insert into public.payout_approvals (payout_id, approver_id) values (po.id, u) on conflict do nothing;
  need := case ch.approval_policy when 'two' then 2 else 1 end;
  select count(*) into have from public.payout_approvals where payout_id = po.id;
  if have >= need then perform app.authorise(po.id, u); return 'authorised'; end if;
  return 'awaiting_authorisation';
end $$;

-- ---------- record-only: treasurer marks money sent; recipient confirms ----------
create function public.mark_payout_sent(p_payout uuid, p_reference text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := app.require_user(); po public.payouts;
begin
  select * into po from public.payouts where id = p_payout for update;
  if po.id is null or not app.is_official(po.chama_id) then raise exception 'officials_only' using errcode = '42501'; end if;
  if po.state = 'awaiting_recipient' then return; end if;
  if po.state <> 'authorised' then raise exception 'not_authorised' using errcode = 'P0001'; end if;
  perform app.set_actor(u, 'sent:' || coalesce(p_reference, ''));
  update public.payouts set state = 'processing', attempts = attempts + 1 where id = po.id;
  update public.payouts set state = 'awaiting_recipient' where id = po.id;
end $$;

create function public.confirm_payout_received(p_payout uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := app.require_user(); po public.payouts;
begin
  select * into po from public.payouts where id = p_payout for update;
  if po.id is null then raise exception 'no_payout' using errcode = 'P0001'; end if;
  if po.recipient_id <> u then raise exception 'recipient_only' using errcode = '42501'; end if;
  if po.state = 'successful' then return; end if;                 -- idempotent
  if po.state <> 'awaiting_recipient' then raise exception 'not_sent_yet' using errcode = 'P0001'; end if;
  perform app.post(po.chama_id, 'payout_completed', 'done:' || po.id, app.account(po.chama_id, 'payout_payable', po.recipient_id),
                   app.account(po.chama_id, 'pool_settled'), po.net_minor, 'payouts', po.id, u);
  if po.fee_minor > 0 then
    perform app.post(po.chama_id, 'payout_fee', 'fee:' || po.id, app.account(po.chama_id, 'payout_payable', po.recipient_id),
                     app.account(po.chama_id, 'fees'), po.fee_minor, 'payouts', po.id, u);
  end if;
  perform app.set_actor(u, 'recipient confirmed');
  update public.payouts set state = 'successful' where id = po.id;
  update public.cycles set closed_at = now() where id = po.cycle_id;
  insert into public.notices (user_id, kind, body)
    select m.user_id, 'payout', 'This cycle''s payout is complete.' from public.chama_members m where m.chama_id = po.chama_id and m.state = 'active';
end $$;

-- ---------- disputes ----------
create function public.raise_dispute(p_chama uuid, p_contribution uuid, p_payout uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := app.require_user(); v uuid; st public.payout_state;
begin
  if not app.is_member(p_chama) then raise exception 'members_only' using errcode = '42501'; end if;
  insert into public.disputes (chama_id, raised_by, contribution_id, payout_id, reason) values (p_chama, u, p_contribution, p_payout, trim(p_reason)) returning id into v;
  if p_payout is not null then
    select state into st from public.payouts where id = p_payout and chama_id = p_chama;
    if st in ('awaiting_authorisation', 'authorised', 'awaiting_recipient') then
      perform app.set_actor(u, 'dispute raised');
      update public.payouts set state = 'under_review' where id = p_payout;
    end if;
  end if;
  return v;
end $$;

create function public.resolve_alert(p_alert uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := app.require_user(); a public.money_alerts;
begin
  select * into a from public.money_alerts where id = p_alert;
  if a.id is null or not app.is_official(a.chama_id) then raise exception 'officials_only' using errcode = '42501'; end if;
  if char_length(coalesce(trim(p_note), '')) < 3 then raise exception 'note_required' using errcode = 'P0001'; end if;
  update public.money_alerts set resolved_at = now(), resolved_by = u, resolution = trim(p_note) where id = p_alert and resolved_at is null;
end $$;

-- ---------- monitoring (run by the scheduler every 15 minutes) ----------
create function app.run_money_monitor() returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; r record;
begin
  -- payouts stuck in processing > 30 min
  for r in select id, chama_id from public.payouts where state = 'processing' and updated_at < now() - interval '30 minutes' loop
    insert into public.money_alerts (chama_id, kind, severity, subject_id, detail, dedupe_key)
      values (r.chama_id, 'stuck_processing', 'high', r.id, 'Payout has been processing for more than 30 minutes.', 'stuck:' || r.id) on conflict do nothing;
    n := n + 1;
  end loop;
  -- contributions successful but not settled after 24 h
  for r in select id, chama_id from public.contributions where status = 'successful' and created_at < now() - interval '24 hours' loop
    insert into public.money_alerts (chama_id, kind, severity, subject_id, detail, dedupe_key)
      values (r.chama_id, 'unsettled_payment', 'medium', r.id, 'Payment recorded more than 24 hours ago is not settled.', 'unsettled:' || r.id) on conflict do nothing;
    n := n + 1;
  end loop;
  -- payouts due within 3 days that aren't funded
  for r in select p.id, p.chama_id from public.payouts p join public.cycles c on c.id = p.cycle_id
            where c.closed_at is null and c.due_at < now() + interval '3 days' and p.state in ('scheduled', 'eligibility_check', 'awaiting_contributions', 'awaiting_settlement') loop
    insert into public.money_alerts (chama_id, kind, severity, subject_id, detail, dedupe_key)
      values (r.chama_id, 'payout_not_funded', 'medium', r.id, 'Payout is due within 3 days and is not fully funded.', 'unfunded:' || r.id || ':' || to_char(now(), 'YYYY-MM-DD')) on conflict do nothing;
    n := n + 1;
  end loop;
  -- payout accounts changed within 48 h of an upcoming payout
  for r in select p.id, p.chama_id from public.payouts p join public.payout_accounts a on a.id = p.payout_account_id
            where p.state not in ('successful', 'cancelled', 'reversed') and a.changed_at > now() - interval '48 hours' loop
    insert into public.money_alerts (chama_id, kind, severity, subject_id, detail, dedupe_key)
      values (r.chama_id, 'account_changed_before_payout', 'high', r.id, 'Payout account changed shortly before a payout.', 'acct:' || r.id) on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Clients may call these; internal helpers stay private.
revoke all on all functions in schema app from public;
grant execute on function app.is_member(uuid), app.is_official(uuid) to authenticated;
revoke all on function public.payout_eligibility(uuid) from public, anon;
grant execute on function public.create_chama(text, char, char, bigint, public.frequency, timestamptz, public.approval_policy, bigint),
                          public.open_cycle(uuid, timestamptz), public.record_contribution(uuid, uuid, bigint, text, text, text),
                          public.confirm_settled(uuid), public.reverse_contribution(uuid, text), public.payout_eligibility(uuid),
                          public.advance_payout(uuid), public.approve_payout(uuid), public.mark_payout_sent(uuid, text),
                          public.confirm_payout_received(uuid), public.raise_dispute(uuid, uuid, uuid, text),
                          public.resolve_alert(uuid, text), public.chama_roster(uuid) to authenticated;
revoke execute on function public.create_chama(text, char, char, bigint, public.frequency, timestamptz, public.approval_policy, bigint),
                           public.open_cycle(uuid, timestamptz), public.record_contribution(uuid, uuid, bigint, text, text, text),
                           public.confirm_settled(uuid), public.reverse_contribution(uuid, text),
                           public.advance_payout(uuid), public.approve_payout(uuid), public.mark_payout_sent(uuid, text),
                           public.confirm_payout_received(uuid), public.raise_dispute(uuid, uuid, uuid, text),
                           public.resolve_alert(uuid, text), public.chama_roster(uuid) from public, anon;

-- Schedule the monitor where pg_cron is available (Supabase has it; enable it in the dashboard).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('chamaa-money-monitor', '*/15 * * * *', 'select app.run_money_monitor()');
  end if;
end $$;
