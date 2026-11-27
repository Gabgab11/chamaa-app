-- Money rules test suite. Run on a throwaway database after the migrations (see README).
\set ON_ERROR_STOP 1
create schema t;
create table t.results (n serial, name text, ok boolean, detail text);
create function t.ok(c boolean, name text, detail text default null) returns void language sql as $$ insert into t.results (name, ok, detail) values (name, coalesce(c, false), detail) $$;
-- run SQL as a signed-in user; returns the error code ('' if it worked)
create function t.as_user(uid uuid, q text) returns text language plpgsql as $$
declare st text;
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
  begin
    execute q;
  exception when others then
    get stacked diagnostics st = returned_sqlstate;
    execute 'reset role';
    return st || ':' || sqlerrm;
  end;
  execute 'reset role';
  return '';
end $$;
create function t.val(uid uuid, q text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  execute 'set local role authenticated';
  execute q into r;
  execute 'reset role';
  return r;
end $$;
grant usage on schema t to authenticated;
grant all on t.results to authenticated; grant usage on sequence t.results_n_seq to authenticated;

begin;
-- people
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a', 'amina@x.co', '{"first_name":"Amina","last_name":"Otieno","phone":"+254712000001","city":"Kisumu","country":"KE"}'),
 ('00000000-0000-0000-0000-00000000000b', 'brian@x.co', '{"first_name":"Brian","last_name":"Mwangi","phone":"+254712000002","city":"Nairobi","country":"KE"}'),
 ('00000000-0000-0000-0000-00000000000c', 'chao@x.co',  '{"first_name":"Chao","last_name":"Wekesa","phone":"+254712000003","city":"Nakuru","country":"KE"}'),
 ('00000000-0000-0000-0000-00000000000d', 'dan@x.co',   '{"first_name":"Dan","last_name":"Outsider","phone":"+254712000004","city":"Mombasa","country":"KE"}');
select t.ok((select count(*) from public.profiles) = 4, 'sign-up creates a profile for each user');
select t.ok((select count(*) from public.notices where kind = 'join') = 4, 'sign-up adds a welcome notification');

\set A '''00000000-0000-0000-0000-00000000000a'''
\set B '''00000000-0000-0000-0000-00000000000b'''
\set C '''00000000-0000-0000-0000-00000000000c'''
\set D '''00000000-0000-0000-0000-00000000000d'''

-- A creates a chama (KSh 2,000 weekly = 200000 minor units)
select t.ok(t.as_user(:A, $$select public.create_chama('Umoja Circle','KE','KES',200000,'weekly',now()+interval '7 days')$$) = '', 'member can create a chama');
create temp table ids as select id as chama from public.chamas where name = 'Umoja Circle';
grant select on ids to authenticated;
insert into public.chama_members (chama_id, user_id, rotation_pos) select chama, :B::uuid, 2 from ids;
insert into public.chama_members (chama_id, user_id, rotation_pos) select chama, :C::uuid, 3 from ids;
select t.ok((select role from public.chama_members where user_id = :A::uuid) = 'treasurer', 'creator becomes treasurer');

-- A's KYC + payout account (verified, added 3 days ago)
update public.kyc_records set status = 'verified', countries = '{KE}' where user_id = :A::uuid;
insert into public.payout_accounts (user_id, country, kind, holder_name, masked, verified, is_default, added_at, changed_at)
  values (:A::uuid, 'KE', 'mpesa', 'Amina Otieno', 'M-Pesa •••• 0001', true, true, now() - interval '3 days', now() - interval '3 days');

-- ---------- privacy (RLS) ----------
select t.ok(t.val(:D, 'select count(*) from public.chamas') = '0', 'outsider sees no chamas');
select t.ok(t.val(:B, 'select count(*) from public.chamas') = '1', 'member sees their chama');
select t.ok(t.val(:B, 'select count(*) from public.profiles') = '1', 'member sees only their own profile row (no phones of others)');
select t.ok(t.val(:B, 'select count(*) from public.chama_roster((select chama from ids))') = '3', 'members see fellow members'' names via roster');
select t.ok(t.val(:D, 'select count(*) from public.chama_roster((select chama from ids))') = '0', 'outsider gets an empty roster');
select t.ok(t.val(:D, 'select count(*) from public.notices') = '1', 'notifications are private');
select t.ok(t.val(:B, 'select count(*) from public.payout_accounts') = '0', 'payout accounts are private to their owner');
select t.ok(t.as_user(:B, $$insert into public.chamas (name, code, country, currency, contribution_minor, created_by) values ('x','CH-AAAA','KE','KES',1,'00000000-0000-0000-0000-00000000000b')$$) like '42501%', 'clients cannot insert chamas directly');
select t.ok(t.as_user(:A, $$update public.profiles set phone = '+254700000000' where id = auth.uid()$$) like '42501%', 'phone cannot be changed directly');
select t.ok(t.as_user(:A, $$update public.profiles set city = 'Eldoret' where id = auth.uid()$$) = '', 'own city can be changed');
select t.ok(t.as_user(:A, $$update public.profiles set city = 'Hacked' where id = '00000000-0000-0000-0000-00000000000b'$$) = '' and (select city from public.profiles where id = :B::uuid) = 'Nairobi', 'cannot edit someone else''s profile');
select t.ok(t.as_user(:A, $$insert into public.contributions (chama_id, cycle_id, member_id, amount_minor, currency, method, reference, recorded_by, idempotency_key) values (gen_random_uuid(), gen_random_uuid(), auth.uid(), 1, 'KES', 'cash', 'XXXX', auth.uid(), 'k')$$) like '42501%', 'clients cannot write contributions directly');
select t.ok(t.as_user(:A, $$select public.open_cycle((select chama from ids), now() + interval '7 days')$$) = '', 'treasurer opens cycle 1');
select t.ok(t.as_user(:B, $$select public.open_cycle((select chama from ids), now() + interval '7 days')$$) like '42501%', 'ordinary member cannot open a cycle');
create temp table cyc as select c.id as cycle, p.id as payout from public.cycles c join public.payouts p on p.cycle_id = c.id where c.number = 1;
grant select on cyc to authenticated;
select t.ok((select recipient_id from public.cycles where number = 1) = :A::uuid, 'rotation: position 1 receives cycle 1');
select t.ok((select gross_minor from public.payouts) = 600000, 'payout = members x contribution');

-- ---------- payout must wait for money ----------
select t.ok(t.val(:A, $$select public.advance_payout((select payout from cyc))$$) = 'awaiting_contributions', 'payout waits for contributions');
select t.ok((select eligibility->'checks'->5->>'detail' from public.payouts) = 'waiting:3', 'shows how many contributions are missing');
select t.ok(t.as_user(:B, $$select public.record_contribution((select cycle from cyc), auth.uid(), 200000, 'mpesa', 'QK1BBBB', 'k-b1')$$) like '42501%', 'members cannot record their own payment as paid');
select t.ok(t.as_user(:A, $$select public.record_contribution((select cycle from cyc), '00000000-0000-0000-0000-00000000000a', 200000, 'mpesa', 'QK1AAAA', 'k-a1')$$) = '', 'treasurer records A');
select t.ok(t.as_user(:A, $$select public.record_contribution((select cycle from cyc), '00000000-0000-0000-0000-00000000000a', 200000, 'mpesa', 'QK1AAAA', 'k-a1')$$) = '' and (select count(*) from public.contributions) = 1, 'retry with same key does not double count');
select t.ok(t.as_user(:A, $$select public.record_contribution((select cycle from cyc), '00000000-0000-0000-0000-00000000000b', 200000, 'mpesa', 'QK1AAAA', 'k-b1')$$) like '23505%', 'same M-Pesa code cannot be used twice');
select t.ok(t.as_user(:A, $$select public.record_contribution((select cycle from cyc), '00000000-0000-0000-0000-00000000000d', 200000, 'mpesa', 'QK1DDDD', 'k-d1')$$) like 'P0001%not_a_member%', 'cannot record for a non-member');
select t.as_user(:A, $$select public.record_contribution((select cycle from cyc), '00000000-0000-0000-0000-00000000000b', 200000, 'mpesa', 'QK1BBBB', 'k-b1')$$);
select t.as_user(:A, $$select public.record_contribution((select cycle from cyc), '00000000-0000-0000-0000-00000000000c', 200000, 'cash', 'CASH-C1', 'k-c1')$$);
select t.ok(t.val(:A, $$select public.advance_payout((select payout from cyc))$$) = 'awaiting_settlement', 'paid but not settled: waits for settlement');
select t.ok(t.as_user(:A, $$select public.confirm_settled(id) from public.contributions$$) = '', 'treasurer confirms money is in the account');

-- ---------- history can't be changed ----------
select t.ok(t.as_user(:A, $$update public.contributions set amount_minor = 1$$) like '42501%', 'clients cannot edit payments');
do $$ begin update public.ledger_lines set debit_minor = debit_minor + 1; perform t.ok(false, 'ledger lines are append-only (even for admins)');
exception when others then perform t.ok(sqlerrm like 'append_only%', 'ledger lines are append-only (even for admins)'); end $$;
do $$ begin delete from public.journal_entries; perform t.ok(false, 'journal entries cannot be deleted');
exception when others then perform t.ok(sqlerrm like 'append_only%', 'journal entries cannot be deleted'); end $$;
do $$ begin update public.contributions set amount_minor = 1; perform t.ok(false, 'payment amounts are immutable');
exception when others then perform t.ok(sqlerrm like 'contribution_immutable%', 'payment amounts are immutable'); end $$;
do $$ begin update public.contributions set status = 'initiated'; perform t.ok(false, 'payment status cannot go backwards');
exception when others then perform t.ok(sqlerrm like 'illegal_payment_status%', 'payment status cannot go backwards'); end $$;

-- ---------- state machine ----------
do $$ begin update public.payouts set state = 'successful'; perform t.ok(false, 'no jumping straight to successful');
exception when others then perform t.ok(sqlerrm like 'illegal_transition%', 'no jumping straight to successful'); end $$;
do $$ begin insert into public.payouts (chama_id, cycle_id, recipient_id, gross_minor, reference) select chama_id, cycle_id, recipient_id, gross_minor, 'PO-DUP' from public.payouts limit 1; perform t.ok(false, 'never two payouts for the same obligation');
exception when unique_violation then perform t.ok(true, 'never two payouts for the same obligation'); end $$;

select t.ok(t.val(:A, $$select public.advance_payout((select payout from cyc))$$) = 'authorised', 'all checks pass + auto policy: authorised');
select t.ok((select balance_minor from public.account_balances where kind = 'payout_payable') = -600000, 'authorising reserves the funds in the ledger');
select t.ok((select count(*) from public.payout_transitions) >= 5, 'every state move is logged');
select t.ok(t.as_user(:B, $$select public.mark_payout_sent((select payout from cyc), 'X')$$) like '42501%', 'only officials mark a payout sent');
select t.ok(t.as_user(:A, $$select public.mark_payout_sent((select payout from cyc), 'MPESA-OUT-1')$$) = '', 'treasurer marks payout sent');
select t.ok((select state from public.payouts) = 'awaiting_recipient', 'record-only: waits for the recipient to confirm');
select t.ok(t.as_user(:B, $$select public.confirm_payout_received((select payout from cyc))$$) like '42501%', 'only the recipient can confirm receipt');
select t.ok(t.as_user(:A, $$select public.confirm_payout_received((select payout from cyc))$$) = '', 'recipient confirms receipt');
select t.ok(t.as_user(:A, $$select public.confirm_payout_received((select payout from cyc))$$) = '', 'confirming twice is safe');
select t.ok((select state from public.payouts) = 'successful' and (select closed_at is not null from public.cycles where number = 1), 'payout successful and cycle closed');
select t.ok((select count(*) from public.journal_entries where kind = 'payout_completed') = 1, 'payout posted to the ledger exactly once');
select t.ok((select sum(debit_minor) = sum(credit_minor) from public.ledger_lines), 'ledger: total debits = total credits');
select t.ok(not exists (select 1 from public.account_balances where kind in ('member_receivable', 'payout_payable', 'pool_settled', 'treasurer_held') and balance_minor <> 0), 'all balances back to zero after a full cycle');

-- ---------- cycle 2: rotation, reversal, disputes, approval policy ----------
update public.chamas set approval_policy = 'one';
select t.ok(t.as_user(:A, $$select public.open_cycle((select chama from ids), now() + interval '14 days')$$) = '', 'cycle 2 opens');
create temp table cyc2 as select c.id as cycle, p.id as payout from public.cycles c join public.payouts p on p.cycle_id = c.id where c.number = 2;
grant select on cyc2 to authenticated;
select t.ok((select recipient_id from public.cycles where number = 2) = :B::uuid, 'rotation moves to position 2');
select t.as_user(:A, $$select public.record_contribution((select cycle from cyc2), '00000000-0000-0000-0000-00000000000a', 200000, 'mpesa', 'QK2AAAA', 'k-a2')$$);
select t.ok(t.as_user(:A, $$select public.reverse_contribution((select id from public.contributions where reference = 'QK2AAAA'), 'bounced')$$) = '', 'treasurer reverses a bounced payment');
select t.ok((select status from public.contributions where reference = 'QK2AAAA') = 'reversed' and (select count(*) from public.journal_entries where reverses_entry_id is not null) = 1, 'reversal is a new entry; the original stays');
select t.ok((select balance_minor from public.account_balances where kind = 'member_receivable' and member_id = :A::uuid) = 200000, 'reversed payment is owed again');
select t.ok(t.as_user(:A, $$select public.reverse_contribution((select id from public.contributions where reference = 'QK2AAAA'), 'again')$$) = '' and (select count(*) from public.journal_entries where reverses_entry_id is not null) = 1, 'reversing twice does nothing more');
-- fund cycle 2 fully
select t.as_user(:A, $$select public.record_contribution((select cycle from cyc2), '00000000-0000-0000-0000-00000000000a', 200000, 'mpesa', 'QK2AAA2', 'k-a2b')$$);
select t.as_user(:A, $$select public.record_contribution((select cycle from cyc2), '00000000-0000-0000-0000-00000000000b', 200000, 'mpesa', 'QK2BBBB', 'k-b2')$$);
select t.as_user(:A, $$select public.record_contribution((select cycle from cyc2), '00000000-0000-0000-0000-00000000000c', 200000, 'mpesa', 'QK2CCCC', 'k-c2')$$);
select t.as_user(:A, $$select public.confirm_settled(id) from public.contributions where status = 'successful'$$);
select t.ok(t.val(:A, $$select public.advance_payout((select payout from cyc2))$$) = 'reconciliation', 'B has no KYC/account yet: payout held');
update public.kyc_records set status = 'verified', countries = '{KE}' where user_id = :B::uuid;
insert into public.payout_accounts (user_id, country, kind, holder_name, masked, verified, is_default) values (:B::uuid, 'KE', 'mpesa', 'Brian Mwangi', 'M-Pesa •••• 0002', true, true);
update public.payouts set payout_account_id = (select id from public.payout_accounts where user_id = :B::uuid) where id = (select payout from cyc2);
select t.ok((select x->>'ok' from public.payouts p, jsonb_array_elements(public.payout_eligibility(p.id)->'checks') x where p.id = (select payout from cyc2) and x->>'key' = 'account_ok') = 'false', 'account added today: held for 48 hours');
update public.payout_accounts set changed_at = now() - interval '3 days' where user_id = :B::uuid;
select t.ok(t.val(:A, $$select public.advance_payout((select payout from cyc2))$$) = 'awaiting_authorisation', 'policy "one": waits for an approver');
select t.ok(t.as_user(:B, $$select public.approve_payout((select payout from cyc2))$$) like '42501%', 'the recipient cannot approve their own payout');
insert into public.chama_members (chama_id, user_id, role, rotation_pos) select chama, :D::uuid, 'chair', 4 from ids;
do $$ begin insert into public.payout_approvals (payout_id, approver_id) select payout, '00000000-0000-0000-0000-00000000000b' from cyc2; perform t.ok(false, 'self-approval blocked even at database level');
exception when others then perform t.ok(sqlerrm like 'self_approval%', 'self-approval blocked even at database level'); end $$;
select t.ok(t.as_user(:C, $$select public.raise_dispute((select chama from ids), null, (select payout from cyc2), 'My payment is missing from the list')$$) = '', 'a member raises a dispute');
select t.ok((select state from public.payouts where id = (select payout from cyc2)) = 'under_review', 'open dispute puts the payout under review');
select t.ok(t.as_user(:A, $$select public.approve_payout((select payout from cyc2))$$) like 'P0001%not_awaiting%', 'cannot approve while under review');

-- monitoring
select t.ok(app.run_money_monitor() >= 0, 'money monitor runs');
select t.ok(t.val(:B, 'select count(*) from public.money_alerts') = '0', 'ordinary members do not see money alerts');

-- totals stay balanced
select t.ok((select sum(debit_minor) = sum(credit_minor) from public.ledger_lines), 'ledger still balanced after reversals');

-- unbalanced entries are refused at commit
savepoint s;
do $$ declare e uuid; a uuid;
begin
  select id into a from public.ledger_accounts limit 1;
  insert into public.journal_entries (chama_id, currency, kind, idempotency_key) select chama_id, currency, 'bad', 'bad-1' from public.ledger_accounts where id = a returning id into e;
  insert into public.ledger_lines (entry_id, account_id, debit_minor) values (e, a, 100);
  set constraints all immediate;
  perform t.ok(false, 'unbalanced entries are refused');
exception when others then perform t.ok(sqlerrm like 'unbalanced_entry%', 'unbalanced entries are refused'); end $$;

select n, case when ok then 'PASS' else 'FAIL' end as result, name, detail from t.results order by n;
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from t.results;
rollback;
