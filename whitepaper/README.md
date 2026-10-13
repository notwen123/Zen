# STOCKBACK whitepaper

`STOCKBACK-Whitepaper.pdf` (11 pages) is built from `stockback-whitepaper.tex`:

```bash
cd whitepaper && tectonic stockback-whitepaper.tex && mv stockback-whitepaper.pdf STOCKBACK-Whitepaper.pdf
```

Every chart is drawn by pgfplots from numbers in the source. Every number has a source:

| Figure / number | Source |
|---|---|
| Gas table, Fig. 2, fits in Eq. 14 | `benchmarks/results/onchain-46630.md` (measured 2026-09-28); linear least-squares fit, R² > 0.9999 |
| Reward parameters, caps, budgets (Table 3) | `RewardPolicy` / `RewardPool` read on chain, 2026-10-02 |
| 13 claims, 3 wallets, 248.19 units; 1 USDG funding | `RewardAllocated` and `FundedWithUSDG` events, 2026-10-03 |
| Test counts (Table 6) | `forge test`, `cargo test`, `web/npm test`, `web/npm run test:e2e`, the browser suite, `npm run check:secrets` |
| Fig. 3 | Wu et al., arXiv:2604.25213 |
| Fig. 4, Eqs. 16–17 | Javarone, Leonardos & Ventre, arXiv:2609.13064, with their calibration (an illustration, not a STOCKBACK measurement) |
