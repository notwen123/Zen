// node --test lib/merchant-receipt.test.mjs
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { issueMerchantReceipt, merchantPublicKey, verifyMerchantReceipt } from "./merchant-pos.mjs";
import { canonicalMessage, decodeSignedReceipt, encodeSignedReceipt } from "./merchant-receipt.mjs";

const SEED = randomBytes(32).toString("hex");
const OTHER_SEED = randomBytes(32).toString("hex");
const NOW = 1_790_000_000;
const opts = { trustedKeys: [merchantPublicKey(SEED)], supportedBrands: ["NIKE", "AAPL", "SBUX"], now: NOW };
const issue = (over = {}, seed = SEED, now = NOW) =>
  issueMerchantReceipt(seed, { merchantId: "DEMO-POS-NIKE-001", merchantName: "Nike Store 042, Mumbai", brand: "NIKE", amount: "200000", ...over }, now);

/** Re-encode a payload with one field changed but the ORIGINAL signature. */
function tamper(payload, field, value) {
  const { receipt, signature } = decodeSignedReceipt(payload);
  return encodeSignedReceipt({ ...receipt, [field]: value }, signature);
}
const code = (fn) => {
  try {
    fn();
    return "ok";
  } catch (e) {
    return e.code ?? e.message;
  }
};

test("valid merchant signature verifies and returns every signed field", () => {
  const { payload, receipt } = issue();
  assert.deepEqual(verifyMerchantReceipt(payload, opts), receipt);
  assert.equal(receipt.amount, "200000");
  assert.equal(receipt.brand, "NIKE");
});

test("payload inside a deep link (#r= and ?r=) verifies", () => {
  const { payload } = issue();
  assert.equal(code(() => verifyMerchantReceipt(`https://x.app/app/scan#r=${encodeURIComponent(payload)}`, opts)), "ok");
  assert.equal(code(() => verifyMerchantReceipt(`https://x.app/app/scan?r=${payload}`, opts)), "ok");
});

for (const [field, value] of [
  ["amount", "9900000"],
  ["brand", "AAPL"],
  ["receiptId", "R-FORGED-0000000000000000"],
  ["issuedAt", String(NOW - 10)],
  ["expiresAt", String(NOW + 7 * 86400)],
  ["merchantId", "DEMO-POS-NIKE-999"],
  ["merchantName", "Somewhere Else"],
  ["currency", "USD"],
]) {
  test(`tampered ${field} is rejected (bad_signature)`, () => {
    assert.equal(code(() => verifyMerchantReceipt(tamper(issue().payload, field, value), opts)), "bad_signature");
  });
}

test("garbage signature is rejected", () => {
  const { receipt } = issue();
  assert.equal(code(() => verifyMerchantReceipt(encodeSignedReceipt(receipt, randomBytes(64)), opts)), "bad_signature");
});

test("receipt signed by a different (untrusted) key is rejected", () => {
  assert.equal(code(() => verifyMerchantReceipt(issue({}, OTHER_SEED).payload, opts)), "bad_signature");
});

test("expired receipt is rejected", () => {
  const { payload } = issue({ validForSeconds: 600 }, SEED, NOW - 3600);
  assert.equal(code(() => verifyMerchantReceipt(payload, opts)), "expired");
});

test("receipt issued in the future (beyond clock skew) is rejected", () => {
  assert.equal(code(() => verifyMerchantReceipt(issue({}, SEED, NOW + 3600).payload, opts)), "not_yet_valid");
});

test("validly signed receipt for an unsupported brand is rejected", () => {
  assert.equal(code(() => verifyMerchantReceipt(issue({ brand: "TSLA" }).payload, opts)), "unsupported_brand");
});

test("malformed payloads are rejected before any crypto", () => {
  const { payload } = issue();
  const [p, body, sig] = payload.split(".");
  for (const bad of ["", "hello", `${p}.${body}`, `SBR9.${body}.${sig}`, `${p}.!!!.${sig}`, `${p}.${body}.${sig.slice(4)}`, "x".repeat(5000)]) {
    assert.equal(code(() => verifyMerchantReceipt(bad, opts)), "malformed", bad.slice(0, 20));
  }
});

test("fields cannot inject lines into the signed message", () => {
  const { receipt } = issue();
  assert.throws(() => canonicalMessage({ ...receipt, merchantName: "Nike\namount=1" }), { code: "malformed" });
  assert.throws(() => canonicalMessage({ ...receipt, extra: "1" }), { code: "malformed" });
});

test("non-positive or decimal amounts are malformed", () => {
  for (const amount of ["0", "-5", "10.5", "007"]) {
    assert.throws(() => issue({ amount }), { code: "malformed" }, amount);
  }
});

test("no trusted keys configured fails closed", () => {
  assert.throws(() => verifyMerchantReceipt(issue().payload, { ...opts, trustedKeys: [] }));
});

test("payload never contains the private seed", () => {
  const { payload } = issue();
  assert.ok(!payload.includes(SEED) && !Buffer.from(payload).toString("hex").includes(SEED));
});
