#!/usr/bin/env bash
# Measures Stylus vs Solidity Ed25519 verification ON THE SAME CHAIN with byte-identical calldata.
# Both numbers come from eth_estimateGas, so intrinsic + calldata (+ Arbitrum L1 component)
# overheads are identical and the difference is execution.
#
#   RPC_URL=https://rpc.testnet.chain.robinhood.com PRIVATE_KEY=0x... benchmarks/run_onchain.sh
#
# Needs a funded testnet key (faucet: https://faucet.testnet.chain.robinhood.com/),
# Foundry (cast/forge), cargo-stylus, node. Writes benchmarks/results/onchain-<chainId>.md.
set -euo pipefail
: "${RPC_URL:?set RPC_URL}" "${PRIVATE_KEY:?set PRIVATE_KEY}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIX="$ROOT/benchmarks/fixtures/vectors.json"
CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
OWNER=$(cast wallet address --private-key "$PRIVATE_KEY")
PUBKEY=$(node -e "console.log(require('$FIX').ed25519Pubkey)")
echo "chain $CHAIN_ID, owner $OWNER"

# Reuse an existing ReceiptProver (owned by PRIVATE_KEY) with STYLUS=0x..., otherwise deploy one.
if [ -z "${STYLUS:-}" ]; then
  echo "== deploy Stylus ReceiptProver"
  # --constructor-args is variadic: it must come last.
  STYLUS_LOG=$(cd "$ROOT/stylus/receipt-prover" && cargo stylus deploy -e "$RPC_URL" --private-key "$PRIVATE_KEY" \
    --no-verify --constructor-args "$OWNER" 2>&1 | tee /dev/stderr)
  STYLUS=$(echo "$STYLUS_LOG" | sed 's/\x1b\[[0-9;]*m//g' | grep -i 'deployed code at address' | grep -oE '0x[0-9a-fA-F]{40}' | tail -1)
  [ -n "$STYLUS" ] || { echo "could not parse Stylus address"; exit 1; }
fi

echo "== deploy Solidity Ed25519Verifier"
SOL=$(cd "$ROOT/benchmarks/solidity" && forge create src/Ed25519Verifier.sol:Ed25519Verifier --broadcast \
  --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" --constructor-args "$OWNER" | grep -oE 'Deployed to: 0x[0-9a-fA-F]{40}' | grep -oE '0x[0-9a-fA-F]{40}')

for C in "$STYLUS" "$SOL"; do
  cast send "$C" "setAttester(bytes32,bool)" "$PUBKEY" true --rpc-url "$RPC_URL" --private-key "$PRIVATE_KEY" >/dev/null
done

OUT="$ROOT/benchmarks/results/onchain-$CHAIN_ID.md"
{
  echo "Chain $CHAIN_ID, $(date -u +%F). Stylus: \`$STYLUS\`, Solidity: \`$SOL\`."
  echo "eth_estimateGas of verifyBatch(bytes32[],bytes[]) with identical calldata."
  echo
  echo "| batch | Solidity Ed25519 | Stylus Ed25519 | Stylus / Solidity |"
  echo "|---:|---:|---:|---:|"
} >"$OUT"

for N in 1 10 50 100; do
  read -r DIG ATT < <(node -e "const f=require('$FIX');console.log('['+f.digests.slice(0,$N).join(',')+']','['+f.ed25519.slice(0,$N).join(',')+']')")
  # Sanity: both must return true before gas is recorded.
  for C in "$STYLUS" "$SOL"; do
    R=$(cast call "$C" "verifyBatch(bytes32[],bytes[])(bool)" "$DIG" "$ATT" --rpc-url "$RPC_URL" 2>&1 || true)
    [ "$R" = "true" ] || [ "$C" = "$SOL" ] || { echo "Stylus verifyBatch($N) returned: $R"; exit 1; }
  done
  GS=$(cast estimate "$STYLUS" "verifyBatch(bytes32[],bytes[])" "$DIG" "$ATT" --rpc-url "$RPC_URL")
  GL=$(cast estimate "$SOL" "verifyBatch(bytes32[],bytes[])" "$DIG" "$ATT" --rpc-url "$RPC_URL" 2>/dev/null || echo "exceeds tx gas cap")
  RATIO=$( [[ "$GL" =~ ^[0-9]+$ ]] && python3 -c "print(f'{$GS/$GL:.3f}')" || echo "n/a")
  echo "| $N | $GL | $GS | $RATIO |" | tee -a "$OUT"
done
echo "wrote $OUT"
