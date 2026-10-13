/** JSON with bigint support (claims carry uint256 / uint128 values). */
export const stringify = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? { $bigint: x.toString() } : x));
export const parse = (s: string) =>
  JSON.parse(s, (_, x) => (x && typeof x === "object" && typeof x.$bigint === "string" ? BigInt(x.$bigint) : x));
