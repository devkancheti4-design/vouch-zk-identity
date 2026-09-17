/**
 * Shamir secret sharing over the BN254 scalar field, for the holder's secret.
 *
 * The wallet backup is one file holding the whole identity: lose it and the credential is
 * unrecoverable, copy it and you ARE that person. Both problems are the same problem — the
 * secret exists in exactly one place at a time.
 *
 * Sharding replaces that with n shards of which any k reconstruct. Hold them apart — a phone,
 * a laptop, a friend, a safe — and losing one costs nothing while stealing one gains nothing.
 * Fewer than k shards reveal NOTHING about the secret: not a bit, not a range. That is the
 * information-theoretic guarantee of Shamir's construction, and it is why this beats splitting
 * a file into n chunks, where every chunk leaks its own bytes.
 *
 * Arithmetic is mod r, the BN254 scalar field order, so the reconstructed value is always a
 * valid field element the circuit can consume.
 */

/** the BN254 scalar field order — the field circom's signals live in */
export const R = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const mod = (a: bigint) => ((a % R) + R) % R;

/** modular inverse by Fermat: a^(r-2) mod r, since r is prime */
function inv(a: bigint): bigint {
  let result = 1n, base = mod(a), e = R - 2n;
  while (e > 0n) {
    if (e & 1n) result = mod(result * base);
    base = mod(base * base);
    e >>= 1n;
  }
  return result;
}

function randomFieldElement(): bigint {
  // rejection-sample so every element is equally likely; a plain mod would bias the low end
  for (;;) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    let v = 0n;
    for (const b of bytes) v = (v << 8n) | BigInt(b);
    v >>= 3n;                       // 253 bits, comfortably inside r
    if (v < R && v > 0n) return v;
  }
}

export interface Shard {
  /** 1-based x coordinate; never 0, which is the secret itself */
  x: number;
  y: string;
  k: number;
  n: number;
  /** so a holder can tell shards of different secrets apart without revealing either */
  setId: string;
}

/**
 * Split `secret` into `n` shards, any `k` of which reconstruct it.
 * Fewer than k are independent of the secret.
 */
export function split(secret: bigint, k: number, n: number): Shard[] {
  if (k < 2 || k > n) throw new Error("need 2 <= k <= n");
  if (n > 255) throw new Error("n must be at most 255");
  if (secret <= 0n || secret >= R) throw new Error("secret must be a non-zero field element");

  // f(0) = secret; the other coefficients are random, which is what hides it
  const coeffs = [mod(secret), ...Array.from({ length: k - 1 }, randomFieldElement)];
  const setId = randomFieldElement().toString(16).slice(0, 12);

  const out: Shard[] = [];
  for (let x = 1; x <= n; x++) {
    let y = 0n, xp = 1n;
    for (const c of coeffs) { y = mod(y + c * xp); xp = mod(xp * BigInt(x)); }
    out.push({ x, y: y.toString(), k, n, setId });
  }
  return out;
}

/** Reconstruct via Lagrange interpolation at x = 0. Needs at least k distinct shards. */
export function combine(shards: Shard[]): bigint {
  if (shards.length === 0) throw new Error("no shards");
  const k = shards[0].k;
  const seen = new Map<number, Shard>();
  for (const s of shards) {
    if (s.setId !== shards[0].setId) throw new Error("these shards belong to different secrets");
    seen.set(s.x, s);                       // duplicates of one x add no information
  }
  const use = [...seen.values()];
  if (use.length < k) throw new Error(`need ${k} distinct shards, have ${use.length}`);

  let secret = 0n;
  for (let i = 0; i < k; i++) {
    let num = 1n, den = 1n;
    for (let j = 0; j < k; j++) {
      if (i === j) continue;
      num = mod(num * BigInt(-use[j].x));
      den = mod(den * BigInt(use[i].x - use[j].x));
    }
    secret = mod(secret + mod(BigInt(use[i].y) * mod(num * inv(den))));
  }
  return secret;
}

/** One shard as a file the holder can move: small, self-describing, useless alone. */
export function shardFile(s: Shard, label?: string) {
  return {
    filename: `vouch-shard-${s.setId}-${s.x}of${s.n}.json`,
    json: JSON.stringify({ vouch: "shard", ...s, label, needs: `${s.k} of ${s.n}` }, null, 2),
  };
}

export function parseShard(json: string): Shard {
  const o = JSON.parse(json);
  if (o?.vouch !== "shard" || typeof o.y !== "string" || typeof o.x !== "number")
    throw new Error("not a VOUCH shard");
  return { x: o.x, y: o.y, k: o.k, n: o.n, setId: o.setId };
}
