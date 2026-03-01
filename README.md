# Dimensionless Developments ArcSend

<p align="center">
	<img src="assets/badges/arcsend-brand.svg" alt="ArcSend" width="420" />
</p>

<p align="center">
	<strong>Send USDC Across Chains with Arc Routing and One Unified Liquidity Surface</strong>
</p>

<p align="center">
	<a href="#features">Features</a> •
	<a href="#quick-start">Quick Start</a> •
	<a href="#cli">CLI</a> •
	<a href="#supported-chains">Supported Chains</a> •
	<a href="#tech-stack">Tech Stack</a>
</p>

<p align="center">
	<img src="https://img.shields.io/badge/monorepo-npm%20workspaces-2563eb?style=flat-square" alt="Monorepo" />
	<img src="https://img.shields.io/badge/backend-Express%20%2B%20Prisma-0f766e?style=flat-square" alt="Backend" />
	<img src="https://img.shields.io/badge/frontend-React%20%2B%20Vite-7c3aed?style=flat-square" alt="Frontend" />
	<img src="https://img.shields.io/badge/settlement-Circle%20Wallets%20%2B%20Arc-1d4ed8?style=flat-square" alt="Settlement" />
</p>

---

## Overview

**ArcSend MVP** is a chain-abstracted USDC transfer platform that treats multiple networks as one routing surface. Users can quote, preview, and send with either automatic source selection or manual source control.

### What ArcSend Includes

| Component | Description |
|-----------|-------------|
| **Web App** | Dashboard for auth, wallet/liquidity visibility, route preview, send, and history |
| **Backend API** | Express + Prisma service for auth, wallet orchestration, transfer execution, and treasury automation |
| **CLI** | `arcsend` command-line tool for login, balance, quote, send, status, and history |

### Why ArcSend

Cross-chain transfers are often fragmented:

- **Too many interfaces** across wallets, bridges, and execution tools
- **Poor visibility** into source liquidity and route quality
- **Inconsistent operations** between UI and automation flows


ArcSend delivers cross-chain USDC payment/transfer flows and treasury operations through one backend orchestration layer and one frontend experience. ArcSend demonstrates capital mobility in the exact sequence requested by the prompt: capital is sourced from available chain liquidity, routed via Arc-aware orchestration, and settled through Circle-powered execution. The user does not need to leave the product or manually compose chain-specific bridge workflows, which is the core abstraction goal.

ArcSend includes scheduler-triggered payout runs, policy windows, and automated retry processing with backoff. Payout runs are itemized per recipient and chain, and execution metadata is tracked at item and run level.


- Frontend React app provides a unified interface and hides cross-chain complexity.
- Backend orchestrates auth, wallet creation, balance lookup, and cross-chain transfer execution.
- Circle tools are abstracted in `circleService.js` to keep app logic chain-agnostic.
- PostgreSQL stores app-level state for users, wallet mapping, and transaction history.
- CLI offers power-user automation and demonstrates backend-first architecture.

It cleanly separates UX abstraction (React app), crosschain execution logic (Express/Circle services), and financial operations automation (Prisma policy/scheduler/retry models).
That architecture is exactly what enables both:
chain-abstracted USDC movement, and
automated, policy-driven treasury payout operations.



ArcSend simplifies this with one system for routing, execution, and observability.

---

## Features

### Transfer & Routing

| Feature | Description |
|---------|-------------|
| **Arc Auto Source** | Picks the best source chain from available liquidity |
| **Arc Manual Source** | Operator-selected source chain for deterministic execution |
| **Route Preview** | Quote route before submit with estimated fee and receive amount |
| **Recipient Validation** | Chain-aware validation for EVM and Solana recipients |
| **Liquidity Surface** | Live per-chain available USDC and best-source indication |
| **Transfer History** | Status tracking and explorer-aware transaction display |

### Treasury Automation (Phase 1–3)

| Feature | Description |
|---------|-------------|
| **Payout Preview Runs** | Build dry-run payout plans before settlement |
| **Approval Workflow** | Approve runs before execution when policy requires it |
| **Policy-Based Scheduling** | Weekly, monthly, and custom cron policies |
| **Retry Engine** | Exponential backoff with max-attempt controls |
| **Run Observability** | Run list, run detail, status breakdowns, and due-retry surfaces |

### Developer Experience

| Feature | Description |
|---------|-------------|
| **Monorepo Workspace** | Frontend, backend, and CLI in one repo |
| **Configurable Runtime** | Mock mode for local demo, Circle mode for real execution |
| **Typed API Inputs** | Zod validation and explicit error mapping |
| **Docs Included** | Architecture, troubleshooting, Circle quickstart, and demo guide |

---

## Project Structure

| Path | Purpose |
|------|---------|
| `apps/backend` | API, auth, wallet, transfer, and treasury automation services |
| `apps/frontend` | React + TypeScript dashboard |
| `apps/cli` | Command-line interface (`arcsend`) |
| `docs/architecture.md` | System architecture and flow map |
| `docs/circle-dev-controlled-wallet-quickstart.md` | Circle wallet bootstrap steps |
| `docs/local-dev-troubleshooting.md` | Windows-first local startup troubleshooting |
| `docs/checklist-closeout.md` | Scope closeout and completion notes |
| `docs/video-demo-guide.md` | Demo script and recording checklist |

---

## Quick Start

### 1) Start Postgres

```bash
docker compose up -d
```

### 2) Install dependencies

```bash
npm install
```

### 3) Configure environment

- Set backend env in `apps/backend/.env`
- (Optional) Set frontend env in `apps/frontend/.env`

Runtime modes:

- `MOCK_CIRCLE=true` for local/mock execution
- `MOCK_CIRCLE=false` for real Circle dev-controlled wallet execution

### 4) Prepare database

```bash
npm --workspace @arcsend/backend run prisma:generate
npm --workspace @arcsend/backend run prisma:migrate -- --name init
```

### 5) Run services

```bash
npm run dev:backend
npm run dev:frontend
```

- Backend: `http://localhost:4001`
- Frontend: `http://localhost:5173`

If backend startup is unstable on Windows, follow `docs/local-dev-troubleshooting.md`.

---

## CLI

The ArcSend CLI is available from the monorepo package and supports both human and script-friendly usage.

### Common Commands

```bash
npm --workspace @arcsend/cli exec arcsend login --email demo@arcsend.io --password password123
npm --workspace @arcsend/cli exec arcsend balance --chain base
npm --workspace @arcsend/cli exec arcsend quote --to polygon --amount 5
npm --workspace @arcsend/cli exec arcsend send --to polygon --amount 5 --recipient 0xRecipientAddress000000000000000000000001 --strategy auto
npm --workspace @arcsend/cli exec arcsend history
```

### Command Surface

| Command | Description |
|---------|-------------|
| `arcsend login` | Authenticate and store session token |
| `arcsend balance` | Check chain balance |
| `arcsend quote` | Preview route and estimated receive |
| `arcsend send` | Execute transfer (auto or manual source) |
| `arcsend status` | Fetch transfer status by id/hash |
| `arcsend history` | List recent transfers |

---

## Circle Integration

ArcSend uses Circle Developer-Controlled Wallets for settlement execution.

### Wallet Bootstrap

```bash
npm --workspace @arcsend/backend run circle:wallet:init
npm --workspace @arcsend/backend run circle:wallet:init:multichain
```

### Execution Notes

- **Strict mode default:** `CIRCLE_SOFT_FALLBACK_ENABLED=false`
- Optional soft fallback for dev/demo only: `CIRCLE_SOFT_FALLBACK_ENABLED=true`
- Configure per-chain wallet + token addresses in `apps/backend/.env`

For full setup details, see `docs/circle-dev-controlled-wallet-quickstart.md`.

---

## Supported Chains

| App Chain | Runtime Chain Code |
|-----------|--------------------|
| `base` | `BASE-SEPOLIA` |
| `ethereum` | `ETH-SEPOLIA` |
| `polygon` | `MATIC-AMOY` |
| `solana` | `SOL-DEVNET` |
| `arc-testnet` | `ARC-TESTNET` |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React + TypeScript + Vite + Tailwind |
| **Backend** | Node.js + Express + Prisma + PostgreSQL |
| **Validation** | Zod |
| **Auth** | JWT |
| **Settlement** | Circle Developer-Controlled Wallets + Arc/CCTP path |
| **CLI** | Commander.js |

---

## Docs

- `docs/architecture.md`
- `docs/video-demo-guide.md`
- `docs/circle-dev-controlled-wallet-quickstart.md`
- `docs/local-dev-troubleshooting.md`
- `docs/checklist-closeout.md`

---

## License

MIT

## 🤝 Contributing

Contributions are welcome.

Please keep these principles intact:

- No private-key persistence
- No remote key handling
- Clear warnings around secret handling
- Keep the local-first model

---


## Contact
**Made by Dimensionless Developments**
**Head to our website https://www.dimensionlessdevelopments.com. email: contact@dimensionlessdevelopments.com**
