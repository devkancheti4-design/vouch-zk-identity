/**
 * Does revocation actually revoke? Builds a real sparse Merkle tree of revoked credential ids,
 * proves exclusion for a good credential, and proves that a revoked one CANNOT produce a proof.
 */
import { strict as a } from "node:assert";
import test, { after } from "node:test";
import { buildEddsa, buildPoseidon, newMemEmptyTrie } from "circomlibjs";
import { createHash } from "node:crypto";
import * as snarkjs from "snarkjs";

const WASM = "build/vouch_rev_js/vouch_rev.wasm";
const ZKEY = "build/rev_final.zkey";
const VK = JSON.parse(await import("node:fs").then(fs => fs.readFileSync("build/rev_vk.json", "utf8")));
const LEVELS = 20;

const priv = createHash("sha256").update("Demo KYC Provider").digest();
const eddsa = await buildEddsa(), poseidon = await buildPoseidon(), F = poseidon.F;
const pub = eddsa.prv2pub(priv);

// the issuer's revocation tree: three credentials revoked for fraud
const tree = await newMemEmptyTrie();
const REVOKED = [1001n, 2002n, 3003n];
for (const id of REVOKED) await tree.insert(id, 1n);
const root = F.toObject(tree.root).toString();

async function exclusionProof(credentialId) {
  const res = await tree.find(credentialId);
  const sib = res.siblings.map(s => F.toObject(s).toString());
  while (sib.length < LEVELS) sib.push("0");
  return {
    revSiblings: sib,
    revOldKey: res.isOld0 ? "0" : F.toObject(res.notFoundKey ?? res.foundKey).toString(),
    revOldValue: res.isOld0 ? "0" : F.toObject(res.notFoundValue ?? res.foundValue ?? 0n).toString(),
    revIsOld0: res.isOld0 ? "1" : "0",
    found: res.found,
  };
}

async function buildInput(credentialId, secret = 511634828180051440175120251711n) {
  const attrs = { dobDays: 7318, balance: 250000, countryCode: 826, flags: 0, expiresAt: 21079 };
  const subject = F.toObject(poseidon([secret]));
  const msg = poseidon([subject, ...[attrs.dobDays, attrs.balance, attrs.countryCode, attrs.flags, attrs.expiresAt, credentialId].map(BigInt)]);
  const sig = eddsa.signPoseidon(priv, msg);
  const ex = await exclusionProof(credentialId);
  return {
    input: {
      issuerPubX: F.toObject(pub[0]).toString(), issuerPubY: F.toObject(pub[1]).toString(),
      nowDays: "20714", minAgeDays: "6575", minBalance: "10000",
      requireAge: "1", requireBalance: "0", requireAccredited: "0", contextId: "1",
      revocationRoot: root,
      holderSecret: secret.toString(),
      dobDays: String(attrs.dobDays), balance: String(attrs.balance),
      countryCode: String(attrs.countryCode), flags: String(attrs.flags), expiresAt: String(attrs.expiresAt),
      sigR8x: F.toObject(sig.R8[0]).toString(), sigR8y: F.toObject(sig.R8[1]).toString(), sigS: sig.S.toString(),
      credentialId: credentialId.toString(),
      revSiblings: ex.revSiblings, revOldKey: ex.revOldKey, revOldValue: ex.revOldValue, revIsOld0: ex.revIsOld0,
    },
    found: ex.found,
  };
}

test("a credential that is NOT revoked still proves, and verifies", async () => {
  const { input } = await buildInput(7777n);
  const t0 = performance.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  const ms = performance.now() - t0;
  a.equal(await snarkjs.groth16.verify(VK, publicSignals, proof), true);
  a.equal(publicSignals.length, 11, "nullifier + 10 public inputs");
  console.log(`      proving with revocation: ${ms.toFixed(0)} ms`);
});

test("the revocation root is PUBLIC, so a verifier can pin it to the issuer's latest", async () => {
  const { input } = await buildInput(7777n);
  const { publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  a.ok(publicSignals.includes(root), "the root the holder proved against is visible to the verifier");
});

test("a REVOKED credential cannot produce a proof at all", async () => {
  const { input, found } = await buildInput(2002n);   // on the revocation list
  a.equal(found, true, "the trie confirms 2002 IS revoked");
  await a.rejects(
    () => snarkjs.groth16.fullProve(input, WASM, ZKEY),
    "a revoked holder must be unable to satisfy the exclusion constraint",
  );
});

test("revoking someone changes the root, so their old proof no longer matches", async () => {
  const before = F.toObject(tree.root).toString();
  await tree.insert(4004n, 1n);
  const afterRoot = F.toObject(tree.root).toString();
  a.notEqual(before, afterRoot, "the published root moves when anyone is revoked");
  await tree.delete(4004n);   // restore for other tests
});

after(async () => {
  const c = globalThis.curve_bn128;
  if (c && typeof c.terminate === "function") await c.terminate();
});
