/**
 * VOUCH in the browser: issue a credential, and prove a claim about it without revealing it.
 * The same Poseidon and EdDSA primitives the circuit uses, so what the issuer signs here is
 * exactly what the circuit verifies.
 */
import { buildEddsa, buildPoseidon } from "circomlibjs";

export interface Attributes {
  dobDays: number;
  balance: number;
  countryCode: number;
  flags: number;
  expiresAt: number;
}
export interface Credential extends Attributes {
  subject: string;
  msg: string;
  sigR8x: string;
  sigR8y: string;
  sigS: string;
  issuerName: string;
}
export interface IssuerKey { name: string; priv: Uint8Array; x: string; y: string }
export interface Policy {
  policyId: number;
  name: string;
  nowDays: number;
  minAgeDays: number;
  minBalance: number;
  requireAge: boolean;
  requireBalance: boolean;
  requireAccredited: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
let _eddsa: any, _poseidon: any;
export async function primitives() {
  if (!_eddsa) _eddsa = await buildEddsa();
  if (!_poseidon) _poseidon = await buildPoseidon();
  return { eddsa: _eddsa, poseidon: _poseidon, F: _poseidon.F };
}

/** a deterministic key from a label, so the demo is reproducible and the issuer is namable */
export async function issuerFromLabel(name: string): Promise<IssuerKey> {
  const bytes = new TextEncoder().encode(name);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const { eddsa, F } = await primitives();
  const [Ax, Ay] = eddsa.prv2pub(digest);
  return { name, priv: digest, x: F.toObject(Ax).toString(), y: F.toObject(Ay).toString() };
}

export const toDays = (iso: string) => Math.floor(new Date(iso).getTime() / 86400000);
export const today = () => Math.floor(Date.now() / 86400000);
export const fromDays = (d: number) => new Date(d * 86400000).toISOString().slice(0, 10);

export async function subjectOf(holderSecret: bigint): Promise<string> {
  const { poseidon, F } = await primitives();
  return F.toObject(poseidon([holderSecret])).toString();
}

/** the issuer signs once, off-chain. Everything here stays with the holder. */
export async function issue(issuer: IssuerKey, holderSecret: bigint, attrs: Attributes): Promise<Credential> {
  const { eddsa, poseidon, F } = await primitives();
  const subject = BigInt(await subjectOf(holderSecret));
  const msg = poseidon([subject, BigInt(attrs.dobDays), BigInt(attrs.balance), BigInt(attrs.countryCode), BigInt(attrs.flags), BigInt(attrs.expiresAt)]);
  const sig = eddsa.signPoseidon(issuer.priv, msg);
  return {
    ...attrs,
    issuerName: issuer.name,
    subject: subject.toString(),
    msg: F.toObject(msg).toString(),
    sigR8x: F.toObject(sig.R8[0]).toString(),
    sigR8y: F.toObject(sig.R8[1]).toString(),
    sigS: sig.S.toString(),
  };
}

export const PUBLIC_SIGNAL_NAMES = [
  "nullifier", "issuerPubX", "issuerPubY", "nowDays",
  "minAgeDays", "minBalance", "requireAge", "requireBalance", "requireAccredited", "contextId",
] as const;

export function witnessInput(cred: Credential, holderSecret: bigint, issuer: IssuerKey, policy: Policy) {
  return {
    issuerPubX: issuer.x,
    issuerPubY: issuer.y,
    nowDays: String(policy.nowDays),
    minAgeDays: String(policy.minAgeDays),
    minBalance: String(policy.minBalance),
    requireAge: policy.requireAge ? "1" : "0",
    requireBalance: policy.requireBalance ? "1" : "0",
    requireAccredited: policy.requireAccredited ? "1" : "0",
    contextId: String(policy.policyId),
    holderSecret: String(holderSecret),
    dobDays: String(cred.dobDays),
    balance: String(cred.balance),
    countryCode: String(cred.countryCode),
    flags: String(cred.flags),
    expiresAt: String(cred.expiresAt),
    sigR8x: cred.sigR8x,
    sigR8y: cred.sigR8y,
    sigS: cred.sigS,
  };
}

export interface SnarkProof { pi_a: string[]; pi_b: string[][]; pi_c: string[] }
/** the circuit emits exactly ten public signals, in the order PUBLIC_SIGNAL_NAMES lists */
export type PublicSignals = readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];
export interface ProofBundle {
  proof: SnarkProof;
  publicSignals: string[];
  ms: number;
  localOk: boolean;
  calldata: { a: [bigint, bigint]; b: [[bigint, bigint], [bigint, bigint]]; c: [bigint, bigint]; pub: PublicSignals };
}

function snark(): any {
  const s = (window as any).snarkjs;
  if (!s) throw new Error("snarkjs did not load (check /circuit/snarkjs.min.js)");
  return s;
}

/** prove, in this browser, that the credential satisfies the policy */
export async function proveClaim(cred: Credential, holderSecret: bigint, issuer: IssuerKey, policy: Policy): Promise<ProofBundle> {
  const s = snark();
  const input = witnessInput(cred, holderSecret, issuer, policy);
  const t0 = performance.now();
  const { proof, publicSignals } = await s.groth16.fullProve(input, "/circuit/vouch.wasm", "/circuit/vouch_final.zkey");
  const ms = performance.now() - t0;
  const vk = await fetch("/circuit/verification_key.json").then((r) => r.json());
  const localOk = await s.groth16.verify(vk, publicSignals, proof);
  const raw = await s.groth16.exportSolidityCallData(proof, publicSignals);
  const [a, b, c, pub] = JSON.parse("[" + raw + "]") as [string[], string[][], string[], string[]];
  return {
    proof, publicSignals, ms, localOk,
    calldata: {
      a: [BigInt(a[0]), BigInt(a[1])],
      b: [[BigInt(b[0][0]), BigInt(b[0][1])], [BigInt(b[1][0]), BigInt(b[1][1])]],
      c: [BigInt(c[0]), BigInt(c[1])],
      pub: pub.map((x) => BigInt(x)) as unknown as PublicSignals,
    },
  };
}
