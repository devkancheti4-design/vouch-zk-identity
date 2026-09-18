import type { VercelRequest, VercelResponse } from "@vercel/node";
import key from "./generated/issuer-key.json";

/**
 * Who is vouching. The public key here is what every verifier policy names.
 *
 * This answer is a pure function of ISSUER_SECRET, so it is derived at build time by
 * scripts/gen-issuer-key.mjs rather than by loading a curve implementation on every cold
 * start. Signing genuinely needs the curve; telling you who the issuer is does not, and
 * making this endpoint depend on it meant a runtime that could not load circomlibjs took
 * issuer discovery down with it.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ name: key.name, pubX: key.pubX, pubY: key.pubY, issuedCount: 0 });
}
