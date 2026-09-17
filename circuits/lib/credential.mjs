/**
 * VOUCH — issuing credentials and proving claims about them.
 *
 * The issuer signs a credential once with EdDSA over BabyJubJub. Every attribute stays with the
 * holder and never travels: not to the verifier, not on-chain, not into the proof's public
 * signals. This module is shared by the CLI, the tests and the browser.
 */
import { buildEddsa, buildPoseidon } from "circomlibjs";
import { createHash } from "node:crypto";

let _eddsa, _poseidon;
export async function crypto() {
  if (!_eddsa) _eddsa = await buildEddsa();
  if (!_poseidon) _poseidon = await buildPoseidon();
  return { eddsa: _eddsa, poseidon: _poseidon, F: _poseidon.F };
}

/** a deterministic 32-byte key from a human label, so demos are reproducible */
export const keyFromLabel = (label) => createHash("sha256").update(String(label)).digest();

/** the issuer's public key as two decimal strings, which is what the circuit and chain see */
export async function issuerPublicKey(privKey) {
  const { eddsa, F } = await crypto();
  const [Ax, Ay] = eddsa.prv2pub(privKey);
  return { x: F.toObject(Ax).toString(), y: F.toObject(Ay).toString() };
}

/** Poseidon(holderSecret) — the credential is bound to whoever knows that secret */
export async function subjectOf(holderSecret) {
  const { poseidon, F } = await crypto();
  return F.toObject(poseidon([BigInt(holderSecret)]));
}

/** days since the unix epoch, the unit the circuit compares in */
export const toDays = (date) => Math.floor(new Date(date).getTime() / 86400000);
export const today = () => Math.floor(Date.now() / 86400000);

/**
 * Sign a credential. `attrs` are the holder's private facts.
 * Returns everything the holder must keep, and nothing anyone else needs.
 */
export async function issue(privKey, holderSecret, attrs) {
  const { eddsa, poseidon, F } = await crypto();
  const subject = await subjectOf(holderSecret);
  const fields = [
    subject,
    BigInt(attrs.dobDays),
    BigInt(attrs.balance),
    BigInt(attrs.countryCode),
    BigInt(attrs.flags),
    BigInt(attrs.expiresAt),
  ];
  const msg = poseidon(fields);
  const sig = eddsa.signPoseidon(privKey, msg);
  const pub = eddsa.prv2pub(privKey);
  if (!eddsa.verifyPoseidon(msg, sig, pub)) throw new Error("issuer produced an invalid signature");
  return {
    ...attrs,
    subject: subject.toString(),
    msg: F.toObject(msg).toString(),
    sigR8x: F.toObject(sig.R8[0]).toString(),
    sigR8y: F.toObject(sig.R8[1]).toString(),
    sigS: sig.S.toString(),
  };
}

/**
 * Build the circuit input for one claim.
 * `policy` says WHAT is being proven; it is public. The credential is private.
 */
export async function witnessInput(credential, holderSecret, issuerPub, policy) {
  return {
    // public — the policy and the context, never the data
    issuerPubX: issuerPub.x,
    issuerPubY: issuerPub.y,
    nowDays: String(policy.nowDays),
    minAgeDays: String(policy.minAgeDays ?? 0),
    minBalance: String(policy.minBalance ?? 0),
    requireAge: policy.requireAge ? "1" : "0",
    requireBalance: policy.requireBalance ? "1" : "0",
    requireAccredited: policy.requireAccredited ? "1" : "0",
    contextId: String(policy.contextId),
    // private — never leaves the holder
    holderSecret: String(holderSecret),
    dobDays: String(credential.dobDays),
    balance: String(credential.balance),
    countryCode: String(credential.countryCode),
    flags: String(credential.flags),
    expiresAt: String(credential.expiresAt),
    sigR8x: credential.sigR8x,
    sigR8y: credential.sigR8y,
    sigS: credential.sigS,
  };
}

/** the names of the public signals, in the order snarkjs emits them */
export const PUBLIC_SIGNAL_NAMES = [
  "nullifier",
  "issuerPubX",
  "issuerPubY",
  "nowDays",
  "minAgeDays",
  "minBalance",
  "requireAge",
  "requireBalance",
  "requireAccredited",
  "contextId",
];

/** the private inputs, named — used by the leak audit to search the public signals for them */
export const PRIVATE_INPUT_NAMES = [
  "holderSecret", "dobDays", "balance", "countryCode", "flags", "expiresAt",
  "sigR8x", "sigR8y", "sigS",
];
