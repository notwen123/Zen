// node web/lib/receipt-parse.test.mjs   (Node >= 22.6 strips TS types natively)
import assert from "node:assert/strict";
import { parseReceipt } from "./receipt-parse.ts";

const nike = parseReceipt(`NIKE
NIKE STORE
BANDRA KURLA COMPLEX
MUMBAI, INDIA
28 SEP 2026
DATE 14:32
ITEMS 1
SUBTOTAL 1,900.00
TOTAL ₹2,000.00
INVOICE NO: BKC-004512`);
assert.deepEqual(nike, { brand: "NIKE", merchant: "NIKE STORE", amount: "2000", date: "2026-09-28", receiptRef: "BKC-004512" });

const apple = parseReceipt(`Apple Store BKC\niPhone 17 case\nDate: 21/09/2026\nGrand Total Rs. 14,990.50\nOrder # W12345678`);
assert.equal(apple.brand, "AAPL");
assert.equal(apple.amount, "14990.50");
assert.equal(apple.date, "2026-09-21");
assert.equal(apple.receiptRef, "W12345678");

const coffee = parseReceipt(`STARBUCKS\nLatte  INR 350\nCookie INR 120\n2026-09-29`);
assert.equal(coffee.brand, "SBUX");
assert.equal(coffee.amount, "350"); // no TOTAL line: largest currency amount
assert.equal(coffee.date, "2026-09-29");

assert.deepEqual(parseReceipt("unreadable"), {});
console.log("receipt-parse: all checks passed");
