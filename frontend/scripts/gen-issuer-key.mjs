/**
 * Derives the issuer's public key at BUILD time, so the serverless /api/issuer never loads a
 * curve implementation to answer a question whose answer is fixed.
 *
 * The key is a pure function of ISSUER_SECRET, so computing it once here is exactly as correct
 * as computing it on every cold start -- and it cannot fail in a runtime we do not control.
 */
import { buildEddsa, buildPoseidon } from "circomlibjs";
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";

const LABEL = process.env.ISSUER_LABEL ?? "Demo KYC Provider";
const SECRET = process.env.ISSUER_SECRET ?? LABEL;

const eddsa = await buildEddsa();
const poseidon = await buildPoseidon();
const F = poseidon.F;
const priv = createHash("sha256").update(SECRET).digest();
const [Ax, Ay] = eddsa.prv2pub(priv);

mkdirSync("api/generated", { recursive: true });
writeFileSync("api/generated/issuer-key.json",
  JSON.stringify({ name: LABEL, pubX: F.toObject(Ax).toString(), pubY: F.toObject(Ay).toString() }, null, 2) + "\n");
console.log("wrote api/generated/issuer-key.json for", LABEL);

const c = globalThis.curve_bn128;
if (c?.terminate) await c.terminate();
