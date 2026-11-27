#!/usr/bin/env bash
# Runs the migrations + tests on a throwaway local Postgres (not Supabase).
# Usage: PGHOST=/tmp/pgsock PGPORT=54329 ./run_local.sh [test.sql]
set -euo pipefail
cd "$(dirname "$0")"
P="psql -U postgres -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists chamaa_test" -c "create database chamaa_test" >/dev/null
$P -d chamaa_test -f 00_local_supabase_stub.sql >/dev/null
$P -d postgres -c "alter database chamaa_test set search_path = \"\$user\", public, extensions" >/dev/null
for f in ../migrations/*.sql; do $P -d chamaa_test -f "$f" >/dev/null; done
psql -U postgres -q -At -d chamaa_test -f "${1:-01_money_rules_test.sql}"
