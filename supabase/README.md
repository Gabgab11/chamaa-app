# MyChamaa database (Supabase)

Migrations in `migrations/` run in order on the Supabase project.

What they enforce:
- **Privacy:** row-level security is on and forced on every table. People see only their own profile, notifications, goals and payout accounts. Members see their own chamas, who has paid this cycle, payouts and the ledger. Other members show up by name only, through `chama_roster`.
- **No direct money writes:** clients can't insert, update or delete money rows. Every change goes through the server functions: `create_chama`, `open_cycle`, `record_contribution`, `confirm_settled`, `reverse_contribution`, `advance_payout`, `approve_payout`, `mark_payout_sent`, `confirm_payout_received`, `raise_dispute` and `resolve_alert`.
- **Ledger:** double-entry and append-only, using bigint minor units. Every entry has to balance, in one chama and one currency, and is checked at commit. Corrections are made as reversal entries.
- **Payouts:** a 9-stage state machine with an allowed-transitions table. Every move is logged. There's one payout per chama, cycle and recipient, and retries can't pay twice. Payouts follow the eligibility engine and the approval policy (auto, 1 or 2 approvers), and the recipient can never approve their own payout. Funds are reserved in the ledger when a payout is authorised.
- **Monitoring:** `app.run_money_monitor()` writes `money_alerts`. It's scheduled every 15 minutes when pg_cron is enabled.

## Tests
`tests/01_money_rules_test.sql` has 67 checks covering privacy, permissions, idempotency, the state machine, append-only history, reversals, approvals, disputes and ledger balance.
To run them on a throwaway local Postgres 16 (not Supabase):

```
PGHOST=/path/to/socket PGPORT=5432 tests/run_local.sh
```

`tests/00_local_supabase_stub.sql` imitates Supabase's `auth` schema for local runs only. Never run it on Supabase.
