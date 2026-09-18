/**
 * Shared issuer identity for the serverless functions.
 *
 * In production the signing key belongs in a KMS or HSM and this module would call out to it.
 * Here it is derived from a secret label so the deployment is reproducible and the demo is
 * honest about what it is. Set ISSUER_SECRET in the Vercel project to change it.
 */
import { createHash } from "node:crypto";
// Static, so Vercel's dependency tracer bundles it. Only /api/issue imports this module now:
// health needs nothing, and /api/issuer reads a key derived at build time, so a runtime that
// cannot load a curve no longer takes issuer discovery down with it.
import { buildEddsa, buildPoseidon } from "circomlibjs";

export const ISSUER_LABEL = process.env.ISSUER_LABEL ?? "Demo KYC Provider";
const ISSUER_SECRET = process.env.ISSUER_SECRET ?? ISSUER_LABEL;

/* eslint-disable @typescript-eslint/no-explicit-any */
let cached: { eddsa: any; poseidon: any; F: any; priv: Buffer; pub: { x: string; y: string } } | undefined;

export async function issuer() {
  if (cached) return cached;
  const eddsa = await buildEddsa();
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const priv = createHash("sha256").update(ISSUER_SECRET).digest();
  const [Ax, Ay] = eddsa.prv2pub(priv);
  cached = { eddsa, poseidon, F, priv, pub: { x: F.toObject(Ax).toString(), y: F.toObject(Ay).toString() } };
  return cached;
}

export const toDays = (iso: string) => Math.floor(new Date(iso).getTime() / 86400000);
export const today = () => Math.floor(Date.now() / 86400000);

export function cors(res: { setHeader: (k: string, v: string) => void }) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}
