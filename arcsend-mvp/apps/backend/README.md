# ArcSend Backend

Express + Prisma API for auth, wallet management, and cross-chain USDC transfer orchestration using Circle Wallets + Arc/CCTPv2 adapter hooks.

## Endpoints

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/wallet/challenge`
- `POST /auth/wallet/verify`
- `GET /wallet/chains`
- `POST /wallet/create` (auth)
- `GET /wallet/list?includeBalance=true` (auth)
- `GET /wallet/balance?chain=base` (auth)
- `GET /wallet/liquidity` (auth)
- `GET /wallet/metadata` (auth)
- `POST /transfer/send` (auth)
- `POST /transfer/quote` (auth)
- `GET /transfer/history` (auth)
- `GET /transfer/status/:id` (auth)
- `GET /transactions` (auth)
- `GET /transactions/:id` (auth)
- `POST /transactions/webhooks`
- `POST /treasury/rebalance/plan` (auth)
- `POST /treasury/rebalance/execute` (auth)
- `POST /treasury/payouts/preview` (auth)
- `POST /treasury/payouts/:runId/approve` (auth)
- `POST /treasury/payouts/:runId/execute` (auth)
- `POST /treasury/policies` (auth)
- `GET /treasury/policies` (auth)
- `PATCH /treasury/policies/:policyId` (auth)
- `POST /treasury/scheduler/run` (auth)
- `GET /treasury/runs` (auth)
- `GET /treasury/runs/:runId` (auth)
- `GET /treasury/items/due-retries` (auth)

## Circle Dev-Controlled Wallet Bootstrap (Arc Testnet)

Set `CIRCLE_API_KEY` in `apps/backend/.env` using:

- `TEST_API_KEY:<key_id>:<key_secret>`

Then run from repo root:

- `npm --workspace @arcsend/backend run circle:wallet:init`
- `npm --workspace @arcsend/backend run circle:wallet:init:multichain`

This script lives at `apps/backend/scripts/create-wallet.ts` and will register an Entity Secret, create a Wallet Set, create Arc Testnet wallets, persist `CIRCLE_WALLET_ID`/address/blockchain in `apps/backend/.env`, and verify a USDC transfer between them.

The multichain script lives at `apps/backend/scripts/create-multichain-wallets.ts` and will create missing execution wallets for `BASE-SEPOLIA`, `ETH-SEPOLIA`, `MATIC-AMOY`, and `SOL-DEVNET`, then upsert these keys into `apps/backend/.env`:

- `CIRCLE_WALLET_ID_*`
- `CIRCLE_WALLET_ADDRESS_*`
- `CIRCLE_WALLET_BLOCKCHAIN_*`

It also prints any missing `CIRCLE_USDC_ADDRESS_*` keys that still need to be set for routing.

Set `MOCK_CIRCLE=false` to make runtime balance and transfer endpoints use the real dev-controlled wallet via Circle SDK.

Optional send-path safety switch:

- strict mode is default (`CIRCLE_SOFT_FALLBACK_ENABLED=false`)
- set `CIRCLE_SOFT_FALLBACK_ENABLED=true` only for dev/demo fallback behavior
	- if Circle rejects a transfer for known runtime constraints (e.g., insufficient source wallet USDC), backend returns a soft-fallback completed transfer so frontend flow remains testable

## Chain-based Execution Routing

Transfers are routed by destination chain at execution time. Configure a wallet + USDC token address per chain in `apps/backend/.env`:

- `ARC-TESTNET`: `CIRCLE_WALLET_*_ARC_TESTNET`, `CIRCLE_USDC_ADDRESS_ARC_TESTNET`
- `BASE-SEPOLIA`: `CIRCLE_WALLET_*_BASE_SEPOLIA`, `CIRCLE_USDC_ADDRESS_BASE_SEPOLIA`
- `ETH-SEPOLIA`: `CIRCLE_WALLET_*_ETH_SEPOLIA`, `CIRCLE_USDC_ADDRESS_ETH_SEPOLIA`
- `MATIC-AMOY`: `CIRCLE_WALLET_*_MATIC_AMOY`, `CIRCLE_USDC_ADDRESS_MATIC_AMOY`
- `SOL-DEVNET`: `CIRCLE_WALLET_*_SOL_DEVNET`, `CIRCLE_USDC_ADDRESS_SOL_DEVNET`

If a selected destination chain is missing required execution values, the backend returns a descriptive configuration error instead of silently using ARC defaults.

## Phase 1 Treasury Payout Preview (No Settlement)

`POST /treasury/payouts/preview` creates a dry-run payout run and item plan without moving funds.

Request body:

- `name?`: optional run name
- `policyId?`: optional policy reference
- `recipients[]`: payout targets with `label?`, `address`, `chain`, and `amountUsdc`

The response includes:

- persisted dry-run `run` metadata
- `summary` totals (requested/planned/executable/skipped)
- per-recipient `items` with planned source chain and route metadata when available

`POST /treasury/payouts/:runId/approve` transitions a run from `DRAFT` to `APPROVED` (and flips `dryRun=false`) when the run has executable planned items.

`POST /treasury/payouts/:runId/execute` executes payout items for an approved run using Arc routing and writes transfer records to `Transaction`.

Optional request body:

- `retryFailed?: boolean` - include previously failed items in this execution pass
- `maxItems?: number` - cap the number of items processed in this call

Retry behavior:

- failed items track `retryCount`, `maxRetryAttempts`, and `nextRetryAt`
- retries only run when `retryFailed=true` and `nextRetryAt <= now`
- backoff uses exponential delay, capped by config

## Payout Policy CRUD (Phase 1)

- `POST /treasury/policies`: create policy `{ name, scheduleType, isActive?, timezone?, nextRunAt?, autoApproveLimitUsdc?, maxRunAmountUsdc?, minChainLiquidityUsdc?, cronExpression?, rules? }`
- `GET /treasury/policies`: list policies for authenticated user
- `PATCH /treasury/policies/:policyId`: update policy/schedule/automation fields

## Phase 3 Scheduler Trigger

`POST /treasury/scheduler/run` scans due active policies (`nextRunAt <= now`) and creates payout runs from `policy.rules.recipients`.

Behavior:

- creates dry-run payout runs using the same preview engine
- auto-approves runs when `plannedTotalUsdc <= autoApproveLimitUsdc`
- leaves runs as draft when above limit (manual approval required)
- updates `lastRunAt` and computes the next schedule window for weekly/monthly policies
- prevents duplicate run creation per policy window using `scheduleWindowKey`

Optional body:

- `maxPolicies?: number` (default 20)
- `nowIso?: string` for deterministic/testing runs

## Background Scheduler Worker (Phase 3)

Set these env vars in `apps/backend/.env` to run automation continuously:

- `SCHEDULER_ENABLED=true`
- `SCHEDULER_INTERVAL_MS=60000`
- `SCHEDULER_MAX_POLICIES=20`

Retry tuning env vars:

- `PAYOUT_RETRY_BASE_DELAY_MS=60000`
- `PAYOUT_RETRY_MAX_DELAY_MS=1800000`
- `PAYOUT_RETRY_DEFAULT_MAX_ATTEMPTS=3`

Scheduler retry sweep env vars:

- `SCHEDULER_RETRY_ENABLED=true`
- `SCHEDULER_RETRY_MAX_RUNS=10`
- `SCHEDULER_RETRY_MAX_ITEMS=100`

When enabled, each scheduler interval also scans for runs with due failed items (`nextRetryAt <= now`) and retries them automatically using the same execution engine.

When enabled, backend boot starts a polling worker that runs the same scheduler logic on each interval.

### CUSTOM_CRON Notes

- `scheduleType=CUSTOM_CRON` now computes and persists `nextRunAt` from `cronExpression`
- supported format is standard 5-field cron in UTC: `minute hour day-of-month month day-of-week`
- examples: `*/15 * * * *`, `0 9 * * 1`, `30 3 1 * *`
- if cron expression is invalid, policy create/update returns `400` with `CRON_*` error code

## Treasury Observability Endpoints

- `GET /treasury/runs?status=PARTIAL&policyId=...&limit=50`
	- lists payout runs with item status breakdown and due-retry count
- `GET /treasury/runs/:runId`
	- returns one run with full item list and retry metadata
- `GET /treasury/items/due-retries?limit=100&runId=...`
	- returns items currently eligible for retry (`nextRetryAt <= now`)
