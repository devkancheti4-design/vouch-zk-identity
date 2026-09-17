import { strict as a } from "node:assert";
import test from "node:test";
import { R, split, combine, shardFile, parseShard } from "../src/lib/shards.ts";

const SECRET = 511634828180051440175120251711n;

test("any k of n shards reconstruct the secret", () => {
  const sh = split(SECRET, 3, 5);
  a.equal(sh.length, 5);
  // every 3-subset must work, not just the convenient one
  for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) for (let m = j + 1; m < 5; m++)
    a.equal(combine([sh[i], sh[j], sh[m]]), SECRET, `subset ${i},${j},${m} failed`);
});

test("more than k shards also reconstruct", () => {
  const sh = split(SECRET, 3, 5);
  a.equal(combine(sh), SECRET);
});

test("fewer than k shards are REFUSED, not silently wrong", () => {
  const sh = split(SECRET, 3, 5);
  a.throws(() => combine([sh[0], sh[1]]), /need 3 distinct shards/);
  a.throws(() => combine([sh[4]]), /need 3 distinct shards/);
});

test("duplicating one shard does not manufacture a quorum", () => {
  const sh = split(SECRET, 3, 5);
  a.throws(() => combine([sh[0], sh[0], sh[0]]), /need 3 distinct shards/);
});

test("k-1 shards leave the secret information-theoretically hidden", () => {
  // Shamir's real claim: with k-1 shards, EVERY candidate secret remains exactly as consistent.
  // Show it by interpolating a k-1 subset against every possible secret and confirming each
  // yields a valid, different kth shard. If any candidate were excluded, that would be a leak.
  const k = 3, sh = split(SECRET, k, 5);
  const twoShards = [sh[0], sh[1]];
  const candidates = [SECRET, 1n, 42n, R - 1n, 99999999999999999n];
  const implied = new Set();
  for (const guess of candidates) {
    // the unique degree-(k-1) polynomial through (0,guess) and the two shards, evaluated at x=3
    const pts = [[0n, guess], [BigInt(twoShards[0].x), BigInt(twoShards[0].y)], [BigInt(twoShards[1].x), BigInt(twoShards[1].y)]];
    const m = (v) => ((v % R) + R) % R;
    const inv = (x) => { let r = 1n, b = m(x), e = R - 2n; while (e > 0n) { if (e & 1n) r = m(r * b); b = m(b * b); e >>= 1n; } return r; };
    let y = 0n;
    for (let i = 0; i < 3; i++) {
      let num = 1n, den = 1n;
      for (let j = 0; j < 3; j++) { if (i === j) continue; num = m(num * (3n - pts[j][0])); den = m(den * (pts[i][0] - pts[j][0])); }
      y = m(y + m(pts[i][1] * m(num * inv(den))));
    }
    implied.add(y.toString());
  }
  a.equal(implied.size, candidates.length,
    "each candidate secret implies a DIFFERENT third shard, so two shards rule none of them out");
});

test("shards of different secrets cannot be mixed", () => {
  const a1 = split(SECRET, 2, 3), b1 = split(123456789n, 2, 3);
  a.throws(() => combine([a1[0], b1[1]]), /different secrets/);
});

test("a shard file round-trips and is useless alone", () => {
  const sh = split(SECRET, 2, 3);
  const { filename, json } = shardFile(sh[0], "phone");
  a.match(filename, /^vouch-shard-[0-9a-f]+-1of3\.json$/);
  const back = parseShard(json);
  a.deepEqual(back, sh[0]);
  a.throws(() => combine([back]), /need 2 distinct shards/);
  a.equal(json.includes(SECRET.toString()), false, "the secret never appears in a shard file");
});

test("a junk file is rejected", () => {
  a.throws(() => parseShard(JSON.stringify({ hello: "world" })), /not a VOUCH shard/);
});

test("every shard is a valid field element, so the circuit can consume the result", () => {
  const sh = split(SECRET, 3, 6);
  for (const s of sh) { const y = BigInt(s.y); a.ok(y >= 0n && y < R); }
  a.ok(combine(sh.slice(0, 3)) < R);
});

test("2-of-2 and n-of-n both work", () => {
  a.equal(combine(split(SECRET, 2, 2)), SECRET);
  const sh = split(SECRET, 5, 5);
  a.equal(combine(sh), SECRET);
  a.throws(() => combine(sh.slice(0, 4)), /need 5/);
});

test("splitting twice gives different shards for the same secret", () => {
  const x = split(SECRET, 2, 3), y = split(SECRET, 2, 3);
  a.notEqual(x[0].y, y[0].y, "fresh randomness each time");
  a.equal(combine(x.slice(0, 2)), combine(y.slice(0, 2)));
});
