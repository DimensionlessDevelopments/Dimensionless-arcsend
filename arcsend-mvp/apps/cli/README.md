# ArcSend CLI

<p align="center">
  <img src="https://img.shields.io/badge/ArcSend-CLI-7c3aed?style=flat-square" alt="ArcSend CLI" />
  <img src="https://img.shields.io/npm/v/arcsend-cli?style=flat-square&color=8b5cf6" alt="cli npm version" />
  <img src="https://img.shields.io/npm/dm/arcsend-cli?style=flat-square&color=10b981" alt="cli npm downloads" />
  <img src="https://img.shields.io/badge/Status-Ready_for_Publish-2563eb?style=flat-square" alt="ready for publish" />
</p>

Command-line interface for ArcSend wallet auth, quoting, transfers, and transaction history.

## Usage

```bash
npm --workspace arcsend-cli exec arcsend login --email demo@arcsend.io --password password123
npm --workspace arcsend-cli exec arcsend chains
npm --workspace arcsend-cli exec arcsend liquidity
npm --workspace arcsend-cli exec arcsend wallets --include-balance
npm --workspace arcsend-cli exec arcsend wallet-create --chain base
npm --workspace arcsend-cli exec arcsend balance --chain arc-testnet
npm --workspace arcsend-cli exec arcsend quote --to ethereum --amount 5
npm --workspace arcsend-cli exec arcsend pay --to ethereum --amount 5 --recipient 0xRecipientAddress000000000000000000000001
npm --workspace arcsend-cli exec arcsend status <transferId>
npm --workspace arcsend-cli exec arcsend history
npm --workspace arcsend-cli exec arcsend treasury-plan --target-chain polygon --min-usdc 25000
npm --workspace arcsend-cli exec arcsend treasury-execute --target-chain polygon --min-usdc 25000
```

## Command model

- `pay` is an intent command: ArcSend backend chooses the route by default (`--strategy auto`).
- `status` and `history` show normalized ArcSend transfer phases so users don't manage bridge-level complexity.
- `liquidity` and `treasury-*` expose crosschain USDC as a single liquidity surface.

## Notes

- CLI authenticates against ArcSend backend and stores ArcSend auth token.
- Set `ARCSEND_API` when backend is not on the default URL (example: `ARCSEND_API=http://localhost:4001`).
- Do not use Circle API keys or Entity Secrets in CLI flags or config.
