/**
 * The zero-knowledge audit. Every assertion here runs against REAL Groth16 proofs produced by
 * the compiled circuit, not against a model of it.
 */
import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import * as snarkjs from "snarkjs";
import fs from "node:fs";
import {
  issue, issuerPublicKey, keyFromLabel, subjectOf, toDays, today, witnessInput,
  PUBLIC_SIGNAL_NAMES, PRIVATE_INPUT_NAMES,
} from "../lib/credential.mjs";

const WASM = "build/vouch_js/vouch.wasm";
const ZKEY = "build/vouch_final.zkey";
const VK = JSON.parse(fs.readFileSync("build/verification_key.json"));

const prove = (input) => snarkjs.groth16.fullProve(input, WASM, ZKEY);
const verify = (pub, proof) => snarkjs.groth16.verify(VK, pub, proof);
const rejects = async (input, why) => {
  await assert.rejects(() => prove(input), why ?? /./);
};

let issuerKey, issuerPub, rogueKey, roguePub, NOW;
const POLICY = () => ({ nowDays: NOW, minAgeDays: 18 * 365, minBalance: 10000, requireAge: 1, requireBalance: 1, requireAccredited: 1, contextId: 42 });

// two people whose private facts differ in every field
const ALICE = { secret: 111111111111111111111n, attrs: () => ({ dobDays: toDays("1990-01-15"), balance: 250000, countryCode: 826, flags: 1, expiresAt: NOW + 365 }) };
const BOB = { secret: 999999999999999999999n, attrs: () => ({ dobDays: toDays("2000-06-30"), balance: 12345, countryCode: 276, flags: 1, expiresAt: NOW + 30 }) };

before(async () => {
  issuerKey = keyFromLabel("Demo KYC Provider");
  issuerPub = await issuerPublicKey(issuerKey);
  rogueKey = keyFromLabel("A Rogue Issuer");
  roguePub = await issuerPublicKey(rogueKey);
  NOW = today();
});

describe("1 — a proof can be made, and it verifies", () => {
  test("an eligible holder proves age, solvency and accreditation at once", async () => {
    const cred = await issue(issuerKey, ALICE.secret, ALICE.attrs());
    const { proof, publicSignals } = await prove(await witnessInput(cred, ALICE.secret, issuerPub, POLICY()));
    assert.equal(await verify(publicSignals, proof), true);
    assert.equal(publicSignals.length, 10);
  });
});

describe("2 — ZERO PRIVATE DATA IN THE PUBLIC SIGNALS", () => {
  // The strongest statement of "nothing leaks" is an information-flow one: if a private input
  // could be recovered from the public signals, then changing that input would have to change
  // some public signal. So we change ONE private field at a time, keeping everything else fixed,
  // and require the public signals to come out byte-identical.
  const varies = [
    ["dobDays", toDays("1990-01-15"), toDays("1961-03-02")],   // 35 years apart, both adults
    ["balance", 12000, 9999999],                               // 833x apart, both above threshold
    ["countryCode", 826, 276],                                 // different countries
    ["flags", 1, 3],                                           // bit 0 set in both, bit 1 differs
  ];
  for (const [field, a, b] of varies) {
    test(`changing ${field} changes NO public signal`, async () => {
      const base = ALICE.attrs();
      const policy = POLICY();
      const pa = await prove(await witnessInput(await issue(issuerKey, ALICE.secret, { ...base, [field]: a }), ALICE.secret, issuerPub, policy));
      const pb = await prove(await witnessInput(await issue(issuerKey, ALICE.secret, { ...base, [field]: b }), ALICE.secret, issuerPub, policy));
      assert.equal(await verify(pa.publicSignals, pa.proof), true);
      assert.equal(await verify(pb.publicSignals, pb.proof), true);
      assert.deepEqual(pa.publicSignals, pb.publicSignals,
        `${field} is recoverable from the public signals: ${a} and ${b} produced different output`);
    });
  }

  test("changing expiresAt changes NO public signal", async () => {
    const policy = POLICY();
    const pa = await prove(await witnessInput(await issue(issuerKey, ALICE.secret, { ...ALICE.attrs(), expiresAt: NOW + 30 }), ALICE.secret, issuerPub, policy));
    const pb = await prove(await witnessInput(await issue(issuerKey, ALICE.secret, { ...ALICE.attrs(), expiresAt: NOW + 3650 }), ALICE.secret, issuerPub, policy));
    assert.deepEqual(pa.publicSignals, pb.publicSignals, "the expiry date is recoverable");
  });

  test("no public signal equals a high-entropy private value", async () => {
    // Small values like flags=1 legitimately coincide with policy bits, so an exact-match test is
    // only meaningful for values that cannot collide by chance: the secret, the signature, and
    // the subject hash derived from the secret.
    const cred = await issue(issuerKey, ALICE.secret, ALICE.attrs());
    const input = await witnessInput(cred, ALICE.secret, issuerPub, POLICY());
    const { publicSignals } = await prove(input);
    const highEntropy = {
      holderSecret: input.holderSecret,
      sigR8x: input.sigR8x,
      sigR8y: input.sigR8y,
      sigS: input.sigS,
      subject: (await subjectOf(ALICE.secret)).toString(),
      credentialHash: cred.msg,
    };
    for (const [name, v] of Object.entries(highEntropy)) {
      for (let i = 0; i < publicSignals.length; i++) {
        assert.notEqual(publicSignals[i], v, `${name} leaked into public signal ${PUBLIC_SIGNAL_NAMES[i]}`);
      }
    }
  });

  test("the public signals are exactly the policy, the context and the nullifier — nothing else", async () => {
    const cred = await issue(issuerKey, ALICE.secret, ALICE.attrs());
    const policy = POLICY();
    const { publicSignals } = await prove(await witnessInput(cred, ALICE.secret, issuerPub, policy));
    assert.equal(publicSignals.length, 10);
    // every signal but the nullifier is a value the VERIFIER chose, so it can carry no information
    assert.equal(publicSignals[1], issuerPub.x);
    assert.equal(publicSignals[2], issuerPub.y);
    assert.equal(publicSignals[3], String(policy.nowDays));
    assert.equal(publicSignals[4], String(policy.minAgeDays));
    assert.equal(publicSignals[5], String(policy.minBalance));
    assert.equal(publicSignals[6], "1");
    assert.equal(publicSignals[7], "1");
    assert.equal(publicSignals[8], "1");
    assert.equal(publicSignals[9], String(policy.contextId));
  });

  test("two DIFFERENT people proving the SAME policy are indistinguishable but for the nullifier", async () => {
    const policy = POLICY();
    const a = await prove(await witnessInput(await issue(issuerKey, ALICE.secret, ALICE.attrs()), ALICE.secret, issuerPub, policy));
    const b = await prove(await witnessInput(await issue(issuerKey, BOB.secret, BOB.attrs()), BOB.secret, issuerPub, policy));
    assert.equal(await verify(a.publicSignals, a.proof), true);
    assert.equal(await verify(b.publicSignals, b.proof), true);
    for (let i = 1; i < a.publicSignals.length; i++) {
      assert.equal(a.publicSignals[i], b.publicSignals[i], `public signal ${PUBLIC_SIGNAL_NAMES[i]} differs between two holders`);
    }
    assert.notEqual(a.publicSignals[0], b.publicSignals[0], "nullifiers must differ");
  });

  test("the proof itself is randomised: the same statement twice gives different proofs", async () => {
    const cred = await issue(issuerKey, ALICE.secret, ALICE.attrs());
    const input = await witnessInput(cred, ALICE.secret, issuerPub, POLICY());
    const p1 = await prove(input);
    const p2 = await prove(input);
    assert.notEqual(JSON.stringify(p1.proof), JSON.stringify(p2.proof), "proofs are not randomised");
    assert.deepEqual(p1.publicSignals, p2.publicSignals, "the statement must be identical");
    assert.equal(await verify(p2.publicSignals, p2.proof), true);
  });
});

describe("3 — the nullifier: replay-detectable, and unlinkable across verifiers", () => {
  test("same holder, same context → the same nullifier (a verifier can reject a second use)", async () => {
    const cred = await issue(issuerKey, ALICE.secret, ALICE.attrs());
    const p = POLICY();
    const a = await prove(await witnessInput(cred, ALICE.secret, issuerPub, p));
    const b = await prove(await witnessInput(cred, ALICE.secret, issuerPub, p));
    assert.equal(a.publicSignals[0], b.publicSignals[0]);
  });

  test("same holder, different context → different nullifiers (two verifiers cannot collude)", async () => {
    const cred = await issue(issuerKey, ALICE.secret, ALICE.attrs());
    const a = await prove(await witnessInput(cred, ALICE.secret, issuerPub, { ...POLICY(), contextId: 42 }));
    const b = await prove(await witnessInput(cred, ALICE.secret, issuerPub, { ...POLICY(), contextId: 43 }));
    assert.notEqual(a.publicSignals[0], b.publicSignals[0]);
  });
});

describe("4 — a claim that is not true cannot be proven", () => {
  test("underage: no proof exists", async () => {
    const cred = await issue(issuerKey, BOB.secret, { ...BOB.attrs(), dobDays: toDays("2015-01-01") });
    await rejects(await witnessInput(cred, BOB.secret, issuerPub, POLICY()));
  });
  test("insufficient balance: no proof exists", async () => {
    const cred = await issue(issuerKey, BOB.secret, { ...BOB.attrs(), balance: 9999 });
    await rejects(await witnessInput(cred, BOB.secret, issuerPub, POLICY()));
  });
  test("not accredited: no proof exists", async () => {
    const cred = await issue(issuerKey, BOB.secret, { ...BOB.attrs(), flags: 0 });
    await rejects(await witnessInput(cred, BOB.secret, issuerPub, POLICY()));
  });
  test("expired credential: no proof exists", async () => {
    const cred = await issue(issuerKey, BOB.secret, { ...BOB.attrs(), expiresAt: NOW - 1 });
    await rejects(await witnessInput(cred, BOB.secret, issuerPub, POLICY()));
  });
  test("but the SAME holder can still prove a weaker policy", async () => {
    const cred = await issue(issuerKey, BOB.secret, { ...BOB.attrs(), balance: 9999 });
    const weaker = { ...POLICY(), requireBalance: 0, minBalance: 0 };
    const { proof, publicSignals } = await prove(await witnessInput(cred, BOB.secret, issuerPub, weaker));
    assert.equal(await verify(publicSignals, proof), true);
    assert.equal(publicSignals[7], "0", "the policy says balance was not checked");
  });
});

describe("5 — a credential cannot be forged, stolen or altered", () => {
  test("a rogue issuer's signature does not satisfy the real issuer's key", async () => {
    const cred = await issue(rogueKey, ALICE.secret, ALICE.attrs());
    await rejects(await witnessInput(cred, ALICE.secret, issuerPub, POLICY()));
  });
  test("a rogue issuer CAN be used if a verifier foolishly names it — the key is public and chosen by the verifier", async () => {
    const cred = await issue(rogueKey, ALICE.secret, ALICE.attrs());
    const { publicSignals } = await prove(await witnessInput(cred, ALICE.secret, roguePub, POLICY()));
    assert.equal(publicSignals[1], roguePub.x, "the issuer is in the public signals, so the verifier always knows who vouched");
  });
  test("altering an attribute after issuance invalidates the signature", async () => {
    const cred = await issue(issuerKey, BOB.secret, { ...BOB.attrs(), balance: 100 });
    const tampered = { ...cred, balance: 999999 };
    await rejects(await witnessInput(tampered, BOB.secret, issuerPub, POLICY()));
  });
  test("a stolen credential is useless without the holder's secret", async () => {
    const cred = await issue(issuerKey, ALICE.secret, ALICE.attrs());
    await rejects(await witnessInput(cred, BOB.secret, issuerPub, POLICY()));
  });
});

describe("6 — the policy is bound into the proof", () => {
  test("a proof for a weak policy does not verify against a strong one", async () => {
    const cred = await issue(issuerKey, ALICE.secret, ALICE.attrs());
    const weak = { ...POLICY(), minBalance: 1 };
    const { proof, publicSignals } = await prove(await witnessInput(cred, ALICE.secret, issuerPub, weak));
    const strong = [...publicSignals];
    strong[5] = "1000000"; // a verifier trying to read it as a stronger claim
    assert.equal(await verify(strong, proof), false);
  });
});
