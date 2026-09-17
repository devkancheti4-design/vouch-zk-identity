/**
 * Does decentralising the issuer actually work, and does it actually hide who vouched for you?
 */
import { strict as a } from "node:assert";
import test, { after } from "node:test";
import { buildEddsa, buildPoseidon } from "circomlibjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as snarkjs from "snarkjs";

const WASM = "build/vouch_shard_js/vouch_shard.wasm";
const ZKEY = "build/shard_final.zkey";
const VK = JSON.parse(readFileSync("build/shard_vk.json", "utf8"));
const DEPTH = 8;

const eddsa = await buildEddsa(), poseidon = await buildPoseidon(), F = poseidon.F;
const key = (label) => {
  const priv = createHash("sha256").update(label).digest();
  const pub = eddsa.prv2pub(priv);
  return { label, priv, x: F.toObject(pub[0]), y: F.toObject(pub[1]) };
};

// an accreditation body publishes a set of licensed issuers
const ACCREDITED = ["Demo KYC Provider", "Barclays", "Deutsche Bank", "HDFC", "Chase"].map(key);
const ROGUE = key("Totally Legit Verifications Ltd");

const H2 = (l, r) => F.toObject(poseidon([l, r]));
const leafOf = (k) => H2(k.x, k.y);

/** build a depth-8 Merkle tree over the accredited issuers, padding with zeros */
function buildTree(keys) {
  let level = keys.map(leafOf);
  const size = 1 << DEPTH;
  while (level.length < size) level.push(0n);
  const levels = [level];
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(H2(level[i], level[i + 1]));
    levels.push(next); level = next;
  }
  return { root: level[0], levels };
}

function pathFor(tree, index) {
  const pathElements = [], pathIndices = [];
  let idx = index;
  for (let d = 0; d < DEPTH; d++) {
    const sibling = idx ^ 1;
    pathElements.push(tree.levels[d][sibling].toString());
    pathIndices.push((idx & 1).toString());   // 1 = we are the RIGHT child
    idx >>= 1;
  }
  return { pathElements, pathIndices };
}

const TREE = buildTree(ACCREDITED);

function inputFor(issuer, index, tree = TREE, secret = 511634828180051440175120251711n) {
  const attrs = { dobDays: 7318, balance: 250000, countryCode: 826, flags: 1, expiresAt: 21500 };
  const subject = F.toObject(poseidon([secret]));
  const msg = poseidon([subject, ...[attrs.dobDays, attrs.balance, attrs.countryCode, attrs.flags, attrs.expiresAt].map(BigInt)]);
  const sig = eddsa.signPoseidon(issuer.priv, msg);
  const p = pathFor(tree, index);
  return {
    issuerSetRoot: tree.root.toString(),
    nowDays: "20714", minAgeDays: "6570", minBalance: "10000",
    requireAge: "1", requireBalance: "1", requireAccredited: "1", contextId: "1",
    issuerPubX: issuer.x.toString(), issuerPubY: issuer.y.toString(),
    issuerPath: p.pathElements, issuerIndices: p.pathIndices,
    holderSecret: secret.toString(),
    dobDays: String(attrs.dobDays), balance: String(attrs.balance),
    countryCode: String(attrs.countryCode), flags: String(attrs.flags), expiresAt: String(attrs.expiresAt),
    sigR8x: F.toObject(sig.R8[0]).toString(), sigR8y: F.toObject(sig.R8[1]).toString(), sigS: sig.S.toString(),
  };
}

test("a credential from ANY accredited issuer proves", async () => {
  for (let i = 0; i < ACCREDITED.length; i++) {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputFor(ACCREDITED[i], i), WASM, ZKEY);
    a.equal(await snarkjs.groth16.verify(VK, publicSignals, proof), true, `${ACCREDITED[i].label} failed`);
  }
});

test("the verifier CANNOT tell which issuer vouched — that is the new part", async () => {
  const outs = [];
  for (let i = 0; i < 3; i++) {
    const { publicSignals } = await snarkjs.groth16.fullProve(inputFor(ACCREDITED[i], i), WASM, ZKEY);
    outs.push(publicSignals.join("|"));
  }
  a.equal(new Set(outs).size, 1,
    "three different banks signed, and the public output is byte-identical");
  // and no public signal equals any issuer's key
  const { publicSignals } = await snarkjs.groth16.fullProve(inputFor(ACCREDITED[1], 1), WASM, ZKEY);
  for (const k of ACCREDITED) {
    a.equal(publicSignals.includes(k.x.toString()), false, `${k.label} pubX leaked`);
    a.equal(publicSignals.includes(k.y.toString()), false, `${k.label} pubY leaked`);
  }
  a.equal(publicSignals.length, 9, "nullifier + 8 public inputs (was 10)");
});

test("an issuer OUTSIDE the accredited set cannot prove, even with a valid signature", async () => {
  // the rogue signs a perfectly valid credential, and claims slot 0's path
  const bad = inputFor(ROGUE, 0);
  await a.rejects(() => snarkjs.groth16.fullProve(bad, WASM, ZKEY),
    "a non-accredited issuer must fail the set-membership check");
});

test("removing an issuer from the set revokes everything they signed", async () => {
  const reduced = buildTree(ACCREDITED.filter((k) => k.label !== "HDFC"));
  a.notEqual(reduced.root.toString(), TREE.root.toString(), "the published root moves");
  // HDFC's old credential, against the new root, with its old path
  const hdfcIdx = ACCREDITED.findIndex((k) => k.label === "HDFC");
  const stale = { ...inputFor(ACCREDITED[hdfcIdx], hdfcIdx), issuerSetRoot: reduced.root.toString() };
  await a.rejects(() => snarkjs.groth16.fullProve(stale, WASM, ZKEY),
    "a de-accredited issuer's credentials stop proving against the new root");
});

test("the set root IS public, so a verifier pins which accreditation body it trusts", async () => {
  const { publicSignals } = await snarkjs.groth16.fullProve(inputFor(ACCREDITED[0], 0), WASM, ZKEY);
  a.ok(publicSignals.includes(TREE.root.toString()), "the root is visible and pinnable");
});

after(async () => {
  const c = globalThis.curve_bn128;
  if (c && typeof c.terminate === "function") await c.terminate();
});
