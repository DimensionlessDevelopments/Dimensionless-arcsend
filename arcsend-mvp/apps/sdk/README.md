# ArcSend SDK

<p align="center">
  <img src="https://img.shields.io/badge/ArcSend-By%20Circle%20x%20DimensionlessDevelopments%20MVP-111827?style=flat-square" alt="ArcSend brand" />
  <img src="https://img.shields.io/badge/SDK-Chain--Abstracted%20USDC-2563eb?style=flat-square" alt="ArcSend SDK" />
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/arcsend-sdk?style=flat-square&color=2563eb" alt="npm version" />
  <img src="https://img.shields.io/npm/dm/arcsend-sdk?style=flat-square&color=10b981" alt="npm downloads" />
  <img src="https://img.shields.io/npm/l/arcsend-sdk?style=flat-square" alt="license" />
  <img src="https://img.shields.io/badge/TypeScript-Ready-3178c6?style=flat-square&logo=typescript" alt="TypeScript ready" />
</p>

TypeScript-first SDK for building chain-abstracted USDC applications on top of the ArcSend backend.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [React Integration](#react-integration)
- [Security Model](#security-model)
- [Supported Chains](#supported-chains)
- [Error Handling](#error-handling)
- [Python Parity Client](#python-parity-client)

## Overview

ArcSend SDK gives developers one programmable interface for:

- authentication,
- wallet discovery and balances,
- transfer quoting/sending/status,
- transaction history and webhook ingestion.

The backend handles cross-chain routing and settlement complexity while SDK consumers integrate a single consistent contract.

## Features

- Typed API client with runtime response validation.
- Canonical transfer lifecycle status normalization (`pending`, `processing`, `completed`, `failed`).
- Chain alias normalization (legacy labels to backend chain keys).
- Built-in auth module (email/password and wallet challenge/verify).
- Wallet, transfer, and transaction modules aligned to ArcSend backend routes.
- Backend-authoritative transfer tracker with typed event emitter.
- React adapter subpath (`arcsend-sdk/react`) with provider + quote/status/balance hooks.
- TypeScript and Python parity support.

## Installation

```bash
npm install arcsend-sdk
```

Requirements:

- Node.js >= 18

## Quick Start

```ts
import ArcSendClient from 'arcsend-sdk';

const client = new ArcSendClient({
  baseUrl: 'http://localhost:4001'
});

const login = await client.auth.login('demo@example.com', 'password123');
if (!login.data) throw new Error(login.error || 'Login failed');

client.setToken(login.data.token);

const liquidity = await client.wallets.getLiquidity();
console.log('Best source chain:', liquidity.data?.bestSourceChain);

const quote = await client.transfers.estimate({
  destinationChain: 'ethereum',
  amount: '10.00',
  routeStrategy: 'auto'
});

const sent = await client.transfers.send({
  destinationAddress: '0x742d35Cc6634C0532925a3b844Bc0d3f5b9b7b3c',
  destinationChain: 'ethereum',
  amount: '10.00',
  routeStrategy: 'auto'
});

console.log('Transfer ID:', sent.data?.id);
```

## Architecture

```text
ArcSendClient
├── auth         (login/signup/wallet challenge+verify)
├── wallets      (chains/list/balance/liquidity/metadata)
├── transfers    (estimate/send/status)
└── transactions (list/get/webhooks)
```

## API Reference

### Client Configuration

```ts
interface ArcSendConfig {
  token?: string;
  apiKey?: string; // ArcSend-issued credential alias for compatibility
  baseUrl?: string;
  timeout?: number;
  getToken?: () => string | undefined | Promise<string | undefined>;
}
```

### Auth Module

- `auth.login(email, password)`
- `auth.signup(email, password)`
- `auth.walletChallenge(address)`
- `auth.walletVerify(address, message, signature)`

### Wallets Module

- `wallets.getSupportedChains()`
- `wallets.list({ includeBalance?: boolean })`
- `wallets.getBalance(chain?)`
- `wallets.getLiquidity()`
- `wallets.getMetadata()`

### Transfers Module

- `transfers.estimate({ destinationChain, amount, sourceChain?, routeStrategy? })`
- `transfers.send({ destinationAddress, destinationChain, amount, sourceChain?, routeStrategy? })`
- `transfers.getStatus(transferId)`
- `transfers.getStatusNormalized(transferId)`

### Canonical Status Model

ArcSend SDK normalizes backend/provider-specific statuses into a single lifecycle:

- `pending`
- `processing`
- `completed`
- `failed`

Helpers:

- `transfers.normalizeStatus(rawStatus)`
- `transactions.listNormalized()`
- `transactions.getNormalized(id)`

### Tracking + Events

- `client.refreshTransferStatus(transferId)` syncs backend status into the instance tracker.
- `client.getTrackedTransfer(transferId)` / `client.listTrackedTransfers()` for UI state projections.
- Events: `ARC_EVENTS.TRANSFER_STATUS_CHANGED`, `ARC_EVENTS.TRANSFER_COMPLETED`, `ARC_EVENTS.TRANSFER_FAILED`.

### Transactions Module

- `transactions.list()`
- `transactions.get(id)`
- `transactions.webhooks(payload)`

### Backend Endpoint Compatibility

- `POST /auth/login`
- `POST /auth/signup`
- `POST /auth/wallet/challenge`
- `POST /auth/wallet/verify`
- `GET /wallet/chains`
- `GET /wallet/list`
- `GET /wallet/balance`
- `GET /wallet/liquidity`
- `GET /wallet/metadata`
- `POST /transfer/quote`
- `POST /transfer/send`
- `GET /transfer/status/:id`
- `GET /transactions`
- `GET /transactions/:id`
- `POST /transactions/webhooks`

## React Integration

Use the React adapter subpath:

```ts
import { ArcSendProvider, useArcSend, useQuote, useTransferStatus, useTokenBalance } from 'arcsend-sdk/react';
```

A React hook example is available at `examples/react-hooks.ts`.

Recommended pattern:

- Authenticate through your app flow,
- store ArcSend JWT in state/storage,
- instantiate SDK with `token` or `getToken`.

## Security Model

ArcSend SDK is backend-safe by design:

- Use only ArcSend-issued auth credentials (JWT/API key from ArcSend backend auth layer).
- Do not pass Circle credentials (Circle API key or Entity Secret) into client-side SDK configuration.
- The SDK now rejects values that look like Circle credentials at runtime.

## Supported Chains

Preferred chain values:

- `arc-testnet`
- `ethereum`
- `base`
- `polygon`
- `solana`

Legacy aliases accepted and normalized:

- `Arc_Testnet`
- `Ethereum_Sepolia`
- `Base_Sepolia`
- `Polygon_Amoy`
- `Solana_Devnet`

## Error Handling

SDK throws `ArcSendError` for normalized transport/API failures and surfaces backend error messages when available.

```ts
try {
  await client.transfers.send({
    destinationAddress: '0x742d35Cc6634C0532925a3b844Bc0d3f5b9b7b3c',
    destinationChain: 'ethereum',
    amount: '5.00'
  });
} catch (error) {
  console.error(error);
}
```

## Python Parity Client

Python parity client lives in `python/arcsend_sdk` and targets the same backend routes.

See:

- `python/arcsend_sdk/client.py`
- `python/README.md`
