# Deployments

`script/DeployZen.s.sol` writes `<chainId>.json` here with every deployed address.
Local anvil output (`31337.json`) is git-ignored.

- `10143.json`: **Monad testnet** demo deployment (mock tokenized-equity assets, mock AUSD, short labelled
  demo return windows).
- `10143-activity.json`: transaction hashes of the seeded testnet activity (`script/seed-activity.mjs`).
- No mainnet deployment exists. On Monad mainnet (143) every mock contract refuses to deploy by design.
