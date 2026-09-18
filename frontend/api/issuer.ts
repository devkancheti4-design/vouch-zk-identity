import type { VercelRequest, VercelResponse } from "@vercel/node";
import { ISSUER_LABEL, cors, issuer } from "./_issuer";

/** Who is vouching. The public key here is what every verifier policy names. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  cors(res);
  try {
    const { pub } = await issuer();
    res.status(200).json({ name: ISSUER_LABEL, pubX: pub.x, pubY: pub.y, issuedCount: 0 });
  } catch (e) {
    // report the real reason rather than letting the runtime swallow it
    res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? (e.stack ?? "").split("\n").slice(0, 4) : undefined,
      node: process.version,
    });
  }
}
