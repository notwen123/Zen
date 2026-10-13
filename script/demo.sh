#!/usr/bin/env bash
# STOCKBACK end-to-end demo: receipt -> attestation -> claim -> brand-vault shares.
#
#   Local:   anvil &  then  script/demo.sh
#   Testnet: RPC_URL=https://rpc.testnet.chain.robinhood.com DEPLOYER_PRIVATE_KEY=0x.. \
#            ATTESTER_ECDSA_KEY=0x.. USER_PRIVATE_KEY=0x.. script/demo.sh
# Defaults are Anvil's public, well-known dev keys (never use them on a real network).
set -euo pipefail
cd "$(dirname "$0")/.."
RPC_URL=${RPC_URL:-http://127.0.0.1:8545}
DEPLOYER_PRIVATE_KEY=${DEPLOYER_PRIVATE_KEY:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}
ATTESTER_ECDSA_KEY=${ATTESTER_ECDSA_KEY:-0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d}
USER_PRIVATE_KEY=${USER_PRIVATE_KEY:-0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a}
export ATTESTER_SALT=${ATTESTER_SALT:-demo-salt-not-secret}
export ATTESTER_ECDSA_KEY
USER=$(cast wallet address --private-key "$USER_PRIVATE_KEY")
export CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

say "1. Deploy STOCKBACK (demo, mock assets) on chain $CHAIN_ID"
ATTESTER_ADDRESS=$(cast wallet address --private-key "$ATTESTER_ECDSA_KEY") DEPLOYER_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY \
  forge script script/DeployStockback.s.sol --rpc-url "$RPC_URL" --broadcast --slow -q >/dev/null
D=deployments/$CHAIN_ID.json
j() { node -e "console.log(require('./$D')['$1'])"; }
export REGISTRY=$(j registry)
VAULT=$(j mNKEVault)
echo "registry $REGISTRY, Nike vault $VAULT"

say "2. User buys Nike shoes for Rs 2,000; the raw receipt stays off-chain"
RECEIPT=$(mktemp)
cat >"$RECEIPT" <<JSON
{ "claimant": "$USER", "brand": "NIKE", "merchant": "Nike Store 042, Mumbai",
  "receiptRef": "UPI-DEMO-$RANDOM$RANDOM", "amount": 200000, "currency": "INR" }
JSON
cat "$RECEIPT"

say "3. Attester normalises + hashes the receipt and signs the EIP-712 claim"
OUT=$(node tools/attester.mjs attest "$RECEIPT")
rm -f "$RECEIPT"
o() { node -e "console.log(JSON.parse(process.argv[1])$1)" "$OUT"; }
TUPLE=$(o .tuple)
ATT=$(o .attestationECDSA)
echo "on-chain claim (hashes only): $TUPLE"

SIG="(address,bytes32,bytes32,bytes32,uint128,bytes3,uint64,uint64)"
say "4. Preview: status 0 = Ok, reward in mNKE wei"
cast call "$REGISTRY" "previewClaim($SIG,bytes)(uint8,uint256)" "$TUPLE" "$ATT" --rpc-url "$RPC_URL"

say "5. Submit claim (commitment + nullifier + verification + eligibility + reward + vault deposit)"
cast send "$REGISTRY" "submitClaim($SIG,bytes)" "$TUPLE" "$ATT" --private-key "$USER_PRIVATE_KEY" --rpc-url "$RPC_URL" \
  | grep -E '^(status|transactionHash|gasUsed)'

say "6. Portfolio"
SHARES=$(cast call "$VAULT" "balanceOf(address)(uint256)" "$USER" --rpc-url "$RPC_URL" | cut -d' ' -f1)
ASSETS=$(cast call "$VAULT" "convertToAssets(uint256)(uint256)" "$SHARES" --rpc-url "$RPC_URL" | cut -d' ' -f1)
echo "sbNKE shares: $SHARES  =>  $(cast from-wei "$ASSETS") mNKE (0.75% of Rs 2,000 = 15 units of demo exposure)"

say "7. Replay the same receipt: must be rejected"
if cast send "$REGISTRY" "submitClaim($SIG,bytes)" "$TUPLE" "$ATT" --private-key "$USER_PRIVATE_KEY" --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "UNEXPECTED: replay succeeded"; exit 1
fi
cast call "$REGISTRY" "previewClaim($SIG,bytes)(uint8,uint256)" "$TUPLE" "$ATT" --rpc-url "$RPC_URL" | head -1 \
  | sed 's/^4$/4 = NullifierUsed (replay blocked)/'

say "8. Sponsor tops up the Nike budget with (mock) USDG"
USDG=$(j mockUSDG); ADAPTER=$(j usdgRewardAdapter); POOL=$(j rewardPool)
NIKE=$(cast format-bytes32-string NIKE)
cast send "$USDG" "approve(address,uint256)" "$ADAPTER" 100000000 --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$RPC_URL" >/dev/null
BEFORE=$(cast call "$POOL" "budgetOf(bytes32)(uint256)" "$NIKE" --rpc-url "$RPC_URL" | cut -d' ' -f1)
cast send "$ADAPTER" "fundWithUSDG(bytes32,uint256)" "$NIKE" 100000000 --private-key "$DEPLOYER_PRIVATE_KEY" --rpc-url "$RPC_URL" >/dev/null
AFTER=$(cast call "$POOL" "budgetOf(bytes32)(uint256)" "$NIKE" --rpc-url "$RPC_URL" | cut -d' ' -f1)
echo "100 mUSDG -> +$(cast from-wei $(python3 -c "print($AFTER-$BEFORE)")) mNKE budget (mock price \$0.01/unit)"

say "Done. Addresses: $D"
