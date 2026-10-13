# Zen indexer (Envio HyperIndex)

Indexes every Zen event on **Monad testnet (10143)** through Envio **HyperSync** (`https://10143.hypersync.xyz`):
purchases, conditional-claim mints, transfers, refunds (VoidOracle + ClaimVoided), settlements, and the
InstantExitPool market (claims bought, resolutions, LP deposits and withdrawals), each with its transaction hash.

Why: Monad's public RPC caps `eth_getLogs` at 100 blocks, so without an indexer the app can only read current
state. With it, the web app shows full history with tx links (Activity page, LP terminal market tape) and
per-wallet refund history, while still falling back to direct contract reads if the indexer is down.

| Entity | What it holds |
|---|---|
| `Claim` | one per conditional claim: claimant, current holder, brand, amount, category, unlock time, status, mint / sale / resolution tx, sale price, pool cost and proceeds, purchase amount and currency |
| `Activity` | every user-visible event (`CLAIM`, `CASH_OUT`, `REFUND`, `SETTLE`, `LP_DEPOSIT`, `LP_WITHDRAW`) with tx hash and timestamp |
| `Pool` | running totals per exit pool: deposits, withdrawals, claims bought (face and cost), realized gains and losses |
| `Account` | per wallet: claims, voids (refund history), cash-outs, LP deposits |
| `Purchase` | purchase amount/currency from `PurchaseCommitted`, joined into `Claim` |

## Run locally

```bash
cd indexer
npm install
echo 'ENVIO_API_TOKEN=<your token from https://envio.dev/app/api-tokens>' > .env
npx envio codegen
npx envio dev          # needs Docker running (Postgres + Hasura); GraphQL at http://localhost:8080/v1/graphql
```

Then point the web app at it: `NEXT_PUBLIC_ENVIO_GRAPHQL_URL=http://localhost:8080/v1/graphql` in `web/.env.local`.

## Deploy

Push this folder to Envio Cloud (git-based deploy, see docs.envio.dev → Deploying Your Indexer) and set
`NEXT_PUBLIC_ENVIO_GRAPHQL_URL` to the hosted endpoint. Indexers on Envio Cloud don't need an API token.

Example query:

```graphql
{
  Pool { brand claimsBought realizedGains realizedLosses deposited withdrawn }
  Activity(order_by: { timestamp: desc }, limit: 10) { kind claimId brand amount price txHash }
}
```
