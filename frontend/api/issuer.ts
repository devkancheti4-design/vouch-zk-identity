import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ISSUER_KEY } from "./generated/issuer-key";

/**
 * Who is vouching. The public key here is what every verifier policy names.
 *
 * Derived at build time by scripts/gen-issuer-key.mjs, because this answer is a pure function
 * of ISSUER_SECRET. Signing genuinely needs a curve; saying who the issuer is does not, and
 * making this endpoint depend on one meant a runtime that cannot load circomlibjs took issuer
 * discovery down with it.
 *
 * Nothing here imports anything but a generated constant -- no JSON resolution, no bundler
 * tracing, nothing that can fail at cold start.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ ...ISSUER_KEY, issuedCount: 0 });
}
